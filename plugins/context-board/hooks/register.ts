import { drawBoard } from './draw.ts'
import { instructionNames, pluginsFromSettings } from './kit.ts'
import { PANE, afterCompact, applyHeadline, applyUsage, emptyBoard, type Board } from './model.ts'

let board: Board = emptyBoard()

function pin($: { ui: { status: (text: string | undefined) => void; invalidate: (event: 'ui.render') => void } }) {
  if (board.waiting && board.percent == null) {
    $.ui.status('ctx waiting for the first answer')
  } else {
    const percent = board.percent ?? 0
    const tokens = board.tokens ?? 0
    const window = board.window ?? 0
    $.ui.status(
      window
        ? `ctx ${percent}% · ${Math.round(tokens / 100) / 10}k of ${Math.round(window / 1000)}k`
        : `ctx ${percent}%`,
    )
  }
  $.ui.invalidate('ui.render')
}

async function takeReading(
  $: { session: { usage: (args?: { breakdown?: 'summary' | 'full'; columns?: number }) => Promise<unknown> } },
  detail: 'summary' | 'full',
) {
  const usage = await $.session.usage({ breakdown: detail, columns: 80 })
  board = applyUsage(board, usage as Parameters<typeof applyUsage>[1], detail)
  pin($)
}

async function loadKit($: {
  settings: { read: () => Promise<unknown> }
  fs: { ancestors: (request: { names: string[] }) => Promise<Array<{ dir: string; name: string; content: string }>> }
  agent: { list: () => Promise<Array<{ id: string }>> }
}) {
  const settings = (await $.settings.read().catch(() => ({}))) as Record<string, unknown>
  const found = await $.fs.ancestors({ names: ['CLAUDE.md', 'AGENTS.md'] }).catch(() => [])
  const listed = await $.agent.list().catch(() => [])
  const spawned = listed.filter(row => row.id && row.id !== 'main').length
  board = {
    ...board,
    kit: {
      ...board.kit,
      plugins: pluginsFromSettings(settings),
      instructions: instructionNames([...board.kit.instructions.map(name => ({ name })), ...found]),
      agents: Math.max(board.kit.agents, spawned),
    },
  }
  pin($)
}

async function isOpen($: { ui: { panes: () => Promise<Array<{ id: string; isPlaced: boolean }>> } }) {
  const panes = await $.ui.panes()
  return panes.some(pane => pane.id === PANE && pane.isPlaced)
}

function paneArgs() {
  return { id: PANE, title: 'Context', columns: 56, rows: 10 }
}

export function register(
  on: (
    event: string,
    matcher?: unknown,
    hook?: (...args: never[]) => unknown,
  ) => void,
  options: Readonly<Record<string, string | number | boolean | readonly string[]>>,
) {
  const openPaneOnStart = options.openPaneOnStart === true

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    board = emptyBoard()
    await $.command.register({
      name: 'context-board',
      description: 'Show the full context breakdown, or refresh the counts',
      argumentHint: '[refresh|pane|close]',
      immediate: true,
    })
    if (e.isInteractive) {
      await loadKit($)
      await takeReading($, 'summary')
      if (openPaneOnStart) await $.ui.open(paneArgs())
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    board = applyHeadline(board, e.context, e.rateLimits, e.cost?.usd)
    pin($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await takeReading($, 'summary')
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (!result.skip) {
      board = afterCompact(board)
      pin($)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'clear' }, async ($, e, next) => {
    const result = await next(e)
    board = afterCompact(board)
    pin($)
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'context-board' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'refresh') {
      await takeReading($, 'full')
      return { text: 'Counted every context category with the token-count API.' }
    }
    if (arg === 'close') {
      await $.ui.close({ id: PANE })
      return { text: 'Closed the context pane. The bar above the prompt stays.' }
    }
    if (arg === 'pane' || arg === '') {
      if (arg === '' && (await isOpen($))) {
        await $.ui.close({ id: PANE })
        return { text: 'Closed the context pane. The bar above the prompt stays.' }
      }
      await takeReading($, 'summary')
      await $.ui.open(paneArgs())
      return { text: 'Opened the full context pane. The same breakdown stays in the bar above the prompt.' }
    }
    return { text: 'Usage: /context-board, /context-board refresh, /context-board pane, /context-board close' }
  })

  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const result = await next(e)
    const skill = typeof e.skill === 'string' ? e.skill : ''
    if (skill) {
      board = { ...board, kit: { ...board.kit, lastSkill: skill } }
      pin($)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return drawBoard(Box, Text, Button, board, { bodyColumns: e.props.bodyColumns, showClose: false })
  })

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return drawBoard(Box, Text, Button, board, { bodyColumns: e.props.bodyColumns, showClose: true })
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== 'context-board') return next(e)
    if (e.element === 'refresh') {
      await takeReading($, 'full')
      return {}
    }
    if (e.element === 'pane') {
      await $.ui.open(paneArgs())
      return {}
    }
    if (e.element === 'close' && e.requestId === PANE) {
      await $.ui.close({ id: PANE })
      return {}
    }
    return next(e)
  })
}
