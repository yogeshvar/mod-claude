export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  if (max <= 1) return '…'
  return `${t.slice(0, max - 1)}…`
}

export function short(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m >= 10 ? Math.round(m) : +m.toFixed(1)}M`
  }
  if (n >= 1_000) {
    const k = n / 1_000
    return `${k >= 100 ? Math.round(k) : +k.toFixed(1)}k`
  }
  return String(Math.round(n))
}

export function fillTone(percent: number | undefined): string {
  if (percent == null) return '#68d391'
  if (percent >= 90) return '#fc8181'
  if (percent >= 75) return '#ed8936'
  if (percent >= 50) return '#ecc94b'
  return '#68d391'
}

export type SliceStyle = { label: string; color: string; match: RegExp }

export const SLICE_STYLES: SliceStyle[] = [
  { label: 'system prompt', color: '#6ea8ff', match: /system prompt|^prompt$/i },
  { label: 'tools', color: '#5ad0e8', match: /system tools|^tools$/i },
  { label: 'mcp tools', color: '#b794f6', match: /mcp/i },
  { label: 'agents', color: '#68d391', match: /agent/i },
  { label: 'memory files', color: '#ecc94b', match: /memory/i },
  { label: 'skills', color: '#f687b3', match: /skill/i },
  { label: 'messages', color: '#ed8936', match: /message/i },
  { label: 'slash commands', color: '#63b3ed', match: /slash|command/i },
]

export const FREE_COLOR = '#4a5568'
export const TICK_COLOR = '#ecc94b'

export function styleOf(name: string): SliceStyle {
  return SLICE_STYLES.find(style => style.match.test(name)) ?? {
    label: name.toLowerCase(),
    color: '#a0aec0',
    match: /$^/,
  }
}
