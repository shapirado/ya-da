# Ya-Da — Ya-Da

Ya-Da is the payment tracker for Dalia's children's art studio. Dalia is the only user. She opens it to see who has paid for the month and to remind the families who haven't. The interface is in Hebrew and right-to-left throughout. It should feel like a warm art studio, but it's a money tool, so **the numbers come first**.

## Content fundamentals

- **Language:** Hebrew, RTL. `<html dir="rtl" lang="he">`. Phone numbers, emails and receipt numbers sit inside an LTR isolate (`.ltr`).
- **Voice:** short and friendly, written to Dalia (בוקר טוב, דליה). Not bureaucratic. Reminders to parents are polite and personal: they use the parent's first name, the child's name and the class.
- **Dates:** always `ddmmyyyy` with no separators, e.g. `05112026`. Weeks start on Sunday (ראשון).
- **Currency:** `₪` after the number with a space (`1,500 ₪`), with thousands separators and tabular figures. Partial amounts read "300 מתוך 600", never "300/600", because a slash flips order in RTL.
- **Gender:** badges follow the child's gender: חדש/חדשה, ממשיך/ממשיכה. Generic labels use the slash form (שילם/ה).
- **Methods:** ביט · פייבוקס · העברה בנקאית · מזומן. Who paid: אמא / אבא.
- **Classes:** there is one class type, **חוג אומנות**, taught in four weekly groups (ראשון 16:00, ראשון 17:30, שני 16:30, חמישי 16:00). Wherever a child is shown, the group is named by its day and time.
- **Prices:** 330 ₪ for a new child, 300 ₪ for a continuing child, and an optional per-child override.

## Visual foundations

- **Paper first:** pages sit on `paper`, with cards on `card` and a `line` hairline and very soft `shadow-card`. Wells, table headers and the sidebar use `paper-sunk`.
- **Accents:** `terracotta` is the brand colour (primary buttons, active nav, the logo). `mustard`, `sage` and `teal` are paint accents for dabs, the brush underline, charts and illustration. Accents are never used for body text; use the `*-ink` partner instead.
- **Status:** `paid` (green), `partial` (orange) and `missing` (soft coral, not alarm red). Chips use `*-soft` fill and `*-ink` text plus a `*-paint` dot. Rings, bars and grid cells use the same three colours. Every status also carries a word.
- **Hand-drawn touches, used sparingly:** a mustard brush underline below page titles only, a single paint-dab dot before section headings, and crayon-style icons. At most one illustration per screen (login or the celebration).
- **Type:** Varela Round for titles, headings and the logo. Rubik for text and numbers, with `font-variant-numeric: tabular-nums` on every amount.
- **Shape:** generous rounding: `radius-md` (14px) for controls and `radius-lg` (20px) for cards. Spacing uses the `space-*` scale: 24px card padding on desktop, 16px on mobile, 32px between sections.
- **Contrast:** all text pairs are at least 4.5:1 (see each token's note). `ink-faint` is only for placeholders and icons.

## Layout

- **Desktop:** a 236px sidebar on the right (RTL start) with the logo, four nav items and a primary **רישום תשלום** button. The main column holds a top bar with the month picker in the centre.
- **Dashboard order:** month picker → alert strip (only when needed) → 4 summary cards → unpaid list → 4 class cards → recent payments → receipts to review and the method breakdown, side by side.
- **Mobile (≤ 600px):** summary cards become a 2×2 grid, unpaid rows become stacked cards with full-width buttons, class cards become a 2×2 grid, and there's a bottom tab bar with a central terracotta record-payment button.
- **RTL arrows:** in the month picker, the right chevron (›) goes back to the previous month and the left chevron (‹) goes forward. Horizontal scroll in the year grid pins the family column on the right.

## Iconography

The crayon line icons are in `YaDa.icons`: 24px grid, 1.9px round strokes, slightly uneven paths, drawn in `currentColor`. Payment methods use generic icons (a bolt for Bit, a phone for Paybox, a bank, cash). Ya-Da never copies the apps' logos.

## States

- **Alert strip:** hidden when nothing is missing. The second, coral line appears only when there's debt from an earlier month.
- **All paid:** the unpaid list is replaced by **כולם שילמו! 🎨** with the palette illustration, and missing shows `0 ₪` in plain ink.
- **Class behind:** below 60% paid, the card's ring turns orange and the card gets the **מפגר בתשלום** flag.
- **Reminder never sent:** **לא נשלחה תזכורת** in partial-ink with a bell icon.

## Using this system

`components/bundle.css` holds the `yd-*` classes. `components/bundle.js` defines `window.YaDa`: sample data for November 2026 (12 families, 16 children, 5,010 ₪ expected, 3,510 ₪ collected, 1,500 ₪ missing, 70%), the icons, HTML renderers for each component (`YaDa.c`) and full screens (`YaDa.screens`). The cards in **Screens** are the screen designs: login, dashboard (desktop, mobile and all-paid), year view, families, record-payment modal, classes settings and the WhatsApp reminder sheet.
