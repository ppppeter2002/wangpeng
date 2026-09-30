import OpenAI from 'openai'

export function createAliClient() {
  return new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY || 'missing-dashscope-api-key',
    baseURL: process.env.ALI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    timeout: 30000
  })
}
