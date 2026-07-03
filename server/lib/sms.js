// SMS sender — uses Africa's Talking when AT_API_KEY and AT_USERNAME are set.
// Otherwise reports "not configured" so the caller falls back to simulation.

export function smsConfigured() {
  return !!(process.env.AT_API_KEY && process.env.AT_USERNAME)
}

export async function sendSMS({ phone, message }) {
  if (!smsConfigured()) return { configured: false }
  const body = new URLSearchParams({
    username: process.env.AT_USERNAME,
    to: phone.startsWith('+') ? phone : `+${phone}`,
    message,
  })
  if (process.env.AT_SENDER_ID) body.set('from', process.env.AT_SENDER_ID)

  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: process.env.AT_API_KEY,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Africa's Talking ${res.status}`)
  const recipient = data?.SMSMessageData?.Recipients?.[0]
  return { configured: true, ref: recipient?.messageId || 'AT' }
}
