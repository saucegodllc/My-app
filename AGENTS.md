# ConnectSphere Shared Agent Rules

This is the shared source of truth for Claude, Codex, and other coding agents.
Read it before editing files.

## Source of truth

- The source-of-truth branch is `main`.
- The protected application baseline is commit `933636c`.
- That baseline contains Claude checkpoint `4dac179` and later Codex fixes.
- Do not merge the old `origin/main` implementation into the current app. It
  is preserved as `archive/2026-06-23/legacy-origin-main-replit`.
- Read `docs/agent-handoffs/CURRENT.md` before beginning a task.
- Read `docs/architecture/ROUTING.md` before changing navigation, deep links,
  notifications, tabs, or paywall destinations.

## Active application

- Mobile: `artifacts/connectsphere-mobile`
- API: `artifacts/api-server`
- Web/admin: `artifacts/connectsphere`
- Shared packages: `lib`
- Prototype/reference UI: `artifacts/mockup-sandbox`

Copies in snapshots, ZIPs, import folders, or old worktrees are not active
source code.

## Starting work

Never start from whichever branch happens to be open.

1. Save and commit existing approved work. Never discard another agent's work.
2. Run `git status --short --branch`.
3. Switch to `main` and synchronize with the latest approved checkpoint.
4. Read `docs/agent-handoffs/CURRENT.md`.
5. Create `claude/<task-name>` or `codex/<task-name>`.
6. Record the branch, goal, and owned files in the active handoff.

If another agent owns a needed file, reconcile first. Do not edit the same file
concurrently in separate worktrees.

## Finishing work

Work is not transferred until it is committed.

1. Review `git diff` and remove accidental generated output.
2. Run checks appropriate to the changed areas.
3. Commit the approved code.
4. Update `docs/agent-handoffs/CURRENT.md` with the branch, commit, changed
   files, behavior, visual impact, tests, unfinished work, and exact next task.
5. Commit the handoff.
6. Integrate into `main` only after conflicts and visual changes are reviewed.

Never report work as complete while relevant changes remain uncommitted.

## Visual freeze

Unless the user explicitly requests a redesign, preserve:

- layout, spacing, typography, colors, gradients, animation, and assets;
- tab order, routes, modals, gestures, and navigation;
- safe-area behavior and responsive sizing.

For every touched screen, record `Visual changes: none` in the handoff. If a
visual change is intentional, list every affected screen and capture comparable
before/after screenshots.

Never resolve a UI conflict by accepting an entire branch. Merge the intended
behavior into the current canonical screen.

Routing changes must follow `docs/architecture/ROUTING.md` and update its HTML
companion maps in the same commit.

## Generated and local files

Do not manually edit:

- `lib/api-client-react/src/generated`
- `lib/api-zod/src/generated`
- `artifacts/connectsphere-mobile/functions/lib`
- build output, coverage, caches, Expo exports, tunnel manifests, QR images, or
  logs.

Regenerate API clients through the API specification workflow. Build Firebase
Functions output from `functions/src`.

Do not treat `artifacts/work-snapshots`, `_replit_import_*`, ZIP files, or
`ConnectSphere Official` as live source.

## Required verification

Use the relevant commands and record exact results:

```powershell
pnpm.cmd run typecheck
pnpm.cmd --filter @workspace/connectsphere-mobile exec jest --runInBand
pnpm.cmd --filter @workspace/api-server exec jest --runInBand
pnpm.cmd --dir artifacts/connectsphere-mobile/functions test -- --runInBand
pnpm.cmd --filter @workspace/connectsphere-mobile run audit:taps
```

Run focused checks during development and full relevant suites before broad
integration. Document pre-existing failures; never silently blame the other
agent.

## Conflict and recovery policy

- Never use `git reset --hard`, force-push, or branch deletion as a handoff fix.
- Preserve concurrent work on reachable branches.
- Rebase or merge only after checking ownership and the handoff.
- Codex performs final reconciliation when branches diverge, preserving
  Claude's committed behavior and documenting any adjustment.
- Dated archive branches are recovery points, not development branches.
