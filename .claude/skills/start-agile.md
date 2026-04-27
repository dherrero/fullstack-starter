---
name: start-agile
description: Enables Leantime kanban tracking for the current development session. Creates a project and one ticket per layer in Leantime, then updates ticket status as each subagent completes. Invoke this skill at the start of a session to activate agile mode.
---

# start-agile

This skill activates Leantime integration for the current session. When loaded, it replaces the standard "spawn and report" workflow with a kanban-tracked version. The standard workflow in CLAUDE.md still applies for everything not covered here.

## When to use

The user has explicitly requested agile mode — either by invoking this skill directly or by prefixing their instruction with `start-agile:`.

---

## Protocol

### Step 1 — Create the Leantime project

Call `create_project` with:

- `name`: a short, descriptive name derived from the feature specs (e.g. "Invoice management")
- `details`: one sentence summarising what will be built
- `start`: today's date (YYYY-MM-DD)

Store the returned project ID as `$projectId`.

### Step 2 — Discover kanban statuses

Call `get_status_labels` with `projectId: $projectId`.

From the returned list, identify:

- `$todoStatusId` — the status whose label means "open", "to do", "backlog", or "new" (pick the lowest-order one)
- `$doneStatusId` — the status whose label means "done", "closed", "completed", or "finished"

### Step 3 — Analyse the specs and decide layers

Follow the standard analysis from CLAUDE.md (database / backend / frontend). Only create tickets for layers that will actually be modified.

### Step 4 — Create one ticket per layer

For each affected layer, call `create_ticket` with:

- `headline`: `"[Layer] <feature name>"` — e.g. `"[Database] Invoice entity and migration"`
- `description`: the task brief you would normally pass to that subagent (what to implement, contracts from previous layers)
- `projectId`: `$projectId`
- `type`: `"task"`
- `status`: `$todoStatusId`

Store the returned ticket IDs:

- `$dbTicketId` (if database layer is included)
- `$backendTicketId` (if backend layer is included)
- `$frontendTicketId` (if frontend layer is included)
- `$qaTicketId` (always — QA always runs)

Output a confirmation message listing the project and tickets created, so the user can see the board is ready.

### Step 5 — Run subagents and update tickets

Run subagents in the standard order. After each subagent returns, immediately:

1. Output a progress line: `✓ [layer] done → updating Leantime ticket #$ticketId`
2. Call `update_ticket` with:
   - `id`: the ticket ID for that layer
   - `status`: `$doneStatusId`

Repeat for each layer in order:

- database-specialist completes → close `$dbTicketId`
- backend-developer completes → close `$backendTicketId`
- frontend-developer completes → close `$frontendTicketId`
- qa-engineer completes → close `$qaTicketId`

### Step 6 — Final summary

After all tickets are closed, call `get_project_progress` with `projectId: $projectId` and include the completion percentage in the final report to the user.

Final report format:

```
## Session complete

**Leantime project**: <project name> (#$projectId)
**Progress**: X% complete

### Implemented
- [database] <summary>
- [backend] <summary>
- [frontend] <summary>

### QA result: PASS | PASS WITH WARNINGS | FAIL
<QA summary>

### Pending manual steps
- <item>
```

---

## Error handling

If any Leantime call fails:

- Log the error in the progress output
- Continue with the standard workflow — do not block development because of a tracking failure
- Note the failure in the final report so the user can update Leantime manually
