import prisma from './prisma.js'

export type Feature = 'image' | 'voice' | 'tts'

export interface QuotaCheckResult {
  allowed: boolean
  reason?: string
  fallback?: string
}

type UserRecord = {
  id: string
  role: string
  parentId: string | null
}

type SubscriptionRecord = {
  userId: string
  planCode: string
  status: string
}

type PlanRecord = {
  code: string
  imageEnabled: boolean
  voiceEnabled: boolean
  ttsEnabled: boolean
  photoPerDay: number
  voiceMinPerDay: number
  ttsCharPerDay: number
}

type UsageQuotaRecord = {
  userId: string
  photoUsedToday: number
  voiceUsedToday: number
  ttsCharUsedToday: number
  quotaDate: Date
}

type CreditPackRecord = {
  id: string
  userId: string
  amount: number
  used: number
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function getFeatureFallback(feature: Feature) {
  if (feature === 'image') {
    return '可切换文本问答模式'
  }

  if (feature === 'voice') {
    return '可切换文字输入'
  }

  return '可阅读文字版报告'
}

function getFeatureCost(feature: Feature, amount: number) {
  if (feature === 'image') {
    return amount * 100
  }

  if (feature === 'voice') {
    return amount * 50
  }

  return amount
}

async function resolveQuotaUserId(userId: string): Promise<string | QuotaCheckResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } }) as UserRecord | null

  if (!user) {
    return userId
  }

  if (user.role !== 'student') {
    return user.id
  }

  if (!user.parentId) {
    return { allowed: false, reason: '学生未绑定家长' }
  }

  return user.parentId
}

export async function checkQuota(
  userId: string,
  feature: Feature
): Promise<QuotaCheckResult> {
  const resolvedUserId = await resolveQuotaUserId(userId)

  if (typeof resolvedUserId !== 'string') {
    return resolvedUserId
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: resolvedUserId }
  }) as SubscriptionRecord | null

  if (!subscription || subscription.status !== 'active') {
    return { allowed: false, reason: '无有效订阅', fallback: '请先订阅基础套餐' }
  }

  const plan = await prisma.plan.findUnique({
    where: { code: subscription.planCode }
  }) as PlanRecord | null

  if (!plan) {
    return { allowed: false, reason: '套餐不存在' }
  }

  if (feature === 'image' && !plan.imageEnabled) {
    return { allowed: false, reason: '当前套餐不支持拍照功能', fallback: '升级到标准或全能套餐' }
  }

  if (feature === 'voice' && !plan.voiceEnabled) {
    return { allowed: false, reason: '当前套餐不支持语音功能', fallback: '升级到全能套餐' }
  }

  if (feature === 'tts' && !plan.ttsEnabled) {
    return { allowed: false, reason: '当前套餐不支持语音播报', fallback: '升级到全能套餐' }
  }

  return { allowed: true }
}

export async function checkAndConsumeQuota(
  userId: string,
  feature: Feature,
  amount: number
): Promise<QuotaCheckResult> {
  const resolvedUserId = await resolveQuotaUserId(userId)

  if (typeof resolvedUserId !== 'string') {
    return resolvedUserId
  }

  const quotaCheck = await checkQuota(userId, feature)

  if (!quotaCheck.allowed) {
    return quotaCheck
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: resolvedUserId }
  }) as SubscriptionRecord | null

  if (!subscription) {
    return { allowed: false, reason: '无有效订阅', fallback: '请先订阅基础套餐' }
  }

  const plan = await prisma.plan.findUnique({
    where: { code: subscription.planCode }
  }) as PlanRecord | null

  if (!plan) {
    return { allowed: false, reason: '套餐不存在' }
  }

  const today = startOfToday()
  let quota = await prisma.usageQuota.findUnique({
    where: { userId: resolvedUserId }
  }) as UsageQuotaRecord | null

  if (!quota || quota.quotaDate < today) {
    quota = await prisma.usageQuota.upsert({
      where: { userId: resolvedUserId },
      update: {
        photoUsedToday: 0,
        voiceUsedToday: 0,
        ttsCharUsedToday: 0,
        quotaDate: new Date()
      },
      create: {
        userId: resolvedUserId,
        photoUsedToday: 0,
        voiceUsedToday: 0,
        ttsCharUsedToday: 0,
        quotaDate: new Date()
      }
    }) as UsageQuotaRecord
  }

  let willExceed = false
  if (feature === 'image' && quota.photoUsedToday + amount > plan.photoPerDay) {
    willExceed = true
  }
  if (feature === 'voice' && quota.voiceUsedToday + amount > plan.voiceMinPerDay) {
    willExceed = true
  }
  if (feature === 'tts' && quota.ttsCharUsedToday + amount > plan.ttsCharPerDay) {
    willExceed = true
  }

  if (!willExceed) {
    if (feature === 'image') {
      await prisma.usageQuota.update({
        where: { userId: resolvedUserId },
        data: { photoUsedToday: { increment: amount } }
      })
    } else if (feature === 'voice') {
      await prisma.usageQuota.update({
        where: { userId: resolvedUserId },
        data: { voiceUsedToday: { increment: amount } }
      })
    } else {
      await prisma.usageQuota.update({
        where: { userId: resolvedUserId },
        data: { ttsCharUsedToday: { increment: amount } }
      })
    }

    return { allowed: true }
  }

  const creditPacks = await prisma.creditPack.findMany({
    where: { userId: resolvedUserId },
    orderBy: { purchasedAt: 'asc' }
  }) as CreditPackRecord[]
  const availablePacks = creditPacks.filter((creditPack) => creditPack.used < creditPack.amount)
  const totalRemaining = availablePacks.reduce((sum, creditPack) => sum + (creditPack.amount - creditPack.used), 0)
  const cost = getFeatureCost(feature, amount)

  if (totalRemaining >= cost) {
    let remaining = cost

    for (const creditPack of availablePacks) {
      const available = creditPack.amount - creditPack.used
      const deduct = Math.min(available, remaining)

      await prisma.creditPack.update({
        where: { id: creditPack.id },
        data: { used: { increment: deduct } }
      })

      remaining -= deduct
      if (remaining <= 0) {
        break
      }
    }

    return { allowed: true, reason: `使用算力包抵扣 ${cost} 分` }
  }

  return {
    allowed: false,
    reason: '今日配额已用完，算力包余额不足',
    fallback: getFeatureFallback(feature)
  }
}
