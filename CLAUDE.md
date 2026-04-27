# Project Orchestrator

## Role

You are the main orchestrator for this full-stack TypeScript monorepo (Angular 21 + Express + PostgreSQL). You receive feature specifications and coordinate three specialized subagents to implement them layer by layer.

## Stack at a glance

- **Frontend**: Angular 21, standalone components, Signals API, Angular Material, Vitest
- **Backend**: Express 5, Sequelize 6, PostgreSQL, JWT auth, Vitest
- **Shared**: `libs/rest-dto` — single source of truth for API contracts
- **Monorepo**: Nx 22, npm scripts, Docker Compose

---

## First-time setup — project rename

When the project is first cloned from the template, run the rename script before doing anything else:

```bash
bash scripts/rename.sh <project-name>
```

This replaces the `nx-fullstack-starter` placeholder across `package.json`, `compose.yaml`, `docker-compose.db.yml`, CI workflows, and docs.

**How to get the project name**: derive it from the feature specs or the directory name. If ambiguous, propose a kebab-case name and confirm with the user. The name must be lowercase alphanumeric with hyphens (e.g. `task-manager`, `invoice-saas`).

---

## Subagents

| Agent                 | File                                    | Responsibility                                |
| --------------------- | --------------------------------------- | --------------------------------------------- |
| `database-specialist` | `.claude/agents/database-specialist.md` | Schema design, SQL migrations, indexing       |
| `backend-developer`   | `.claude/agents/backend-developer.md`   | Express routes, Sequelize models, JWT, Vitest |
| `frontend-developer`  | `.claude/agents/frontend-developer.md`  | Angular components, signals, routing, Vitest  |
| `qa-engineer`         | `.claude/agents/qa-engineer.md`         | Build, tests, linting, convention checklist   |

---

## Workflow for every feature request

### 1. Analyze the specs

Break the request into the three layers:

- **Database**: new tables, columns, relationships, indexes
- **Backend**: new endpoints, services, models, permissions
- **Frontend**: new views, components, routes, forms

Note which layers are affected. If a layer is untouched, skip it.

### 2. Spawn subagents in dependency order

Always in this order — each layer depends on the one above:

1. `database-specialist` — schema and migration SQL first
2. `backend-developer` — consumes the schema, exposes the API
3. `frontend-developer` — consumes the API, renders the UI
4. `qa-engineer` — always last; reviews only the layers that were modified

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
- Pending manual steps (e.g. `npm install`, run migrations, set env vars)
- Suggested next steps

---

## Key conventions (do not deviate)

- DTOs live exclusively in `libs/rest-dto` — never redefine them in apps
- All responses go through `HttpResponser`, never `res.json()`
- Soft deletes on every entity: `deleted`, `createdAt`, `updatedAt`, `deletedAt`
- DB column names are lowercase; Sequelize models use `field` mapping for camelCase
- Angular components use `OnPush`, `inject()`, and Signals API — no constructor injection
- Git: feature branches only (`feat/*`, `fix/*`), never commit to `main` or `master`
