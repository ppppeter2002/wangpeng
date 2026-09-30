import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { code2Session, genInviteCode } from '../lib/wx.js'

const router = Router()

type UserRecord = {
  id: string
  role: string
  name: string | null
  openid: string | null
  wxNickname: string | null
  phone: string | null
}

type StudentRankRecord = {
  tier: string
  score: number
  districtId: string | null
}

// 1. POST /api/wx/login - 微信登录，按 openid 建/查 User
router.post('/login', async (request, response) => {
  try {
    const { code, role, phone } = request.body as {
      code?: string
      role?: string
      phone?: string
    }
    if (!code) {
      response.status(400).json({ error: 'code required' })
      return
    }

    let openid: string
    try {
      const sess = await code2Session(code)
      openid = sess.openid
    } catch (wxErr) {
      // 没配 WX_APPID/WX_SECRET 或微信接口失败 → 走 mock 用户（不崩）
      const msg = wxErr instanceof Error ? wxErr.message : String(wxErr)
      console.log(`[wx-login-mock] reason=${msg}, use mock openid`)
      openid = `mock_${code.slice(0, 16)}`
    }

    // 按 openid 查 User
    let user = await prisma.user.findUnique({ where: { openid } }) as UserRecord | null

    if (!user) {
      // 新建用户
      const inviteCode = genInviteCode()
      const createData = {
        openid,
        role: role || 'student',
        name: `wx_${openid.slice(-6)}`,
        wxNickname: `wx_${openid.slice(-6)}`,
        inviteCode,
        ...(phone ? { phone } : {})
      }
      user = await prisma.user.create({ data: createData }) as UserRecord
    } else if (phone && user.phone !== phone) {
      // 已有用户但手机号变更 → 更新
      user = await prisma.user.update({
        where: { id: user.id },
        data: { phone }
      }) as UserRecord
    }

    response.json({
      userId: user.id,
      role: user.role,
      openid: user.openid,
      nickname: user.wxNickname ?? user.name,
      phone: user.phone,
      token: user.id // 简版：用 userId 当 token，前端存 storage
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'wx login failed' })
  }
})

// 2. GET /api/wx/me - 查用户信息（角色/段位/绑定关系）
router.get('/me', async (request, response) => {
  try {
    const userId = request.query.userId ? String(request.query.userId) : ''
    if (!userId) {
      response.status(400).json({ error: 'userId required' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId } }) as UserRecord | null
    if (!user) {
      response.status(404).json({ error: 'user not found' })
      return
    }

    // 查段位（学生才有）
    let rank: StudentRankRecord | null = null
    if (user.role === 'student' && prisma.studentRank) {
      rank = await prisma.studentRank.findUnique({ where: { studentId: userId } }) as StudentRankRecord | null
    }

    // 查绑定的家长/学生
    let parents: unknown[] = []
    let students: unknown[] = []
    if (prisma.studentParent) {
      if (user.role === 'student') {
        parents = await prisma.studentParent.findMany({ where: { studentId: userId } }) as unknown[]
      } else if (user.role === 'parent') {
        students = await prisma.studentParent.findMany({ where: { parentId: userId } }) as unknown[]
      }
    }

    response.json({
      userId: user.id,
      role: user.role,
      name: user.name,
      nickname: user.wxNickname,
      phone: user.phone,
      openid: user.openid,
      rank: rank ? { tier: rank.tier, score: rank.score, districtId: rank.districtId } : null,
      parents,
      students
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'get me failed' })
  }
})

export default router
