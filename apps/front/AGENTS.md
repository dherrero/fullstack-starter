# apps/front — Frontend (Angular 21)

> Layer-specific rules for the Angular app. See the root `AGENTS.md` for global
> conventions and path aliases (`@front/*`, `@dto`).

## Architecture

- **Standalone components only** — no NgModules. Declare `imports` on the component.
- **`OnPush` change detection** and the **Signals API** for reactive state.
- **Dependency injection via `inject()`**, never constructor parameter injection.
- **Native control flow** in templates: `@if` / `@for` / `@switch` — the auth
  structural directives were removed in favor of these (see git history).
- Reactive forms (`FormBuilder` + `Validators`) for all forms.

## Folder layout (`src/app/`)

| Path           | Contents                                                          |
| -------------- | ---------------------------------------------------------------- |
| `pages/`       | Routed feature components (`home`, `login`, …)                    |
| `components/`  | Reusable presentational components (`confirm`, `language-switcher`) |
| `services/`    | App-wide services; `abstract-state.class.ts` is the state base    |
| `libs/auth/`   | Auth slice: `auth.provider`, guards, interceptors, services       |
| `models/`      | View models (`state.model.ts`)                                    |
| `constants/`   | App constants (`languages.constant.ts`)                           |
| `app.config.ts`, `app.routes.ts` | Root providers and routing                      |

## Auth (`src/app/libs/auth/`)

- `guards/auth.guard.ts` — gate routes by authentication.
- `guards/auth-permission.guard.ts` — gate routes by `Permission` (from `@dto`).
- `interceptors/auth.interceptor.ts` — attach the access token / handle refresh.
- `auth.provider.ts` — wire it all into `app.config.ts`.
- Use these instead of inlining auth logic in components.

## Conventions

- **Import contracts from `@dto`** — `Permission`, `UserDTO`, etc. Never redefine
  server shapes locally; they are the single source of truth shared with the backend.
- **i18n via Transloco** (`@jsverse/transloco`). User-facing strings are translation
  keys (e.g. `login.errors.invalid`, `permissions.admin`); add them under
  `src/assets/i18n/`. Do not hardcode copy.
- Angular Material for UI primitives.
- Services that hold state extend `services/abstract-state.class.ts`.
- HTTP errors surface the API's `{ error }` payload — map to a translation key with a
  fallback (see `login.component.ts`).

## Testing

Vitest with co-located `*.spec.ts`. Cover guards, interceptors, and services (the auth
slice especially). Keep coverage > 60%. Run: `npx nx test front`.
