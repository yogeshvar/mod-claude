export const PANE = 'context-board'
export const HISTORY = 24

export type Category = {
  name: string
  tokens: number
  color: string
  isDeferred: boolean
  kind: string
}

export type GridSquare = {
  color: string
  isFilled: boolean
  categoryName: string
  tokens: number
  percentage: number
  squareFullness: number
}

export type MemoryFile = { path: string; type: string; tokens: number }
export type McpTool = { name: string; serverName: string; tokens: number; isLoaded: boolean }
export type ContextAgent = { agentType: string; source: string; tokens: number }
export type Skill = { name: string; source: string; tokens: number; pluginName?: string }
export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type ApiUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

export type Board = {
  tokens?: number
  window?: number
  percent?: number
  costUsd?: number
  rateLimits: RateLimit[]
  detail: 'none' | 'summary' | 'full'
  waiting: boolean
  lastDelta?: number
  history: number[]
  categories: Category[]
  gridRows: GridSquare[][]
  memoryFiles: MemoryFile[]
  mcpTools: McpTool[]
  agents: ContextAgent[]
  slashCommands?: { totalCommands: number; includedCommands: number; tokens: number }
  skills?: { totalSkills: number; includedSkills: number; tokens: number; skillFrontmatter: Skill[] }
  autoCompactThreshold?: number
  isAutoCompactEnabled?: boolean
  autocompactSource?: string
  model?: string
  maxTokens?: number
  totalTokens?: number
  apiUsage?: ApiUsage | null
}

export function emptyBoard(): Board {
  return {
    rateLimits: [],
    detail: 'none',
    waiting: true,
    history: [],
    categories: [],
    gridRows: [],
    memoryFiles: [],
    mcpTools: [],
    agents: [],
  }
}

export function headroomLimit(board: Board): number | undefined {
  if (board.autoCompactThreshold != null) return board.autoCompactThreshold
  if (board.maxTokens != null) return board.maxTokens
  return board.window
}

export function applyHeadline(
  board: Board,
  context: { tokens?: number; window: number; percent?: number },
  rateLimits: RateLimit[],
  costUsd?: number,
): Board {
  const next = { ...board }
  if (context.tokens != null) {
    if (!next.waiting && next.tokens != null && context.tokens !== next.tokens) {
      next.lastDelta = context.tokens - next.tokens
    }
    next.tokens = context.tokens
    next.waiting = false
    if (next.history.length === 0 || next.history[next.history.length - 1] !== context.tokens) {
      next.history = [...next.history, context.tokens].slice(-HISTORY)
    }
  }
  next.window = context.window
  next.percent = context.percent
  next.rateLimits = rateLimits
  if (costUsd != null) next.costUsd = costUsd
  return next
}

export function applyUsage(
  board: Board,
  usage: {
    context: {
      tokens?: number
      window: number
      percent?: number
      breakdown?: {
        categories?: Category[]
        gridRows?: GridSquare[][]
        memoryFiles?: MemoryFile[]
        mcpTools?: McpTool[]
        agents?: ContextAgent[]
        slashCommands?: Board['slashCommands']
        skills?: Board['skills']
        autoCompactThreshold?: number
        isAutoCompactEnabled?: boolean
        autocompactSource?: string
        model?: string
        maxTokens?: number
        totalTokens?: number
        apiUsage?: ApiUsage | null
        rawMaxTokens?: number
      }
    }
    rateLimits?: RateLimit[]
    cost?: { usd: number }
  },
  detail: Board['detail'],
): Board {
  let next = applyHeadline(
    board,
    usage.context,
    usage.rateLimits ?? board.rateLimits,
    usage.cost?.usd,
  )
  next.detail = detail
  const br = usage.context.breakdown
  if (!br) return next
  next = {
    ...next,
    categories: br.categories ?? [],
    gridRows: br.gridRows ?? [],
    memoryFiles: br.memoryFiles ?? [],
    mcpTools: br.mcpTools ?? [],
    agents: br.agents ?? [],
    slashCommands: br.slashCommands,
    skills: br.skills,
    autoCompactThreshold: br.autoCompactThreshold,
    isAutoCompactEnabled: br.isAutoCompactEnabled,
    autocompactSource: br.autocompactSource,
    model: br.model,
    maxTokens: br.rawMaxTokens ?? br.maxTokens,
    totalTokens: br.totalTokens,
    apiUsage: br.apiUsage,
  }
  return next
}

export function afterCompact(board: Board): Board {
  return {
    ...emptyBoard(),
    window: board.window,
    waiting: true,
  }
}
