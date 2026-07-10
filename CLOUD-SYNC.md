# Duka POS — Cloud Sync (multi-device) Setup

Cloud sync makes Duka a true online POS: a shop signs in once on each device
(email + password) and its products, customers, sales and debts stay in step
on all of them, live. Offline still works — the device keeps selling and syncs
when it's back online.

It runs on **Supabase** (a hosted database with a generous free tier).
Setup is one-time, about 10 minutes, and covers ALL your shops.

## Step 1 — Open your Supabase project

Go to **https://supabase.com/dashboard** and open your project (you already
have one named **duka-pos** — use that one).

## Step 2 — Run the setup script (once)

1. In the left menu click **SQL Editor** → **New query**.
2. Open the file `supabase/schema.sql` from this repository, copy ALL of it,
   paste it into the editor, and click **Run**.
3. You should see "Success. No rows returned". That's it — the database now
   has the `shop_state` table, security rules (each shop can only ever see its
   own data), and live updates enabled.

## Step 3 — Tell the app about your project

1. In Supabase, click **Project Settings** (gear icon) → **API**.
2. Copy two values: the **Project URL** and the **anon public** key.
3. In Vercel (where the app is hosted): your project → **Settings →
   Environment Variables** → add both:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

4. Redeploy the app (Vercel → Deployments → ⋯ → Redeploy).

## Step 4 — Each shop signs in (they do this themselves)

In the app: **Settings → Cloud sync** → the shop creates an account with an
email + password (or signs in on a second device with the same one). The
status turns **Live** — from then on every device signed into that account
shares the same data in real time.

## How conflicts are handled (so you can reassure clients)

- **Sales are never lost.** If two devices sell offline at the same time,
  both sales appear once they're back online.
- Debt payments recorded on any device are kept.
- Receipt numbers never collide backwards.

## Troubleshooting

- **Status says "off"** → the two `VITE_SUPABASE_*` variables aren't set on
  Vercel (or you didn't redeploy after adding them).
- **Sign-up email confirmation annoying?** In Supabase: **Authentication →
  Providers → Email → turn OFF "Confirm email"** — shops can then sign in
  immediately.
- **Status says "error"** → run Step 2 again; the script is safe to re-run.
