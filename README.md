# Claude Code mods

Two plugins for [Claude Code mods](https://claude.com/blog/claude-code-mods):

1. **agents-side** — a pane of the main loop and every subagent it spawns
2. **context-board** — a compact context card above the prompt: stacked category bar, percent, and a wrapping legend

Needs Claude Code **2.1.287+** (written against **2.1.290**). If mods do not load, export `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

## Install

```bash
claude plugin marketplace add yogeshvar/mod-claude
claude plugin install agents-side@mod-claude
claude plugin install context-board@mod-claude
```

Or clone and load for one session:

```bash
git clone https://github.com/yogeshvar/mod-claude.git
cd mod-claude
claude --plugin-dir ./plugins/agents-side --plugin-dir ./plugins/context-board
```

Then:

1. Stretch the terminal to at least **110 columns** (144 if you want the agents pane to auto-open). Run `/tui fullscreen` so the pane docks beside the transcript.
2. The **context** card sits above the prompt: used vs window, compact threshold, a stacked color bar, and a small legend (system prompt, tools, MCP, agents, memory, skills, messages, free).
3. Ask Claude to spawn a couple of subagents, for example: `use Explore to map this repo, then a Plan agent to suggest a small refactor`. If the agents pane did not auto-open, run `/agents-side`.

### Commands

| Plugin | Command | What it does |
| --- | --- | --- |
| agents-side | `/agents-side` | Open or close the pane |
| agents-side | `/agents-side clear` | Drop finished agents |
| agents-side | `/agents-side close` | Close the pane |
| context-board | `/context-board` | Open or close the pane (the bar stays) |
| context-board | `/context-board refresh` | Recount every category with the token-count API |
| context-board | `/context-board pane` | Force-open the pane |
| context-board | `/context-board close` | Close the pane |

On the agents pane, keys `1`–`9` select a row (focus the pane first: click it, or `ctrl+x tab`). `c` clears finished agents, `x` closes it.

On the context pane: `r` refresh, `x` close.

`openOnStart` (agents pane) and `openPaneOnStart` (context pane, off by default) are plugin options under `/config`.

## What each one shows

**agents-side** watches `agent.spawn`, `tool.call`, `turn.start`, `turn.complete`, and `session.measure`. It never blocks those events. Each row is the main loop or a subagent, nested under the loop that spawned it, with status, tool count, last tools, and the prompt/answer when you select it.

**context-board** calls `$.session.usage({ breakdown: "summary" })` after each main-loop turn (local estimates, no extra API). `/context-board refresh` uses `breakdown: "full"`, which spends one token-count request per tool and memory file. The card is the `AbovePrompt` site, so it stays visible without replacing Claude's own `/context` command.

## Check the plugins

```bash
claude plugin validate .
claude plugin validate ./plugins/agents-side
claude plugin validate ./plugins/context-board
claude plugin test ./plugins/agents-side
claude plugin test ./plugins/context-board
```
