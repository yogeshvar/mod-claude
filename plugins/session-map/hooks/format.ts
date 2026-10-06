export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  if (max <= 1) return '…'
  return `${t.slice(0, max - 1)}…`
}

export function relPath(root: string, abs: string): string {
  const r = root.replace(/\/+$/, '')
  if (abs === r) return '.'
  if (abs.startsWith(`${r}/`)) return abs.slice(r.length + 1)
  return abs
}
