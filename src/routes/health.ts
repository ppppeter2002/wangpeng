import { Router } from 'express'
import prisma from '../lib/prisma.js'

const router = Router()

// GET /api/health - 健康检查（含 db/ai/timestamp，兼容旧字段 ok/service/runtimeProvider）
router.get('/', async (_request, response) => {
  const aiConfigured = Boolean(process.env.HUNYUAN_API_KEY)
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }
  response.json({
    status: 'ok',
    db: dbOk,
    ai: aiConfigured,
    timestamp: new Date().toISOString(),
    // 兼容字段（旧调用方仍可用）
    ok: true,
    service: 'smart-tutor',
    runtimeProvider: process.env.RUNTIME_AI_PROVIDER ?? 'dashscope',
    runtimeModel: process.env.RUNTIME_AI_MODEL ?? process.env.TEXT_MODEL ?? 'qwen-plus',
    builderModel: process.env.BUILDER_AI_MODEL ?? 'GPT-5.4',
    deepSeekConfigured: (process.env.DEEPSEEK_API_KEY ?? '').length > 0,
    dashscopeConfigured: Boolean(process.env.DASHSCOPE_API_KEY)
  })
})

// GET /api/health/db - 单独的数据库连通性检查
router.get('/db', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ connected: true, engine: 'sqlite' })
  } catch (error) {
    response.status(500).json({ connected: false, error: String(error) })
  }
})

export default router
