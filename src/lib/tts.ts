export async function synthesize(text: string): Promise<Buffer> {
  if (!process.env.DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY 未配置')
  }

  return Buffer.from(text, 'utf-8')
}
