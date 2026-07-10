// Expenses — the shop's running costs: electricity tokens, tissue, tape,
// receipt rolls, transport… Recorded by any staff member, deletable by
// owner/manager, and pulled into the close-of-business PnL automatically.
import { useMemo, useState } from 'react'
import { ReceiptText, Plus, Trash2, Wallet } from 'lucide-react'
import { useStore, selectRole, selectCurrentLocation } from '../store/useStore'
import { money, shortDateTime } from '../lib/format'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import { can } from '../lib/permissions'
import type { PaymentMethod } from '../types'

const CATEGORIES = ['Electricity', 'Supplies', 'Transport', 'Rent', 'Airtime', 'Repairs', 'Other']

export default function Expenses() {
  const expenses = useStore((s) => s.expenses)
  const currency = useStore((s) => s.settings.currency)
  const removeExpense = useStore((s) => s.removeExpense)
  const role = useStore(selectRole)
  const location = useStore(selectCurrentLocation)
  const locations = useStore((s) => s.locations)
  const canManage = can(role, 'viewReports') // owner + manager

  const [adding, setAdding] = useState(false)

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const t0 = dayStart.getTime()
  const DAY = 24 * 60 * 60 * 1000

  const stats = useMemo(() => {
    const today = expenses.filter((e) => e.at >= t0)
    const week = expenses.filter((e) => e.at >= t0 - 6 * DAY)
    return {
      today: today.reduce((a, e) => a + e.amount, 0),
      week: week.reduce((a, e) => a + e.amount, 0),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses])

  const recent = useMemo(() => expenses.slice(0, 60), [expenses])
  const locName = (id: string) => locations.find((l) => l.id === id)?.name

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Running costs — tokens, supplies, transport…"
        action={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={18} /> Add expense
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
            <Wallet size={14} /> Today
          </div>
          <div className="mt-1 text-2xl font-black text-brand-900 dark:text-white">{money(stats.today, currency)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
            <Wallet size={14} /> Last 7 days
          </div>
          <div className="mt-1 text-2xl font-black text-brand-900 dark:text-white">{money(stats.week, currency)}</div>
        </div>
      </div>

      {recent.length === 0 ? (
        <EmptyState icon={<ReceiptText size={32} />} title="No expenses recorded" hint="Electricity tokens, tissue, tape, receipt rolls… record them here so your profit numbers are honest." />
      ) : (
        <div className="space-y-2">
          {recent.map((e) => (
            <div key={e.id} className="card flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-brand-900 dark:text-white">{e.name}</span>
                  <Badge color="amber">{e.category}</Badge>
                </div>
                <div className="text-xs text-brand-900/50 dark:text-white/50">
                  {shortDateTime(e.at)} · by {e.byStaffName}
                  {locations.length > 1 && locName(e.locationId) ? ` · ${locName(e.locationId)}` : ''}
                  {e.note ? ` · "${e.note}"` : ''}
                </div>
              </div>
              <span className="font-black text-brand-900 dark:text-white">{money(e.amount, currency)}</span>
              {canManage && (
                <button className="rounded-lg p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => removeExpense(e.id)} aria-label="Delete">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && <ExpenseForm onClose={() => setAdding(false)} locationName={location?.name} />}
    </div>
  )
}

function ExpenseForm({ onClose, locationName }: { onClose: () => void; locationName?: string }) {
  const currency = useStore((s) => s.settings.currency)
  const addExpense = useStore((s) => s.addExpense)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState('Supplies')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')

  return (
    <Modal open onClose={onClose} title="Add expense">
      {locationName && <p className="-mt-1 mb-2 text-xs text-brand-900/40 dark:text-white/40">Recorded at {locationName}.</p>}
      <div className="space-y-3">
        <div>
          <label className="label">What was it?</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electricity tokens / Tissue paper" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount ({currency})</label>
            <input className="input" inputMode="decimal" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Paid via</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              <option value="cash">Cash (from drawer)</option>
              <option value="mpesa">M-PESA</option>
              <option value="airtel">Airtel Money</option>
              <option value="card">Bank/Card</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`chip ${category === c ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder='e.g. "bought at Naivas"' />
        </div>
      </div>
      <button
        className="btn-primary mt-4 w-full"
        disabled={!name.trim() || amount <= 0}
        onClick={() => {
          addExpense({ name: name.trim(), amount, category, method, note: note.trim() || undefined })
          onClose()
        }}
      >
        Record {money(amount, currency)}
      </button>
    </Modal>
  )
}
