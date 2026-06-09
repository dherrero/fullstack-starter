# libs/internal-auth — Service-to-service auth (`@internal-auth`)

> See the root `AGENTS.md` for global conventions. Security-critical: change with care.

EdDSA (Ed25519) signing/verification for the internal trust boundary between the
gateway and the API. The gateway signs; the API verifies. This is **not** the public
user-auth surface.

## Surface

- `signUserContext(input, options)` — issue a token for a forwarded end-user
  (`scope: USER_REQUEST`, carries `permissions` + `requestId`). Used by the gateway
  proxy per request.
- `signSystemContext(input, options)` — issue a token for gateway-as-itself
  (system-to-system, e.g. `/internal/auth/validate`).
- `verifyInternalAuth(token, options)` — used by the API to validate inbound internal
  tokens; returns typed `InternalAuthClaims`.
- Constants (`internal-auth.constants.ts`): issuer, audiences, default TTL, scopes.
- Middleware (`internal-auth.middleware.ts`): Express guard for the API side.

## Hard rules

- **Algorithm is EdDSA only.** Verification pins `algorithms: ['EdDSA']` — never widen
  this (prevents `alg` confusion / forgery).
- **Key split is non-negotiable**: the **private** key (`INTERNAL_JWT_PRIVATE_KEY`)
  lives only on the gateway; the **public** key (`INTERNAL_JWT_PUBLIC_KEY`) lives only
  on the API. The API can verify but cannot mint.
- Keys arrive as PEM via env vars; `normalisePem` converts literal `\n` to real
  newlines (docker/.env style). Keep that handling when touching key loading.
- Tokens are short-lived (`INTERNAL_AUTH_DEFAULT_TTL_SECONDS`) and validated against
  issuer + audience. Always set `requestId` for traceability.
- `sub` is the user id (numeric when possible) for `USER_REQUEST`, or the system
  subject for system scope.

## Testing

Vitest, co-located `*.spec.ts`. The signer and middleware specs are the safety net for
this boundary — keep them green and extend them when you change the claims shape.
