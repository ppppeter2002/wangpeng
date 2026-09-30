import { Router } from 'express'
import { generateQuestions } from '../lib/ai.js'

// 调试端点：手动验混元 AI 出题是否通（需配 HUNYUAN_API_KEY 环境变量）
const router = Router()

// POST /api/ai/generate - 直接调混元出题
router.post('/generate', async (request, response) => {
  try {
    const { subject, topic, difficulty, count, mode } = request.body as {
      subject?: string
      topic?: string
      difficulty?: number
      count?: number
      mode?: 'promotion' | 'pk-timed' | 'pk-buzz' | 'tutor'
    }
    if (!subject || !topic) {
      response.status(400).json({ error: 'subject and topic required' })
      return
    }

    const list = await generateQuestions({
      subject,
      topic,
      difficulty,
      count,
      mode
    })

    response.status(200).json({
      source: 'ai',
      count: list.length,
      questions: list
    })
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'generate failed',
      source: 'ai'
    })
  }
})

export default router
