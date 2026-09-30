import { Router } from 'express'
import prisma from '../lib/prisma.js'

type UserRecord = {
  id: string
  role: string
  name: string | null
  phone: string | null
}

type StudentParentRecord = {
  id: string
  studentId: string
  parentId: string
  relation: string
  createdAt: Date
}

type StudentParentWithStudent = StudentParentRecord & {
  student?: UserRecord
}

type StudentRankRecord = {
  studentId: string
  tier: string
  score: number
  weakTopics: string
  seasonId: string | null
}

const studentParentModel = prisma.studentParent
const studentRankModel = prisma.studentRank

const router = Router()

// 1. POST /bind - 家长按学生手机号反查并建立绑定关系
router.post('/bind', async (request, response) => {
  try {
    if (!studentParentModel) {
      response.status(500).json({ error: 'studentParent model unavailable' })
      return
    }
    const { parentId, studentPhone, relation } = request.body as {
      parentId?: string
      studentPhone?: string
      relation?: string
    }
    if (!parentId || !studentPhone) {
      response.status(400).json({ error: 'parentId and studentPhone required' })
      return
    }

    // 校验 parent 身份
    const parent = await prisma.user.findUnique({ where: { id: parentId } }) as UserRecord | null
    if (!parent || parent.role !== 'parent') {
      response.status(403).json({ error: 'parentId must reference a parent' })
      return
    }

    // 按 phone 反查学生
    const student = await prisma.user.findUnique({ where: { phone: studentPhone } }) as UserRecord | null
    if (!student || student.role !== 'student') {
      response.status(404).json({ error: '未找到匹配该手机号的学生' })
      return
    }

    // 已存在？
    const existing = await studentParentModel.findUnique({
      where: { studentId_parentId: { studentId: student.id, parentId } }
    }) as StudentParentRecord | null
    if (existing) {
      response.status(409).json({
        error: '已绑定该学生',
        bindId: existing.id,
        studentId: student.id
      })
      return
    }

    const record = await studentParentModel.create({
      data: { studentId: student.id, parentId, relation: relation ?? 'parent' }
    }) as StudentParentRecord

    response.status(201).json({
      success: true,
      bindId: record.id,
      studentId: student.id,
      studentName: student.name,
      relation: record.relation
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'bind student failed' })
  }
})

// 2. GET /children/:parentId - 家长绑定的学生列表（含段位/积分）
router.get('/children/:parentId', async (request, response) => {
  try {
    if (!studentParentModel || !studentRankModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const parentId = request.params.parentId.trim()

    const records = await studentParentModel.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
      include: { student: true }
    }) as StudentParentWithStudent[]

    // 批量查段位
    const studentIds = Array.from(new Set(records.map((r) => r.studentId)))
    const ranks = studentIds.length > 0
      ? await studentRankModel.findMany({ where: { studentId: { in: studentIds } } }) as StudentRankRecord[]
      : []
    const rankMap = new Map(ranks.map((r) => [r.studentId, r]))

    response.json({
      children: records.map((r) => {
        const rank = rankMap.get(r.studentId)
        return {
          bindId: r.id,
          studentId: r.studentId,
          name: r.student?.name ?? null,
          phone: r.student?.phone ?? null,
          relation: r.relation,
          tier: rank?.tier ?? '黑铁',
          score: rank?.score ?? 0,
          weakTopics: rank?.weakTopics ?? '[]',
          boundAt: r.createdAt
        }
      })
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list children failed' })
  }
})

export default router
