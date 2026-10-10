# Multi-household (hosted service) design

This branch turns Choresome from a single-household LAN app into a service
many households can sign up for. This document is the design sketch and the
operator guide for it.

## The model

```
User ──< HouseholdMembership >── Household ──< Member, Area, Task, NfcTag, CompletionEvent
 │            (role: OWNER | MEMBER)  │
 ├──< Session (activeHouseholdId) >───┘
 ├──< PasswordResetToken
 └──< Invite (created by) ──────── Household
```

- **Household** is the tenant. It keeps every setting it had before
  (timezone, theme, holiday mode, display config).
- **Every household-owned table carries `householdId`.** That covers Member,
  Area, Task, NfcTag and CompletionEvent. The indexes now lead with
  `householdId`, so every list query stays an index range scan, however many
  households there are.
- **User and Member are deliberately separate.** A User is a login. A Member
  is someone chores are credited to, and they may never log in (for example a
  child, or a partner who only uses the wall display). One person can be
  both, but nothing requires it.
- **HouseholdMembership** links Users to Households with a role. One user can
  belong to several households and switch between them, for example their own
  home and an elderly parent's.
- **Session** is a random 256-bit token in an httpOnly cookie. Only its
  SHA-256 hash is stored. It records which household this browser is
  currently using. Expiry slides forward after 30 idle days, so an always-on
  wall display stays signed in indefinitely while an abandoned phone gets
  signed out.
- **Invite** is a single-use, 7-day link. Only its hash is stored. It carries
  the role the invitee will get.

## How a request is scoped

1. `src/proxy.ts` (Next 16's renamed middleware) makes two cheap checks:
   - With no session cookie, a page redirects to `/login?next=…` and an API
     call gets a 401.
   - Cross-site state-changing API requests get a 403 (CSRF defence in depth,
     on top of `SameSite=Lax` cookies).
2. `getAuth()` (`src/lib/auth/context.ts`) resolves the cookie to a live
   session and **re-checks the household against HouseholdMembership on every
   request**. Removing someone from a household therefore takes effect
   immediately. Pages call `requirePageHousehold()`; routes call
   `requireHousehold()` or `requireOwner()`.
3. **Every service function takes `householdId` as its first argument.** Rows
   are always looked up by `{ id, householdId }`, never by id alone.
4. **Every id that arrives in a request body is ownership-checked** before
   it's written (`src/lib/services/tenant.ts`). This covers a task's area and
   default assignee, a completion's member, and a tag's task. A household
   can't attach its rows to another household's.
5. **A row in another household is reported exactly like a missing row**
   (404), so ids can't be probed.

`src/lib/services/tenant-isolation.test.ts` pins all of this down. It runs
every read and write against a second household using the first household's
ids.

## Roles

| Action | Member | Owner |
|---|---|---|
| Chores, tasks, areas, members, NFC tags, settings, holiday mode, export | ✓ | ✓ |
| Invite people, change roles, remove people | | ✓ |
| Import a backup (it replaces the household's data) | | ✓ |
| Delete the household | | ✓ |
| Leave the household | ✓ | ✓ (unless they are the last owner) |

A household always has at least one owner. Deleting an account hands each
household that user owns alone to its longest-standing member. If nobody else
is in it, the household is deleted.

## Decisions and why

| Decision | Chosen | Alternatives considered |
|---|---|---|
| Tenancy | Shared schema with a `householdId` column | A SQLite file per household: strong isolation, but painful migrations and backups at scale |
| Enforcement | Explicit `householdId` parameter plus ownership checks, tested | A Prisma extension that injects the filter automatically: invisible and easy to bypass by accident |
| Database | **SQLite (WAL mode)** | Postgres: the right choice past one server, but it isn't installed on the dev machine; Prisma makes switching mostly a provider change |
| Passwords | Node's built-in `scrypt` | bcrypt/argon2: need native addons, which are fragile on Windows hosts |
| Sessions | Database sessions, hashed tokens | JWTs: can't be revoked, and "remove from household" and "sign out everywhere" must take effect instantly |
| Inviting | Copy-a-link invites | Emailed invites: need SMTP before the first household can even add a partner |
| Email | SMTP via nodemailer if `SMTP_URL` is set, otherwise written to `data/outbox/` | Requiring a mail provider to run at all |
| Import | New ids for every row, references rewritten | Keeping the bundle's ids, which could collide across households, or let a crafted file target another household's rows |
| Backups | Server-wide, configured by env vars | Per-household `backupDir`: a household must never choose a path on the server, so that setting was removed |
| Household id | Kept as an autoincrement `Int` | A cuid: unnecessary, since ids are never trusted without a membership check, and keeping `Int` gives a clean upgrade path for the existing install |

## Upgrading the existing single-household install

The `multi_household` migration attaches every existing row to household 1.
The household then has no logins, so claim it:

```bash
npm run admin -- claim-household --household 1 --email you@example.com
```

That prints a one-hour link to set the account's password. Alternatively, use
**Export JSON** on the old install and **Import JSON** into a new household on
the hosted one.

## Running it

```bash
npm run build
node --env-file=.env.hosted.local scripts/start-hosted.mjs
```

`start-hosted.mjs` applies pending migrations, then runs `next start`.
Configuration is documented in `.env.example`: APP_URL, SIGNUPS_ENABLED,
TRUST_PROXY, SESSION_IDLE_DAYS, BACKUP_*, SMTP_URL and MAIL_FROM.
`GET /api/health` is an unauthenticated liveness and database check.

Operator commands (`scripts/admin.ts`):

- `npm run admin -- list-households`
- `npm run admin -- claim-household --household <id> --email <email>`
- `npm run admin -- reset-link --email <email>` prints a reset link, for when SMTP isn't configured.

For a public deployment, put it behind a TLS-terminating reverse proxy, set
`APP_URL=https://…` (this makes cookies `Secure` automatically) and
`TRUST_PROXY=true`, and add an HSTS header at the proxy.

## Not built yet

- **Billing.** There are no plans, trials or Stripe yet. Each household would
  need a subscription status and a webhook. That's a business decision more
  than a technical one.
- **Email verification** on sign-up. Password reset already proves control of
  the email address when it matters.
- **Multiple app instances.** Rate limiting is in-memory and SQLite is a
  single file. Scaling past one server means Postgres plus a shared
  rate-limit store such as Redis.
- **Web Push** reminders. These are still foreground-only, as before.
- **An admin dashboard.** Operators use the CLI above.
