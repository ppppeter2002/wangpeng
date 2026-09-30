import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { hashQuestion } from '../lib/hash.js'
import { createNotification } from '../lib/notification.js'

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

type AssignmentRecord = {
  id: string
  classId: string
  subject: string
  teacherId: string
  title: string
  description: string | null
  dueAt: Date | null
  status: string
  createdAt: Date
  updatedAt: Date
}

type AssignmentSubmissionRecord = {
  id: string
  assignmentId: string
  studentId: string
  content: string | null
  score: number | null
  feedback: string | null
  submittedAt: Date
  gradedAt: Date | null
}

type StudentClassRecord = {
  id: string
  studentId: string
  classId: string
}

const assignmentModel = prisma.assignment
const submissionModel = prisma.assignmentSubmission
const classSubjectModel = prisma.classSubject
const studentClassModel = prisma.studentClass
const router = Router()

// 1. POST /create - 老师创建作业
router.post('/create', async (request, response) => {
  try {
    if (!assignmentModel || !classSubjectModel) {
      response.status(500).json({ error: 'assignment or classSubject model unavailable' })
      return
    }
    const { classId, subject, teacherId, title, description, dueAt, questions } = request.body as {
      classId?: string
      subject?: string
      teacherId?: string
      title?: string
      description?: string
      dueAt?: string
      questions?: Array<{
        question?: string
        options?: string[]
        answer?: string
        topic?: string
        difficulty?: number
        chapter?: string
        questionType?: string
      }>
    }
    if (!classId || !subject || !teacherId || !title) {
      response.status(400).json({ error: 'classId, subject, teacherId and title required' })
      return
    }

    // 校验 teacher 角色
    const teacher = await prisma.user.findUnique({ where: { id: teacherId } }) as UserRecord | null
    if (!teacher || teacher.role !== 'teacher') {
      response.status(403).json({ error: 'only teacher can create assignment' })
      return
    }

    // 校验是班级认领老师（ClassSubject where classId+subject+teacherId 存在）
    const claim = await classSubjectModel.findFirst({
      where: { classId, subject, teacherId }
    }) as ClassSubjectRecord | null
    if (!claim) {
      response.status(403).json({ error: 'not the claimed teacher of this class subject' })
      return
    }

    const record = await assignmentModel.create({
      data: {
        classId,
        subject,
        teacherId,
        title,
        description: description ?? null,
        dueAt: dueAt ? new Date(dueAt) : null,
        status: 'open'
      }
    }) as AssignmentRecord

    // T-021：作业题目同步写 QuestionBank（source='assignment'，sourceRef=assignmentId）
    // body 有 questions 数组就用题目；没有则把作业 title 当一道 essay 题写入（保证"布置作业时题目同步进题库"）
    const bankModel = prisma.questionBank
    let ingested = 0
    let skipped = 0
    if (bankModel) {
      const questionList = Array.isArray(questions) && questions.length > 0
        ? questions.filter((q) => q && q.question && q.answer)
        : [{ question: title, answer: description ?? '见作业说明', questionType: 'essay' }]
      for (const q of questionList) {
        const hash = hashQuestion(q.question as string)
        try {
          const existing = await bankModel.findUnique({ where: { hash } })
          if (existing) { skipped++; continue }
          await bankModel.create({
            data: {
              teacherId,
              subject,
              topic: q.topic || q.chapter || '作业',
              difficulty: q.difficulty ?? 3,
              question: q.question as string,
              answer: q.answer as string,
              options: q.options ? JSON.stringify(q.options) : null,
              source: 'assignment',
              sourceRef: record.id,
              chapter: q.chapter ?? null,
              questionType: q.questionType || (q.options && q.options.length > 0 ? 'single' : 'essay'),
              hash
            }
          })
          ingested++
        } catch {
          skipped++
        }
      }
    }

    response.status(201).json({ assignmentId: record.id, status: record.status, bankIngested: ingested, bankSkipped: skipped })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'create assignment failed' })
  }
})

// 2. GET /:classId/list - 获取班级所有作业
router.get('/:classId/list', async (request, response) => {
  try {
    if (!assignmentModel) {
      response.status(500).json({ error: 'assignment model unavailable' })
      return
    }
    const classId = request.params.classId.trim()
    const records = await assignmentModel.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' }
    }) as AssignmentRecord[]

    response.json({
      assignments: records.map((a) => ({
        id: a.id,
        classId: a.classId,
        subject: a.subject,
        teacherId: a.teacherId,
        title: a.title,
        description: a.description,
        dueAt: a.dueAt,
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list assignments failed' })
  }
})

// 3. POST /:assignmentId/submit - 学生提交作业（upsert）
router.post('/:assignmentId/submit', async (request, response) => {
  try {
    if (!assignmentModel || !submissionModel || !studentClassModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const assignmentId = request.params.assignmentId.trim()
    const { studentId, content } = request.body as { studentId?: string; content?: string }
    if (!studentId || content === undefined) {
      response.status(400).json({ error: 'studentId and content required' })
      return
    }

    // 校验 student 角色
    const student = await prisma.user.findUnique({ where: { id: studentId } }) as UserRecord | null
    if (!student || student.role !== 'student') {
      response.status(403).json({ error: 'only student can submit assignment' })
      return
    }

    // 校验作业存在
    const assignment = await assignmentModel.findUnique({ where: { id: assignmentId } }) as AssignmentRecord | null
    if (!assignment) {
      response.status(404).json({ error: 'assignment not found' })
      return
    }

    // 校验是该班学生（StudentClass where studentId+classId=assignment.classId 存在）
    const membership = await studentClassModel.findUnique({
      where: { studentId_classId: { studentId, classId: assignment.classId } }
    }) as StudentClassRecord | null
    if (!membership) {
      response.status(403).json({ error: 'student is not a member of this class' })
      return
    }

    // upsert 提交
    const submission = await submissionModel.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: {
        assignmentId,
        studentId,
        content,
        submittedAt: new Date()
      },
      update: {
        content,
        submittedAt: new Date()
      }
    }) as AssignmentSubmissionRecord

    response.status(201).json({ submissionId: submission.id })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'submit assignment failed' })
  }
})

// 4. POST /:assignmentId/grade - 老师批改打分 + 触发通知
router.post('/:assignmentId/grade', async (request, response) => {
  try {
    if (!assignmentModel || !submissionModel) {
      response.status(500).json({ error: 'models unavailable' })
      return
    }
    const assignmentId = request.params.assignmentId.trim()
    const { teacherId, studentId, score, feedback } = request.body as {
      teacherId?: string
      studentId?: string
      score?: number
      feedback?: string
    }
    if (!teacherId || !studentId || score === undefined) {
      response.status(400).json({ error: 'teacherId, studentId and score required' })
      return
    }

    // 校验作业存在
    const assignment = await assignmentModel.findUnique({ where: { id: assignmentId } }) as AssignmentRecord | null
    if (!assignment) {
      response.status(404).json({ error: 'assignment not found' })
      return
    }

    // 校验是布置人
    if (assignment.teacherId !== teacherId) {
      response.status(403).json({ error: 'only the assigning teacher can grade' })
      return
    }

    // 更新提交
    await submissionModel.update({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      data: {
        score,
        feedback: feedback ?? null,
        gradedAt: new Date()
      }
    })

    // 触发通知
    await createNotification({
      userId: studentId,
      type: 'assignment_graded',
      title: '作业已批改',
      content: `作业「${assignment.title}」已批改，得分：${score}`,
      payload: {
        assignmentId,
        score,
        feedback: feedback ?? null,
        wechatTemplate: {
          miniprogram: { pagepath: 'pages/parent/notifications/notifications' }
        }
      }
    })

    response.json({ success: true })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'grade assignment failed' })
  }
})

// 5. GET /:assignmentId/submissions - 老师查所有提交
router.get('/:assignmentId/submissions', async (request, response) => {
  try {
    if (!submissionModel) {
      response.status(500).json({ error: 'submission model unavailable' })
      return
    }
    const assignmentId = request.params.assignmentId.trim()
    const records = await submissionModel.findMany({
      where: { assignmentId },
      orderBy: { submittedAt: 'desc' }
    }) as AssignmentSubmissionRecord[]

    // 查学生姓名
    const studentIds = Array.from(new Set(records.map((r) => r.studentId)))
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true }
    }) as { id: string; name: string | null }[]
    const nameMap = new Map(students.map((s) => [s.id, s.name]))

    response.json({
      submissions: records.map((s) => ({
        id: s.id,
        assignmentId: s.assignmentId,
        studentId: s.studentId,
        studentName: nameMap.get(s.studentId) ?? null,
        content: s.content,
        score: s.score,
        feedback: s.feedback,
        submittedAt: s.submittedAt,
        gradedAt: s.gradedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list submissions failed' })
  }
})

// 6. GET /student/:studentId/grades - 学生/家长查成绩
router.get('/student/:studentId/grades', async (request, response) => {
  try {
    if (!submissionModel) {
      response.status(500).json({ error: 'submission model unavailable' })
      return
    }
    const studentId = request.params.studentId.trim()
    const records = await submissionModel.findMany({
      where: { studentId, score: { not: null } },
      orderBy: { gradedAt: 'desc' }
    }) as AssignmentSubmissionRecord[]

    // 查作业标题
    const assignmentIds = Array.from(new Set(records.map((r) => r.assignmentId)))
    const assignments = assignmentIds.length > 0
      ? await assignmentModel?.findMany({ where: { id: { in: assignmentIds } } }) as AssignmentRecord[] ?? []
      : []
    const titleMap = new Map(assignments.map((a) => [a.id, a.title]))

    response.json({
      grades: records.map((s) => ({
        submissionId: s.id,
        assignmentId: s.assignmentId,
        assignmentTitle: titleMap.get(s.assignmentId) ?? null,
        score: s.score,
        feedback: s.feedback,
        submittedAt: s.submittedAt,
        gradedAt: s.gradedAt
      }))
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'list grades failed' })
  }
})

export default router
