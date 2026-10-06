export function short(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  if (max <= 1) return '…'
  return `${t.slice(0, max - 1)}…`
}

export function pad(text: string, width: number): string {
  const t = clip(text, width)
  return t.length >= width ? t : t + ' '.repeat(width - t.length)
}

export function bar(percent: number, width: number): string {
  const w = Math.max(4, width)
  const p = Math.max(0, Math.min(100, percent))
  const filled = Math.round((p / 100) * w)
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, w - filled))}`
}

export function mark(status: string): string {
  if (status === 'running') return '◐'
  if (status === 'completed') return '●'
  if (status === 'failed' || status === 'error' || status === 'refusal') return '✗'
  if (status === 'killed' || status === 'aborted') return '○'
  return '·'
}

export function tone(status: string): string {
  if (status === 'running') return 'cyan'
  if (status === 'completed') return 'green'
  if (status === 'failed' || status === 'error' || status === 'refusal') return 'red'
  if (status === 'killed' || status === 'aborted') return 'yellow'
  return 'white'
}

export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

export function fillTone(percent: number | undefined): string {
  if (percent == null) return 'white'
  if (percent >= 90) return 'red'
  if (percent >= 75) return 'magenta'
  if (percent >= 50) return 'yellow'
  return 'green'
}
