import { Router } from 'express'
import { checkAndConsumeQuota } from '../lib/quota-guard.js'
import { analyzeImage } from '../lib/vision.js'
import { chat } from '../lib/text-brain.js'

const router = Router()

router.post('/diagnose', async (request, response) => {
  try {
    const { userId, imageBase64 } = request.body as { userId?: string; imageBase64?: string }

    if (!imageBase64) {
      response.status(400).json({ error: 'imageBase64 required' })
      return
    }

    const guard = await checkAndConsumeQuota(userId || 'anonymous', 'image', 1)

    if (!guard.allowed) {
      response.status(402).json({ error: guard.reason, fallback: guard.fallback })
      return
    }

    const imageDataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
    const visionResult = await analyzeImage(imageDataUrl, '识别作业错题并逐题归因，输出JSON格式：{weakPoints: [{subject, topic, reason}]}')
    const structured = await chat([{ role: 'user', content: `整理为JSON: ${visionResult}` }], true)
    const weakPoints = typeof structured === 'object' && structured && 'weakPoints' in structured
      ? (structured as { weakPoints?: unknown[] }).weakPoints ?? []
      : []
    response.json({ sessionId: Date.now().toString(), weakPoints })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Photo diagnose failed' })
  }
})

export default router
