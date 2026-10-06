import { describe, expect, mock, test } from 'claude-code/testing'

function world(on: (event: string, matcher?: unknown, hook?: (...args: never[]) => unknown) => void) {
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', ($, e) => ({
    model: e.model ?? e.parentModel ?? 'claude-haiku-4-5',
    agentId: 'agent-explore',
  }))
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
}

const paneProps = {
  title: 'Agents',
  isFocused: true,
  bodyColumns: 48,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}

describe('agents-side', () => {
  test('opens a pane and draws the main loop', async ($, on) => {
    world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const opened = await $.command.run({ command: 'agents-side', args: '' })
    expect(opened.text ?? '').toMatch(/Opened the agents pane|Closed the agents pane/)

    const ui = await $.ui.mount({
      plugin: 'agents-side',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'agents-side',
      props: paneProps,
    })
    expect(await ui.find({ type: 'Text', text: /Agents/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /main/ })).toBeDefined()
    await ui.unmount()
  })

  test('records a subagent, its tools, and its answer', async ($, on) => {
    world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.turn.start({ text: 'refactor the auth module', turnId: 't0' })
    await $.agent.spawn({
      prompt: 'Map the auth module. List every file.',
      description: 'map auth',
      subagentType: 'Explore',
    })
    await $.tool.call({ tool: 'Read', file_path: 'src/auth.ts', agentId: 'agent-explore' } as never)
    await $.tool.call({ tool: 'Grep', pattern: 'refreshToken', agentId: 'agent-explore' } as never)
    await $.turn.complete({
      reason: 'answer',
      answer: 'auth lives in src/auth.ts',
      durationMs: 4200,
      isAborted: false,
      turnId: 't-agent',
      agentId: 'agent-explore',
    })

    const ui = await $.ui.mount({
      plugin: 'agents-side',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'agents-side',
      props: paneProps,
    })
    expect(await ui.find({ type: 'Text', text: /Explore/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /map auth/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /auth lives in src\/auth\.ts/ })).toBeDefined()
    await ui.unmount()
  })
})
