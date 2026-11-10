# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Ana Yeshua platform: video devotional series (first lesson free, the rest Premium), "Word of the day", prayer points, moderated testimonies, member questions per lesson, and an admin panel. UI in Portuguese (default) and English. Code comments and user-facing copy are in European Portuguese (Mozambique); commit messages are in English.

## Commands

```sh
npm run dev            # API (tsx server/index.ts, :8787) + Vite (:5173, strictPort) together
npm run dev:web        # Vite only
npm test               # node:test server tests against PostgreSQL
npm run typecheck      # tsc -b over app + server + tests
npm run build          # tsc -b && vite build -> dist/
npm run i18n:check     # every t('...') key exists in src/locales/{en,pt}/translations.json
npm run i18n:write     # add missing keys (English text as value) for later translation
npm run admin:reset    # apply ANA_ADMIN_PASSWORD to the admin account
npm run db:migrate     # apply pending SQL migrations (pg_dump first on a database with data)
npm run server:setup   # prepare a server: .env/ANA_SECRET, install ffmpeg, folders, pg_dump backup + migrations (--check, --no-install, --build)
npm run deploy         # publish the last commit to the production VPS (--status, --rollback, --skip-checks, --allow-dirty)
```

Single test file / single test:

```sh
npx tsx --test tests/server/api.test.ts
npx tsx --test --test-name-pattern="register, session" tests/server/api.test.ts
```

There is no linter configured; `typecheck` and `i18n:check` are the gates.

## Environment

`.env` (copy from `.env.example`). `DATABASE_URL` is required — `server/config/env.ts` throws without it, and the database is created on first start if missing. The schema comes from versioned SQL migrations (`server/models/store/migrations/NNN_*.sql`, tracked in `schema_migrations`): on startup they are applied automatically only to an empty schema; with data the server refuses to start until `npm run db:migrate` (or `DATABASE_MIGRATE=auto`). The admin account is ensured on startup (`services/migrationService.ts`). There is no sample/seed data: the database starts empty.

Supabase works through `DATABASE_URL` (`server/models/store/connection.ts`): TLS is enabled automatically (`DATABASE_SSL`, `DATABASE_SSL_CA`), the transaction pooler (port 6543) and the `public` schema are refused (use `DATABASE_SCHEMA`, e.g. `ana`), and `search_path` is set with `SET` on each new connection.

Tests use `TEST_DATABASE_URL` (falls back to `DATABASE_URL`); each run creates a temporary `test_<hex>` schema and drops it at the end (`tests/server/helpers.ts` → `startTestServer({ seed })`).

Without the `IMALIWAY_*` variables the payment provider is `unconfigured`: checkout returns 503 `payments_not_configured` and the payment page disables the button. There is no simulated mode in the app; the fake provider lives only in `tests/server/fakePaymentProvider.ts`.

## Architecture

### Server (`server/`, Express 5, MVP)

Request flow: `routes/` → `middleware/` → `presenters/` → `models/` + `services/` → `views/` → JSON. Layer rules and naming conventions are in `server/README.md`.

- `app.ts` is the async composition root: opens the database, picks the payment provider, builds `context.ts` (db + services) and injects it into `createXPresenter(context)` factories. Routes contain no logic.
- **Storage**: relational PostgreSQL tables with FKs — `users`, `subscriptions` (PK `user_id`, cascade), `courses` → `course_modules` → `lessons` → `prayer_points`, `course_field_options` (categories/levels, FK from courses), `settings` (single row, `id = 1`, defaults in `DEFAULT_SETTINGS`), `events`, `posts`, `payments` (`user_id` SET NULL), `testimonies`, `questions`, `assistance_feedback`. Each is a repository in `models/repositories/` (mostly `TableRepository<T>`: column specs, `position` for list order, `update` in a transaction with `SELECT … FOR UPDATE`) behind the `Collection<T>` / `DocumentStore<T>` interfaces of `models/store/pgStore.ts`, so presenters don't know the storage. `db.transaction(tx => …)` groups writes (payment confirmation + plan activation run in one). Instants are `timestamptz` returned as ISO strings; datetime-local values (event date, course publishAt) are `timestamp` without zone; testimony dates are `date`. Schema is selected via `search_path`. Changing an entity shape means a new migration file (never edit an applied one), the repository, `models/entities.ts`, the zod schema, the view and the frontend types. Old JSONB tables remain as `legacy_*` (not read by the app) until the user drops them.
- **Errors**: throw `HttpError(status, code)`; `errorMiddleware` always responds `{ error: code }`. The frontend maps codes to translated messages (`src/utils/format/errorMessage.ts`), so keep codes stable.
- **Auth**: signed session cookie `ana_sess` (`services/tokenService.ts`); `attachUser`, `requireAuth`, `requireAdmin`. **Google sign-in** (`services/googleAuthService.ts`, `POST /api/auth/google`): the button (`src/components/auth/GoogleSignIn.tsx`) sends the Google ID token; the server verifies it against Google JWKS (aud = `GOOGLE_CLIENT_ID`, issuer, expiry, verified e-mail), links by `users.google_id` or e-mail, or creates a member with an empty `password_hash`. Without `GOOGLE_CLIENT_ID` the button is hidden and the endpoint returns 503; tests inject `googleAuth` into `startTestServer`. **CSRF**: every non-GET `/api` request must send `X-Ana-Client: web` (`requireClientHeader`); the iMaliWay webhook is exempt (signature-verified).
- **Payments** (`services/payments/`): provider interface with `imaliway` / `unconfigured` / `test`. Status transitions happen inside the locked transaction so a plan is activated only once (poll or webhook). Plans and the "assistance" flag are in `config/plans.ts`.
- **Media**: lesson videos are `videos/<lessonId>.mp4` (+ optional `.vtt`), streamed with HTTP Range and short-lived tokens. Covers are uploaded to `data/uploads/`. When serving files use `res.sendFile(name, { root: dir })` — an absolute path fails with 404 if any folder starts with a dot (e.g. this repo under `.claude/worktrees/`).
- **Video processing** (`services/video/`): a lesson is published at once with its original MP4; `videoProcessor` then converts it in the background to HLS (`videos/hls/<lessonId>/master.m3u8` + `360p|480p|720p/`, never upscaling) and the catalog reports `hls: true` once a quality is ready. State lives in `video_renditions`; failures retry after 1 min, 5 min, 15 min, 1 h, then become `failed` and log a `server_events` error that only the admin sees (members keep the MP4). Pending jobs resume on startup. Needs ffmpeg/ffprobe on PATH (or `FFMPEG_PATH`/`FFPROBE_PATH`; `npm run server:setup` installs them); without it conversion is disabled with one warning and MP4 keeps working. Tests use `tests/server/fakeTranscoder.ts` (`startTestServer` defaults to a disabled transcoder). HLS playlists are rewritten so every URI carries the media token; the player (`LessonPlayer.tsx`, Video.js 10 skin with quality "Auto", lazy-loaded; state in `useVideoPlayer`) uses hls.js, falls back to the MP4 after a second HLS failure, and refreshes the token every 4 min.
- **Monitoring**: `services/monitorService.ts` samples CPU every 5 s (10 min history), measures disk/videos/HLS/uploads/database size, and records a low-disk warning; unhandled 500s are stored as `server_events`. `/api/admin/system*` feeds the admin **Servidor** panel (`ServerPanel.tsx`, polled through `useServerStatus.ts`, error badge in the sidebar).
- Premium gating: each course has `access: 'free' | 'premium'` (missing = premium). In a free course every lesson is open to members with an account; in a paid course only lessons marked `free` (sample lessons) are open, and the rest — videos and prayer points — require an active plan (`isLessonFree` in `models/courseModel.ts`, used by `catalogService` and `catalogView`).

### Frontend (`src/`, React 19 + Vite)

Organised like dhis2-semis-core: `pages/<page>/index.tsx`, `components/<domain>/`, `hooks/<domain>/`, `router/routeList.tsx` (routes + access guards), `schemas/session/` (global session state), `utils/api/` (HTTP clients), `utils/constants/` (`routes.ts`, `brand.ts`).

- `utils/api/apiClient.ts` always sends the `X-Ana-Client` header and turns error responses into `ApiError { status, code }`. Vite proxies `/api`, `/media`, `/uploads` to :8787.
- **i18n**: the key is the English text (`t('Create a free account')`), with values in `src/locales/{en,pt}/translations.json` (kept sorted). `i18n:check` only detects literal single-quoted `t('…')` calls — use `t('Women\'s gatherings')`, not double quotes or variables, or the key won't be checked.
- **Admin panel** (`/admin`, `components/admin/`): a single large `AdminContext.tsx` holds admin state and actions; `adminApi.ts` maps drafts to request bodies; panels live in `components/admin/panels/`; `CourseEditor.tsx` edits a course with modules → lessons (cover, videos, prayer points). Admin UI strings are mostly hard-coded Portuguese, not i18n keys.
- **Styling**: plain CSS imported through `src/styles/index.css`. Design tokens (colors, `--tone-*` section backgrounds, type scale) are in `tokens.css`; public pages in `pages.css`; admin in `admin.css` + `admin-modern.css` + `admin-course-editor.css`. Landing sections are wrapped in `.band band--{white,linen,mist,gold}` for alternating light tones. The brand is Christian/ministerial: keep it light, sober and elegant.

### Content source

The landing page copy (Prophetess Ana Yeshua, the three dimensions — Holy Spirit, Prophetic Ministry, Women and Purpose — the six pillars, vision/mission/purpose) follows the ministry's institutional presentation. Keep new copy consistent with that positioning.

## Production

One Linux VPS (`DEPLOY_HOST`, default `ian@168.231.127.248`), shared with other sites — never touch their nginx sites, pm2 processes or the system Node (v20). Ana Yeshua runs from `/var/www/anayeshua`: `current -> releases/<date>-<sha>/` (last 5 kept), with `.env`, `videos/`, `data/` and `backups/` in `shared/`. Node 22 lives in `/opt/node-22`; pm2 process `anayeshua` (port 8787, `shared/ecosystem.config.cjs`); nginx site `anayeshua.conf` serves `current/dist` and proxies `/api`, `/media`, `/uploads`; PostgreSQL 14 database `anayeshua` on the same VPS. `npm run deploy` (`scripts/deploy.ts` → `scripts/deploy-remote.sh`) ships `git archive HEAD`, runs `npm ci` + build, `pg_dump`, migrations, switches `current`, restarts only `anayeshua` and rolls back automatically if `/api/settings` doesn't answer.

## Conventions

- Semantic commit messages in English (`feat`, `fix`, `refactor`, `docs`, `chore`) with a description; semver with a `CHANGELOG.md` entry and `vX.Y.Z` tag per release.
- To add an endpoint: zod schema in `schemas/<domain>Schemas.ts` → handler in `presenters/<domain>Presenter.ts` (respond through a view) → wire in `routes/<domain>Routes.ts` → test in `tests/server/`.
- `npm run dev` on Windows kills the whole process tree via `taskkill /T` (`server/dev.ts`); if ports 5173/8787 stay busy, a previous run left orphans.

## Subagents (`.claude/agents/`)

- `verificador` — runs typecheck, i18n:check and tests; reports failures only (read-only).
- `tradutor-pt-en` — adds/reviews keys in `src/locales/{pt,en}` (European/Mozambican Portuguese).
- `endpoint-mvp` — builds API endpoints through the schema → presenter → view → route → test layers.
- `revisor-ui` — visual review in the built-in browser at desktop and mobile widths (read-only).
- `paginas-publicas` — public/member pages (landing, lesson page, login, header), mobile layout, CSS and i18n wiring.
- `operador-producao` — read-only diagnosis of the production VPS (release, pm2, API, logs, disk); deploys stay in the main conversation.
- `conteudo-ministerial` — writes/audits copy in the ministry's institutional voice.
- `guardiao-pagamentos` — security review of payments, premium gating, sessions and CSRF (read-only).
- `painel-admin` — admin panel features and fixes; splits `AdminContext.tsx` one domain at a time.
- `media-video` — lesson videos, subtitles and covers: upload, Range streaming, media tokens, premium checks, player.
- `arquitecto-relacional` — owns the move from JSONB documents to normalised tables with FKs and versioned SQL migrations, and reviews data-model changes.

No subagent mutates the database; destructive data operations stay in the main conversation with the user's confirmation.
