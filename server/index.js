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
// Runs with NO credentials — every provider falls back to simulation — so the
// whole flow is testable before you wire real keys. See .env.example.
// ---------------------------------------------------------------------------
import express from 'express'
import cors from 'cors'
import { sendWhatsApp, whatsappConfigured } from './lib/whatsapp.js'
import { sendSMS, smsConfigured } from './lib/sms.js'
import { stkPush, mpesaConfigured } from './lib/mpesa.js'
import { priceFor } from './lib/plans.js'
import {
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

// In-memory payment tracking (checkoutId -> { status, ref, tenantId, ... }).
const payments = new Map()

const rand = (p) => p + Math.random().toString(36).slice(2, 8).toUpperCase()

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providers: {
      whatsapp: whatsappConfigured() ? 'live' : 'simulation',
      sms: smsConfigured() ? 'live' : 'simulation',
      mpesa: mpesaConfigured() ? 'live' : 'simulation',
    },
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
// charge and can be the source of truth for the shop's status.
app.post('/api/tenants/register', (req, res) => {
  const { business, phone, planId, cycle, autoRenew } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'phone is required' })
  const t = registerTenant({ business, phone, planId, cycle, autoRenew })
  res.json(publicView(t))
})

// The app polls this to enforce the subscription (hold/suspend) authoritatively.
app.get('/api/tenants/:id', (req, res) => {
  const t = getTenant(req.params.id)
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json(publicView(t))
})

app.get('/api/admin/tenants', (_req, res) => res.json(allTenants()))

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
    renew(t.id, { ref: rand('Q'), method: 'mpesa' }) // simulation: treat as paid
    console.log(`[billing] (sim) auto-charged ${t.business} KES ${amount}`)
    return { simulated: true, amount }
  }
  payments.set(out.checkoutId, { status: 'pending', tenantId: t.id, amount, planId: t.planId, cycle: t.cycle, phone: t.phone })
  console.log(`[billing] STK push sent to ${t.phone} for KES ${amount}`)
  return { simulated: false, checkoutId: out.checkoutId, amount }
}

// Manually trigger a charge for a shop (e.g. owner taps "Pay now", or testing).
app.post('/api/tenants/:id/charge', async (req, res) => {
  const t = getTenant(req.params.id)
  if (!t) return res.status(404).json({ error: 'not found' })
  try {
    const out = await chargeTenant(t)
    res.json({ ok: true, ...out, tenant: publicView(getTenant(t.id)) })
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
      setTimeout(() => {
        const p = payments.get(checkoutId)
        if (!p) return
        const ref = rand('Q')
        payments.set(checkoutId, { ...p, status: 'success', ref })
        if (p.tenantId) renew(p.tenantId, { ref, cycle: p.cycle })
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
// The customer approves once; Safaricom then debits automatically each cycle.
// (Simulated here; wire the Daraja Ratiba endpoint when your shortcode is
// enabled for standing orders.)
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
  // TODO: call Daraja Ratiba "Standing Order" create endpoint here with your
  // shortcode credentials. Returns an order the customer approves once.
  return res.json({ simulated: false, detail: 'Ratiba standing-order create not yet wired — see server/README.md' })
})

// --- Daraja STK callback ---------------------------------------------------
app.post('/api/mpesa/callback', (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback
    if (cb) {
      const p = payments.get(cb.CheckoutRequestID)
      if (p) {
        const ok = cb.ResultCode === 0
        const items = cb.CallbackMetadata?.Item || []
        const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value
        payments.set(cb.CheckoutRequestID, { ...p, status: ok ? 'success' : 'failed', ref: receipt })
        if (ok && p.tenantId) renew(p.tenantId, { ref: receipt, cycle: p.cycle }) // auto-renew the shop
      }
    }
  } catch {
    /* ignore malformed callbacks */
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' }) // Daraja expects 200
})

// --- Daraja C2B confirmation (Paybill/Till auto-detect) --------------------
// If a shop pays your Paybill manually, this renews them automatically by
// matching the paying phone (or the account/BillRef) to a tenant.
app.post('/api/mpesa/c2b/confirmation', (req, res) => {
  try {
    const b = req.body || {}
    const phone = b.MSISDN || b.phone
    const t = (b.BillRefNumber && getTenant(b.BillRefNumber)) || (phone && findByPhone(phone))
    if (t) {
      renew(t.id, { ref: b.TransID || b.ref, method: 'mpesa' })
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

// Test-only: force a billing sweep now.
app.post('/api/admin/run-billing', async (_req, res) => {
  await scheduler.runOnce()
  res.json({ ok: true, tenants: allTenants() })
})

// Test/demo only (blocked when real M-PESA is configured): age a tenant so you
// can watch the auto-charge kick in.
app.post('/api/tenants/:id/simulate-age', (req, res) => {
  if (mpesaConfigured()) return res.status(403).json({ error: 'disabled when M-PESA is live' })
  const t = simulateAge(req.params.id, Number(req.body?.daysOverdue) || 0)
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json(publicView(t))
})

app.listen(PORT, () => {
  console.log(`Duka POS backend on ${PUBLIC_URL}`)
  console.log(
    `Providers — WhatsApp: ${whatsappConfigured() ? 'live' : 'sim'}, SMS: ${smsConfigured() ? 'live' : 'sim'}, M-PESA: ${mpesaConfigured() ? 'live' : 'sim'}`,
  )
  console.log('Billing scheduler: on (auto-charges shops when their subscription is due)')
})
