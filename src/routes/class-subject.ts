import { Prisma } from '@prisma/client'
import { Router } from 'express'
import prisma from '../lib/prisma.js'

type UserRecord = {
  id: string
  role: string
  name: string | null
}

type ClassSubjectRecord = {
  id: string
  classId: string
  subject: string
  teacherId: string
}

type ChallengeRecord = {
  id: string
  classSubId: string
  challengerId: string
  targetTeacherId: string
  claimedTeacherName: string
  votesYes: number
  votesNo: number
  status: string
  createdAt: Date
  closedAt: Date | null
}

type ClassSubjectModel = NonNullable<typeof prisma.classSubject>
type ChallengeModel = NonNullable<typeof prisma.classSubjectChallenge>

const classSubjectModel = prisma.classSubject as ClassSubjectModel | undefined
const challengeModel = prisma.classSubjectChallenge as ChallengeModel | undefined
const router = Router()

function normalizeText(value: string) {
  return value.trim()
}

router.post('/assign', async (request, response) => {
  try {
    if (!classSubjectModel) {
      response.status(500).json({ error: 'class subject model unavailable' })
      return
    }

    const { classId, subject, teacherId } = request.body as {
      classId?: string
      subject?: string
      teacherId?: string
    }

    if (!classId || !subject || !teacherId) {
      response.status(400).json({ error: 'classId, subject and teacherId required' })
      return
    }

    const classRecord = await prisma.class.findUnique({ where: { id: classId } }) as { id: string } | null

    if (!classRecord) {
      response.status(400).json({ error: 'class not found' })
      return
    }

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } }) as UserRecord | null

    if (!teacher || teacher.role !== 'teacher') {
      response.status(400).json({ error: 'teacher not found' })
      return
    }

    const normalizedSubject = normalizeText(subject)

    try {
      const classSubject = await classSubjectModel.create({
        data: {
          classId,
          subject: normalizedSubject,
          teacherId
        }
      }) as ClassSubjectRecord

      response.json({ classSubId: classSubject.id, subject: classSubject.subject, teacherId: classSubject.teacherId })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await classSubjectModel.findUnique({
          where: { classId_subject: { classId, subject: normalizedSubject } }
        }) as ClassSubjectRecord | null

        response.status(409).json({
          error: 'subject already assigned',
          existingTeacherId: existing?.teacherId ?? null,
          needChallenge: true
        })
        return
      }

      throw error
    }
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Assign class subject failed' })
  }
})

router.post('/challenge', async (request, response) => {
  try {
    if (!classSubjectModel || !challengeModel) {
      response.status(500).json({ error: 'challenge model unavailable' })
      return
    }

    const { classSubId, challengerId, claimedTeacherName } = request.body as {
      classSubId?: string
      challengerId?: string
      claimedTeacherName?: string
    }

    if (!classSubId || !challengerId || !claimedTeacherName) {
      response.status(400).json({ error: 'classSubId, challengerId and claimedTeacherName required' })
      return
    }

    const challenger = await prisma.user.findUnique({ where: { id: challengerId } }) as UserRecord | null

    if (!challenger || challenger.role !== 'teacher') {
      response.status(400).json({ error: 'challenger must be teacher' })
      return
    }

    const classSubject = await classSubjectModel.findUnique({ where: { id: classSubId } }) as ClassSubjectRecord | null

    if (!classSubject) {
      response.status(404).json({ error: 'class subject not found' })
      return
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const openChallenge = await challengeModel.findFirst({
      where: {
        classSubId,
        status: 'open',
        createdAt: { gte: ninetyDaysAgo }
      }
    }) as ChallengeRecord | null

    if (openChallenge) {
      response.status(400).json({ error: '已有进行中的仲裁' })
      return
    }

    const challenge = await challengeModel.create({
      data: {
        classSubId,
        challengerId,
        targetTeacherId: classSubject.teacherId,
        claimedTeacherName: normalizeText(claimedTeacherName)
      }
    }) as ChallengeRecord

    response.json({ challengeId: challenge.id })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Create challenge failed' })
  }
})

router.post('/vote', async (request, response) => {
  try {
    if (!challengeModel) {
      response.status(500).json({ error: 'challenge model unavailable' })
      return
    }

    const { challengeId, voterId, vote } = request.body as {
      challengeId?: string
      voterId?: string
      vote?: 'yes' | 'no'
    }

    if (!challengeId || !voterId || !vote || !['yes', 'no'].includes(vote)) {
      response.status(400).json({ error: 'challengeId, voterId and vote required' })
      return
    }

    const voter = await prisma.user.findUnique({ where: { id: voterId } }) as UserRecord | null

    if (!voter || voter.role !== 'parent') {
      response.status(400).json({ error: 'voter must be parent' })
      return
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId: voterId } }) as { status: string } | null

    if (!subscription || subscription.status !== 'active') {
      response.status(400).json({ error: 'active subscription required' })
      return
    }

    const challenge = await challengeModel.findUnique({ where: { id: challengeId } }) as ChallengeRecord | null

    if (!challenge || challenge.status !== 'open') {
      response.status(400).json({ error: 'challenge not open' })
      return
    }

    const data = vote === 'yes'
      ? { votesYes: { increment: 1 } }
      : { votesNo: { increment: 1 } }

    const updated = await challengeModel.update({
      where: { id: challengeId },
      data
    }) as ChallengeRecord

    const totalVotes = updated.votesYes + updated.votesNo
    let status = updated.status

    if (totalVotes >= 5) {
      const ratio = updated.votesYes / totalVotes

      if (ratio >= 0.8) {
        status = 'confirmed'
        await challengeModel.update({
          where: { id: challengeId },
          data: { status, closedAt: new Date() }
        })
      } else {
        status = 'rejected'
        await challengeModel.update({
          where: { id: challengeId },
          data: { status, closedAt: new Date() }
        })
      }
    }

    response.json({ votesYes: updated.votesYes, votesNo: updated.votesNo, status })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Vote challenge failed' })
  }
})

router.get('/:classSubId/challenge', async (request, response) => {
  try {
    if (!challengeModel) {
      response.status(500).json({ error: 'challenge model unavailable' })
      return
    }

    const challenge = await challengeModel.findFirst({
      where: { classSubId: request.params.classSubId },
      orderBy: { createdAt: 'desc' }
    }) as ChallengeRecord | null

    if (!challenge) {
      response.status(404).json({ error: 'challenge not found' })
      return
    }

    response.json(challenge)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch challenge failed' })
  }
})

export default router
