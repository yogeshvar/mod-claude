import { clip } from './format.ts'
import { groupsOf, type FileHit } from './model.ts'

export type Node = unknown
export type El = (props: Record<string, unknown>) => Node

function mark(kind: FileHit['kind']): string {
  if (kind === 'write') return 'W'
  if (kind === 'edit') return 'E'
  if (kind === 'glob') return 'G'
  return 'R'
}

export function drawMap(
  Box: El,
  Text: El,
  Button: El,
  files: FileHit[],
  args: { bodyColumns: number; showClose: boolean },
): Node {
  const width = Math.max(24, args.bodyColumns - 2)
  const groups = groupsOf(files)
  const kids: Node[] = [
    Text({ bold: true, children: 'Session map' }),
    Text({
      dimColor: true,
      children: files.length === 0 ? 'no files yet this session' : `${files.length} files this session`,
    }),
  ]

  let shown = 0
  const cap = 40
  for (const group of groups) {
    kids.push(Text({ children: ' ' }))
    kids.push(
      Text({
        bold: true,
        color: '#63b3ed',
        children: `${group.name} (${group.files.length})`,
      }),
    )
    for (const file of group.files) {
      if (shown >= cap) break
      shown += 1
      const label = file.rel === '.' ? file.path : file.rel
      kids.push(
        Text({
          children: `  ${mark(file.kind)}  ${clip(label, width - 6)}`,
        }),
      )
    }
    if (shown >= cap) break
  }

  if (files.length > shown) {
    kids.push(Text({ dimColor: true, children: `  +${files.length - shown} more` }))
  }

  if (args.showClose) {
    kids.push(Text({ children: ' ' }))
    kids.push(
      Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Button({ key: 'clear', label: 'clear', hotkey: 'c', plain: true, onPress: () => undefined }),
          Button({ key: 'close', label: 'close', hotkey: 'x', plain: true, onPress: () => undefined }),
        ],
      }),
    )
  }

  return Box({ flexDirection: 'column', paddingX: 1, paddingY: 0, children: kids })
}
