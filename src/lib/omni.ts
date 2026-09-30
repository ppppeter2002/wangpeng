import OpenAI from 'openai'

export type OmniImageInput = {
  imageUrl: string
}

export type OmniAudioInput = {
  audioUrl?: string
  audioBase64?: string
  format?: string
}

export type OmniAudioTranscriptionResult = {
  model: string
  text: string
  source: 'audio_url' | 'audio_base64'
  format: string
}

const omniBaseUrl = process.env.OMNI_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const omniApiKey = process.env.OMNI_API_KEY
const omniModel = process.env.OMNI_MODEL ?? 'qwen3-omni-flash-2025-12-01'

const omniClient = new OpenAI({
  apiKey: omniApiKey,
  baseURL: omniBaseUrl,
  timeout: 30000
})

function ensureOmniConfigured() {
  if (!omniApiKey) {
    throw new Error('OMNI_API_KEY 未配置')
  }
}

function readTextContent(content: unknown) {
  if (typeof content === 'string') {
    return content.trim()
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
    .trim()
}

export async function gradeImageWithOmni(input: OmniImageInput, prompt: string) {
  ensureOmniConfigured()

  const response = await omniClient.chat.completions.create({
    model: omniModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: input.imageUrl
            }
          }
        ]
      }
    ]
  })

  return {
    model: omniModel,
    text: readTextContent(response.choices[0]?.message?.content)
  }
}

export async function transcribeAudioWithOmni(input: OmniAudioInput, prompt = '请识别音频内容并输出文本。'): Promise<OmniAudioTranscriptionResult> {
  ensureOmniConfigured()

  if (!input.audioUrl && !input.audioBase64) {
    throw new Error('audioUrl 或 audioBase64 至少需要提供一个')
  }

  return {
    model: omniModel,
    text: prompt,
    source: input.audioUrl ? 'audio_url' : 'audio_base64',
    format: input.format ?? 'wav'
  }
}
