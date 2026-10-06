export type RiskKind =
  | 'migrate'
  | 'migrate-down'
  | 'force-push'
  | 'reset-hard'
  | 'git-clean'
  | 'drop'
  | 'truncate'
  | 'rm-rf'
  | 'env-delete'

export type Risk = {
  kind: RiskKind
  title: string
  summary: string
}

export function classify(command: string): Risk | null {
  const c = command
  if (/\bmigrate:make\b/.test(c)) return null

  if (/\bmigrate:down\b|\bmigrate:rollback\b|\bknex\s+migrate:rollback\b/.test(c)) {
    return {
      kind: 'migrate-down',
      title: 'Rollback migrations',
      summary: 'This rolls back Knex migrations against the current database.',
    }
  }

  if (
    /\b(?:pnpm|npm|yarn)\s+(?:run\s+)?migrate\b/.test(c) ||
    /\bknex\s+migrate(?:\s|:latest)\b/.test(c)
  ) {
    return {
      kind: 'migrate',
      title: 'Run migrations',
      summary: 'This runs database migrations against the current connection.',
    }
  }

  if (/\bgit\s+push\b/.test(c) && /(?:\s|^)(?:--force|-f|--force-with-lease)(?:\s|=|$)/.test(c)) {
    return {
      kind: 'force-push',
      title: 'Force-push',
      summary: 'This force-pushes and can overwrite remote history.',
    }
  }

  if (/\bgit\s+reset\b/.test(c) && /--hard\b/.test(c)) {
    return {
      kind: 'reset-hard',
      title: 'Hard reset',
      summary: 'This discards uncommitted work to match a commit.',
    }
  }

  if (/\bgit\s+clean\b/.test(c)) {
    return {
      kind: 'git-clean',
      title: 'Git clean',
      summary: 'This deletes untracked files from the working tree.',
    }
  }

  if (/\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i.test(c)) {
    return {
      kind: 'drop',
      title: 'DROP statement',
      summary: 'This drops database objects.',
    }
  }

  if (/\bTRUNCATE\b/i.test(c)) {
    return {
      kind: 'truncate',
      title: 'TRUNCATE statement',
      summary: 'This empties database tables.',
    }
  }

  if (/\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*[rf]\b/.test(c)) {
    return {
      kind: 'rm-rf',
      title: 'Recursive delete',
      summary: 'This recursively deletes files.',
    }
  }

  if (/(?:^|[\s;&|])(?:rm|unlink)\s+[^\n]*\.env(?:\b|['"])/.test(c)) {
    return {
      kind: 'env-delete',
      title: 'Delete .env',
      summary: 'This deletes an environment file that may hold secrets.',
    }
  }

  return null
}

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  if (max <= 1) return '…'
  return `${t.slice(0, max - 1)}…`
}

export function linesOf(text: string, max = 8): string[] {
  return text
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0)
    .slice(0, max)
}
