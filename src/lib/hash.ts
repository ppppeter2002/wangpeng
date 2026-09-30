// 题目内容 hash（简单指纹，不引 crypto，避免 Node 版本差异）
// 取前 50 字符 + length + 首字母 charCode 拼接做指纹
// 同一道题（前 50 字符相同 + 长度相同 + 首字母相同）视为重复
export function hashQuestion(question: string): string {
  const text = String(question ?? '').trim()
  if (!text) return 'empty'
  const head = text.slice(0, 50)
  const len = text.length.toString(36)
  const first = text.charCodeAt(0).toString(36)
  return `${len}:${first}:${head}`
}
