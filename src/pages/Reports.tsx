import { useMemo } from 'react'
import { TrendingUp, Receipt as ReceiptIcon, Wallet, Boxes, Banknote, Smartphone, CreditCard, HandCoins } from 'lucide-react'
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
  const totalOwed = useStore(selectTotalOwed)

  const stats = useMemo(() => {
    const todayStart = startOfDay(Date.now())
    const todaySales = sales.filter((s) => s.createdAt >= todayStart)
    const todayRevenue = todaySales.reduce((a, s) => a + s.total, 0)

    // Payment method split (today), by tender.
    const methodSplit: Record<PaymentMethod, number> = { cash: 0, mpesa: 0, airtel: 0, card: 0, credit: 0 }
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

    return { todayRevenue, todayCount: todaySales.length, methodSplit, days, topProducts, stockValue, potentialProfit, cashiers }
  }, [sales, products])

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
