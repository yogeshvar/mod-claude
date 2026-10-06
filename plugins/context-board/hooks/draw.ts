import { FREE_COLOR, SLICE_STYLES, clip, short, styleOf, TICK_COLOR, fillTone } from './format.ts'
import { kitLine } from './kit.ts'
import { type Board, type Category } from './model.ts'

export type Node = unknown
export type El = (props: Record<string, unknown>) => Node

export type Slice = {
  label: string
  color: string
  tokens: number
  kind: 'used' | 'free'
}

function sum(items: Array<{ tokens: number }>): number {
  return items.reduce((n, item) => n + item.tokens, 0)
}

function fromCategory(row: Category): Slice | null {
  if (row.kind === 'buffer' || row.kind === 'deferred') return null
  if (row.kind === 'free') {
    return { label: 'free', color: FREE_COLOR, tokens: row.tokens, kind: 'free' }
  }
  const style = styleOf(row.name)
  return { label: style.label, color: style.color, tokens: row.tokens, kind: 'used' }
}

function extra(label: string, tokens: number): Slice {
  const style = SLICE_STYLES.find(s => s.label === label) ?? styleOf(label)
  return { label: style.label, color: style.color, tokens, kind: 'used' }
}

export function slicesOf(board: Board): Slice[] {
  const fromCats = board.categories.map(fromCategory).filter((row): row is Slice => row !== null)
  const labels = new Set(fromCats.map(row => row.label))
  const extras: Slice[] = []
  const mcp = sum(board.mcpTools)
  if (mcp > 0 && !labels.has('mcp tools')) extras.push(extra('mcp tools', mcp))
  if (board.agents.length > 0 && !labels.has('agents')) extras.push(extra('agents', sum(board.agents)))
  if (board.skills && board.skills.tokens > 0 && !labels.has('skills')) {
    extras.push(extra('skills', board.skills.tokens))
  }
  if (board.slashCommands && board.slashCommands.tokens > 0 && !labels.has('slash commands')) {
    extras.push(extra('slash commands', board.slashCommands.tokens))
  }

  const used = [...fromCats.filter(row => row.kind === 'used'), ...extras]
  const free = fromCats.find(row => row.kind === 'free')
  const window = board.maxTokens ?? board.window ?? sum(used)
  const usedTokens = sum(used)
  const freeTokens = free?.tokens ?? Math.max(0, window - usedTokens)
  const order = SLICE_STYLES.map(style => style.label)
  used.sort((a, b) => {
    const ia = order.indexOf(a.label)
    const ib = order.indexOf(b.label)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  return [...used, { label: 'free', color: FREE_COLOR, tokens: freeTokens, kind: 'free' }]
}

function stack(
  slices: Slice[],
  width: number,
  compactAt: number | undefined,
  window: number,
): Array<{ color: string; text: string }> {
  const total = window > 0 ? window : Math.max(1, sum(slices))
  const cells: string[] = Array.from({ length: width }, () => FREE_COLOR)
  let x = 0
  for (const slice of slices) {
    if (slice.kind === 'free') break
    let cols = Math.round((slice.tokens / total) * width)
    if (slice.tokens > 0) cols = Math.max(1, cols)
    for (let i = 0; i < cols && x < width; i++) {
      cells[x] = slice.color
      x += 1
    }
  }
  if (compactAt != null && window > 0) {
    const at = Math.max(0, Math.min(width - 1, Math.round((compactAt / window) * width)))
    cells[at] = TICK_COLOR
  }
  const parts: Array<{ color: string; text: string }> = []
  for (const color of cells) {
    const last = parts[parts.length - 1]
    if (last && last.color === color) last.text += '█'
    else parts.push({ color, text: '█' })
  }
  return parts
}

function legendItem(Box: El, Text: El, slice: Slice, window: number): Node {
  const pct = window > 0 ? Math.round((slice.tokens / window) * 100) : 0
  const nums = slice.kind === 'free' ? short(slice.tokens) : `${short(slice.tokens)} ${pct}%`
  return Box({
    flexDirection: 'row',
    marginRight: 2,
    children: [
      Text({ color: slice.color, children: '■ ' }),
      Text({ children: `${slice.label} ` }),
      Text({ bold: true, children: nums }),
    ],
  })
}

export function drawBoard(
  Box: El,
  Text: El,
  Button: El,
  board: Board,
  args: { bodyColumns: number; showClose: boolean },
): Node {
  const width = Math.max(24, args.bodyColumns - 4)
  const slices = slicesOf(board)
  const window = board.maxTokens ?? board.window ?? 0
  const used = board.totalTokens ?? board.tokens ?? sum(slices.filter(s => s.kind === 'used'))
  const percent = board.percent ?? (window > 0 ? Math.round((used / window) * 100) : 0)
  const compactAt = board.isAutoCompactEnabled === false ? undefined : board.autoCompactThreshold
  const badge = fillTone(percent)

  const headerRight = board.waiting && board.percent == null
    ? [Text({ dimColor: true, children: 'waiting for the first answer' })]
    : [
        Text({
          dimColor: true,
          children: window
            ? `${short(used)} of ${short(window)}${compactAt != null ? ` · compacts at ${short(compactAt)}` : ''}`
            : short(used),
        }),
        Text({ backgroundColor: badge, color: '#1a202c', bold: true, children: ` ${percent}% ` }),
      ]

  const barWidth = Math.max(16, width - 2)
  const parts = stack(slices, barWidth, compactAt, window || 1)
  const bar = Box({
    flexDirection: 'row',
    children: parts.map(part => Text({ color: part.color, children: part.text })),
  })

  const kids: Node[] = [
    Box({
      flexDirection: 'row',
      justifyContent: 'space-between',
      children: [
        Box({
          flexDirection: 'row',
          children: [
            Text({ color: '#ed8936', children: '◆ ' }),
            Text({ bold: true, children: 'context' }),
          ],
        }),
        Box({ flexDirection: 'row', columnGap: 1, children: headerRight }),
      ],
    }),
  ]

  if (!(board.waiting && board.percent == null && slices.every(s => s.tokens === 0))) {
    kids.push(bar)
    kids.push(
      Box({
        flexDirection: 'row',
        flexWrap: 'wrap',
        children: slices.filter(s => s.kind === 'free' || s.tokens > 0 || s.label === 'messages').map(slice =>
          legendItem(Box, Text, slice, window || 1),
        ),
      }),
    )
  }

  const kit = kitLine(board.kit)
  if (kit) {
    kids.push(Text({ dimColor: true, children: clip(kit, width) }))
  }

  if (args.showClose) {
    kids.push(
      Box({
        flexDirection: 'row',
        columnGap: 2,
        marginTop: 1,
        children: [
          Button({ key: 'refresh', label: 'refresh', hotkey: 'r', plain: true, onPress: () => undefined }),
          Button({ key: 'close', label: 'close', hotkey: 'x', plain: true, onPress: () => undefined }),
        ],
      }),
    )
  }

  return Box({
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: 'gray',
    paddingX: 1,
    paddingY: 0,
    children: kids,
  })
}
