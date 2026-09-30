import { Router } from 'express'
import prisma from '../lib/prisma.js'

type UserRecord = {
  id: string
  role: string
  schoolId?: string | null
}

type SchoolRecord = {
  id: string
  name: string
  creatorId?: string | null
  createdAt?: Date
}

type ClassRecord = {
  id: string
  name: string
  schoolId?: string | null
  createdAt?: Date
}

type SchoolModel = NonNullable<typeof prisma.school>
type ClassModel = NonNullable<typeof prisma.class>
type UserModel = NonNullable<typeof prisma.user>

const schoolModel = prisma.school as SchoolModel
const classModel = prisma.class as ClassModel
const userModel = prisma.user as UserModel
const router = Router()

function normalizeText(value: string) {
  return value.trim()
}

router.post('/create', async (request, response) => {
  try {
    const { creatorId, name } = request.body as { creatorId?: string; name?: string }

    if (!creatorId || !name) {
      response.status(400).json({ error: 'creatorId and name required' })
      return
    }

    const teacher = await userModel.findUnique({ where: { id: creatorId } }) as UserRecord | null

    if (!teacher || teacher.role !== 'teacher') {
      response.status(400).json({ error: 'creator must be teacher' })
      return
    }

    const normalizedName = normalizeText(name)

    if (!normalizedName) {
      response.status(400).json({ error: 'name required' })
      return
    }

    const existingSchool = await schoolModel.findFirst({ where: { name: normalizedName } }) as SchoolRecord | null

    if (existingSchool) {
      response.status(409).json({ error: 'school already exists' })
      return
    }

    const school = await schoolModel.create({
      data: {
        name: normalizedName,
        creatorId
      } as never
    }) as SchoolRecord

    await userModel.update({
      where: { id: creatorId },
      data: { schoolId: school.id } as never
    })

    response.json({ schoolId: school.id, name: school.name })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Create school failed' })
  }
})

router.get('/:schoolId/classes', async (request, response) => {
  try {
    const classes = await classModel.findMany({
      where: { schoolId: request.params.schoolId } as never,
      orderBy: { createdAt: 'desc' }
    }) as ClassRecord[]

    response.json(classes)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch school classes failed' })
  }
})

router.post('/join', async (request, response) => {
  try {
    const { teacherId, schoolName } = request.body as { teacherId?: string; schoolName?: string }

    if (!teacherId || !schoolName) {
      response.status(400).json({ error: 'teacherId and schoolName required' })
      return
    }

    const teacher = await userModel.findUnique({ where: { id: teacherId } }) as UserRecord | null

    if (!teacher || teacher.role !== 'teacher') {
      response.status(400).json({ error: 'teacher not found' })
      return
    }

    const school = await schoolModel.findFirst({ where: { name: normalizeText(schoolName) } }) as SchoolRecord | null

    if (!school) {
      response.status(404).json({ error: 'school not found' })
      return
    }

    await userModel.update({
      where: { id: teacherId },
      data: { schoolId: school.id } as never
    })

    response.json({ teacherId, schoolId: school.id, schoolName: school.name })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Join school failed' })
  }
})

export default router
