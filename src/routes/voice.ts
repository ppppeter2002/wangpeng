import { Router } from 'express'
import { transcribe } from '../lib/asr.js'
import { checkAndConsumeQuota } from '../lib/quota-guard.js'
import { chat } from '../lib/text-brain.js'
import { synthesize } from '../lib/tts.js'

const router = Router()

router.post('/chat', async (request, response) => {
  try {
    const { audioBase64, userId } = request.body as { audioBase64?: string; userId?: string }

    if (!audioBase64) {
      response.status(400).json({ error: 'audioBase64 required' })
      return
    }

    const voiceGuard = await checkAndConsumeQuota(userId || 'anonymous', 'voice', 1)

    if (!voiceGuard.allowed) {
      response.status(402).json({ error: voiceGuard.reason, fallback: voiceGuard.fallback })
      return
    }

    const text = await transcribe(audioBase64)
    const reply = await chat([{ role: 'user', content: text }])
    const replyText = String(reply)
    const ttsGuard = await checkAndConsumeQuota(userId || 'anonymous', 'tts', replyText.length)

    if (!ttsGuard.allowed) {
      response.status(402).json({
        error: ttsGuard.reason,
        fallback: ttsGuard.fallback,
        text: replyText
      })
      return
    }

    const audio = await synthesize(replyText)
    response.json({ text: replyText, audioBase64: audio.toString('base64') })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Voice chat failed' })
  }
})

export default router
