# Venue Outreach

A small internal tool for researching and contacting music/entertainment venues on
behalf of Classical Guitar Ceremonies. Built with Next.js (App Router), Vercel
Postgres, and the Anthropic API (web search) for venue discovery.

This is a personal, single-user tool — there is no login/auth.

## Features

- **Dashboard** — sortable/filterable table of venues, inline status editing,
  CSV export.
- **Search Profiles** — save free-text search criteria and re-run them on demand
  ("Run now"). Each run asks Claude to break the criteria into several narrower
  web searches (e.g. per city/county) for better coverage, then dedupes results
  against existing venues by name + city before inserting new ones as `New`.
- **Draft Email** — generates an editable pitch email per venue (venue name is
  filled in automatically). Nothing is ever sent without an explicit click on
  **Send**.
- **Send** — sends via Gmail SMTP from `info@classicalguitarceremonies.com`,
  automatically appending your business address and an opt-out line. Sets the
  venue's status to `Contacted` and records the date. Venues marked
  **Opted Out** are excluded from sending (and shown grayed out on the
  dashboard) but are never deleted.

## Tech stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS)
- Postgres via the `pg` driver, reading `POSTGRES_URL` — compatible with a
  Postgres database provisioned through the Vercel Storage tab (Neon-backed)
- `@anthropic-ai/sdk` for venue research (web search tool)
- `nodemailer` for Gmail SMTP sending

## Setup

### 1. Provision Postgres on Vercel

1. Open your project in the Vercel dashboard → **Storage** tab.
2. Click **Create Database**, choose **Postgres** (this provisions a Neon-backed
   Postgres database through the Vercel Marketplace integration).
3. Follow the prompts to create it, then **Connect** it to this project. Vercel
   will automatically add `POSTGRES_URL` (and related `POSTGRES_*` variables)
   to your project's environment variables for all environments
   (Production/Preview/Development).
4. No manual migration step is needed — the app creates its two tables
   (`venues`, `search_profiles`) automatically on first request if they don't
   already exist.

For local development, run `vercel env pull .env.local` after linking the
project with `vercel link`, or copy the `POSTGRES_URL` value from the Vercel
dashboard into a local `.env.local` (see `.env.example`).

### 2. Set the remaining environment variables

In Vercel → Project Settings → Environment Variables, add:

| Variable | Description |
| --- | --- |
| `ANTHROPIC_API_KEY` | API key from the [Anthropic Console](https://console.anthropic.com/). Powers "Run now" venue research. |
| `GMAIL_USER` | The Gmail address used to authenticate SMTP sending. |
| `GMAIL_APP_PASSWORD` | A 16-character [Gmail App Password](https://myaccount.google.com/apppasswords) for that account (requires 2-Step Verification). Not your regular Gmail password. |
| `BUSINESS_ADDRESS` | Plain-text mailing address appended to the footer of every outreach email. |

Emails are sent **from** `info@classicalguitarceremonies.com`. For this to
land correctly (and not get flagged), configure `GMAIL_USER`'s Gmail account
to send as that address: Gmail Settings → **Accounts** → **Send mail as** →
add `info@classicalguitarceremonies.com` and verify it, or simply use a Gmail
account/Workspace mailbox whose address already is
`info@classicalguitarceremonies.com`.

None of these secrets are hardcoded anywhere in the codebase — they're read
from `process.env` only.

### 3. Deploy

Push to your Git provider and import the project into Vercel as usual (or run
`vercel deploy`). Once the Postgres database and the four environment
variables above are set, the app is fully functional.

### 4. Local development

```bash
npm install
cp .env.example .env.local   # fill in values, or `vercel env pull .env.local`
npm run dev
```

If `POSTGRES_URL` isn't set, the app still boots and shows a "Database not
connected" notice instead of crashing, so you can preview the UI shell before
wiring up a database.

## Notes on the "Run now" search

Runs use Claude Opus 5 with the web search tool. The model is instructed to
issue several narrower searches (by city/county/venue type, as implied by your
criteria) rather than one broad query, then returns a structured list of
venues. Each result is deduped against existing venues by
`lower(name) + lower(city)` before being inserted with status `New` and a
reference back to the search profile that found it. A run can take one to a
few minutes depending on how much the criteria expands into sub-searches; the
route is configured with a 5-minute execution budget
(`export const maxDuration = 300`), which requires a Vercel plan that supports
extended function durations (Pro or higher) — on Hobby, reduce this or expect
runs to be cut off around 60s.

## Schedule field

Search profiles store a `schedule` field for forward-compatibility, but only
`"manual"` is currently supported — profiles run only when you click
**Run now**.
