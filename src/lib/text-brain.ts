import { createAliClient } from './openai-client.js'

type ChatMessage = {
  role: string
  content: string
}

const jsonSystemMessage: ChatMessage = {
  role: 'system',
  content: '你是一个 K12 教育规划助手。所有输出必须为中文，JSON 字段值也必须用中文。不要输出英文。'
}

export async function chat(messages: ChatMessage[], jsonMode?: boolean): Promise<unknown> {
  if (!process.env.DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY 未配置')
  }

  const model = process.env.TEXT_MODEL || 'qwen-plus'
  const finalMessages = jsonMode ? [jsonSystemMessage, ...messages] : messages
  const response = await createAliClient().chat.completions.create({
    model,
    messages: finalMessages as never,
    response_format: jsonMode ? ({ type: 'json_object' } as never) : undefined
  })
  const content = response.choices[0]?.message?.content || ''
  if (jsonMode) {
    try {
      return JSON.parse(content)
    } catch {
      return content
    }
  }
  return content
}
