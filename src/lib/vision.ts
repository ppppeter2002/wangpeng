import { createAliClient } from './openai-client.js'

function readVisionContent(content: unknown) {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return ''
      }

      const candidate = item as Record<string, unknown>
      return typeof candidate.text === 'string' ? candidate.text : ''
    })
    .join('\n')
}

export async function analyzeImage(imageUrl: string, prompt: string): Promise<string> {
  if (!process.env.DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY 未配置')
  }

  const model = process.env.VISION_MODEL || 'qwen3-omni-flash-2025-12-01'
  const response = await createAliClient().chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: prompt }
        ]
      }
    ] as never,
    max_tokens: 2048
  })

  return readVisionContent(response.choices[0]?.message?.content)
}
