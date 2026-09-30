import { Router } from 'express'
import { ensureCommissionWallet, topUpCommissionWallet } from '../lib/commission.js'
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

    const ensured = await ensureCommissionWallet(userId)
    const txns = await txnModel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    response.json({
      userId,
      balance: ensured.wallet.balance,
      totalEarned: ensured.wallet.totalEarned,
      walletInitialized: ensured.created,
      signupBonusGranted: ensured.bonusGranted,
      txns
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch wallet failed' })
  }
})

router.post('/topup', async (request, response) => {
  try {
    const { userId, amount } = request.body as {
      userId?: string
      amount?: number
    }

    if (!userId || typeof amount !== 'number') {
      response.status(400).json({ error: 'userId and amount required' })
      return
    }

    const wallet = await topUpCommissionWallet(userId, amount)
    response.json({
      success: true,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Topup failed'
    if (msg === 'INVALID_TOPUP_AMOUNT') {
      response.status(400).json({ error: 'amount must be positive integer' })
      return
    }
    response.status(500).json({ error: msg })
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

    const ensured = await ensureCommissionWallet(userId)
    const wallet = ensured.wallet as WalletRecord

    if (wallet.balance < amount) {
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
