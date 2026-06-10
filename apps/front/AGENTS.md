# apps/front — Frontend (Angular 21)

> Layer-specific rules for the Angular app. See the root `AGENTS.md` for global
> conventions and path aliases (`@front/*`, `@dto`).

## Who works here: developer vs. designer

Two agents share this app and must not edit the same file at once (the orchestrator
sequences them — see the root `AGENTS.md`):

- **`frontend-developer`** — feature logic: component TS, signals/state, routing, guards,
  forms, services/HTTP, unit tests.
- **`ux-ui-designer`** — experience layer: visual design & **design tokens** (`styles.scss`),
  responsive mobile-first layout, accessibility (WCAG 2.2 AA / ARIA), SEO (per-route
  `Title`/`Meta`, structured data) and PWA (manifest, service worker). Owns styles,
  `index.html`, manifest/`ngsw-config.json`, i18n copy keys, and template markup for
  semantics/ARIA/`alt`/classes — not component logic. Skills: `/frontend-design`,
  `/web-design-review`, `/angular-pwa-seo`.

Developers consume the designer's tokens — **no hardcoded colors/spacing** outside the
token layer. Inside a `.html`, the designer owns semantics/ARIA/classes, the developer
owns bindings and control flow.

> **Stack note**: this app uses **Bootstrap 5 + `@ng-bootstrap/ng-bootstrap`** and the
> **Lineicons** font — not Angular Material or Tailwind. Theme via Bootstrap's `--bs-*`
> variables driven from the design tokens.

## Architecture

- **Standalone components only** — no NgModules. Declare `imports` on the component.
- **`OnPush` change detection** and the **Signals API** for reactive state.
- **Dependency injection via `inject()`**, never constructor parameter injection.
- **Native control flow** in templates: `@if` / `@for` / `@switch` — the auth
  structural directives were removed in favor of these (see git history).
- Reactive forms (`FormBuilder` + `Validators`) for all forms.

## Folder layout (`src/app/`)

| Path                             | Contents                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| `pages/`                         | Routed feature components (`home`, `login`, …)                      |
| `components/`                    | Reusable presentational components (`confirm`, `language-switcher`) |
| `services/`                      | App-wide services; `abstract-state.class.ts` is the state base      |
| `libs/auth/`                     | Auth slice: `auth.provider`, guards, interceptors, services         |
| `models/`                        | View models (`state.model.ts`)                                      |
| `constants/`                     | App constants (`languages.constant.ts`)                             |
| `app.config.ts`, `app.routes.ts` | Root providers and routing                                          |

## Auth (`src/app/libs/auth/`)

- `guards/auth.guard.ts` — gate routes by authentication.
- `guards/auth-permission.guard.ts` — gate routes by `Permission` (from `@dto`).
- `interceptors/auth.interceptor.ts` — attach the access token / handle refresh
  (only to same-origin / the configured API origin — never third parties).
- **CSRF posture**: state-changing calls require the in-memory access token in
  the `Authorization` header (non-cookie proof a cross-site page cannot forge),
  and the refresh cookie is `httpOnly` + `SameSite=strict` in prod. There is no
  cookie-based XSRF token, so do not add `withXsrfConfiguration`. `tokenDecoded`
  is presentation-only.
- `auth.provider.ts` — wire it all into `app.config.ts`.
- Use these instead of inlining auth logic in components.
- **Protected routes MUST declare `canActivate`** in `app.routes.ts`
  (`[canActivateFn]` for auth, `[canActivateWithPermission(Permission.X)]` for
  permissioned routes) — never rely on `@if (auth.isLoggedIn())` in the template
  alone. Permission guards redirect to `unauthorized` (a real route) on failure.
  Guards are **UX only**; the backend is the real authorization boundary, so a
  protected page must still call APIs that enforce the permission server-side.
  See `pages/profile` (auth-guarded example) and `pages/unauthorized`.

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
