import { clip, type Risk } from './classify.ts'

export type Node = unknown
export type El = (props: Record<string, unknown>) => Node

export type Hold = {
  command: string
  risk: Risk
  report: string[]
}

export function drawHold(
  Box: El,
  Text: El,
  Button: El,
  hold: Hold,
  args: {
    bodyColumns: number
    showButtons: boolean
    onProceed?: () => void
    onCancel?: () => void
  },
): Node {
  const width = Math.max(24, args.bodyColumns - 4)
  const kids: Node[] = [
    Box({
      flexDirection: 'row',
      children: [
        Text({ color: '#fc8181', children: '◆ ' }),
        Text({ bold: true, children: hold.risk.title }),
      ],
    }),
    Text({ dimColor: true, children: clip(hold.risk.summary, width) }),
    Text({ children: clip(hold.command, width) }),
  ]

  for (const line of hold.report.slice(0, 10)) {
    kids.push(Text({ dimColor: true, children: clip(line, width) }))
  }

  if (args.showButtons) {
    kids.push(
      Box({
        flexDirection: 'row',
        columnGap: 2,
        marginTop: 1,
        children: [
          Button({ key: 'proceed', label: 'Proceed', hotkey: '1', onPress: args.onProceed ?? (() => undefined) }),
          Button({ key: 'cancel', label: 'Cancel', hotkey: '2', onPress: args.onCancel ?? (() => undefined) }),
        ],
      }),
    )
  }

  return Box({
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: 'red',
    paddingX: 1,
    paddingY: 0,
    children: kids,
  })
}
