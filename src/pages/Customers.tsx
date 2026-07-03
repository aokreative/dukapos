import { useMemo, useState } from 'react'
import { Search, UserPlus, Phone, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { displayPhone, isValidPhone, money, normalizePhone } from '../lib/format'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import type { Customer } from '../types'

export default function Customers() {
  const customers = useStore((s) => s.customers)
  const debts = useStore((s) => s.debts)
  const currency = useStore((s) => s.settings.currency)
  const addCustomer = useStore((s) => s.addCustomer)
  const updateCustomer = useStore((s) => s.updateCustomer)
  const removeCustomer = useStore((s) => s.removeCustomer)

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [creating, setCreating] = useState(false)

  const balanceByCustomer = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of debts) if (d.status === 'open') map.set(d.customerId, (map.get(d.customerId) ?? 0) + d.balance)
    return map
  }, [debts])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = customers.filter((c) => !t || c.name.toLowerCase().includes(t) || c.phone.includes(t.replace(/\D/g, '')))
    return list.sort((a, b) => (balanceByCustomer.get(b.id) ?? 0) - (balanceByCustomer.get(a.id) ?? 0))
  }, [customers, q, balanceByCustomer])

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} saved`}
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <UserPlus size={18} /> Add
          </button>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={18} />
        <input className="input pl-10" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<UserPlus size={32} />} title="No customers yet" hint="Add customers to track their credit and send reminders." />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const bal = balanceByCustomer.get(c.id) ?? 0
            return (
              <div key={c.id} className="card flex items-center gap-3 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-700 dark:text-white">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-brand-900 dark:text-white">{c.name}</span>
                    {bal > 0 ? <Badge color="red">owes {money(bal, currency)}</Badge> : <Badge color="green">paid up</Badge>}
                  </div>
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-sm text-brand-900/50 hover:underline dark:text-white/50">
                    <Phone size={13} /> {displayPhone(c.phone)}
                  </a>
                  {c.note && <div className="truncate text-xs text-brand-900/40 dark:text-white/40">{c.note}</div>}
                </div>
                <button className="rounded-lg p-2 text-brand-900/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10" onClick={() => setEditing(c)}>
                  <Pencil size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {(creating || editing) && (
        <CustomerForm
          customer={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={(data) => {
            if (editing) updateCustomer(editing.id, data)
            else addCustomer(data)
            setCreating(false)
            setEditing(null)
          }}
          onDelete={
            editing && (balanceByCustomer.get(editing.id) ?? 0) === 0
              ? () => {
                  removeCustomer(editing.id)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function CustomerForm({
  customer,
  onClose,
  onSave,
  onDelete,
}: {
  customer: Customer | null
  onClose: () => void
  onSave: (data: { name: string; phone: string; note?: string }) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer ? displayPhone(customer.phone) : '')
  const [note, setNote] = useState(customer?.note ?? '')
  const valid = name.trim() && isValidPhone(phone)

  return (
    <Modal open onClose={onClose} title={customer ? 'Edit customer' : 'New customer'}>
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mama Njeri" />
        </div>
        <div>
          <label className="label">Phone (for WhatsApp/SMS reminders)</label>
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
          {phone && !isValidPhone(phone) && <p className="mt-1 text-xs text-red-600">Enter a valid Kenyan number</p>}
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Regular, buys weekly" />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        {onDelete && (
          <button className="btn-danger" onClick={onDelete} aria-label="Delete">
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn-primary flex-1" disabled={!valid} onClick={() => onSave({ name: name.trim(), phone: normalizePhone(phone), note: note.trim() || undefined })}>
          Save
        </button>
      </div>
      {onDelete === undefined && customer && (
        <p className="mt-2 text-center text-xs text-brand-900/40 dark:text-white/40">Settle their debt before deleting.</p>
      )}
    </Modal>
  )
}
