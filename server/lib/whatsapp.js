// WhatsApp sender — uses the WhatsApp Cloud API (Meta Graph API) when
// WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are set. Otherwise reports "not
// configured" so the caller falls back to simulation.

export function whatsappConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)
}

export async function sendWhatsApp({ phone, message }) {
  if (!whatsappConfigured()) return { configured: false }
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `WhatsApp API ${res.status}`)
  return { configured: true, ref: data?.messages?.[0]?.id || 'wamid' }
}
