// Duka AI — the shopkeeper's assistant.
// Builds a compact snapshot of the business that travels with every question,
// and answers common questions locally so the assistant works even with no
// backend/AI key (and fully offline).
import type { Customer, Debt, Product, Sale } from '../types'
import { money } from './format'

export interface ShopSnapshot {
  business: string
  currency: string
  today: { sales: number; revenue: number; profit: number; byMethod: Record<string, number> }
  week: { sales: number; revenue: number }
  topProducts: { name: string; qty: number; revenue: number }[]
  lowStock: { name: string; stock: number; reorderLevel: number }[]
  debts: { customers: number; totalOwed: number; oldestDays: number; top: { name: string; owed: number }[] }
  productCount: number
  customerCount: number
}

const DAY = 24 * 60 * 60 * 1000

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function buildShopSnapshot(input: {
  business: string
  currency: string
  sales: Sale[]
  products: Product[]
  customers: Customer[]
  debts: Debt[]
}): ShopSnapshot {
  const { sales, products, customers, debts } = input
  const t0 = startOfToday()
  const costOf = new Map(products.map((p) => [p.id, p.cost]))

  const todaySales = sales.filter((s) => s.createdAt >= t0)
  const weekSales = sales.filter((s) => s.createdAt >= t0 - 6 * DAY)

  const byMethod: Record<string, number> = {}
  let todayProfit = 0
  for (const s of todaySales) {
    for (const t of s.tenders) byMethod[t.method] = (byMethod[t.method] || 0) + t.amount
    for (const l of s.lines) todayProfit += (l.price - (costOf.get(l.productId) ?? 0)) * l.qty
    todayProfit -= s.discount
  }

  const qtyByProduct = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const s of weekSales)
    for (const l of s.lines) {
      const cur = qtyByProduct.get(l.productId) || { name: l.name, qty: 0, revenue: 0 }
      cur.qty += l.qty
      cur.revenue += l.qty * l.price
      qtyByProduct.set(l.productId, cur)
    }
  const topProducts = [...qtyByProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)

  const lowStock = products
    .filter((p) => p.active && p.stock <= p.reorderLevel)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)
    .map((p) => ({ name: p.name, stock: p.stock, reorderLevel: p.reorderLevel }))

  const open = debts.filter((d) => d.status === 'open' && d.balance > 0)
  const owedByCustomer = new Map<string, number>()
  for (const d of open) owedByCustomer.set(d.customerId, (owedByCustomer.get(d.customerId) || 0) + d.balance)
  const nameOf = new Map(customers.map((c) => [c.id, c.name]))
  const topDebtors = [...owedByCustomer.entries()]
    .map(([id, owed]) => ({ name: nameOf.get(id) || 'Customer', owed }))
    .sort((a, b) => b.owed - a.owed)
    .slice(0, 5)
  const oldest = open.length ? Math.min(...open.map((d) => d.createdAt)) : Date.now()

  return {
    business: input.business,
    currency: input.currency,
    today: {
      sales: todaySales.length,
      revenue: todaySales.reduce((a, s) => a + s.total, 0),
      profit: Math.round(todayProfit),
      byMethod,
    },
    week: { sales: weekSales.length, revenue: weekSales.reduce((a, s) => a + s.total, 0) },
    topProducts,
    lowStock,
    debts: {
      customers: owedByCustomer.size,
      totalOwed: open.reduce((a, d) => a + d.balance, 0),
      oldestDays: Math.max(0, Math.floor((Date.now() - oldest) / DAY)),
      top: topDebtors,
    },
    productCount: products.filter((p) => p.active).length,
    customerCount: customers.length,
  }
}

/** Rule-based answers so Duka AI works offline / with no API key. */
export function localAnswer(question: string, s: ShopSnapshot): string {
  const q = question.toLowerCase()
  const cur = s.currency

  if (/(debt|owe|mkopo|deni|credit)/.test(q)) {
    if (s.debts.totalOwed <= 0) return 'Good news — nobody owes you anything right now. 🎉'
    const list = s.debts.top.map((d) => `• ${d.name}: ${money(d.owed, cur)}`).join('\n')
    return (
      `${s.debts.customers} customer${s.debts.customers > 1 ? 's' : ''} owe you ${money(s.debts.totalOwed, cur)} in total. ` +
      `The oldest debt is ${s.debts.oldestDays} day${s.debts.oldestDays === 1 ? '' : 's'} old.\n\nTop debtors:\n${list}\n\n` +
      `Tip: open Debts and tap Remind — the message already includes how to pay you.`
    )
  }

  if (/(low|out of|finish|restock|reorder|stock)/.test(q)) {
    if (s.lowStock.length === 0) return 'Stock looks healthy — nothing is at or below its reorder level.'
    const list = s.lowStock.map((p) => `• ${p.name}: ${p.stock} left (reorder at ${p.reorderLevel})`).join('\n')
    return `${s.lowStock.length} item${s.lowStock.length > 1 ? 's' : ''} need restocking:\n${list}`
  }

  if (/(best|top|selling|moving|popular)/.test(q)) {
    if (s.topProducts.length === 0) return 'No sales in the last 7 days yet — sell something and ask me again!'
    const list = s.topProducts.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} sold (${money(p.revenue, cur)})`).join('\n')
    return `Your best sellers this week:\n${list}`
  }

  if (/(profit|margin|earn)/.test(q)) {
    return (
      `Today's estimated profit is ${money(s.today.profit, cur)} on ${money(s.today.revenue, cur)} in sales ` +
      `(${s.today.sales} sale${s.today.sales === 1 ? '' : 's'}). Profit = selling price minus buying price, less discounts.`
    )
  }

  if (/(today|sale|revenue|how much|made)/.test(q)) {
    const methods = Object.entries(s.today.byMethod)
      .map(([m, v]) => `• ${m === 'mpesa' ? 'M-PESA' : m === 'airtel' ? 'Airtel Money' : m}: ${money(v, cur)}`)
      .join('\n')
    return (
      `Today: ${s.today.sales} sale${s.today.sales === 1 ? '' : 's'} for ${money(s.today.revenue, cur)}` +
      (methods ? `\n\nBy payment method:\n${methods}` : '') +
      `\n\nThis week: ${s.week.sales} sales, ${money(s.week.revenue, cur)}.`
    )
  }

  return (
    `Here's a quick picture of ${s.business}:\n` +
    `• Today: ${s.today.sales} sales — ${money(s.today.revenue, cur)}\n` +
    `• This week: ${s.week.sales} sales — ${money(s.week.revenue, cur)}\n` +
    `• Owed to you: ${money(s.debts.totalOwed, cur)} (${s.debts.customers} customers)\n` +
    `• Low stock items: ${s.lowStock.length}\n\n` +
    `Try asking: "Who owes me money?", "What should I restock?", "What are my best sellers?"`
  )
}

/** Ready-made questions shown as tap chips. */
export const SUGGESTED_QUESTIONS = [
  'How are sales today?',
  'Who owes me money?',
  'What should I restock?',
  'What are my best sellers?',
  "What's my profit today?",
]
