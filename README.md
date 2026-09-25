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
        │  HTTP on the LAN (direct :3010, or via Caddy on :80 — see Deployment)
        ▼
Caddy (native binary, optional) ──▶ Next.js server (App Router)
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
  schema.prisma        Data model (Household, Member, Area, Task, NfcTag, CompletionEvent)
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
      settings/            Household/member/area/NFC tags/backup settings
    api/                 REST route handlers, one folder per resource
    display/             /display — the Pixel wall-display route
    nfc/complete/[token]/  /nfc/complete/{token} — tap-to-complete landing page
    setup/               First-run setup wizard
    layout.tsx           Root layout: fonts, theme, PWA registration
  components/            React components (mostly client components)
    display/               Wall-display-specific UI
    settings/               Settings page sections (incl. NFC tag manager)
  hooks/                  Client-side hooks (SWR wrappers, complete-task flow)
  lib/
    recurrence/             The recurrence engine — pure, framework-free, heavily tested
    services/               Business logic: tasks, completions, NFC tags, stats, backup, settings
    notifications/           Reminder decision logic + delivery-channel abstraction
    validation/              Zod schemas
    api/                     Shared API helpers (error handling, DTO shaping)
    client/                  Browser-only helpers (fetch wrapper, device preference)
    dates.ts                Calendar-date arithmetic
    task-status.ts           "Is this overdue / due today / upcoming?" logic
    short-token.ts           Shared random-token generator (NFC tag tokens)
  instrumentation.ts       Starts the automatic backup schedule on server boot
scripts/
  run-backup.ts           Standalone backup trigger (alternative to the automatic schedule)
  server/                 Native Windows production deployment (see below)
    setup-server.ps1        One-time: fetches Caddy, opens firewall ports, registers Task Scheduler entries
    deploy.ps1               Pull + install + migrate + build + restart, with a health check
    start-choresome.cmd      What the "Choresome" scheduled task actually runs
    start-caddy.cmd          What the "Choresome Caddy" scheduled task actually runs
  deploy.ps1               (gitignored) Local trigger: SSHes to the mini PC and runs server/deploy.ps1
public/
  manifest.webmanifest, icons, sw.js, offline.html
data/                    SQLite database lives here (gitignored, created at runtime)
backups/                 Automatic timestamped backups land here (gitignored)
Caddyfile                Native production reverse proxy config (see Windows mini-PC deployment)
Dockerfile, docker-compose.yml
                         Dev/testing convenience only — not used in production (see below)
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

### Docker Compose (optional, for testing a production-like build)

Production deployment doesn't use Docker (see [Windows mini-PC
deployment](#windows-mini-pc-deployment-step-by-step)) — but `docker-compose.yml`
is still here if you want to sanity-check a production build locally
without installing anything beyond Docker Desktop:

```bash
docker compose up -d --build
```

Serves the app at `http://localhost:3010`, with `./data` and `./backups`
bind-mounted next to `docker-compose.yml`.

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
dev database. In production, `scripts/server/deploy.ps1` runs
`npx prisma migrate deploy` on every deploy (and Docker's
`docker-entrypoint.sh` does the same for the dev-convenience container path)
— which only applies migrations that haven't run yet, so it's safe to run
repeatedly.

## Production deployment

**Production runs natively on Windows — no Docker.** Docker Desktop's
WSL2 backend reserves a meaningful chunk of RAM just by being open, before
running a single container; on a small mini PC that's not an acceptable
baseline cost just to host one small app. Native Node.js plus a native
Caddy binary, both managed by Task Scheduler, gets the same result — an
always-on app with a friendly URL that survives reboots — for roughly
150–200MB combined, with nothing running in the background when the app
itself is idle beyond that.

Docker Compose is still in this repo (`docker-compose.yml`) as a
**development/testing convenience** — see [Local development](#local-development)
— but it's optional and never required to run Choresome for real.

## Windows mini-PC deployment (step by step)

This assumes a Windows mini PC that stays on and connected to your home
Wi-Fi/Ethernet, with [Node.js 20 LTS or newer](https://nodejs.org) and
[Git](https://git-scm.com/) installed. Nothing else — no Docker Desktop, no
IIS, no Windows Service wrapper.

### 1. Get the code onto the PC

```powershell
cd C:\Apps
git clone https://github.com/<your-fork>/choresome.git
```

(or copy the project folder over some other way, e.g. a USB drive — `C:\Apps\choresome`
is just this repo's own convention; any path works as long as every command
and script below is run from wherever you actually put it.)

### 2. One-time setup

```powershell
cd C:\Apps\choresome
npm ci
copy .env.example .env
npx prisma migrate deploy
npm run build
.\scripts\server\setup-server.ps1
```

`setup-server.ps1`:

- Downloads a native `caddy.exe` (a single ~40MB binary, no installer) into
  the project folder, if it's not already there.
- Opens Windows Firewall for ports **3010** (the app) and **80** (Caddy).
- Registers two Task Scheduler entries — **Choresome** and **Choresome
  Caddy** — both triggered "At startup", both set to restart automatically
  if they crash. This is the same mechanism you'd use for any other
  always-on script on this machine; no Windows Service, no NSSM.

Then start both for the first time:

```powershell
Start-ScheduledTask -TaskName "Choresome"
Start-ScheduledTask -TaskName "Choresome Caddy"
```

Check it's running: open `http://localhost:3010` in a browser **on the
mini PC** to confirm before moving to other devices.

### 3. Find the mini PC's LAN address

```powershell
ipconfig
```

Look for the `IPv4 Address` under your active adapter (e.g. `192.168.1.42`).
Other devices on the same Wi-Fi/network reach the app at
`http://192.168.1.42:3010`. A static DHCP reservation for the mini PC (set
in your router) is worth doing so this address doesn't change later — and
is what the Caddy hostname below points at, so it needs to stay put.

### 3b. Friendly hostname with Caddy

Typing an IP address (and a port) every time is easy to forget. The
`Caddyfile` at the repo root is already configured to serve the app at
`chores.home.arpa` — a name under the
[`.home.arpa`](https://datatracker.ietf.org/doc/html/rfc8375) special-use
domain reserved specifically for home networks, so it'll never clash with a
real internet domain. Two things make that name actually work:

**1. Point the hostname at the mini PC, in your router.** Look for a
section your router firmware calls "Local DNS", "DNS Rewrites", "Static
DNS", or similar (common on AdGuard Home, Pi-hole, OPNsense/pfSense, and
some ASUS/Netgear/Ubiquiti models) and add an entry:

| Hostname | Points to |
|---|---|
| `chores.home.arpa` | *(the mini PC's LAN IP — see step 3)* |

If your router has no such feature, `chores.home.arpa` won't resolve for
anyone and you're back to using the plain IP with port 3010 instead.

**2. Use a different hostname instead**, if you'd rather — just edit the
`Caddyfile`:

```
http://your-name.home.arpa {
	reverse_proxy localhost:3010
}
```

then restart the Caddy task (`Restart-ScheduledTask -TaskName "Choresome Caddy"`,
or stop/start it), and point the router's DNS entry at the new name instead.

Once both are in place, everyone on the network can use
`http://chores.home.arpa` — no port, nothing to remember beyond the one
name. It can take a minute for devices to pick up a new DNS entry, or a
Wi-Fi reconnect/reboot on stubborn ones. The direct `http://<mini-pc-ip>:3010`
address (see step 3) keeps working exactly the same either way — Caddy is
an addition, not a replacement.

This is plain HTTP, not HTTPS — `chores.home.arpa` isn't a publicly
resolvable name, so no certificate authority can issue it a real
certificate. `.home.arpa` names are still eligible for a locally-trusted
certificate from Caddy's own internal CA, but that means installing
Caddy's root certificate on every phone/device yourself, which is a
meaningfully bigger step this setup doesn't take unasked.

### 4. Start automatically after a reboot

Already done by `setup-server.ps1` — both Task Scheduler entries trigger
"At startup" (not tied to any particular user signing in). For them to
actually run unattended after a power cut, the mini PC itself needs to boot
without waiting at a lock screen: Windows sign-in options → set the account
to not require a password on this trusted device, or use `netplwiz` to
enable automatic sign-in. (Task Scheduler tasks configured this way still
start at boot even without auto-login, as long as "Run whether user is
logged on or not" isn't required — the setup script doesn't set that flag,
since it would mean storing the account's password. If you'd rather not
touch auto-login at all, that flag plus a stored credential is the
alternative: edit the tasks in Task Scheduler's UI, tick "Run whether user
is logged on or not", and supply the account password when prompted.)

### 5. Updating later

From your own machine, with the `scripts/deploy.ps1` /
`.deploy.local.json` pattern set up (copy `.deploy.local.json.example`,
fill in your mini PC's username/IP, keep both untracked — see the files
for the exact shape):

```powershell
.\scripts\deploy.ps1
```

This SSHs in and runs `scripts/server/deploy.ps1` on the mini PC, which
pulls the latest code, reinstalls dependencies, regenerates the Prisma
client, applies any new migrations, rebuilds, restarts both tasks, and
verifies the app actually answers on port 3010 before declaring success —
failing loudly (and leaving the previous build's `node_modules`/`.next`
alone) rather than silently deploying something broken. Your database and
backups are untouched either way.

Prefer to do it by hand at the machine instead? The same steps, run
directly there:

```powershell
cd C:\Apps\choresome
git pull --ff-only
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
Stop-ScheduledTask -TaskName "Choresome"
Stop-ScheduledTask -TaskName "Choresome Caddy"
Start-ScheduledTask -TaskName "Choresome"
Start-ScheduledTask -TaskName "Choresome Caddy"
```

## Backups

This matters most here — completion history is meant to last years.

- **Automatic SQLite backups**: the app itself schedules these (see
  `src/instrumentation.ts`) — no cron job needed. Roughly every hour it
  checks whether it's been at least `backupIntervalHours` (Settings →
  Backup, default 24) since the last backup file, and if so writes a new
  timestamped snapshot to the configured backup directory (default
  `./backups` next to wherever the app is running — `C:\Apps\choresome\backups`
  for the native deployment, or `/app/backups` in the container for the
  dev-convenience Docker path) and prunes down to `backupRetention` most
  recent files (default 14). These use SQLite's `VACUUM INTO`, which is
  transactionally consistent even while the app is being used — not a raw
  file copy, which could capture a half-written page.
- **Manual trigger**: `npm run backup:run` runs the same logic
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

1. Open `http://chores.home.arpa` in Chrome on the phone (once the Caddy
   hostname is set up — see [3b](#3b-friendly-hostname-with-caddy) — or
   `http://<mini-pc-address>:3010` otherwise). Prefer the hostname if it's
   available: installing an app and each device's "who am I" preference are
   both tied to the exact URL used, so switching between the IP and the
   hostname later means reinstalling / re-picking the device's person.
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
2. Open `http://chores.home.arpa/display` in Chrome (or
   `http://<mini-pc-address>:3010/display`).
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

Tapping a registered tag **completes its task immediately** — there's no
intermediate task page, no "Complete" button to press, and (after the first
scan on a given device) no "who did this?" prompt. The intended workflow is
literally: do the chore, tap the tag, done.

### How it works

Each **NFC tag** is its own record (Settings → NFC / QR Tags), separate from
the task it happens to point at right now:

```
token (permanent, on the sticker)  →  NfcTag row  →  task (reassignable)
```

The physical sticker only ever encodes `/nfc/complete/{token}` — a permanent
random ID with no meaning of its own. Which task that resolves to is looked
up in the database and can be changed any time in Settings, without touching
the sticker. Retiring an appliance or reorganising a room just means
reassigning its tag to a different task.

Opening that URL:

1. Loads a small page (a plain `GET` — nothing is completed yet).
2. If this device already has a remembered household member (see below), it
   immediately fires a `POST` to complete the task and shows a confirmation:

   ```
   ✓ Dishwasher filter cleaned
   Completed by Doug
   Just now
   Next due: 25 October
   ```

   with an **Undo** button for a few seconds, for accidental taps.
3. If this device doesn't have a remembered member yet, it asks once
   ("Who's completing this?"), remembers the answer for next time (same
   `localStorage` preference personal devices already use for the regular
   dashboard), and then completes the task. Every scan after that is fully
   automatic — Doug's phone always attributes to Doug, Sarah's phone always
   attributes to Sarah.

**Duplicate protection**: repeated scans of the *same tag* within about 60
seconds are treated as the same action (no second completion event) — this
covers a browser reload, Android re-triggering the intent, or holding the
phone against the tag a moment too long. This is a separate, longer window
than the few-second double-tap protection on the regular dashboard's
"Complete" button, which is unaffected by any of this.

### Setting up a tag

1. Go to **Settings → NFC / QR Tags → Register a new tag**, give it a
   friendly name/location (e.g. "Washing machine cupboard"), and assign it
   to a task.
2. Click **QR** on that tag to reveal its QR code and URL, with **Copy** and
   **Download QR** actions.
3. **For an NFC sticker**: write the copied URL to a cheap NTAG213/215 tag
   using any NFC-writing app on Android (e.g. NFC Tools) — Choresome doesn't
   need any special NFC code on the server or in the app; Android's own
   "open this URL" behaviour when tapping a tag does the rest. Stick it near
   the relevant appliance.
4. **For a QR code**: print or download it and stick it up instead — scanning
   it with a phone camera behaves identically to an NFC tap.

Reassigning, disabling, renaming, or checking when a tag was last used all
happen from that same Settings list — nothing needs rewriting on the
physical tag unless you're retiring it entirely.

## Security

Choresome has **no built-in authentication** — it's designed for a trusted
home network only. **Do not expose it directly to the public internet**
(no port-forwarding your router's port 3010 or 80 to it, no putting
`chores.home.arpa` — or any hostname pointing at it — on public DNS).
The bundled Caddy reverse proxy is there purely for a friendly *local*
hostname and adds no authentication of its own; it isn't a step towards
internet exposure.

The service layer and data model don't assume any particular auth story, so
basic auth (Caddy supports this natively, via `basic_auth` in the
Caddyfile) or a reverse-proxy-based login could be added later without
reshaping the app — see [Known limitations](#known-limitations--future-extensibility).

## Troubleshooting

**Can't reach it from my phone, but it works on the mini PC itself.**
`setup-server.ps1` opens Windows Firewall for ports 3010 and 80
automatically — check those two rules exist (Windows Defender Firewall →
Advanced settings → Inbound Rules → search "Choresome") and re-run
`setup-server.ps1` if not. Also confirm the phone is on the same Wi-Fi
network as the mini PC (not, e.g., a guest network that isolates devices
from each other).

**The app or Caddy isn't running / doesn't come back after a crash.**
Check Task Scheduler (`taskschd.msc`) for the "Choresome" and "Choresome
Caddy" tasks — both should show "Running" or a recent successful "Last Run
Result". Start one by hand with `Start-ScheduledTask -TaskName "Choresome"`
(or `"Choresome Caddy"`) and check its "Last Run Result" if it doesn't come
up; both are configured to restart automatically on failure, so something
stopping repeatedly is worth investigating directly (run
`scripts\server\deploy.ps1` again for a clean rebuild) rather than just
restarting it again.

**`chores.home.arpa` doesn't resolve / times out, but the IP:port works.**
The router-side DNS entry either isn't set up yet or hasn't propagated —
see [3b](#3b-friendly-hostname-with-caddy). Use `http://<mini-pc-ip>:3010`
in the meantime; nslookup/ping the hostname from another device to check
whether it's resolving at all.

**The site shows "Can't reach Choresome" (offline page).**
The service worker is showing its offline fallback because the server isn't
responding — check the mini PC is on and the "Choresome" scheduled task is
running (see above).

**A page looks broken or unstyled, or shows old data that won't go away.**
Usually a stale service worker holding onto an old cached version of the app
shell — most likely if this browser previously pointed at a different
Choresome instance on the same address (e.g. a developer's local build, or
after reinstalling on the same hostname/port). Reinstalling the PWA, or in a
browser tab going to the site's settings → clear site data (or DevTools →
Application → Service Workers → Unregister) and reloading, forces it to pick
up the current version. This doesn't affect any server-side data.

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
