# Ya-Da (יה-דע) — Design Document

## Context

Dalia runs a children's art studio (4 weekly classes: 2 Sunday, 1 Monday, 1
Thursday). Parents pay monthly tuition by Bit, Paybox, bank wire, or cash.
The user (not Dalia) issues a receipt for every payment through the Morning
(Green Invoice) app, but today the "who owes what" picture lives in a manually
maintained Google Sheet (roster tab, invoices log tab, one balance tab per
month) that has to be updated by hand and doesn't scale or remind anyone of
anything.

Ya-Da replaces that manual sheet with a small hosted web app that always
shows the current picture of who has paid and who hasn't, captures payments
automatically via a Morning webhook when possible, and falls back to quick
manual entry when it can't. It's built for the user to operate (not Dalia,
not yet); Dalia gets her own simplified view in a later phase.

## Goals

- At any moment, see every child's payment status for the current month (and
  any past-due months) at a glance.
- Every payment — whatever the method — ends up linked to the right
  child(ren) and month(s), whether it arrives via Morning's webhook or is
  entered by hand.
- Price per child is tracked over time (not just "now"), so a month's due
  amount always reflects what was actually in effect that month, even after
  a later price change (e.g. Dalia's planned January increase).
- Payer identity (name, phone/email when known, who — mom/dad/other) is
  stored once per payer and shared across sibling children.
- The system gets better at auto-matching incoming receipts over time by
  remembering corrections the user makes.
- Start from real history: the existing roster and the October/November
  balance data get imported, not re-entered.

## Non-goals (this phase)

- No UI for Dalia — she's not a user of this build.
- No Android/web push notifications yet — the dashboard's own "missing
  payments" list, plus a manual WhatsApp reminder action (see UI design
  system below), are the reminder surfaces for now. A working push
  spike already exists (`push-spike/`, `docs/push-setup-guide.md`,
  confirmed working on Android incl. lock screen) and should be reused
  when push is built later — for both the user's phone and Dalia's.
- No fully-automated Morning webhook parsing on day one — the exact payload
  shape is unknown (GreenInvoice's docs describe *that* webhooks exist, not
  their payload). See "Morning webhook" below for the two-step plan.
- No multi-business/multi-tenant support, no handling of classes/pricing
  beyond Dalia's studio.

## Anti-goals

- A dashboard the user can't trust at a glance (e.g. wrong due amounts
  because a price change was applied retroactively) defeats the whole
  purpose — correctness of "what's missing" takes priority over
  auto-matching cleverness.

## Constraints

- UI language: Hebrew, RTL. App name "Ya-Da", treated as grammatically
  female.
- Dates displayed and entered as `ddmmyyyy`.
- Week starts Sunday in any calendar/date-picker UI.
- Single user for now (the person running this conversation), signed in
  with Google via Clerk.

## Data model (conceptual)

- **payers** — id, display name, role (mom/dad/other/unspecified), phone,
  email. Phone/email are optional and get filled in over time ("I'll add
  them as we go").
- **payer_name_aliases** — raw customer-name strings seen on incoming
  receipts, mapped to a payer. Grows every time the user resolves a
  receipt manually, so matching improves over time.
- **children** — id, first name, family name, class day+time, gender,
  payer_id, enrollment start date, active flag.
- **child_prices** — id, child_id, monthly amount, effective-from month.
  A child's due for a given month = whatever price row was in effect that
  month (not the current price). Dalia's planned January raise is just a
  new row per child added when it happens — no special-cased logic needed.
- **receipts** — id, external document number, received_at, source
  (`morning_webhook` / `manual`), raw payload (jsonb, kept as-is for
  Morning ones), status (`matched` / `needs_review`).
- **receipt_lines** — id, receipt_id, child_id (nullable until resolved),
  month, amount, payer_id snapshot. One receipt can carry multiple lines
  (multiple children and/or multiple months), matching how the user
  described real invoices.
- Monthly due/paid status per child is *computed*, not stored: for each
  active child, for each month from their enrollment to the current month,
  due = price in effect that month, paid = sum of matched receipt_line
  amounts for that child+month.

## Payment matching logic

1. A receipt arrives (webhook) or is entered (manual) and always becomes a
   `receipts` row with one or more `receipt_lines`.
2. Auto-match attempt: resolve payer via `payer_name_aliases` /
   exact name match; where the payload gives usable child/month hints,
   pre-fill `receipt_lines.child_id`/`month`.
3. Anything not confidently resolved is surfaced on the dashboard under
   "needs review" — the user picks the payer and the child(ren)/month(s)
   for each line.
4. Every manual resolution is saved back into `payer_name_aliases` (and a
   similar per-child name hint) so the same customer name matches
   automatically next time.

## Morning / Green Invoice webhook — two-step plan

GreenInvoice supports webhooks, but we don't know the exact payload shape
and can't test it without live traffic. So:

- **Step A (build now):** a webhook receiver endpoint that accepts and
  durably logs whatever arrives (raw body + headers) as a `needs_review`
  receipt, with a raw-payload viewer in the dashboard so the user can
  inspect real incoming data.
- **Step B (after first real payload):** once we see actual data, write
  the real parser that extracts document number, date, customer name,
  and per-line child/month/amount hints into `receipt_lines`, replacing
  the "store raw and review" fallback with real auto-matching. This can't
  be fully designed up front and is expected to be iterated.
- Signature/auth verification for the webhook: add if GreenInvoice's real
  request includes a verifiable secret/signature; otherwise rely on an
  unguessable endpoint path plus manual review of anything unexpected.

## Initial data import

Source: the existing Google Sheet
(`רשימת תלמידים`, `חשבוניות`, `מאזן אוקטובר 2026`, `מאזן נובמבר 2026` tabs),
read via Google Sheets API using the user's own access.

- Import ~21 children from `רשימת תלמידים` (first name, family name, class
  day/time, gender). Where a child's family-name cell is blank in the
  sheet, treat it as "same payer as the row above" (a siblings convention
  observed in the sheet) — flagged for the user to confirm post-import
  rather than guessed silently.
- Create one payer per distinct family name, display name = family name
  initially (role left unspecified, phone/email blank) — the user refines
  payer identity (mom/dad, real name, contact info) as real payments come
  in, per their stated workflow.
- Seed `child_prices` at 300 (the current discount rate) for every child
  effective from their first tracked month, as a starting default — the
  user corrects any child who should be at full price (330) after import,
  since the sheet itself doesn't record this distinction.
- Import October and November status from the two `מאזן` tabs: paid/not-paid
  per child per month, and the linked receipt number where present,
  creating matching `receipts`/`receipt_lines` rows (source = `manual`,
  since they predate the webhook) so history isn't lost.
- Cross-reference `חשבוניות` (invoices tab) by document number to backfill
  receipt date/customer-name where a balance-tab row references a קבלה
  number.

## Tech stack (implementation detail, the user deferred these choices)

- Next.js (App Router, TypeScript), hosted on Vercel.
- Supabase (Postgres) for the database.
- Clerk for auth, Google sign-in only, single user.
- Plain server-rendered pages + a couple of client components for the
  dashboard and the "resolve a receipt" flow — no need for anything
  heavier at this scale (~20 children).

## UI design system

A full Hebrew/RTL design system for Ya-Da already exists as a Claude Design
System artifact: https://claude.ai/artifact/Xy3FxqoZNXSvfkua6PjMmr (built
separately via Cowork). It covers tokens (a warm "paper"/terracotta palette,
Varela Round + Rubik type, paid/partial/missing status colors), a component
library (status chips, method chips, summary cards, unpaid list/cards, class
cards, month picker, receipt-match rows), and full screen designs:

- **Dashboard** (desktop, mobile, and an "all paid" celebration state):
  month picker → alert strip (only when something's overdue) → 4 summary
  cards → unpaid list → 4 class cards → recent payments → receipts to
  review + payment-method breakdown.
- **Families**: searchable family list + a family detail view (both
  parents, who gets reminders, each child's badge/price/override/active
  state, payment history). This is where child/payer editing and moving a
  child between class groups happens.
- **Record payment**: modal — family, a grid of children × months (so one
  payment can cover siblings/multiple months at once), amount, date,
  method chips, who paid, and the Morning receipt number. This is the
  manual-entry and receipt-resolution flow.
- **Receipts to review**: unlinked Morning receipts, with phone-number-based
  matching hints against known parents where available.
- **Classes**: settings for the 4 weekly groups (day/time/color/enrollment)
  and the default full-price/discount amounts.
- **Year view**: a family × month grid from September to June, each cell
  colored by status — the single clearest "full picture at all times" view;
  clicking a cell opens the record-payment modal.
- **WhatsApp reminder sheet**: shows the preferred parent, a ready-to-send
  message, last-reminder date, and a button that opens WhatsApp with the
  message pre-filled (sent manually, not automated) — included in this
  phase since it needs no push infrastructure.
- **Login**: kept visually (logo, palette illustration, paint dabs) but its
  email/password fields are swapped for a single Google sign-in button,
  since auth is Clerk + Google only.

Two things in the existing design system need correcting before/while
building, since they were designed for a different assumption (Dalia as the
direct user) than what we settled on here:

- **Voice**: copy is currently written to address Dalia directly
  ("בוקר טוב, דליה"); it needs to address the user instead (this phase has
  no Dalia-facing UI at all).
- **Pricing labels**: it uses "new/continuing" (חדש/חדשה, ממשיך/ממשיכה)
  child badges tied to price; these should become "full price/discount"
  framing instead, per the earlier decision (Dalia's planned price change
  means a price tier, not enrollment status, is what actually varies).

Everything else in it — RTL conventions, ddmmyyyy dates, Bit/Paybox/bank
wire/cash methods, paid/partial/missing status colors — already matches
what we agreed on, and should be used as the actual implementation
reference (tokens, components, and screen structure) rather than rebuilt
from scratch.

## Open items / assumptions (flagged, not blocking)

- Exact Morning/GreenInvoice webhook payload — unknown until first live
  event; plan explicitly accounts for this (Step A/B above).
- Which currently-imported children are "full price" vs "discount" —
  seeded as discount (300) by default, needs a one-time manual pass by
  the user after import.
- Whether GreenInvoice webhook requests are verifiable (signature/secret)
  — to be confirmed once Step A is live and a real request is observed.

## Verification

- Seed data import checked against the source sheet: child/payer counts
  match, and a handful of known October/November paid/unpaid cells spot-
  checked against the dashboard.
- Dashboard manually checked against today (Nov 5): confirms it shows all
  of November's dues and correctly flags unpaid ones.
- Manual payment entry exercised end-to-end: enter a multi-child,
  multi-month payment, confirm it updates the right cells.
- Webhook receiver verified by registering the real URL in GreenInvoice
  and confirming a real payment event logs a `needs_review` receipt with
  a readable raw payload.
