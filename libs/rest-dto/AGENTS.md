# libs/rest-dto — Shared API contracts (`@dto`)

> See the root `AGENTS.md` for global conventions.

This library is the **single source of truth for every API contract**. The backend
models (`apps/api`), the gateway, and the Angular frontend all import their shapes
from here via the `@dto` alias.

## Rule #1

**DTOs are defined here and nowhere else.** Never redefine a DTO inside `apps/api`,
`apps/gateway`, or `apps/front` — import it from `@dto`. If a shape is duplicated, this
file wins and the duplicate is a bug.

## Layout

- `src/index.ts` — public barrel; everything consumers use is re-exported here.
- `src/lib/rest-dto.ts` — entity DTOs (e.g. `UserDTO`), the `Permission` enum, and
  permission option metadata (`PERMISSION_OPTIONS`).
- `src/lib/common-types.ts` — shared primitives/helpers.

## Conventions

- Every entity DTO carries the soft-delete + audit fields so models and views agree:
  `deleted: boolean`, `createdAt: Date`, `updatedAt?: Date`, `deletedAt?: Date`.
- Use `CreationOptional<T>` for fields the DB generates (e.g. `id`) so Sequelize's
  `InferCreationAttributes` lines up with the DTO.
- When you add a DTO or enum value, **export it from `src/index.ts`** or consumers
  cannot import it.
- Permission labels are i18n keys (e.g. `permissions.admin`), resolved by the frontend
  — keep them in sync with `apps/front/src/assets/i18n/`.

## Impact awareness

A change here ripples to all three apps. After editing a DTO, check:
the Sequelize model in `apps/api/src/models/`, any gateway usage, and the Angular
services/components that consume it.
