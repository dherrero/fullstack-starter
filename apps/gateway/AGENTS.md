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

## Env vars

| Var                       | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `GATEWAY_PORT`            | Listen port (default 3100)                         |
| `API_BASE_URL`            | Upstream API base (default `http://api:3200`)      |
| `INTERNAL_JWT_PRIVATE_KEY`| EdDSA private key for signing internal tokens (PEM)|
| `CORS_ORIGIN`             | Comma-separated allowed origins                    |

## Testing

Vitest, co-located `*.spec.ts`. Cover the auth middleware and token service — they are
the security-critical units. Run: `npx nx test gateway`.
