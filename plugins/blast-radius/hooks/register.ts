import { classify, clip, linesOf, type Risk } from './classify.ts'
import { drawHold, type Hold } from './draw.ts'

export const PANE = 'blast-radius'

type Decision = 'proceed' | 'cancel' | null

type Held = Hold & {
  decision: Decision
  where: 'pane' | 'band'
}

let held: Held | null = null

function pin($: { ui: { invalidate: (event: 'ui.render') => void } }) {
  $.ui.invalidate('ui.render')
}

function paneArgs() {
  return { id: PANE, title: 'Blast Radius', columns: 56, rows: 14, focus: true as const }
}

function processResult(result: { stdout?: string; stderr?: string }): string[] {
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  if (!out) return []
  return linesOf(out)
}

async function measure(
  $: { process: { run: (argv: readonly string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }> } },
  risk: Risk,
): Promise<string[]> {
  try {
    if (risk.kind === 'git-clean') {
      const result = await $.process.run(['git', 'clean', '-nd'])
      const lines = processResult(result)
      return lines.length > 0 ? lines : ['git clean -n reported nothing']
    }
    if (risk.kind === 'reset-hard' || risk.kind === 'force-push') {
      const result = await $.process.run(['git', 'status', '--porcelain'])
      const lines = processResult(result)
      return lines.length > 0 ? lines : ['working tree clean']
    }
    if (risk.kind === 'migrate' || risk.kind === 'migrate-down') {
      return ['Dry-run is the command text. Confirm the database before proceeding.']
    }
    if (risk.kind === 'drop' || risk.kind === 'truncate') {
      return ['SQL will run as written. This is not a permission deny.']
    }
    if (risk.kind === 'rm-rf' || risk.kind === 'env-delete') {
      return ['Check the path in the command before proceeding.']
    }
  } catch {
    return ['Could not dry-run; the command is still held.']
  }
  return []
}

function decide(
  which: Decision,
  $: { ui: { close: (args: { id: string }) => Promise<unknown>; invalidate: (event: 'ui.render') => void } },
) {
  if (!held) return
  held.decision = which
  pin($)
  void $.ui.close({ id: PANE })
}

export function register(
  on: (
    event: string,
    matcher?: unknown,
    hook?: (...args: never[]) => unknown,
  ) => void,
) {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'blast-radius',
      description: 'Show the last held command, if any',
      argumentHint: '[close]',
      immediate: true,
    })
    return result
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = String(e.command ?? '')
    const risk = classify(command)
    if (risk === null) return next(e)
    if (held && held.decision === null) {
      return { deny: 'Blast Radius is already holding another command.' }
    }

    try {
      const report = await measure($, risk)
      held = { command, risk, report, decision: null, where: 'pane' }
      const opened = await $.ui.open(paneArgs())
      if (!opened.isPlaced) held.where = 'band'
      pin($)

      while (held && held.decision === null && !next.signal?.aborted) {
        await $.process.run(['sleep', '0.25'])
      }

      const snapshot = held
      held = null
      pin($)
      void $.ui.close({ id: PANE })

      if (snapshot?.decision === 'proceed') return next(e)
      return {
        deny: `Blast Radius held this command: the user pressed Cancel. It would have: ${clip(risk.summary, 160)}`,
      }
    } catch {
      held = null
      return { deny: 'Blast Radius hit an error; the command did not run.' }
    }
  }).catch(() => ({ deny: 'Blast Radius hit an error; the command did not run.' }))

  on('command.run', { command: 'blast-radius' }, async ($, e) => {
    if (e.args.trim() === 'close') {
      if (held) held.decision = 'cancel'
      await $.ui.close({ id: PANE })
      pin($)
      return { text: 'Released the held command.' }
    }
    if (!held) return { text: 'Nothing is held.' }
    await $.ui.open(paneArgs())
    return { text: `Holding: ${held.risk.title}` }
  })

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.requestId !== PANE || !held) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return drawHold(Box, Text, Button, held, {
      bodyColumns: e.props.bodyColumns,
      showButtons: true,
      onProceed: () => {
        if (held) held.decision = 'proceed'
      },
      onCancel: () => {
        if (held) held.decision = 'cancel'
      },
    })
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (!held || held.where !== 'band' || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return drawHold(Box, Text, Button, held, {
      bodyColumns: e.props.bodyColumns,
      showButtons: true,
      onProceed: () => {
        if (held) held.decision = 'proceed'
      },
      onCancel: () => {
        if (held) held.decision = 'cancel'
      },
    })
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== 'blast-radius') return next(e)
    if (e.element === 'proceed') {
      decide('proceed', $)
      return {}
    }
    if (e.element === 'cancel') {
      decide('cancel', $)
      return {}
    }
    return next(e)
  })
}
