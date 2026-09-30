export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''

  for (let index = 0; index < 8; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }

  return code
}

export function isValidInviteCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code)
}
