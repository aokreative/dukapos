// Returns & exchanges. Pick the sale, pick what's coming back, choose how to
// settle it: refund the money, or give an exchange credit the till applies to
// the customer's next purchase. Returned items go straight back into stock.
import { useMemo, useState } from 'react'
import { RotateCcw, Search, Banknote, Smartphone, Repeat } from 'lucide-react'
import { Modal } from './ui'
import { useStore } from '../store/useStore'
import { money, shortDateTime } from '../lib/format'
import type { ReturnResolution, Sale, PaymentMethod } from '../types'

export default function ReturnModal({ onClose }: { onClose: () => void }) {
  const sales = useStore((s) => s.sales)
  const customers = useStore((s) => s.customers)
  const currency = useStore((s) => s.settings.currency)
  const recordReturn = useStore((s) => s.recordReturn)

  const [q, setQ] = useState('')
  const [sale, setSale] = useState<Sale | null>(null)
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [resolution, setResolution] = useState<ReturnResolution>('refund')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')

  const recent = useMemo(() => {
    const t = q.trim().toLowerCase()
    return sales
      .filter((s) => !t || s.receiptNo.toLowerCase().includes(t))
      .slice(0, 8)
  }, [sales, q])

  const amount = useMemo(() => {
    if (!sale) return 0
    return sale.lines.reduce((a, l) => a + (qtys[l.productId + l.name] || 0) * l.price, 0)
  }, [sale, qtys])

  function setQty(key: string, max: number, v: number) {
    setQtys((m) => ({ ...m, [key]: Math.max(0, Math.min(max, v)) }))
  }

  function confirm() {
    if (!sale || amount <= 0) return
    const lines = sale.lines
      .map((l) => ({ productId: l.productId, name: l.name, qty: qtys[l.productId + l.name] || 0 }))
      .filter((l) => l.qty > 0)
    recordReturn({
      saleId: sale.id,
      receiptNo: sale.receiptNo,
      customerId: sale.customerId,
      lines,
      amount,
      resolution,
      method: resolution === 'refund' ? method : undefined,
      note: note.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Return / exchange">
      {!sale ? (
        <>
          <p className="mb-2 text-sm text-brand-900/60 dark:text-white/60">Which sale are the goods coming back from?</p>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={16} />
            <input autoFocus className="input py-2 pl-9 text-sm" placeholder="Receipt number, e.g. R-00012" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {recent.map((s) => {
              const cust = s.customerId ? customers.find((c) => c.id === s.customerId) : undefined
              return (
                <button key={s.id} className="flex w-full items-center justify-between rounded-xl bg-black/5 px-3 py-2.5 text-left hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15" onClick={() => setSale(s)}>
                  <span>
                    <span className="block text-sm font-bold text-brand-900 dark:text-white">{s.receiptNo}{cust ? ` · ${cust.name}` : ''}</span>
                    <span className="block text-xs text-brand-900/50 dark:text-white/50">{shortDateTime(s.createdAt)} · served by {s.cashierName}</span>
                  </span>
                  <span className="font-bold text-brand-900 dark:text-white">{money(s.total, currency)}</span>
                </button>
              )
            })}
            {recent.length === 0 && <p className="py-6 text-center text-sm text-brand-900/40 dark:text-white/40">No sale found with that receipt number.</p>}
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 rounded-xl bg-brand-50 px-3 py-2 text-sm dark:bg-brand-900">
            <span className="font-bold text-brand-900 dark:text-white">{sale.receiptNo}</span>
            <span className="text-brand-900/50 dark:text-white/50"> · {shortDateTime(sale.createdAt)} · {money(sale.total, currency)}</span>
            <button className="ml-2 text-xs font-semibold text-brand-600 underline dark:text-gold-400" onClick={() => { setSale(null); setQtys({}) }}>change</button>
          </div>

          <p className="label">What is coming back?</p>
          <div className="space-y-1.5">
            {sale.lines.map((l) => {
              const key = l.productId + l.name
              const qty = qtys[key] || 0
              return (
                <div key={key} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${qty > 0 ? 'bg-brand-50 dark:bg-brand-900' : 'bg-black/5 dark:bg-white/10'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-brand-900 dark:text-white">{l.name}</div>
                    <div className="text-[11px] text-brand-900/50 dark:text-white/50">bought {l.qty} × {money(l.price, currency)}</div>
                  </div>
                  <button className="rounded-lg bg-black/5 p-1.5 dark:bg-white/10" onClick={() => setQty(key, l.qty, qty - 1)}>−</button>
                  <span className="w-8 text-center text-sm font-bold text-brand-900 dark:text-white">{qty}</span>
                  <button className="rounded-lg bg-black/5 p-1.5 dark:bg-white/10" onClick={() => setQty(key, l.qty, qty + 1)}>+</button>
                </div>
              )
            })}
          </div>

          <p className="label mt-3">How do we settle it?</p>
          <div className="grid grid-cols-3 gap-2">
            <button className={`chip justify-center py-2.5 ${resolution === 'refund' && method === 'cash' ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`} onClick={() => { setResolution('refund'); setMethod('cash') }}>
              <Banknote size={14} /> Refund cash
            </button>
            <button className={`chip justify-center py-2.5 ${resolution === 'refund' && method === 'mpesa' ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`} onClick={() => { setResolution('refund'); setMethod('mpesa') }}>
              <Smartphone size={14} /> M-PESA
            </button>
            <button className={`chip justify-center py-2.5 ${resolution === 'exchange' ? 'bg-gold-500 text-brand-900' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`} onClick={() => setResolution('exchange')}>
              <Repeat size={14} /> Exchange
            </button>
          </div>
          {resolution === 'exchange' && (
            <p className="mt-2 text-xs text-brand-900/50 dark:text-white/50">
              The amount becomes credit and is applied automatically when they pick their new item at the till.
            </p>
          )}

          <input className="input mt-3 py-2 text-sm" placeholder="Reason (optional) — e.g. wrong size" value={note} onChange={(e) => setNote(e.target.value)} />

          <button className="btn-primary mt-4 w-full" disabled={amount <= 0} onClick={confirm}>
            <RotateCcw size={18} /> {resolution === 'exchange' ? `Give ${money(amount, currency)} exchange credit` : `Refund ${money(amount, currency)}`}
          </button>
          <p className="mt-2 text-center text-xs text-brand-900/40 dark:text-white/40">Returned items go back into stock at this branch.</p>
        </>
      )}
    </Modal>
  )
}
