import express from 'express'
import prisma from './lib/prisma.js'
import billingRoutes from './routes/billing.js'
import chatRoutes from './routes/chat.js'
import classRoutes from './routes/class.js'
import classSubjectRoutes from './routes/class-subject.js'
import commissionRoutes from './routes/commission.js'
import inviteRoutes from './routes/invite.js'
import lessonPlanRoutes from './routes/lesson-plan.js'
import marketRoutes from './routes/market.js'
import districtRoutes from './routes/district.js'
import studentRoutes from './routes/student.js'
import notificationRoutes from './routes/notification.js'
import parentRoutes from './routes/parent.js'
import assignmentRoutes from './routes/assignment.js'
import rankRoutes from './routes/rank.js'
import bankRoutes from './routes/bank.js'
import pkRoutes from './routes/pk.js'
import seasonRoutes from './routes/season.js'
import aiRoutes from './routes/ai.js'
import wxRoutes from './routes/wx.js'
import photoRoutes from './routes/photo.js'
import planRoutes from './routes/plan.js'
import reportRoutes from './routes/report.js'
import schoolRoutes from './routes/school.js'
import teacherRoutes from './routes/teacher.js'
import voiceRoutes from './routes/voice.js'
import healthRoutes from './routes/health.js'
import { diagnose, type WeakPoint } from './lib/deepseek.js'

type DiagnosisRequestBody = {
  studentId?: string
  subject?: string
  rawText?: string
}

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(express.json({ limit: '10mb' }))
app.use('/api/billing', billingRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/voice', voiceRoutes)
app.use('/api/photo', photoRoutes)
app.use('/api/plan', planRoutes)
app.use('/api/report', reportRoutes)
app.use('/api/auth', inviteRoutes)
app.use('/api/invite', inviteRoutes)
app.use('/api/class', classRoutes)
app.use('/api/school', schoolRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/class-subject', classSubjectRoutes)
app.use('/api/commission', commissionRoutes)
app.use('/api/lesson-plan', lessonPlanRoutes)
app.use('/api/market', marketRoutes)
app.use('/api/district', districtRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/notification', notificationRoutes)
app.use('/api/parent', parentRoutes)
app.use('/api/assignment', assignmentRoutes)
app.use('/api/rank', rankRoutes)
app.use('/api/bank', bankRoutes)
app.use('/api/pk', pkRoutes)
app.use('/api/season', seasonRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/wx', wxRoutes)
app.use('/api/health', healthRoutes)

function isValidSubject(subject: string) {
  return ['math', 'chinese', 'english'].includes(subject)
}

function parseWeakPoints(weakPoints: string): WeakPoint[] {
  return JSON.parse(weakPoints) as WeakPoint[]
}

app.get('/', (_request, response) => {
  response.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>smart-tutor</title>
  </head>
  <body>
    <main>
      <h1>smart-tutor</h1>
      <ul>
        <li><code>POST /api/school/create</code></li>
        <li><code>GET /api/school/:schoolId/classes</code></li>
        <li><code>POST /api/school/join</code></li>
        <li><code>POST /api/class-subject/assign</code></li>
        <li><code>POST /api/class-subject/challenge</code></li>
        <li><code>POST /api/class-subject/vote</code></li>
        <li><code>GET /api/class-subject/:classSubId/challenge</code></li>
      </ul>
    </main>
  </body>
</html>`)
})

app.post('/api/diagnosis', async (request, response) => {
  const body = request.body as DiagnosisRequestBody
  const studentId = body.studentId?.trim()
  const subject = body.subject?.trim().toLowerCase()
  const rawText = body.rawText?.trim()

  if (!studentId || !subject || !rawText) {
    response.status(400).json({ ok: false, error: 'studentId, subject and rawText are required' })
    return
  }

  if (!isValidSubject(subject)) {
    response.status(400).json({ ok: false, error: 'subject must be one of math, chinese, english' })
    return
  }

  try {
    const weakPoints = await diagnose(rawText, subject)
    const session = await prisma.diagnosisSession.create({
      data: {
        studentId,
        subject,
        rawText,
        weakPoints: JSON.stringify(weakPoints)
      }
    })

    response.json({ sessionId: session.id, weakPoints })
  } catch (error) {
    response.status(500).json({ ok: false, error: String(error) })
  }
})

app.get('/api/diagnosis/:studentId', async (request, response) => {
  const studentId = request.params.studentId.trim()

  try {
    const sessions = await prisma.diagnosisSession.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' }
    })

    response.json({
      studentId,
      sessions: sessions.map((session) => ({
        id: session.id,
        studentId: session.studentId,
        subject: session.subject,
        imageUrl: session.imageUrl,
        rawText: session.rawText,
        createdAt: session.createdAt,
        weakPoints: parseWeakPoints(session.weakPoints),
        planId: session.planId
      }))
    })
  } catch (error) {
    response.status(500).json({ ok: false, error: String(error) })
  }
})

app.listen(port, () => {
  console.log(`smart-tutor listening on http://localhost:${port}`)
})
