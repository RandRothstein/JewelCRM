# JewelCRM

A jewellery CRM + ERM built with Next.js 15 App Router, TypeScript, Tailwind CSS v4, Prisma and SQLite.

## How to run

```bash
npm install
npx prisma db push
npm run prisma:seed
npm run dev
```

Open http://localhost:3000 — `/` redirects to `/dashboard` when signed in, otherwise to `/login`.

Type-check with `npx tsc --noEmit`.

## Demo users

| Role | Email | Password | 2FA |
| --- | --- | --- | --- |
| Owner | `owner@jewelcrm.local` | `Owner@123` | Yes |
| Manager | `manager@jewelcrm.local` | `Manager@123` | Yes |
| Greeter | `greeter@jewelcrm.local` | `Greeter@123` | No |
| Sales CRO | `sales@jewelcrm.local` | `Sales@123` | No |
| Sales CRO Two | `sales2@jewelcrm.local` | `Sales@123` | No |
| Marketing CRO | `marketing@jewelcrm.local` | `Marketing@123` | No |

Owner and Manager sign in with a one-time code. In mock mode the code is printed to the **server console** (`[2FA OTP for …]`).

## PRACTICE_MODE

Controlled by the `practiceMode` setting (seeded as `true`, editable in **Settings**). While it is on, every mock WhatsApp message — campaigns, estimate follow-ups, hold reminders — is routed to a staff phone instead of the customer, so you can demo safely. Message cost is still logged to Monthly costs. Turn it off only when a real WhatsApp provider is connected.

## Feature map

| Area | Page | API |
| --- | --- | --- |
| Showroom floor (greeter check-in, CRO assignment, products, live-rate estimates, end visit) | `/showroom` | `/api/visits` |
| Customers (stage filters, timeline, audited JSON export) | `/customers`, `/customers/[id]` | `/api/customers`, `/api/customers/[id]` |
| Catalog (computed price, slow-mover badge, add, XLSX import) | `/catalog` | `/api/products`, `/api/catalog/import` |
| Shifts (overlap rejection per user) | `/shifts` | `/api/shifts` |
| Targets & incentive tiers | `/targets` | — |
| Stock check (RFID scan, manager approval adjusts stock) | `/stock-check` | `/api/stock` |
| Campaigns (template types, opted-in segments, mock send) | `/campaigns` | `/api/campaigns` |
| Holds (24h, locked rate/price, max 2 active, deposit above threshold, extend/cancel) | `/holds` | `/api/holds` |
| Bookings | `/bookings` | `/api/bookings` |
| Loyalty accounts and coupons | `/loyalty` | `/api/loyalty` |
| Feedback / NPS | `/feedback` | `/api/feedback` |
| Reports | `/reports` | `/api/reports` |
| Settings, gold rates, monthly costs | `/settings`, `/settings/costs` | `/api/settings` |
| Public store (no login) | `/store/[token]` | `/api/store/[token]/hold` |
| Follow-up job (day-2/day-5 estimate follow-ups + hold expiry) | — | `POST /api/jobs/followups` |
| Payments (mock gateway) | — | `/api/payments`, `/api/payments/confirm?ref=…` |

All mutating APIs require a valid session (401 for missing or pending-2FA sessions) and write to the audit log. Customer stage is refreshed after visits, estimates, holds and payments.

### Public store links

Creating an estimate in **Showroom** generates a customer link (`/store/<token>`). After seeding, `/store/demo` is an anonymous catalog link: visitors enter name and phone to place a hold.

### Pricing

`price = weight × current purity rate + making + stones − discount`, using the latest `GoldRate` for each purity (set under **Settings**). Products with a `priceOverride` use that fixed price instead.

### Running the follow-up job

Signed in as Owner/Manager, call `POST /api/jobs/followups` (e.g. from a scheduler). It sends due day-2/day-5 estimate follow-ups and expires or reminds holds.

SQLite is used locally through `DATABASE_URL=file:./dev.db`. Change the Prisma provider and URL when moving to MySQL.
