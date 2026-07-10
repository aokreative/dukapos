// Duka AI — the shopkeeper's assistant.
// Builds a compact snapshot of the business that travels with every question,
// and answers common questions locally so the assistant works even with no
// backend/AI key (and fully offline).
import type { Customer, Debt, Product, Sale, Supplier, SupplierTxn } from '../types'
import { money } from './format'
import { totalStock } from './stock'

/** Per-customer intelligence: balances both ways, habits, promptness. */
export interface CustomerInsight {
  name: string
  /** Open debt they owe the shop. */
  owedToShop: number
  /** What the shop owes THEM (when they are also a supplier). */
  shopOwesThem: number
  purchases: number
  totalSpent: number
  topItems: { name: string; qty: number }[]
  /** Average days it took them to fully clear past debts (null = none cleared). */
  avgSettleDays: number | null
  /** Days their oldest open debt has been unpaid (null = nothing open). */
  oldestOpenDays: number | null
  payer: 'prompt' | 'ok' | 'slow' | 'overdue' | 'no history'
}

export interface ShopSnapshot {
  business: string
  currency: string
  today: { sales: number; revenue: number; profit: number; byMethod: Record<string, number> }
  week: { sales: number; revenue: number }
  topProducts: { name: string; qty: number; revenue: number }[]
  lowStock: { name: string; stock: number; reorderLevel: number }[]
  debts: { customers: number; totalOwed: number; oldestDays: number; top: { name: string; owed: number }[] }
  customersDetail: CustomerInsight[]
  /** Who buys what: top buyers per product (registered customers only). */
  buyersByProduct: { product: string; buyers: { name: string; qty: number }[] }[]
  suppliersOwed: { name: string; owed: number }[]
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
  suppliers?: Supplier[]
  supplierTxns?: SupplierTxn[]
}): ShopSnapshot {
  const { sales, products, customers, debts, suppliers = [], supplierTxns = [] } = input
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
    .filter((p) => p.active && p.trackStock !== false && totalStock(p) <= p.reorderLevel)
    .sort((a, b) => totalStock(a) - totalStock(b))
    .slice(0, 8)
    .map((p) => ({ name: p.name, stock: totalStock(p), reorderLevel: p.reorderLevel }))

  const open = debts.filter((d) => d.status === 'open' && d.balance > 0)
  const owedByCustomer = new Map<string, number>()
  for (const d of open) owedByCustomer.set(d.customerId, (owedByCustomer.get(d.customerId) || 0) + d.balance)
  const nameOf = new Map(customers.map((c) => [c.id, c.name]))
  const topDebtors = [...owedByCustomer.entries()]
    .map(([id, owed]) => ({ name: nameOf.get(id) || 'Customer', owed }))
    .sort((a, b) => b.owed - a.owed)
    .slice(0, 5)
  const oldest = open.length ? Math.min(...open.map((d) => d.createdAt)) : Date.now()

  // --- Per-customer intelligence -------------------------------------------
  const owedBySupplier = (supplierId: string) =>
    supplierTxns.reduce((a, t) => (t.supplierId === supplierId ? a + (t.type === 'delivery' ? t.amount : -t.amount) : a), 0)
  const supplierByCustomer = new Map<string, number>()
  for (const sup of suppliers) if (sup.customerId) supplierByCustomer.set(sup.customerId, Math.max(0, owedBySupplier(sup.id)))

  const customersDetail: CustomerInsight[] = customers.map((c) => {
    const mySales = sales.filter((s) => s.customerId === c.id)
    const itemQty = new Map<string, number>()
    for (const s of mySales) for (const l of s.lines) itemQty.set(l.name, (itemQty.get(l.name) || 0) + l.qty)
    const topItems = [...itemQty.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3)

    const myDebts = debts.filter((d) => d.customerId === c.id)
    const settled = myDebts.filter((d) => d.status === 'settled' && d.payments.length > 0)
    const settleDays = settled.map((d) => Math.max(0, (Math.max(...d.payments.map((p) => p.at)) - d.createdAt) / DAY))
    const avgSettleDays = settleDays.length ? Math.round(settleDays.reduce((a, b) => a + b, 0) / settleDays.length) : null
    const myOpen = myDebts.filter((d) => d.status === 'open' && d.balance > 0)
    const oldestOpenDays = myOpen.length
      ? Math.floor((Date.now() - Math.min(...myOpen.map((d) => d.createdAt))) / DAY)
      : null

    const payer: CustomerInsight['payer'] =
      oldestOpenDays !== null && oldestOpenDays > 14
        ? 'overdue'
        : avgSettleDays === null
          ? myDebts.length === 0
            ? 'no history'
            : 'ok'
          : avgSettleDays <= 10
            ? 'prompt'
            : avgSettleDays <= 21
              ? 'ok'
              : 'slow'

    return {
      name: c.name,
      owedToShop: Math.round(myOpen.reduce((a, d) => a + d.balance, 0) * 100) / 100,
      shopOwesThem: supplierByCustomer.get(c.id) ?? 0,
      purchases: mySales.length,
      totalSpent: Math.round(mySales.reduce((a, s) => a + s.total, 0)),
      topItems,
      avgSettleDays,
      oldestOpenDays,
      payer,
    }
  })

  // --- Who buys what (registered customers only) ----------------------------
  const buyersMap = new Map<string, Map<string, number>>()
  for (const s of sales) {
    if (!s.customerId) continue
    const cname = nameOf.get(s.customerId)
    if (!cname) continue
    for (const l of s.lines) {
      const m = buyersMap.get(l.name) ?? new Map<string, number>()
      m.set(cname, (m.get(cname) || 0) + l.qty)
      buyersMap.set(l.name, m)
    }
  }
  const buyersByProduct = [...buyersMap.entries()]
    .map(([product, m]) => ({
      product,
      buyers: [...m.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 3),
      total: [...m.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 40)
    .map(({ product, buyers }) => ({ product, buyers }))

  const suppliersOwed = suppliers
    .map((sup) => ({ name: sup.name, owed: Math.max(0, owedBySupplier(sup.id)) }))
    .filter((x) => x.owed > 0)
    .sort((a, b) => b.owed - a.owed)
    .slice(0, 10)

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
    customersDetail,
    buyersByProduct,
    suppliersOwed,
    productCount: products.filter((p) => p.active).length,
    customerCount: customers.length,
  }
}

/** Find a customer mentioned by name inside the question text. */
function findMentioned(q: string, s: ShopSnapshot): CustomerInsight | undefined {
  return s.customersDetail.find((c) => {
    const full = c.name.toLowerCase()
    if (q.includes(full)) return true
    // Any distinctive word of the name (≥4 letters) counts, e.g. "wanjiku".
    return full.split(/\s+/).some((w) => w.length >= 4 && q.includes(w))
  })
}

/** Rule-based answers so Duka AI works offline / with no API key. */
export function localAnswer(question: string, s: ShopSnapshot): string {
  const q = question.toLowerCase()
  const cur = s.currency

  // --- "How much do X and I owe each other?" (two-way balances) ------------
  const mentioned = findMentioned(q, s)
  if (mentioned && /(owe|balance|deni|between)/.test(q)) {
    const lines: string[] = []
    if (mentioned.owedToShop > 0)
      lines.push(
        `• ${mentioned.name} owes YOU ${money(mentioned.owedToShop, cur)}` +
          (mentioned.oldestOpenDays !== null ? ` (oldest debt ${mentioned.oldestOpenDays} days)` : ''),
      )
    else lines.push(`• ${mentioned.name} owes you nothing — all clear ✓`)
    if (mentioned.shopOwesThem > 0) lines.push(`• YOU owe ${mentioned.name} ${money(mentioned.shopOwesThem, cur)} (as your supplier)`)
    else lines.push(`• You owe ${mentioned.name} nothing`)
    const net = mentioned.owedToShop - mentioned.shopOwesThem
    const netLine =
      net > 0
        ? `Net: they owe you ${money(net, cur)}.`
        : net < 0
          ? `Net: you owe them ${money(-net, cur)}.`
          : 'Net: perfectly even.'
    return `Between you and ${mentioned.name}:\n${lines.join('\n')}\n\n${netLine}`
  }

  // --- "Who buys product Y the most?" ---------------------------------------
  if (/(who|which customer|nani)/.test(q) && /(bought|buys|buy|purchase|top buyer)/.test(q)) {
    const hit = s.buyersByProduct.find((b) => {
      const pn = b.product.toLowerCase()
      return q.includes(pn) || pn.split(/\s+/).some((w) => w.length >= 4 && q.includes(w))
    })
    if (hit) {
      if (hit.buyers.length === 0) return `No registered customer has bought ${hit.product} yet.`
      const list = hit.buyers.map((b, i) => `${i + 1}. ${b.name} — ${b.qty} bought`).join('\n')
      return `Top buyers of ${hit.product}:\n${list}\n\nTip: attach customers at checkout and this gets smarter.`
    }
    return (
      'Tell me which product — e.g. "Who buys Sugar 1kg the most?" I track buyers for every item ' +
      '(only sales with a customer attached count).'
    )
  }

  // --- "Who pays their debts promptly?" --------------------------------------
  if (/(prompt|on time|best payer|worst payer|pays? (their )?(debts?|well)|faithful|reliable payer)/.test(q)) {
    const withHistory = s.customersDetail.filter((c) => c.avgSettleDays !== null)
    const overdue = s.customersDetail.filter((c) => c.payer === 'overdue')
    if (withHistory.length === 0 && overdue.length === 0)
      return 'No debt history yet — once customers clear debts I can rank who pays promptly.'
    const ranked = withHistory.sort((a, b) => (a.avgSettleDays ?? 99) - (b.avgSettleDays ?? 99)).slice(0, 5)
    let out = ''
    if (ranked.length) {
      out += 'Fastest payers (average days to clear a debt):\n' + ranked.map((c, i) => `${i + 1}. ${c.name} — ~${c.avgSettleDays} days`).join('\n')
    }
    if (overdue.length) {
      out += `${out ? '\n\n' : ''}⚠️ Currently overdue (14+ days): ` + overdue.map((c) => `${c.name} (${money(c.owedToShop, cur)}, ${c.oldestOpenDays}d)`).join(', ')
    }
    return out
  }

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
  'Who pays their debts promptly?',
  'What should I restock?',
  'What are my best sellers?',
  "What's my profit today?",
]
