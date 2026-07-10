# Duka POS — Integrations Guide (M-PESA, Airtel Money, KRA eTIMS)

**Written for a non-technical owner.** Every integration below is already built
into Duka POS. Out of the box they run in **simulation mode** — the app behaves
exactly as if they were live, so you can demo and sell today. Going live is
just "get credentials → paste them into your server settings → restart".

Where do the credentials go? On Render (your backend host), open your service →
**Environment** → add the variables named below → **Save** (it restarts
automatically). That's the whole process, for all three.

---

## 1) M-PESA — Daraja (Safaricom)

**What it does in Duka:**
- Customers' M-PESA payments at the till (you type in the M-PESA code).
- Your shops' **subscription payments to YOU** via STK push — the shop owner
  taps "Pay", their phone pops up the M-PESA PIN prompt, done.
- **Auto-billing**: the server automatically sends the STK push when a shop's
  month is up, and Paybill payments are auto-detected and matched to the shop.

**Get credentials (about 30–60 min, one time):**
1. Go to **https://developer.safaricom.co.ke** and create an account.
2. Click **Add App**, tick **Lipa na M-PESA Sandbox**, and note the
   **Consumer Key** and **Consumer Secret**.
3. To go to production: click **Go Live** in the portal. You'll need your
   Paybill or Till number (get one from Safaricom/your bank if you don't have
   one yet — "Lipa na M-PESA Buy Goods" from any Safaricom shop).
4. Safaricom emails you the production keys + **Passkey**.

**Paste into Render → Environment:**
```
MPESA_ENV=production           (or sandbox while testing)
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...            (your Paybill or Till number)
MPESA_PASSKEY=...
MPESA_TX_TYPE=CustomerPayBillOnline    (or CustomerBuyGoodsOnline for a Till)
```

Done. STK pushes are real, the auto-biller charges real money, and Paybill
payments renew shops automatically.

---

## 2) Airtel Money

**What it does in Duka:**
- An **Airtel** button at the till so cashiers can record Airtel Money sales.
- Your Airtel number is included in **debt reminders and receipts** so
  customers know how to pay you back.
- Subscription payments via Airtel Money push (the customer approves on their
  phone, like an STK push).

**Get credentials (about 30 min, one time):**
1. Go to **https://developers.airtel.africa** and sign up (free).
2. Click **My Apps → Create App**, tick the **Collection** product.
3. Copy the **Client ID** and **Client Secret** shown on the app page.
4. Ask Airtel (through the portal) to approve you for production when ready.

**Paste into Render → Environment:**
```
AIRTEL_ENV=production          (or staging while testing)
AIRTEL_CLIENT_ID=...
AIRTEL_CLIENT_SECRET=...
```

**In the app:** Settings → "How customers pay you" → enter your
**Airtel Money number** — it then appears in reminders and on receipts,
even with no backend at all.

---

## 3) KRA eTIMS (electronic tax invoices)

**What it does in Duka:**
- Prints your **KRA PIN** on every receipt (works instantly, no setup).
- With credentials, every sale is also **submitted to KRA automatically** in
  the background — the cashier does nothing extra.

**Turn on the easy part right now (no credentials needed):**
In the app → **Settings → Tax & KRA eTIMS** → switch on eTIMS → type the
shop's KRA PIN. Receipts now carry the PIN.

**Go fully live (one time, per shop):**
1. The shop registers for eTIMS on **https://etims.kra.go.ke** (eCitizen
   login). Choose the **eTIMS Lite / OSCU (online)** option for small shops.
2. KRA approves and issues the technical details: an **API endpoint**, the
   shop's **PIN (TIN)**, a **branch id** (usually `00`) and a **device key**.
   A KRA-listed integrator can do this step for you — it's a standard service.
3. Paste into Render → Environment:
```
ETIMS_ENDPOINT=...             (KRA gives you this URL)
ETIMS_TIN=P0XXXXXXXXX
ETIMS_BHF_ID=00
ETIMS_CMC_KEY=...
```

Until those are set, eTIMS submissions are simulated (and logged), so the
till flow is identical either way.

---

## 4) Duka AI (bonus — the in-app assistant)

**What it does:** every shop gets a **Duka AI** tab — they ask questions in
plain language ("Who owes me money?", "What should I restock?") and get
answers from their own sales, debts and stock.

- **No setup:** it already works — answers are computed on the device.
- **Smarter answers with Claude:** get an API key at
  **https://console.anthropic.com** → API Keys, then add on Render:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Quick status check

Open `https://YOUR-BACKEND.onrender.com/api/health` in a browser. You'll see
each integration listed as `live` or `simulation` — that's how you confirm a
credential was picked up.
