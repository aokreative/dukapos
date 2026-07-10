// Airtel Money (Airtel Africa Open API) — collection via USSD push.
// The customer gets a prompt on their phone to approve the payment, exactly
// like an M-PESA STK push. Falls back to simulation with no credentials.
//
// Setup (see INTEGRATIONS.md for the non-technical walkthrough):
//   1. Create an account at https://developers.airtel.africa
//   2. Create an app with the "Collection" product enabled
//   3. Set AIRTEL_CLIENT_ID + AIRTEL_CLIENT_SECRET (+ AIRTEL_ENV=production to go live)

const ENV = process.env.AIRTEL_ENV || 'staging'
const BASE = ENV === 'production' ? 'https://openapi.airtel.africa' : 'https://openapiuat.airtel.africa'
const CLIENT_ID = process.env.AIRTEL_CLIENT_ID || ''
const CLIENT_SECRET = process.env.AIRTEL_CLIENT_SECRET || ''
const COUNTRY = process.env.AIRTEL_COUNTRY || 'KE'
const CURRENCY = process.env.AIRTEL_CURRENCY || 'KES'

export function airtelConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET)
}

let cachedToken = null
let tokenExpiry = 0

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken
  const res = await fetch(`${BASE}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Airtel auth failed: HTTP ${res.status}`)
  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (Number(data.expires_in) || 300) * 1000
  return cachedToken
}

/**
 * Ask the customer's phone to approve a payment (USSD push).
 * phone: 2547XXXXXXXX / 2541XXXXXXXX (we strip the country code for Airtel).
 * Returns { configured, transactionId } — when not configured, the caller
 * should simulate.
 */
export async function airtelPush({ phone, amount, reference }) {
  if (!airtelConfigured()) return { configured: false }
  const token = await getToken()
  const msisdn = String(phone).replace(/^\+?254/, '') // Airtel wants the local part
  const txId = 'DUKA' + Date.now().toString(36).toUpperCase()
  const res = await fetch(`${BASE}/merchant/v1/payments/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'X-Country': COUNTRY,
      'X-Currency': CURRENCY,
    },
    body: JSON.stringify({
      reference: reference || 'Duka POS',
      subscriber: { country: COUNTRY, currency: CURRENCY, msisdn },
      transaction: { amount, country: COUNTRY, currency: CURRENCY, id: txId },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.status?.success === false) {
    throw new Error(data?.status?.message || `Airtel payment failed: HTTP ${res.status}`)
  }
  return { configured: true, transactionId: txId }
}

/** Check whether a pushed payment was approved. */
export async function airtelStatus(transactionId) {
  if (!airtelConfigured()) return { configured: false, status: 'success' }
  const token = await getToken()
  const res = await fetch(`${BASE}/standard/v1/payments/${encodeURIComponent(transactionId)}`, {
    headers: { authorization: `Bearer ${token}`, 'X-Country': COUNTRY, 'X-Currency': CURRENCY },
  })
  const data = await res.json().catch(() => ({}))
  const s = data?.data?.transaction?.status // TS = success, TF = failed, else pending
  return { configured: true, status: s === 'TS' ? 'success' : s === 'TF' ? 'failed' : 'pending' }
}
