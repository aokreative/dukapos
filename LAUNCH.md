# Duka POS — Launch, Demo & Hosting Guide

**For the owner (non-technical).** This is the "what do I actually do now"
document. Follow it top to bottom and you're live.

---

## The 3 pieces of your product

| Piece | What it is | Where it lives |
|---|---|---|
| **The POS app** | What your clients use every day | Vercel (free) |
| **The backend** | Auto-billing, WhatsApp/SMS sending, M-PESA, Airtel, eTIMS, Duka AI | Render (~$7/mo) |
| **The website** | Your marketing page that sells the POS | Vercel (free) |

Plus your **Super-Admin portal** (see every shop, charge, suspend) at
`https://YOUR-BACKEND.onrender.com/admin`, and **cloud sync** on Supabase
(free — see `CLOUD-SYNC.md`).

**Recommended hosting: Vercel + Render + Supabase.** This combo is the
best fit for Duka: Vercel is the best free host for the app and website
(instant, global, free SSL), Render runs the backend 24/7 for the
auto-billing scheduler, and Supabase gives you the database + login system
free. Don't pay for anything else until you have ~50 shops.

---

## Part 1 — Put everything online (one afternoon)

### A. The POS app on Vercel (10 min)
1. Go to **https://vercel.com** → sign up with your GitHub account.
2. **Add New → Project** → import **brianzeey/duka-pos** → Deploy.
   (All settings are auto-detected — just click Deploy.)
3. You get `https://duka-pos-xxxx.vercel.app`. In **Settings → Domains** you
   can rename it to `duka-pos.vercel.app` if free, or attach a domain you buy
   (e.g. `dukapos.co.ke`, ~KES 1,000/yr).

### B. The backend on Render (15 min)
1. Go to **https://render.com** → sign up with GitHub.
2. **New → Web Service** → choose **duka-pos** → set **Root Directory** to
   `server` → the included `render.yaml` fills in the rest → Create.
3. In **Environment**, add at minimum:
   - `ADMIN_TOKEN` = a long secret password (this is your master key)
   - `DATABASE_URL` = your Supabase connection string (Supabase dashboard →
     Project Settings → Database → Connection string → URI)
4. Copy your backend URL, e.g. `https://duka-pos-api.onrender.com`.
5. Back on Vercel: **Settings → Environment Variables** →
   `VITE_API_URL` = that URL → Redeploy.

### C. Cloud sync on Supabase (10 min)
Follow `CLOUD-SYNC.md` (run one script, paste two values into Vercel).

### D. The marketing website on Vercel (5 min)
1. Vercel → **Add New → Project** → import **duka-pos** again.
2. This time set **Root Directory** to `website` and Framework to **Other**.
3. Deploy → you get your sales page, e.g. `https://dukapos.vercel.app`.
4. Point its "Open the live demo" button at your app URL (it's one link in
   `website/index.html` — ask any developer, or me, to change it in seconds).

### E. Go live with money (whenever ready)
Follow `INTEGRATIONS.md` to switch M-PESA, Airtel, eTIMS and Duka AI from
simulation to live — each is just pasting credentials into Render.

---

## Part 2 — How to demo Duka POS (your sales weapon)

**The fastest demo: your own phone.** The app ships with demo data — a
stocked duka, sales history, and debtors — so the demo is impressive with
zero preparation.

The 5-minute script that sells:

1. **Open the app on your phone** (or the client's!) — go to your Vercel URL,
   "Add to Home Screen". *"It's an app, no installation, works on the phone
   you already have."*
2. **Make a sale in 5 seconds.** Tap two products → Take payment → Exact
   cash. *"Your cashier learns this in one minute."*
3. **The killer feature — mkopo.** Sell on Credit → pick a customer → open
   **Debts**. Show the balance, then tap **Remind → WhatsApp**. Their jaw
   drops when the message appears with the till number already inside.
   *"This app collects your debts for you."*
4. **Show Duka AI.** Ask "Who owes me money?" then "What should I restock?"
   *"It's like having an accountant inside the till."*
5. **Show Reports** (today's money, best sellers) and **Settings → Staff**
   (cashier PINs can't see your profit).
6. **Turn on airplane mode and sell again.** *"No bundles? No problem."*
7. Close: *"14 days free, from KES 1,900 a month, cancel anytime. Tuanze?"*

Demo hygiene: after each demo, Settings → **Reset demo data** so the next
demo starts clean. For remote demos, just send the app link on WhatsApp —
it works instantly on their phone with the same demo data.

---

## Part 3 — Launch checklist

**Before your first paying client:**
- [ ] App + backend + website deployed (Part 1 A, B, D)
- [ ] `ADMIN_TOKEN` set; open `/admin` and confirm you can see shops
- [ ] Cloud sync set up (Part 1 C)
- [ ] Your WhatsApp number is on the website's contact button
- [ ] Print `docs/Duka-POS-Owner-Guide.pdf` for yourself — it's your manual

**Onboarding each new shop (15 minutes, in person or on a call):**
1. Open your app URL on their device → Add to Home Screen.
2. Settings → their shop name, phone, and **their M-PESA till/Paybill**
   (this is what goes into their debt reminders).
3. Settings → Staff → set the owner PIN, add cashiers.
4. Add their top 20 products together; teach them to add the rest.
5. Billing → pick the right plan for their size. Their 14-day trial starts.
6. (Optional) Settings → Cloud sync → create their account for multi-device.
7. Show them one credit sale + one WhatsApp reminder. That's the hook.

**Getting paid every month (this is automated):**
- Trial ends → the app reminds them → they tap Pay → M-PESA STK on their
  phone → done. If they set auto-pay, the server charges them automatically.
- Don't pay → grace (7 days, warnings) → the POS **holds** (day 8–14) →
  suspended (day 15+). They call you fast — the POS matters to them by then.
- You watch everything (and can charge/extend anyone) from `/admin`.

**Suggested launch sequence:**
1. Week 1: onboard your 2–3 friendliest waiting clients personally. Sit in
   their shop for an hour. Fix friction. Get testimonials.
2. Week 2: onboard the rest of the waiting list; ask each happy client to
   name one other shop owner ("mtaje mmoja" — referrals are everything).
3. Then: print simple flyers with the website + your WhatsApp, walk the
   business streets, demo on the spot from your phone. Every demo ends with
   installing it on THEIR phone with the trial running — the app sells itself
   for 14 days.

---

## Costs summary

| Item | Cost |
|---|---|
| Vercel (app + website) | Free |
| Render backend | ~$7/month (~KES 900) |
| Supabase (database + sync + login) | Free tier |
| SMS via Africa's Talking | ~KES 0.8/SMS, only if you enable SMS |
| WhatsApp Cloud API | Free tier ~1,000 conversations/month |
| Claude API for Duka AI | A few dollars/month, optional |
| Domain (optional) | ~KES 1,000/year |

One Standard-plan client (KES 4,900/mo) covers your entire monthly bill
several times over.
