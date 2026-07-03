// ---------------------------------------------------------------------------
// API client for the Duka platform backend.
//
// If VITE_API_URL is set, real requests go to the backend (which relays to
// WhatsApp Cloud API / Africa's Talking / M-PESA Daraja). If it is not set,
// everything runs in SIMULATION mode so the app is fully demoable with no
// server and no credentials.
// ---------------------------------------------------------------------------

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || ''

export const isLive = !!BASE

function fakeRef(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 8).toUpperCase()
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface SendReminderInput {
  channel: 'whatsapp' | 'sms'
  phone: string
  message: string
  business: string
}
export interface SendResult {
  ok: boolean
  status: 'sent' | 'simulated' | 'failed'
  ref?: string
  detail?: string
}

export async function sendReminder(input: SendReminderInput): Promise<SendResult> {
  if (!BASE) {
    await wait(200)
    return { ok: true, status: 'simulated', ref: fakeRef('SIM'), detail: 'Simulated send (no backend configured)' }
  }
  try {
    const res = await fetch(`${BASE}/api/reminders/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, status: 'failed', detail: data?.error || `HTTP ${res.status}` }
    return { ok: true, status: data.simulated ? 'simulated' : 'sent', ref: data.ref, detail: data.detail }
  } catch (e) {
    return { ok: false, status: 'failed', detail: (e as Error).message }
  }
}

export interface PayInput {
  phone: string
  amount: number
  planId: string
  business: string
}
export interface PayResult {
  ok: boolean
  simulated: boolean
  checkoutId?: string
  ref?: string
  detail?: string
}

/** Kick off a subscription payment (M-PESA STK push). */
export async function startSubscriptionPayment(input: PayInput): Promise<PayResult> {
  if (!BASE) {
    await wait(1200) // mimic the customer confirming the STK prompt
    return { ok: true, simulated: true, checkoutId: fakeRef('ws_CO_'), ref: fakeRef('Q'), detail: 'Simulated M-PESA payment confirmed' }
  }
  try {
    const res = await fetch(`${BASE}/api/subscription/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, simulated: false, detail: data?.error || `HTTP ${res.status}` }
    return { ok: true, simulated: !!data.simulated, checkoutId: data.checkoutId, ref: data.ref, detail: data.detail }
  } catch (e) {
    return { ok: false, simulated: false, detail: (e as Error).message }
  }
}

/** Poll a payment's status (used with a real backend + Daraja callback). */
export async function checkPayment(checkoutId: string): Promise<{ status: 'pending' | 'success' | 'failed'; ref?: string }> {
  if (!BASE) return { status: 'success', ref: fakeRef('Q') }
  try {
    const res = await fetch(`${BASE}/api/subscription/status/${encodeURIComponent(checkoutId)}`)
    const data = await res.json()
    return { status: data.status, ref: data.ref }
  } catch {
    return { status: 'pending' }
  }
}
