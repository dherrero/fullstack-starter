#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Generates a bcrypt hash for the dev admin seed
# (BOOTSTRAP_ADMIN_PASSWORD_HASH, consumed by db/zz-dev-seed.sh).
#
# Usage:
#   bash scripts/gen-admin-hash.sh 'your-strong-password'
#
# Cost defaults to HASH_SALT_ROUNDS (or 12), matching the API hashing config.
# ---------------------------------------------------------------------------
set -euo pipefail

PASSWORD="${1:?Usage: gen-admin-hash.sh <password>}"
ROUNDS="${HASH_SALT_ROUNDS:-12}"

node -e "const b=require('bcrypt');console.log(b.hashSync(process.argv[1], parseInt(process.argv[2],10)))" "$PASSWORD" "$ROUNDS"
