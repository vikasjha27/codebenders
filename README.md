# TutorDesk

A one-person back office for independent home tutors in India: invoices, payments, reminders, bills and cash forecasting in one place, with no login and no server.

Built for the **ACE Builders Hackathon 2026**, Problem Statement 1: **"The One-Person Back Office"** for independent home tutors in India.

## Problem

Solo tutors and 1–5 person tutoring setups track fees and expenses in WhatsApp chats, notebooks and spreadsheets. They cannot quickly see who owes what, how long it has been owed, or whether next week's rent is covered.

## Features

- **Invoices** numbered `TD-<year>-<4-digit seq>`, with ₹ amounts and a derived status: Draft, Sent, Partially Paid, Paid, Overdue.
- **Payments** recorded in full or in part by UPI, Cash, Bank Transfer or Other. The balance is recalculated after each payment.
- **Reminders**: editable tiered reminder drafts with copy, a WhatsApp link when the parent's phone is set, and a stored "reminder sent" timestamp.
- **Who owes me**: aging buckets (Due soon, 1–7, 8–15, 16–30, 31+ days overdue) and a per-student breakdown.
- **Chase this today**: prioritised alerts on the Dashboard.
- **Cash forecast**: 30/60/90-day projection with the lowest expected balance.
- **What-if simulator**: late payer, new student, or extra monthly expense.
- **Recurring bills**: monthly, quarterly, yearly and one-time, with catch-up and paid-cycle handling.
- **Reset Demo Data** in Settings, behind a confirmation prompt.

## Tech stack and architecture

- **Stack:** React 18, React Router 6, TypeScript (strict), Vite 5, plain CSS (`src/styles.css`).
- **Tests:** Vitest with jsdom and `@testing-library/react` (with jest-dom matchers).
- **Business logic** is pure functions in `src/domain/` (money, dates, invoice status, payments, reminders, receivables, forecast, what-if, alerts, bills). No React or storage code there.
- **UI** lives in `src/features/` (dashboard, invoices, expenses, students, settings). Components read data through `AppDataProvider` (`src/storage/`) and write through repository functions.
- **Storage** sits behind a `StorageAdapter` (`src/storage/adapter.ts`). Data is stored in the browser's localStorage. If localStorage is unavailable (for example some private-browsing modes), the app falls back to in-memory storage, and data is lost on reload. The localStorage key is `tutordesk:data:v1`.
- **Corrupt data is never overwritten on load.** The user gets a raw backup download and an explicit option to replace it with demo data.

Source layout: `src/app` (App, routes), `src/components`, `src/domain`, `src/features`, `src/seed` (demo data, reset), `src/storage`, `src/test`.

## Getting started

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest, single run
npm run typecheck  # tsc --noEmit
npm run build      # typecheck, then production build to dist/
npm run preview    # serve dist/ locally
```

`npm run build` runs the typecheck first, so a type error fails the build.

## Deployment

`npm run build` writes a static site to `dist/` (one HTML file, one JS bundle, one CSS file). Asset paths are absolute, so the site must be served from a domain root.

- **Vercel:** `vercel.json` rewrites all paths to `/index.html`.
- **Netlify:** `public/_redirects` contains `/* /index.html 200`, and is copied into `dist/` at build time.
- **Other hosts and GitHub Pages:** see `DEPLOY.md`. GitHub Pages serves from a subpath, so it needs a `base` change in `vite.config.ts` and a `404.html` copy. This is **not configured** in the repo.

The SPA rewrite is required. Without it, a page such as `/invoices` returns a 404 on refresh, because the host looks for a file at that path.

No server or environment variables are needed. Data stays in the tutor's browser.

## How it was built

TutorDesk was built with a staged Codebenders IDE workflow. Specialist agents handled exploration, edits and test runs in sprints. Each reported defect was reproduced by a failing test before it was fixed. Key fixes:

- ₹0 invoices were shown as Paid.
- Draft invoices counted as due and as forecast receivables.
- Stale monthly bills stacked one catch-up outflow per missed cycle.
- Quarterly and yearly bills were skipped.
- Expenses "pending this month" summed all unpaid bills, not just this month's.
- The Dashboard payment link did not open the payment form.

## Limitations

- **Storage:** Data is stored in the browser's localStorage. If localStorage is unavailable (for example some private-browsing modes), the app falls back to in-memory storage, and data is lost on reload. Data is also lost if the site's browser data is cleared. It does not sync between browsers or devices.
- **No login and no multi-user support.**
- **Sample data is fictional.**
- **Pricing is a proposal, not billed.** The in-app figures are Solo ₹299/month, up to 5 tutors ₹599/month, first 30 days free.
- **Not browser-tested by hand.** Verification is by unit and component tests only.
- **npm audit** reports 8 advisories (2 critical, 1 high per the summary), mostly in dev tooling (vite, vitest, esbuild), plus an open-redirect advisory in react-router 6.x. The fixes are major-version upgrades that may break things, so they were deliberately not applied.
- **GitHub Pages** needs base-path configuration before it will work (see Deployment).
- **Dashboard payment link:** The payment form pre-fills the outstanding balance as the amount, today's date, and UPI as the default mode; the amount can be edited for partial payments.

## Team and license

- Team: Vikas Jha
- License: `<to add>` *(placeholder, to be completed)*
