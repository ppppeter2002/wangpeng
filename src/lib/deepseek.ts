import OpenAI from 'openai'

export type WeakPointSeverity = 'low' | 'medium' | 'high'

export type WeakPoint = {
  knowledgePoint: string
  confidence: number
  severity: WeakPointSeverity
}

const baseUrl = process.env.AI_BASE_URL ?? 'https://api.deepseek.com'
const apiKey = process.env.DEEPSEEK_API_KEY
const model = process.env.AI_MODEL ?? 'deepseek-v4-flash'

const openai = new OpenAI({
  apiKey,
  baseURL: baseUrl,
  timeout: 30000
})

const mockWeakPoints: WeakPoint[] = [
  { knowledgePoint: '分数通分', confidence: 0.85, severity: 'high' },
  { knowledgePoint: '分数加减法', confidence: 0.7, severity: 'medium' }
]

function extractJsonArray(content: string) {
  const trimmed = content.trim()
  const directMatch = trimmed.match(/\[[\s\S]*\]/)

  if (directMatch) {
    return directMatch[0]
  }

  throw new Error('DeepSeek 返回内容无法解析为 JSON 数组')
}

function normalizeWeakPoints(input: unknown): WeakPoint[] {
  if (!Array.isArray(input)) {
    throw new Error('返回结果不是数组')
  }

  return input.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`第 ${index + 1} 条结果不是对象`)
    }

    const candidate = item as Record<string, unknown>
    const knowledgePoint = typeof candidate.knowledgePoint === 'string' ? candidate.knowledgePoint.trim() : ''
    const confidence = typeof candidate.confidence === 'number' ? candidate.confidence : Number(candidate.confidence)
    const severity = candidate.severity

    if (!knowledgePoint) {
      throw new Error(`第 ${index + 1} 条结果缺少 knowledgePoint`)
    }

    if (Number.isNaN(confidence)) {
      throw new Error(`第 ${index + 1} 条结果的 confidence 非数字`)
    }

    if (severity !== 'low' && severity !== 'medium' && severity !== 'high') {
      throw new Error(`第 ${index + 1} 条结果的 severity 非法`)
    }

    return {
      knowledgePoint,
      confidence,
      severity
    }
  })
}

export async function diagnose(text: string, subject: string): Promise<WeakPoint[]> {
  if (process.env.USE_MOCK === 'true') {
    return mockWeakPoints
  }

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置')
  }

  const prompt = `你是K12教育诊断引擎。学生科目：${subject}。
学生错题描述：${text}

请分析学生的薄弱知识点，返回 JSON 数组，每个元素包含：
- knowledgePoint: 知识点名称
- confidence: 0到1之间的置信度
- severity: "low" | "medium" | "high"

只返回 JSON 数组，不要有其他文字。`

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    const content = response.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(extractJsonArray(content)) as unknown
    return normalizeWeakPoints(parsed)
  } catch (error) {
    throw new Error(`DeepSeek 返回 JSON 解析失败: ${String(error)}`)
  }
}
