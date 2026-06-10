# apps/gateway — API Gateway (Express 5 reverse proxy)

> Layer-specific rules for the gateway. See the root `AGENTS.md` for global
> conventions and path aliases.

The gateway owns the **client-facing auth surface**, but it is **not exposed to the
Internet**: it lives on `internal-network` (`internal: true`) and sits behind Nginx (the
`front` container reverse-proxies `/api/*` to it). It then proxies authorized requests to
the internal API on the same private network.

## Responsibilities

1. **Public auth** (`src/routes/auth.routes.ts`, `src/controllers/auth.controller.ts`,
   `src/services/token.service.ts`): login, refresh-token rotation, logout. Issues the
   public access token and sets refresh cookies.
2. **Proxy** (`src/routes/proxy.routes.ts`): forwards `/*` to the API's `/v1/*` via
   `http-proxy-middleware`, but **only after `hasPermission()` populates
   `res.locals.user`**.
3. **Internal-token minting**: before forwarding, it signs a short-lived EdDSA token
   (`signUserContext` from `@internal-auth`) carrying `{ userId, permissions, requestId }`
   and attaches it as `INTERNAL_AUTH_HEADER`, plus `INTERNAL_REQUEST_ID_HEADER`.
4. **OIDC Relying Party (SSO)** (`src/sso/*`, `src/controllers/sso.controller.ts`,
   `src/routes/sso.routes.ts`): optional federated login (Okta/Azure AD/Auth0).
   Routes under `/api/v1/auth/sso`: `GET /providers` (public metadata),
   `GET /:provider/login`, `GET /:provider/callback`, `GET /logout`. The gateway
   runs the whole Authorization Code + PKCE handshake, validates the ID token
   (via `openid-client`), resolves/provisions the local user through the api
   (`/internal/federated/resolve`, scope `FEDERATED_IDENTITY`) and then issues the
   **same** local session via `respondWithTokens` — the api never talks to the IdP.
   Uses **`openid-client` v5** (CJS); do NOT upgrade to v6 (ESM-only) without
   migrating the monorepo to `moduleResolution: nodenext`. Full design & threat
   model: `docs/SECURITY.md` → "Federación OIDC". With zero providers configured
   the gateway behaves exactly as before.

## Request flow (must stay intact)

```
browser ──/api/*──▶ nginx ──proxy_pass──▶ gateway
                                          │  hasPermission() → res.locals.user
                                          │  signUserContext() → internal EdDSA JWT
                                          ▼
                                         API  /v1/*  (verifies internal token, not the public one)
```

## Hard rules

- **The API trusts the gateway's internal token, not the public access token.** Never
  forward the raw public token upstream as the auth credential.
- Internal tokens are **short-lived and per-request** — sign one per proxied request;
  do not cache or reuse them.
- The private signing key comes from `INTERNAL_JWT_PRIVATE_KEY` (PEM, EdDSA/Ed25519).
  It must exist **only** on the gateway; the API holds only the public key.
- Use `fixRequestBody` when proxying JSON parsed by `express.json()` (already wired in
  `proxy.routes.ts`) so the upstream receives the body.
- CORS, `cookie-parser`, and `trust proxy` are configured in `src/main.ts`; allowed
  origins come from `CORS_ORIGIN` (comma-separated).
- Responses use the gateway's own `HttpResponser` (`src/adapters/http/`).
- **On refresh rotation, trust the claims the API returns, never the old token.**
  `/internal/refresh/rotate` re-reads the user and returns its current
  `email`/`permissions`; the gateway must put those on `res.locals.user` so a
  revoked/downgraded (or soft-deleted) account loses access on the next rotation
  rather than carrying stale claims for the whole refresh lifetime.
- **`remember` is a strict boolean** (`=== true`) and the "remember me" refresh
  lifetime is bounded by `JWT_REFRESH_REMEMBER_DAYS` (default 30) — never a
  year-long token. The JWT expiry and cookie `maxAge` share that single source.

## Env vars

| Var                          | Purpose                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GATEWAY_PORT`               | Listen port (default 3100)                                                                                |
| `API_BASE_URL`               | Upstream API base (default `http://api:3200`)                                                             |
| `INTERNAL_JWT_PRIVATE_KEY`   | EdDSA private key for signing internal tokens (PEM)                                                       |
| `CORS_ORIGIN`                | Comma-separated allowed origins                                                                           |
| `JWT_REFRESH_REMEMBER_DAYS`  | "remember me" refresh lifetime in days (default 30)                                                       |
| `SSO_<NAME>_*`               | OIDC provider config (issuer/client_id/secret/redirect_uri/…); see `.env.example`. Secrets live ONLY here |
| `SSO_STATE_SECRET`           | Signs the OIDC transaction & logout-hint cookies (falls back to `JWT_REFRESH_SECRET`)                     |
| `SSO_ALLOW_INSECURE_ISSUERS` | Dev-only: allow http/loopback issuers. Never enable in production                                         |

**SSO hard rule:** federated login still ends in the standard local session — the
api keeps trusting only the internal EdDSA JWT, never an IdP token. Client secrets
and ID tokens never leave the gateway; the browser only ever sees public provider
metadata and the normal access/refresh tokens.

## Testing

Vitest, co-located `*.spec.ts`. Cover the auth middleware and token service — they are
the security-critical units. Run: `npm run test:gateway`.

End-to-end specs (`*.e2e.spec.ts`) spin up a **real mock OIDC provider**
(`oauth2-mock-server`) and exercise the full SSO handshake (discovery, PKCE,
state, nonce, ID-token JWKS validation) plus an attack case (tampered state →
rejection). They are excluded from the unit suite (port binding / real HTTP) and
run with `npm run test:e2e`.
