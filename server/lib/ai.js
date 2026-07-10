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
You help the shopkeeper understand their business: sales, profit, debts (mkopo), stock, and what to do next.
Rules:
- Be brief and practical. Short sentences. No jargon.
- Use the shop snapshot JSON provided with each question; it is the truth about the business. Amounts are KES.
- The snapshot includes customersDetail (what each customer owes the shop, what the shop owes THEM when they are also a supplier, buying habits, payment promptness), buyersByProduct (top buyers per item) and suppliersOwed — use these for questions about specific customers, mutual balances, who buys what, and who pays debts promptly.
- If asked something the snapshot can't answer, say what you'd need instead of guessing numbers.
- A little friendly Kiswahili is welcome (e.g. "Asante", "mkopo") but keep answers in simple English.`

/**
 * Ask Claude a question about the shop.
 * context: object with the shop snapshot (already stripped to essentials).
 */
export async function askAI({ question, context }) {
  if (!aiConfigured()) return { configured: false }
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
      messages: [
        {
          role: 'user',
          content: `Shop snapshot (JSON):\n${JSON.stringify(context || {}, null, 1)}\n\nQuestion: ${question}`,
        },
      ],
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
