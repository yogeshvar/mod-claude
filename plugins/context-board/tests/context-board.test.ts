import { describe, expect, mock, test } from 'claude-code/testing'

function fakeBreakdown(tokens: number) {
  const window = 200_000
  const messages = Math.max(1, tokens - 24_000)
  const systemPrompt = 4_100
  const systemTools = 12_000
  const memory = 8_400
  const buffer = 40_000
  const used = messages + systemPrompt + systemTools + memory
  const free = Math.max(0, window - used - buffer)
  return {
    categories: [
      { name: 'System prompt', tokens: systemPrompt, color: 'promptBorder', isDeferred: false, kind: 'used' },
      { name: 'System tools', tokens: systemTools, color: 'inactive', isDeferred: false, kind: 'used' },
      { name: 'Memory files', tokens: memory, color: 'permission', isDeferred: false, kind: 'used' },
      { name: 'Messages', tokens: messages, color: 'promptBorder', isDeferred: false, kind: 'used' },
      { name: 'Autocompact buffer', tokens: buffer, color: 'warning', isDeferred: false, kind: 'buffer' },
      { name: 'Free space', tokens: free, color: 'inactive', isDeferred: false, kind: 'free' },
    ],
    totalTokens: used,
    maxTokens: window,
    rawMaxTokens: window,
    autocompactSource: 'model-default',
    percentage: Math.round((used / window) * 100),
    gridRows: [
      [
        { color: 'promptBorder', isFilled: true, categoryName: 'Messages', tokens: messages, percentage: 49, squareFullness: 1 },
        { color: 'inactive', isFilled: false, categoryName: 'Free space', tokens: free, percentage: 19, squareFullness: 0 },
      ],
    ],
    model: 'claude-opus-4-6',
    memoryFiles: [{ path: '/work/CLAUDE.md', type: 'Project', tokens: 2100 }],
    mcpTools: [{ name: 'mcp__demo__search', serverName: 'demo', tokens: 400, isLoaded: true }],
    agents: [{ agentType: 'Explore', source: 'built-in', tokens: 300 }],
    slashCommands: { totalCommands: 12, includedCommands: 8, tokens: 400 },
    skills: {
      totalSkills: 6,
      includedSkills: 4,
      tokens: 1200,
      skillFrontmatter: [{ name: 'review', source: 'userSettings', tokens: 200 }],
    },
    autoCompactThreshold: 160_000,
    isAutoCompactEnabled: true,
    apiUsage: {
      input_tokens: 12_100,
      output_tokens: 2_400,
      cache_creation_input_tokens: 4_000,
      cache_read_input_tokens: 80_000,
    },
  }
}

function world(
  on: (event: string, matcher?: unknown, hook?: (...args: never[]) => unknown) => void,
  tokensRef: { tokens: number },
) {
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('turn.complete', () => ({ text: '' }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.compact', () => ({ messages: [] }))
  on('session.usage', ($, e) => {
    const tokens = tokensRef.tokens
    const window = 200_000
    const percent = Math.round((tokens / window) * 100)
    return {
      value: {
        context: {
          tokens,
          window,
          percent,
          breakdown: e.breakdown ? fakeBreakdown(tokens) : undefined,
        },
        rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }],
        cost: { usd: 0.42 },
      },
    }
  })
}

const bandProps = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 24,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 24 },
  view: {},
}

describe('context-board', () => {
  test('the bar shows the full /context breakdown', async ($, on) => {
    const tokensRef = { tokens: 36_100 }
    world(on, tokensRef)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

    const ui = await $.ui.mount({
      plugin: 'context-board',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: bandProps,
    })
    expect(await ui.find({ type: 'Text', text: /18%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /context/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /system prompt/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /memory files/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /mcp tools/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /skills/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /messages/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /compacts at/ })).toBeDefined()
    await ui.unmount()
  })

  test('updates after a turn and refresh counts as full', async ($, on) => {
    const tokensRef = { tokens: 36_100 }
    world(on, tokensRef)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

    const ui = await $.ui.mount({
      plugin: 'context-board',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: bandProps,
    })

    tokensRef.tokens = 134_400
    await $.turn.complete({
      reason: 'answer',
      answer: 'ok',
      durationMs: 10,
      isAborted: false,
      turnId: 't1',
    })
    expect(await ui.find({ type: 'Text', text: /67%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /messages/ })).toBeDefined()

    const answer = await $.command.run({ command: 'context-board', args: 'refresh' })
    expect(answer.text ?? '').toMatch(/token-count API/)
    await ui.unmount()
  })
})
