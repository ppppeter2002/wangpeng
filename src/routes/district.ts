import { Router } from 'express'
import prisma from '../lib/prisma.js'

export const SCORE_SALE = 2
export const SCORE_INTERACT = 1

type UserRecord = {
  id: string
  role: string
  name: string | null
}

type DistrictRecord = {
  id: string
  name: string
  city: string
}

type DistrictSpaceRecord = {
  id: string
  districtId: string
  creatorId: string
  name: string
  description: string | null
  status: string
  memberCount: number
}

type DistrictSpaceMemberRecord = {
  id: string
  spaceId: string
  userId: string
  role: string
  joinedAt: Date
}

type MemberWithRelations = DistrictSpaceMemberRecord & {
  user?: { id: string; name: string | null; role: string }
}

type LessonPlanRecord = {
  id: string
  authorId: string
  classId: string
  subject: string
  title: string
  content: string
  version: number
  status: string
  updatedAt: Date
}

type LessonPlanWithAuthor = LessonPlanRecord & {
  author?: { id: string; name: string | null }
}

type MarketRecord = {
  id: string
  lessonPlanId: string
  sellerId: string
  price: number
  status: string
  soldCount: number
}

type PurchaseRecord = {
  id: string
  marketId: string
  buyerId: string
  price: number
}

type InteractionRecord = {
  id: string
  lessonPlanId: string
  userId: string
  type: string
  content: string
  resolved: boolean
}

type HotRecommendationRecord = {
  id: string
  spaceId: string | null
  targetType: string
  targetId: string
  score: number
  saleCount: number
  interactCount: number
  rank: number | null
  category: string | null
}

const districtModel = prisma.district
const spaceModel = prisma.districtSpace
const memberModel = prisma.districtSpaceMember
const hotModel = prisma.hotRecommendation
const lessonPlanModel = prisma.lessonPlan
const interactionModel = prisma.lessonPlanInteraction
const purchaseModel = prisma.lessonPlanPurchase
const marketModel = prisma.lessonPlanMarket

const router = Router()

// 1. POST /create
router.post('/create', async (request, response) => {
  try {
    if (!districtModel) {
      response.status(500).json({ error: 'district model unavailable' })
      return
    }
    const { name, city } = request.body as { name?: string; city?: string }
    if (!name || !city) {
      response.status(400).json({ error: 'name and city required' })
      return
    }
    const existing = await districtModel.findUnique({ where: { name } }) as DistrictRecord | null
    if (existing) {
      response.status(409).json({ error: 'district name already exists', districtId: existing.id })
      return
    }
    const district = await districtModel.create({
      data: { name, city }
    }) as DistrictRecord
    response.status(201).json({ districtId: district.id, name: district.name, city: district.city })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'create district failed' })
  }
})

// 2. GET /list
router.get('/list', async (request, response) => {
  try {
    if (!districtModel) {
      response.status(500).json({ error: 'district model unavailable' })
      return
    }
    const city = request.query.city ? String(request.query.city).trim() : undefined
    const where = city ? { city } : {}
    const districts = await districtModel.findMany({ where, orderBy: { createdAt: 'desc' } }) as DistrictRecord[]
    response.json({
      districts: districts.map((d) => ({
        districtId: d.id,
        name: d.name,
        city: d.city
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list districts failed' })
  }
})

// 3. POST /space/create
router.post('/space/create', async (request, response) => {
  try {
    if (!spaceModel || !districtModel) {
      response.status(500).json({ error: 'space model unavailable' })
      return
    }
    const { districtId, creatorId, name, description } = request.body as {
      districtId?: string
      creatorId?: string
      name?: string
      description?: string
    }
    if (!districtId || !creatorId || !name) {
      response.status(400).json({ error: 'districtId, creatorId and name required' })
      return
    }
    const creator = await prisma.user.findUnique({ where: { id: creatorId } }) as UserRecord | null
    if (!creator || creator.role !== 'teacher') {
      response.status(403).json({ error: 'only teacher can create space' })
      return
    }
    const district = await districtModel.findUnique({ where: { id: districtId } }) as DistrictRecord | null
    if (!district) {
      response.status(404).json({ error: 'district not found' })
      return
    }
    const space = await spaceModel.create({
      data: {
        districtId,
        creatorId,
        name,
        description: description ?? null,
        status: 'pending',
        memberCount: 0
      }
    }) as DistrictSpaceRecord
    response.status(201).json({ spaceId: space.id, status: space.status })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'create space failed' })
  }
})

// 4. POST /space/approve
router.post('/space/approve', async (request, response) => {
  try {
    if (!spaceModel) {
      response.status(500).json({ error: 'space model unavailable' })
      return
    }
    const { spaceId, adminId } = request.body as { spaceId?: string; adminId?: string }
    if (!spaceId || !adminId) {
      response.status(400).json({ error: 'spaceId and adminId required' })
      return
    }
    const admin = await prisma.user.findUnique({ where: { id: adminId } }) as UserRecord | null
    if (!admin || admin.role !== 'admin') {
      response.status(403).json({ error: 'only admin can approve space' })
      return
    }
    const space = await spaceModel.findUnique({ where: { id: spaceId } }) as DistrictSpaceRecord | null
    if (!space) {
      response.status(404).json({ error: 'space not found' })
      return
    }
    if (space.status !== 'pending') {
      response.status(400).json({ error: `space status is ${space.status}, not pending` })
      return
    }
    await spaceModel.update({
      where: { id: spaceId },
      data: { status: 'approved' }
    })
    response.json({ success: true, spaceId, status: 'approved' })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'approve space failed' })
  }
})

// 5. POST /space/join
router.post('/space/join', async (request, response) => {
  try {
    if (!spaceModel || !memberModel) {
      response.status(500).json({ error: 'space model unavailable' })
      return
    }
    const { spaceId, userId } = request.body as { spaceId?: string; userId?: string }
    if (!spaceId || !userId) {
      response.status(400).json({ error: 'spaceId and userId required' })
      return
    }
    const user = await prisma.user.findUnique({ where: { id: userId } }) as UserRecord | null
    if (!user || (user.role !== 'teacher' && user.role !== 'parent')) {
      response.status(403).json({ error: 'only teacher or parent can join space' })
      return
    }
    const space = await spaceModel.findUnique({ where: { id: spaceId } }) as DistrictSpaceRecord | null
    if (!space) {
      response.status(404).json({ error: 'space not found' })
      return
    }
    if (space.status !== 'approved') {
      response.status(400).json({ error: `space status is ${space.status}, not approved` })
      return
    }
    const existing = await memberModel.findUnique({
      where: { spaceId_userId: { spaceId, userId } }
    }) as DistrictSpaceMemberRecord | null
    if (existing) {
      response.status(409).json({ error: 'already a member' })
      return
    }
    await memberModel.create({
      data: { spaceId, userId, role: 'member' }
    })
    await spaceModel.update({
      where: { id: spaceId },
      data: { memberCount: { increment: 1 } }
    })
    response.status(201).json({ success: true, spaceId, userId })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'join space failed' })
  }
})

// 6. GET /space/:spaceId/members
router.get('/space/:spaceId/members', async (request, response) => {
  try {
    if (!memberModel) {
      response.status(500).json({ error: 'member model unavailable' })
      return
    }
    const spaceId = request.params.spaceId.trim()
    const members = await memberModel.findMany({
      where: { spaceId },
      orderBy: { joinedAt: 'asc' },
      include: { user: true }
    }) as MemberWithRelations[]
    response.json({
      members: members.map((m) => ({
        memberId: m.id,
        userId: m.userId,
        name: m.user?.name ?? null,
        role: m.role,
        joinedAt: m.joinedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list members failed' })
  }
})

// 7. POST /space/hot-refresh
router.post('/space/hot-refresh', async (request, response) => {
  try {
    if (!hotModel || !lessonPlanModel || !interactionModel || !purchaseModel || !marketModel || !memberModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const { spaceId } = request.body as { spaceId?: string | null }
    const targetSpaceId = spaceId ?? null

    // 查所有 published 教案
    const lessonPlans = await lessonPlanModel.findMany({
      where: { status: 'published' }
    }) as LessonPlanRecord[]

    // 如果指定空间，查该空间所有成员 userId
    let memberUserIds: string[] | null = null
    if (targetSpaceId !== null) {
      const members = await memberModel.findMany({
        where: { spaceId: targetSpaceId }
      }) as DistrictSpaceMemberRecord[]
      memberUserIds = members.map((m) => m.userId)
    }

    type ScoreItem = {
      lessonPlanId: string
      title: string
      subject: string
      authorId: string
      saleCount: number
      interactCount: number
      score: number
      updatedAt: Date
    }

    const items: ScoreItem[] = []

    for (const lp of lessonPlans) {
      // 销量：通过 market 关联查 LessonPlanPurchase
      const market = await marketModel.findUnique({ where: { lessonPlanId: lp.id } }) as MarketRecord | null
      let saleCount = 0
      if (market) {
        if (memberUserIds !== null) {
          if (memberUserIds.length > 0) {
            const purchases = await purchaseModel.findMany({
              where: { marketId: market.id, buyerId: { in: memberUserIds } }
            }) as PurchaseRecord[]
            saleCount = purchases.length
          }
        } else {
          const purchases = await purchaseModel.findMany({
            where: { marketId: market.id }
          }) as PurchaseRecord[]
          saleCount = purchases.length
        }
      }

      // 互动数
      const interactions = await interactionModel.findMany({
        where: { lessonPlanId: lp.id }
      }) as InteractionRecord[]
      const interactCount = interactions.length

      const score = saleCount * SCORE_SALE + interactCount * SCORE_INTERACT

      items.push({
        lessonPlanId: lp.id,
        title: lp.title,
        subject: lp.subject,
        authorId: lp.authorId,
        saleCount,
        interactCount,
        score,
        updatedAt: lp.updatedAt
      })
    }

    // 按 score 降序（法则1），相同按 updatedAt 降序（法则2，破平局）
    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })

    // 删除旧的 HotRecommendation（同 spaceId + targetType）
    await hotModel.deleteMany({
      where: { spaceId: targetSpaceId, targetType: 'lesson_plan' }
    })

    // 写入新的（rank = 排序位次）
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      await hotModel.create({
        data: {
          spaceId: targetSpaceId,
          targetType: 'lesson_plan',
          targetId: item.lessonPlanId,
          score: item.score,
          saleCount: item.saleCount,
          interactCount: item.interactCount,
          rank: i + 1,
          category: item.subject
        }
      })
    }

    response.json({ updated: items.length })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'hot refresh failed' })
  }
})

// 8. GET /space/hot
router.get('/space/hot', async (request, response) => {
  try {
    if (!hotModel || !lessonPlanModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const spaceIdRaw = request.query.spaceId
    let spaceId: string | null = null
    if (spaceIdRaw !== undefined) {
      const trimmed = String(spaceIdRaw).trim()
      if (trimmed !== '' && trimmed.toLowerCase() !== 'null') {
        spaceId = trimmed
      }
    }
    const targetType = request.query.targetType ? String(request.query.targetType).trim() : 'lesson_plan'
    const limitParam = request.query.limit ? Number(request.query.limit) : 10
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : 10

    const hotList = await hotModel.findMany({
      where: { spaceId, targetType },
      orderBy: { rank: 'asc' }
    }) as HotRecommendationRecord[]

    const result = []
    for (const hot of hotList.slice(0, limit)) {
      const lp = await lessonPlanModel.findUnique({ where: { id: hot.targetId } }) as LessonPlanWithAuthor | null
      let authorName: string | null = null
      if (lp && lp.authorId) {
        const author = await prisma.user.findUnique({ where: { id: lp.authorId } }) as UserRecord | null
        authorName = author?.name ?? null
      }
      result.push({
        rank: hot.rank,
        lessonPlanId: hot.targetId,
        title: lp?.title ?? null,
        subject: lp?.subject ?? null,
        authorName,
        score: hot.score,
        saleCount: hot.saleCount,
        interactCount: hot.interactCount
      })
    }

    response.json({ items: result })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get hot list failed' })
  }
})

export default router
