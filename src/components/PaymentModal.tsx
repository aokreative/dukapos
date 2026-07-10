import { useMemo, useState } from 'react'
import { Banknote, Smartphone, CreditCard, HandCoins, Trash2, User } from 'lucide-react'
import { Modal } from './ui'
import CustomerPicker from './CustomerPicker'
import { useStore } from '../store/useStore'
import { money } from '../lib/format'
import type { Customer, PaymentMethod, Tender } from '../types'

const METHODS: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'mpesa', label: 'M-PESA', icon: Smartphone },
  { key: 'airtel', label: 'Airtel', icon: Smartphone },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'credit', label: 'Credit', icon: HandCoins },
]

export default function PaymentModal({
  open,
  onClose,
  total,
  onComplete,
}: {
  open: boolean
  onClose: () => void
  total: number
  onComplete: (tenders: Tender[], customerId?: string) => void
}) {
  const currency = useStore((s) => s.settings.currency)
  const [tenders, setTenders] = useState<Tender[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const sum = useMemo(() => tenders.reduce((a, t) => a + (t.amount || 0), 0), [tenders])
  const remaining = Math.round((total - sum) * 100) / 100
  const cashSum = tenders.filter((t) => t.method === 'cash').reduce((a, t) => a + t.amount, 0)
  const change = sum > total && cashSum > 0 ? Math.round((sum - total) * 100) / 100 : 0
  const hasCredit = tenders.some((t) => t.method === 'credit')
  const canComplete = sum >= total - 0.001 && (!hasCredit || !!customer)

  function addMethod(method: PaymentMethod) {
    const fill = Math.max(0, remaining)
    setTenders((t) => [...t, { method, amount: fill, ref: '' }])
  }
  function setAmount(i: number, val: number) {
    setTenders((t) => t.map((x, idx) => (idx === i ? { ...x, amount: isNaN(val) ? 0 : val } : x)))
  }
  function setRef(i: number, val: string) {
    setTenders((t) => t.map((x, idx) => (idx === i ? { ...x, ref: val } : x)))
  }
  function remove(i: number) {
    setTenders((t) => t.filter((_, idx) => idx !== i))
  }
  function reset() {
    setTenders([])
    setCustomer(null)
  }
  function complete() {
    // Clamp a credit tender to the exact remaining so we never over-credit.
    const finalTenders = tenders
      .map((t) => (t.method === 'credit' ? { ...t, amount: Math.max(0, Math.round((total - (sum - t.amount)) * 100) / 100) } : t))
      .filter((t) => t.amount > 0)
    onComplete(finalTenders, customer?.id)
    reset()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          reset()
          onClose()
        }}
        title="Take payment"
      >
        <div className="rounded-2xl bg-brand-50 p-4 text-center dark:bg-brand-900">
          <div className="text-xs uppercase tracking-wide text-brand-900/50 dark:text-white/50">Amount due</div>
          <div className="text-3xl font-black text-brand-700 dark:text-gold-400">{money(total, currency)}</div>
        </div>

        {/* Method buttons */}
        <div className="mt-4 grid grid-cols-5 gap-2">
          {METHODS.map((m) => (
            <button key={m.key} className="flex flex-col items-center gap-1 rounded-xl bg-black/5 py-3 text-xs font-semibold text-brand-900 hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20" onClick={() => addMethod(m.key)}>
              <m.icon size={20} />
              {m.label}
            </button>
          ))}
        </div>

        {/* Tenders */}
        <div className="mt-4 space-y-2">
          {tenders.map((t, i) => (
            <div key={i} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm font-semibold capitalize text-brand-900 dark:text-white">{t.method}</span>
                <input
                  className="input py-2 text-right"
                  inputMode="decimal"
                  value={t.amount || ''}
                  onChange={(e) => setAmount(i, parseFloat(e.target.value))}
                />
                <button className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20" onClick={() => remove(i)} aria-label="Remove">
                  <Trash2 size={16} />
                </button>
              </div>
              {(t.method === 'mpesa' || t.method === 'airtel' || t.method === 'card') && (
                <input className="input mt-2 py-2 text-sm" placeholder={t.method === 'mpesa' ? 'M-PESA code (e.g. RBG6X...)' : t.method === 'airtel' ? 'Airtel Money ref (optional)' : 'Card ref (optional)'} value={t.ref || ''} onChange={(e) => setRef(i, e.target.value)} />
              )}
            </div>
          ))}
        </div>

        {/* Credit needs a customer */}
        {hasCredit && (
          <button className={`mt-3 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${customer ? 'border-brand-500 bg-brand-50 dark:bg-brand-900' : 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'}`} onClick={() => setPickerOpen(true)}>
            <User size={18} className="text-brand-600 dark:text-gold-400" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-brand-900 dark:text-white">{customer ? customer.name : 'Select customer for credit'}</div>
              <div className="text-xs text-brand-900/50 dark:text-white/50">{customer ? 'Debt will be recorded & reminded' : 'Required for Mkopo / credit sales'}</div>
            </div>
          </button>
        )}

        {/* Status line */}
        <div className="mt-4 flex items-center justify-between text-sm">
          {change > 0 ? (
            <span className="font-bold text-green-700 dark:text-green-400">Change: {money(change, currency)}</span>
          ) : remaining > 0 ? (
            <span className="text-brand-900/60 dark:text-white/60">Remaining: {money(remaining, currency)}</span>
          ) : (
            <span className="font-semibold text-green-700 dark:text-green-400">Fully covered ✓</span>
          )}
        </div>

        <button className="btn-primary mt-3 w-full text-lg" disabled={!canComplete} onClick={complete}>
          Complete sale
        </button>
        {tenders.length === 0 && (
          <button className="btn-gold mt-2 w-full" onClick={() => { onComplete([{ method: 'cash', amount: total }]); reset() }}>
            Exact cash · {money(total, currency)}
          </button>
        )}
      </Modal>

      <CustomerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(c) => { setCustomer(c); setPickerOpen(false) }} />
    </>
  )
}
