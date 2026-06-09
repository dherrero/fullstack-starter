#!/bin/sh
# ---------------------------------------------------------------------------
# Gated, DEV-ONLY admin bootstrap.
#
# This file lives in the Postgres init pipeline (mounted at
# /docker-entrypoint-initdb.d) but is FAIL-SAFE OFF: it seeds nothing unless
# the operator explicitly opts in. Production (compose.yaml) never sets these
# variables, so the admin is never created there.
#
# To enable in dev, set in your .env:
#   DEV_SEED_ADMIN=true
#   BOOTSTRAP_ADMIN_EMAIL=admin@example.test
#   BOOTSTRAP_ADMIN_PASSWORD_HASH=<bcrypt hash>   # generate, never hardcode
#
# Generate the hash with:
#   bash scripts/gen-admin-hash.sh 'your-strong-password'
# ---------------------------------------------------------------------------
set -eu

if [ "${DEV_SEED_ADMIN:-false}" != "true" ]; then
  echo "[dev-seed] DEV_SEED_ADMIN is not 'true' — skipping admin seed."
  exit 0
fi

if [ -z "${BOOTSTRAP_ADMIN_EMAIL:-}" ] || [ -z "${BOOTSTRAP_ADMIN_PASSWORD_HASH:-}" ]; then
  echo "[dev-seed] DEV_SEED_ADMIN=true but BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD_HASH are unset — skipping (no insecure default)." >&2
  exit 0
fi

echo "[dev-seed] seeding bootstrap ADMIN ${BOOTSTRAP_ADMIN_EMAIL}"
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v admin_email="$BOOTSTRAP_ADMIN_EMAIL" \
  -v admin_hash="$BOOTSTRAP_ADMIN_PASSWORD_HASH" <<'EOSQL'
INSERT INTO public.user (email, name, lastname, password, permissions)
VALUES (:'admin_email', 'Admin', 'User', :'admin_hash', ARRAY['ADMIN']::permission_type[])
ON CONFLICT (email) DO NOTHING;
SELECT pg_catalog.setval('public.user_id_seq', COALESCE((SELECT MAX(id) FROM public.user), 1), true);
EOSQL
echo "[dev-seed] done."
