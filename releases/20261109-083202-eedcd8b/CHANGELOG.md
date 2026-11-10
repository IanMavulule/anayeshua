# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/): `fix` bumps PATCH,
`feat` bumps MINOR and breaking changes bump MAJOR. Every version maps to one
commit and one `vX.Y.Z` tag.

## [2.5.0] - 2026-11-05

### Added
- "Santuário" design system: dark teal base, gold metal gradient and Cinzel
  titles from the BrandKit, with a gold glow behind the cutout portraits and
  the star band as the shared signature (`tokens.css`, `base.css`, `ui.css`,
  `layout.css`, `pages.css`).
- Reusable UI components in `src/components/ui`: Button/ButtonLink, text,
  textarea and select fields, Badge, SectionHead, EmptyState, Poster, Rail,
  Dialog and an icon set.
- One `AppHeader`, `AppFooter` and `PageShell` shared by the public site and
  the members area, with an account menu and a mobile navigation drawer.
- Member home with a featured-series billboard, plan, word of the day and
  rows of series per category.

### Changed
- Rebuild every page on the design system: landing, login and register,
  devotionals library and player, word of the day, questions and checkout.
- The Premium gate uses the shared dialog (Escape, focus and scroll lock).
- The admin panel follows the same theme: dark surfaces, rounded shapes,
  pill buttons and sentence-case labels.

### Removed
- `site.css`, `components.css`, the separate site/platform headers and
  footers, `SeriesCard` and `PhotoCarousel`.

## [2.4.1] - 2026-11-05

### Changed
- Rewrite the README: setup, first admin account, scripts, structure,
  video files, iMaliWay configuration, versioning and production notes.
- Update the `.trae` agent guides to the new API, MVP server, i18n and
  folder structure.

## [2.4.0] - 2026-11-05

### Added
- "Palavra do dia" admin panel to publish the daily message, notes and
  prayer points in Portuguese or English, with scheduling and premium flag.
- "Dúvidas" admin panel to answer members' questions and review the
  feedback about assistance sessions.
- Real uploads from the course drawer: lesson videos are streamed to the
  server with a progress bar, covers are cropped to 16:9 and stored as files.
- Lesson preview with a server media token for videos already uploaded.
- Members created by the admin receive a one-time temporary password.

### Changed
- The admin store loads `/api/admin/state` and every action calls the REST
  API; local state only changes with the server response. Errors are shown
  as toasts with the reason returned by the API.
- The admin shows the signed-in user's name and signs out through the API.

### Removed
- Demo seed data, the localStorage copy of the admin state and the
  "reset demo" action; external cover URLs (covers must be local files).

## [2.3.0] - 2026-11-05

### Added
- Portuguese and English interface with i18next, following the d2-i18n model
  of dhis2-semis-core (English source keys, `src/locales/{pt,en}`), a
  language switcher saved to the user profile and `npm run i18n:check`.
- Registration page and real sign-in against the new API; session state
  loaded from `/api/auth/session` and route guards for members and admins.
- "Word of the day" page with the daily message, prayer points and notes.
- Questions page where members write to the prophetess and read answers.
- Assistance feedback form for premium members in the player panel.
- iMaliWay payment flow: plan choice, wallet number, "confirm on your
  phone" state with automatic status polling, success and retry states.

### Changed
- Brand shown as "Ana Yeshua - Holy Ghost Ministering" in titles, logos
  and footer.
- Frontend reorganized like dhis2-semis-core: `app/`, `router/routeList.tsx`,
  `pages/<name>/index.tsx`, `components/<domain>/`, `hooks/<domain>/`,
  `schemas/`, `types/`, `utils/` and `locales/`.
- Shared header, footer and auth layout instead of copies in every page.
- Devotionals page split into a player hook and components; the URL is
  the single source of truth for the open lesson; testimonies are saved
  on the server.
- Dashboard shows the member's real plan, the message of the day and the
  featured series instead of fictitious progress.
- Landing page shows the next event from the agenda and fixes corrupted
  Portuguese text.

## [2.2.1] - 2026-11-05

### Changed
- Reorganize `server/` following the Model-View-Presenter pattern:
  `models/` (entities, domain rules and JSON store), `views/` (response
  serializers), `presenters/` (request handlers per domain), `routes/`
  (wiring only), `schemas/` (zod validation) and `services/`.
- Split the admin API into one presenter per resource.
- Document the architecture and conventions in `server/README.md`.

## [2.2.0] - 2026-11-05

### Added
- Testimonies stored on the server per course and lesson, with moderation
  (pending → published/hidden) controlled by the `moderation` setting.
- Daily content from the prophetess: daily message, notes and prayer points,
  in Portuguese or English, with scheduled publication and optional premium
  content (`GET /api/posts`, `GET /api/posts/today`).
- Questions to the prophetess (`POST /api/questions`, `GET /api/questions/mine`)
  answered from the admin API.
- Feedback about premium assistance sessions (`POST /api/feedback`).
- Admin endpoints for posts, question answers and feedback.

## [2.1.0] - 2026-11-05

### Added
- iMaliWay (Paytek Africa) payment provider using push C2B: the customer
  confirms the charge on their phone (M-Pesa, e-Mola, mKesh or iMali).
- Bearer key built by encrypting the API key with the Paytek public key
  (RSA PKCS#1), and mapping of the documented gateway error codes.
- `POST /api/payments/checkout`, `GET /api/payments/:id` (polls the gateway
  status) and `GET /api/payments/plans`.
- Signed webhook `POST /api/payments/imaliway/webhook` (HMAC-SHA256 over
  `timestamp.body`, 5-minute window, idempotent confirmation).
- Simulated provider for development (`ANA_PAYMENTS_MODE=simulated`); an
  account ending in `0000` simulates a declined payment.
- Wallet-specific phone validation (84/85 M-Pesa, 86/87 e-Mola, 82/83 mKesh).

## [2.0.0] - 2026-11-05

### Added
- User accounts with scrypt-hashed passwords, `admin` and `member` roles and
  self-registration (`/api/auth/register`, `/login`, `/logout`, `/session`, `/me`).
- Subscriptions with an expiry date; plan 200 MT = 30 days, 500 MT = 90 days
  (`server/config/plans.ts`).
- Modular server: `config/`, `repositories/`, `services/`, `middleware/`, `routes/`.
- JSON collections with atomic writes under `data/` (users, courses, events,
  testimonies, posts, questions, feedback, payments, settings).
- REST admin API under `/api/admin` (courses, events, testimonies, members,
  settings, video and cover uploads), restricted to admins.
- One-off migration that imports `data/admin-state.json` and the series that
  were hard-coded in the server, and creates the first admin account.
- CSRF protection (`X-Ana-Client` header), login rate limiting, request
  validation with zod and `.env` support (`.env.example`).
- Server test suite (`npm test`) using `node:test`.

### Changed
- The course catalogue now has a single source: `data/courses.json`.
- Media tokens are bound to the user and premium access is re-checked on every request.
- Uploaded covers are stored as files under `data/uploads/covers` instead of data URLs.

### Removed
- Unauthenticated `GET/PUT /api/admin/state` and the fixed demo login.

### Fixed
- Wrong date in the "Culto Especial das Mulheres" lesson title (31.03.36 → 31.03.26).

## [1.0.1] - 2026-11-05

### Changed
- Enforce LF line endings across the repository through `.gitattributes`.

## [1.0.0] - 2026-11-02

### Added
- Vite + React + TypeScript platform with admin panel and local video streaming.
- Server-side persistence of the admin panel state.
