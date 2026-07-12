// Sales history — review past sales and reprint a receipt any time, long after
// the sale. Cashiers see only their own sales; owner/manager see everything.
import { useMemo, useState } from 'react'
import { Search, ReceiptText, Printer } from 'lucide-react'
import { PageHeader, EmptyState } from '../components/ui'
import Receipt from '../components/Receipt'
import { useStore, selectRole, selectCurrentStaff } from '../store/useStore'
import { money, shortDateTime } from '../lib/format'
import type { Sale } from '../types'

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', mpesa: 'M-PESA', airtel: 'Airtel', card: 'Card', credit: 'Credit', points: 'Points' }

export default function Sales() {
  const sales = useStore((s) => s.sales)
  const customers = useStore((s) => s.customers)
  const currency = useStore((s) => s.settings.currency)
  const role = useStore(selectRole)
  const me = useStore(selectCurrentStaff)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Sale | null>(null)

  const nameOf = (id?: string) => (id ? customers.find((c) => c.id === id)?.name : undefined)

  // Cashiers only see the sales they made (or that were assigned to them).
  const mine = useMemo(() => {
    if (role === 'cashier' && me) return sales.filter((s) => s.cashierName === me.name || s.assignedToName === me.name)
    return sales
  }, [sales, role, me])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const fromT = from ? new Date(from + 'T00:00:00').getTime() : -Infinity
    const toT = to ? new Date(to + 'T23:59:59').getTime() : Infinity
    return mine.filter((s) => {
      if (s.createdAt < fromT || s.createdAt > toT) return false
      if (!term) return true
      const cust = (nameOf(s.customerId) || '').toLowerCase()
      const items = s.lines.map((l) => l.name).join(' ').toLowerCase()
      const when = shortDateTime(s.createdAt).toLowerCase()
      return (
        s.receiptNo.toLowerCase().includes(term) ||
        cust.includes(term) ||
        items.includes(term) ||
        s.cashierName.toLowerCase().includes(term) ||
        when.includes(term)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, q, from, to])

  return (
    <div>
      <PageHeader
        title="Sales history"
        subtitle={role === 'cashier' ? 'Your past sales — tap any to reprint the receipt' : 'Every past sale — tap any to reprint the receipt'}
      />

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={18} />
        <input className="input pl-10" placeholder="Search receipt, customer, item, cashier or date (e.g. 12 Jul)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="text-xs font-semibold text-brand-900/60 dark:text-white/60">
          From
          <input type="date" className="input mt-0.5 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-semibold text-brand-900/60 dark:text-white/60">
          To
          <input type="date" className="input mt-0.5 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(from || to || q) && (
          <button className="btn-ghost py-2 text-sm" onClick={() => { setFrom(''); setTo(''); setQ('') }}>Clear</button>
        )}
        <span className="ml-auto text-xs text-brand-900/50 dark:text-white/50">{filtered.length} sale{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ReceiptText size={30} />} title="No sales yet" hint="Completed sales appear here. You can reprint any receipt at any time." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const cust = nameOf(s.customerId)
            return (
              <button key={s.id} onClick={() => setSelected(s)} className="card flex w-full items-center gap-3 p-3 text-left transition hover:ring-2 hover:ring-brand-500/30">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-white/10 dark:text-gold-400">
                  <ReceiptText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-900 dark:text-white">{money(s.total, currency)}</span>
                    <span className="text-xs text-brand-900/40 dark:text-white/40">#{s.receiptNo}</span>
                    {s.creditAmount > 0 && <span className="chip bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">mkopo</span>}
                  </div>
                  <div className="truncate text-xs text-brand-900/50 dark:text-white/50">
                    {shortDateTime(s.createdAt)} · served by {s.cashierName}{s.assignedToName ? ` (for ${s.assignedToName})` : ''}{cust ? ` · ${cust}` : ''}
                  </div>
                  <div className="truncate text-xs text-brand-900/40 dark:text-white/40">
                    {s.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')} · {s.tenders.map((t) => METHOD_LABEL[t.method] || t.method).join(', ')}
                  </div>
                </div>
                <Printer size={16} className="shrink-0 text-brand-900/40 dark:text-white/40" />
              </button>
            )
          })}
        </div>
      )}

      <Receipt sale={selected} open={!!selected} onClose={() => setSelected(null)} onNewSale={() => setSelected(null)} />
    </div>
  )
}
