---
name: start-agile
description: Activates Leantime kanban tracking. On first run it creates a Leantime project and persists the ID in CLAUDE.md. On subsequent runs it reuses the existing project. For each feature, the orchestrator creates prioritised tickets (blocking tasks first), moves them to in-progress when assigning to a subagent, and closes them when the subagent reports completion.
---

# start-agile

This skill activates Leantime integration for the project. It is designed to be invoked once per project (project setup) and then once per feature (task tracking). The standard orchestrator workflow in CLAUDE.md still applies for everything not covered here.

## When to use

The user has explicitly requested agile mode — either by invoking this skill directly or by prefixing their instruction with `start-agile:`.

---

## Protocol

### Step 0 — Check for an existing Leantime project

Read `CLAUDE.md` and search for a line matching:

```
Leantime project ID: <id>
```

- **If found**: store the value as `$projectId` and skip to Step 2.
- **If not found**: proceed to Step 1 to create the project.

---

### Step 1 — Create the Leantime project (first run only)

Call `create_project` with:

- `name`: the software project name — derive it from the directory name or the feature specs (kebab-case to sentence-case, e.g. `task-manager` → `"Task Manager"`)
- `details`: one sentence describing what the product does
- `start`: today's date (YYYY-MM-DD)

Store the returned project ID as `$projectId`.

Then append the following block to `CLAUDE.md` using the Edit tool:

```markdown
## Leantime Integration

Leantime project ID: $projectId
```

Replace `$projectId` with the actual numeric value. Confirm to the user that the Leantime project has been created and its ID registered.

---

### Step 2 — Discover kanban statuses

Call `get_status_labels` with `projectId: $projectId`.

From the returned list, identify and store:

- `$todoStatusId` — label meaning "open", "to do", "backlog", or "new" (lowest-order)
- `$inProgressStatusId` — label meaning "in progress", "doing", or "active"
- `$doneStatusId` — label meaning "done", "closed", "completed", or "finished"

If there is no explicit in-progress status, use `$todoStatusId` for the initial state and skip the in-progress transitions below.

---

### Step 3 — Analyse the specs and decide layers

Follow the standard analysis from CLAUDE.md (database / backend / frontend). Only plan tickets for layers that will actually be modified.

---

### Step 4 — Create tickets in priority order (blocking tasks first)

Create tickets in dependency order so the board reflects what must be done before anything else can start. Always create database before backend, backend before frontend, and QA last.

For each layer to implement, call `create_ticket` with:

- `headline`: `"[Layer] <feature name>"` — e.g. `"[Database] Invoice entity and migration"`
- `description`: the task brief for that subagent (what to implement, contracts from previous layers, acceptance criteria)
- `projectId`: `$projectId`
- `type`: `"task"`
- `status`: `$todoStatusId`

Create tickets in this exact order (skip layers not affected):

1. **[Database]** — blocking: backend cannot start until migration exists
2. **[Backend]** — blocking: frontend cannot start until API is available
3. **[Frontend]** — depends on backend API
4. **[QA]** — always last; depends on all implemented layers

Store the returned ticket IDs:

- `$dbTicketId` (if database layer is included)
- `$backendTicketId` (if backend layer is included)
- `$frontendTicketId` (if frontend layer is included)
- `$qaTicketId` (always)

Output a board-ready confirmation listing all created tickets so the user can see the Leantime board is populated.

---

### Step 5 — Run subagents with orchestrated state management

For each layer in dependency order, the orchestrator:

1. **Assigns the ticket** — call `update_ticket` with `status: $inProgressStatusId` before spawning the subagent. Output:
   ```
   → [layer] Assigned ticket #$ticketId (in progress) — spawning subagent...
   ```
2. **Spawns the subagent** — pass the structured task brief (feature name, layer, what to implement, contracts from previous layers).
3. **Closes the ticket** — after the subagent returns, call `update_ticket` with `status: $doneStatusId`. Output:
   ```
   ✓ [layer] Done — ticket #$ticketId closed.
   ```

Run in this order:

```
database-specialist  → $dbTicketId
backend-developer    → $backendTicketId
frontend-developer   → $frontendTicketId
qa-engineer          → $qaTicketId
```

Only run subagents for the layers that have tickets. After each layer completes, immediately transition its ticket before starting the next one.

---

### Step 6 — Final summary

After all tickets are closed, call `get_project_progress` with `projectId: $projectId` and include the completion percentage in the final report.

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

- Log the error in the progress output.
- Continue with the standard workflow — never block development because of a tracking failure.
- Note the failure in the final report so the user can update Leantime manually.
- If Step 1 (project creation) fails, skip Step 2–6 Leantime calls entirely and run the standard orchestrator workflow without tracking.
