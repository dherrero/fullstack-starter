#!/bin/bash
# Generate the Ed25519 key pair for the internal gateway → api JWT and print
# env-ready single-line PEMs.
#
# Usage:
#   bash scripts/gen-internal-keys.sh
#
# Output: prints two lines (private + public) ready to paste into .env as
# `INTERNAL_JWT_PRIVATE_KEY` / `INTERNAL_JWT_PUBLIC_KEY`. Keys are emitted as a
# single double-quoted line with literal `\n`, the only format dotenv parses
# reliably (unquoted multiline PEMs get truncated; manual escaping tends to
# double-escape `\n` and break jose). No files are written to disk so the keys
# cannot leak by accident.

set -euo pipefail

PRIVATE_VAR="INTERNAL_JWT_PRIVATE_KEY"
PUBLIC_VAR="INTERNAL_JWT_PUBLIC_KEY"

# Pick an openssl that actually supports Ed25519. macOS ships LibreSSL, which
# does NOT, so we look for a real OpenSSL (e.g. Homebrew) before falling back.
find_openssl() {
  local candidate
  for candidate in \
    "${OPENSSL:-}" \
    "$(command -v openssl 2>/dev/null || true)" \
    /opt/homebrew/opt/openssl@3/bin/openssl \
    /usr/local/opt/openssl@3/bin/openssl \
    /opt/homebrew/bin/openssl \
    /usr/local/bin/openssl; do
    [ -n "$candidate" ] && [ -x "$candidate" ] || continue
    if "$candidate" genpkey -algorithm ed25519 >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

PRIVATE_PEM=""
PUBLIC_PEM=""

if OPENSSL_BIN="$(find_openssl)"; then
  PRIVATE_PEM="$("$OPENSSL_BIN" genpkey -algorithm ed25519)"
  PUBLIC_PEM="$(printf '%s\n' "$PRIVATE_PEM" | "$OPENSSL_BIN" pkey -pubout)"
elif command -v node >/dev/null 2>&1; then
  # Fallback: generate with Node's crypto (always available in this repo).
  echo "No Ed25519-capable openssl found (macOS ships LibreSSL); using node." >&2
  KEYS="$(node -e '
    const { generateKeyPairSync } = require("crypto");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.stdout.write(privateKey.export({ type: "pkcs8", format: "pem" }).trim());
    process.stdout.write("\n===SPLIT===\n");
    process.stdout.write(publicKey.export({ type: "spki", format: "pem" }).trim());
  ')"
  PRIVATE_PEM="${KEYS%%$'\n'===SPLIT===$'\n'*}"
  PUBLIC_PEM="${KEYS#*$'\n'===SPLIT===$'\n'}"
else
  echo "Need an Ed25519-capable openssl or node, but neither was found." >&2
  echo "On macOS: brew install openssl@3   (the system LibreSSL can't do Ed25519)" >&2
  exit 1
fi

escape() {
  printf '%s' "$1" | awk 'BEGIN{ORS="\\n"} {print}' | sed 's/\\n$//'
}

PRIVATE_ENC="$(escape "$PRIVATE_PEM")"
PUBLIC_ENC="$(escape "$PUBLIC_PEM")"

cat <<EOF
# Generated Ed25519 key pair. Copy into .env.
${PRIVATE_VAR}="${PRIVATE_ENC}"
${PUBLIC_VAR}="${PUBLIC_ENC}"
EOF
