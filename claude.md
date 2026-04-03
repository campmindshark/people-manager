# People Manager - AI Assistant Guide

## Project Overview

Yarn workspaces monorepo for Camp Mindshark's member portal. Backend API (Express/Knex/Objection) + React SPA frontend. Deployed to AWS ECS with Terraform; frontend served from S3/CloudFront.

## Workflow Rules

- Use `yarn`, never `npm`
- Run `yarn lint-fix` and `yarn style-fix` after making code changes
- All changes go through a PR — never push directly to main
- Use the PR template at `.github/pull_request_template.md`
- Always use newlines at the end of files
- Don't add Claude or Cursor as a co-author

## Code Quality

- Produce only high confidence code using high confidence tactics
  - Question all code/tactics at every change
  - Rate code/tactics used on confidence of existence, correctness and use
  - Reject confidence 8 or less and replace with higher confidence tactics/code

## Useful Commands
- Refer to the makefile to find current useful commands including:
  - `make docker-dev` — start full stack (postgres + migrations + seeds + backend + frontend)
  - `make docker-dev-down` — stop everything
  - `make docker-dev-reset` — stop and wipe all volumes (clean slate)
  - `make ci` — run lint, style, build, test
  - `make ci-fix` — run lint-fix, style-fix
- `yarn dev` — run frontend + backend locally (requires local postgres and `yarn install`)
- `yarn db-migrate` — run Knex migrations
- `yarn db-seed` — run seed data

## Architecture

```
packages/
├── backend/          # Express API server (port 3001)
│   ├── config/       # getConfig() reads env vars
│   ├── controllers/  # Business logic (user, roster, shift, dues, analysis, etc.)
│   ├── middleware/    # rbac.ts (hasPermission), verified_user.ts
│   ├── migrations/   # Knex migrations (Postgres)
│   ├── models/       # Objection.js models (user, roster, shift, group, etc.)
│   ├── roles/        # Static role/permission config (config.json + role.ts)
│   ├── routes/       # Express routers mounted at /api/*
│   ├── seeds/        # Knex seed data
│   ├── view_models/  # DTO types for API responses
│   ├── index.ts      # App entry: Express, Passport, session, route mounting
│   └── knexfile.ts   # Knex DB config (dev/staging/prod)
└── frontend/         # React 18 SPA (port 3000)
    └── src/
        ├── api/      # Axios client classes per domain (users, shifts, roster, etc.)
        ├── components/  # Feature components (admin, roster, shifts, profile)
        ├── config/   # getFrontendConfig() — backend URL
        ├── layouts/  # Dashboard shell (drawer, nav, topbar)
        ├── pages/    # Route-level pages (Home, Login, Roster, Admin, etc.)
        └── state/    # Recoil atoms + selectors (async data fetching)
```

## Tech Stack

- **Backend:** TypeScript, Express, Knex (query builder), Objection.js (ORM), Passport + Google OAuth, express-session + connect-pg-simple, PostgreSQL
- **Frontend:** TypeScript, React 18, React Router v6, Recoil (state), MUI 5 (UI), Axios, react-app-rewired, @rjsf (JSON Schema forms)
- **Shared:** Frontend imports backend types directly via yarn workspace link (`"backend": "^0.0.0"`)
- **Infra:** Docker, Terraform (ECS, RDS, S3, CloudFront), GitHub Actions CI/CD

## Coding Conventions

- **Formatting:** Prettier — single quotes, trailing commas, 2-space tabs, semicolons
- **Linting:** ESLint with Airbnb + airbnb-typescript + Prettier; `no-console` is off
- **Unused vars:** Prefix with underscore (`_unused`) — enforced by `@typescript-eslint/naming-convention`
- **Imports:** External packages first, then internal paths; no file extensions for TS/TSX
- **Backend patterns:**
  - One Express Router per domain in `routes/`, mounted in `index.ts` under `/api/`
  - Objection models use `static tableName`, `jsonSchema`, and `relationMappings`
  - RBAC via `hasPermission('domain:action')` middleware on individual routes
  - Config via `getConfig()` which reads `process.env`; local dev loads from `env/.env.local`
- **Frontend patterns:**
  - API clients are classes that take `baseApiURL` and use axios with `withCredentials: true`
  - State via Recoil selectors that call API clients (async data fetching)
  - Auth gate via `AuthenticatedPage` component wrapping protected routes
  - MUI components throughout; dark theme configured in `App.tsx`

## Database

- PostgreSQL via Knex + Objection.js
- Migrations in `packages/backend/migrations/` (Knex CLI, TypeScript)
- Seeds in `packages/backend/seeds/` (idempotent upserts, safe to re-run)
- Dev knexfile uses `POSTGRES_CONNECTION_URL` env var with localhost fallback
- Roles defined statically in `packages/backend/roles/config.json` (not in DB); linked via `user_roles` join table

## Auth

- Google OAuth via Passport (`passport-google-oauth20`)
- Sessions stored in Postgres (`connect-pg-simple`)
- `checkAuthenticated` middleware on all `/api/*` routes except `/api/auth` and `/api/health`
- Dev auth bypass available when `DEV_AUTH_BYPASS=true` + `NODE_ENV=development` (triple-layered safety)
- Frontend roster ID is hardcoded in `packages/frontend/src/state/roster.ts` (`CurrentRosterID`)

## CI/CD

- `code-quality.yml` — lint, style, build (tests currently commented out)
- `docker-build-push.yml` — builds and pushes app image to Docker Hub on main
- `docker-build-push-migration.yml` — builds and pushes migration image on main
- `terraform.yml` — terraform plan + apply on main
