# Gym Manager

A private, browser-based management system for **one gym**: members, membership packages, fees and payments (PKR), attendance, trainers and a live dashboard.

Built with Next.js (App Router, TypeScript), Tailwind CSS, shadcn-style components (Radix UI), Supabase (PostgreSQL + Auth + Row Level Security), Zod, React Hook Form and Recharts.

| Guide | For whom |
| --- | --- |
| **This README**: run it on your computer | You (developer / IT) |
| [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md): create the database, apply migrations, create the owner login | You |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): GitHub + Vercel, going live | You |
| [`docs/OWNER_GUIDE.md`](docs/OWNER_GUIDE.md): day-to-day use | The gym owner |

---

## What it does

- **Dashboard**: registered / active / expired / inactive members, today's check-ins, fees collected today and this month, outstanding and overdue fees, expiring memberships. There are charts for monthly collections, member growth and 30-day attendance, plus lists of unpaid fees, expiring members, recent payments, check-ins and new members. Every figure comes from the database. Nothing is hard-coded.
- **Members**: add, search (name / member ID / phone), filter by status, paginate, view a profile, edit, and deactivate or reactivate. A member can be deleted only if they have no history. Duplicate phone numbers get a warning with a "Save anyway" option, because families share numbers.
- **Packages**: create, edit, activate or deactivate. Duration is set in days or months and the price in PKR. The price agreed when a package is sold is **stored on the membership**, so later price changes never alter history.
- **Memberships**: assign or renew with a start-date suggestion (the day after the current one ends) and an end-date preview. Overlapping memberships are refused. The full history is kept. A mistaken membership can be cancelled, which voids its unpaid fee.
- **Fees & payments**: assigning a package creates a fee record automatically. You can record full or partial payments by Cash, Bank transfer, Easypaisa, JazzCash or Other, mark a fee as paid, add other fees (admission and so on), filter by member, method, date and status, and print a receipt. Unpaid, Partially paid, Paid and **Overdue** are calculated, never typed in. Payments are **never deleted**: corrections are made by *voiding* with a reason, which goes into the audit trail.
- **Attendance**: quick search-and-check-in, one check-in per member per gym day (enforced by the database), check-out, a daily list and per-member history. A member without a valid membership is blocked. The owner may override with a reason, and the override is recorded.
- **Trainers**: add, edit, search, activate or deactivate, and view a profile.
- **Settings**: gym name, logo, contact phone, email, address, currency, timezone, the "expiring soon" window, a receipt note and password change.
- **Roles**: **owner** (everything) and optional **staff** (daily work only: no voids, settings, packages, trainers, deactivation or overrides). These rules are enforced **in the database**, not just by hiding buttons.

## Project structure

```
src/
  app/
    (auth)/          login, forgot-password, reset-password
    (app)/           protected pages: dashboard, members, packages, fees, attendance, trainers, settings
    (print)/receipt  printable receipt
    auth/            server actions (sign in/out, reset) + email-link handler
  components/ui/     buttons, inputs, dialogs, tables, badges …
  components/app/    app shell, payment / membership / check-in dialogs, filters …
  lib/               Supabase clients, auth helpers, validation (Zod), dates, money, error messages
  proxy.ts           refreshes the session and redirects logged-out visitors to /login
supabase/
  migrations/        version-controlled SQL: schema, business functions, RLS, storage
  snippets/          SQL to grant the owner access and to verify the setup
  tests/             database business-rule & security tests
tests/               unit tests (dates, money, validation, error messages)
docs/                setup, deployment and owner guides
```

## Run it on your computer (VS Code)

**You need:** Node.js **20.9 or newer** (22 LTS recommended, see `.nvmrc`) and a Supabase project set up as in [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

1. Open the project folder in VS Code (**File → Open Folder…** and choose the `gym-manager` folder).
2. Check Node: **Terminal → New Terminal**, then run `node -v`. If you see an error or a version below 20.9, install Node 22 LTS from https://nodejs.org, close VS Code completely and reopen it.
3. Install the packages (only needed the first time, and after pulling new code):
   ```bash
   npm install
   ```
4. Create your settings file by copying the example:
   - Windows (PowerShell): `Copy-Item .env.example .env.local`
   - macOS/Linux: `cp .env.example .env.local`

   Open `.env.local` and paste your Supabase **Project URL** and **Publishable key** (see the setup guide).
5. Set up the database: apply the migrations and create the owner login, as described in [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).
6. Start the app:
   ```bash
   npm run dev
   ```
7. The terminal prints a line like `- Local: http://localhost:3000`. Open **that exact address** in Google Chrome. If port 3000 is busy, Next.js picks another one (for example `http://localhost:3001`) and prints it. Use whatever it shows.
8. Log in with the owner email and password you created in Supabase.
9. **To stop** the server, click in the terminal and press `Ctrl + C`. **To restart**, run `npm run dev` again. After changing `.env.local`, always stop and restart.

If the app shows **"Connect the database to continue"**, `.env.local` is missing or still has placeholder values. Fix it and restart.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with live reload |
| `npm run build` | Production build (the same thing Vercel runs) |
| `npm start` | Runs the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then strict TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Database rule & security tests against a **local throwaway PostgreSQL** (`TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db`). Never point it at your real project. |
| `npm run check` | lint + typecheck + unit tests + build |

## Environment variables

| Name | Public? | Required | Where to find it |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Yes | Supabase → Project Settings → API Keys → Publishable key (`sb_publishable_…`). The legacy `anon` key also works, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as an alternative name. |
| `NEXT_PUBLIC_SITE_URL` | Public | Recommended in production | Your live address, e.g. `https://gym.example.com`. Used for password-reset links. |

**No secret or service-role key is used anywhere.** The publishable key is meant to be visible in the browser. Data is protected because every request runs as the logged-in user, and PostgreSQL Row Level Security plus the database functions decide what that user may do. Never add a `service_role` / `sb_secret_…` key to this project, and never prefix a secret with `NEXT_PUBLIC_`.

## How data safety works

- **Auth**: Supabase email + password. There is no public sign-up: accounts are created by you in the Supabase dashboard and then **granted** access with one SQL line. A logged-in user without a profile row sees nothing.
- **RLS on every table**: anonymous visitors have no privileges at all. Logged-in users with gym access can read, and only specific columns or tables are writable, depending on role.
- **Money is changed only by database functions** (`record_payment`, `void_payment`, `assign_membership` …). Each one runs as a single transaction, locks the fee row, validates the amount against the balance, and recomputes totals from the payments. The browser cannot write to `payments` or `fee_invoices` directly.
- **Duplicate-click protection**: every payment form carries a one-time key with a unique constraint in the database. A double-click or retry returns the same payment instead of creating a second one.
- **Attendance**: a unique constraint on `(member, gym day)`.
- **Timezone**: "today" means the calendar day in the gym's timezone (Settings, default `Asia/Karachi`). It is computed in the database (`gym_today()`) and used for check-ins, payment dates, overdue status and dashboard figures. "This month" means the 1st of the current month up to today, in that timezone.
- **Audit trail**: voids, cancellations, overrides, removed check-ins and every change to members, packages, trainers, settings and access are written to `audit_events`, which only the owner can read.

## Verification status (what was actually tested)

Tested in the build environment against PostgreSQL 16 with the real Supabase Auth server (GoTrue v2.180) and PostgREST v12:

- `npm run lint`, `npm run typecheck` and `npm run build` pass. `npm test` passes 32 unit tests.
- `npm run test:db` passes 88 database assertions covering payments, partial payments, idempotency, over-payment, void and audit, overdue, renewals and overlap, price snapshots, attendance duplicates and overrides, deletion rules, and owner, staff, anonymous and no-access permissions.
- A 30-step browser test (Chromium) covered the full flow: login, settings, packages, member and package, partial payment with a double-click, over-payment refusal, mark as paid, receipt, duplicate-phone warning, check-in and duplicate, override, check-out, void, renewal and overlap, price change, search and filters, trainers, deactivation, dashboard figures, mobile layout, logout, staff restrictions and the no-access user. All steps passed.
- Direct API attacks with a staff token (insert package, void payment, delete payment, edit fee totals, read audit log) were all refused by the database.

**Not yet verified, because it needs your accounts:** your own Supabase project, password-reset email delivery (it depends on the email provider configured in Supabase), logo upload to Supabase Storage, and the Vercel deployment. The steps are in the guides.

## Branding

The gym name and logo are set in the app under **Settings** (owner only) and appear in the sidebar and on receipts. Colours live in `src/app/globals.css` under `@theme`. Change `--color-brass*` for the accent and `--color-graphite*` for the sidebar.
