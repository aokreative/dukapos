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

/** True when a per-shop credential set (from the shop's own Daraja app) is
 *  complete enough to attempt a live STK push into that shop's own till. */
export function shopCredsComplete(c) {
  return !!(c && c.consumerKey && c.consumerSecret && c.shortcode && c.passkey)
}

const apiBase = (env) => (env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke')

async function getToken(base, key, secret) {
  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
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

/**
 * STK Push. Uses PER-SHOP credentials when `creds` is provided (money lands in
 * the shop's own till/Paybill) — otherwise the platform env credentials (used
 * for subscription billing into OUR till). Returns { configured:false } when no
 * usable credentials exist, so the caller can simulate.
 */
export async function stkPush({ phone, amount, accountRef, description, callbackUrl, creds }) {
  let env, key, secret, shortcode, passkey, txType
  if (shopCredsComplete(creds)) {
    env = creds.env === 'production' ? 'production' : 'sandbox'
    key = creds.consumerKey
    secret = creds.consumerSecret
    shortcode = String(creds.shortcode)
    passkey = creds.passkey
    txType = creds.txType || 'CustomerBuyGoodsOnline'
  } else if (mpesaConfigured()) {
    env = process.env.MPESA_ENV || 'sandbox'
    key = process.env.MPESA_CONSUMER_KEY
    secret = process.env.MPESA_CONSUMER_SECRET
    shortcode = process.env.MPESA_SHORTCODE
    passkey = process.env.MPESA_PASSKEY
    txType = process.env.MPESA_TX_TYPE || 'CustomerPayBillOnline'
  } else {
    return { configured: false }
  }

  const base = apiBase(env)
  const token = await getToken(base, key, secret)
  const ts = timestamp()
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64')

  const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: txType,
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: (accountRef || 'DukaPOS').slice(0, 12),
      TransactionDesc: (description || 'Payment').slice(0, 20),
    }),
  })
  const data = await res.json()
  if (!res.ok || data.ResponseCode !== '0') {
    throw new Error(data?.errorMessage || data?.ResponseDescription || 'STK push failed')
  }
  return { configured: true, checkoutId: data.CheckoutRequestID, merchantId: data.MerchantRequestID }
}
