# How you charge shops for using Duka POS (automatically)

You're the platform owner. Every shop using Duka pays you a monthly (or yearly) fee. This
explains — in plain English — how the money reaches you **automatically**, and how the code does
it. The short version: **you never chase anyone. The system charges them and locks the POS if they
don't pay.**

---

## The one thing to understand about M-PESA

Unlike a credit card, a business **cannot silently pull money** from someone's M-PESA whenever it
wants. So "automatic" is achieved in one of these ways (Duka supports all of them):

| Method | How automatic? | What the shop owner does | Best for |
|---|---|---|---|
| **1. Auto STK push on due date** | Semi — you charge, they tap PIN | Enters M-PESA PIN when the prompt pops up on the due date | Everyone; simplest to start |
| **2. Paybill auto-detect (C2B)** | Automatic detection | Pays your Paybill/Till like any bill | Owners who prefer to pay themselves |
| **3. M-PESA Ratiba (standing order)** | **Fully automatic** | Approves **once**; Safaricom then debits every cycle by itself | True hands-off recurring |
| **4. Card auto-billing** (Stripe/Pesapal) | Fully automatic | Enters card once | Shops that use cards |

**The trick that makes them actually pay:** the POS **holds** when payment is late. Grace (still
works) → on hold (can view, can't sell) → suspended (locked). Owners pay to unlock instantly. This
enforcement is already built and is what makes a subscription business work.

> Money always lands in **your** M-PESA (your Daraja shortcode / Paybill / Till). You set those
> credentials once on the backend.

---

## What's already built

The backend (`server/`) is a working **automatic biller**:

- **A shop registry** (`/api/tenants/register`) — each shop is a "tenant" with a plan, cycle and
  a paid-until date. **This is the source of truth** for who's paid, so a shop can't dodge billing
  by clearing its phone.
- **A scheduler** that runs every hour, finds shops whose payment is due, and **charges them
  automatically** (Method 1 — sends the M-PESA STK push; with real keys it hits the owner's phone,
  in demo mode it just simulates and renews).
- **Auto-renew on payment:** when M-PESA confirms (the Daraja callback), the shop's paid-until date
  jumps forward 30 days (or 365 for annual) and an invoice is recorded — no human involved.
- **Paybill auto-detect** (`/api/mpesa/c2b/confirmation`, Method 2): if a shop just pays your
  Paybill, the matching shop is renewed automatically.
- **Ratiba** (`/api/subscription/ratiba`, Method 3): sets up a standing order so Safaricom
  auto-debits each cycle. (Stubbed and simulated — flip on once your shortcode is enabled for
  standing orders.)

### The endpoints

| Endpoint | Does |
|---|---|
| `POST /api/tenants/register` | Add/link a shop (returns its status) |
| `GET  /api/tenants/:id` | A shop's live status — the app reads this to hold/suspend |
| `POST /api/tenants/:id/charge` | Charge one shop now (STK push) |
| `POST /api/subscription/pay` | Owner-initiated payment (STK push) |
| `POST /api/subscription/ratiba` | Set up an automatic standing order |
| `POST /api/mpesa/callback` | Safaricom tells us a payment succeeded → auto-renew |
| `POST /api/mpesa/c2b/confirmation` | Paybill payment detected → auto-renew |
| *(scheduler)* | Hourly: auto-charges every shop that's due |

You can watch the whole loop locally (no keys needed) — see the "Try it" box below.

---

## How to switch it on (once)

1. **Deploy the backend** (Render — see `DEPLOYMENT.md`, Part 2).
2. **Add your M-PESA Daraja keys** on the backend (`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`,
   `MPESA_SHORTCODE`, `MPESA_PASSKEY`). This is the shortcode the money lands in. See
   `server/.env.example`.
3. **Connect the app**: set `VITE_API_URL` to your backend. The app then registers each shop and
   reads its paid/unpaid status from the server.
4. **Pick your charging style:**
   - Easiest: leave the **scheduler on** — shops get an STK push on their due date (Method 1).
   - Most hands-off: offer **Ratiba** at signup so shops approve a standing order once (Method 3).
   - Also enable **Paybill auto-detect** by pointing your Daraja C2B URLs at
     `/api/mpesa/c2b/confirmation` (Method 2).

That's it — from then on, shops are charged and enforced automatically.

---

## Try it now (no keys, no money)

With the backend running (`cd server && npm run dev`):

```bash
# 1) Register a shop → it starts on a 14-day trial
curl -s -X POST localhost:8787/api/tenants/register \
  -H 'content-type: application/json' \
  -d '{"business":"Mama Njeri Shop","phone":"0712345678","planId":"standard"}'
# copy the "id" from the response

# 2) Pretend its payment is 3 days overdue (demo only)
curl -s -X POST localhost:8787/api/tenants/<ID>/simulate-age \
  -H 'content-type: application/json' -d '{"daysOverdue":3}'

# 3) Run the automatic billing sweep
curl -s -X POST localhost:8787/api/admin/run-billing

# 4) Look at the shop again → status "active", a KES 15,000 invoice recorded
curl -s localhost:8787/api/tenants/<ID>
```

You'll see it auto-charged and renewed — exactly what happens on real due dates.

---

## Production notes

- **Storage:** the demo keeps shops in a JSON file. For real use, swap `server/lib/subscriptions.js`
  for a database (Supabase/Postgres) — the function names stay the same.
- **Reliability:** run the backend somewhere always-on (the free Render tier sleeps; a small paid
  tier or a scheduled ping keeps the hourly biller punctual).
- **Recommended Kenyan setup:** **Ratiba** for auto-debit, **STK push** as the fallback for shops
  without a standing order, **Paybill auto-detect** as a safety net, and the **POS hold** to
  enforce it. That combination is fully automatic for most shops and self-enforcing for the rest.
