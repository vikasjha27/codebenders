# TutorDesk — Design

TutorDesk is a one-person back office for independent home tutors in India (solo or up to 5 tutors). It replaces WhatsApp chats, notebooks and spreadsheets for: student/parent records, fee invoices, monthly bills and expenses, cash position, and a 30/60/90-day cash forecast.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Build / dev server | Vite 5 + TypeScript (strict) | Fast dev loop, zero-config static output |
| UI | React 18 + `react-router-dom` v6 | Familiar, small, routes map to features |
| Styling | Plain CSS in `src/styles.css` | No framework to learn or maintain |
| Persistence | Browser `localStorage` behind a `StorageAdapter` interface | Works offline with zero backend; swappable later |
| Tests | Vitest + jsdom + `@testing-library/react` + jest-dom | Same toolchain as Vite, fast |

No runtime dependencies beyond React and React Router. No state library: feature hooks load `AppData` once and write through repositories.

## 2. Folder structure

```
src/
  domain/          Pure logic. No React, no storage.
    types.ts         Shared types (Student, Invoice, Bill, AppData, ...)
    money.ts         formatINR (₹ with Indian grouping)
    dates.ts         ISO date parse/format/add/diff helpers (explicit `today` everywhere)
    invoiceStatus.ts deriveInvoiceStatus, isDueSoon
    forecast.ts      forecastCash (30/60/90-day projection)
  storage/         Persistence. Knows about AppData, not about UI.
    adapter.ts       StorageAdapter interface, localStorage + in-memory implementations
    schema.ts        SCHEMA_VERSION, STORAGE_KEY, emptyAppData()
    repository.ts    loadAppData / saveAppData + pure upsert/delete helpers
  seed/            Demo data and "Reset Demo Data" (added in a later step)
  features/
    students/      Student list and editor
    invoices/      Invoice list, creation, payment recording
    expenses/      Bills and expenses
    cash/          Cash balance, forecast view
  components/      ErrorBoundary, Spinner, Layout (shared UI)
  lib/             Presentation helpers (format wrappers for UI)
  app/             Route table and app shell wiring
  test/setup.ts    jest-dom matchers for Vitest
  styles.css
  main.tsx         Entry point (added with the UI step)
```

Dependency direction: `features` → `components`, `lib`, `storage`, `domain`. `storage` → `domain`. `domain` depends on nothing in the app.

## 3. Persistence

- All app data lives under one localStorage key, `tutordesk:data:v1`, as a single JSON document `AppData` with `schemaVersion`.
- `StorageAdapter` is the only thing that touches `window.localStorage`. The repository functions take an adapter, so tests use `createMemoryAdapter()`.
- `loadAppData` never throws. Missing data → empty defaults, no error. Corrupt JSON, malformed shape, or a different `schemaVersion` → empty defaults plus an `error` message the UI can show.
- Repository mutators (`upsertStudent`, `deleteStudent`, `upsertInvoice`, `upsertBill`, `markBillPaid`) are pure: `AppData in → AppData out`. The UI calls `saveAppData` with the result.
- **Migration path to Supabase/Postgres:** implement a new `StorageAdapter`-like backend with the same load/save surface (or a repository per table), keep `domain/` unchanged, and keep the feature components calling the same repository functions. Tables map 1:1 to `students`, `invoices`, `bills`, `cash_snapshot`, `assumptions`.

## 4. Invoice status rule

Stored `status` is what the user last set (`Draft` or `Sent`). The effective status is derived on read by `deriveInvoiceStatus(invoice, today)`, in this order:

1. `paidAmount >= amount` → **Paid**
2. `0 < paidAmount < amount` → **Partially Paid**
3. otherwise, if `dueDate < today` → **Overdue**
4. otherwise → the stored status (`Draft` or `Sent`) is kept

Dates are ISO `yyyy-mm-dd` strings, so comparisons are plain string comparisons.

`isDueSoon(invoice, today, days = 3)` is true when the derived status is neither Paid nor Overdue and `dueDate` falls in `[today, today + days]`.

## 5. Forecast rule

For a horizon D ∈ {30, 60, 90} days, with `limit = today + D`:

- **Expected collections** = Σ over invoices whose derived status is not Paid and whose `dueDate <= limit` of `(amount − paidAmount) × expectedCollectionRate`.
- **Upcoming bills** = Σ over bills with `paidForCycle = false` and `nextDueDate <= limit` of `amount`.
- **Projected balance at day D** = `cashBalance + expectedCollections − upcomingBills`.

Items already overdue (`dueDate` or `nextDueDate` before today) are included, because they are still expected. The forecast is a simple, explainable projection, not an accounting model.

## 6. Deployment

- `npm run build` runs a type check and `vite build`, producing a static site in `dist/`.
- `dist/` can be served by any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, or an nginx/S3 bucket).
- Because the app uses client-side routes, the host must rewrite unknown paths to `index.html` (for example, a `_redirects` file on Netlify or a `vercel.json` rewrite).
- No server or environment variables are needed while storage is localStorage. Data stays in the tutor's browser.

## 7. Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type check + production build to `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm test` | Vitest, single run |
| `npm run typecheck` | `tsc --noEmit` |
