# ConnectSphere

ConnectSphere is a pnpm workspace containing the mobile app, API, web/admin app,
and shared packages.

## Start here

1. Read `AGENTS.md`.
2. Read `docs/agent-handoffs/CURRENT.md`.
3. Confirm completed work is committed and reachable from `main`.
4. Create a `claude/<task>` or `codex/<task>` branch before editing.

## Active directories

| Area | Path |
| --- | --- |
| Expo mobile app | `artifacts/connectsphere-mobile` |
| Express API | `artifacts/api-server` |
| Web/admin app | `artifacts/connectsphere` |
| Shared packages | `lib` |
| UI prototype sandbox | `artifacts/mockup-sandbox` |
| Shared agent handoff | `docs/agent-handoffs/CURRENT.md` |
| Routing contract | `docs/architecture/ROUTING.md` |

## Core checks

```powershell
pnpm.cmd run typecheck
pnpm.cmd --filter @workspace/connectsphere-mobile exec jest --runInBand
pnpm.cmd --filter @workspace/api-server exec jest --runInBand
pnpm.cmd --dir artifacts/connectsphere-mobile/functions test -- --runInBand
pnpm.cmd --filter @workspace/connectsphere-mobile run audit:taps
```

Project details remain in `replit.md`; Claude-specific implementation history
remains in `CLAUDE.md`. Neither replaces the shared handoff.
