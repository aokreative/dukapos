// ---------------------------------------------------------------------------
// Duka POS platform backend.
//
// Jobs:
//   1. Relay automated debt reminders to WhatsApp / SMS providers.
//   2. Bill shops for the POS subscription — AUTOMATICALLY:
//        • a scheduler charges shops whose payment is due (M-PESA STK push),
//        • Paybill payments are auto-detected (C2B) and renew the shop,
//        • M-PESA Ratiba standing orders can be set up for true zero-touch,
//        • the app reads each shop's status from here (server = source of truth),
//          so an unpaid shop is held/suspended automatically.
//
// Storage: JSON file by default, or Postgres/Supabase when DATABASE_URL is set.
// Providers fall back to simulation with no credentials. See .env.example.
// ---------------------------------------------------------------------------
import express from 'express'
import cors from 'cors'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendWhatsApp, whatsappConfigured } from './lib/whatsapp.js'
import { sendSMS, smsConfigured } from './lib/sms.js'
import { stkPush, mpesaConfigured } from './lib/mpesa.js'
import { priceFor } from './lib/plans.js'
import {
  initSubscriptions,
  storeKind,
  registerTenant,
  getTenant,
  findByPhone,
  renew,
  publicView,
  allTenants,
  simulateAge,
} from './lib/subscriptions.js'
import { startScheduler } from './lib/scheduler.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '256kb' }))

const PORT = process.env.PORT || 8787
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''

// checkoutId -> { status, ref, tenantId, ... }
const payments = new Map()
const rand = (p) => p + Math.random().toString(36).slice(2, 8).toUpperCase()

// Gate for platform-owner (Super-Admin) endpoints. Requires ADMIN_TOKEN via
// an Authorization: Bearer header or ?token=. If ADMIN_TOKEN isn't set, admin
// endpoints are disabled (secure by default) — set one to use the portal.
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: 'Admin disabled — set ADMIN_TOKEN on the server to enable.' })
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const token = bearer || req.query.token || req.headers['x-admin-token']
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providers: {
      whatsapp: whatsappConfigured() ? 'live' : 'simulation',
      sms: smsConfigured() ? 'live' : 'simulation',
      mpesa: mpesaConfigured() ? 'live' : 'simulation',
    },
    storage: storeKind(),
    billing: 'auto-charge scheduler running',
  })
})

// --- Reminder relay --------------------------------------------------------
app.post('/api/reminders/send', async (req, res) => {
  const { channel, phone, message } = req.body || {}
  if (!phone || !message) return res.status(400).json({ error: 'phone and message are required' })
  try {
    if (channel === 'sms') {
      const out = await sendSMS({ phone, message })
      if (!out.configured) return res.json({ simulated: true, ref: rand('SIM'), detail: 'SMS not configured — simulated' })
      return res.json({ simulated: false, ref: out.ref, detail: 'SMS sent' })
    }
    const out = await sendWhatsApp({ phone, message })
    if (!out.configured) return res.json({ simulated: true, ref: rand('SIM'), detail: 'WhatsApp not configured — simulated' })
    return res.json({ simulated: false, ref: out.ref, detail: 'WhatsApp sent' })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
})

// ===========================================================================
// SUBSCRIPTION BILLING
// ===========================================================================

// Register/link a shop (tenant). The app calls this so the server knows who to
// charge and is the source of truth for the shop's status.
app.post('/api/tenants/register', async (req, res) => {
  const { business, phone, planId, cycle, autoRenew } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'phone is required' })
  try {
    const t = await registerTenant({ business, phone, planId, cycle, autoRenew })
    res.json(publicView(t))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// The app polls this to enforce the subscription (hold/suspend) authoritatively.
app.get('/api/tenants/:id', async (req, res) => {
  const t = await getTenant(req.params.id)
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json(publicView(t))
})

app.get('/api/admin/tenants', requireAdmin, async (_req, res) => res.json(await allTenants()))

/** Charge one shop now — sends an STK push (or simulates + renews). */
async function chargeTenant(t) {
  const amount = priceFor(t.planId, t.cycle)
  const out = await stkPush({
    phone: t.phone,
    amount,
    accountRef: 'DukaPOS',
    description: `Duka ${t.planId} ${t.cycle}`,
    callbackUrl: `${PUBLIC_URL}/api/mpesa/callback`,
  })
  if (!out.configured) {
    await renew(t.id, { ref: rand('Q'), method: 'mpesa' }) // simulation: treat as paid
    console.log(`[billing] (sim) auto-charged ${t.business} KES ${amount}`)
    return { simulated: true, amount }
  }
  payments.set(out.checkoutId, { status: 'pending', tenantId: t.id, amount, planId: t.planId, cycle: t.cycle, phone: t.phone })
  console.log(`[billing] STK push sent to ${t.phone} for KES ${amount}`)
  return { simulated: false, checkoutId: out.checkoutId, amount }
}

// Manually trigger a charge for a shop (Super-Admin action).
app.post('/api/tenants/:id/charge', requireAdmin, async (req, res) => {
  const t = await getTenant(req.params.id)
  if (!t) return res.status(404).json({ error: 'not found' })
  try {
    const out = await chargeTenant(t)
    res.json({ ok: true, ...out, tenant: publicView(await getTenant(t.id)) })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// Owner-initiated one-off payment (STK push). Optional tenantId links renewal.
app.post('/api/subscription/pay', async (req, res) => {
  const { phone, amount, planId, tenantId, cycle } = req.body || {}
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount are required' })
  try {
    const out = await stkPush({
      phone,
      amount,
      accountRef: 'DukaPOS',
      description: `Plan ${planId || ''}`.trim(),
      callbackUrl: `${PUBLIC_URL}/api/mpesa/callback`,
    })
    if (!out.configured) {
      const checkoutId = rand('ws_CO_')
      payments.set(checkoutId, { status: 'pending', tenantId, amount, planId, cycle, phone })
      setTimeout(async () => {
        const p = payments.get(checkoutId)
        if (!p) return
        const ref = rand('Q')
        payments.set(checkoutId, { ...p, status: 'success', ref })
        if (p.tenantId) await renew(p.tenantId, { ref, cycle: p.cycle })
      }, 1500)
      return res.json({ simulated: true, checkoutId, ref: rand('Q'), detail: 'Simulated M-PESA payment confirmed' })
    }
    payments.set(out.checkoutId, { status: 'pending', tenantId, amount, planId, cycle, phone })
    return res.json({ simulated: false, checkoutId: out.checkoutId, detail: 'STK push sent — confirm on phone' })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
})

app.get('/api/subscription/status/:checkoutId', (req, res) => {
  const p = payments.get(req.params.checkoutId)
  if (!p) return res.status(404).json({ status: 'unknown' })
  res.json({ status: p.status, ref: p.ref })
})

// M-PESA Ratiba — set up a STANDING ORDER for true zero-touch monthly billing.
app.post('/api/subscription/ratiba', async (req, res) => {
  const { phone, planId = 'standard', cycle = 'monthly' } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'phone is required' })
  const amount = priceFor(planId, cycle)
  if (!mpesaConfigured()) {
    return res.json({
      simulated: true,
      standingOrderId: rand('RATIBA_'),
      detail: `Simulated standing order: KES ${amount} ${cycle} from ${phone}. In production, Safaricom sends the customer a one-time approval, then auto-debits each cycle.`,
    })
  }
  // TODO: call the Daraja Ratiba "Standing Order" create endpoint here.
  return res.json({ simulated: false, detail: 'Ratiba standing-order create not yet wired — see server/README.md' })
})

// --- Daraja STK callback ---------------------------------------------------
app.post('/api/mpesa/callback', async (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback
    if (cb) {
      const p = payments.get(cb.CheckoutRequestID)
      if (p) {
        const ok = cb.ResultCode === 0
        const items = cb.CallbackMetadata?.Item || []
        const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value
        payments.set(cb.CheckoutRequestID, { ...p, status: ok ? 'success' : 'failed', ref: receipt })
        if (ok && p.tenantId) await renew(p.tenantId, { ref: receipt, cycle: p.cycle })
      }
    }
  } catch {
    /* ignore malformed callbacks */
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' }) // Daraja expects 200
})

// --- Daraja C2B confirmation (Paybill/Till auto-detect) --------------------
app.post('/api/mpesa/c2b/confirmation', async (req, res) => {
  try {
    const b = req.body || {}
    const phone = b.MSISDN || b.phone
    const t = (b.BillRefNumber && (await getTenant(b.BillRefNumber))) || (phone && (await findByPhone(phone)))
    if (t) {
      await renew(t.id, { ref: b.TransID || b.ref, method: 'mpesa' })
      console.log(`[billing] C2B payment matched -> renewed ${t.business}`)
    }
  } catch {
    /* ignore */
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
})

const scheduler = startScheduler({
  chargeTenant,
  intervalMs: Number(process.env.BILLING_INTERVAL_MS) || 60 * 60 * 1000, // hourly
})

app.post('/api/admin/run-billing', requireAdmin, async (_req, res) => {
  await scheduler.runOnce()
  res.json({ ok: true, tenants: await allTenants() })
})

// Super-Admin portal (static page; talks to the protected APIs with your token).
const ADMIN_PORTAL_HTML = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'admin.html'), 'utf8')
app.get('/admin', (_req, res) => {
  res.type('html').send(ADMIN_PORTAL_HTML)
})

// Test/demo only (blocked when real M-PESA is configured): age a tenant so you
// can watch the auto-charge kick in.
app.post('/api/tenants/:id/simulate-age', async (req, res) => {
  if (mpesaConfigured()) return res.status(403).json({ error: 'disabled when M-PESA is live' })
  const t = await simulateAge(req.params.id, Number(req.body?.daysOverdue) || 0)
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json(publicView(t))
})

initSubscriptions()
  .then((kind) => {
    app.listen(PORT, () => {
      console.log(`Duka POS backend on ${PUBLIC_URL}`)
      console.log(
        `Providers — WhatsApp: ${whatsappConfigured() ? 'live' : 'sim'}, SMS: ${smsConfigured() ? 'live' : 'sim'}, M-PESA: ${mpesaConfigured() ? 'live' : 'sim'}`,
      )
      console.log(`Storage: ${kind} · Billing scheduler: on`)
    })
  })
  .catch((e) => {
    console.error('Failed to start:', e)
    process.exit(1)
  })
