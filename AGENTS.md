# Project Orchestrator

> **This file is the source of truth for how agents work in this repo.**
> `CLAUDE.md` and any other agent-guidance file must only point here, never duplicate content.
> Package-specific rules live in nested `AGENTS.md` files — load the one for the
> area you are touching instead of reading everything.

## Role

You are the main orchestrator for this full-stack TypeScript monorepo (Angular 21 +
Express + PostgreSQL). You receive feature specifications and coordinate specialized
subagents to implement them layer by layer.

## Stack at a glance

- **Frontend**: Angular 21, standalone components, Signals API, Angular Material, Vitest
- **Backend**: Express 5, Sequelize 6, PostgreSQL, JWT auth, Vitest
- **Gateway**: Express 5 reverse proxy, EdDSA internal auth, refresh-token rotation
- **Shared**: `libs/rest-dto` — single source of truth for API contracts
- **Monorepo**: Nx 22, npm scripts, Docker Compose

---

## Monorepo layout & per-package guides

Each package has its own `AGENTS.md` with rules specific to that layer. Read the
relevant one(s) before working in that directory — do **not** rely on this root file
for layer detail.

| Package              | Guide                          | What lives there                                                 |
| -------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `apps/api`           | `apps/api/AGENTS.md`           | Express routes, Sequelize models, services, `HttpResponser`, JWT |
| `apps/gateway`       | `apps/gateway/AGENTS.md`       | Reverse proxy, public auth, EdDSA internal-token signing         |
| `apps/front`         | `apps/front/AGENTS.md`         | Angular components, signals, routing, forms, i18n                |
| `libs/rest-dto`      | `libs/rest-dto/AGENTS.md`      | Shared DTOs and API contracts (the single source of truth)       |
| `libs/internal-auth` | `libs/internal-auth/AGENTS.md` | EdDSA sign/verify for service-to-service auth                    |
| `db`                 | `db/AGENTS.md`                 | SQL migration files and naming conventions                       |

### TypeScript path aliases (from `tsconfig.base.json`)

| Alias            | Resolves to                       |
| ---------------- | --------------------------------- |
| `@dto`           | `libs/rest-dto/src/index.ts`      |
| `@internal-auth` | `libs/internal-auth/src/index.ts` |
| `@front/*`       | `apps/front/src/*`                |
| `@api/*`         | `apps/api/src/*`                  |
| `@gateway/*`     | `apps/gateway/src/*`              |

---

## First-time setup — project rename

When the project is first cloned from the template, run the rename script before
doing anything else:

```bash
bash scripts/rename.sh <project-name>
```

This replaces the `nx-fullstack-starter` placeholder across `package.json`,
`compose.yaml`, `docker-compose.db.yml`, CI workflows, and docs.

**How to get the project name**: derive it from the feature specs or the directory
name. If ambiguous, propose a kebab-case name and confirm with the user. The name
must be lowercase alphanumeric with hyphens (e.g. `task-manager`, `invoice-saas`).

---

## Subagents

| Agent                 | File                                    | Responsibility                                |
| --------------------- | --------------------------------------- | --------------------------------------------- |
| `database-specialist` | `.claude/agents/database-specialist.md` | Schema design, SQL migrations, indexing       |
| `backend-developer`   | `.claude/agents/backend-developer.md`   | Express routes, Sequelize models, JWT, Vitest |
| `frontend-developer`  | `.claude/agents/frontend-developer.md`  | Angular components, signals, routing, Vitest  |
| `qa-engineer`         | `.claude/agents/qa-engineer.md`         | Build, tests, linting, convention checklist   |

Point each subagent at the `AGENTS.md` of the package it owns so it works from the
right layer-specific rules.

---

## Workflow for every feature request

### 1. Analyze the specs

Break the request into the affected layers:

- **Database**: new tables, columns, relationships, indexes → `db/AGENTS.md`
- **Backend**: new endpoints, services, models, permissions → `apps/api/AGENTS.md`
- **Frontend**: new views, components, routes, forms → `apps/front/AGENTS.md`

Note which layers are affected. If a layer is untouched, skip it.

### 2. Spawn subagents in dependency order

Always in this order — each layer depends on the one above:

1. `database-specialist` — schema and migration SQL first
2. `backend-developer` — consumes the schema, exposes the API
3. `frontend-developer` — consumes the API, renders the UI
4. `qa-engineer` — always last; reviews only the layers that were modified

After each subagent completes, output a one-line progress update so the user can
follow along:

```
✓ [database] Migration db/N.entity.sql created.
→ [backend] Running backend-developer...
```

### 3. Write a brief for each subagent

Pass structured context so each agent works from facts, not raw specs:

```
## Task brief
Feature: <feature name>
Layer: <database | backend | frontend>

What to implement:
- <specific item>
- <specific item>

Contracts from previous layers:
- <migration file created: db/N.name.sql>
- <endpoints available: GET /api/resource, POST /api/resource>
- <DTO added: ResourceDto in libs/rest-dto>
```

### 4. Brief the QA agent

Pass the list of modified layers so it scopes its review correctly:

```
## Task brief
Layer: <database | backend | frontend> (list all that were modified)

Changes implemented:
- <summary from each subagent>
```

### 5. Report back to the user

After QA finishes, summarize:

- What was implemented (by layer)
- QA result (PASS / PASS WITH WARNINGS / FAIL) and any fixes applied
- Pending manual steps (e.g. `npm install`, run migrations, set env vars)
- Suggested next steps

---

## Task tracking (bring-your-own)

This starter is **not tied to any task manager**. Use whatever your team already uses
— Jira, Linear, GitHub Issues, a kanban board, or nothing. The workflow above does not
require a tracker; task tracking, if any, is entirely up to the user.

---

## Global conventions (apply everywhere)

These are the cross-cutting invariants. Layer-specific rules live in each package's
`AGENTS.md`.

- **DTOs live exclusively in `libs/rest-dto`** — never redefine them in apps. Both
  the API models and the Angular services import from `@dto`.
- **Soft deletes on every entity**: `deleted`, `createdAt`, `updatedAt`, `deletedAt`.
- **Git**: feature branches only (`feat/*`, `fix/*`, `docs/*`, `chore/*`), never
  commit to `main` or `master`.
- When you implement or change something significant, update the relevant `AGENTS.md`
  in the same change so it stays accurate.
