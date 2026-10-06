export type Kit = {
  skills: number
  agents: number
  plugins: string[]
  instructions: string[]
  lastSkill?: string
}

export function emptyKit(): Kit {
  return { skills: 0, agents: 0, plugins: [], instructions: [] }
}

export function pluginsFromSettings(settings: Record<string, unknown>): string[] {
  const enabled = settings.enabledPlugins
  if (!enabled || typeof enabled !== 'object' || Array.isArray(enabled)) return []
  const names: string[] = []
  for (const [id, on] of Object.entries(enabled as Record<string, unknown>)) {
    if (on !== true) continue
    const name = id.split('@')[0]
    if (name) names.push(name)
  }
  return names
}

export function instructionNames(files: Array<{ path?: string; name?: string }>): string[] {
  const names = new Set<string>()
  for (const file of files) {
    const base = (file.name ?? file.path ?? '').split('/').pop() ?? ''
    if (base === 'CLAUDE.md' || base === 'AGENTS.md') names.add(base)
  }
  return [...names].sort()
}

export function mergeNames(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])].sort()
}

export function kitLine(kit: Kit): string {
  const bits: string[] = []
  if (kit.skills > 0) bits.push(`skills ${kit.skills}`)
  if (kit.agents > 0) bits.push(`agents ${kit.agents}`)
  if (kit.instructions.length > 0) bits.push(kit.instructions.join(', '))
  if (kit.plugins.length > 0) {
    const shown = kit.plugins.slice(0, 4)
    const extra = kit.plugins.length > 4 ? '…' : ''
    bits.push(`plugins ${shown.join(', ')}${extra}`)
  }
  if (kit.lastSkill) bits.push(`last ${kit.lastSkill}`)
  return bits.join(' · ')
}
