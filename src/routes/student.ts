import { Router } from 'express'
import prisma from '../lib/prisma.js'

type UserRecord = {
  id: string
  role: string
  name: string | null
}

type StudentParentRecord = {
  id: string
  studentId: string
  parentId: string
  relation: string
  createdAt: Date
}

type StudentParentWithRelations = StudentParentRecord & {
  student?: { id: string; name: string | null; role: string }
  parent?: { id: string; name: string | null; role: string }
}

type StudentClassRecord = {
  id: string
  studentId: string
  classId: string
  joinedAt: Date
}

type StudentClassWithRelations = StudentClassRecord & {
  class?: {
    id: string
    name: string
    subject: string | null
    grade: string | null
  }
}

type ClassRecord = {
  id: string
  name: string
  subject: string | null
  grade: string | null
}

const studentParentModel = prisma.studentParent
const studentClassModel = prisma.studentClass

const router = Router()

// 1. POST /bind-parent
router.post('/bind-parent', async (request, response) => {
  try {
    if (!studentParentModel) {
      response.status(500).json({ error: 'studentParent model unavailable' })
      return
    }
    const { studentId, parentId, relation } = request.body as {
      studentId?: string
      parentId?: string
      relation?: string
    }
    if (!studentId || !parentId) {
      response.status(400).json({ error: 'studentId and parentId required' })
      return
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } }) as UserRecord | null
    if (!student || student.role !== 'student') {
      response.status(403).json({ error: 'studentId must reference a student' })
      return
    }

    const parent = await prisma.user.findUnique({ where: { id: parentId } }) as UserRecord | null
    if (!parent || parent.role !== 'parent') {
      response.status(403).json({ error: 'parentId must reference a parent' })
      return
    }

    const existing = await studentParentModel.findUnique({
      where: { studentId_parentId: { studentId, parentId } }
    }) as StudentParentRecord | null
    if (existing) {
      response.status(409).json({ error: 'student and parent already bound' })
      return
    }

    const record = await studentParentModel.create({
      data: { studentId, parentId, relation: relation ?? 'parent' }
    }) as StudentParentRecord

    response.status(201).json({
      success: true,
      bindId: record.id,
      relation: record.relation
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'bind parent failed' })
  }
})

// 2. GET /:studentId/parents
router.get('/:studentId/parents', async (request, response) => {
  try {
    if (!studentParentModel) {
      response.status(500).json({ error: 'studentParent model unavailable' })
      return
    }
    const studentId = request.params.studentId.trim()
    const records = await studentParentModel.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
      include: { parent: true }
    }) as StudentParentWithRelations[]

    response.json({
      parents: records.map((r) => ({
        bindId: r.id,
        parentId: r.parentId,
        name: r.parent?.name ?? null,
        relation: r.relation,
        boundAt: r.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list parents failed' })
  }
})

// 3. GET /parent/:parentId/students
router.get('/parent/:parentId/students', async (request, response) => {
  try {
    if (!studentParentModel) {
      response.status(500).json({ error: 'studentParent model unavailable' })
      return
    }
    const parentId = request.params.parentId.trim()
    const records = await studentParentModel.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
      include: { student: true }
    }) as StudentParentWithRelations[]

    response.json({
      students: records.map((r) => ({
        bindId: r.id,
        studentId: r.studentId,
        name: r.student?.name ?? null,
        relation: r.relation,
        boundAt: r.createdAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list students failed' })
  }
})

// 4. POST /join-class
router.post('/join-class', async (request, response) => {
  try {
    if (!studentClassModel) {
      response.status(500).json({ error: 'studentClass model unavailable' })
      return
    }
    const { studentId, classId } = request.body as { studentId?: string; classId?: string }
    if (!studentId || !classId) {
      response.status(400).json({ error: 'studentId and classId required' })
      return
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } }) as UserRecord | null
    if (!student || student.role !== 'student') {
      response.status(403).json({ error: 'studentId must reference a student' })
      return
    }

    const classRecord = await prisma.class.findUnique({ where: { id: classId } }) as ClassRecord | null
    if (!classRecord) {
      response.status(404).json({ error: 'class not found' })
      return
    }

    const existing = await studentClassModel.findUnique({
      where: { studentId_classId: { studentId, classId } }
    }) as StudentClassRecord | null
    if (existing) {
      response.status(409).json({ error: 'student already joined this class' })
      return
    }

    const record = await studentClassModel.create({
      data: { studentId, classId }
    }) as StudentClassRecord

    response.status(201).json({
      success: true,
      joinId: record.id
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'join class failed' })
  }
})

// 5. GET /:studentId/classes
router.get('/:studentId/classes', async (request, response) => {
  try {
    if (!studentClassModel) {
      response.status(500).json({ error: 'studentClass model unavailable' })
      return
    }
    const studentId = request.params.studentId.trim()
    const records = await studentClassModel.findMany({
      where: { studentId },
      orderBy: { joinedAt: 'asc' },
      include: { class: true }
    }) as StudentClassWithRelations[]

    response.json({
      classes: records.map((r) => ({
        joinId: r.id,
        classId: r.classId,
        name: r.class?.name ?? null,
        subject: r.class?.subject ?? null,
        grade: r.class?.grade ?? null,
        joinedAt: r.joinedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list classes failed' })
  }
})

// 6. POST /unbind-parent
router.post('/unbind-parent', async (request, response) => {
  try {
    if (!studentParentModel) {
      response.status(500).json({ error: 'studentParent model unavailable' })
      return
    }
    const { studentId, parentId } = request.body as { studentId?: string; parentId?: string }
    if (!studentId || !parentId) {
      response.status(400).json({ error: 'studentId and parentId required' })
      return
    }

    const existing = await studentParentModel.findUnique({
      where: { studentId_parentId: { studentId, parentId } }
    }) as StudentParentRecord | null
    if (!existing) {
      response.status(404).json({ error: 'bind record not found' })
      return
    }

    await studentParentModel.delete({
      where: { studentId_parentId: { studentId, parentId } }
    })

    response.json({ success: true })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'unbind parent failed' })
  }
})

export default router
