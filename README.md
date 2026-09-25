# Choresome

A calm, self-hosted household task and cleaning tracker for two (or more)
people. Built to run on a small Windows PC on your home network and be used
from everyone's phones plus one always-on wall display.

Choresome is not a to-do list. Its job is to answer two questions honestly,
forever: **what needs doing**, and **who actually did what, and when**. Every
completion is a permanent, correctable record — nothing is ever silently
overwritten.

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Technology choices](#technology-choices)
- [Directory structure](#directory-structure)
- [Local development](#local-development)
- [Testing](#testing)
- [Database migrations](#database-migrations)
- [Production deployment](#production-deployment)
- [Windows mini-PC deployment](#windows-mini-pc-deployment-step-by-step)
- [Backups](#backups)
- [Installing the PWA on Android](#installing-the-pwa-on-android)
- [Setting up the Pixel wall display](#setting-up-the-pixel-wall-display)
- [NFC tag / QR code setup](#nfc-tag--qr-code-setup)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Known limitations & future extensibility](#known-limitations--future-extensibility)

## What it does

- Tracks recurring household chores across rooms/areas, with two different
  recurrence models (see below).
- Records every completion as an immutable, correctable event: who, when,
  and what the due date was at the time — so statistics and history are
  derived from real data, not a single `lastDone` field.
- Gives each device (your phone, your partner's phone, the wall display) its
  own quick-complete flow, with an undo window and double-tap protection.
- Surfaces what's overdue, due today, and coming up — without turning
  household chores into a competition (no points, no streaks).
- Works entirely on your home network, with no cloud dependency.

### The two recurrence models

- **Completion-relative** ("every 60 days after completion"): the next due
  date is calculated from when you *actually* finished it. Finish late, and
  the whole schedule shifts later. Good for things like cleaning the oven,
  where what matters is the gap since it was last done.
- **Fixed calendar** ("every Thursday", "every other Wednesday", "the 1st of
  the month", "annually on 15 October"): the schedule is anchored to the
  calendar, not to when you happened to do it. Doing the bins three days
  late doesn't permanently drag bin day later — it's still due next
  Thursday. Good for things tied to an external schedule (collection day,
  a service due date).

This logic lives in one place — [`src/lib/recurrence`](src/lib/recurrence) —
and is the most heavily tested part of the app (see [Testing](#testing)).

## Architecture

A single Next.js application serves both the API and the UI:

```
Browser (phone / Pixel display)
        │  HTTPS on the LAN
        ▼
Next.js server (App Router)
  ├─ React Server Components — page shells, initial data
  ├─ Client Components + SWR — dashboard, forms, live updates
  ├─ Route Handlers (/api/*) — Zod-validated REST endpoints
  └─ Service layer (src/lib/services) — business logic, talks to Prisma
        │
        ▼
  Prisma ORM → SQLite file (data/choresome.db)
```

There is no separate backend process, no message queue, and no external
database server — SQLite is a single file on disk, which is exactly enough
for two people and a wall display, and it's trivial to back up (see
[Backups](#backups)).

**Why this shape:**

- Business logic (recurrence math, completion handling, stats, backups,
  notification decisions) lives in plain TypeScript modules under
  `src/lib/`, independent of Next.js and independent of React. They're unit
  tested directly, with no framework mocking required.
- API routes are thin: parse input with Zod, call a service function, shape
  the response. All the real decisions happen in the service layer.
- The client uses [SWR](https://swr.vercel.app/) for data fetching with a
  simple rule: any action that changes data triggers one blanket
  revalidation of every `/api/*` key currently in use. This keeps every open
  view (dashboard, task detail, stats, history) consistent without a lot of
  hand-wired cache invalidation.

## Technology choices

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | One process for UI + API, good PWA support, mature. |
| Language | TypeScript (`strict`) | Correctness matters more here than velocity. |
| Database | SQLite via Prisma | Zero-ops, file-based, plenty for a household. |
| Validation | Zod | Runtime-checked API boundaries; types derived from schemas. |
| Client data fetching | SWR | Small, does exactly what's needed (fetch + revalidate). |
| Dates | Hand-written (`src/lib/dates.ts`), `Intl` only | The recurrence engine's correctness depends on very specific date semantics (see below) — a general-purpose date library didn't fit better than ~150 lines of plain functions, and this way there's exactly one thing to understand. |
| QR codes | `qrcode` (client-side generation) | No external QR service. |
| Testing | Vitest | Fast, native TS/ESM support, real SQLite integration tests. |

Notably **not** used, on purpose: Redis, Kafka, microservices, Kubernetes, a
cloud database, Firebase/Supabase, any paid API, or an external auth
provider. None of them are needed to serve two people and a tablet.

### A note on dates

Due dates are **calendar days**, not instants — "clean the oven" is due on a
day, not at 14:32:07. They're represented as a plain `{ year, month, day }`
object and manipulated with integer arithmetic (see `src/lib/dates.ts`) —
this sidesteps almost every DST/timezone bug by construction, because
there's no timezone-aware arithmetic to get wrong in the first place. The
household's IANA timezone (set during setup) is consulted in exactly one
place: converting a completion's real timestamp into "which local day did
this happen on".

## Directory structure

```
prisma/
  schema.prisma        Data model (Household, Member, Area, Task, CompletionEvent)
  migrations/           Prisma migration history
  seed.ts               Dev-only demo data (guarded by SEED_DEMO_DATA=true)
src/
  app/
    (main)/              Routes sharing the phone/tablet app shell (bottom nav)
      page.tsx             Dashboard
      areas/               Area list + detail
      tasks/               New/edit task forms, task detail
      history/             Global activity log
      stats/               Household statistics
      settings/            Household/member/area/backup settings
    api/                 REST route handlers, one folder per resource
    display/             /display — the Pixel wall-display route
    t/[shortId]/         /t/{id} — NFC/QR quick-complete landing page
    setup/               First-run setup wizard
    layout.tsx           Root layout: fonts, theme, PWA registration
  components/            React components (mostly client components)
    display/               Wall-display-specific UI
    settings/               Settings page sections
  hooks/                  Client-side hooks (SWR wrappers, complete-task flow)
  lib/
    recurrence/             The recurrence engine — pure, framework-free, heavily tested
    services/               Business logic: tasks, completions, stats, backup, settings
    notifications/           Reminder decision logic + delivery-channel abstraction
    validation/              Zod schemas
    api/                     Shared API helpers (error handling, DTO shaping)
    client/                  Browser-only helpers (fetch wrapper, device preference)
    dates.ts                Calendar-date arithmetic
    task-status.ts           "Is this overdue / due today / upcoming?" logic
  instrumentation.ts       Starts the automatic backup schedule on server boot
scripts/
  run-backup.ts           Standalone backup trigger (for Task Scheduler, if preferred)
public/
  manifest.webmanifest, icons, sw.js, offline.html
data/                    SQLite database lives here (gitignored, created at runtime)
backups/                 Automatic timestamped backups land here (gitignored)
```

## Local development

Requires Node.js 20+ (developed against Node 24).

```bash
npm install
cp .env.example .env
npx prisma migrate deploy   # create data/choresome.db and apply the schema
npm run dev
```

Open <http://localhost:3000>. First run redirects to `/setup`.

To try the app pre-populated with months of realistic demo data for "Doug"
and "Sarah" instead of doing setup by hand:

```bash
# in .env: SEED_DEMO_DATA="true"
npx prisma db seed
```

The seed script refuses to run if a household has already completed setup,
so it can never clobber real data — and `SEED_DEMO_DATA` defaults to
`"false"`, so it's inert in any deployment that doesn't explicitly opt in.

## Testing

```bash
npm test          # run once
npm run test:watch
npx tsc --noEmit   # type check
npm run lint       # ESLint
```

The recurrence engine (`src/lib/recurrence`, `src/lib/dates`) has the
heaviest coverage in the project — every-N days/weeks/months/years, early
and late completion, every weekday and every-other-week patterns, monthly
and annual schedules including day clamping (31st → 28th/29th), leap years,
month/year boundaries, and DST transitions.

Service-layer tests (`src/lib/services/*.test.ts`) run against a **real**
ephemeral SQLite database rather than mocks — `vitest.global-setup.ts` runs
`prisma db push` against `prisma/test.db` once before the suite, and each
test resets the tables it touches. This is what catches things a pure unit
test can't, like the actual due-date recalculation behaviour when a
completion event is edited or deleted.

## Database migrations

Schema changes go through Prisma Migrate:

```bash
# after editing prisma/schema.prisma
npx prisma migrate dev --name describe_the_change
```

This creates a new folder under `prisma/migrations/` and applies it to your
dev database. In production, `docker-entrypoint.sh` runs
`npx prisma migrate deploy` automatically on every container start, which
only applies migrations that haven't run yet — safe to run repeatedly.

## Production deployment

### Option A: Docker Compose (recommended)

```bash
docker compose up -d --build
```

This builds the image, creates `./data` and `./backups` folders next to
`docker-compose.yml` (mounted into the container so your data survives
container rebuilds/updates), runs migrations, and starts the server on port
3000.

To update after pulling new code:

```bash
docker compose up -d --build
```

Migrations run automatically on startup; your data in `./data` is untouched.

### Option B: Plain Node.js (no Docker)

```bash
npm ci
cp .env.example .env      # edit DATABASE_URL if you want the DB somewhere specific
npx prisma migrate deploy
npm run build
npm start                 # serves on port 3000
```

## Windows mini-PC deployment (step by step)

This assumes a Windows mini PC that stays on and connected to your home
Wi-Fi/Ethernet, and that you have (or will install) Docker Desktop **or**
Node.js. Docker is recommended — it's one less thing to configure by hand.

### 1. Install prerequisites

- **Docker Desktop for Windows** (uses WSL2): <https://www.docker.com/products/docker-desktop/>
  — during install, accept the WSL2 backend if prompted.
- *(Node.js path only)* **Node.js 20 LTS or newer**: <https://nodejs.org>

### 2. Get the code onto the PC

Copy the project folder to the mini PC (USB drive, network share, or
`git clone` if Git is installed), e.g. to `C:\Choresome`.

### 3. Configure

```powershell
cd C:\Choresome
copy .env.example .env
```

Leave `DATABASE_URL` as-is for Docker (it's overridden by
`docker-compose.yml`). For the plain-Node path, the default relative path is
fine too.

### 4. Start it

```powershell
docker compose up -d --build
```

Check it's running: `docker compose ps`, and open
`http://localhost:3000` in a browser **on the mini PC** to confirm before
moving to other devices.

### 5. Find the mini PC's LAN address

```powershell
ipconfig
```

Look for the `IPv4 Address` under your active adapter (e.g. `192.168.1.42`).
Other devices on the same Wi-Fi/network reach the app at
`http://192.168.1.42:3000`. A static DHCP reservation for the mini PC (set
in your router) is worth doing so this address doesn't change later.

### 6. Start automatically after a reboot

**With Docker Desktop:** Docker Desktop has a setting to start on login
(Settings → General → "Start Docker Desktop when you sign in"), and any
container started with `restart: unless-stopped` (already set in
`docker-compose.yml`) restarts automatically once the daemon is back up. For
this to work unattended, also set the mini PC's Windows account to sign in
automatically after a power cut/reboot (Windows sign-in options, or
`netplwiz` to configure auto-login), since Docker Desktop needs a signed-in
session to start.

**Without Docker (Task Scheduler):** create a Scheduled Task that runs at
system startup:

- Trigger: "At startup"
- Action: `npm.cmd` with arguments `start`, start-in folder `C:\Choresome`
- Under Settings, enable "Run whether user is logged on or not" and "Run
  with highest privileges".

### 7. Updating later

Pull or copy in the new code, then:

```powershell
docker compose up -d --build
```

(or `npm ci && npm run build` then restart the app, for the Node path).
Your database and backups are untouched either way.

## Backups

This matters most here — completion history is meant to last years.

- **Automatic SQLite backups**: the app itself schedules these (see
  `src/instrumentation.ts`) — no cron job needed. Roughly every hour it
  checks whether it's been at least `backupIntervalHours` (Settings →
  Backup, default 24) since the last backup file, and if so writes a new
  timestamped snapshot to the configured backup directory (default
  `./backups`, or `/app/backups` in the container — already mounted to the
  host by `docker-compose.yml`) and prunes down to `backupRetention` most
  recent files (default 14). These use SQLite's `VACUUM INTO`, which is
  transactionally consistent even while the app is being used — not a raw
  file copy, which could capture a half-written page.
- **Manual trigger**: `npm run backup:run` (or
  `npx tsx scripts/run-backup.ts` inside the container) runs the same logic
  on demand — useful if you'd rather drive timing from Windows Task
  Scheduler than rely on the in-app schedule.
- **JSON export/import**: Settings → Backup & Restore → "Export JSON"
  downloads every household member, area, task and completion event as one
  JSON file — a human-readable, app-version-independent backup, good for
  archiving alongside the raw `.db` files. "Import JSON" restores from one;
  it **replaces all current data** and asks for confirmation first.
- **Backing up the raw database file yourself**: don't just copy
  `data/choresome.db` while the app is running (SQLite may have a
  transaction in flight). Either use one of the two options above, or stop
  the app first, then copy `data/choresome.db`.
- **Restoring**: stop the app, replace `data/choresome.db` with a backup
  file (rename it back to `choresome.db`), start the app again. Or use
  Settings → Import JSON with a JSON export instead.

## Installing the PWA on Android

1. Open `http://<mini-pc-address>:3000` in Chrome on the phone.
2. Chrome shows an "Install app" prompt automatically, or open the ⋮ menu →
   "Add to Home screen" / "Install app".
3. Launch it from the home screen icon — it opens without browser
   chrome, in standalone mode.
4. On first use on a personal phone, go to **Settings → This device** and
   pick that person as the device's default — completing a task from then
   on skips the "who did it?" step.

The same works on iOS Safari via Share → "Add to Home Screen" (with the
usual iOS PWA limitations — no Notification API, which only matters for the
foreground reminders described below).

## Setting up the Pixel wall display

1. On the old Pixel 8, connect to the same Wi-Fi as the mini PC and keep it
   permanently plugged into power.
2. Open `http://<mini-pc-address>:3000/display` in Chrome.
3. Add it to the home screen (see above) so it can be launched full-screen,
   or use the ⛶ button in the top-right corner of the display itself to
   enter fullscreen from the browser tab.
4. In Android Settings, disable the screen timeout/lock (Settings → Display
   → Screen timeout → longest option, or use a "Keep screen on" / kiosk app
   if you want to be thorough) — Choresome's own screensaver (configurable
   under Settings → Wall display in the app) handles dimming the *content*
   after a period of inactivity, but Android will still turn the physical
   screen off on its own timeout unless you change it.
5. Leave it on the dashboard. Tapping a task shows big "who did it?"
   buttons; after confirming, it shows a brief checkmark and returns to the
   dashboard automatically. After the configured idle period it shows a
   low-brightness clock/date screensaver instead of a static screen (it also
   nudges its own position periodically to reduce the chance of burn-in);
   tapping anywhere wakes it.

The display route requires no special configuration on the server side — as
far as the backend is concerned, it's just another browser hitting the same
API everything else uses.

## NFC tag / QR code setup

Every task has a short, unique URL: `/t/{shortId}` (e.g.
`http://192.168.1.42:3000/t/G3NuSsEK`). Opening it shows that one task and a
single big "Mark Complete" button — no navigation needed.

- **QR code**: open any task's detail page — its QR code and URL are shown
  near the bottom, with a "Download QR code" button to save/print it.
- **NFC tags**: write the same URL to a cheap NTAG213/215 sticker using any
  NFC-writing app on Android (e.g. NFC Tools) — Choresome doesn't need any
  special NFC code on the server or in the app; Android's own "open this
  URL" behaviour when tapping a tag does all the work. Stick the tag near
  the relevant appliance (e.g. on the washing machine, or inside a cupboard
  door), and tapping a phone against it opens straight to that task.

## Security

Choresome has **no built-in authentication** — it's designed for a trusted
home network only. **Do not expose it directly to the public internet**
(no port-forwarding your router's port 3000 to it, no putting it on a
public domain without adding your own reverse proxy + auth in front of it).

The service layer and data model don't assume any particular auth story, so
basic auth or a reverse-proxy-based login could be added later without
reshaping the app — see [Known limitations](#known-limitations--future-extensibility).

## Troubleshooting

**Can't reach it from my phone, but it works on the mini PC itself.**
Check Windows Firewall isn't blocking inbound connections on port 3000
(Docker Desktop usually configures this automatically; for the Node path
you may need to allow `node.exe` / port 3000 in Windows Defender Firewall
→ Advanced settings → Inbound Rules). Also confirm the phone is on the same
Wi-Fi network as the mini PC (not, e.g., a guest network that isolates
devices from each other).

**The site shows "Can't reach Choresome" (offline page).**
The service worker is showing its offline fallback because the server isn't
responding — check the mini PC is on and the container/process is running
(`docker compose ps`).

**Notifications aren't showing up.**
They only fire while the app is open in a tab or as an installed PWA in the
foreground (see [Known limitations](#known-limitations--future-extensibility))
— check Settings → Notifications shows "enabled", and that the browser
itself hasn't blocked notifications for the site.

**I need to reset everything and start over.**
Stop the app, delete `data/choresome.db` (and its `-journal`/`-wal`/`-shm`
siblings, if present), then start the app again — a fresh, empty database is
created automatically and you'll land back on the setup wizard. Consider
exporting a JSON backup first if there's anything worth keeping.

**`npx prisma migrate deploy` fails on startup.**
This usually means the schema and an existing database have diverged in a
way Prisma can't reconcile automatically (rare in normal use). Restore from
a recent backup (see [Backups](#backups)) rather than deleting data.

## Known limitations & future extensibility

Deliberately out of scope for v1, but the architecture leaves room for
these without a rewrite:

- **Notifications are foreground-only.** There's no push notification when
  the app is fully closed — that needs Web Push + VAPID keys (a real
  server-side subscription store and a signed push request), which is a
  meaningful chunk of infrastructure for a "keep it simple" v1. The
  `NotificationChannel` interface in `src/lib/notifications` exists
  specifically so a push-based channel can be added later without changing
  the decision logic (`computeDueNotifications`) at all.
- **No authentication.** Fine for a trusted home network; see
  [Security](#security). Adding basic auth or a reverse-proxy login later
  wouldn't require changing the data model — `Member` (a household profile)
  is already a separate concept from "who is logged in".
- **Single household.** The `Household` table is a singleton by design
  (`id` is always `1`). Multiple households would need a real tenancy model
  — not worth building until it's actually needed.
- **No area reordering UI.** Areas can be created, renamed and archived;
  drag-to-reorder wasn't worth the complexity for ~5–10 areas.
- Also not built, but compatible with the current architecture if wanted
  later: Home Assistant/MQTT integration, Google Calendar sync, voice
  assistant integration, webhooks, task photos, an inventory/consumables
  tracker, and a general read/write REST API for third-party integrations
  (the existing `/api/*` routes are already a reasonable starting point).
