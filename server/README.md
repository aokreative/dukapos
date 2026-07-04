# Duka POS — Platform Backend

A small Express service that makes automated sending and subscription billing **real**:

- **`POST /api/reminders/send`** — relays a debt reminder to **WhatsApp Cloud API** or
  **Africa's Talking (SMS)**.
- **Automatic subscription billing** — a shop registry + hourly scheduler that charges shops when
  their subscription is due and renews them on payment. Endpoints: `/api/tenants/register`,
  `/api/tenants/:id`, `/api/tenants/:id/charge`, `/api/subscription/pay`, `/api/subscription/ratiba`,
  `/api/mpesa/callback`, `/api/mpesa/c2b/confirmation`. **Full guide: [../BILLING.md](../BILLING.md).**
- **`GET /api/health`** — shows which providers are live vs simulated.

## Run

```bash
cd server
npm install
cp .env.example .env   # optional — leave blank to run in simulation
npm run dev            # http://localhost:8787
```

With no `.env`, every provider is **simulated** (no external calls, fake refs) so you can
develop the whole flow offline. Fill in credentials to go live.

## Point the app at it

In the web app, set `VITE_API_URL` and rebuild:

```bash
# in the project root
echo "VITE_API_URL=http://localhost:8787" > .env.local
npm run dev
```

The app then sends real reminders and collects real M-PESA. Without `VITE_API_URL`, the app
stays in its own simulation mode.

## 24/7 automation

The in-app engine sends automatically while the shop's app is open. To send reminders around
the clock (even when the device is off), sync the shop's debts to this service and run the
scheduler as a cron/worker that scans due debts and calls the same provider functions. The
provider modules (`lib/whatsapp.js`, `lib/sms.js`, `lib/mpesa.js`) are written to be reused
directly by such a worker.
