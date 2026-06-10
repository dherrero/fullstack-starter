# apps/api — Backend (Express 5 + Sequelize 6 + PostgreSQL)

> Layer-specific rules for the API service. See the root `AGENTS.md` for global
> conventions, the orchestration workflow, and path aliases.

The API service sits **behind the gateway**. Public requests never reach it directly:
the gateway authenticates the user and forwards the call to `/v1/*` carrying a signed
internal EdDSA token. See `apps/gateway/AGENTS.md` and `libs/internal-auth/AGENTS.md`.

## Layered architecture

Follow the layering strictly — each layer only talks to the one below it:

```
routes → controllers → services → models → (db via Sequelize)
```

- `src/routes/` — Express routers, wire URL + middleware to a controller method.
- `src/controllers/` — translate HTTP ↔ domain; respond only through `HttpResponser`.
- `src/services/` — business logic and data access; extend `AbstractCrudService`.
- `src/models/` — Sequelize model definitions, typed against the DTO from `@dto`.
- `src/adapters/` — `http/http.responser.ts` (responses) and `db/pg.connector.ts` (the `db` Sequelize instance).
- `src/middleware/` — e.g. `db-error.middleware.ts`.

## Adding a CRUD entity (the minimal-boilerplate path)

1. Add/confirm the DTO in `libs/rest-dto` (`@dto`) — never define it here.
2. Add the migration in `db/` (see `db/AGENTS.md`).
3. **Model** (`src/models/<entity>.model.ts`): `db.define<Model>(...)` typed via
   `interface XModel extends XDTO, Model<InferAttributes<…>, InferCreationAttributes<…>> {}`.
4. **Service** (`src/services/<entity>-crud.service.ts`): `extends AbstractCrudService`,
   pass the model to `super(Model)`. You inherit `getAllPaged`, `getAll`, `getById`,
   `post`, `put`, `delete`.
5. **Controller** (`src/controllers/<entity>-crud.controller.ts`): `extends AbstractCrudController`.
6. **Routes** (`src/routes/<entity>-crud.routes.ts`): register and export from `src/routes/index.ts`.

## Hard rules (do not deviate)

- **All responses go through `HttpResponser`**, never `res.json()` / `res.send()`
  directly. Use `successJson`, `successEmpty`, `errorJson`.
- **Soft delete only.** `AbstractCrudService.delete` sets
  `{ deleted: true, deletedAt: CURRENT_TIMESTAMP }` — never hard-delete rows.
- **DB column names are lowercase**; the model maps camelCase ↔ lowercase with the
  `field` option (e.g. `lastName → field: 'lastname'`, `createdAt → field: 'createdat'`).
  The DB table name is set via `tableName`.
- **Never expose `password`.** `AbstractCrudService` excludes `password` from every
  read, and excludes `deleted`/`deletedAt` unless `where.deleted` is set.
- Models import their shape from `@dto`; do not duplicate field types locally.
- **Validate every client input.** Never pass `req.body` / `req.query` / `req.params`
  to a service unvalidated. Put a `validate(schema, source)` middleware
  (`src/middleware/validate.middleware.ts`) in front of the controller, using a
  Zod schema from `@dto` (`userCreateSchema`, `userUpdateSchema`,
  `paginationQuerySchema`, `idParamSchema`, …). Input schemas are `.strict()`, so
  unknown keys are rejected at the edge — this, plus the service-layer
  `writableFields` allow-list, is the mass-assignment defense. Because `req.query`
  is a read-only getter in Express 5, the parsed query is exposed on
  `res.locals.query` (read it from there), while body/params are replaced in place.

## Internal auth

Routes meant to be reached via the gateway live under `/v1/*` and must verify the
internal EdDSA token (`@internal-auth`), not the public access token. System-to-system
endpoints (`/internal/auth/*`) verify a system-scoped token. The auth/refresh-token
logic lives in `src/services/auth.service.ts` and `refresh-token-family.service.ts`.

## Testing

- Vitest, co-located `*.spec.ts` next to the unit under test.
- Cover services and middleware; keep coverage > 60% (qa-engineer enforces this).
- Run: `npx nx test api` (or the repo's configured script).
