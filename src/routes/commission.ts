import { Router } from 'express'
import prisma from '../lib/prisma.js'

type WalletRecord = {
  userId: string
  balance: number
  totalEarned: number
}

const walletModel = prisma.commissionWallet
const txnModel = prisma.commissionTxn
const spendModel = prisma.commissionSpend
const router = Router()

router.get('/wallet', async (request, response) => {
  try {
    const userId = String(request.query.userId ?? '').trim()

    if (!userId) {
      response.status(400).json({ error: 'userId required' })
      return
    }

    if (!walletModel || !txnModel) {
      response.status(500).json({ error: 'commission unavailable' })
      return
    }

    const wallet = await walletModel.findUnique({ where: { userId } }) as WalletRecord | null
    const txns = await txnModel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    response.json({
      userId,
      balance: wallet?.balance ?? 0,
      totalEarned: wallet?.totalEarned ?? 0,
      txns
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch wallet failed' })
  }
})

router.post('/spend', async (request, response) => {
  try {
    const { userId, amount, targetType, targetId } = request.body as {
      userId?: string
      amount?: number
      targetType?: string
      targetId?: string
    }

    if (!userId || typeof amount !== 'number' || !targetType || !targetId) {
      response.status(400).json({ error: 'userId, amount, targetType and targetId required' })
      return
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      response.status(400).json({ error: 'amount must be positive integer' })
      return
    }

    if (!walletModel || !spendModel) {
      response.status(500).json({ error: 'commission unavailable' })
      return
    }

    const wallet = await walletModel.findUnique({ where: { userId } }) as WalletRecord | null

    if (!wallet || wallet.balance < amount) {
      response.status(400).json({ error: '余额不足' })
      return
    }

    const nextBalance = wallet.balance - amount

    await prisma.$transaction([
      walletModel.update({
        where: { userId },
        data: { balance: nextBalance }
      }),
      spendModel.create({
        data: {
          userId,
          amount,
          targetType,
          targetId
        }
      })
    ])

    response.json({ success: true, remainingBalance: nextBalance })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Spend commission failed' })
  }
})

export default router
