import { Prisma } from '@prisma/client'
import { Router } from 'express'
import prisma from '../lib/prisma.js'

type UserRecord = {
  id: string
  role: string
  name: string | null
  classId: string | null
}

type ClassRecord = {
  id: string
  teacherId: string | null
  name: string
  grade: string | null
  subject: string | null
  createdAt: Date
}

const router = Router()

function normalizeText(value: string) {
  return value.trim()
}

router.post('/create', async (request, response) => {
  try {
    const { teacherId, name, grade, subject } = request.body as {
      teacherId?: string
      name?: string
      grade?: string
      subject?: string
    }

    if (!teacherId || !name || !grade) {
      response.status(400).json({ error: 'teacherId, name and grade required' })
      return
    }

    const normalizedName = normalizeText(name)
    const normalizedGrade = normalizeText(grade)
    const normalizedSubject = subject ? normalizeText(subject) : null

    if (!normalizedName || !normalizedGrade) {
      response.status(400).json({ error: 'teacherId, name and grade required' })
      return
    }

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } }) as UserRecord | null

    if (!teacher || teacher.role !== 'teacher') {
      response.status(400).json({ error: 'teacher not found' })
      return
    }

    const classData = {
      teacherId,
      name: normalizedName,
      grade: normalizedGrade,
      subject: normalizedSubject
    } as Prisma.ClassUncheckedCreateInput

    const classRecord = await prisma.class.create({
      data: classData
    }) as ClassRecord

    response.json({
      classId: classRecord.id,
      name: classRecord.name,
      grade: classRecord.grade
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Create class failed' })
  }
})

router.get('/:teacherId', async (request, response) => {
  try {
    const classes = await prisma.class.findMany({
      where: { teacherId: request.params.teacherId },
      orderBy: { createdAt: 'desc' }
    }) as ClassRecord[]

    response.json(classes)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch classes failed' })
  }
})

router.post('/:classId/add-student', async (request, response) => {
  try {
    const { studentId } = request.body as { studentId?: string }

    if (!studentId) {
      response.status(400).json({ error: 'studentId required' })
      return
    }

    const classRecord = await prisma.class.findUnique({ where: { id: request.params.classId } }) as ClassRecord | null

    if (!classRecord) {
      response.status(404).json({ error: 'class not found' })
      return
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } }) as UserRecord | null

    if (!student || student.role !== 'student') {
      response.status(400).json({ error: 'student not found' })
      return
    }

    const updateData = {
      classId: classRecord.id
    } as Prisma.UserUncheckedUpdateInput

    await prisma.user.update({
      where: { id: studentId },
      data: updateData
    })

    response.json({ classId: classRecord.id, studentId })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Add student failed' })
  }
})

router.get('/:classId/students', async (request, response) => {
  try {
    const classRecord = await prisma.class.findUnique({ where: { id: request.params.classId } }) as ClassRecord | null

    if (!classRecord) {
      response.status(404).json({ error: 'class not found' })
      return
    }

    const students = await prisma.user.findMany({
      where: {
        classId: classRecord.id,
        role: 'student'
      },
      orderBy: { createdAt: 'asc' }
    }) as UserRecord[]

    response.json(students)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch students failed' })
  }
})

export default router
