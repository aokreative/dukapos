import { useMemo, useState } from 'react'
import { Search, UserPlus, Phone, Pencil, Trash2, Store, Truck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { displayPhone, isValidPhone, money, normalizePhone } from '../lib/format'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import CustomerProfile from '../components/CustomerProfile'
import type { Customer } from '../types'

export default function Customers() {
  const customers = useStore((s) => s.customers)
  const debts = useStore((s) => s.debts)
  const currency = useStore((s) => s.settings.currency)
  const addCustomer = useStore((s) => s.addCustomer)
  const updateCustomer = useStore((s) => s.updateCustomer)
  const removeCustomer = useStore((s) => s.removeCustomer)
  const suppliers = useStore((s) => s.suppliers)
  const addSupplier = useStore((s) => s.addSupplier)

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [creating, setCreating] = useState(false)
  const [profileFor, setProfileFor] = useState<Customer | null>(null)

  const balanceByCustomer = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of debts) if (d.status === 'open') map.set(d.customerId, (map.get(d.customerId) ?? 0) + d.balance)
    return map
  }, [debts])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const digits = t.replace(/\D/g, '')
    const list = customers.filter(
      (c) =>
        !t ||
        c.name.toLowerCase().includes(t) ||
        (!!digits && c.phone.includes(digits)) ||
        (c.ownerName ?? '').toLowerCase().includes(t) ||
        (c.note ?? '').toLowerCase().includes(t),
    )
    return list.sort((a, b) => (balanceByCustomer.get(b.id) ?? 0) - (balanceByCustomer.get(a.id) ?? 0))
  }, [customers, q, balanceByCustomer])

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} saved · tap one for their full record`}
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <UserPlus size={18} /> Add
          </button>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={18} />
        <input className="input pl-10" placeholder="Search name, shop or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<UserPlus size={32} />} title="No customers yet" hint="Add customers to track their credit and send reminders." />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const bal = balanceByCustomer.get(c.id) ?? 0
            return (
              <div key={c.id} className="card flex items-center gap-3 p-3">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setProfileFor(c)}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-700 dark:text-white">
                    {c.isShop ? <Store size={18} /> : c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-brand-900 dark:text-white">{c.name}</span>
                      {c.isShop && <Badge color="amber">shop</Badge>}
                      {bal > 0 ? <Badge color="red">owes {money(bal, currency)}</Badge> : <Badge color="green">paid up</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-brand-900/50 dark:text-white/50">
                      <Phone size={13} /> {displayPhone(c.phone)}
                      {c.ownerName && <span className="truncate">· {c.ownerName}</span>}
                    </div>
                    {c.note && <div className="truncate text-xs text-brand-900/40 dark:text-white/40">{c.note}</div>}
                  </div>
                </button>
                <button className="rounded-lg p-2 text-brand-900/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10" onClick={() => setEditing(c)} aria-label="Edit">
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
          isSupplier={!!editing && suppliers.some((s) => s.customerId === editing.id)}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={({ alsoSupplier, ...data }) => {
            const saved = editing ? (updateCustomer(editing.id, data), { ...editing, ...data }) : addCustomer(data)
            // Make them a supplier too (create the linked record if none yet).
            if (alsoSupplier && !suppliers.some((s) => s.customerId === saved.id)) {
              addSupplier({ name: saved.name, phone: saved.phone, customerId: saved.id })
            }
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

      {profileFor && <CustomerProfile customer={profileFor} onClose={() => setProfileFor(null)} />}
    </div>
  )
}

function CustomerForm({
  customer,
  isSupplier,
  onClose,
  onSave,
  onDelete,
}: {
  customer: Customer | null
  isSupplier?: boolean
  onClose: () => void
  onSave: (data: { name: string; phone: string; isShop?: boolean; ownerName?: string; ownerPhone?: string; note?: string; alsoSupplier?: boolean }) => void
  onDelete?: () => void
}) {
  const [isShop, setIsShop] = useState(!!customer?.isShop)
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer ? displayPhone(customer.phone) : '')
  const [ownerName, setOwnerName] = useState(customer?.ownerName ?? '')
  const [ownerPhone, setOwnerPhone] = useState(customer?.ownerPhone ? displayPhone(customer.ownerPhone) : '')
  const [note, setNote] = useState(customer?.note ?? '')
  const [alsoSupplier, setAlsoSupplier] = useState(!!isSupplier)
  const valid = name.trim() && isValidPhone(phone) && (!ownerPhone || isValidPhone(ownerPhone))

  return (
    <Modal open onClose={onClose} title={customer ? 'Edit customer' : 'New customer'}>
      <div className="space-y-3">
        <label className="flex items-center gap-3 rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={isShop} onChange={(e) => setIsShop(e.target.checked)} />
          <span className="text-sm font-medium text-brand-900 dark:text-white">
            <Store size={13} className="mr-1 inline" /> This customer is a shop / business
          </span>
        </label>
        <div>
          <label className="label">{isShop ? 'Shop / business name' : 'Name'}</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={isShop ? 'e.g. Mwangi Electronics' : 'e.g. Mama Njeri'} />
        </div>
        <div>
          <label className="label">{isShop ? 'Shop phone (for WhatsApp/SMS reminders)' : 'Phone (for WhatsApp/SMS reminders)'}</label>
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
          {phone && !isValidPhone(phone) && <p className="mt-1 text-xs text-red-600">Enter a valid Kenyan number</p>}
        </div>
        {isShop && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Owner's name (optional)</label>
              <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. James Mwangi" />
            </div>
            <div>
              <label className="label">Owner's phone (optional)</label>
              <input className="input" inputMode="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="07XX XXX XXX" />
            </div>
          </div>
        )}
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Regular, buys weekly" />
        </div>
        <label className={`flex items-center gap-3 rounded-xl px-3 py-3 ${isSupplier ? 'bg-green-50 dark:bg-green-500/10' : 'bg-black/5 dark:bg-white/10'}`}>
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={alsoSupplier} disabled={isSupplier} onChange={(e) => setAlsoSupplier(e.target.checked)} />
          <span className="text-sm font-medium text-brand-900 dark:text-white">
            <Truck size={13} className="mr-1 inline" /> {isSupplier ? 'Also a supplier ✓ (you buy from them too)' : 'Also a supplier — you buy from them too'}
            {!isSupplier && <span className="block text-xs font-normal text-brand-900/50 dark:text-white/50">Creates a linked supplier so you can record deliveries from them.</span>}
          </span>
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        {onDelete && (
          <button className="btn-danger" onClick={onDelete} aria-label="Delete">
            <Trash2 size={18} />
          </button>
        )}
        <button
          className="btn-primary flex-1"
          disabled={!valid}
          onClick={() =>
            onSave({
              name: name.trim(),
              phone: normalizePhone(phone),
              isShop: isShop || undefined,
              ownerName: isShop && ownerName.trim() ? ownerName.trim() : undefined,
              ownerPhone: isShop && ownerPhone.trim() ? normalizePhone(ownerPhone) : undefined,
              note: note.trim() || undefined,
              alsoSupplier: alsoSupplier && !isSupplier ? true : undefined,
            })
          }
        >
          Save
        </button>
      </div>
      {onDelete === undefined && customer && (
        <p className="mt-2 text-center text-xs text-brand-900/40 dark:text-white/40">Settle their debt before deleting.</p>
      )}
    </Modal>
  )
}
