# Getting Duka POS live — a simple, step-by-step guide

This guide is written for a **non-technical** owner. No coding. If you can fill in an online
form, you can do this. Take it in two parts:

- **Part 1 — Get selling (about 10 minutes).** Puts the app on the internet, free. After this you
  and your staff can open it on any phone or computer, sell, track debts, and send **one-tap
  WhatsApp/SMS reminders**. This is enough to run your shop.
- **Part 2 — Turn on the "automatic" powers (optional, do it later).** Automatic reminder sending
  and collecting **real M-PESA** subscription payments. This needs a few business accounts that
  take time to approve, so it's fine to come back to it.

> **Good to know:** until you do Part 2, the app runs in a safe **demo/simulation** mode for the
> automatic features — everything is visible and testable, nothing real is sent or charged.

---

## Part 1 — Put your shop online (free, ~10 min)

You'll use **Vercel**, a free service that turns the code into a live website.

### Step 1 — Create a free Vercel account
1. Go to **https://vercel.com**.
2. Click **Sign Up** → **Continue with GitHub** (your code already lives on GitHub).
3. Approve when GitHub asks — this just lets Vercel see your project.

### Step 2 — Import the Duka POS project
1. On the Vercel dashboard, click **Add New… → Project**.
2. Find **`duka-pos`** in the list and click **Import**.
3. Vercel automatically detects it's a Vite app. **You don't need to change anything.**
   - (For reference, it fills in: Build Command `npm run build`, Output Directory `dist`.)
4. Click **Deploy**.
5. Wait ~1–2 minutes. When you see **"Congratulations"**, it's live. 🎉

### Step 3 — Open your shop
- Vercel gives you a web address like **`https://duka-pos-xxxx.vercel.app`**. Click **Visit**.
- That link is your POS. Bookmark it. Share it with your staff.

### Step 4 — Install it like a real app (on your phone)
1. Open your Vercel link in **Chrome** (Android) or **Safari** (iPhone).
2. **Android:** tap the **⋮** menu → **Install app / Add to Home screen**.
   **iPhone:** tap **Share** → **Add to Home Screen**.
3. Now "Duka" sits on your home screen with its own icon and opens full-screen. It even works
   **offline** — you can keep selling if the internet drops.

### Step 5 — Set up your shop (5 minutes inside the app)
1. Go to **Settings**:
   - Change the shop **name**, phone, and location.
   - Under **"How customers pay you"**, enter your **M-PESA Till or Paybill** — this is what gets
     printed on receipts and included in every debt reminder.
2. Go to **Stock** → add your products (or edit the demo ones).
3. Go to **Settings → Data → "Clear everything"** when you're ready to remove the demo data and
   start fresh with your real shop.

**You're operational.** Sell from the **Sell** screen, record credit under a customer, and chase
debts from the **Debts** screen — the **Remind** button opens WhatsApp or SMS with the message and
your payment details already filled in.

---

## Part 2 — Turn on automatic sending & real M-PESA billing (optional, later)

Two things become "real" here: (a) reminders that send **automatically** without tapping, and
(b) collecting **real M-PESA** for the subscription. Both run on a small helper service (the
"backend"). Set it up when you're ready.

### Step A — Put the backend online (free, ~10 min) with Render
1. Go to **https://render.com** → **Sign up** → **Continue with GitHub**.
2. Click **New + → Blueprint**.
3. Choose the **`duka-pos`** repo. Render reads the included `render.yaml` and sets everything up.
4. Click **Apply / Create**. After a minute you'll get a backend address like
   **`https://duka-pos-backend.onrender.com`**. Copy it.

### Step B — Connect the app to the backend
1. Back in **Vercel** → your project → **Settings → Environment Variables**.
2. Add one variable:
   - **Name:** `VITE_API_URL`
   - **Value:** your Render address, e.g. `https://duka-pos-backend.onrender.com`
3. Go to the **Deployments** tab → click **Redeploy** on the latest one.
   - Now the app talks to your backend instead of simulating.

### Step C — Get the provider keys (this is the part that takes time)
You apply for these once. Add each one in **Render → your service → Environment**:

| To enable… | You need | Where to get it |
|---|---|---|
| **Automatic WhatsApp** | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Meta WhatsApp Cloud API (business.facebook.com) |
| **Automatic SMS** | `AT_API_KEY`, `AT_USERNAME` (+ optional `AT_SENDER_ID`) | Africa's Talking (africastalking.com) |
| **Real M-PESA subscription payments** | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY` | Safaricom Daraja (developer.safaricom.co.ke) |

- You only need the ones you want. E.g. add just the SMS keys to auto-send by SMS.
- Leaving a set blank keeps that feature in safe simulation — nothing breaks.
- Full variable list and notes: **`server/.env.example`** and **`server/README.md`**.

After adding keys, Render restarts automatically. Check it's healthy by visiting
`https://YOUR-backend.onrender.com/api/health` — it shows which providers are **live** vs **simulation**.

---

## Optional niceties

- **Your own web address** (e.g. `pos.yourshop.co.ke`): in Vercel → **Settings → Domains**, add
  your domain and follow the one-line instruction Vercel gives your domain provider.
- **Free tier note:** Render's free backend "sleeps" when idle and takes ~30s to wake on the first
  request. That's fine for reminders/billing. If you want it always-on, upgrade Render later
  (a few dollars a month).

## What it costs

| Piece | Cost |
|---|---|
| The POS app (Vercel) | **Free** |
| Backend (Render free tier) | **Free** (optional) |
| SMS (Africa's Talking) | pay per SMS you send (~KES 0.8 each) |
| WhatsApp (Meta) | free/low per conversation |
| M-PESA (Daraja) | free to integrate; Safaricom's normal till/paybill rates apply |

## If something looks wrong
- **A page shows "404" when refreshed:** already handled by the included `vercel.json` — make sure
  you deployed the whole project, not a single file.
- **Automatic features say "Simulation":** that's expected until Part 2 is done and keys are added.
- **Need to start over with clean data:** Settings → Data → Clear everything.
