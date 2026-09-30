import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { generatePreviewPlan, generateRemedyPlan } from '../lib/planner.js'

const router = Router()

type RemedyWeakPoint = {
  subject: string
  topic: string
  reason: string
  severity?: number
}

type RemedyRequestBody = {
  studentId?: string
  weakPoints?: RemedyWeakPoint[]
  diagnosisId?: string
}

type PreviewRequestBody = {
  studentId?: string
  subject?: string
  nextTopic?: string
}

type PlanSessionRecord = {
  id: string
  studentId: string
  diagnosisId: string | null
  weakPoints: string
  planType: string
  totalMinutes: number
  content: string
  createdAt: Date
}

function getPlanSessionClient() {
  if (!prisma.planSession) {
    throw new Error('PlanSession Prisma Client 未生成，请先执行 prisma generate')
  }

  return prisma.planSession
}

router.post('/remedy', async (request, response) => {
  try {
    const { studentId, weakPoints, diagnosisId } = request.body as RemedyRequestBody

    if (!studentId || !weakPoints?.length) {
      response.status(400).json({ error: 'studentId and weakPoints required' })
      return
    }

    const plan = await generateRemedyPlan(studentId, weakPoints)
    const normalizedPlan = typeof plan === 'object' && plan && 'steps' in plan ? (plan as { steps?: unknown }).steps ?? [] : plan
    const session = await getPlanSessionClient().create({
      data: {
        studentId,
        diagnosisId,
        weakPoints: JSON.stringify(weakPoints),
        planType: 'remedy',
        totalMinutes: 60,
        content: JSON.stringify(normalizedPlan)
      }
    }) as PlanSessionRecord

    response.json({ sessionId: session.id, plan: normalizedPlan })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Plan generation failed' })
  }
})

router.post('/preview', async (request, response) => {
  try {
    const { studentId, subject, nextTopic } = request.body as PreviewRequestBody

    if (!studentId || !subject || !nextTopic) {
      response.status(400).json({ error: 'studentId, subject, nextTopic required' })
      return
    }

    const plan = await generatePreviewPlan(studentId, subject, nextTopic)
    const normalizedPlan = typeof plan === 'object' && plan && 'steps' in plan ? (plan as { steps?: unknown }).steps ?? [] : plan
    const session = await getPlanSessionClient().create({
      data: {
        studentId,
        weakPoints: '[]',
        planType: 'preview',
        totalMinutes: 20,
        content: JSON.stringify(normalizedPlan)
      }
    }) as PlanSessionRecord

    response.json({ sessionId: session.id, plan: normalizedPlan })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Preview plan failed' })
  }
})

router.get('/:studentId', async (request, response) => {
  try {
    const sessions = await getPlanSessionClient().findMany({
      where: { studentId: request.params.studentId },
      orderBy: { createdAt: 'desc' },
      take: 10
    }) as PlanSessionRecord[]

    response.json(sessions)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch plans failed' })
  }
})

export default router
