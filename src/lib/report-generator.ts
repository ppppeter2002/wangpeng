import { chat } from './text-brain.js'

export async function generateStudentReport(diagnosis: unknown, plan: unknown): Promise<unknown> {
  const prompt = `
你是学生端报告生成器。用鼓励的语气，面向 K12 学生。
诊断摘要：${JSON.stringify(diagnosis)}
补课方案：${JSON.stringify(plan)}
请生成 JSON：
{
  "summary": "一段话总结本次诊断结果，语气像老师在鼓励你",
  "highlights": ["做得好的点1", "做得好的点2"],
  "focusAreas": ["需要加强的点1", "需要加强的点2"],
  "nextStep": "下一步建议（一句话）"
}
全部用中文。
`

  return chat([{ role: 'user', content: prompt }], true)
}

export async function generateParentReport(diagnosis: unknown, plan: unknown): Promise<unknown> {
  const prompt = `
你是家长端报告生成器。面向关心孩子学习的家长，语气专业、客观、不带情绪。
诊断摘要：${JSON.stringify(diagnosis)}
补课方案：${JSON.stringify(plan)}
请生成 JSON：
{
  "summary": "孩子本次学习情况概述（2-3句话）",
  "weakSubjects": [{"subject":"科目","weakness":"薄弱点描述"}],
  "progressTrend": "与上次对比的趋势描述",
  "suggestion": "家长可以做的具体建议（如陪伴方式、提问方式）",
  "costEstimate": "本月预估算力消耗（人民币）"
}
全部用中文。
`

  return chat([{ role: 'user', content: prompt }], true)
}

export async function generateTeacherReport(diagnosis: unknown, plan: unknown): Promise<unknown> {
  const prompt = `
你是教师端报告生成器。面向授课教师，语气专业、简洁、直接。
诊断摘要：${JSON.stringify(diagnosis)}
补课方案：${JSON.stringify(plan)}
请生成 JSON：
{
  "summary": "学情概述",
  "classImpact": "该生薄弱点对班级教学的影响（如多人有同类问题需集体复习）",
  "teachingAdvice": ["教学建议1", "教学建议2"],
  "homeworkSuggestion": "针对性作业建议"
}
全部用中文。
`

  return chat([{ role: 'user', content: prompt }], true)
}
