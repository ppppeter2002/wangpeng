import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { generateParentReport, generateStudentReport, generateTeacherReport } from '../lib/report-generator.js'

const router = Router()

type GenerateReportBody = {
  studentId?: string
  diagnosisId?: string
  planId?: string
}

type PlanSessionRecord = {
  content: string
}

type ReportRecord = {
  id: string
  studentId: string
  diagnosisId: string | null
  planId: string | null
  role: string
  title: string
  content: string
  createdAt: Date
}

function getReportClient() {
  if (!prisma.report) {
    throw new Error('Report Prisma Client 未生成，请先执行 prisma generate')
  }

  return prisma.report
}

router.post('/generate', async (request, response) => {
  try {
    const { studentId, diagnosisId, planId } = request.body as GenerateReportBody

    if (!studentId) {
      response.status(400).json({ error: 'studentId required' })
      return
    }

    let diagnosis: unknown = null
    if (diagnosisId) {
      diagnosis = await prisma.diagnosisSession.findUnique({ where: { id: diagnosisId } }).catch(() => null)
    }

    let plan: PlanSessionRecord | null = null
    if (planId) {
      plan = await prisma.planSession?.findUnique?.({ where: { id: planId } } as never).catch(() => null) as PlanSessionRecord | null
    }

    const diagnosisInput = diagnosis || { weakPoints: [] }
    const planInput = plan ? JSON.parse(plan.content || '[]') : []

    const [studentReport, parentReport, teacherReport] = await Promise.all([
      generateStudentReport(diagnosisInput, planInput),
      generateParentReport(diagnosisInput, planInput),
      generateTeacherReport(diagnosisInput, planInput)
    ])

    const reports = await Promise.all([
      getReportClient().create({
        data: {
          studentId,
          diagnosisId,
          planId,
          role: 'student',
          title: '学生报告',
          content: JSON.stringify(studentReport)
        }
      }),
      getReportClient().create({
        data: {
          studentId,
          diagnosisId,
          planId,
          role: 'parent',
          title: '家长报告',
          content: JSON.stringify(parentReport)
        }
      }),
      getReportClient().create({
        data: {
          studentId,
          diagnosisId,
          planId,
          role: 'teacher',
          title: '教师报告',
          content: JSON.stringify(teacherReport)
        }
      })
    ]) as ReportRecord[]

    response.json({
      student: { id: reports[0].id, content: studentReport },
      parent: { id: reports[1].id, content: parentReport },
      teacher: { id: reports[2].id, content: teacherReport }
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Report generation failed' })
  }
})

router.get('/:studentId/:role', async (request, response) => {
  try {
    const reports = await getReportClient().findMany({
      where: {
        studentId: request.params.studentId,
        role: request.params.role
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    }) as ReportRecord[]

    response.json(reports)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Fetch report failed' })
  }
})

export default router
