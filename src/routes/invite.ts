import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { ensureCommissionWallet } from '../lib/commission.js'
import prisma from '../lib/prisma.js'
import { generateInviteCode } from '../lib/invite-code.js'

type UserRecord = {
  id: string
  role: string
  name: string | null
  inviteCode: string
  invitedBy: string | null
  parentId: string | null
  classId: string | null
  schoolId?: string | null
}

type InviteLinkRecord = {
  id: string
  ownerId: string
  roleTarget: string
  code: string
  usedCount: number
}

type SchoolLookupRecord = {
  id: string
  name: string
}

type ClassLookupRecord = {
  id: string
  schoolId?: string | null
}

const router = Router()
const inviteRoles = ['parent', 'student'] as const
const registerRoles = ['teacher', 'parent', 'student'] as const
const schoolModel = prisma.school as NonNullable<typeof prisma.school>
const classModel = prisma.class as NonNullable<typeof prisma.class>
const classSubjectModel = prisma.classSubject

type InviteRole = typeof inviteRoles[number]
type RegisterRole = typeof registerRoles[number]

async function createUniqueInviteCode() {
  while (true) {
    const code = generateInviteCode()
    const existingUser = await prisma.user.findFirst({ where: { inviteCode: code } }) as UserRecord | null

    if (existingUser) {
      continue
    }

    const existingLink = await prisma.inviteLink?.findUnique({ where: { code } }) as InviteLinkRecord | null | undefined

    if (!existingLink) {
      return code
    }
  }
}

async function resolveStudentClass(params: {
  schoolName?: string
  className?: string
  subject?: string
}) {
  const { schoolName, className, subject } = params

  if (!schoolName || !className) {
    return { classId: null, schoolId: null, teacherId: null }
  }

  const normalizedSchoolName = schoolName.trim()
  const normalizedClassName = className.trim()
  const normalizedSubject = subject?.trim() ?? null

  if (!normalizedSchoolName || !normalizedClassName) {
    return { classId: null, schoolId: null, teacherId: null }
  }

  let school = await schoolModel.findFirst({ where: { name: normalizedSchoolName } }) as SchoolLookupRecord | null

  if (!school) {
    school = await schoolModel.create({
      data: {
        name: normalizedSchoolName
      } as never
    }) as SchoolLookupRecord
  }

  let classRecord = await classModel.findFirst({
    where: {
      name: normalizedClassName,
      schoolId: school.id
    } as never
  }) as ClassLookupRecord | null

  if (!classRecord) {
    classRecord = await classModel.create({
      data: {
        name: normalizedClassName,
        grade: null,
        schoolId: school.id
      } as never
    }) as ClassLookupRecord
  }

  let classSubjectTeacherId: string | null = null

  if (normalizedSubject && classSubjectModel) {
    const classSubject = await classSubjectModel.findUnique({
      where: {
        classId_subject: {
          classId: classRecord.id,
          subject: normalizedSubject
        }
      }
    }) as { teacherId: string } | null

    classSubjectTeacherId = classSubject?.teacherId ?? null
  }

  return {
    classId: classRecord.id,
    schoolId: school.id,
    teacherId: classSubjectTeacherId
  }
}

async function registerUser(requestBody: {
  role?: string
  name?: string
  phone?: string
  inviteCode?: string
  parentCode?: string
  classId?: string
  schoolName?: string
  className?: string
  subject?: string
}) {
  const { role, name, phone, inviteCode, parentCode, classId, schoolName, className, subject } = requestBody

  if (!role || !registerRoles.includes(role as RegisterRole)) {
    return { status: 400, body: { error: 'invalid role' } }
  }

  if (phone) {
    const existingPhone = await prisma.user.findFirst({ where: { phone } }) as UserRecord | null

    if (existingPhone) {
      return { status: 400, body: { error: 'phone already registered' } }
    }
  }

  if (role === 'teacher') {
    const userInviteCode = await createUniqueInviteCode()
    const createTeacherData: Prisma.UserUncheckedCreateInput = {
      role,
      name: name ?? null,
      phone: phone ?? null,
      inviteCode: userInviteCode
    }
    const user = await prisma.user.create({ data: createTeacherData }) as unknown as UserRecord

    return {
      status: 201,
      body: { userId: user.id, role: user.role, inviteCode: user.inviteCode }
    }
  }

  if (!inviteCode) {
    return { status: 400, body: { error: 'inviteCode required' } }
  }

  const inviteLink = await prisma.inviteLink?.findUnique({ where: { code: inviteCode } }) as InviteLinkRecord | null | undefined

  if (!inviteLink) {
    return { status: 400, body: { error: 'invite link not found' } }
  }

  const inviter = await prisma.user.findUnique({ where: { id: inviteLink.ownerId } }) as UserRecord | null

  if (!inviter) {
    return { status: 400, body: { error: 'inviter not found' } }
  }

  if (inviteLink.roleTarget !== role) {
    return { status: 400, body: { error: 'invite role mismatch' } }
  }

  if (role === 'parent') {
    if (inviter.role === 'student') {
      return { status: 400, body: { error: 'student cannot invite parent' } }
    }

    const userInviteCode = await createUniqueInviteCode()
    const createParentData: Prisma.UserUncheckedCreateInput = {
      role,
      name: name ?? null,
      phone: phone ?? null,
      inviteCode: userInviteCode,
      invitedBy: inviter.id
    }
    const user = await prisma.user.create({ data: createParentData }) as unknown as UserRecord
    await ensureCommissionWallet(user.id)

    await prisma.inviteLink?.update({
      where: { id: inviteLink.id },
      data: { usedCount: { increment: 1 } }
    })

    return {
      status: 201,
      body: { userId: user.id, role: user.role, inviteCode: user.inviteCode }
    }
  }

  if (!parentCode) {
    return { status: 400, body: { error: 'parentCode required' } }
  }

  const parent = await prisma.user.findFirst({ where: { inviteCode: parentCode } }) as UserRecord | null

  if (!parent || parent.role !== 'parent') {
    return { status: 400, body: { error: 'parent not found' } }
  }

  const childCount = await prisma.user.count({
    where: {
      parentId: parent.id,
      role: 'student'
    }
  })

  if (childCount >= 5) {
    return { status: 400, body: { error: 'parent child limit exceeded' } }
  }

  let resolvedClassId = classId ?? null
  let resolvedSchoolId: string | null = null
  let matchedTeacherId: string | null = null

  if (!resolvedClassId && (schoolName || className)) {
    const resolved = await resolveStudentClass({ schoolName, className, subject })
    resolvedClassId = resolved.classId
    resolvedSchoolId = resolved.schoolId
    matchedTeacherId = resolved.teacherId
  }

  if (resolvedClassId) {
    const classRecord = await classModel.findUnique({ where: { id: resolvedClassId } }) as ClassLookupRecord | null

    if (!classRecord) {
      return { status: 400, body: { error: 'class not found' } }
    }

    resolvedSchoolId = resolvedSchoolId ?? classRecord.schoolId ?? null
  }

  const userInviteCode = await createUniqueInviteCode()
  const createStudentData = {
    role,
    name: name ?? null,
    phone: phone ?? null,
    inviteCode: userInviteCode,
    invitedBy: inviter.id,
    parentId: parent.id,
    classId: resolvedClassId,
    schoolId: resolvedSchoolId
  }
  const user = await prisma.user.create({ data: createStudentData as Prisma.UserUncheckedCreateInput }) as unknown as UserRecord

  await prisma.inviteLink?.update({
    where: { id: inviteLink.id },
    data: { usedCount: { increment: 1 } }
  })

  return {
    status: 201,
    body: {
      userId: user.id,
      role: user.role,
      inviteCode: user.inviteCode,
      classId: user.classId,
      schoolId: user.schoolId ?? resolvedSchoolId,
      teacherId: matchedTeacherId
    }
  }
}

router.post('/link', async (request, response) => {
  try {
    const { userId, roleTarget } = request.body as { userId?: string; roleTarget?: string }

    if (!userId || !roleTarget) {
      response.status(400).json({ error: 'userId and roleTarget required' })
      return
    }

    if (!inviteRoles.includes(roleTarget as InviteRole)) {
      response.status(400).json({ error: 'invalid roleTarget' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId } }) as UserRecord | null

    if (!user) {
      response.status(404).json({ error: 'user not found' })
      return
    }

    if (roleTarget === 'parent' && !['teacher', 'parent'].includes(user.role)) {
      response.status(400).json({ error: 'only teacher or parent can invite parent' })
      return
    }

    if (roleTarget === 'student' && user.role !== 'parent') {
      response.status(400).json({ error: 'only parent can invite student' })
      return
    }

    const code = await createUniqueInviteCode()
    await prisma.inviteLink?.create({
      data: {
        ownerId: userId,
        roleTarget,
        code
      }
    })

    response.json({
      code,
      url: `https://yourdomain.com/register?invite=${code}`,
      roleTarget
    })
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Create invite link failed' })
  }
})

router.post('/auth/register', async (request, response) => {
  try {
    const result = await registerUser(request.body as {
      role?: string
      name?: string
      phone?: string
      inviteCode?: string
      parentCode?: string
      classId?: string
      schoolName?: string
      className?: string
      subject?: string
    })

    response.status(result.status).json(result.body)
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Register failed' })
  }
})

export default router
