import { Router } from 'express'
import prisma from '../lib/prisma.js'

type UserRecord = {
  id: string
  role: string
}

type ClassSubjectRecord = {
  id: string
  classId: string
  subject: string
  teacherId: string
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
  createdAt: Date
  updatedAt: Date
}

type InteractionRecord = {
  id: string
  lessonPlanId: string
  userId: string
  type: string
  content: string
  resolved: boolean
  createdAt: Date
}

type RevisionRecord = {
  id: string
  lessonPlanId: string
  version: number
  title: string
  content: string
  modifierId: string
  comment: string | null
  createdAt: Date
}

const lessonPlanModel = prisma.lessonPlan
const revisionModel = prisma.lessonPlanRevision
const interactionModel = prisma.lessonPlanInteraction
const classSubjectModel = prisma.classSubject

const router = Router()
const interactionTypes = ['comment', 'suggest', 'approve', 'request_change']

async function findUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } }) as Promise<UserRecord | null>
}

async function assertClaimedTeacher(teacherId: string, classId: string, subject: string) {
  const teacher = await findUser(teacherId)
  if (!teacher || teacher.role !== 'teacher') {
    return { status: 403, body: { error: 'only teacher can perform this action' } }
  }

  if (!classSubjectModel) {
    return { status: 500, body: { error: 'class subject model unavailable' } }
  }

  const classSubject = await classSubjectModel.findUnique({
    where: { classId_subject: { classId, subject } }
  }) as ClassSubjectRecord | null

  if (!classSubject || classSubject.teacherId !== teacherId) {
    return { status: 403, body: { error: 'not the claimed teacher of this class subject' } }
  }

  return null
}

router.post('/create', async (request, response) => {
  try {
    if (!lessonPlanModel) {
      response.status(500).json({ error: 'lesson plan model unavailable' })
      return
    }

    const { authorId, classId, subject, title, content } = request.body as {
      authorId?: string
      classId?: string
      subject?: string
      title?: string
      content?: string
    }

    if (!authorId || !classId || !subject || !title || !content) {
      response.status(400).json({ error: 'authorId, classId, subject, title and content required' })
      return
    }

    const normalizedSubject = subject.trim()
    const normalizedTitle = title.trim()
    const normalizedContent = content.trim()

    if (!normalizedSubject || !normalizedTitle || !normalizedContent) {
      response.status(400).json({ error: 'subject, title and content must not be empty' })
      return
    }

    const forbidden = await assertClaimedTeacher(authorId, classId, normalizedSubject)
    if (forbidden) {
      response.status(forbidden.status).json(forbidden.body)
      return
    }

    const lessonPlan = await lessonPlanModel.create({
      data: {
        authorId,
        classId,
        subject: normalizedSubject,
        title: normalizedTitle,
        content: normalizedContent,
        status: 'draft',
        version: 1
      }
    }) as LessonPlanRecord

    response.status(201).json({
      lessonPlanId: lessonPlan.id,
      version: lessonPlan.version,
      status: lessonPlan.status
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Create lesson plan failed' })
  }
})

router.post('/publish', async (request, response) => {
  try {
    if (!lessonPlanModel) {
      response.status(500).json({ error: 'lesson plan model unavailable' })
      return
    }

    const { lessonPlanId, authorId } = request.body as {
      lessonPlanId?: string
      authorId?: string
    }

    if (!lessonPlanId || !authorId) {
      response.status(400).json({ error: 'lessonPlanId and authorId required' })
      return
    }

    const lessonPlan = await lessonPlanModel.findUnique({ where: { id: lessonPlanId } }) as LessonPlanRecord | null

    if (!lessonPlan) {
      response.status(404).json({ error: 'lesson plan not found' })
      return
    }

    if (lessonPlan.authorId !== authorId) {
      response.status(403).json({ error: 'only author can publish this lesson plan' })
      return
    }

    const forbidden = await assertClaimedTeacher(authorId, lessonPlan.classId, lessonPlan.subject)
    if (forbidden) {
      response.status(forbidden.status).json(forbidden.body)
      return
    }

    if (lessonPlan.status !== 'draft') {
      response.status(400).json({ error: `cannot publish lesson plan with status ${lessonPlan.status}` })
      return
    }

    const updated = await lessonPlanModel.update({
      where: { id: lessonPlanId },
      data: { status: 'published' }
    }) as LessonPlanRecord

    response.json({ lessonPlanId: updated.id, status: updated.status })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Publish lesson plan failed' })
  }
})

router.put('/update', async (request, response) => {
  try {
    if (!lessonPlanModel || !revisionModel) {
      response.status(500).json({ error: 'lesson plan model unavailable' })
      return
    }

    const { lessonPlanId, authorId, title, content, comment } = request.body as {
      lessonPlanId?: string
      authorId?: string
      title?: string
      content?: string
      comment?: string
    }

    if (!lessonPlanId || !authorId || !title || !content) {
      response.status(400).json({ error: 'lessonPlanId, authorId, title and content required' })
      return
    }

    const normalizedTitle = title.trim()
    const normalizedContent = content.trim()
    const normalizedComment = comment ? comment.trim() : null

    if (!normalizedTitle || !normalizedContent) {
      response.status(400).json({ error: 'title and content must not be empty' })
      return
    }

    const current = await lessonPlanModel.findUnique({ where: { id: lessonPlanId } }) as LessonPlanRecord | null

    if (!current) {
      response.status(404).json({ error: 'lesson plan not found' })
      return
    }

    if (current.authorId !== authorId) {
      response.status(403).json({ error: 'only author can update this lesson plan' })
      return
    }

    const forbidden = await assertClaimedTeacher(authorId, current.classId, current.subject)
    if (forbidden) {
      response.status(forbidden.status).json(forbidden.body)
      return
    }

    const previousVersion = current.version

    await revisionModel.create({
      data: {
        lessonPlanId,
        version: previousVersion,
        title: current.title,
        content: current.content,
        modifierId: authorId,
        comment: normalizedComment
      }
    })

    const updated = await lessonPlanModel.update({
      where: { id: lessonPlanId },
      data: {
        title: normalizedTitle,
        content: normalizedContent,
        version: previousVersion + 1
      }
    }) as LessonPlanRecord

    response.json({ lessonPlanId: updated.id, version: updated.version })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Update lesson plan failed' })
  }
})

router.get('/:id', async (request, response) => {
  try {
    if (!lessonPlanModel) {
      response.status(500).json({ error: 'lesson plan model unavailable' })
      return
    }

    const userId = String(request.query.userId ?? '').trim()
    if (!userId) {
      response.status(400).json({ error: 'userId required' })
      return
    }

    const user = await findUser(userId)
    if (!user || !['teacher', 'parent'].includes(user.role)) {
      response.status(403).json({ error: 'only teacher or parent can view lesson plan' })
      return
    }

    const lessonPlan = await lessonPlanModel.findUnique({ where: { id: request.params.id } }) as LessonPlanRecord | null

    if (!lessonPlan) {
      response.status(404).json({ error: 'lesson plan not found' })
      return
    }

    response.json({
      lessonPlanId: lessonPlan.id,
      authorId: lessonPlan.authorId,
      classId: lessonPlan.classId,
      subject: lessonPlan.subject,
      title: lessonPlan.title,
      content: lessonPlan.content,
      version: lessonPlan.version,
      status: lessonPlan.status,
      createdAt: lessonPlan.createdAt,
      updatedAt: lessonPlan.updatedAt
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch lesson plan failed' })
  }
})

router.get('/:id/revisions', async (request, response) => {
  try {
    if (!revisionModel) {
      response.status(500).json({ error: 'revision model unavailable' })
      return
    }

    const revisions = await revisionModel.findMany({
      where: { lessonPlanId: request.params.id },
      orderBy: { version: 'desc' }
    }) as RevisionRecord[]

    response.json({
      lessonPlanId: request.params.id,
      revisions: revisions.map((revision) => ({
        id: revision.id,
        version: revision.version,
        title: revision.title,
        content: revision.content,
        modifierId: revision.modifierId,
        comment: revision.comment,
        createdAt: revision.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch revisions failed' })
  }
})

router.get('/:id/interactions', async (request, response) => {
  try {
    if (!interactionModel) {
      response.status(500).json({ error: 'interaction model unavailable' })
      return
    }

    const interactions = await interactionModel.findMany({
      where: { lessonPlanId: request.params.id },
      orderBy: { createdAt: 'asc' }
    }) as InteractionRecord[]

    response.json({
      lessonPlanId: request.params.id,
      interactions: interactions.map((interaction) => ({
        id: interaction.id,
        userId: interaction.userId,
        type: interaction.type,
        content: interaction.content,
        resolved: interaction.resolved,
        createdAt: interaction.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch interactions failed' })
  }
})

router.post('/:id/interact', async (request, response) => {
  try {
    if (!interactionModel) {
      response.status(500).json({ error: 'interaction model unavailable' })
      return
    }

    const { userId, type, content } = request.body as {
      userId?: string
      type?: string
      content?: string
    }

    if (!userId || !type || !content) {
      response.status(400).json({ error: 'userId, type and content required' })
      return
    }

    const normalizedType = type.trim()
    const normalizedContent = content.trim()

    if (!normalizedType || !normalizedContent) {
      response.status(400).json({ error: 'type and content must not be empty' })
      return
    }

    if (!interactionTypes.includes(normalizedType)) {
      response.status(400).json({ error: `type must be one of ${interactionTypes.join(', ')}` })
      return
    }

    const user = await findUser(userId)
    if (!user || !['teacher', 'parent'].includes(user.role)) {
      response.status(403).json({ error: 'only teacher or parent can interact' })
      return
    }

    if (!lessonPlanModel) {
      response.status(500).json({ error: 'lesson plan model unavailable' })
      return
    }

    const lessonPlan = await lessonPlanModel.findUnique({ where: { id: request.params.id } }) as LessonPlanRecord | null
    if (!lessonPlan) {
      response.status(404).json({ error: 'lesson plan not found' })
      return
    }

    const interaction = await interactionModel.create({
      data: {
        lessonPlanId: request.params.id,
        userId,
        type: normalizedType,
        content: normalizedContent,
        resolved: false
      }
    }) as InteractionRecord

    response.status(201).json({ interactionId: interaction.id, type: interaction.type })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Create interaction failed' })
  }
})

router.post('/:id/interact/:interactionId/resolve', async (request, response) => {
  try {
    if (!interactionModel || !lessonPlanModel) {
      response.status(500).json({ error: 'interaction model unavailable' })
      return
    }

    const { userId } = request.body as { userId?: string }

    if (!userId) {
      response.status(400).json({ error: 'userId required' })
      return
    }

    const lessonPlan = await lessonPlanModel.findUnique({ where: { id: request.params.id } }) as LessonPlanRecord | null
    if (!lessonPlan) {
      response.status(404).json({ error: 'lesson plan not found' })
      return
    }

    const forbidden = await assertClaimedTeacher(userId, lessonPlan.classId, lessonPlan.subject)
    if (forbidden) {
      response.status(forbidden.status).json(forbidden.body)
      return
    }

    await interactionModel.update({
      where: { id: request.params.interactionId },
      data: { resolved: true }
    })

    response.json({ success: true })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Resolve interaction failed' })
  }
})

export default router
