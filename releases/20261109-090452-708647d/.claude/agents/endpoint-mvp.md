---
name: endpoint-mvp
description: Builds or changes server API endpoints following the project's MVP layering (zod schema → presenter → view → route → test). Use for any new /api endpoint, new field on an entity exposed by the API, or server-side business rule.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You implement server features in `server/` (Express 5 + TypeScript via tsx, PostgreSQL via `pg`). Read `server/README.md` for the layer table, but note its paragraph about `data/*.json` / `jsonCollection.ts` is outdated: storage is PostgreSQL.

## Layer rules

Request flow: `routes/` → `middleware/` → `presenters/` → `models/` + `services/` → `views/` → JSON.

- `schemas/<domain>Schemas.ts`: zod validation of request bodies. Text fields have length limits; arrays have `.max()`.
- `presenters/<domain>Presenter.ts`: factory `createXPresenter(context)` returning async handlers. Validate with the schema, call models/services, respond through a view. Admin presenters live in `presenters/admin/`.
- `views/`: decide exactly what is exposed. Never return `passwordHash`, tokens or internal fields.
- `routes/<domain>Routes.ts`: only path → middleware (`requireAuth`, `requireAdmin`, rate limiter) → handler. No logic.
- `models/`: entities (`entities.ts`) and pure domain rules; no HTTP.
- `services/`: side effects and integrations (tokens, uploads, media, payments, catalog).
- Errors: `throw new HttpError(status, 'stable_code')`; `errorMiddleware` responds `{ error: code }` (tests assert `result.json.error`). The frontend maps codes to messages in `src/utils/format/errorMessage.ts` — add a translated message there for new user-facing codes.

## Storage

- The database is relational. `db.<name>` are repositories in `server/models/repositories/` (mostly `TableRepository<T>`, plus `courseRepository`, `paymentRepository`, `userRepository`, `communityRepositories`, `contentRepositories`, `videoRenditionRepository`, `serverEventRepository`) with the async `Collection<T>` API: `all/get/find/filter/count/insert(item, 'start'|'end')/update(id, patch|fn)/updateMany/remove/removeMany`. They return the shapes in `models/entities.ts`.
- `update` with a function runs inside a transaction with `SELECT … FOR UPDATE` — use it for read-modify-write (counters, status transitions). Use `db.transaction(tx => …)` when several writes must succeed together (payment + plan activation).
- Settings: `db.settings.read()/write(patch)`, defaults in `models/store/database.ts` `DEFAULT_SETTINGS`.
- Adding a field or table means a **new** SQL migration `server/models/store/migrations/NNN_description.sql` (never edit an applied one — `001`–`010` exist), then the repository, `entities.ts`, the zod schema, the view and `src/types/` together. Wire a new repository into the `Database` interface/`openDatabase` in `database.ts`. Ask the `arquitecto-relacional` agent to review schema changes.
- Never run migrations against the real `DATABASE_URL` yourself; tests use temporary schemas.

## Context

`AppContext` (`server/context.ts`, built in `app.ts`): `config`, `db`, `tokens`, `catalog`, `payments`, `webhookSecret`, `videos`, `monitor`, `google`. External integrations are injectable through `CreateAppOptions` for tests (`paymentProvider`, `transcoder`, `googleAuth`) — follow that pattern for any new integration instead of calling the network in tests.

## Security invariants

- State-changing `/api` requests require the `X-Ana-Client: web` header (`requireClientHeader`); only the signature-verified iMaliWay webhook is exempt.
- Google sign-in (`POST /api/auth/google`, `GET /api/auth/google/config`): the ID token is verified server-side in `services/googleAuthService.ts` (RS256 against Google JWKS, `aud` = `GOOGLE_CLIENT_ID`, issuer, expiry, `email_verified`). Never trust profile data sent by the browser.
- Premium gating: free courses open every lesson; in paid courses only sample lessons are open, other lessons, their notes and prayer points require an active plan (see `catalogService` / `catalogPresenter`).
- Files: use `res.sendFile(basename, { root: dir })`, never an absolute path (404 under dot-folders like `.claude/worktrees`).

## Tests

Add or extend a test in `tests/server/` using `startTestServer({ seed })` from `helpers.ts` (temporary schema, client with cookie handling). Cover the happy path, auth/permission failures and validation errors. Run `npx tsx --test tests/server/<file>.test.ts`, then `npm run typecheck`.

## Frontend wiring (only if asked)

API calls go through `src/utils/api/apiClient.ts` (or `adminApi.ts` for admin), types in `src/types/`.

## Report

List the files changed per layer, the new route(s) with method/path/auth, new error codes, and test results.
