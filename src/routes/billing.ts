import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { awardCommission } from '../lib/commission.js'
import { checkQuota } from '../lib/quota-guard.js'

const router = Router()

router.get('/plans', async (_request, response) => {
  try {
    const plans = await prisma.plan.findMany()
    response.json(plans)
  } catch (_error) {
    response.status(500).json({ error: 'Failed to fetch plans' })
  }
})

router.get('/subscription/:userId', async (request, response) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: request.params.userId }
    })

    if (!subscription) {
      response.status(404).json({ error: 'No subscription' })
      return
    }

    response.json(subscription)
  } catch (_error) {
    response.status(500).json({ error: 'Failed to fetch subscription' })
  }
})

router.post('/subscribe', async (request, response) => {
  try {
    const { userId, planCode } = request.body as { userId?: string; planCode?: string }

    if (!userId || !planCode) {
      response.status(400).json({ error: 'userId and planCode are required' })
      return
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode } })

    if (!plan) {
      response.status(400).json({ error: 'Invalid plan' })
      return
    }

    const previousCancelledSubscriptions = await prisma.subscription.findMany({
      where: { userId, status: 'cancelled' }
    })
    const hadCancelledSubscription = previousCancelledSubscriptions.length > 0
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    const subscription = await prisma.subscription.upsert({
      where: { userId },
      update: { planCode, status: 'active', expiresAt, autoRenew: false },
      create: { userId, planCode, expiresAt }
    })

    await awardCommission(userId, 'first_pay')

    if (hadCancelledSubscription) {
      await awardCommission(userId, 'monthly_renewal')
    }

    response.json(subscription)
  } catch (_error) {
    response.status(500).json({ error: 'Failed to subscribe' })
  }
})

router.post('/cancel', async (request, response) => {
  try {
    const { userId } = request.body as { userId?: string }

    if (!userId) {
      response.status(400).json({ error: 'userId is required' })
      return
    }

    const subscription = await prisma.subscription.update({
      where: { userId },
      data: { autoRenew: false, cancelledAt: new Date(), status: 'cancelled' }
    })

    response.json(subscription)
  } catch (_error) {
    response.status(500).json({ error: 'Failed to cancel' })
  }
})

router.post('/check-feature', async (request, response) => {
  try {
    const { userId, feature } = request.body as { userId?: string; feature?: string }

    if (!userId || !feature) {
      response.status(400).json({ error: 'userId and feature required' })
      return
    }

    const result = await checkQuota(userId, feature as 'image' | 'voice' | 'tts')
    response.json(result)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Check failed' })
  }
})

const MAX_CREDIT_AMOUNT = 1_000_000

router.post('/buy-credit', async (request, response) => {
  try {
    const { userId, amount } = request.body as { userId?: string; amount?: number }

    if (!userId) {
      response.status(400).json({ error: 'userId required' })
      return
    }

    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      response.status(400).json({ error: 'amount must be a positive integer' })
      return
    }

    if (amount > MAX_CREDIT_AMOUNT) {
      response.status(400).json({ error: `amount must not exceed ${MAX_CREDIT_AMOUNT}` })
      return
    }

    const creditPack = await prisma.creditPack.create({
      data: { userId, amount, used: 0 }
    })

    response.json({
      success: true,
      creditPackId: creditPack.id,
      remaining: creditPack.amount - creditPack.used
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Buy credit failed' })
  }
})

export default router
