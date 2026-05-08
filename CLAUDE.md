# CLAUDE.md

Claude Code entry. Shared rules are in `AGENTS.md` and `docs/`.

## Must

- Read `AGENTS.md` before code changes.
- If this file conflicts with `AGENTS.md` or `docs/`, follow `AGENTS.md`/`docs/`.
- Use the `AGENTS.md` docs map for task-specific rules.
- After edits, run the required checks from `AGENTS.md`; if skipped, say why.

## Quick Rules

- No Tailwind `className` on antd/antdX component bodies.
- z-index uses `--z-index-*` tokens only; no raw numbers.
- New business validation defaults to `src/labs/`; existing stable ownership may go to stable.
- Cross-module imports use public barrels; no deep imports.
- Chinese commits: `<type>(<scope>): <subject>` plus body.
