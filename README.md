# Claude Code mods

A small CLI cockpit for teams running Claude Code in the terminal (including Bedrock) who already have agents, hooks, and instruction files. These mods draw live UI and can hold a tool call — they don't replace what you already have.

1. **context-board** — compact context card above the prompt, plus a one-line kit strip of what this session actually loaded
2. **agents-side** — a pane of the main loop and every subagent it spawns
3. **session-map** — files Claude read, edited, or wrote this session, grouped by monorepo app
4. **blast-radius** — holds risky Bash until you Proceed or Cancel

Needs Claude Code **2.1.287+** (written against **2.1.290**). If mods do not load, export `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

## Install

```bash
claude plugin marketplace add yogeshvar/mod-claude
claude plugin install agents-side@mod-claude
claude plugin install context-board@mod-claude
claude plugin install session-map@mod-claude
claude plugin install blast-radius@mod-claude
```

Or clone and load for one session:

```bash
git clone https://github.com/yogeshvar/mod-claude.git
cd mod-claude
./start-claude
```

Then:

1. Stretch the terminal to at least **110 columns** (144 if you want unasked panes to auto-dock). Run `/tui fullscreen` so panes sit beside the transcript.
2. The **context** card sits above the prompt: used vs window, compact threshold, a stacked color bar, a small legend, and a kit line (`skills 4 · agents 2 · CLAUDE.md · plugins …`).
3. Ask Claude to spawn a couple of subagents. If the agents pane did not auto-open, run `/agents-side`.
4. Run `/session-map` after Claude has read files. Rows group under `apps/api`, `apps/web`, `apps/mobile`, and `root`.
5. A `pnpm migrate`, `git reset --hard`, `git push --force`, `DROP TABLE`, `rm -rf`, or `rm .env` opens **Blast Radius**. `1` proceeds, `2` cancels. This is a safety net, not a permission system — keep hard denies in managed settings.

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
| session-map | `/session-map` | Open or close the file pane |
| session-map | `/session-map clear` | Drop the file list |
| session-map | `/session-map close` | Close the pane |
| blast-radius | `/blast-radius` | Re-open the hold pane if a command is waiting |
| blast-radius | `/blast-radius close` | Cancel the held command |

On the agents pane, keys `1`–`9` select a row (focus the pane first: click it, or `ctrl+x tab`). `c` clears finished agents, `x` closes it.

On the context pane: `r` refresh, `x` close.

On the session map: `c` clear, `x` close.

On Blast Radius: `1` Proceed, `2` Cancel.

`openOnStart` (agents pane; session-map, off by default) and `openPaneOnStart` (context pane, off by default) are plugin options under `/config`.

## Bedrock and team machines

Claude Code on Amazon Bedrock / an API key does **not** load the built-in `sec-default` guard unless you push **managed settings**. Without that, a user-installed mod can override deny rules.

For the team:

1. Allow this marketplace (and block unknown ones) in managed settings.
2. Put `sec-default` in `prependPlugins`.
3. Keep production denies in permission rules. Blast Radius only holds commands whose *text* looks risky (`$(…)` and scripts that call `rm` can still get past it).
4. On Bedrock, `$.session.usage()` may omit `cost`. The context card then shows tokens and the window only — it does not invent dollars.

## What each one shows

**context-board** calls `$.session.usage({ breakdown: "summary" })` after each main-loop turn (local estimates, no extra API). `/context-board refresh` uses `breakdown: "full"`. The kit strip reads enabled plugins from settings, `CLAUDE.md` / `AGENTS.md` from the instruction walk, skill and agent counts from usage, and the last `Skill` tool name.

**agents-side** watches `agent.spawn`, `tool.call`, `turn.start`, `turn.complete`, and `session.measure`. It never blocks those events.

**session-map** observes `Read`, `Edit`, `Write`, and `Glob` after they run. It never blocks.

**blast-radius** classifies Bash, dry-runs `git status` / `git clean -n` when it can, and holds the call until Proceed or Cancel.

## Check the plugins

```bash
claude plugin validate .
claude plugin validate ./plugins/agents-side
claude plugin validate ./plugins/context-board
claude plugin validate ./plugins/session-map
claude plugin validate ./plugins/blast-radius
claude plugin test ./plugins/agents-side
claude plugin test ./plugins/context-board
claude plugin test ./plugins/session-map
claude plugin test ./plugins/blast-radius
```
