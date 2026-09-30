// 微信小程序后端工具：code2Session + 用户查找/创建
// WX_APPID / WX_SECRET 由启动环境注入，不碰 .env

export type WxSession = {
  openid: string
  session_key: string
  unionid?: string
}

const WX_API_BASE = 'https://api.weixin.qq.com'

// 调微信 code2Session 接口，拿到 openid（5秒超时，超时走 mock）
export async function code2Session(code: string): Promise<WxSession> {
  const appid = process.env.WX_APPID
  const secret = process.env.WX_SECRET
  if (!appid || !secret) throw new Error('NO_WX_CONF')

  const url = `${WX_API_BASE}/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) throw new Error(`WX_HTTP_${resp.status}`)
    const data = await resp.json() as { openid?: string; session_key?: string; unionid?: string; errcode?: number; errmsg?: string }

    if (data.errcode && data.errcode !== 0) {
      throw new Error(`WX_ERR_${data.errcode}: ${data.errmsg ?? ''}`)
    }
    if (!data.openid) throw new Error('WX_NO_OPENID')

    return {
      openid: data.openid,
      session_key: data.session_key ?? '',
      unionid: data.unionid
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('WX_TIMEOUT')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// 生成唯一 inviteCode（6 位随机字母数字）
export function genInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}
