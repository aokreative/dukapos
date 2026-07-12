import { useState, useMemo, useEffect } from 'react'
import { Banknote, Smartphone, CreditCard, HandCoins, Trash2, User, UserCheck, StickyNote, Phone } from 'lucide-react'
import { Modal } from './ui'
import CustomerPicker from './CustomerPicker'
import { useStore, selectCurrentStaff } from '../store/useStore'
import { money, displayPhone, normalizePhone } from '../lib/format'
import { mpesaCollect, mpesaCollectStatus, type ShopMpesaCreds } from '../lib/api'
import { shopMpesaCreds, vatIncludedIn } from '../lib/reminders'
import type { Customer, PaymentMethod, Tender } from '../types'

/** Prompt the customer's phone with an STK push instead of typing the code. */
function MpesaPrompt({ amount, defaultPhone, onConfirmed }: { amount: number; defaultPhone?: string; onConfirmed: (ref: string) => void }) {
  const settings = useStore((s) => s.settings)
  const creds: ShopMpesaCreds | null = shopMpesaCreds(settings)
  const [phone, setPhone] = useState(defaultPhone ? displayPhone(defaultPhone) : '')
  const [state, setState] = useState<'idle' | 'sending' | 'waiting' | 'done' | 'failed'>('idle')

  async function prompt() {
    if (!phone.trim() || amount <= 0) return
    setState('sending')
    const out = await mpesaCollect(phone, amount, 'Sale', creds)
    if (!out) return setState('failed')
    setState('waiting')
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const s = await mpesaCollectStatus(out.checkoutId)
      if (s === 'success') {
        setState('done')
        onConfirmed('STK-' + out.checkoutId.slice(-6).toUpperCase())
        return
      }
      if (s === 'failed') return setState('failed')
    }
    setState('failed')
  }

  if (state === 'done') return <div className="mt-2 text-xs font-semibold text-green-600 dark:text-green-400">✓ Customer paid via M-PESA prompt</div>
  return (
    <div className="mt-2 flex items-center gap-2">
      <input className="input py-1.5 text-sm" inputMode="tel" placeholder="Customer phone for STK prompt" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={state === 'sending' || state === 'waiting'} />
      <button
        className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        disabled={!phone.trim() || state === 'sending' || state === 'waiting'}
        onClick={prompt}
      >
        {state === 'sending' ? 'Sending…' : state === 'waiting' ? 'Waiting…' : state === 'failed' ? 'Retry prompt' : '📲 Prompt'}
      </button>
    </div>
  )
}

export interface SaleExtras {
  assignedToName?: string
  note?: string
}

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
  onComplete: (tenders: Tender[], customerId?: string, extras?: SaleExtras) => void
}) {
  const settings = useStore((s) => s.settings)
  const currency = settings.currency
  const vat = vatIncludedIn(total, settings)
  const staff = useStore((s) => s.staff)
  const currentStaff = useStore(selectCurrentStaff)
  const customers = useStore((s) => s.customers)
  const addCustomer = useStore((s) => s.addCustomer)
  const [tenders, setTenders] = useState<Tender[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [assignedToName, setAssignedToName] = useState('')
  const [note, setNote] = useState('')
  const [showExtras, setShowExtras] = useState(false)
  const [phone, setPhone] = useState('')
  const sellers = staff.filter((m) => m.active)

  // Quick customer-by-phone: as the cashier types a number, auto-recognise a
  // returning customer. A number with no match becomes a new customer on
  // completion — no name search needed.
  const phoneNorm = normalizePhone(phone)
  const phoneValid = phoneNorm.length >= 12
  const phoneMatch = useMemo(() => (phoneValid ? customers.find((c) => c.phone === phoneNorm) : undefined), [phoneValid, phoneNorm, customers])
  useEffect(() => {
    if (phoneMatch && customer?.id !== phoneMatch.id) setCustomer(phoneMatch)
  }, [phoneMatch]) // eslint-disable-line react-hooks/exhaustive-deps

  const sum = useMemo(() => tenders.reduce((a, t) => a + (t.amount || 0), 0), [tenders])
  const remaining = Math.round((total - sum) * 100) / 100
  const cashSum = tenders.filter((t) => t.method === 'cash').reduce((a, t) => a + t.amount, 0)
  const change = sum > total && cashSum > 0 ? Math.round((sum - total) * 100) / 100 : 0
  const hasCredit = tenders.some((t) => t.method === 'credit')
  const canComplete = sum >= total - 0.001 && (!hasCredit || !!customer || phoneValid)

  /** The customer for this sale: the picked one, an existing phone match, or a
   *  brand-new customer created from the typed phone (so points still accrue). */
  function resolveCustomerId(): string | undefined {
    // A typed phone is authoritative (find or create); otherwise the picked one.
    if (phoneValid) {
      const found = customers.find((c) => c.phone === phoneNorm)
      return found ? found.id : addCustomer({ name: displayPhone(phoneNorm), phone: phoneNorm }).id
    }
    return customer?.id
  }

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
    setAssignedToName('')
    setNote('')
    setShowExtras(false)
    setPhone('')
  }
  function extras(): SaleExtras {
    return {
      assignedToName: assignedToName || undefined,
      note: note.trim() || undefined,
    }
  }
  function complete() {
    // Clamp a credit tender to the exact remaining so we never over-credit.
    const finalTenders = tenders
      .map((t) => (t.method === 'credit' ? { ...t, amount: Math.max(0, Math.round((total - (sum - t.amount)) * 100) / 100) } : t))
      .filter((t) => t.amount > 0)
    onComplete(finalTenders, resolveCustomerId(), extras())
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
          {vat > 0 && (
            <div className="mt-1 text-xs text-brand-900/50 dark:text-white/50">Incl. VAT ({settings.vatRate}%): {money(vat, currency)}</div>
          )}
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

        {/* Loyalty — redeem the attached customer's points (1 point = KES 1). */}
        {settings.loyaltyEnabled && customer && (customer.points || 0) > 0 && !tenders.some((t) => t.method === 'points') && remaining > 0 && (
          <button
            className="mt-3 flex w-full items-center justify-between rounded-xl bg-gold-400/15 px-3 py-2.5 text-sm font-semibold text-gold-700 dark:text-gold-300"
            onClick={() => {
              const use = Math.min(customer.points || 0, Math.max(0, remaining))
              if (use > 0) setTenders((t) => [...t, { method: 'points', amount: use, ref: '' }])
            }}
          >
            <span>⭐ Redeem {customer.name}'s points</span>
            <span>{money(Math.min(customer.points || 0, remaining), currency)} of {money(customer.points || 0, currency)}</span>
          </button>
        )}

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
              {t.method === 'mpesa' && (
                <MpesaPrompt
                  amount={t.amount}
                  defaultPhone={customer?.phone}
                  onConfirmed={(ref) => setRef(i, ref)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Quick customer by phone — type a number, it recognises a returning
            customer (or saves a new one) and earns loyalty points. No name search. */}
        <div className="mt-3">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-900/60 dark:text-white/60">
            <Phone size={13} /> Customer phone {settings.loyaltyEnabled ? '— earns loyalty points' : '(optional)'}
          </label>
          <input
            className="input"
            inputMode="tel"
            placeholder="07XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {phoneValid && (
            <p className="mt-1 text-xs font-medium">
              {phoneMatch ? (
                <span className="text-green-600 dark:text-green-400">
                  ✓ {phoneMatch.name}
                  {settings.loyaltyEnabled ? ` · ⭐ ${phoneMatch.points ?? 0} pts` : ''} — will earn points
                </span>
              ) : (
                <span className="text-brand-600 dark:text-gold-400">New customer — saved automatically for points</span>
              )}
            </p>
          )}
        </div>

        {/* Or find/attach a customer by name (for credit, or full profile). */}
        <button
          className={`mt-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
            customer
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900'
              : hasCredit
                ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
                : 'border-black/10 dark:border-white/10'
          }`}
          onClick={() => setPickerOpen(true)}
        >
          <User size={18} className="text-brand-600 dark:text-gold-400" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-brand-900 dark:text-white">
              {customer ? customer.name : hasCredit ? 'Select customer for credit' : 'Attach customer (optional)'}
            </div>
            <div className="text-xs text-brand-900/50 dark:text-white/50">
              {customer
                ? hasCredit
                  ? 'Debt will be recorded & reminded'
                  : 'Will show in their history as PAID ✓'
                : hasCredit
                  ? 'Required for Mkopo / credit sales'
                  : 'Keeps their purchase record clear — no debt disputes'}
            </div>
          </div>
          {customer && (
            <span
              className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-900/50 hover:bg-black/10 dark:text-white/50 dark:hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation()
                setCustomer(null)
              }}
            >
              remove
            </span>
          )}
        </button>

        {/* Assign to a colleague / add a note */}
        {!showExtras ? (
          <button className="mt-2 text-xs font-semibold text-brand-600 underline dark:text-gold-400" onClick={() => setShowExtras(true)}>
            + Assign to another cashier / add note
          </button>
        ) : (
          <div className="mt-3 space-y-2 rounded-xl bg-black/5 p-3 dark:bg-white/10">
            <div className="flex items-center gap-2">
              <UserCheck size={15} className="shrink-0 text-brand-600 dark:text-gold-400" />
              <select className="input py-2 text-sm" value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)}>
                <option value="">Sale counts for: {currentStaff?.name || 'me'} (me)</option>
                {sellers
                  .filter((m) => m.name !== currentStaff?.name)
                  .map((m) => (
                    <option key={m.id} value={m.name}>Sale counts for: {m.name}</option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <StickyNote size={15} className="shrink-0 text-brand-600 dark:text-gold-400" />
              <input className="input py-2 text-sm" placeholder='Note, e.g. "delivered to the salon"' value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
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
          <button className="btn-gold mt-2 w-full" onClick={() => { onComplete([{ method: 'cash', amount: total }], resolveCustomerId(), extras()); reset() }}>
            Exact cash · {money(total, currency)}
          </button>
        )}
      </Modal>

      <CustomerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(c) => { setCustomer(c); setPickerOpen(false) }} />
    </>
  )
}
