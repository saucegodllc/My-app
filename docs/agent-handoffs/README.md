# Agent handoffs

This directory carries working context between Claude and Codex.

- `CURRENT.md` is the only active cross-agent handoff.
- Update and commit it at the end of every session.
- Git history archives previous handoff states.

Code transfers through commits. The handoff explains the intent, verification,
and next step for those commits.

## Required fields

```markdown
## Current checkpoint
- Branch:
- Application commit:
- Agent:
- Date:

## Goal
## Changed files
## Functionality
## Visual changes
## Verification
## Unfinished work
## Next task
## File ownership
```

