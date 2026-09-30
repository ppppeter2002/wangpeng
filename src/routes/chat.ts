import { Router } from 'express'
import { chat } from '../lib/text-brain.js'
import { chatDialogue, type ChatMessage } from '../lib/ai.js'

const router = Router()

// 兜底话术：无 HUNYUAN_API_KEY 或调用失败时给学生的固定回复
const FALLBACK_REPLIES = [
  '老师这里暂时没连上 AI，不过你可以先把题目里的已知条件列出来，看看哪些是已知的、哪些是要求的，再想想用哪个公式～',
  'AI 辅导暂时不可用，建议你先翻一下课本对应章节，把基础概念过一遍，等下再问老师也行～',
  '暂时连不上 AI，你可以试着把题目拆成几步：读懂题→画图→列式→计算，先自己走一遍。',
]

router.post('/', async (request, response) => {
  try {
    const { message } = request.body as { message?: string }
    if (!message) {
      response.status(400).json({ error: 'message required' })
      return
    }
    const reply = await chat([{ role: 'user', content: message }])
    response.json({ reply })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Chat failed' })
  }
})

// POST /api/chat/dialogue - 多轮辅导对话
// body: { studentId, message, history? }
// history: [{role:'user'|'assistant', content}]
// 有 HUNYUAN_API_KEY 走 AI，无 Key 或失败返回固定兜底话术
router.post('/dialogue', async (request, response) => {
  try {
    const { studentId, message, history } = request.body as {
      studentId?: string
      message?: string
      history?: ChatMessage[]
    }
    if (!message) {
      response.status(400).json({ error: 'message required' })
      return
    }
    if (!studentId) {
      response.status(400).json({ error: 'studentId required' })
      return
    }

    // 校验 history 格式
    let safeHistory: ChatMessage[] = []
    if (Array.isArray(history)) {
      safeHistory = history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12)
    }

    let reply: string
    let source: 'ai' | 'fallback'
    try {
      reply = await chatDialogue({ message, history: safeHistory })
      source = 'ai'
    } catch (aiErr) {
      const reason = aiErr instanceof Error ? aiErr.message : 'unknown'
      console.log(`[chat-fallback] student=${studentId} reason=${reason}, use fallback reply`)
      reply = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]
      source = 'fallback'
    }

    response.json({ reply, source })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'dialogue failed' })
  }
})

export default router
