# CLAUDE.md

This project's agent guidance lives in **[`AGENTS.md`](./AGENTS.md)** — the single
source of truth for the orchestration workflow, subagents, and global conventions.

Layer-specific rules live in nested `AGENTS.md` files; load the one for the area you
are touching:

- `apps/api/AGENTS.md` — backend (Express + Sequelize + PostgreSQL)
- `apps/gateway/AGENTS.md` — reverse proxy + EdDSA internal auth
- `apps/front/AGENTS.md` — Angular 21 frontend
- `libs/rest-dto/AGENTS.md` — shared API contracts (`@dto`)
- `libs/internal-auth/AGENTS.md` — service-to-service EdDSA auth
- `db/AGENTS.md` — SQL migrations

Do not duplicate `AGENTS.md` content here.
