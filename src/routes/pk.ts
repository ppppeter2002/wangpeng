import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { generateQuestions } from '../lib/ai.js'
import { createNotification } from '../lib/notification.js'

// 段位链：黑铁 → 青铜 → 白银 → 黄金 → 铂金 → 钻石
const TIERS = ['黑铁', '青铜', '白银', '黄金', '铂金', '钻石']
const QUESTION_COUNT = 5
const ROUND_TIME_LIMIT = 60 // 秒
const WIN_DELTA = 20

type UserRecord = { id: string; role: string; name: string | null }
type StudentRankRecord = { id: string; studentId: string; tier: string; score: number; districtId: string | null }
type QuestionBankRecord = { id: string; question: string; answer: string; options: string | null; topic: string; difficulty: number }
type PkMatchRecord = {
  id: string; districtId: string | null; tierA: string; tierB: string
  studentAId: string; studentBId: string | null; status: string; round: number
  scoreA: number; scoreB: number; winnerId: string | null
  questions: string; createdAt: Date; finishedAt: Date | null
}
type PkRoundRecord = {
  id: string; matchId: string; round: number; questions: string
  answersA: string | null; answersB: string | null
  scoreA: number; scoreB: number; completedAt: Date | null
}

const matchModel = prisma.pkMatch
const roundModel = prisma.pkRound
const rankModel = prisma.studentRank
const bankModel = prisma.questionBank
const router = Router()

function tierIndex(tier: string): number { return TIERS.indexOf(tier) }
function tiersClose(a: string, b: string): boolean {
  const ia = tierIndex(a), ib = tierIndex(b)
  return ia >= 0 && ib >= 0 && Math.abs(ia - ib) <= 1
}
function safeParseOptions(raw: string): string[] | null {
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : null } catch { return null }
}
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

const PK_SUBJECTS = ['数学', '语文', '英语', '物理', '化学']

async function pickQuestions(mode: 'pk-timed' | 'pk-buzz' = 'pk-timed'): Promise<{ question: string; answer: string; options?: string[] | null; topic?: string; difficulty?: number }[]> {
  // 优先调混元 AI，失败/无 Key/非法 JSON 降级题库
  try {
    const subject = PK_SUBJECTS[Math.floor(Math.random() * PK_SUBJECTS.length)]
    const list = await generateQuestions({ subject, topic: '综合', mode, count: QUESTION_COUNT })
    return list.map((q) => ({
      question: q.question, answer: q.answer, options: q.options ?? null, topic: q.topic, difficulty: q.difficulty
    }))
  } catch (aiErr) {
    console.log(`[ai-fallback] pk mode=${mode} reason=${aiErr instanceof Error ? aiErr.message : 'unknown'}, downgrade to question bank`)
    if (bankModel) {
      const all = await bankModel.findMany({}) as QuestionBankRecord[]
      if (all.length > 0) {
        return shuffle(all).slice(0, Math.min(QUESTION_COUNT, all.length)).map((q) => ({
          question: q.question, answer: q.answer, options: q.options ? safeParseOptions(q.options) : null, topic: q.topic, difficulty: q.difficulty
        }))
      }
    }
    return Array.from({ length: QUESTION_COUNT }, (_, i) => ({ question: `PK 占位题${i + 1}`, answer: 'A', options: ['A', 'B', 'C', 'D'] }))
  }
}

// 标准化答案：兼容 "A" 和 "A. 内容" 两种格式，取首字母
function normalizeAnswer(raw: string): string {
  const s = String(raw).trim()
  const m = s.match(/^([A-Z])/i)
  return m ? m[1].toUpperCase() : s.toUpperCase()
}

function gradeRound(questions: { answer: string }[], answers: (string | null)[]): number {
  let correct = 0
  for (let i = 0; i < questions.length; i++) {
    const ans = answers[i] ?? null
    if (ans !== null && normalizeAnswer(ans) === normalizeAnswer(questions[i].answer)) correct++
  }
  return Math.round((correct / questions.length) * 100)
}

// 1. POST /match - 自动匹配（找 waiting 或新建）
router.post('/match', async (request, response) => {
  try {
    if (!matchModel || !rankModel) { response.status(500).json({ error: 'models unavailable' }); return }
    const { studentId } = request.body as { studentId?: string }
    if (!studentId) { response.status(400).json({ error: 'studentId required' }); return }

    const student = await prisma.user.findUnique({ where: { id: studentId } }) as UserRecord | null
    if (!student || student.role !== 'student') { response.status(403).json({ error: 'only student can match' }); return }

    const rank = await rankModel.findUnique({ where: { studentId } }) as StudentRankRecord | null
    if (!rank) { response.status(404).json({ error: 'student rank not initialized, call /api/rank/init first' }); return }

    // 找同 districtId + 段位相近的 waiting 对局
    const candidates = await matchModel.findMany({
      where: { status: 'waiting', studentAId: { not: studentId } }
    }) as PkMatchRecord[]

    const match = candidates.find((m) => {
      // districtId 匹配：任一方为 null 视为通配，双方非 null 则必须相等
      const districtOk = m.districtId === null || rank.districtId === null || m.districtId === rank.districtId
      return districtOk && tiersClose(m.tierA, rank.tier)
    })

    if (match) {
      // 匹配成功
      await matchModel.update({
        where: { id: match.id },
        data: { studentBId: studentId, tierB: rank.tier, status: 'matched' }
      })
      response.status(201).json({
        matchId: match.id, status: 'matched', matched: true,
        studentAId: match.studentAId, studentBId: studentId,
        tierA: match.tierA, tierB: rank.tier, districtId: match.districtId
      })
    } else {
      // 新建 waiting
      const newMatch = await matchModel.create({
        data: { studentAId: studentId, districtId: rank.districtId ?? null, tierA: rank.tier, tierB: rank.tier, status: 'waiting', questions: '[]' }
      }) as PkMatchRecord
      response.status(201).json({
        matchId: newMatch.id, status: 'waiting', matched: false,
        studentAId: studentId, tierA: rank.tier, tierB: rank.tier, districtId: newMatch.districtId
      })
    }
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'match failed' })
  }
})

// 2. POST /start - 开始对局，生成第1轮题目
router.post('/start', async (request, response) => {
  try {
    if (!matchModel || !roundModel) { response.status(500).json({ error: 'models unavailable' }); return }
    const { matchId } = request.body as { matchId?: string }
    if (!matchId) { response.status(400).json({ error: 'matchId required' }); return }

    const match = await matchModel.findUnique({ where: { id: matchId } }) as PkMatchRecord | null
    if (!match) { response.status(404).json({ error: 'match not found' }); return }
    if (match.status !== 'matched') { response.status(409).json({ error: 'match not in matched status', status: match.status }); return }

    const questions = await pickQuestions('pk-timed')
    await roundModel.create({ data: { matchId, round: 1, questions: JSON.stringify(questions), scoreA: 0, scoreB: 0 } })
    await matchModel.update({ where: { id: matchId }, data: { status: 'ongoing', round: 1, questions: JSON.stringify(questions) } })

    response.status(201).json({
      matchId, status: 'ongoing', round: 1, timeLimit: ROUND_TIME_LIMIT,
      questions: questions.map((q, i) => ({ index: i, question: q.question, options: q.options ?? null, topic: q.topic ?? null, difficulty: q.difficulty ?? null }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'start failed' })
  }
})

// 3. POST /answer - 提交答案
router.post('/answer', async (request, response) => {
  try {
    if (!matchModel || !roundModel) { response.status(500).json({ error: 'models unavailable' }); return }
    const { matchId, studentId, round, answers } = request.body as { matchId?: string; studentId?: string; round?: number; answers?: (string | null)[] }
    if (!matchId || !studentId || !Number.isInteger(round) || !Array.isArray(answers)) {
      response.status(400).json({ error: 'matchId, studentId, round, answers[] required' }); return
    }

    const match = await matchModel.findUnique({ where: { id: matchId } }) as PkMatchRecord | null
    if (!match) { response.status(404).json({ error: 'match not found' }); return }
    if (match.status !== 'ongoing') { response.status(409).json({ error: 'match not ongoing', status: match.status }); return }

    const isA = match.studentAId === studentId
    const isB = match.studentBId === studentId
    if (!isA && !isB) { response.status(403).json({ error: 'studentId not in this match' }); return }

    const rounds = await roundModel.findMany({ where: { matchId }, orderBy: { round: 'asc' } }) as PkRoundRecord[]
    const cur = rounds.find((r) => r.round === round)
    if (!cur) { response.status(404).json({ error: `round ${round} not found` }); return }

    const already = isA ? cur.answersA !== null : cur.answersB !== null
    if (already) { response.status(409).json({ error: 'already submitted', side: isA ? 'A' : 'B' }); return }

    const questions = JSON.parse(cur.questions) as { answer: string }[]
    const score = gradeRound(questions, answers)

    const updateData: Record<string, unknown> = isA
      ? { answersA: JSON.stringify(answers), scoreA: score }
      : { answersB: JSON.stringify(answers), scoreB: score }

    // 检查双方是否都提交
    const willA = isA ? true : cur.answersA !== null
    const willB = isB ? true : cur.answersB !== null
    if (willA && willB) updateData.completedAt = new Date()

    await roundModel.update({ where: { id: cur.id }, data: updateData })

    // 更新 PKMatch 累计分
    const matchUpdate: Record<string, unknown> = {}
    if (isA) matchUpdate.scoreA = match.scoreA + score
    else matchUpdate.scoreB = match.scoreB + score
    await matchModel.update({ where: { id: matchId }, data: matchUpdate })

    response.json({ matchId, round, side: isA ? 'A' : 'B', score, bothDone: willA && willB })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'answer failed' })
  }
})

// 4. POST /next-round - 进入第2轮（抢答）
router.post('/next-round', async (request, response) => {
  try {
    if (!matchModel || !roundModel) { response.status(500).json({ error: 'models unavailable' }); return }
    const { matchId } = request.body as { matchId?: string }
    if (!matchId) { response.status(400).json({ error: 'matchId required' }); return }

    const match = await matchModel.findUnique({ where: { id: matchId } }) as PkMatchRecord | null
    if (!match) { response.status(404).json({ error: 'match not found' }); return }
    if (match.status !== 'ongoing') { response.status(409).json({ error: 'match not ongoing', status: match.status }); return }
    if (match.round !== 1) { response.status(409).json({ error: 'not in round 1', round: match.round }); return }

    // 校验 round1 双方已提交
    const rounds = await roundModel.findMany({ where: { matchId } }) as PkRoundRecord[]
    const r1 = rounds.find((r) => r.round === 1)
    if (!r1 || r1.answersA === null || r1.answersB === null) {
      response.status(409).json({ error: 'round 1 not fully submitted' }); return
    }

    const questions = await pickQuestions('pk-buzz')
    await roundModel.create({ data: { matchId, round: 2, questions: JSON.stringify(questions), scoreA: 0, scoreB: 0 } })
    await matchModel.update({ where: { id: matchId }, data: { round: 2, questions: JSON.stringify(questions) } })

    response.status(201).json({
      matchId, round: 2, timeLimit: ROUND_TIME_LIMIT,
      questions: questions.map((q, i) => ({ index: i, question: q.question, options: q.options ?? null, topic: q.topic ?? null, difficulty: q.difficulty ?? null }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'next-round failed' })
  }
})

// 5. POST /finish - 结束对局
router.post('/finish', async (request, response) => {
  try {
    if (!matchModel || !roundModel || !rankModel) { response.status(500).json({ error: 'models unavailable' }); return }
    const { matchId } = request.body as { matchId?: string }
    if (!matchId) { response.status(400).json({ error: 'matchId required' }); return }

    const match = await matchModel.findUnique({ where: { id: matchId } }) as PkMatchRecord | null
    if (!match) { response.status(404).json({ error: 'match not found' }); return }
    if (match.status === 'finished') { response.status(409).json({ error: 'already finished', winnerId: match.winnerId }); return }
    if (match.status !== 'ongoing') { response.status(409).json({ error: 'match not ongoing', status: match.status }); return }

    // 校验当前轮双方已提交
    const rounds = await roundModel.findMany({ where: { matchId }, orderBy: { round: 'asc' } }) as PkRoundRecord[]
    const curRound = rounds.find((r) => r.round === match.round)
    if (!curRound || curRound.answersA === null || curRound.answersB === null) {
      response.status(409).json({ error: `round ${match.round} not fully submitted` }); return
    }

    // 判定 winner
    let winnerId: string | null = null
    if (match.scoreA > match.scoreB) winnerId = match.studentAId
    else if (match.scoreB > match.scoreA) winnerId = match.studentBId ?? null
    // 平局 winnerId=null

    await matchModel.update({
      where: { id: matchId },
      data: { winnerId, status: 'finished', finishedAt: new Date() }
    })

    // 胜者 score+20 写入 StudentRank
    let winnerNewScore: number | null = null
    if (winnerId) {
      const winRank = await rankModel.findUnique({ where: { studentId: winnerId } }) as StudentRankRecord | null
      if (winRank) {
        winnerNewScore = winRank.score + WIN_DELTA
        await rankModel.update({ where: { studentId: winnerId }, data: { score: winnerNewScore } })
      }
    }

    // 触发 pk_result 通知（双方都发）
    const studentIds = [match.studentAId, match.studentBId].filter(Boolean) as string[]
    for (const sid of studentIds) {
      const isWinner = sid === winnerId
      const myScore = sid === match.studentAId ? match.scoreA : match.scoreB
      const oppScore = sid === match.studentAId ? match.scoreB : match.scoreA
      const title = isWinner ? 'PK 对战获胜' : (winnerId === null ? 'PK 对战平局' : 'PK 对战失利')
      const content = isWinner
        ? `恭喜获胜！比分 ${myScore}:${oppScore}，积分 +${WIN_DELTA}`
        : (winnerId === null ? `本场平局，比分 ${myScore}:${oppScore}，积分不变` : `本场失利，比分 ${myScore}:${oppScore}`)
      await createNotification({
        userId: sid,
        type: 'pk_result',
        title,
        content,
        payload: {
          matchId,
          winnerId,
          myScore,
          oppScore,
          delta: isWinner ? WIN_DELTA : 0,
          wechatTemplate: {
            miniprogram: { pagepath: 'pages/parent/notifications/notifications' }
          }
        }
      })
    }

    response.json({
      matchId, status: 'finished', winnerId,
      scoreA: match.scoreA, scoreB: match.scoreB,
      winnerScoreDelta: WIN_DELTA, winnerNewScore
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'finish failed' })
  }
})

// 6. GET /history - 查对战历史
router.get('/history', async (request, response) => {
  try {
    if (!matchModel) { response.status(500).json({ error: 'pkMatch model unavailable' }); return }
    const studentId = request.query.studentId ? String(request.query.studentId).trim() : ''
    const limit = request.query.limit ? Math.min(Number(request.query.limit), 100) : 10
    if (!studentId) { response.status(400).json({ error: 'studentId required' }); return }

    const matches = await matchModel.findMany({
      where: { OR: [{ studentAId: studentId }, { studentBId: studentId }] },
      orderBy: { createdAt: 'desc' },
      take: limit
    }) as PkMatchRecord[]

    response.json({
      studentId, count: matches.length,
      matches: matches.map((m) => ({
        matchId: m.id, status: m.status, round: m.round,
        tierA: m.tierA, tierB: m.tierB,
        studentAId: m.studentAId, studentBId: m.studentBId,
        scoreA: m.scoreA, scoreB: m.scoreB, winnerId: m.winnerId,
        districtId: m.districtId, createdAt: m.createdAt, finishedAt: m.finishedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'history failed' })
  }
})

// 7. GET /lobby - PK 大厅待匹配列表（waiting 状态对局）
router.get('/lobby', async (_request, response) => {
  try {
    if (!matchModel) { response.status(500).json({ error: 'models unavailable' }); return }
    const matches = await matchModel.findMany({
      where: { status: 'waiting' },
      orderBy: { createdAt: 'asc' }
    }) as PkMatchRecord[]

    // 查学生姓名便于大厅展示
    const aIds = Array.from(new Set(matches.map((m) => m.studentAId)))
    const students = aIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: aIds } }, select: { id: true, name: true } }) as { id: string; name: string | null }[]
      : []
    const nameMap = new Map(students.map((s) => [s.id, s.name]))

    response.json({
      lobby: matches.map((m) => ({
        matchId: m.id,
        studentAId: m.studentAId,
        studentAName: nameMap.get(m.studentAId) ?? null,
        tierA: m.tierA,
        districtId: m.districtId,
        createdAt: m.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'lobby failed' })
  }
})

// 8. GET /match/:matchId - 查询单个对局状态（前端轮询用，不依赖 WebSocket）
router.get('/match/:matchId', async (request, response) => {
  try {
    if (!matchModel || !roundModel) { response.status(500).json({ error: 'models unavailable' }); return }
    const { matchId } = request.params as { matchId: string }
    const match = await matchModel.findUnique({ where: { id: matchId } }) as PkMatchRecord | null
    if (!match) { response.status(404).json({ error: 'match not found' }); return }

    const rounds = await roundModel.findMany({ where: { matchId }, orderBy: { round: 'asc' } }) as PkRoundRecord[]
    const studentIds = [match.studentAId, match.studentBId].filter(Boolean) as string[]
    const students = studentIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true } }) as { id: string; name: string | null }[]
      : []
    const nameMap = new Map(students.map((s) => [s.id, s.name]))

    response.json({
      matchId: match.id,
      status: match.status,
      round: match.round,
      tierA: match.tierA,
      tierB: match.tierB,
      studentAId: match.studentAId,
      studentBId: match.studentBId,
      studentAName: nameMap.get(match.studentAId) ?? null,
      studentBName: match.studentBId ? (nameMap.get(match.studentBId) ?? null) : null,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      winnerId: match.winnerId,
      districtId: match.districtId,
      createdAt: match.createdAt,
      finishedAt: match.finishedAt,
      rounds: rounds.map((r) => ({
        round: r.round,
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        aDone: r.answersA !== null,
        bDone: r.answersB !== null,
        completedAt: r.completedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get match failed' })
  }
})

export default router
