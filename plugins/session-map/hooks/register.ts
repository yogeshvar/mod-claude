import { drawMap } from './draw.ts'
import { relPath } from './format.ts'
import { PANE, groupOf, putHit, statusLine, type FileHit, type FileKind } from './model.ts'

let files: FileHit[] = []
let root = ''

function pin($: { ui: { status: (text: string | undefined) => void; invalidate: (event: 'ui.render') => void } }) {
  $.ui.status(statusLine(files))
  $.ui.invalidate('ui.render')
}

function paneArgs() {
  return { id: PANE, title: 'Map', columns: 44, rows: 22 }
}

async function isOpen($: { ui: { panes: () => Promise<Array<{ id: string; isPlaced: boolean }>> } }) {
  const panes = await $.ui.panes()
  return panes.some(pane => pane.id === PANE && pane.isPlaced)
}

function kindOf(tool: string): FileKind | null {
  if (tool === 'Read') return 'read'
  if (tool === 'Edit') return 'edit'
  if (tool === 'Write') return 'write'
  if (tool === 'Glob') return 'glob'
  return null
}

function pathOf(e: Record<string, unknown>, tool: string): string | null {
  if (typeof e.file_path === 'string' && e.file_path) return e.file_path
  if (tool === 'Glob' && typeof e.pattern === 'string' && e.pattern) return e.pattern
  return null
}

function note(path: string, kind: FileKind) {
  const rel = kind === 'glob' ? path : relPath(root, path)
  files = putHit(files, {
    path,
    rel,
    group: kind === 'glob' ? 'globs' : groupOf(rel),
    kind,
    hits: 1,
  })
}

export function register(
  on: (
    event: string,
    matcher?: unknown,
    hook?: (...args: never[]) => unknown,
  ) => void,
  options: Readonly<Record<string, string | number | boolean | readonly string[]>>,
) {
  const openOnStart = options.openOnStart === true

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    files = []
    root = e.cwd
    await $.command.register({
      name: 'session-map',
      description: 'Toggle the pane of files Claude has seen this session',
      argumentHint: '[clear|close]',
      immediate: true,
    })
    if (e.isInteractive && openOnStart) await $.ui.open(paneArgs())
    pin($)
    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const tool = String(e.tool ?? '')
    const kind = kindOf(tool)
    if (kind) {
      const path = pathOf(e as Record<string, unknown>, tool)
      if (path) note(path, kind)
      pin($)
    }
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'session-map' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'close') {
      await $.ui.close({ id: PANE })
      return { text: 'Closed the session map.' }
    }
    if (arg === 'clear') {
      files = []
      pin($)
      return { text: 'Cleared the session map.' }
    }
    if (await isOpen($)) {
      await $.ui.close({ id: PANE })
      return { text: 'Closed the session map.' }
    }
    await $.ui.open(paneArgs())
    return {
      text: 'Opened the session map. Dock it beside the transcript with /tui fullscreen.',
    }
  })

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return drawMap(Box, Text, Button, files, { bodyColumns: e.props.bodyColumns, showClose: true })
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== 'session-map') return next(e)
    if (e.element === 'clear') {
      files = []
      pin($)
      return {}
    }
    if (e.element === 'close') {
      await $.ui.close({ id: PANE })
      return {}
    }
    return next(e)
  })
}
