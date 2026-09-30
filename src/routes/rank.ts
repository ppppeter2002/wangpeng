import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { generateQuestions } from '../lib/ai.js'
import { createNotification } from '../lib/notification.js'

// 段位链：黑铁 → 青铜 → 白银 → 黄金 → 铂金 → 钻石
const TIERS = ['黑铁', '青铜', '白银', '黄金', '铂金', '钻石']
const PASS_THRESHOLD = 0.6 // 60% 答对通过
const QUESTION_COUNT = 5 // 每次测试 5 题

type UserRecord = {
  id: string
  role: string
  name: string | null
}

type StudentRankRecord = {
  id: string
  studentId: string
  districtId: string | null
  tier: string
  tierRank: number | null
  score: number
  weakTopics: string
  seasonId: string | null
  updatedAt: Date
}

type QuestionBankRecord = {
  id: string
  teacherId: string
  subject: string
  topic: string
  difficulty: number
  question: string
  answer: string
  options: string | null
}

type PromotionTestRecord = {
  id: string
  studentId: string
  fromTier: string
  toTier: string
  questions: string
  source: string
  passed: boolean | null
  score: number | null
  createdAt: Date
  finishedAt: Date | null
}

type AssignmentSubmissionRecord = {
  id: string
  assignmentId: string
  studentId: string
  score: number | null
  feedback: string | null
}

type AssignmentRecord = {
  id: string
  title: string
  subject: string
}

const rankModel = prisma.studentRank
const testModel = prisma.promotionTest
const bankModel = prisma.questionBank
const submissionModel = prisma.assignmentSubmission
const assignmentModel = prisma.assignment
const router = Router()

function nextTier(current: string): string | null {
  const idx = TIERS.indexOf(current)
  if (idx < 0 || idx >= TIERS.length - 1) return null
  return TIERS[idx + 1]
}

// 标准化答案：兼容 "A" 和 "A. 内容" 两种格式，取首字母
function normalizeAnswer(raw: string): string {
  const s = String(raw).trim()
  const m = s.match(/^([A-Z])/i)
  return m ? m[1].toUpperCase() : s.toUpperCase()
}

// 1. POST /init - 创建学生段位
router.post('/init', async (request, response) => {
  try {
    if (!rankModel) {
      response.status(500).json({ error: 'studentRank model unavailable' })
      return
    }
    const { studentId, districtId, seasonId } = request.body as {
      studentId?: string
      districtId?: string
      seasonId?: string
    }
    if (!studentId) {
      response.status(400).json({ error: 'studentId required' })
      return
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } }) as UserRecord | null
    if (!student || student.role !== 'student') {
      response.status(403).json({ error: 'only student can init rank' })
      return
    }

    // upsert 防重复
    const rank = await rankModel.upsert({
      where: { studentId },
      create: {
        studentId,
        districtId: districtId ?? null,
        tier: '黑铁',
        score: 0,
        weakTopics: '[]',
        seasonId: seasonId ?? null
      },
      update: {}
    }) as StudentRankRecord

    response.status(201).json({
      rankId: rank.id,
      tier: rank.tier,
      score: rank.score
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'init rank failed' })
  }
})

// 2. GET /leaderboard - 排行榜
router.get('/leaderboard', async (request, response) => {
  try {
    if (!rankModel) {
      response.status(500).json({ error: 'studentRank model unavailable' })
      return
    }
    const districtId = request.query.districtId ? String(request.query.districtId).trim() : ''
    const tier = request.query.tier ? String(request.query.tier).trim() : ''

    const where: { districtId?: string; tier?: string } = {}
    if (districtId) where.districtId = districtId
    if (tier) where.tier = tier

    const records = await rankModel.findMany({
      where,
      orderBy: { score: 'desc' }
    }) as StudentRankRecord[]

    // 查学生姓名
    const studentIds = Array.from(new Set(records.map((r) => r.studentId)))
    const students = studentIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true } }) as { id: string; name: string | null }[]
      : []
    const nameMap = new Map(students.map((s) => [s.id, s.name]))

    response.json({
      leaderboard: records.map((r, i) => ({
        rank: i + 1,
        studentId: r.studentId,
        studentName: nameMap.get(r.studentId) ?? null,
        districtId: r.districtId,
        tier: r.tier,
        tierRank: r.tierRank,
        score: r.score,
        seasonId: r.seasonId
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get leaderboard failed' })
  }
})

// 3. POST /promotion-test/start - 开始晋级测试
router.post('/promotion-test/start', async (request, response) => {
  try {
    if (!rankModel || !testModel || !bankModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const { studentId } = request.body as { studentId?: string }
    if (!studentId) {
      response.status(400).json({ error: 'studentId required' })
      return
    }

    const rank = await rankModel.findUnique({ where: { studentId } }) as StudentRankRecord | null
    if (!rank) {
      response.status(404).json({ error: 'student rank not initialized, call /init first' })
      return
    }

    const targetTier = nextTier(rank.tier)
    if (!targetTier) {
      response.status(400).json({ error: 'already at top tier' })
      return
    }

    // 读 weakTopics（从 StudentRank.weakTopics JSON 数组）
    let weakTopics: string[] = []
    try {
      weakTopics = JSON.parse(rank.weakTopics || '[]') as string[]
    } catch {
      weakTopics = []
    }

    // 兜底：若 weakTopics 为空，从低分作业（score<60）反馈读
    if (weakTopics.length === 0 && submissionModel && assignmentModel) {
      const lowSubs = await submissionModel.findMany({
        where: { studentId, score: { lt: 60, not: null } }
      }) as AssignmentSubmissionRecord[]
      const aIdsSet = Array.from(new Set(lowSubs.map((s) => s.assignmentId)))
      const asgns = aIdsSet.length > 0
        ? await assignmentModel.findMany({ where: { id: { in: aIdsSet } } }) as AssignmentRecord[]
        : []
      const subjSet = new Set(asgns.map((a) => a.subject))
      weakTopics = Array.from(subjSet)
    }

    // 题目来源：优先调混元 AI 出题，失败/无 Key/非法 JSON 降级题库
    let questions: { question: string; answer: string; options?: string[] | null; topic?: string; difficulty?: number }[] = []
    let source = 'ai'

    const aiSubject = weakTopics[0] || '综合'
    const aiTopic = weakTopics[0] || '综合'
    try {
      questions = await generateQuestions({
        subject: aiSubject,
        topic: aiTopic,
        difficulty: 3,
        count: QUESTION_COUNT,
        mode: 'promotion'
      })
      source = 'ai'
    } catch (aiErr) {
      // 降级题库：无 Key / HTTP 错 / JSON 解析失败 / 空结果 都走这里
      console.log(`[ai-fallback] student=${studentId} reason=${aiErr instanceof Error ? aiErr.message : 'unknown'}, downgrade to question bank`)
      // 题库兜底：按 weakTopics 找题，没找到则随机抽
      const bankQuestions = await bankModel.findMany({
        where: weakTopics.length > 0 ? { OR: weakTopics.map((t) => ({ topic: t })) } : {}
      }) as QuestionBankRecord[]

      if (bankQuestions.length >= QUESTION_COUNT) {
        const shuffled = bankQuestions.sort(() => Math.random() - 0.5).slice(0, QUESTION_COUNT)
        questions = shuffled.map((q) => ({
          question: q.question,
          answer: q.answer,
          options: q.options ? safeParseOptions(q.options) : null,
          topic: q.topic,
          difficulty: q.difficulty
        }))
        source = 'bank'
      } else if (bankQuestions.length > 0) {
        questions = bankQuestions.map((q) => ({
          question: q.question,
          answer: q.answer,
          options: q.options ? safeParseOptions(q.options) : null,
          topic: q.topic,
          difficulty: q.difficulty
        }))
        source = 'bank'
      } else {
        // 题库空，生成占位题（保证测试能跑通）
        questions = Array.from({ length: QUESTION_COUNT }, (_, i) => ({
          question: `占位题${i + 1}：${targetTier}段位晋级测试题`,
          answer: 'A',
          options: ['A', 'B', 'C', 'D']
        }))
        source = 'bank'
      }
    }

    // 创建 PromotionTest（questions 存完整 JSON 含答案）
    const test = await testModel.create({
      data: {
        studentId,
        fromTier: rank.tier,
        toTier: targetTier,
        questions: JSON.stringify(questions),
        source
      }
    }) as PromotionTestRecord

    // 返回给学生时不暴露答案
    response.status(201).json({
      testId: test.id,
      fromTier: test.fromTier,
      toTier: test.toTier,
      source: test.source,
      questions: questions.map((q, i) => ({
        index: i,
        question: q.question,
        options: q.options ?? null,
        topic: q.topic ?? null,
        difficulty: q.difficulty ?? null
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'start promotion test failed' })
  }
})

// 4. POST /promotion-test/submit - 批改并升级
router.post('/promotion-test/submit', async (request, response) => {
  try {
    if (!testModel || !rankModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const { testId, answers } = request.body as { testId?: string; answers?: (string | null)[] }
    if (!testId || !Array.isArray(answers)) {
      response.status(400).json({ error: 'testId and answers[] required' })
      return
    }

    const test = await testModel.findUnique({ where: { id: testId } }) as PromotionTestRecord | null
    if (!test) {
      response.status(404).json({ error: 'promotion test not found' })
      return
    }
    if (test.passed !== null) {
      response.status(409).json({ error: 'test already submitted', passed: test.passed })
      return
    }

    const questions = JSON.parse(test.questions) as { question: string; answer: string }[]
    let correct = 0
    for (let i = 0; i < questions.length; i++) {
      const studentAns = answers[i] ?? null
      if (studentAns !== null && normalizeAnswer(studentAns) === normalizeAnswer(questions[i].answer)) {
        correct++
      }
    }
    const score = Math.round((correct / questions.length) * 100)
    const passed = score >= Math.round(PASS_THRESHOLD * 100)

    // 更新 PromotionTest
    await testModel.update({
      where: { id: testId },
      data: { passed, score, finishedAt: new Date() }
    })

    // 通过则升级 StudentRank
    let upgraded = false
    let newTier = test.fromTier
    if (passed) {
      const rank = await rankModel.findUnique({ where: { studentId: test.studentId } }) as StudentRankRecord | null
      if (rank && rank.tier === test.fromTier) {
        await rankModel.update({
          where: { studentId: test.studentId },
          data: { tier: test.toTier, score: { increment: 100 } }
        })
        upgraded = true
        newTier = test.toTier
      }
    }

    // 触发通知
    const notifType = passed ? 'promotion_passed' : 'promotion_failed'
    const notifTitle = passed ? '晋级测试通过' : '晋级测试未通过'
    const notifContent = passed
      ? `恭喜！您已从${test.fromTier}段晋级为${test.toTier}段，得分${score}`
      : `本次晋级测试未通过，得分${score}（需≥${Math.round(PASS_THRESHOLD * 100)}），再接再厉`
    await createNotification({
      userId: test.studentId,
      type: notifType,
      title: notifTitle,
      content: notifContent,
      payload: {
        testId,
        score,
        passed,
        fromTier: test.fromTier,
        toTier: test.toTier,
        wechatTemplate: {
          miniprogram: { pagepath: 'pages/parent/notifications/notifications' }
        }
      }
    })

    response.json({
      testId,
      score,
      correct,
      total: questions.length,
      passed,
      upgraded,
      newTier
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'submit promotion test failed' })
  }
})

// 5. POST /update-from-pk - PK 积分更新
router.post('/update-from-pk', async (request, response) => {
  try {
    if (!rankModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const { studentId, delta } = request.body as { studentId?: string; delta?: number }
    if (!studentId || delta === undefined || !Number.isInteger(delta)) {
      response.status(400).json({ error: 'studentId and integer delta required' })
      return
    }

    const rank = await rankModel.findUnique({ where: { studentId } }) as StudentRankRecord | null
    if (!rank) {
      response.status(404).json({ error: 'student rank not initialized' })
      return
    }

    const newScore = Math.max(0, rank.score + delta)
    await rankModel.update({
      where: { studentId },
      data: { score: newScore }
    })

    // PK 积分变动通知（仅显著变动）
    if (Math.abs(delta) >= 10) {
      const notifType = delta > 0 ? 'pk_score_gain' : 'pk_score_lose'
      const notifTitle = delta > 0 ? 'PK 积分增加' : 'PK 积分减少'
      const notifContent = `${delta > 0 ? '获胜' : '失利'} ${Math.abs(delta)} 分，当前总积分 ${newScore}`
      await createNotification({
        userId: studentId,
        type: notifType,
        title: notifTitle,
        content: notifContent,
        payload: {
          delta,
          newScore,
          wechatTemplate: {
            miniprogram: { pagepath: 'pages/parent/notifications/notifications' }
          }
        }
      })
    }

    response.json({ studentId, delta, newScore })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'update pk score failed' })
  }
})

function safeParseOptions(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

// 6. GET /my/:studentId - 我的段位/积分/排名/弱项
router.get('/my/:studentId', async (request, response) => {
  try {
    if (!rankModel) {
      response.status(500).json({ error: 'studentRank model unavailable' })
      return
    }
    const { studentId } = request.params as { studentId: string }
    if (!studentId) {
      response.status(400).json({ error: 'studentId required' })
      return
    }

    const rank = await rankModel.findUnique({ where: { studentId } }) as StudentRankRecord | null
    if (!rank) {
      response.status(404).json({ error: 'student rank not initialized, call /init first' })
      return
    }

    // 计算排名：score 比该学生高的学生数 + 1（同 districtId 限定，便于区县内排名）
    const where: { score?: { gt: number }; districtId?: string } = { score: { gt: rank.score } }
    if (rank.districtId) where.districtId = rank.districtId
    const higher = await rankModel.count({ where })
    const myRank = higher + 1

    // 解析 weakTopics
    let weakTopics: string[] = []
    try {
      weakTopics = JSON.parse(rank.weakTopics || '[]') as string[]
    } catch {
      weakTopics = []
    }

    // 该段位总人数（用于显示"x/N"）
    const tierWhere: { tier: string; districtId?: string } = { tier: rank.tier }
    if (rank.districtId) tierWhere.districtId = rank.districtId
    const tierTotal = await rankModel.count({ where: tierWhere })

    response.json({
      studentId: rank.studentId,
      tier: rank.tier,
      tierRank: rank.tierRank,
      score: rank.score,
      seasonScore: rank.score, // 当前 score 即赛季积分
      rank: myRank,
      districtId: rank.districtId,
      seasonId: rank.seasonId,
      weakTopics,
      tierTotal,
      updatedAt: rank.updatedAt
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get my rank failed' })
  }
})

export default router
