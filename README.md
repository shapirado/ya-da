# סטודיו ידיים — ניהול תשלומים

Next.js (App Router) + Supabase + Morning (Green Invoice) + Gemini. Hebrew RTL dashboard (Google sign-in via Clerk) for
registrations, monthly class charges, camps, WhatsApp reminders and screenshot → receipt.

## Setup

1. **Database** — run `supabase/migrations/001_app_additions.sql` in the Supabase SQL editor. It adds:
   - `child_activity.paid_amount` (partial payments; back-fills rows already marked `paid`)
   - `payment_log` (every receipt issued through the app)
   - `reminder_log` (when a WhatsApp reminder was opened per payer)
   - the `settings` row `id='default'` and a unique index on `payer_name_aliases(payer_id, raw_name)`
2. **Environment** — copy `.env.example` to `.env.local` (and add the same keys in Vercel → Settings → Environment Variables).
3. **Login (Clerk)** — in the Clerk dashboard create an application (or reuse the one from your other app),
   enable **Google** as a social connection, and copy the two keys into the env vars. Put the Google
   emails that may use the app in `ALLOWED_EMAILS` (comma-separated). Anyone else who signs in sees
   "אין לך הרשאה". For extra safety, also turn on Restrictions → Allowlist in Clerk with the same emails.
4. `npm install && npm run dev`, then open http://localhost:3000.

## How the data is used

- `class_groups` = a session (day + time + color). `activities` has **one row per month per class group**
  (`activity_type='חוג'`, month only in `start_date`/`end_date`) and **one row per camp** (`activity_type='קייטנה'`).
- `child_activity` = one charge per child per month (or per camp).
  Price: `child_activity.price` → `activities.default_price` → `settings.default_full_price`.
  Choosing "full price" at enrollment stores `price = null`, so a mid-year price change on the group
  (Activities screen → "שינוי מחיר") reaches those children from the chosen month on; discounted/custom prices stay.
- A charge is **due** once its month has started (`start_date <= today`, Israel time). Reminders and family debt only count due charges.
- Stopping a child mid-year deletes that group's **unpaid** rows from the chosen month on.
- Family = payer = `children.morning_customer_id` (→ `temp_parents`). Phone comes from `נייד` (fallback `טלפון`), email from `כתובות מייל`.
- Adding a child with a new payer creates the customer in Morning first, then inserts it into `temp_parents`.

## Payments flow

Paste (Ctrl+V), drop or pick a screenshot → `lib/gemini.ts` extracts one or more payments →
`lib/matching.ts` ranks payers (saved alias → exact name → shared name tokens, + children named in the note,
+ debt equal to amount) → `lib/billing.ts#allocate` picks the open charges (exact-sum match first, then oldest first) →
you adjust → a receipt is issued in Morning (`MORNING_DOC_TYPE`, default 320), charges are updated
(`paid_amount`, `payment_status`, `invoices[]`), the payment is logged and the screenshot name is saved as an alias.

## Things to verify before going live

- **Bit / PayBox in Morning**: payment rows use `type: 10` with `appType` 1 (Bit) / 3 (PayBox) — see `APP_TYPE` in
  `lib/morning.ts`. Confirm the codes against Morning's API docs for your account (try `MORNING_ENV=sandbox` first).
- **Document type**: 320 = חשבונית מס/קבלה. If the studio is עוסק פטור, set `MORNING_DOC_TYPE=400` (קבלה).
- **VAT**: income lines are sent with `vatType: 1` (price includes VAT).
- **Gemini**: `lib/gemini.ts#extractPayments` can be replaced with your own implementation; keep the return shape.

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm test` — billing, matching and date logic (node:test)
- `npm run typecheck`
