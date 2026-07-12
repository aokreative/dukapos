// Duka AI — the in-POS assistant, powered by Google Gemini (gemini-2.5-flash).
// Migrated from Anthropic to the modern Google Gen AI SDK (@google/genai) for
// speed and unit economics. The app sends a question plus a compact snapshot
// of the shop's numbers; we ask Gemini and return the answer. Without a key the
// endpoint reports configured:false and the app answers locally — always works.
//
// The API key is read from the environment (GEMINI_API_KEY or GOOGLE_API_KEY)
// and NEVER hardcoded. Set it on the server (Render → Environment).
import { GoogleGenAI } from '@google/genai'

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
// "gemini-flash-latest" is Google's maintained alias for the current fast/cheap
// Flash model — always available and always current. Override with AI_MODEL.
const MODEL = process.env.AI_MODEL || 'gemini-flash-latest'

let client = null
export function aiConfigured() {
  return !!API_KEY
}
function genai() {
  if (!aiConfigured()) return null
  if (!client) client = new GoogleGenAI({ apiKey: API_KEY })
  return client
}

// Two personas. The AI MANAGER persona (owner/manager) emphasises operational
// visibility — comparing branches, flagging overdue balances, stock turnaround —
// in a digestible, actionable format, not dry accounting jargon. The CASHIER
// persona is strictly limited to stock availability and customer debts.
const SYSTEM_MANAGER = `You are Duka AI, the business manager's assistant inside Duka POS — a point-of-sale app for Kenyan shops.
Speak to the OWNER/MANAGER. Give clear operational visibility, not accounting jargon.
Rules:
- Be brief, practical and action-oriented. Short sentences. Amounts are KES.
- Use the shop snapshot JSON as the single source of truth. It includes recentSales, catalog (prices/cost/stock), customersDetail (balances both ways, buying habits, payment promptness, loyalty points), topCustomers (best shoppers by lifetime spend, with points), buyersByProduct, suppliersOwed, staffNames, locations, recentTransfers, recentReturns, and a day close view.
- For "who are my best/top/most loyal customers", use topCustomers (rank by spent, or by points when the user asks about loyalty/points/rewards).
- CRITICAL — two opposite directions of money, never mix them up:
  • debts / debts.top / customersDetail[].owedToShop = money CUSTOMERS owe the shop ("who owes me").
  • suppliersOwed = money the SHOP owes its SUPPLIERS ("who do I owe", "which suppliers do I owe", payables/creditors).
  When asked "who do I owe" or about suppliers/payables, answer ONLY from suppliersOwed — never list customer debtors.
- Highlight what matters: compare branch performance, flag overdue debtors, call out slow/fast-moving stock, expiring items, and margins. Suggest the next action.
- Do arithmetic carefully. If precise data is outside the snapshot, say so and give the best available answer.
- A little friendly Kiswahili is welcome ("Asante", "mkopo") but answer in simple English.`

const SYSTEM_CASHIER = `You are Duka AI, the cashier's helper inside Duka POS.
You may ONLY discuss stock availability, what is low or expiring, and which customers owe the shop money (mkopo).
You must NEVER reveal profit, margins, revenue totals, other cashiers' sales, or any branch's performance — that is for the owner and manager only. If asked, politely refuse and offer stock or debt help instead.
Be brief and friendly. Amounts are KES. A little Kiswahili is welcome.`

/**
 * Ask Gemini a question about the shop.
 * @param question  the shopkeeper's question
 * @param context   the shop snapshot (already stripped by role on the client;
 *                  a cashier snapshot has `restricted:true` and no profit data)
 * @param history   prior chat turns for follow-ups
 * @param persona   'cashier' locks the model to the limited persona
 */
export async function askAI({ question, context, history, persona }) {
  const ai = genai()
  if (!ai) return { configured: false }

  const restricted = persona === 'cashier' || context?.restricted === true
  const systemInstruction = restricted ? SYSTEM_CASHIER : SYSTEM_MANAGER

  // Build multi-turn contents (Gemini roles: 'user' | 'model').
  const contents = []
  for (const h of (history || []).slice(-10)) {
    if (h && h.text) contents.push({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: String(h.text).slice(0, 2000) }] })
  }
  contents.push({
    role: 'user',
    parts: [{ text: `Shop snapshot (JSON):\n${JSON.stringify(context || {}, null, 1)}\n\nQuestion: ${question}` }],
  })

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction,
      // Generous cap so answers are never cut off mid-sentence. (The old 800
      // truncated longer replies — the "leaves answers halfway" bug.)
      maxOutputTokens: 2048,
      temperature: 0.3,
    },
  })
  let answer = (response.text || '').trim()
  // If the model still hit the ceiling, tidy the tail so it doesn't end abruptly.
  const finish = response.candidates?.[0]?.finishReason
  if (finish === 'MAX_TOKENS' && answer) answer += ' …'
  return { configured: true, answer: answer || 'I could not produce an answer — please try rephrasing.' }
}
