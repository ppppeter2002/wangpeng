import { Router } from 'express'
import prisma from '../lib/prisma.js'

const PLATFORM_SHARE = 0

type UserRecord = {
  id: string
  role: string
  name: string | null
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
}

type MarketRecord = {
  id: string
  lessonPlanId: string
  sellerId: string
  price: number
  status: string
  soldCount: number
  createdAt: Date
  updatedAt: Date
}

type MarketWithRelations = MarketRecord & {
  lessonPlan?: { id: string; title: string; subject: string }
  seller?: { id: string; name: string | null }
}

type PurchaseRecord = {
  id: string
  marketId: string
  buyerId: string
  price: number
  createdAt: Date
}

type PurchaseWithRelations = PurchaseRecord & {
  market?: {
    id: string
    lessonPlanId: string
    price: number
    lessonPlan?: { id: string; title: string; subject: string }
  }
}

type WalletRecord = {
  userId: string
  balance: number
  totalEarned: number
}

const marketModel = prisma.lessonPlanMarket
const purchaseModel = prisma.lessonPlanPurchase
const walletModel = prisma.commissionWallet
const txnModel = prisma.commissionTxn
const spendModel = prisma.commissionSpend
const lessonPlanModel = prisma.lessonPlan

const router = Router()

router.post('/list', async (request, response) => {
  try {
    if (!marketModel || !lessonPlanModel) {
      response.status(500).json({ error: 'market model unavailable' })
      return
    }

    const { lessonPlanId, sellerId, price } = request.body as {
      lessonPlanId?: string
      sellerId?: string
      price?: number
    }

    if (!lessonPlanId || !sellerId || typeof price !== 'number') {
      response.status(400).json({ error: 'lessonPlanId, sellerId and price required' })
      return
    }

    if (!Number.isInteger(price) || price <= 0) {
      response.status(400).json({ error: 'price must be positive integer' })
      return
    }

    const seller = await prisma.user.findUnique({ where: { id: sellerId } }) as UserRecord | null
    if (!seller || seller.role !== 'teacher') {
      response.status(403).json({ error: 'only teacher can list lesson plan' })
      return
    }

    const lessonPlan = await lessonPlanModel.findUnique({ where: { id: lessonPlanId } }) as LessonPlanRecord | null
    if (!lessonPlan) {
      response.status(404).json({ error: 'lesson plan not found' })
      return
    }

    if (lessonPlan.authorId !== sellerId) {
      response.status(403).json({ error: 'only author can list this lesson plan' })
      return
    }

    if (lessonPlan.status !== 'published') {
      response.status(400).json({ error: `cannot list lesson plan with status ${lessonPlan.status}` })
      return
    }

    const existing = await marketModel.findUnique({ where: { lessonPlanId } }) as MarketRecord | null
    if (existing) {
      response.status(409).json({
        error: 'lesson plan already listed',
        marketId: existing.id,
        status: existing.status
      })
      return
    }

    const market = await marketModel.create({
      data: {
        lessonPlanId,
        sellerId,
        price,
        status: 'on_sale',
        soldCount: 0
      }
    }) as MarketRecord

    response.status(201).json({
      marketId: market.id,
      price: market.price,
      status: market.status
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'List lesson plan failed' })
  }
})

router.post('/delist', async (request, response) => {
  try {
    if (!marketModel) {
      response.status(500).json({ error: 'market model unavailable' })
      return
    }

    const { marketId, sellerId } = request.body as { marketId?: string; sellerId?: string }

    if (!marketId || !sellerId) {
      response.status(400).json({ error: 'marketId and sellerId required' })
      return
    }

    const seller = await prisma.user.findUnique({ where: { id: sellerId } }) as UserRecord | null
    if (!seller || seller.role !== 'teacher') {
      response.status(403).json({ error: 'only teacher can delist' })
      return
    }

    const market = await marketModel.findUnique({ where: { id: marketId } }) as MarketRecord | null
    if (!market) {
      response.status(404).json({ error: 'market entry not found' })
      return
    }

    if (market.sellerId !== sellerId) {
      response.status(403).json({ error: 'only seller can delist' })
      return
    }

    await marketModel.update({
      where: { id: marketId },
      data: { status: 'off_shelf' }
    })

    response.json({ success: true })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Delist failed' })
  }
})

router.get('/listings', async (request, response) => {
  try {
    if (!marketModel) {
      response.status(500).json({ error: 'market model unavailable' })
      return
    }

    const sellerId = request.query.sellerId ? String(request.query.sellerId).trim() : undefined
    const where = sellerId ? { sellerId, status: 'on_sale' } : { status: 'on_sale' }

    const listings = await marketModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { lessonPlan: true, seller: true }
    }) as MarketWithRelations[]

    response.json({
      listings: listings.map((entry) => ({
        marketId: entry.id,
        lessonPlanId: entry.lessonPlanId,
        title: entry.lessonPlan?.title ?? null,
        subject: entry.lessonPlan?.subject ?? null,
        sellerId: entry.sellerId,
        sellerName: entry.seller?.name ?? null,
        price: entry.price,
        status: entry.status,
        soldCount: entry.soldCount,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch listings failed' })
  }
})

router.post('/buy', async (request, response) => {
  try {
    if (!marketModel || !purchaseModel || !walletModel || !txnModel || !spendModel) {
      response.status(500).json({ error: 'market model unavailable' })
      return
    }

    const { marketId, buyerId } = request.body as { marketId?: string; buyerId?: string }

    if (!marketId || !buyerId) {
      response.status(400).json({ error: 'marketId and buyerId required' })
      return
    }

    const buyer = await prisma.user.findUnique({ where: { id: buyerId } }) as UserRecord | null
    if (!buyer || !['teacher', 'parent'].includes(buyer.role)) {
      response.status(403).json({ error: 'only teacher or parent can buy' })
      return
    }

    const market = await marketModel.findUnique({ where: { id: marketId } }) as MarketRecord | null
    if (!market) {
      response.status(404).json({ error: 'market entry not found' })
      return
    }

    if (market.status !== 'on_sale') {
      response.status(400).json({ error: `market entry is ${market.status}` })
      return
    }

    if (market.sellerId === buyerId) {
      response.status(400).json({ error: 'cannot buy your own lesson plan' })
      return
    }

    const existingPurchase = await purchaseModel.findUnique({
      where: { marketId_buyerId: { marketId, buyerId } }
    }) as PurchaseRecord | null
    if (existingPurchase) {
      response.status(409).json({ error: 'already purchased' })
      return
    }

    const buyerWallet = await walletModel.findUnique({ where: { userId: buyerId } }) as WalletRecord | null
    if (!buyerWallet || buyerWallet.balance < market.price) {
      response.status(400).json({ error: '余额不足' })
      return
    }

    const buyerNewBalance = buyerWallet.balance - market.price

    await prisma.$transaction([
      walletModel.update({
        where: { userId: buyerId },
        data: { balance: { decrement: market.price } }
      }),
      spendModel.create({
        data: {
          userId: buyerId,
          amount: market.price,
          targetType: 'lesson_plan',
          targetId: market.lessonPlanId
        }
      }),
      walletModel.upsert({
        where: { userId: market.sellerId },
        create: {
          userId: market.sellerId,
          balance: market.price,
          totalEarned: market.price
        },
        update: {
          balance: { increment: market.price },
          totalEarned: { increment: market.price }
        }
      }),
      txnModel.create({
        data: {
          userId: market.sellerId,
          fromUserId: buyerId,
          amount: market.price,
          type: 'market_sale',
          month: null
        }
      }),
      purchaseModel.create({
        data: {
          marketId,
          buyerId,
          price: market.price
        }
      }),
      marketModel.update({
        where: { id: marketId },
        data: { soldCount: { increment: 1 } }
      })
    ])

    response.json({ success: true, remainingBalance: buyerNewBalance })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Buy failed' })
  }
})

router.get('/my-purchases', async (request, response) => {
  try {
    if (!purchaseModel) {
      response.status(500).json({ error: 'purchase model unavailable' })
      return
    }

    const buyerId = String(request.query.buyerId ?? '').trim()
    if (!buyerId) {
      response.status(400).json({ error: 'buyerId required' })
      return
    }

    const purchases = await purchaseModel.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      include: {
        market: {
          include: { lessonPlan: true }
        }
      }
    }) as PurchaseWithRelations[]

    response.json({
      buyerId,
      purchases: purchases.map((purchase) => ({
        purchaseId: purchase.id,
        marketId: purchase.marketId,
        lessonPlanId: purchase.market?.lessonPlanId ?? null,
        title: purchase.market?.lessonPlan?.title ?? null,
        subject: purchase.market?.lessonPlan?.subject ?? null,
        price: purchase.price,
        createdAt: purchase.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch purchases failed' })
  }
})

router.get('/my-sales', async (request, response) => {
  try {
    if (!marketModel) {
      response.status(500).json({ error: 'market model unavailable' })
      return
    }

    const sellerId = String(request.query.sellerId ?? '').trim()
    if (!sellerId) {
      response.status(400).json({ error: 'sellerId required' })
      return
    }

    const listings = await marketModel.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: { lessonPlan: true }
    }) as MarketWithRelations[]

    response.json({
      sellerId,
      sales: listings.map((entry) => ({
        marketId: entry.id,
        lessonPlanId: entry.lessonPlanId,
        title: entry.lessonPlan?.title ?? null,
        subject: entry.lessonPlan?.subject ?? null,
        price: entry.price,
        status: entry.status,
        soldCount: entry.soldCount,
        revenue: entry.soldCount * entry.price,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch sales failed' })
  }
})

export { PLATFORM_SHARE }
export default router
