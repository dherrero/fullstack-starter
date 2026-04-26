#!/bin/bash
set -euo pipefail

PROJECT_NAME="${1:-}"

if [[ -z "$PROJECT_NAME" ]]; then
  echo "Usage: $0 <project-name>"
  echo "Example: $0 my-saas-app"
  exit 1
fi

if [[ ! "$PROJECT_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Error: project name must be lowercase alphanumeric with hyphens (e.g. my-project)"
  exit 1
fi

PLACEHOLDER="nx-fullstack-starter"

FILES=(
  "package.json"
  "docker-compose.db.yml"
  "compose.yaml"
  ".github/workflows/ci.yml"
  "STARTER.md"
  "README.md"
  "DEVELOPMENT.md"
  "CONTRIBUTING.md"
  "AGENTS.md"
)

echo "Renaming project: $PLACEHOLDER → $PROJECT_NAME"
echo ""

for file in "${FILES[@]}"; do
  if [[ -f "$file" ]]; then
    sed -i "s/$PLACEHOLDER/$PROJECT_NAME/g" "$file"
    echo "  ✓ $file"
  fi
done

echo ""
echo "Done. Project is now: $PROJECT_NAME"
echo "Remember to run: npm install"
