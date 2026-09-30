import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const plans = [
    { code: 'basic', name: '基础会员', priceMonth: 3900, contentPack: '[]', photoPerDay: 0, voiceMinPerDay: 0, ttsCharPerDay: 0 },
    { code: 'standard', name: '标准会员', priceMonth: 5900, contentPack: '["hunzhi","mingchao"]', photoPerDay: 2, voiceMinPerDay: 0, ttsCharPerDay: 0, imageEnabled: true },
    { code: 'pro', name: '全能会员', priceMonth: 12900, contentPack: '["hunzhi","mingchao","douyin_edukit"]', photoPerDay: 10, voiceMinPerDay: 30, ttsCharPerDay: 5000, imageEnabled: true, voiceEnabled: true, ttsEnabled: true },
    { code: 'teacher_plus', name: '教师提效', priceMonth: 0, contentPack: '[]', isEducational: false, summary: '学校或机构采购占位方案，个人老师当前不收费' },
    { code: 'school', name: '学校版', priceMonth: 0, contentPack: '[]', isEducational: true }
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan
    })
  }

  console.log('Seed done: 5 plans created')
}

main().catch(console.error).finally(() => prisma.$disconnect())
