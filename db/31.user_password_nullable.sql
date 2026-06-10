-- Migration: allow federated-only users (password = NULL) in public.user
--
-- SECURITY NOTE — NULL password MUST NOT authenticate via local credentials:
--   Federated-only users have password = NULL. The API's local-credential
--   validation (auth.service.validateCredentials, ticket T-25) MUST explicitly
--   reject any login attempt where the stored password IS NULL before invoking
--   bcrypt.compare. An empty or null password must NEVER successfully
--   authenticate. This migration removes the DB-level NOT NULL constraint but
--   the enforcement responsibility remains entirely in application code.
--
-- auth_source column:
--   'local'     — user authenticates with email + password (default)
--   'federated' — user authenticates exclusively through an OIDC/SSO provider;
--                 password column will be NULL for these users
--   This column provides an auditable record of how each account was created
--   and prevents accidental local-login attempts on federated-only accounts
--   at the service layer.

-- Step 1: Drop NOT NULL on password so federated-only users can have NULL.
-- Guard: IF the column is already nullable this is a no-op in PostgreSQL.
ALTER TABLE public.user ALTER COLUMN password DROP NOT NULL;

-- Step 2: Add auth_source for auditability.
-- IF NOT EXISTS is supported for ADD COLUMN since PostgreSQL 9.6 — safe to
-- re-run.
ALTER TABLE public.user
    ADD COLUMN IF NOT EXISTS auth_source varchar(20) NOT NULL DEFAULT 'local';
