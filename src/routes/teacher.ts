import { Router } from 'express'
import prisma from '../lib/prisma.js'

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
  status: string
  version: number
  createdAt: Date
  updatedAt: Date
}

type ClassRecord = {
  id: string
  teacherId: string | null
  name: string
  grade: string | null
  subject: string | null
  createdAt: Date
}

type StudentClassRow = {
  classId: string
}

const lessonPlanModel = prisma.lessonPlan
const studentClassModel = prisma.studentClass

const router = Router()

// 1. GET /plans/:teacherId - 老师的教案列表
router.get('/plans/:teacherId', async (request, response) => {
  try {
    if (!lessonPlanModel) {
      response.status(500).json({ error: 'lessonPlan model unavailable' })
      return
    }
    const teacherId = request.params.teacherId.trim()

    // 校验老师身份
    const teacher = await prisma.user.findUnique({ where: { id: teacherId } }) as UserRecord | null
    if (!teacher || teacher.role !== 'teacher') {
      response.status(403).json({ error: 'teacherId must reference a teacher' })
      return
    }

    const records = await lessonPlanModel.findMany({
      where: { authorId: teacherId },
      orderBy: { createdAt: 'desc' }
    }) as LessonPlanRecord[]

    response.json({
      plans: records.map((p) => ({
        id: p.id,
        classId: p.classId,
        subject: p.subject,
        title: p.title,
        status: p.status,
        version: p.version,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list plans failed' })
  }
})

// 2. GET /classes/:teacherId - 老师的班级列表（含成员数）
router.get('/classes/:teacherId', async (request, response) => {
  try {
    if (!studentClassModel) {
      response.status(500).json({ error: 'studentClass model unavailable' })
      return
    }
    const teacherId = request.params.teacherId.trim()

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } }) as UserRecord | null
    if (!teacher || teacher.role !== 'teacher') {
      response.status(403).json({ error: 'teacherId must reference a teacher' })
      return
    }

    const classes = await prisma.class.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' }
    }) as ClassRecord[]

    // 批量 count 每班成员
    const classIds = classes.map((c) => c.id)
    const rows = classIds.length > 0
      ? await studentClassModel.findMany({
          where: { classId: { in: classIds } },
          select: { classId: true }
        }) as StudentClassRow[]
      : []
    const countMap = new Map<string, number>()
    for (const row of rows) {
      countMap.set(row.classId, (countMap.get(row.classId) ?? 0) + 1)
    }

    response.json({
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        subject: c.subject,
        memberCount: countMap.get(c.id) ?? 0,
        createdAt: c.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list teacher classes failed' })
  }
})

export default router
