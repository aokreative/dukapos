// M-PESA (Safaricom Daraja) STK Push — used to collect subscription payments.
// Configured when MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE
// and MPESA_PASSKEY are set. Otherwise reports "not configured" -> simulation.

export function mpesaConfigured() {
  return !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_PASSKEY
  )
}

const BASE =
  (process.env.MPESA_ENV || 'sandbox') === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'

async function getToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64')
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { authorization: `Basic ${auth}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error('M-PESA auth failed')
  return data.access_token
}

function timestamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export async function stkPush({ phone, amount, accountRef, description, callbackUrl }) {
  if (!mpesaConfigured()) return { configured: false }
  const token = await getToken()
  const ts = timestamp()
  const shortcode = process.env.MPESA_SHORTCODE
  const password = Buffer.from(`${shortcode}${process.env.MPESA_PASSKEY}${ts}`).toString('base64')

  const res = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: process.env.MPESA_TX_TYPE || 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: (accountRef || 'DukaPOS').slice(0, 12),
      TransactionDesc: (description || 'Subscription').slice(0, 20),
    }),
  })
  const data = await res.json()
  if (!res.ok || data.ResponseCode !== '0') {
    throw new Error(data?.errorMessage || data?.ResponseDescription || 'STK push failed')
  }
  return { configured: true, checkoutId: data.CheckoutRequestID, merchantId: data.MerchantRequestID }
}
