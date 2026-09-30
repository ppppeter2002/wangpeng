import crypto from 'crypto'

type StableTokenResponse = {
  access_token?: string
  expires_in?: number
  errcode?: number
  errmsg?: string
}

type TemplateSendResponse = {
  msgid?: number
  errcode?: number
  errmsg?: string
}

export type WechatTemplateMessage = {
  touser?: string
  templateId?: string
  url?: string
  miniprogram?: {
    appid?: string
    pagepath?: string
  }
  data?: Record<string, { value: string; color?: string }>
}

let cachedToken: { value: string; expiresAt: number } | null = null

function getServiceConfig() {
  return {
    appId: process.env.WX_SERVICE_APPID?.trim() || '',
    secret: process.env.WX_SERVICE_SECRET?.trim() || '',
    token: process.env.WX_SERVICE_TOKEN?.trim() || '',
    aesKey: process.env.WX_SERVICE_AES_KEY?.trim() || ''
  }
}

export function getWechatServiceStatus() {
  const config = getServiceConfig()
  return {
    appIdConfigured: Boolean(config.appId),
    secretConfigured: Boolean(config.secret),
    tokenConfigured: Boolean(config.token),
    aesKeyConfigured: Boolean(config.aesKey),
    readyForCallbackVerify: Boolean(config.token),
    readyForTemplateSend: Boolean(config.appId && config.secret)
  }
}

export async function getWechatServiceAccessToken(): Promise<string> {
  const { appId, secret } = getServiceConfig()
  if (!appId || !secret) {
    throw new Error('WECHAT_SERVICE_CONFIG_MISSING')
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credential',
      appid: appId,
      secret,
      force_refresh: false
    })
  })

  if (!response.ok) {
    throw new Error(`WECHAT_SERVICE_TOKEN_HTTP_${response.status}`)
  }

  const data = await response.json() as StableTokenResponse
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`WECHAT_SERVICE_TOKEN_ERR_${data.errcode}:${data.errmsg ?? ''}`)
  }
  if (!data.access_token) {
    throw new Error('WECHAT_SERVICE_TOKEN_EMPTY')
  }

  const expiresIn = data.expires_in ?? 7200
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (expiresIn - 120) * 1000
  }

  return data.access_token
}

export async function sendWechatTemplateMessage(message: WechatTemplateMessage): Promise<{
  msgId: string | null
}> {
  if (!message.touser) {
    throw new Error('WECHAT_TEMPLATE_TOUSER_MISSING')
  }
  if (!message.templateId) {
    throw new Error('WECHAT_TEMPLATE_ID_MISSING')
  }
  if (!message.data || Object.keys(message.data).length === 0) {
    throw new Error('WECHAT_TEMPLATE_DATA_MISSING')
  }

  const accessToken = await getWechatServiceAccessToken()
  const response = await fetch(`https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      touser: message.touser,
      template_id: message.templateId,
      url: message.url,
      miniprogram: message.miniprogram?.appid && message.miniprogram?.pagepath
        ? {
            appid: message.miniprogram.appid,
            pagepath: message.miniprogram.pagepath
          }
        : undefined,
      data: message.data
    })
  })

  if (!response.ok) {
    throw new Error(`WECHAT_TEMPLATE_HTTP_${response.status}`)
  }

  const data = await response.json() as TemplateSendResponse
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`WECHAT_TEMPLATE_ERR_${data.errcode}:${data.errmsg ?? ''}`)
  }

  return {
    msgId: typeof data.msgid === 'number' ? String(data.msgid) : null
  }
}

export function verifyWechatServiceSignature(signature: string, timestamp: string, nonce: string): boolean {
  const { token } = getServiceConfig()
  if (!token) {
    return false
  }
  const check = [token, timestamp, nonce].sort().join('')
  const digest = crypto.createHash('sha1').update(check).digest('hex')
  return digest === signature
}
