export const MAIN = 'main'
export const PANE = 'agents-side'

export type AgentRow = {
  id: string
  parentId?: string
  type: string
  description: string
  name?: string
  status: string
  prompt: string
  model?: string
  fork: boolean
  background: boolean
  toolCount: number
  lastTools: string[]
  durationMs?: number
  answer?: string
  inputTokens?: number
  outputTokens?: number
  percent?: number
  window?: number
}

export type TreeNode = {
  row: AgentRow
  prefix: string
  isLast: boolean
}

export function emptyMain(): AgentRow {
  return {
    id: MAIN,
    type: 'main',
    description: 'main loop',
    status: 'idle',
    prompt: '',
    fork: false,
    background: false,
    toolCount: 0,
    lastTools: [],
  }
}

export function treeOf(rows: AgentRow[]): TreeNode[] {
  const out: TreeNode[] = []
  const kids = (parentId: string) =>
    rows.filter(row => row.id !== MAIN && (row.parentId ?? MAIN) === parentId)

  function walk(row: AgentRow, prefix: string, isLast: boolean) {
    out.push({ row, prefix, isLast })
    const childRows = kids(row.id)
    childRows.forEach((child, i) => {
      const last = i === childRows.length - 1
      const branch = prefix === '' ? '' : `${prefix}${isLast ? '   ' : '│  '}`
      walk(child, `${branch}${last ? '└─' : '├─'}`, last)
    })
  }

  const main = rows.find(row => row.id === MAIN) ?? emptyMain()
  walk(main, '', true)
  for (const row of rows) {
    if (row.id === MAIN) continue
    if (out.some(node => node.row.id === row.id)) continue
    walk(row, '└─', true)
  }
  return out
}

export function countsOf(rows: AgentRow[]) {
  let running = 0
  let done = 0
  for (const row of rows) {
    if (row.id === MAIN) continue
    if (row.status === 'running') running += 1
    else done += 1
  }
  return { running, done }
}
