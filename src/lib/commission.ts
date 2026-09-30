import prisma from './prisma.js'

type WalletRecord = {
  userId: string
  balance: number
  totalEarned: number
}

type UserRoleRecord = {
  id: string
  role: string
}

export const PARENT_SIGNUP_BONUS = 500

export async function ensureCommissionWallet(userId: string): Promise<{
  wallet: WalletRecord
  created: boolean
  bonusGranted: number
}> {
  const walletModel = prisma.commissionWallet
  const txnModel = prisma.commissionTxn
  if (!walletModel || !txnModel) {
    throw new Error('COMMISSION_UNAVAILABLE')
  }

  const existing = await walletModel.findUnique({ where: { userId } }) as WalletRecord | null
  if (existing) {
    return { wallet: existing, created: false, bonusGranted: 0 }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } }) as UserRoleRecord | null
  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  const initialBalance = user.role === 'parent' ? PARENT_SIGNUP_BONUS : 0

  await prisma.$transaction([
    walletModel.create({
      data: {
        userId,
        balance: initialBalance,
        totalEarned: initialBalance
      }
    }),
    ...(initialBalance > 0
      ? [
          txnModel.create({
            data: {
              userId,
              fromUserId: 'system',
              amount: initialBalance,
              type: 'parent_signup_bonus',
              month: null
            }
          })
        ]
      : [])
  ])

  return {
    wallet: {
      userId,
      balance: initialBalance,
      totalEarned: initialBalance
    },
    created: true,
    bonusGranted: initialBalance
  }
}

export async function topUpCommissionWallet(userId: string, amount: number): Promise<WalletRecord> {
  const walletModel = prisma.commissionWallet
  const txnModel = prisma.commissionTxn
  if (!walletModel || !txnModel) {
    throw new Error('COMMISSION_UNAVAILABLE')
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('INVALID_TOPUP_AMOUNT')
  }

  await ensureCommissionWallet(userId)

  await prisma.$transaction([
    walletModel.update({
      where: { userId },
      data: {
        balance: { increment: amount },
        totalEarned: { increment: amount }
      }
    }),
    txnModel.create({
      data: {
        userId,
        fromUserId: 'system',
        amount,
        type: 'manual_topup',
        month: null
      }
    })
  ])

  const nextWallet = await walletModel.findUnique({ where: { userId } }) as WalletRecord | null
  if (!nextWallet) {
    throw new Error('WALLET_NOT_FOUND_AFTER_TOPUP')
  }
  return nextWallet
}

export async function awardCommission(
  fromUserId: string,
  type: 'first_pay' | 'monthly_renewal'
): Promise<void> {
  const fromUser = await prisma.user.findUnique({ where: { id: fromUserId } }) as {
    id: string
    invitedBy?: string | null
  } | null

  if (!fromUser?.invitedBy) {
    return
  }

  const inviter = await prisma.user.findUnique({ where: { id: fromUser.invitedBy } }) as {
    id: string
    role: string
  } | null

  if (!inviter) {
    return
  }

  if (type === 'first_pay') {
    if (!['parent', 'teacher'].includes(inviter.role)) {
      return
    }
  } else if (inviter.role !== 'teacher') {
    return
  }

  const currentMonth = new Date().toISOString().slice(0, 7)
  const commissionTxnModel = prisma.commissionTxn
  const commissionWalletModel = prisma.commissionWallet

  if (!commissionTxnModel || !commissionWalletModel) {
    return
  }

  if (type === 'first_pay') {
    const existing = await commissionTxnModel.findFirst({
      where: { fromUserId, type: 'first_pay' }
    })

    if (existing) {
      return
    }
  } else {
    const existing = await commissionTxnModel.findFirst({
      where: { fromUserId, type: 'monthly_renewal', month: currentMonth }
    })

    if (existing) {
      return
    }
  }

  const amount = type === 'first_pay' ? 500 : 100

  await prisma.$transaction([
    commissionWalletModel.upsert({
      where: { userId: inviter.id },
      create: { userId: inviter.id, balance: amount, totalEarned: amount },
      update: {
        balance: { increment: amount },
        totalEarned: { increment: amount }
      }
    }),
    commissionTxnModel.create({
      data: {
        userId: inviter.id,
        fromUserId,
        amount,
        type,
        month: type === 'monthly_renewal' ? currentMonth : null
      }
    })
  ])
}
