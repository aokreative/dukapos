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

## Why the reminders need no server

The app doesn't send messages from a backend. When you tap **WhatsApp** or **SMS**, it opens a
pre-filled message in your phone's own WhatsApp / messaging app using `wa.me` and `sms:` links —
so it works offline, costs nothing to run, and needs no API keys. For automated bulk sending you
can later plug in the WhatsApp Business API or Africa's Talking (see *Roadmap*).

---

## Tech

- **React + TypeScript + Vite + Tailwind CSS**
- **Zustand** state, persisted to **IndexedDB** (offline-first, survives reloads)
- **PWA** via `vite-plugin-pwa` — installable, offline service worker
- No backend required for the MVP

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # preview the production build
```

The app opens with demo data (products, customers and a few open debts) so you can try the flow
immediately. Clear it any time from **Settings → Data**.

### Install as an app
Open the site in Chrome/Safari on a phone or desktop and choose **Add to Home Screen /
Install**. It then launches full-screen and works offline.

---

## Project structure

```
src/
  pages/        POS, Debts, Customers, Products, Reports, Settings
  components/   Layout, PaymentModal, Receipt, CustomerPicker, ui
  store/        Zustand store (IndexedDB persistence) + selectors
  lib/          reminders (WhatsApp/SMS + payment method), format (KES/phone), seed, id
  types.ts      domain model
scripts/
  generate-icons.mjs   generates the brand PWA icons
```

---

## Roadmap (from the master prompt, not yet in this MVP)

Multi-shop + warehouse, full M-PESA STK Push (Daraja API), KRA eTIMS, staff roles & attendance,
loyalty, supplier POs & GRNs, automated bulk reminders via WhatsApp Business API / Africa's
Talking, and the SaaS super-admin/billing layer. The current build focuses on the core a single
shop uses every day — **fast sales and getting paid back.**
