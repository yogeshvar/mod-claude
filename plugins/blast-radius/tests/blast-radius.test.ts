import { describe, expect, mock, test } from 'claude-code/testing'
import { classify } from '../hooks/classify.ts'

function world(on: (event: string, matcher?: unknown, hook?: (...args: never[]) => unknown) => void) {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'ok' }))
  on('process.run', async ($, e) => {
    if (e.argv[0] === 'sleep') {
      await clock.sleep(250)
      return {
        value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
      }
    }
    return {
      value: {
        exitCode: 0,
        stdout: ' M src/auth.ts\n',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  return clock
}

const paneProps = {
  title: 'Blast Radius',
  isFocused: true,
  bodyColumns: 56,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}

describe('blast-radius', () => {
  test('classify holds migrate, force-push, DROP, and skip migrate:make', () => {
    expect(classify('pnpm migrate')?.kind).toBe('migrate')
    expect(classify('pnpm migrate:down')?.kind).toBe('migrate-down')
    expect(classify('pnpm migrate:make add_users')).toBeNull()
    expect(classify('git push --force origin main')?.kind).toBe('force-push')
    expect(classify('git reset --hard HEAD~1')?.kind).toBe('reset-hard')
    expect(classify('DROP TABLE medditour.otp_requests')?.kind).toBe('drop')
    expect(classify('rm -rf build')?.kind).toBe('rm-rf')
    expect(classify('rm .env')?.kind).toBe('env-delete')
    expect(classify('git status')).toBeNull()
  })

  test('Cancel refuses a hard reset', async ($, on) => {
    const clock = world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const pending = $.tool.call({ tool: 'Bash', command: 'git reset --hard' } as never)
    await clock.settle()
    const ui = await $.ui.mount({
      plugin: 'blast-radius',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'blast-radius',
      props: paneProps,
    })
    expect(await ui.find({ type: 'Text', text: /Hard reset/ })).toBeDefined()
    await ui.press({ key: 'cancel' })
    await clock.advance(250)
    const result = await pending
    expect(JSON.stringify(result)).toMatch(/Cancel/)
    await ui.unmount()
  })

  test('Proceed lets a hard reset run', async ($, on) => {
    const clock = world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const pending = $.tool.call({ tool: 'Bash', command: 'git reset --hard' } as never)
    await clock.settle()
    const ui = await $.ui.mount({
      plugin: 'blast-radius',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'blast-radius',
      props: paneProps,
    })
    await ui.press({ key: 'proceed' })
    await clock.advance(250)
    const result = await pending
    expect(JSON.stringify(result)).not.toMatch(/deny/)
    expect(JSON.stringify(result)).toMatch(/ok/)
    await ui.unmount()
  })
})
