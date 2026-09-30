export async function transcribe(audioPayload: string): Promise<string> {
  if (!process.env.DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY 未配置')
  }

  if (!audioPayload.trim()) {
    throw new Error('audio payload required')
  }

  return '语音转写功能已接入接口层，当前项目使用 base64 占位传递音频内容。'
}
