// 腾讯混元 AI 出题（OpenAI 兼容接口）
// 默认走腾讯混元 Ark 官方端点；可用环境变量切换到 OpenAI 兼容代理
export const HUNYUAN_BASE_URL = process.env.HUNYUAN_BASE_URL || 'https://api.hunyuan.cloud.tencent.com/v1'
export const HUNYUAN_MODEL = process.env.HUNYUAN_MODEL || 'hunyuan-turbos-latest'

export type Q = {
  question: string
  options?: string[]
  answer: string
  explanation?: string
  subject: string
  topic: string
  difficulty: number // 1~5
}

export async function generateQuestions(opts: {
  subject: string
  topic: string
  difficulty?: number
  count?: number
  mode?: 'promotion' | 'pk-timed' | 'pk-buzz' | 'tutor'
}): Promise<Q[]> {
  const count = opts.count ?? 5
  const difficulty = opts.difficulty ?? 3

  const systemPrompt = [
    '你是一个中小学题库生成器。只输出 JSON，不要解释。',
    '格式：{ "questions": [ { "question":"", "options":["A. 选项1","B. 选项2","C. 选项3","D. 选项4"], "answer":"A", "explanation":"", "subject":"", "topic":"", "difficulty":3 } ] }',
    '选择题 options 必须带选项字母前缀（如 "A. 内容"），answer 只填字母（如 "A"）；简答题 options 为空数组 []。',
    'difficulty 为 1~5 的整数。',
  ].join('\n')

  const userPrompt = [
    `学科=${opts.subject}`,
    `知识点=${opts.topic}`,
    `难度=${difficulty}/5`,
    `数量=${count}`,
    opts.mode === 'pk-timed' ? '用于PK限时答题，题目要适合同段位小学生/初中生，表述清楚。' :
    opts.mode === 'pk-buzz' ? '用于PK抢答，题目要短、卡点明确、答案唯一。' :
    opts.mode === 'tutor' ? '用于AI辅导场景，每题必须给出详尽易懂的讲解（explanation 字段不少于 60 字），让学生看完能学会。' :
    '用于晋级弱项测试，围绕该学生的薄弱知识点出针对性题。',
  ].join('\n')

  const apiKey = process.env.HUNYUAN_API_KEY
  if (!apiKey) throw new Error('NO_HUNYUAN_KEY')

  const maxTokens = Number(process.env.HUNYUAN_MAX_TOKENS ?? 4000)

  const resp = await fetch(`${HUNYUAN_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: HUNYUAN_MODEL,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!resp.ok) throw new Error(`HUNYUAN_HTTP_${resp.status}`)
  const data = await resp.json() as { choices?: { message?: { content?: string } }[] }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('EMPTY_RESPONSE')

  const parsed = JSON.parse(content) as { questions?: Q[] }
  const list: Q[] = parsed.questions ?? []
  if (!Array.isArray(list) || list.length === 0) throw new Error('EMPTY_QUESTIONS')
  return list.slice(0, count)
}

// 多轮辅导对话：调混元 Hy3，带 history（最近 6 轮），prompt 角色为"中小学辅导老师"
// 无 HUNYUAN_API_KEY 时抛 NO_HUNYUAN_KEY，由调用方兜底
export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function chatDialogue(opts: {
  message: string
  history?: ChatMessage[]
}): Promise<string> {
  const apiKey = process.env.HUNYUAN_API_KEY
  if (!apiKey) throw new Error('NO_HUNYUAN_KEY')

  // 只保留最近 6 轮（12 条）历史，避免 token 爆炸
  const trimmed = (opts.history ?? []).slice(-12)

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    {
      role: 'system',
      content:
        '你是一位耐心细致的中小学辅导老师，擅长用通俗的语言讲解数学、语文、英语、物理、化学等学科的知识点。' +
        '回答要分点清晰、举例贴切，针对学生的提问给予讲解而不直接给答案或出题。' +
        '若学生问的不是学习问题，礼貌引导回学习话题。回答控制在 300 字以内。',
    },
    ...trimmed.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: opts.message },
  ]

  const maxTokens = Number(process.env.HUNYUAN_MAX_TOKENS ?? 4000)
  const resp = await fetch(`${HUNYUAN_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: HUNYUAN_MODEL,
      temperature: 0.6,
      max_tokens: maxTokens,
      messages,
    }),
  })

  if (!resp.ok) throw new Error(`HUNYUAN_HTTP_${resp.status}`)
  const data = await resp.json() as { choices?: { message?: { content?: string } }[] }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('EMPTY_RESPONSE')
  return content.trim()
}
