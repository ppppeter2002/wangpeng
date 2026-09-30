import { Router } from 'express'
import { createNotification } from '../lib/notification.js'
import prisma from '../lib/prisma.js'

// 段位链扩展到 8 级
const TIERS = ['黑铁', '青铜', '白银', '黄金', '铂金', '钻石', '大师', '王者']

type UserRecord = { id: string; role: string; name: string | null }
type StudentRankRecord = { id: string; studentId: string; tier: string; score: number; districtId: string | null }
type SeasonRecord = {
  id: string; name: string; seasonMonth: string; status: string
  startedAt: Date; endedAt: Date | null
  rewardFirst: number; rewardSecond: number; rewardThird: number
}
type SeasonRewardRecord = {
  id: string; seasonId: string; studentId: string; rank: number; amount: number
  contactName: string | null; contactPhone: string | null; photoUrl: string | null
  status: string; claimedAt: Date | null; createdAt: Date
}

const seasonModel = prisma.season
const rewardModel = prisma.seasonReward
const rankModel = prisma.studentRank
const router = Router()

// 1. POST /create - 创建赛季
router.post('/create', async (request, response) => {
  try {
    if (!seasonModel) { response.status(500).json({ error: 'season model unavailable' }); return }
    const { name, seasonMonth, rewardFirst, rewardSecond, rewardThird } = request.body as {
      name?: string; seasonMonth?: string; rewardFirst?: number; rewardSecond?: number; rewardThird?: number
    }
    if (!name || !seasonMonth) { response.status(400).json({ error: 'name and seasonMonth required' }); return }

    const season = await seasonModel.create({
      data: {
        name,
        seasonMonth,
        status: 'active',
        rewardFirst: rewardFirst ?? 1000,
        rewardSecond: rewardSecond ?? 300,
        rewardThird: rewardThird ?? 100
      }
    }) as SeasonRecord

    response.status(201).json({
      seasonId: season.id, name: season.name, seasonMonth: season.seasonMonth,
      status: season.status, rewardFirst: season.rewardFirst, rewardSecond: season.rewardSecond, rewardThird: season.rewardThird
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'create season failed' })
  }
})

// 2. GET /current - 查当前赛季
router.get('/current', async (_request, response) => {
  try {
    if (!seasonModel) { response.status(500).json({ error: 'season model unavailable' }); return }
    const season = await seasonModel.findFirst({ where: { status: 'active' } }) as SeasonRecord | null
    if (!season) { response.status(404).json({ error: 'no active season' }); return }
    response.json({
      seasonId: season.id, name: season.name, seasonMonth: season.seasonMonth,
      status: season.status, startedAt: season.startedAt, endedAt: season.endedAt,
      rewardFirst: season.rewardFirst, rewardSecond: season.rewardSecond, rewardThird: season.rewardThird
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get current season failed' })
  }
})

// 3. POST /settle - 结算赛季
router.post('/settle', async (request, response) => {
  try {
    if (!seasonModel || !rewardModel || !rankModel) {
      response.status(500).json({ error: 'models unavailable' }); return
    }
    const { seasonId, adminId } = request.body as { seasonId?: string; adminId?: string }
    if (!seasonId || !adminId) { response.status(400).json({ error: 'seasonId and adminId required' }); return }

    // 校验 admin
    const admin = await prisma.user.findUnique({ where: { id: adminId } }) as UserRecord | null
    if (!admin || admin.role !== 'admin') { response.status(403).json({ error: 'only admin can settle' }); return }

    const season = await seasonModel.findUnique({ where: { id: seasonId } }) as SeasonRecord | null
    if (!season) { response.status(404).json({ error: 'season not found' }); return }
    if (season.status === 'settled') { response.status(409).json({ error: 'season already settled' }); return }

    // 按 StudentRank.score 降序取前3名
    const allRanks = await rankModel.findMany({ orderBy: { score: 'desc' } }) as StudentRankRecord[]
    const top3 = allRanks.slice(0, 3)

    if (top3.length === 0) { response.status(400).json({ error: 'no students to reward' }); return }

    const rewardAmounts = [season.rewardFirst, season.rewardSecond, season.rewardThird]
    const rewards: SeasonRewardRecord[] = []

    for (let i = 0; i < top3.length; i++) {
      const rank = i + 1
      const amount = rewardAmounts[i] ?? 0
      const reward = await rewardModel.create({
        data: { seasonId, studentId: top3[i].studentId, rank, amount, status: 'pending' }
      }) as SeasonRewardRecord
      rewards.push(reward)

      // 触发 reward_winner 通知
      await createNotification({
        userId: top3[i].studentId,
        type: 'reward_winner',
        title: `赛季获奖 - 第${rank}名`,
        content: `恭喜在「${season.name}」中获得第${rank}名，奖金 ${amount}。请前往领奖页面填写联系方式并上传领奖照片。`,
        payload: {
          seasonId,
          rewardId: reward.id,
          rank,
          amount,
          wechatTemplate: {
            miniprogram: { pagepath: 'pages/parent/notifications/notifications' }
          }
        }
      })
    }

    // 更新赛季状态
    await seasonModel.update({ where: { id: seasonId }, data: { status: 'settled', endedAt: new Date() } })

    response.json({
      seasonId, status: 'settled',
      rewards: rewards.map((r) => ({
        rewardId: r.id, studentId: r.studentId, rank: r.rank, amount: r.amount, status: r.status
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'settle season failed' })
  }
})

// 4. POST /reward/claim - 领奖上传
router.post('/reward/claim', async (request, response) => {
  try {
    if (!rewardModel) { response.status(500).json({ error: 'models unavailable' }); return }
    const { rewardId, contactName, contactPhone, photoUrl } = request.body as {
      rewardId?: string; contactName?: string; contactPhone?: string; photoUrl?: string
    }
    if (!rewardId) { response.status(400).json({ error: 'rewardId required' }); return }

    const reward = await rewardModel.findUnique({ where: { id: rewardId } }) as SeasonRewardRecord | null
    if (!reward) { response.status(404).json({ error: 'reward not found' }); return }
    if (reward.status === 'delivered') { response.status(409).json({ error: 'reward already delivered' }); return }

    await rewardModel.update({
      where: { id: rewardId },
      data: {
        contactName: contactName ?? null,
        contactPhone: contactPhone ?? null,
        photoUrl: photoUrl ?? null,
        status: 'confirmed',
        claimedAt: new Date()
      }
    })

    // 触发 reward_claimed 通知
    await createNotification({
      userId: reward.studentId,
      type: 'reward_claimed',
      title: '领奖信息已确认',
      content: `您的领奖信息已提交确认（第${reward.rank}名，奖金 ${reward.amount}），请等待奖金发放。`,
      payload: {
        rewardId,
        rank: reward.rank,
        amount: reward.amount,
        status: 'confirmed',
        wechatTemplate: {
          miniprogram: { pagepath: 'pages/parent/notifications/notifications' }
        }
      }
    })

    response.json({ success: true, rewardId, status: 'confirmed' })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'claim reward failed' })
  }
})

// 5. GET /leaderboard - 赛季排行榜
router.get('/leaderboard', async (request, response) => {
  try {
    if (!rankModel) { response.status(500).json({ error: 'studentRank model unavailable' }); return }
    const tier = request.query.tier ? String(request.query.tier).trim() : ''
    const limit = request.query.limit ? Math.min(Number(request.query.limit), 100) : 100

    const where: { tier?: string } = {}
    if (tier) where.tier = tier

    const records = await rankModel.findMany({ where, orderBy: { score: 'desc' }, take: limit }) as StudentRankRecord[]

    // 查学生姓名
    const studentIds = Array.from(new Set(records.map((r) => r.studentId)))
    const students = studentIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true } }) as { id: string; name: string | null }[]
      : []
    const nameMap = new Map(students.map((s) => [s.id, s.name]))

    response.json({
      tier: tier || 'all',
      leaderboard: records.map((r, i) => ({
        rank: i + 1,
        studentId: r.studentId,
        studentName: nameMap.get(r.studentId) ?? null,
        tier: r.tier,
        score: r.score,
        districtId: r.districtId
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get leaderboard failed' })
  }
})

// 6. GET /reward/:studentId - 查学生获奖记录
router.get('/reward/:studentId', async (request, response) => {
  try {
    if (!rewardModel) { response.status(500).json({ error: 'seasonReward model unavailable' }); return }
    const { studentId } = request.params
    const seasonId = request.query.seasonId ? String(request.query.seasonId).trim() : ''

    const where: { studentId: string; seasonId?: string } = { studentId }
    if (seasonId) where.seasonId = seasonId

    const rewards = await rewardModel.findMany({ where, orderBy: { rank: 'asc' } }) as SeasonRewardRecord[]

    response.json({
      studentId,
      rewards: rewards.map((r) => ({
        rewardId: r.id, seasonId: r.seasonId, rank: r.rank, amount: r.amount,
        contactName: r.contactName, contactPhone: r.contactPhone, photoUrl: r.photoUrl,
        status: r.status, claimedAt: r.claimedAt, createdAt: r.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get reward failed' })
  }
})

export { TIERS }
export default router
