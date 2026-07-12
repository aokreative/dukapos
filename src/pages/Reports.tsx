import { useMemo } from 'react'
import { TrendingUp, Receipt as ReceiptIcon, Wallet, Boxes, Banknote, Smartphone, CreditCard, HandCoins, Printer, MessageCircle, DoorClosed } from 'lucide-react'
import { useStore, selectTotalOwed } from '../store/useStore'
import { money } from '../lib/format'
import { totalStock } from '../lib/stock'
import { PageHeader } from '../components/ui'
import type { PaymentMethod } from '../types'

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const DAY = 24 * 60 * 60 * 1000

export default function Reports() {
  const sales = useStore((s) => s.sales)
  const products = useStore((s) => s.products)
  const currency = useStore((s) => s.settings.currency)
  const shopName = useStore((s) => s.settings.name)
  const shopPhone = useStore((s) => s.settings.phone)
  const totalOwed = useStore(selectTotalOwed)
  const expenses = useStore((s) => s.expenses)
  const debts = useStore((s) => s.debts)
  const supplierTxns = useStore((s) => s.supplierTxns)
  const shifts = useStore((s) => s.shifts)

  const stats = useMemo(() => {
    const todayStart = startOfDay(Date.now())
    const todaySales = sales.filter((s) => s.createdAt >= todayStart)
    const todayRevenue = todaySales.reduce((a, s) => a + s.total, 0)

    // Payment method split (today), by tender.
    const methodSplit: Record<PaymentMethod, number> = { cash: 0, mpesa: 0, airtel: 0, card: 0, credit: 0, points: 0 }
    for (const s of todaySales) for (const t of s.tenders) methodSplit[t.method] += t.amount

    // Last 7 days revenue.
    const days: { label: string; value: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = startOfDay(Date.now() - i * DAY)
      const dayEnd = dayStart + DAY
      const rev = sales.filter((s) => s.createdAt >= dayStart && s.createdAt < dayEnd).reduce((a, s) => a + s.total, 0)
      days.push({ label: new Date(dayStart).toLocaleDateString('en-KE', { weekday: 'short' }), value: rev })
    }

    // Top products by revenue (all-time).
    const revByProduct = new Map<string, { name: string; revenue: number; qty: number }>()
    for (const s of sales)
      for (const l of s.lines) {
        const cur = revByProduct.get(l.name) ?? { name: l.name, revenue: 0, qty: 0 }
        cur.revenue += l.price * l.qty
        cur.qty += l.qty
        revByProduct.set(l.name, cur)
      }
    const topProducts = [...revByProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    const stockValue = products.reduce((a, p) => a + p.cost * totalStock(p), 0)
    const potentialProfit = products.reduce((a, p) => a + (p.price - p.cost) * totalStock(p), 0)

    // ---- Close of business (today) ----------------------------------------
    const costOf = new Map(products.map((p) => [p.id, p.cost]))
    let cogs = 0
    for (const s of todaySales) for (const l of s.lines) cogs += (costOf.get(l.productId) ?? 0) * l.qty
    const grossProfit = Math.round((todayRevenue - cogs) * 100) / 100
    const marginPct = todayRevenue > 0 ? Math.round((grossProfit / todayRevenue) * 100) : 0
    const expensesToday = expenses.filter((e) => e.at >= todayStart).reduce((a, e) => a + e.amount, 0)
    const netProfit = Math.round((grossProfit - expensesToday) * 100) / 100
    const suppliersPaidToday = supplierTxns
      .filter((t) => t.type === 'payment' && t.at >= todayStart)
      .reduce((a, t) => a + t.amount, 0)
    const debtsCollectedToday = debts.reduce(
      (a, d) => a + d.payments.filter((p) => p.at >= todayStart).reduce((b, p) => b + p.amount, 0),
      0,
    )
    // Most sold + highest-margin products today.
    const perProduct = new Map<string, { name: string; qty: number; profit: number }>()
    for (const s of todaySales)
      for (const l of s.lines) {
        const cur = perProduct.get(l.name) ?? { name: l.name, qty: 0, profit: 0 }
        cur.qty += l.qty
        cur.profit += (l.price - (costOf.get(l.productId) ?? 0)) * l.qty
        perProduct.set(l.name, cur)
      }
    const mostSold = [...perProduct.values()].sort((a, b) => b.qty - a.qty)[0]
    const topMargin = [...perProduct.values()].sort((a, b) => b.profit - a.profit).slice(0, 3)
    const shiftsToday = shifts.filter((sh) => sh.openedAt >= todayStart)

    // Sales by cashier (today). Sales ring-fenced to a colleague count for the
    // colleague; "served by" still names who was physically on the till.
    const byCashier = new Map<string, { name: string; count: number; revenue: number }>()
    for (const s of todaySales) {
      const name = s.assignedToName || s.cashierName
      const cur = byCashier.get(name) ?? { name, count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += s.total
      byCashier.set(name, cur)
    }
    const cashiers = [...byCashier.values()].sort((a, b) => b.revenue - a.revenue)

    return {
      todayRevenue,
      todayCount: todaySales.length,
      methodSplit,
      days,
      topProducts,
      stockValue,
      potentialProfit,
      cashiers,
      dayClose: { cogs, grossProfit, marginPct, expensesToday, netProfit, suppliersPaidToday, debtsCollectedToday, mostSold, topMargin, shiftsToday },
    }
  }, [sales, products, expenses, debts, supplierTxns, shifts])

  const maxDay = Math.max(1, ...stats.days.map((d) => d.value))

  return (
    <div>
      <PageHeader title="Reports" subtitle="Your shop at a glance" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<TrendingUp size={16} />} label="Today's sales" value={money(stats.todayRevenue, currency)} accent />
        <Kpi icon={<ReceiptIcon size={16} />} label="Transactions" value={String(stats.todayCount)} />
        <Kpi icon={<Wallet size={16} />} label="Owed to you" value={money(totalOwed, currency)} danger />
        <Kpi icon={<Boxes size={16} />} label="Stock value" value={money(stats.stockValue, currency)} />
      </div>

      {/* 7-day revenue chart */}
      <div className="card mb-5 p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">Last 7 days</h2>
        <div className="flex h-40 items-end gap-3">
          {stats.days.map((d, i) => {
            const h = d.value > 0 ? Math.max(4, (d.value / maxDay) * 88) : 0
            return (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                {d.value > 0 && (
                  <span className="text-[10px] font-semibold text-brand-900/60 dark:text-white/60">{money(d.value, currency).replace('KES ', '')}</span>
                )}
                <div className="w-full rounded-t bg-brand-600 transition-all dark:bg-brand-500" style={{ height: `${h}%` }} title={money(d.value, currency)} />
              </div>
            )
          })}
        </div>
        <div className="mt-1.5 flex gap-3">
          {stats.days.map((d, i) => (
            <span key={i} className="flex-1 text-center text-[11px] font-medium text-brand-900/50 dark:text-white/50">
              {d.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Payment method split */}
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">Today by payment method</h2>
          <div className="space-y-2">
            {([
              ['mpesa', 'M-PESA', <Smartphone size={16} key="m" />],
              ['airtel', 'Airtel Money', <Smartphone size={16} key="a" />],
              ['cash', 'Cash', <Banknote size={16} key="c" />],
              ['card', 'Card', <CreditCard size={16} key="cc" />],
              ['credit', 'Credit (Mkopo)', <HandCoins size={16} key="cr" />],
            ] as const).map(([key, label, icon]) => {
              const val = stats.methodSplit[key]
              const totalTenders = Object.values(stats.methodSplit).reduce((a, b) => a + b, 0) || 1
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-brand-900/70 dark:text-white/70">{icon} {label}</span>
                    <span className="font-semibold text-brand-900 dark:text-white">{money(val, currency)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                    <div className="h-full rounded-full bg-gold-500" style={{ width: `${(val / totalTenders) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sales by cashier (today) */}
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">Today by cashier</h2>
          {stats.cashiers.length === 0 ? (
            <p className="py-6 text-center text-sm text-brand-900/40 dark:text-white/40">No sales yet today.</p>
          ) : (
            <div className="space-y-2">
              {stats.cashiers.map((c) => {
                const maxRev = stats.cashiers[0]?.revenue || 1
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-brand-900/70 dark:text-white/70">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-gold-400">{c.name.charAt(0).toUpperCase()}</span>
                        {c.name}
                        <span className="text-xs text-brand-900/40 dark:text-white/40">· {c.count} sale{c.count !== 1 ? 's' : ''}</span>
                      </span>
                      <span className="font-semibold text-brand-900 dark:text-white">{money(c.revenue, currency)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p className="mt-3 text-[11px] text-brand-900/40 dark:text-white/40">
            A sale rung up for a colleague counts for the colleague; the receipt still records who served it.
          </p>
        </div>

        {/* Top products */}
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">Top products</h2>
          {stats.topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-brand-900/40 dark:text-white/40">No sales yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-700 dark:text-white">{i + 1}</span>
                  <span className="flex-1 truncate text-sm font-medium text-brand-900 dark:text-white">{p.name}</span>
                  <span className="text-xs text-brand-900/50 dark:text-white/50">{p.qty} sold</span>
                  <span className="w-20 text-right text-sm font-bold text-brand-900 dark:text-white">{money(p.revenue, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Close of business — PnL for today, printable/PDF + WhatsApp summary */}
      <DayCloseCard
        currency={currency}
        shopName={shopName}
        shopPhone={shopPhone}
        revenue={stats.todayRevenue}
        txCount={stats.todayCount}
        d={stats.dayClose}
        cashiers={stats.cashiers}
      />
    </div>
  )
}

function DayCloseCard({
  currency,
  shopName,
  shopPhone,
  revenue,
  txCount,
  d,
  cashiers,
}: {
  currency: string
  shopName: string
  shopPhone: string
  revenue: number
  txCount: number
  d: {
    cogs: number
    grossProfit: number
    marginPct: number
    expensesToday: number
    netProfit: number
    suppliersPaidToday: number
    debtsCollectedToday: number
    mostSold?: { name: string; qty: number }
    topMargin: { name: string; qty: number; profit: number }[]
    shiftsToday: { id: string; staffName: string; closedAt?: number; totalSales?: number; variance?: number }[]
  }
  cashiers: { name: string; count: number; revenue: number }[]
}) {
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const rows: [string, string][] = [
    ['Sales (revenue)', money(revenue, currency) + ` · ${txCount} transactions`],
    ['Cost of goods sold', money(d.cogs, currency)],
    ['Gross profit', `${money(d.grossProfit, currency)} (${d.marginPct}% margin)`],
    ['Expenses', money(d.expensesToday, currency)],
    ['NET PROFIT (today)', money(d.netProfit, currency)],
    ['Debts collected', money(d.debtsCollectedToday, currency)],
    ['Suppliers paid (stock, not expense)', money(d.suppliersPaidToday, currency)],
  ]
  if (d.mostSold) rows.push(['Most sold product', `${d.mostSold.name} (${d.mostSold.qty} sold)`])

  const summaryText =
    `*${shopName} — Close of business*\n${today}\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    (d.topMargin.length ? `\n\nTop margin products:\n${d.topMargin.map((t, i) => `${i + 1}. ${t.name} — ${money(t.profit, currency)} profit`).join('\n')}` : '') +
    (cashiers.length ? `\n\nBy cashier:\n${cashiers.map((c) => `• ${c.name}: ${money(c.revenue, currency)} (${c.count})`).join('\n')}` : '')

  function printReport() {
    const w = window.open('', 'print', 'width=420,height=650')
    if (!w) return
    w.document.write(`
      <html><head><title>Close of business — ${shopName}</title>
      <style>
        *{font-family:system-ui,Arial,sans-serif;color:#0b1f16}
        body{max-width:420px;margin:0 auto;padding:20px}
        h1{font-size:19px;margin:0}.sub{color:#666;font-size:12px;margin-bottom:14px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        td{padding:7px 4px;border-bottom:1px solid #eee}
        td:last-child{text-align:right;font-weight:700}
        .net td{font-weight:900;font-size:15px;border-top:2px solid #166534}
        h2{font-size:13px;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.05em;color:#166534}
        .muted{color:#777;font-size:11px;margin-top:16px}
      </style></head><body>
      <h1>${shopName} — Close of Business</h1>
      <div class="sub">${today}</div>
      <table>
        ${rows.map(([k, v], i) => `<tr${i === 4 ? ' class="net"' : ''}><td>${k}</td><td>${v}</td></tr>`).join('')}
      </table>
      ${d.topMargin.length ? `<h2>Top margin products</h2><table>${d.topMargin.map((t, i) => `<tr><td>${i + 1}. ${t.name} (${t.qty} sold)</td><td>${money(t.profit, currency)}</td></tr>`).join('')}</table>` : ''}
      ${cashiers.length ? `<h2>By cashier</h2><table>${cashiers.map((c) => `<tr><td>${c.name} (${c.count} sales)</td><td>${money(c.revenue, currency)}</td></tr>`).join('')}</table>` : ''}
      ${d.shiftsToday.length ? `<h2>Desks / shifts</h2><table>${d.shiftsToday.map((sh) => `<tr><td>${sh.staffName} — ${sh.closedAt ? 'closed' : 'STILL OPEN'}</td><td>${sh.closedAt ? `${money(sh.totalSales ?? 0, currency)}${sh.variance ? ` · ${sh.variance > 0 ? 'over' : 'short'} ${money(Math.abs(sh.variance), currency)}` : ' · balanced ✓'}` : '—'}</td></tr>`).join('')}</table>` : ''}
      <div class="muted">Generated by Duka POS · Suppliers paid buys stock (already in margins) — it is listed for cash-flow, not deducted again.</div>
      </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <div className="card mt-5 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">
          <DoorClosed size={15} /> Close of business — today
        </h2>
        <div className="flex gap-2">
          <button className="btn-ghost py-1.5 text-sm" onClick={printReport}>
            <Printer size={15} /> Print / Save PDF
          </button>
          <a className="btn-ghost py-1.5 text-sm" href={`https://wa.me/${shopPhone}?text=${encodeURIComponent(summaryText)}`} target="_blank" rel="noreferrer">
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${i === 4 ? 'bg-brand-600 font-bold text-white sm:col-span-2' : 'bg-black/5 dark:bg-white/10'}`}>
            <span className={i === 4 ? '' : 'text-brand-900/70 dark:text-white/70'}>{k}</span>
            <span className={`font-bold ${i === 4 ? '' : 'text-brand-900 dark:text-white'}`}>{v}</span>
          </div>
        ))}
      </div>
      {d.shiftsToday.some((sh) => !sh.closedAt) && (
        <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
          ⚠ Some desks are still open — numbers final once every cashier taps Close desk.
        </p>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, accent, danger }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
        {icon} {label}
      </div>
      <div className={`mt-1 text-2xl font-black ${danger ? 'text-red-600 dark:text-red-400' : accent ? 'text-brand-700 dark:text-gold-400' : 'text-brand-900 dark:text-white'}`}>{value}</div>
    </div>
  )
}
