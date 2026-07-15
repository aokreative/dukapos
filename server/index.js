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
import { stkPush, mpesaConfigured, shopCredsComplete } from './lib/mpesa.js'
import { airtelPush, airtelStatus, airtelConfigured } from './lib/airtel.js'
import { etimsSubmitSale, etimsConfigured } from './lib/etims.js'
import { askAI, aiConfigured } from './lib/ai.js'
import { gate as aiGate, record as aiRecord, meterSummary, DEFAULT_DAILY_QUOTA } from './lib/aimeter.js'
import { priceFor } from './lib/plans.js'
import {
  initSubscriptions,
  storeKind,
  registerTenant,
  getTenant,
  findByPhone,
  renew,
  applyPayment,
  setAiAddon,
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
      airtel: airtelConfigured() ? 'live' : 'simulation',
      etims: etimsConfigured() ? 'live' : 'simulation',
      ai: aiConfigured() ? `live (${process.env.AI_MODEL || 'gemini-flash-latest'})` : 'local rules',
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
    // No Daraja keys: only pretend-charge when the operator explicitly opted
    // into demo mode. Otherwise skip — never silently mark accounts paid.
    if (process.env.BILLING_SIMULATE === 'true') {
      await renew(t.id, { ref: rand('Q'), method: 'mpesa' })
      console.log(`[billing] (sim) auto-charged ${t.business} KES ${amount}`)
      return { simulated: true, amount }
    }
    console.log(`[billing] skipped auto-charge for ${t.business} — M-PESA not configured`)
    return { simulated: false, skipped: true, amount }
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
      // No Daraja keys on this server. NEVER fake a successful payment unless
      // the operator explicitly opted into demo mode — otherwise anyone could
      // "subscribe" without paying a shilling.
      if (process.env.BILLING_SIMULATE !== 'true') {
        return res.status(503).json({
          error:
            'M-PESA payments are not set up on this server yet — nothing was charged and the account was NOT activated. ' +
            'Owner: add MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET / MPESA_SHORTCODE / MPESA_PASSKEY (your Daraja keys) on the server, ' +
            'or set BILLING_SIMULATE=true for demo environments only.',
        })
      }
      const checkoutId = rand('ws_CO_')
      payments.set(checkoutId, { status: 'pending', tenantId, amount, planId, cycle, phone })
      setTimeout(async () => {
        const p = payments.get(checkoutId)
        if (!p) return
        const ref = rand('Q')
        payments.set(checkoutId, { ...p, status: 'success', ref })
        if (p.tenantId) await renew(p.tenantId, { ref, cycle: p.cycle })
      }, 1500)
      return res.json({ simulated: true, checkoutId, ref: rand('Q'), detail: 'Simulated M-PESA payment confirmed (BILLING_SIMULATE demo mode)' })
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

// --- Airtel Money -----------------------------------------------------------
// Same idea as the STK push: the customer approves on their phone. Works for
// subscription payments (tenantId links the renewal) and simulates without keys.
app.post('/api/airtel/pay', async (req, res) => {
  const { phone, amount, planId, tenantId, cycle } = req.body || {}
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount are required' })
  try {
    const out = await airtelPush({ phone, amount, reference: `Duka ${planId || ''}`.trim() })
    if (!out.configured) {
      // Same rule as M-PESA: no keys → no fake activations unless demo mode.
      if (process.env.BILLING_SIMULATE !== 'true') {
        return res.status(503).json({
          error:
            'Airtel Money payments are not set up on this server yet — nothing was charged and the account was NOT activated. ' +
            'Owner: add the AIRTEL_* keys on the server, or set BILLING_SIMULATE=true for demo environments only.',
        })
      }
      const txId = rand('AIRTEL_')
      payments.set(txId, { status: 'pending', tenantId, amount, planId, cycle, phone, provider: 'airtel' })
      setTimeout(async () => {
        const p = payments.get(txId)
        if (!p) return
        const ref = rand('AM')
        payments.set(txId, { ...p, status: 'success', ref })
        if (p.tenantId) await renew(p.tenantId, { ref, cycle: p.cycle, method: 'airtel' })
      }, 1500)
      return res.json({ simulated: true, checkoutId: txId, ref: rand('AM'), detail: 'Simulated Airtel Money payment confirmed (BILLING_SIMULATE demo mode)' })
    }
    payments.set(out.transactionId, { status: 'pending', tenantId, amount, planId, cycle, phone, provider: 'airtel' })
    return res.json({ simulated: false, checkoutId: out.transactionId, detail: 'Airtel Money prompt sent — confirm on phone' })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
})

// Poll a live Airtel payment; renews the tenant the moment it succeeds.
app.get('/api/airtel/status/:txId', async (req, res) => {
  const p = payments.get(req.params.txId)
  if (!p) return res.status(404).json({ status: 'unknown' })
  if (p.status === 'pending' && airtelConfigured()) {
    try {
      const out = await airtelStatus(req.params.txId)
      if (out.status !== 'pending') {
        payments.set(req.params.txId, { ...p, status: out.status })
        if (out.status === 'success' && p.tenantId) await renew(p.tenantId, { ref: req.params.txId, cycle: p.cycle, method: 'airtel' })
      }
    } catch {
      /* keep pending */
    }
  }
  const now = payments.get(req.params.txId)
  res.json({ status: now.status, ref: now.ref })
})

// --- M-PESA prompt at the till (customer purchase) ---------------------------
// A cashier can prompt the customer's phone for the sale amount instead of
// typing the code manually. Simulates when Daraja isn't configured, so demos
// and the manual-code flow both keep working.
app.post('/api/mpesa/collect', async (req, res) => {
  const { phone, amount, reference, mpesa } = req.body || {}
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount are required' })
  try {
    // Sales STK must go into the SHOP's own till — never the platform till used
    // for subscriptions. So we only attempt live when the shop supplied its own
    // Daraja credentials; otherwise we simulate (the customer pays the till the
    // normal way, shown on the receipt/reminder).
    const out = shopCredsComplete(mpesa)
      ? await stkPush({
          phone,
          amount,
          accountRef: (reference || 'Sale').slice(0, 12),
          description: 'Duka POS sale',
          callbackUrl: `${PUBLIC_URL}/api/mpesa/collect/callback`,
          creds: mpesa,
        })
      : { configured: false }
    if (!out.configured) {
      const checkoutId = rand('ws_CO_')
      payments.set(checkoutId, { status: 'pending', amount, phone, kind: 'sale' })
      setTimeout(() => {
        const p = payments.get(checkoutId)
        if (p) payments.set(checkoutId, { ...p, status: 'success', ref: rand('Q') })
      }, 2500)
      return res.json({ simulated: true, checkoutId, detail: 'Simulated STK prompt — confirming…' })
    }
    payments.set(out.checkoutId, { status: 'pending', amount, phone, kind: 'sale' })
    return res.json({ simulated: false, checkoutId: out.checkoutId, detail: 'STK prompt sent — customer confirms on phone' })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
})

// The sale STK callback just marks the payment; the till polls /status.
app.post('/api/mpesa/collect/callback', (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback
    if (cb) {
      const p = payments.get(cb.CheckoutRequestID)
      if (p) {
        const ok = cb.ResultCode === 0
        const receipt = (cb.CallbackMetadata?.Item || []).find((i) => i.Name === 'MpesaReceiptNumber')?.Value
        payments.set(cb.CheckoutRequestID, { ...p, status: ok ? 'success' : 'failed', ref: receipt })
      }
    }
  } catch {
    /* ignore */
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
})

app.get('/api/mpesa/collect/status/:checkoutId', (req, res) => {
  const p = payments.get(req.params.checkoutId)
  if (!p) return res.status(404).json({ status: 'unknown' })
  res.json({ status: p.status, ref: p.ref })
})

// --- KRA eTIMS ---------------------------------------------------------------
// The app posts each sale here when the shop enables eTIMS in Settings.
app.post('/api/etims/invoice', async (req, res) => {
  const { sale } = req.body || {}
  if (!sale?.receiptNo) return res.status(400).json({ error: 'sale with receiptNo is required' })
  try {
    const out = await etimsSubmitSale(sale)
    res.json(out)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// --- Duka AI (Gemini) — gated by the AI add-on, metered & rate-limited --------
app.post('/api/ai/ask', async (req, res) => {
  const { question, context, history, tenantId, persona } = req.body || {}
  if (!question) return res.status(400).json({ error: 'question is required' })
  try {
    if (!aiConfigured()) return res.json({ simulated: true, detail: 'AI not configured — the app answers locally' })

    // The full (Gemini-powered) assistant is a paid add-on toggled per client
    // in the Super-Admin portal. Without it, the app falls back to local answers.
    const t = tenantId ? await getTenant(tenantId) : null
    if (t && !t.aiEnabled) {
      return res.json({ locked: true, reason: 'addon', detail: 'Full AI is not enabled for this shop. Ask the owner to add Duka AI to the subscription.' })
    }

    const meterId = tenantId || 'anon'
    // 5-minute dedupe + daily quota guardrail (default 50/day per shop).
    const g = aiGate(meterId, question, DEFAULT_DAILY_QUOTA)
    if (g.cached) return res.json({ simulated: false, answer: g.cached, cached: true, meter: meterSummary(meterId) })
    if (!g.allow) {
      return res.json({
        locked: true,
        reason: 'quota',
        detail: 'Daily AI limit reached. Upgrade your subscription to unlock unlimited insights.',
        meter: meterSummary(meterId),
      })
    }

    const out = await askAI({ question, context, history, persona })
    if (!out.configured) return res.json({ simulated: true, detail: 'AI not configured — the app answers locally' })
    aiRecord(meterId, question, out.answer)
    res.json({ simulated: false, answer: out.answer, meter: meterSummary(meterId) })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
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
// A shop pays YOU via the platform till. The amount is applied to their cycle:
// full payment unlocks/renews; a SHORT payment leaves them owing the balance
// (and still held if overdue) until it's cleared.
app.post('/api/mpesa/c2b/confirmation', async (req, res) => {
  try {
    const b = req.body || {}
    const phone = b.MSISDN || b.phone
    const amount = Number(b.TransAmount || b.amount || 0)
    const t = (b.BillRefNumber && (await getTenant(b.BillRefNumber))) || (phone && (await findByPhone(phone)))
    if (t) {
      const out = await applyPayment(t.id, { amount, ref: b.TransID || b.ref, method: 'mpesa' })
      if (out?.renewed) console.log(`[billing] C2B ${amount} matched -> renewed ${t.business}`)
      else console.log(`[billing] C2B short payment for ${t.business}: paid ${out?.paid}, still owes ${out?.balanceDue}`)
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

// Admin: toggle the AI add-on for a client and set its (adjustable) price.
app.post('/api/admin/tenants/:id/ai', requireAdmin, async (req, res) => {
  const t = await setAiAddon(req.params.id, {
    enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
    price: typeof req.body?.price === 'number' ? req.body.price : undefined,
  })
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json(publicView(t))
})

// Admin: record a payment against a client's cycle (manual, or reconciling a
// till payment). Full amount unlocks; short amount leaves the balance owing.
app.post('/api/admin/tenants/:id/record-payment', requireAdmin, async (req, res) => {
  const amount = Number(req.body?.amount || 0)
  if (amount <= 0) return res.status(400).json({ error: 'amount must be > 0' })
  const out = await applyPayment(req.params.id, { amount, ref: req.body?.ref, method: req.body?.method || 'manual' })
  if (!out) return res.status(404).json({ error: 'not found' })
  res.json({ ...out, tenant: publicView(out.tenant) })
})

// Admin: AI usage for a client (today's count vs quota).
app.get('/api/admin/tenants/:id/ai-usage', requireAdmin, (req, res) => {
  res.json(meterSummary(req.params.id, DEFAULT_DAILY_QUOTA))
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
