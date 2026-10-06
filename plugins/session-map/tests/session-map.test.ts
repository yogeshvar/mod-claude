import { describe, expect, mock, test } from 'claude-code/testing'

function world(on: (event: string, matcher?: unknown, hook?: (...args: never[]) => unknown) => void) {
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'ok' }))
}

const paneProps = {
  title: 'Map',
  isFocused: true,
  bodyColumns: 48,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}

describe('session-map', () => {
  test('groups Read/Edit/Write paths by monorepo app', async ($, on) => {
    world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.tool.call({ tool: 'Read', file_path: '/work/apps/api/src/server.js' } as never)
    await $.tool.call({ tool: 'Edit', file_path: '/work/apps/api/src/middleware/auth.js' } as never)
    await $.tool.call({ tool: 'Write', file_path: '/work/apps/web/src/app/page.tsx' } as never)
    await $.tool.call({ tool: 'Read', file_path: '/work/README.md' } as never)

    const opened = await $.command.run({ command: 'session-map', args: '' })
    expect(opened.text ?? '').toMatch(/Opened the session map|Closed the session map/)

    const ui = await $.ui.mount({
      plugin: 'session-map',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'session-map',
      props: paneProps,
    })
    expect(await ui.find({ type: 'Text', text: /Session map/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /apps\/api/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /apps\/web/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /server\.js/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /page\.tsx/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /README\.md/ })).toBeDefined()
    await ui.unmount()
  })
})
