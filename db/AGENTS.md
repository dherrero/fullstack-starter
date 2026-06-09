# db — SQL migrations (PostgreSQL)

> See the root `AGENTS.md` for global conventions. Owned by the `database-specialist`
> subagent. (Note: `migrations.json` at the repo root is **Nx's** migration log, not
> this — DB schema lives only in the `.sql` files here.)

## File naming

`db/<N>.<entity>.sql`, where `N` is a numeric prefix that defines apply order. Group
related changes by tens so there's room to insert:

```
10.user.sql                         # base entity
11.permission_enum_migration.sql    # follow-up to the same entity
20.refresh_token_family.sql         # next entity
```

A new entity gets the next free ten (`30.*`); an alteration to an existing one gets the
next free unit after its base file.

## Conventions (must match the Sequelize models in apps/api)

- **Table names: lowercase, singular**, in `public` (e.g. `public.user`).
- **Column names: lowercase, no camelCase** — the model maps them with `field`
  (`lastname`, `createdat`, …). The audit columns may appear as `createdAt`/`updatedAt`
  in SQL but resolve case-insensitively; keep new columns lowercase.
- **Every entity carries soft-delete + audit columns**:
  ```sql
  deleted    boolean DEFAULT false,
  createdAt  timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt  timestamp without time zone,
  deletedAt  timestamp without time zone
  ```
- Use an explicit `SEQUENCE` owned by the PK column for auto-increment ids (see
  `10.user.sql`), and `bigint` for ids.
- Enums are real PG types (`CREATE TYPE … AS ENUM (...)`) and must match the enum in
  `libs/rest-dto` (e.g. `permission_type` ↔ `Permission`).
- Add indexes for foreign keys and frequent lookup/filter columns.
- Seed/bootstrap rows go at the end of the file and must reset the sequence
  (`SELECT pg_catalog.setval(...)`).

## Workflow when adding an entity

1. Write the migration here following the conventions above.
2. Keep the column set in lockstep with the DTO (`libs/rest-dto`) and the Sequelize
   model (`apps/api/src/models/`) — the three must agree.
3. Report the created filename back to the orchestrator so the backend brief can
   reference it.
