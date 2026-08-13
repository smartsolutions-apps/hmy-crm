# HMY-CRM — Perfume House

**Live:** https://hmy-crm-app.web.app
**Firebase console:** https://console.firebase.google.com/project/hmy-crm-app/overview

A complete back-office for a small in-house perfume business: products, formulas,
production, raw materials, customers, orders, suppliers, purchasing, marketing and
accounting — in one app, in English and Arabic, priced in AED.

Built with React + TypeScript + Vite + Tailwind, backed by Firebase (Firestore + Hosting).

---

## Running it

```bash
npm install && npm run dev
```

Opens on http://localhost:5173. With no Firebase configured it runs on the built-in
demo dataset and keeps any edits in your browser only — nothing is lost, nothing is shared.

---

## What is in it

| Module | What it does |
|---|---|
| **Dashboard** | Revenue, gross and net profit, average order, inventory value, production loss, receivables. Alerts for low stock, wasteful batches and unpaid invoices. |
| **Products** | Every finished perfume with SKU, size, concentration, retail and wholesale price. Unit cost is **calculated from the formula**, so margin is always real, never typed in. Full cost breakdown per bottle: juice, packaging, loss allowance. |
| **Raw Materials** | Oils, alcohol, fixatives, bottles, caps, boxes, labels. Stock levels, reorder points, stock value, supplier, and how much of each material has been **over-consumed** in production. |
| **Formulas** | The recipe behind each bottle — quantity per unit for every material, oil concentration, expected loss rate, perfumer's notes, and the resulting material cost. |
| **Production** | The heart of it. Every batch records planned vs produced vs rejected units, and for each material **what the formula said you should use against what the floor actually used**. See below. |
| **Customers** | Full CRM: contact details, type (retail / wholesale / VIP), source, tags, preferred fragrance family, lifetime value, outstanding balance, order history and a logged conversation history. |
| **Orders** | Line-item orders with VAT, shipping, discounts, payment status and balance. Wholesale customers automatically get wholesale pricing. Printable invoice view. |
| **Suppliers & Purchase Orders** | Who supplies what, on what terms, how much you have bought and what you still owe. Imports carry shipping and customs. |
| **Marketing** | Campaigns by channel with budget, spend, impressions, clicks, leads, orders and revenue — giving ROAS, cost per lead and cost per order. Plus a lead pipeline. |
| **Accounting** | P&L (revenue → COGS → gross profit → production losses → opex → net profit), VAT collected, expenses by category, cash flow, receivables and payables. |
| **Reports** | Six cuts of the data — sales, product profitability, production efficiency, customer value, inventory position, marketing return — each exportable. |

Every table sorts, filters, searches and exports to CSV.

---

## How the production loss calculation works

This is the part the business actually turns on, so it is worth being precise.

A **formula** declares how much of each material one finished unit needs. A **batch**
records what really happened. From those two, the app derives:

```
expected qty  = formula quantity per unit  ×  units actually produced
variance      = actual qty issued  −  expected qty
variance cost = variance  ×  material cost per unit
```

- **Material loss** — the sum of the *positive* variances only. That is genuine
  overspend: oil over-poured, bottles broken during crimping. Favourable variances are
  reported separately as savings so a good line cannot quietly hide a bad one.
- **Rejected units loss** — units produced but failed by QC, charged at the batch's own
  full cost per unit.
- **Total loss** = material loss + rejected units loss.
- **Yield %** = units produced ÷ units planned.
- **QC pass %** = good units ÷ units produced.
- **Actual cost per unit** = (materials actually issued + labour + overhead) ÷ good units,
  shown against the **standard cost** from the formula so drift is visible immediately.

The Production page aggregates this into a monthly output-versus-loss chart and a
"where the losses are" ranking, so you can see at a glance that (for example) vanilla
absolute is quietly costing you more than anything else.

---

## The demo data

The app ships with a full, self-consistent year of trading for a fictional Dubai
perfume house. It is not random noise — the numbers reconcile:

- **47 raw materials**, **12 formulas**, **12 products**, **8 suppliers**
- **394 customers**, **957 orders**, ~**680 logged interactions**
- **28 production batches**, **15 purchase orders**, **11 campaigns**, **30 leads**, **~85 expenses**
- Roughly **AED 1.09M revenue**, 55% gross margin, **AED 77k net profit**, 2.5% production loss rate
- Seasonality is built in: a launch ramp, a Ramadan/Eid peak in Feb–Mar, a summer dip
- Two batches deliberately went badly, so the loss reporting has something real to show

The dataset is generated from a fixed seed, so it is identical on every machine.

### Loading it into Firestore

Easiest way — **Settings → Load demo data** in the app.

Or from the terminal:

```bash
npm run seed
```

Add `-- --wipe` to clear the collections first.

---

## Firebase

Already wired up and live:

- **Project:** `hmy-crm-app` (display name HMY-CRM)
- **Firestore:** `me-central1` (Doha — the closest region to the UAE)
- **Hosting:** https://hmy-crm-app.web.app
- **Seeded:** 2,274 documents across the twelve collections

The plain `hmy-crm` project ID and hosting name were both already taken by other
Google Cloud customers — IDs are globally unique — so `hmy-crm-app` was used instead.

Credentials live in `.env` (git-ignored). If you ever need to regenerate them:

```bash
firebase apps:sdkconfig WEB --project hmy-crm-app
```

## Deploying an update

```bash
npm run deploy
```

Builds and pushes both Hosting and the Firestore rules.

---

## A note on security

You asked for no login, so `firestore.rules` currently allows anyone to read and write
the twelve collections. Once this is on a public URL, that means your customer list,
prices, costs and accounts are reachable by anyone who finds the database.

When you want to close it, enable Firebase Authentication and change the rule in
`firestore.rules` from `if collection in [...]` to also require `request.auth != null`.
Nothing else in the app needs to change.

---

## Project layout

```
src/
  types.ts              domain model — every entity in one place
  lib/calc.ts           the whole calculation engine (costing, loss, P&L, ROAS…)
  lib/format.ts         AED / date / number formatting, per language
  lib/firebase.ts       Firebase init; degrades to demo mode when unconfigured
  lib/repo.ts           Firestore read/write + local fallback persistence
  i18n/dictionary.ts    every UI string, English and Arabic
  store/DataContext.tsx loads the database once, saves records back
  data/seed.ts          the demo dataset generator
  components/ui.tsx     table, modal, cards, badges, CSV export
  pages/                one file per module
scripts/seed.mjs        terminal seeder
```
