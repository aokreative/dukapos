# Duka POS

A **super-simple, offline-first Point of Sale** for Kenyan shops — built to sell fast and to
**track who owes you and remind them via WhatsApp or SMS, with your payment details included in
every reminder.**

It runs as one installable app that works on a phone, tablet or desktop (a PWA), and keeps
working with no internet — every sale, product, customer and debt is stored on the device.

> Business name: **Duka**. Based on the *DUKA POS Master Prompt*, delivered as a focused,
> working MVP that prioritises **speed and simplicity** over the full multi-year SaaS platform.

---

## What it does

### Sell in seconds
- Tap-to-add product grid with search + category filters
- Cart with quantity steppers, discount and a running total
- **Split payments** in one sale: Cash + M-PESA + Card + Credit
- Automatic **change calculation** for cash
- Stock is deducted on every sale
- Printable thermal-style receipt, or send the receipt by **WhatsApp / SMS**

### Track debts (Mkopo) — the headline feature
- Any credit sale is recorded against a customer as a **debt**
- The **Debts & Reminders** screen shows who owes you, sorted by amount, with
  **aging buckets** (0–30 / 31–60 / 61–90 / 90+ days)
- One tap builds a friendly reminder and opens **WhatsApp** or the **SMS** app with the
  message pre-filled
- **The payment method is always included** — the reminder tells the customer exactly how to
  pay you back (your M-PESA Till or Paybill + account, and/or cash at the shop)
- Record full or partial repayments; debts settle automatically when the balance hits zero

Example reminder:

```
Habari Boda Boda Sacco, a friendly reminder from Duka. Your total
outstanding balance is KES 8,600 across 1 sale (R-00003).

Kindly pay via:
M-PESA Buy Goods (Till): 832909
Or pay cash at the shop

Asante sana!
```

### Automated reminders (hands-off)
- Turn on **Automatic reminders** and the app chases debtors for you — no tapping.
- Rules you control: start after N days overdue, repeat every N days, max reminders per debt,
  channel (WhatsApp/SMS), and **quiet hours** so nobody gets messaged at night.
- A **reminder log** shows every automated send. Automated sends go through the backend relay
  (WhatsApp Cloud API / Africa's Talking) — or a built-in **simulation** when no backend is set,
  so you can see exactly how it behaves before wiring real credentials.

### Subscription & billing (the POS is a paid product)
- Duka POS is sold as a **monthly subscription**, tiered by the **size** of the shop:
  **Micro** (KES 500), **Standard** (1,500), **Growth** (4,500), **Chain** (12,000).
- A **"Find your fit"** tool: enter your shops / staff / products / monthly sales and it
  recommends the right plan. Usage bars show how close you are to your plan limits.
- **14-day free trial**, then pay by **M-PESA** (STK push). Auto-renew keeps you active.
- **The POS holds when payment is pending** — matching real SaaS billing:
  - *Grace* (days 1–7 overdue): fully working, daily nudge to pay.
  - *On hold* (days 8–14): you can view everything but **selling is paused**.
  - *Suspended* (day 15+): a full paywall until you pay — your data is preserved.
  - Pay any time (M-PESA) to reactivate instantly. Every payment produces an invoice.
- A demo panel on the Billing screen lets you preview each state (Active / Grace / Hold /
  Suspended) so you can see the hold behaviour immediately.

### Run the shop
- **Customers** — save name + phone, see each customer's outstanding balance
- **Stock** — add/edit products, quick +/- stock, low-stock highlighting and filter
- **Reports** — today's sales, transactions, total owed, stock value, a 7-day revenue chart,
  today's split by payment method, and top products
- **Settings** — shop profile, **how customers pay you** (drives receipts + reminders),
  editable **reminder template** with live preview, VAT toggle, and data reset/clear

### Kenya-first
- Prices in **KES**, Kenyan phone handling (`07…`, `+254…` → normalised for WhatsApp/SMS)
- M-PESA Till / Paybill payment details
- WhatsApp-native communication (Kenyans are WhatsApp-first)
- Works fully **offline**; shows an Online / Offline indicator

---

## Manual vs automated sending

- **Manual (one-tap)** reminders and receipts open a pre-filled message in your phone's own
  WhatsApp / messaging app via `wa.me` and `sms:` links — works offline, no keys, no cost.
- **Automated** reminders and **subscription payments** need the small **backend** in
  [`server/`](./server) — it relays to WhatsApp Cloud API / Africa's Talking and runs M-PESA
  Daraja STK push. Without it, both features run in **simulation** so the whole product is
  demoable with zero setup.

Point the app at the backend by setting `VITE_API_URL` (see `.env.example`), then it sends
real WhatsApp/SMS and collects real M-PESA.

---

## Architecture

```
web app (this repo)        server/  (platform backend)
─────────────────────      ──────────────────────────────
React + Vite PWA           Express
Zustand → IndexedDB        /api/reminders/send   → WhatsApp / SMS
offline-first POS core     /api/subscription/pay → M-PESA STK push
automation engine  ─────▶  /api/mpesa/callback   ← Daraja callback
billing state machine      simulation fallback when no keys
```

The POS core is 100% client-side and offline. Only automated sending and billing talk to the
backend, and both degrade to simulation when it isn't configured.

## Tech

- **React + TypeScript + Vite + Tailwind CSS**
- **Zustand** state, persisted to **IndexedDB** (offline-first, survives reloads)
- **PWA** via `vite-plugin-pwa` — installable, offline service worker
- **Backend:** Node + Express (`server/`), pluggable WhatsApp / SMS / M-PESA providers

## Run it

```bash
# 1) the app (works standalone in simulation)
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # preview the production build

# 2) optional: the backend, to make sending + billing real
cd server && npm install && npm run dev   # http://localhost:8787

# 3) point the app at the backend
echo "VITE_API_URL=http://localhost:8787" > .env.local && npm run dev
```

The app opens with demo data (products, customers and a few open debts) so you can try the flow
immediately. Clear it any time from **Settings → Data**. See [`server/README.md`](./server/README.md)
for provider credentials (WhatsApp / Africa's Talking / M-PESA Daraja).

### Install as an app
Open the site in Chrome/Safari on a phone or desktop and choose **Add to Home Screen /
Install**. It then launches full-screen and works offline.

---

## Project structure

```
src/
  pages/        POS, Debts, Customers, Products, Reports, Subscription, Settings
  components/   Layout, PaymentModal, Receipt, CustomerPicker, Billing, AutomationPanel, ui
  store/        Zustand store (IndexedDB persistence) + selectors
  lib/          reminders, automation + useAutomation (auto-send engine),
                billing (state machine), plans (tiers + size recommender),
                api (backend client w/ simulation), format, seed, id
  types.ts      domain model
server/         Express backend: reminder relay + M-PESA billing (see server/README.md)
scripts/
  generate-icons.mjs   generates the brand PWA icons
```

---

## Roadmap (from the master prompt, not yet in this MVP)

Multi-shop + warehouse, KRA eTIMS, staff roles & attendance, loyalty, supplier POs & GRNs, and
the platform **super-admin** layer (managing all tenant shops). 24/7 server-side reminder
scheduling (sending even when the shop's device is off) needs the shop's debts synced to the
backend — the provider modules are already written to support it. The current build focuses on
what a single shop uses every day — **fast sales, getting paid back, and paying for the POS.**
