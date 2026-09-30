import express, { Router } from 'express'
import { createNotification } from '../lib/notification.js'
import prisma from '../lib/prisma.js'
import { getWechatServiceStatus, verifyWechatServiceSignature } from '../lib/wechat-official.js'

export const NOTIFICATION_TYPES = {
  COMMISSION_EARN: 'commission_earn',
  COMMISSION_SPEND: 'commission_spend',
  LESSON_PLAN_SOLD: 'lesson_plan_sold',
  LESSON_PLAN_COMMENT: 'lesson_plan_comment',
  LESSON_PLAN_APPROVE: 'lesson_plan_approve',
  CLASS_INVITE: 'class_invite',
  SEASON_RANK: 'season_rank',
  ASSIGNMENT_GRADED: 'assignment_graded',
  REWARD_WINNER: 'reward_winner',
  REWARD_CLAIMED: 'reward_claimed',
  PROMOTION_PASSED: 'promotion_passed',
  PROMOTION_FAILED: 'promotion_failed',
  PK_SCORE_GAIN: 'pk_score_gain',
  PK_SCORE_LOSE: 'pk_score_lose',
  PK_RESULT: 'pk_result'
} as const

type UserRecord = {
  id: string
  role: string
  name: string | null
}

type NotificationRecord = {
  id: string
  userId: string
  type: string
  title: string
  content: string
  payload: string | null
  read: boolean
  channel: string
  deliveryStatus: string
  deliveryError: string | null
  externalMessageId: string | null
  deliveredAt: Date | null
  createdAt: Date
}

const notificationModel = prisma.notification

const router = Router()

// 1. POST /send
router.post('/send', async (request, response) => {
  try {
    if (!notificationModel) {
      response.status(500).json({ error: 'notification model unavailable' })
      return
    }
    const { userId, type, title, content, payload } = request.body as {
      userId?: string
      type?: string
      title?: string
      content?: string
      payload?: string
    }
    if (!userId || !type || !title || !content) {
      response.status(400).json({ error: 'userId, type, title and content required' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId } }) as UserRecord | null
    if (!user) {
      response.status(404).json({ error: 'user not found' })
      return
    }

    const parsedPayload = payload
      ? (() => {
          try {
            return JSON.parse(payload) as Record<string, unknown>
          } catch {
            return payload
          }
        })()
      : null

    const record = await createNotification({
      userId,
      type,
      title,
      content,
      payload: parsedPayload,
      channel: 'wechat'
    }) as NotificationRecord

    response.status(201).json({
      notificationId: record.id,
      deliveryStatus: record.deliveryStatus,
      deliveryError: record.deliveryError,
      externalMessageId: record.externalMessageId
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'send notification failed' })
  }
})

router.get('/wechat/config-status', (_request, response) => {
  response.json(getWechatServiceStatus())
})

router.get('/wechat/callback', (request, response) => {
  const signature = String(request.query.signature ?? '')
  const timestamp = String(request.query.timestamp ?? '')
  const nonce = String(request.query.nonce ?? '')
  const echostr = String(request.query.echostr ?? '')

  if (!signature || !timestamp || !nonce || !echostr) {
    response.status(400).json({ error: 'signature, timestamp, nonce and echostr required' })
    return
  }

  if (!getWechatServiceStatus().readyForCallbackVerify) {
    response.status(503).json({ error: 'wechat service token not configured' })
    return
  }

  if (!verifyWechatServiceSignature(signature, timestamp, nonce)) {
    response.status(403).json({ error: 'invalid wechat signature' })
    return
  }

  response.type('text/plain').send(echostr)
})

router.post('/wechat/callback', express.text({ type: ['text/xml', 'application/xml', 'text/plain'] }), (request, response) => {
  const signature = String(request.query.signature ?? '')
  const timestamp = String(request.query.timestamp ?? '')
  const nonce = String(request.query.nonce ?? '')

  if (!signature || !timestamp || !nonce) {
    response.status(400).json({ error: 'signature, timestamp and nonce required' })
    return
  }

  if (!getWechatServiceStatus().readyForCallbackVerify) {
    response.status(503).json({ error: 'wechat service token not configured' })
    return
  }

  if (!verifyWechatServiceSignature(signature, timestamp, nonce)) {
    response.status(403).json({ error: 'invalid wechat signature' })
    return
  }

  const body = typeof request.body === 'string' ? request.body : ''
  console.log(`[wechat-service-callback] body=${body}`)
  response.type('text/plain').send('success')
})

// 2. GET /list
router.get('/list', async (request, response) => {
  try {
    if (!notificationModel) {
      response.status(500).json({ error: 'notification model unavailable' })
      return
    }
    const userId = request.query.userId ? String(request.query.userId).trim() : ''
    if (!userId) {
      response.status(400).json({ error: 'userId required' })
      return
    }
    const unreadOnly = request.query.unreadOnly === 'true'
    const limitParam = request.query.limit ? Number(request.query.limit) : 20
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : 20

    const where = unreadOnly ? { userId, read: false } : { userId }
    const records = await notificationModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    }) as NotificationRecord[]

    response.json({
      notifications: records.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        payload: n.payload,
        read: n.read,
        channel: n.channel,
        deliveryStatus: n.deliveryStatus,
        deliveryError: n.deliveryError,
        externalMessageId: n.externalMessageId,
        deliveredAt: n.deliveredAt,
        createdAt: n.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list notifications failed' })
  }
})

// 3. POST /read
router.post('/read', async (request, response) => {
  try {
    if (!notificationModel) {
      response.status(500).json({ error: 'notification model unavailable' })
      return
    }
    const { notificationId, userId } = request.body as { notificationId?: string; userId?: string }
    if (!notificationId || !userId) {
      response.status(400).json({ error: 'notificationId and userId required' })
      return
    }

    const existing = await notificationModel.findUnique({ where: { id: notificationId } }) as NotificationRecord | null
    if (!existing) {
      response.status(404).json({ error: 'notification not found' })
      return
    }
    if (existing.userId !== userId) {
      response.status(403).json({ error: 'cannot read notification of other user' })
      return
    }

    await notificationModel.update({
      where: { id: notificationId },
      data: { read: true }
    })

    response.json({ success: true })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'mark read failed' })
  }
})

// 4. POST /read-all
router.post('/read-all', async (request, response) => {
  try {
    if (!notificationModel) {
      response.status(500).json({ error: 'notification model unavailable' })
      return
    }
    const { userId } = request.body as { userId?: string }
    if (!userId) {
      response.status(400).json({ error: 'userId required' })
      return
    }

    const result = await notificationModel.updateMany({
      where: { userId, read: false },
      data: { read: true }
    }) as { count: number }

    response.json({ updated: result.count })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'mark all read failed' })
  }
})

// 5. GET /unread-count
router.get('/unread-count', async (request, response) => {
  try {
    if (!notificationModel) {
      response.status(500).json({ error: 'notification model unavailable' })
      return
    }
    const userId = request.query.userId ? String(request.query.userId).trim() : ''
    if (!userId) {
      response.status(400).json({ error: 'userId required' })
      return
    }

    const count = await notificationModel.count({
      where: { userId, read: false }
    })

    response.json({ unreadCount: count })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get unread count failed' })
  }
})

export default router
