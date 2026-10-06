import { drawPane } from './draw.ts'
import { clip } from './format.ts'
import { MAIN, PANE, countsOf, emptyMain, treeOf, type AgentRow } from './model.ts'

const agents: AgentRow[] = [emptyMain()]
let selectedId = MAIN

function rowOf(id: string): AgentRow {
  return agents.find(row => row.id === id) ?? emptyMain()
}

function put(next: AgentRow) {
  const i = agents.findIndex(row => row.id === next.id)
  if (i === -1) agents.push(next)
  else agents[i] = next
}

function patch(id: string, partial: Partial<AgentRow>) {
  put({ ...rowOf(id), ...partial, id })
}

function statusLine() {
  const { running, done } = countsOf(agents)
  const main = rowOf(MAIN)
  const ctx = main.percent != null ? ` · ctx ${main.percent}%` : ''
  return `agents: ${running} running · ${done} done${ctx}`
}

function pin($: { ui: { status: (text: string | undefined) => void; invalidate: (event: 'ui.render') => void } }) {
  $.ui.status(statusLine())
  $.ui.invalidate('ui.render')
}

async function syncListed($: { agent: { list: () => Promise<Array<{ id: string; status: string; description: string; type: string; parentId?: string; name?: string }>> } }) {
  const listed = await $.agent.list()
  for (const info of listed) {
    const prev = agents.find(row => row.id === info.id)
    patch(info.id, {
      type: info.type || prev?.type || 'agent',
      description: info.description || prev?.description || info.type,
      status: info.status || prev?.status || 'running',
      parentId: info.parentId ?? prev?.parentId,
      name: info.name ?? prev?.name,
    })
  }
}

function paneArgs(columns: number) {
  return {
    id: PANE,
    title: 'Agents',
    columns,
    rows: 22,
  }
}

async function isOpen($: { ui: { panes: () => Promise<Array<{ id: string; isPlaced: boolean }>> } }) {
  const panes = await $.ui.panes()
  return panes.some(pane => pane.id === PANE && pane.isPlaced)
}

export function register(
  on: (
    event: string,
    matcher?: unknown,
    hook?: (...args: never[]) => unknown,
  ) => void,
  options: Readonly<Record<string, string | number | boolean | readonly string[]>>,
) {
  const columns = typeof options.columns === 'number' ? options.columns : 48
  const openOnStart = options.openOnStart !== false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'agents-side',
      description: 'Toggle the agents side pane',
      argumentHint: '[clear|close]',
      immediate: true,
    })
    if (e.isInteractive && openOnStart) {
      await $.ui.open(paneArgs(columns))
    }
    await syncListed($)
    pin($)
    $.clock.every(2000, () => {
      void syncListed($).then(() => pin($))
    })
    return result
  })

  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    patch(MAIN, {
      status: 'running',
      prompt: e.text,
      description: e.text ? clip(e.text, 40) : 'main loop',
    })
    pin($)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    patch(MAIN, {
      percent: e.context.percent,
      window: e.context.window,
      inputTokens: e.context.tokens,
    })
    pin($)
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if ('deny' in result && result.deny) return result
    const id = result.agentId ?? e.tool_use_id
    put({
      id,
      parentId: e.parentAgentId ?? MAIN,
      type: e.subagentType,
      description: e.description || e.subagentType,
      name: e.name,
      status: 'running',
      prompt: e.prompt,
      model: result.model ?? e.model ?? e.parentModel,
      fork: e.fork,
      background: e.background,
      toolCount: 0,
      lastTools: [],
    })
    selectedId = id
    pin($)
    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const id = e.agentId ?? MAIN
    if (!agents.some(row => row.id === id)) {
      put({
        ...emptyMain(),
        id,
        type: 'loop',
        description: `loop ${id}`,
        status: 'running',
        parentId: MAIN,
      })
    }
    const prev = rowOf(id)
    patch(id, {
      status: prev.status === 'idle' ? 'running' : prev.status,
      toolCount: prev.toolCount + 1,
      lastTools: [...prev.lastTools, String(e.tool)].slice(-6),
    })
    pin($)
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const id = e.agentId ?? MAIN
    let status = 'completed'
    if (e.reason === 'aborted') status = 'aborted'
    else if (e.reason === 'error' || e.reason === 'refusal') status = 'failed'
    const prev = rowOf(id)
    patch(id, {
      status: id === MAIN && status === 'completed' ? 'idle' : status,
      durationMs: e.durationMs,
      answer: e.answer,
      inputTokens: e.usage?.input_tokens ?? prev.inputTokens,
      outputTokens: e.usage?.output_tokens,
      model: e.usage?.model ?? prev.model,
    })
    pin($)
    return result
  })

  on('command.run', { command: 'agents-side' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'close') {
      await $.ui.close({ id: PANE })
      return { text: 'Closed the agents pane.' }
    }
    if (arg === 'clear') {
      const kept = agents.filter(row => row.id === MAIN || row.status === 'running')
      agents.splice(0, agents.length, ...kept)
      if (!agents.some(row => row.id === selectedId)) selectedId = MAIN
      pin($)
      return { text: 'Cleared finished agents.' }
    }
    if (await isOpen($)) {
      await $.ui.close({ id: PANE })
      return { text: 'Closed the agents pane.' }
    }
    await $.ui.open(paneArgs(columns))
    return {
      text: 'Opened the agents pane. Dock it beside the transcript with /tui fullscreen in a terminal at least 110 columns wide.',
    }
  })

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = e.props.bodyColumns
    return drawPane(Box, Text, Button, {
      nodes: treeOf(agents),
      selectedId,
      bodyColumns: width,
      isFocused: e.props.isFocused,
    })
  })

  on('ui.press', async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    if (e.element === 'clear') {
      const kept = agents.filter(row => row.id === MAIN || row.status === 'running')
      agents.splice(0, agents.length, ...kept)
      if (!agents.some(row => row.id === selectedId)) selectedId = MAIN
      pin($)
      return {}
    }
    if (e.element === 'close') {
      await $.ui.close({ id: PANE })
      return {}
    }
    if (e.element.startsWith('pick-')) {
      selectedId = e.element.slice('pick-'.length)
      pin($)
      return {}
    }
    return next(e)
  })
}
