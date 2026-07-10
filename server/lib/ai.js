// Duka AI — the in-POS assistant, powered by Claude.
// The app sends a question plus a compact snapshot of the shop's numbers
// (today's sales, debts, low stock...). We ask Claude and return the answer.
// Without ANTHROPIC_API_KEY the endpoint reports configured:false and the
// app answers locally with its built-in rules — the feature always works.

const API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = process.env.AI_MODEL || 'claude-opus-4-8'

export function aiConfigured() {
  return !!API_KEY
}

const SYSTEM = `You are Duka AI, the assistant inside Duka POS — a point-of-sale app for Kenyan shops.
You help the shopkeeper understand their business and answer ANY question about it: sales, profit, debts (mkopo), stock, customers, suppliers, staff performance, branches, returns — and combinations of these.
Rules:
- Be brief and practical. Short sentences. No jargon.
- Use the shop snapshot JSON provided with each question; it is the truth about the business. Amounts are KES.
- The snapshot is comprehensive: recentSales (who bought what, when, served by which cashier), catalog (all items with prices, costs & stock), customersDetail (what each customer owes the shop, what the shop owes THEM when they are also a supplier, buying habits, payment promptness), buyersByProduct, suppliersOwed, staffNames, locations (branches & warehouse), recentTransfers and recentReturns. Cross-reference freely — comparisons, trends, "who/what/when" questions, and follow-ups are all fair game.
- Do arithmetic carefully. If a precise answer needs data outside the snapshot (e.g. older than the recent lists), say so and give the best available answer.
- A little friendly Kiswahili is welcome (e.g. "Asante", "mkopo") but keep answers in simple English.`

/**
 * Ask Claude a question about the shop.
 * context: the shop snapshot; history: prior chat turns for follow-ups.
 */
export async function askAI({ question, context, history }) {
  if (!aiConfigured()) return { configured: false }
  const messages = []
  for (const h of (history || []).slice(-10)) {
    if (h && h.text) messages.push({ role: h.role === 'ai' ? 'assistant' : 'user', content: String(h.text).slice(0, 2000) })
  }
  messages.push({
    role: 'user',
    content: `Shop snapshot (JSON):\n${JSON.stringify(context || {}, null, 1)}\n\nQuestion: ${question}`,
  })
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM,
      messages,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || `AI request failed: HTTP ${res.status}`)
  }
  const answer = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
  return { configured: true, answer: answer || 'I could not produce an answer — please try rephrasing.' }
}
