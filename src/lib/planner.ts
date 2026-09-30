import { chat } from './text-brain.js'

export interface WeakPoint {
  subject: string
  topic: string
  reason: string
  severity?: number
}

export async function generateRemedyPlan(studentId: string, weakPoints: WeakPoint[]): Promise<unknown> {
  const prompt = `
学生编号：${studentId}
学生薄弱点：${JSON.stringify(weakPoints)}
请生成一份 60 分钟补课方案。要求：
1. 按薄弱点严重程度排序，逐个击破
2. 每个知识点分配 15-20 分钟
3. 每步包含：标题、时长（分钟）、方法（讲解/练习/回顾）、资源提示（如"参考课本第3章"）
4. 输出 JSON 格式：{"steps": [{"step":1,"title":"","durationMin":15,"method":"讲解","resourceHint":""}]}
5. 全部用中文
`

  return chat([
    { role: 'user', content: prompt }
  ], true)
}

export async function generatePreviewPlan(studentId: string, subject: string, nextTopic: string): Promise<unknown> {
  const prompt = `
学生编号：${studentId}
学生即将学习：${subject} - ${nextTopic}
请生成一份 20 分钟课前预习方案。要求：
1. 时长不超过 20 分钟
2. 包含：快速浏览（5分钟）、核心概念标记（10分钟）、疑问记录（5分钟）
3. 输出 JSON 格式：{"steps": [{"step":1,"title":"","durationMin":5,"method":"快速浏览","resourceHint":""}]}
4. 全部用中文
`

  return chat([
    { role: 'user', content: prompt }
  ], true)
}
