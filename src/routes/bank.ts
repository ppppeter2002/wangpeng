import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { hashQuestion } from '../lib/hash.js'

type UserRecord = { id: string; role: string; name: string | null }

type LessonPlanRecord = {
  id: string
  authorId: string
  classId: string
  subject: string
  title: string
  content: string
  status: string
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
  source: string
  sourceRef: string | null
  chapter: string | null
  gradeLevel: number | null
  questionType: string
  parsedAt: Date
  hash: string | null
  createdAt: Date
}

type IngestQuestion = {
  question: string
  options?: string[]
  answer: string
  explanation?: string
  subject?: string
  topic?: string
  difficulty?: number
  chapter?: string
  questionType?: string
}

const bankModel = prisma.questionBank
const planModel = prisma.lessonPlan

const router = Router()

// 工具：批量入库，hash 去重（已存在则跳过）
async function ingestQuestions(
  questions: IngestQuestion[],
  opts: { teacherId: string; subject: string; source: string; sourceRef?: string; chapter?: string; gradeLevel?: number }
): Promise<{ ingested: number; skipped: number }> {
  let ingested = 0
  let skipped = 0
  for (const q of questions) {
    if (!q.question || !q.answer) { skipped++; continue }
    const hash = hashQuestion(q.question)
    if (!bankModel) continue
    try {
      // 先 findUnique 看是否已存在
      const existing = await bankModel.findUnique({ where: { hash } }) as QuestionBankRecord | null
      if (existing) { skipped++; continue }
      await bankModel.create({
        data: {
          teacherId: opts.teacherId,
          subject: q.subject || opts.subject,
          topic: q.topic || q.chapter || '综合',
          difficulty: q.difficulty ?? 3,
          question: q.question,
          answer: q.answer,
          options: q.options ? JSON.stringify(q.options) : null,
          source: opts.source,
          sourceRef: opts.sourceRef ?? null,
          chapter: q.chapter || opts.chapter || null,
          gradeLevel: opts.gradeLevel ?? null,
          questionType: q.questionType || (q.options && q.options.length > 0 ? 'single' : 'essay'),
          hash
        }
      })
      ingested++
    } catch {
      // 唯一冲突兜底（并发场景）
      skipped++
    }
  }
  return { ingested, skipped }
}

// 调混元拆题（只输出 JSON），返回 IngestQuestion[]
async function callHunyuanForQuestions(prompt: string): Promise<IngestQuestion[]> {
  const apiKey = process.env.HUNYUAN_API_KEY
  if (!apiKey) throw new Error('NO_HUNYUAN_KEY')
  const baseUrl = process.env.HUNYUAN_BASE_URL || 'https://api.hunyuan.cloud.tencent.com/v1'
  const model = process.env.HUNYUAN_MODEL || 'hunyuan-turbos-latest'
  const maxTokens = Number(process.env.HUNYUAN_MAX_TOKENS ?? 4000)

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: '你是一个中小学题库生成器。只输出 JSON，不要解释。' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    })
  })
  if (!resp.ok) throw new Error(`HUNYUAN_HTTP_${resp.status}`)
  const data = await resp.json() as { choices?: { message?: { content?: string } }[] }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('EMPTY_RESPONSE')
  const parsed = JSON.parse(content) as { questions?: IngestQuestion[] }
  const list = parsed.questions ?? []
  if (!Array.isArray(list) || list.length === 0) throw new Error('EMPTY_QUESTIONS')
  return list
}

// 1. POST /upload - 老师手动上传单题（保留兼容）
router.post('/upload', async (request, response) => {
  try {
    if (!bankModel) {
      response.status(500).json({ error: 'questionBank model unavailable' })
      return
    }
    const { teacherId, subject, topic, difficulty, question, answer, options, chapter, gradeLevel, questionType } = request.body as {
      teacherId?: string
      subject?: string
      topic?: string
      difficulty?: number
      question?: string
      answer?: string
      options?: string
      chapter?: string
      gradeLevel?: number
      questionType?: string
    }
    if (!teacherId || !subject || !topic || difficulty === undefined || !question || !answer) {
      response.status(400).json({ error: 'teacherId, subject, topic, difficulty, question and answer required' })
      return
    }
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      response.status(400).json({ error: 'difficulty must be integer 1-5' })
      return
    }

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } }) as UserRecord | null
    if (!teacher || teacher.role !== 'teacher') {
      response.status(403).json({ error: 'only teacher can upload questions' })
      return
    }

    const hash = hashQuestion(question)
    // upsert by hash：已存在则跳过
    const existing = await bankModel.findUnique({ where: { hash } }) as QuestionBankRecord | null
    if (existing) {
      response.status(200).json({ questionId: existing.id, skipped: true, hash })
      return
    }

    const record = await bankModel.create({
      data: {
        teacherId,
        subject,
        topic,
        difficulty,
        question,
        answer,
        options: options ?? null,
        source: 'manual',
        chapter: chapter ?? null,
        gradeLevel: gradeLevel ?? null,
        questionType: questionType ?? 'single',
        hash
      }
    }) as QuestionBankRecord

    response.status(201).json({ questionId: record.id, hash })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'upload question failed' })
  }
})

// 2. GET /list - 查题库（增强：分页 + source/gradeLevel/chapter 筛选）
router.get('/list', async (request, response) => {
  try {
    if (!bankModel) {
      response.status(500).json({ error: 'questionBank model unavailable' })
      return
    }
    const subject = request.query.subject ? String(request.query.subject).trim() : ''
    const topic = request.query.topic ? String(request.query.topic).trim() : ''
    const source = request.query.source ? String(request.query.source).trim() : ''
    const chapter = request.query.chapter ? String(request.query.chapter).trim() : ''
    const gradeLevelRaw = request.query.gradeLevel ? Number(request.query.gradeLevel) : NaN
    const page = Math.max(1, Number(request.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize) || 20))

    const where: Record<string, unknown> = {}
    if (subject) where.subject = subject
    if (topic) where.topic = topic
    if (source) where.source = source
    if (chapter) where.chapter = chapter
    if (!Number.isNaN(gradeLevelRaw)) where.gradeLevel = gradeLevelRaw

    const total = await bankModel.count({ where })
    const records = await bankModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }) as QuestionBankRecord[]

    response.json({
      page,
      pageSize,
      total,
      questions: records.map((q) => ({
        id: q.id,
        teacherId: q.teacherId,
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        question: q.question,
        answer: q.answer,
        options: q.options,
        source: q.source,
        sourceRef: q.sourceRef,
        chapter: q.chapter,
        gradeLevel: q.gradeLevel,
        questionType: q.questionType,
        parsedAt: q.parsedAt,
        hash: q.hash,
        createdAt: q.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list questions failed' })
  }
})

// 3. POST /ingest-plan - 教案拆题入库（读 LessonPlan.content 调混元拆题）
router.post('/ingest-plan', async (request, response) => {
  try {
    if (!bankModel || !planModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const { planId } = request.body as { planId?: string }
    if (!planId) {
      response.status(400).json({ error: 'planId required' })
      return
    }

    const plan = await planModel.findUnique({ where: { id: planId } }) as LessonPlanRecord | null
    if (!plan) {
      response.status(404).json({ error: 'lesson plan not found' })
      return
    }
    if (!plan.content || plan.content.trim().length === 0) {
      response.status(400).json({ error: 'lesson plan content is empty' })
      return
    }

    const apiKey = process.env.HUNYUAN_API_KEY
    if (!apiKey) {
      response.status(500).json({ error: 'AI 未配置（HUNYUAN_API_KEY 未注入）' })
      return
    }

    const prompt = [
      '你是题库生成器。把下面的教案正文按章节/知识点拆成多道题目，输出 JSON：',
      '{ "questions": [ { "question":"", "options":["A. 选项1","B. 选项2","C. 选项3","D. 选项4"], "answer":"A", "explanation":"", "chapter":"", "topic":"", "difficulty":3, "questionType":"single" } ] }',
      '选择题 options 必须带字母前缀（如 "A. 内容"），answer 只填字母（如 "A"）；填空题 questionType="fill"，options=[]；简答题 questionType="essay"，options=[]。',
      'difficulty 为 1~5 的整数。每题必须带 chapter 或 topic（章节/知识点）。',
      '---教案正文---',
      plan.content
    ].join('\n')

    const list = await callHunyuanForQuestions(prompt)
    const result = await ingestQuestions(list, {
      teacherId: plan.authorId,
      subject: plan.subject || '综合',
      source: 'plan',
      sourceRef: planId
    })

    response.status(201).json({ planId, ...result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'ingest plan failed'
    response.status(500).json({ error: msg })
  }
})

// 4. POST /ingest-text - 文本拆题入库（粘贴正文 → AI 拆题 → 入库）
router.post('/ingest-text', async (request, response) => {
  try {
    if (!bankModel) {
      response.status(500).json({ error: 'questionBank model unavailable' })
      return
    }
    const { text, subject, gradeLevel, chapter, teacherId } = request.body as {
      text?: string
      subject?: string
      gradeLevel?: number
      chapter?: string
      teacherId?: string
    }
    if (!text || !subject) {
      response.status(400).json({ error: 'text and subject required' })
      return
    }
    if (!teacherId) {
      response.status(400).json({ error: 'teacherId required' })
      return
    }

    // 校验 teacher
    const teacher = await prisma.user.findUnique({ where: { id: teacherId } }) as UserRecord | null
    if (!teacher || teacher.role !== 'teacher') {
      response.status(403).json({ error: 'only teacher can ingest questions' })
      return
    }

    const apiKey = process.env.HUNYUAN_API_KEY
    if (!apiKey) {
      response.status(500).json({ error: 'AI 未配置（HUNYUAN_API_KEY 未注入）' })
      return
    }

    const prompt = [
      '你是题库生成器。把下面的文本按章节/知识点拆成多道题目，输出 JSON：',
      '{ "questions": [ { "question":"", "options":["A. 选项1","B. 选项2","C. 选项3","D. 选项4"], "answer":"A", "explanation":"", "chapter":"", "topic":"", "difficulty":3, "questionType":"single" } ] }',
      '选择题 options 必须带字母前缀（如 "A. 内容"），answer 只填字母（如 "A"）；填空题 questionType="fill"，options=[]；简答题 questionType="essay"，options=[]。',
      'difficulty 为 1~5 的整数。每题必须带 chapter 或 topic（章节/知识点）。',
      '---文本正文---',
      text
    ].join('\n')

    const list = await callHunyuanForQuestions(prompt)
    const result = await ingestQuestions(list, {
      teacherId,
      subject,
      source: 'doc',
      chapter,
      gradeLevel
    })

    response.status(201).json({ ...result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'ingest text failed'
    response.status(500).json({ error: msg })
  }
})

export default router
