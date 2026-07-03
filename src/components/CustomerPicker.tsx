import { useMemo, useState } from 'react'
import { Search, UserPlus, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Modal } from './ui'
import { displayPhone, isValidPhone } from '../lib/format'
import type { Customer } from '../types'

export default function CustomerPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (c: Customer) => void
}) {
  const customers = useStore((s) => s.customers)
  const addCustomer = useStore((s) => s.addCustomer)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(t) || c.phone.includes(t.replace(/\D/g, '')))
  }, [customers, q])

  function create() {
    if (!name.trim() || !isValidPhone(phone)) return
    const c = addCustomer({ name: name.trim(), phone })
    onPick(c)
    reset()
  }
  function reset() {
    setName('')
    setPhone('')
    setAdding(false)
    setQ('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Choose customer">
      {!adding ? (
        <>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={18} />
            <input autoFocus className="input pl-10" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn-ghost mb-3 w-full" onClick={() => setAdding(true)}>
            <UserPlus size={18} /> New customer
          </button>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  onPick(c)
                  reset()
                }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-700 dark:text-white">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-brand-900 dark:text-white">{c.name}</div>
                  <div className="text-xs text-brand-900/50 dark:text-white/50">{displayPhone(c.phone)}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-brand-900/50 dark:text-white/50">No customer found. Add a new one.</p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input autoFocus className="input" placeholder="e.g. Mama Njeri" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone (for reminders)</label>
            <input className="input" inputMode="tel" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {phone && !isValidPhone(phone) && <p className="mt-1 text-xs text-red-600">Enter a valid Kenyan number</p>}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setAdding(false)}>
              Back
            </button>
            <button className="btn-primary flex-1" onClick={create} disabled={!name.trim() || !isValidPhone(phone)}>
              <Check size={18} /> Save & pick
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
