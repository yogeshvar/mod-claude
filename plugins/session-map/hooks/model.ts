export const PANE = 'session-map'

export type FileKind = 'read' | 'edit' | 'write' | 'glob'

export type FileHit = {
  path: string
  rel: string
  group: string
  kind: FileKind
  hits: number
}

const RANK: Record<FileKind, number> = { glob: 0, read: 1, edit: 2, write: 3 }

export function groupOf(rel: string): string {
  const parts = rel.split('/').filter(part => part && part !== '.')
  if (parts.length === 0) return 'root'
  if ((parts[0] === 'apps' || parts[0] === 'packages') && parts[1]) {
    return `${parts[0]}/${parts[1]}`
  }
  if (parts.length === 1) return 'root'
  return parts[0] ?? 'root'
}

export function stronger(a: FileKind, b: FileKind): FileKind {
  return RANK[a] >= RANK[b] ? a : b
}

export function putHit(files: FileHit[], next: FileHit): FileHit[] {
  const i = files.findIndex(row => row.path === next.path)
  if (i === -1) return [...files, next]
  const prev = files[i]
  if (!prev) return [...files, next]
  const copy = files.slice()
  copy[i] = {
    ...prev,
    kind: stronger(prev.kind, next.kind),
    hits: prev.hits + next.hits,
    rel: next.rel || prev.rel,
    group: next.group || prev.group,
  }
  return copy
}

export type Group = { name: string; files: FileHit[] }

export function groupsOf(files: FileHit[]): Group[] {
  const names: string[] = []
  const by = new Map<string, FileHit[]>()
  for (const file of files) {
    const list = by.get(file.group)
    if (list) list.push(file)
    else {
      names.push(file.group)
      by.set(file.group, [file])
    }
  }
  names.sort((a, b) => {
    if (a === 'root') return 1
    if (b === 'root') return -1
    return a.localeCompare(b)
  })
  return names.map(name => ({
    name,
    files: (by.get(name) ?? []).slice().sort((a, b) => a.rel.localeCompare(b.rel)),
  }))
}

export function statusLine(files: FileHit[]): string {
  if (files.length === 0) return 'map: no files yet'
  const groups = groupsOf(files)
  const top = groups
    .slice(0, 3)
    .map(group => `${group.name} ${group.files.length}`)
    .join(' · ')
  return `map: ${files.length} files · ${top}`
}
