import prisma from './prisma.js'

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
