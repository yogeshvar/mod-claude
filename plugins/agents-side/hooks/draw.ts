import { bar, clip, duration, fillTone, mark, short, tone } from './format.ts'
import { MAIN, type AgentRow, type TreeNode } from './model.ts'

export type Node = unknown
export type El = (props: Record<string, unknown>) => Node

export type Snapshot = {
  nodes: TreeNode[]
  selectedId: string
  bodyColumns: number
  isFocused: boolean
}

function right(row: AgentRow): string {
  const bits: string[] = []
  if (row.percent != null) bits.push(`${row.percent}%`)
  else if (row.inputTokens != null) bits.push(short(row.inputTokens))
  if (row.toolCount > 0) bits.push(`${row.toolCount} tools`)
  if (row.durationMs != null && row.status !== 'running') bits.push(duration(row.durationMs))
  return bits.join(' · ')
}

function labelOf(row: AgentRow): string {
  if (row.id === MAIN) return 'main'
  const title = row.description || row.name || row.type
  return row.type === title ? title : `${row.type}  ${title}`
}

export function drawPane(Box: El, Text: El, Button: El, snap: Snapshot): Node {
  const width = Math.max(24, snap.bodyColumns)
  const nameWidth = Math.max(12, width - 18)
  const selected = snap.nodes.find(node => node.row.id === snap.selectedId)?.row

  const rows: Node[] = [
    Text({ bold: true, children: 'Agents' }),
    Text({
      dimColor: true,
      children: snap.nodes.length <= 1 ? 'waiting for subagents' : `${snap.nodes.length - 1} spawned this session`,
    }),
  ]

  snap.nodes.forEach((node, index) => {
    const hotkey = index < 9 ? String(index + 1) : undefined
    const selectedMark = node.row.id === snap.selectedId ? '›' : ' '
    const line = `${selectedMark}${node.prefix}${mark(node.row.status)} ${clip(labelOf(node.row), nameWidth - node.prefix.length - 3)}`
    rows.push(
      Box({
        key: `row-${node.row.id}`,
        flexDirection: 'row',
        justifyContent: 'space-between',
        children: [
          Button({
            key: `pick-${node.row.id}`,
            label: line,
            plain: true,
            hotkey,
            dimColor: node.row.id !== snap.selectedId,
            onPress: () => undefined,
          }),
          Text({
            dimColor: true,
            children: right(node.row),
          }),
        ],
      }),
    )
  })

  if (selected) {
    rows.push(Text({ children: ' ' }))
    rows.push(drawDetail(Box, Text, selected, width))
  }

  rows.push(Text({ children: ' ' }))
  rows.push(
    Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Button({ key: 'clear', label: 'clear done', hotkey: 'c', plain: true, onPress: () => undefined }),
        Button({ key: 'close', label: 'close', hotkey: 'x', plain: true, onPress: () => undefined }),
      ],
    }),
  )

  if (!snap.isFocused) {
    rows.push(Text({ dimColor: true, children: 'click the pane or ctrl+x tab, then 1-9' }))
  }

  return Box({ flexDirection: 'column', paddingX: 1, paddingY: 0, children: rows })
}

function drawDetail(Box: El, Text: El, row: AgentRow, width: number): Node {
  const inner = Math.max(16, width - 2)
  const kids: Node[] = [
    Text({
      color: tone(row.status),
      bold: true,
      children: `${mark(row.status)} ${clip(labelOf(row), inner - 2)}`,
    }),
    Text({
      dimColor: true,
      children: [
        row.model ?? (row.id === MAIN ? 'session model' : 'model pending'),
        row.status,
        row.fork ? 'fork' : undefined,
        row.background ? 'background' : undefined,
      ]
        .filter(Boolean)
        .join(' · '),
    }),
  ]

  if (row.id === MAIN && row.percent != null && row.window != null) {
    kids.push(
      Text({
        color: fillTone(row.percent),
        children: `${bar(row.percent, Math.min(28, inner))} ${row.percent}%  ${short(row.inputTokens ?? 0)}/${short(row.window)}`,
      }),
    )
  }

  if (row.prompt) {
    kids.push(Text({ dimColor: true, children: `↓ in  ${clip(row.prompt, inner - 6)}` }))
  }

  const work: string[] = []
  if (row.toolCount > 0) work.push(`${row.toolCount} tools`)
  if (row.lastTools.length > 0) work.push(row.lastTools.join(', '))
  if (row.inputTokens != null) work.push(`in ${short(row.inputTokens)}`)
  if (row.outputTokens != null) work.push(`out ${short(row.outputTokens)}`)
  if (work.length > 0) {
    kids.push(Text({ children: `⚙  ${clip(work.join(' · '), inner - 3)}` }))
  }

  if (row.answer) {
    kids.push(Text({ dimColor: true, children: `↑ out ${clip(row.answer, inner - 6)}` }))
  } else if (row.status === 'running') {
    kids.push(Text({ color: 'cyan', children: '↑ out  still running' }))
  }

  return Box({
    flexDirection: 'column',
    borderStyle: 'single',
    borderColor: 'gray',
    paddingX: 1,
    children: kids,
  })
}
