# Current Claude ↔ Codex handoff

## Current checkpoint

- Branch: `main`
- Application commit: `933636c7c9ed23d5b654a991d40294bf80d232df`
- Claude checkpoint included: `4dac179` (`chore: checkpoint claude launch work`)
- Codex follow-up included: `933636c` (`fix: resolve connectsphere launch regressions`)
- Agent: Codex reconciliation
- Date: 2026-06-23

## Goal

Continue one shared ConnectSphere implementation. Claude's committed work is
Codex's starting state, and Codex's committed work is Claude's starting state.

## Changed files

This reconciliation adds shared workflow and handoff documentation. It does not
alter application source, styles, routes, API behavior, or assets.

Routing is now fully described in `docs/architecture/ROUTING.md`: auth guards,
visible and hidden tabs, root stack routes, chat-ID rules, profile fallbacks,
deep links, notifications, AI navigation tokens, premium parameters, and the
required routing-change checklist.

Two previously untracked visual references are preserved with this checkpoint:

- `connectsphere-routing-map.html`
- `connectsphere-plus-paywall-routing.html`

## Functionality

The canonical application remains at `933636c`. No old divergent branch was
merged. Claude checkpoint `4dac179` is an ancestor of the canonical state, so
its code is present rather than represented only by notes.

## Visual changes

None.

## Verification

Before reconciliation:

- The secondary `friends-connect-handoff` worktree was clean.
- `git merge-base --is-ancestor 4dac179 HEAD` passed.
- `git merge-base --is-ancestor 933636c HEAD` passed.

Post-change verification on 2026-06-23:

- `pnpm.cmd run typecheck` — failed in the existing mockup sandbox because two
  React type installations disagree in `calendar.tsx` and `spinner.tsx`.
- Mobile Jest — 30 suites passed, 10 failed, 1 skipped; 426 tests passed,
  59 failed, and 8 skipped. Existing failures include stale component
  assertions, router/AsyncStorage mocks, and analytics capture setup.
- API Jest — 5 suites passed and 2 failed; 55 tests passed and 2 failed.
  Existing failures are the inbox message fixture and unauthenticated
  icebreaker expectation.
- Firebase Functions Jest — 6 tests passed and 2 failed in the existing
  `withdrawReaction` suite.
- Tap audit — failed on five existing controls without handlers in Matches and
  Communities screens.

No failure is in a file changed by this reconciliation. These are now explicit
baseline debts; future agents must not claim they were introduced by the
handoff workflow.

## Unfinished work

- Publish unified `main` safely. Remote `origin/main` is an older divergent
  visual history and must not be force-overwritten.
- Change the GitHub default branch only after unified `main` is pushed and
  reviewed.
- Remove stale branches/worktrees only after archive refs are pushed.
- Future feature work must use `claude/<task>` or `codex/<task>`.

## Next task

Commit this workflow checkpoint, then fix the documented baseline test and tap
audit debt on a dedicated `codex/baseline-quality-gates` or
`claude/baseline-quality-gates` branch. Push unified `main` as a reviewed branch
before changing the remote default branch.

## File ownership

- Active owner: Codex
- Owned files: shared workflow documentation and root repository index
- Protected files: all active application files listed in `AGENTS.md`
