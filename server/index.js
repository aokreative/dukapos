// ---------------------------------------------------------------------------
// Duka POS platform backend.
//
// Two jobs:
//   1. Relay automated debt reminders to WhatsApp / SMS providers.
//   2. Collect M-PESA subscription payments (STK push) + receive callbacks.
//
// It runs happily with NO credentials — every provider falls back to a
// simulated response — so you can develop the whole product end-to-end and
// only wire real keys when you go live. See .env.example.
// ---------------------------------------------------------------------------
import express from 'express'
import cors from 'cors'
import { sendWhatsApp, whatsappConfigured } from './lib/whatsapp.js'
import { sendSMS, smsConfigured } from './lib/sms.js'
import { stkPush, mpesaConfigured } from './lib/mpesa.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '256kb' }))

const PORT = process.env.PORT || 8787
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`

// In-memory payment tracking (swap for a DB in production).
const payments = new Map() // checkoutId -> { status, ref, amount, planId, phone }

const rand = (p) => p + Math.random().toString(36).slice(2, 8).toUpperCase()

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providers: {
      whatsapp: whatsappConfigured() ? 'live' : 'simulation',
      sms: smsConfigured() ? 'live' : 'simulation',
      mpesa: mpesaConfigured() ? 'live' : 'simulation',
    },
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

// --- Subscription payment (M-PESA STK push) --------------------------------
app.post('/api/subscription/pay', async (req, res) => {
  const { phone, amount, planId } = req.body || {}
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
      // Simulate: create a checkout that "succeeds" after a moment.
      const checkoutId = rand('ws_CO_')
      payments.set(checkoutId, { status: 'pending', amount, planId, phone })
      setTimeout(() => {
        const p = payments.get(checkoutId)
        if (p) payments.set(checkoutId, { ...p, status: 'success', ref: rand('Q') })
      }, 1500)
      return res.json({ simulated: true, checkoutId, ref: rand('Q'), detail: 'Simulated STK push confirmed' })
    }
    payments.set(out.checkoutId, { status: 'pending', amount, planId, phone })
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

// --- Daraja callback -------------------------------------------------------
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
      }
    }
  } catch {
    /* ignore malformed callbacks */
  }
  // Daraja expects a 200 acknowledgement.
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
})

app.listen(PORT, () => {
  console.log(`Duka POS backend on ${PUBLIC_URL}`)
  console.log(
    `Providers — WhatsApp: ${whatsappConfigured() ? 'live' : 'sim'}, SMS: ${smsConfigured() ? 'live' : 'sim'}, M-PESA: ${mpesaConfigured() ? 'live' : 'sim'}`,
  )
})
