# Huduma Online — Public Service Request System

A mini eCitizen-style portal where citizens report local service issues (broken streetlights, water problems, missed garbage collection, potholes, drainage, etc) and county officers track them to resolution.

## Features

| Requirement                                                      | Where        |
| ---------------------------------------------------------------- | ------------ |
| Citizen registration / login (email or national ID + password)   | `/auth`      |
| Submit request — category, location, description, optional photo | `/report`    |
| Status tracking — Pending → In Progress → Resolved               | `/dashboard` |
| Admin dashboard — update status, add notes                       | `/admin`     |
| Analytics — open vs resolved, by category, resolution rate       | `/admin`     |

**Bonus:** full status history timeline per request, search + status/category filters, private photo storage (only owner and staff can view), citizen profile page, reference numbers, responsive layout.

## Tech stack

- TanStack Start (React 19, file-based routing) + Vite
- Tailwind CSS v4 with semantic design tokens (`src/styles.css`)
- shadcn/ui components, Recharts for charts
- Supabase: Postgres database, authentication, file storage
- Zod for form validation, Vitest for tests

## Project structure

```text
src/
  routes/
    index.tsx                 Landing page
    auth.tsx                  Sign in / sign up
    _authenticated/route.tsx  Login gate for the pages below
    _authenticated/report.tsx     Submit a request
    _authenticated/dashboard.tsx  Citizen's own requests
    _authenticated/admin.tsx      Officer dashboard + analytics
    _authenticated/profile.tsx    Citizen profile
  components/
    SiteHeader.tsx    Navigation + status badge
    RequestCard.tsx   Request details, photo, progress, history
    StatCards.tsx     Summary tiles
  lib/
    requests.ts       Categories, status flow, stats helper (pure, tested)
    validation.ts     Shared signup and request schemas
    session.ts        Session + role hooks
  test/               Vitest tests
supabase/
  migrations/         Database schema and storage policies (SQL)
```

## Data model & security

- `profiles` — name, unique national ID, phone (created automatically on sign-up)
- `user_roles` — `citizen`, `officer`, `admin` (separate table to prevent privilege escalation)
- `service_requests` — category, location, description, image path, status, admin notes
- `request_status_history` — written by a database trigger on every status change
- Row-level security: citizens see only their own requests; officers/admins see and update all. Citizens cannot set status themselves.
- The migrations create the schema, roles, and storage policies, record officer responses without repeating them on status changes, and provide rate-limited ID sign-in. Only the server-side Edge Function can resolve a national ID to an email address.

## Roles

The **first account to sign up becomes admin**. Further officers can be added by inserting an `officer` row into `user_roles` from the Supabase Dashboard.

## Local development

```bash
bun install
Copy-Item .env.example .env  # only on first setup
bun run dev
bun run lint
bunx tsc --noEmit
bun run test
bun run build
```

## Production deployment

The production site is available at [civic-connect-vercel.vercel.app](https://civic-connect-vercel.vercel.app). Vercel deploys from the `main` branch using the Nitro Vite adapter. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in the Vercel project environment settings; never commit `.env` or a Supabase secret/service-role key.

## Supabase setup

Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard), independent of any app builder. Copy its Project URL and publishable key into `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the same values for server rendering. This app uses the browser Supabase client with RLS; it does not need a service-role key.

Link the CLI to the project and apply the schema and storage policies:

```bash
bunx supabase link --project-ref <your-project-ref>
bunx supabase db push
bunx supabase functions deploy sign-in-with-id
```

The ID sign-in Edge Function uses the Supabase-provided service-role key only on the server. It never returns the email associated with an ID, sends only access/refresh tokens to the requesting user, and rate-limits attempts by IP address and a keyed hash of the ID. Deploy it separately from the Vercel app after applying database migrations.

### Launch verification

This project uses the email sender configured by Supabase. Email delivery can be rate-limited, so test signup confirmation and password reset with a small number of test accounts before launch. If delivery is throttled, wait and review the sender's limits in Supabase.

Run the checklist against a separate staging Supabase project, not production. The first account created becomes admin, so create two citizen accounts and an officer/admin test account with the intended roles. Use test data only.

| Check | Pass condition |
| --- | --- |
| Signup and confirmation | A new citizen receives the confirmation email, follows its link, and can sign in. |
| Sign-in | Email/password and national-ID/password both open the correct citizen account; incorrect credentials are rejected. |
| Password reset | A reset email arrives, its link opens the app, and the new password works. |
| Requests | A citizen submits one request without a photo and one with a valid photo; both appear in their dashboard. |
| Citizen isolation | A second citizen cannot view or change the first citizen's requests or private photos. |
| Staff workflow | An authorized officer can change Pending → In Progress → Resolved and add a response; a citizen cannot change status. |
| History | Citizens see each status transition and officer response once, in order. |

Record pass/fail and fix every failure before launch. Then run `bun run lint`, `bunx tsc --noEmit`, `bun run test`, and `bun run build`. These checks reduce launch risk.

For local Supabase development, install and start Docker Desktop, then run `bunx supabase start`. The CLI prints the local URL and keys to use in `.env`. Never commit `.env`.

## Usage

1. Sign up (first user = admin).
2. Go to **Report issue**, choose a category, enter location and description, optionally attach a photo.
3. Track it under **My requests**.
4. As admin, open **Admin dashboard** to see analytics, filter requests, add a note and move the request to In Progress / Resolved.
