// Suppliers — who the shop buys from: wholesalers, farmers, or the neighbor
// next door. Tracks deliveries (what you owe), payments, and credit notes.
// A supplier can be linked to a customer record (customers who also supply).
import { useMemo, useState } from 'react'
import { Truck, Plus, Wallet, ChevronRight, PackageOpen, FileMinus2, Pencil, Trash2, UserRound, Link2 } from 'lucide-react'
import { useStore, supplierBalance } from '../store/useStore'
import { money, displayPhone, normalizePhone, shortDateTime } from '../lib/format'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import type { PaymentMethod, Supplier, SupplierTxnType } from '../types'

const TXN_LABEL: Record<SupplierTxnType, string> = {
  delivery: 'Delivery received',
  payment: 'Payment made',
  creditNote: 'Credit note',
}

export default function Suppliers() {
  const suppliers = useStore((s) => s.suppliers)
  const txns = useStore((s) => s.supplierTxns)
  const customers = useStore((s) => s.customers)
  const currency = useStore((s) => s.settings.currency)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [txnFor, setTxnFor] = useState<{ supplier: Supplier; type: SupplierTxnType } | null>(null)
  const [detailsFor, setDetailsFor] = useState<Supplier | null>(null)

  const totalOwed = useMemo(
    () => suppliers.reduce((a, s) => a + Math.max(0, supplierBalance(txns, s.id)), 0),
    [suppliers, txns],
  )

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Who you buy from — deliveries, payments & credit notes"
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> Add supplier
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
            <Truck size={14} /> Suppliers
          </div>
          <div className="mt-1 text-2xl font-black text-brand-900 dark:text-white">{suppliers.length}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
            <Wallet size={14} /> You owe suppliers
          </div>
          <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{money(totalOwed, currency)}</div>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={<Truck size={32} />} title="No suppliers yet" hint="Add the people and businesses you buy stock from — even the neighbor next door." />
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => {
            const bal = supplierBalance(txns, s.id)
            const linked = s.customerId ? customers.find((c) => c.id === s.customerId) : undefined
            return (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold text-brand-900 dark:text-white">{s.name}</span>
                      {linked && (
                        <Badge color="green"><Link2 size={11} /> also a customer</Badge>
                      )}
                    </div>
                    <div className="text-sm text-brand-900/50 dark:text-white/50">
                      {displayPhone(s.phone)}
                      {s.supplies ? ` · supplies ${s.supplies}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-black ${bal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                      {bal > 0 ? money(bal, currency) : 'Settled ✓'}
                    </div>
                    {bal > 0 && <div className="text-[11px] text-brand-900/40 dark:text-white/40">you owe</div>}
                    {bal < 0 && <div className="text-[11px] text-green-700 dark:text-green-400">{money(-bal, currency)} in your favour</div>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  <button className="btn-ghost py-2 text-xs sm:text-sm" onClick={() => setTxnFor({ supplier: s, type: 'delivery' })}>
                    <PackageOpen size={15} /> Delivery
                  </button>
                  <button className="btn-ghost py-2 text-xs sm:text-sm" onClick={() => setTxnFor({ supplier: s, type: 'payment' })}>
                    <Wallet size={15} /> Pay
                  </button>
                  <button className="btn-ghost py-2 text-xs sm:text-sm" onClick={() => setTxnFor({ supplier: s, type: 'creditNote' })}>
                    <FileMinus2 size={15} /> Credit note
                  </button>
                  <button className="btn-ghost py-2 text-xs sm:text-sm" onClick={() => setDetailsFor(s)}>
                    Details <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(creating || editing) && <SupplierForm supplier={editing} onClose={() => { setCreating(false); setEditing(null) }} />}
      {txnFor && <TxnModal supplier={txnFor.supplier} type={txnFor.type} onClose={() => setTxnFor(null)} />}
      {detailsFor && (
        <SupplierDetails
          supplier={detailsFor}
          onClose={() => setDetailsFor(null)}
          onEdit={() => {
            setEditing(detailsFor)
            setDetailsFor(null)
          }}
        />
      )}
    </div>
  )
}

function SupplierForm({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const customers = useStore((s) => s.customers)
  const addSupplier = useStore((s) => s.addSupplier)
  const updateSupplier = useStore((s) => s.updateSupplier)
  const removeSupplier = useStore((s) => s.removeSupplier)

  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier ? displayPhone(supplier.phone) : '')
  const [supplies, setSupplies] = useState(supplier?.supplies ?? '')
  const [customerId, setCustomerId] = useState(supplier?.customerId ?? '')
  const [note, setNote] = useState(supplier?.note ?? '')

  return (
    <Modal open onClose={onClose} title={supplier ? 'Edit supplier' : 'New supplier'}>
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kilimo Fresh / Mama Akinyi next door" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" />
          </div>
          <div>
            <label className="label">What they supply</label>
            <input className="input" value={supplies} onChange={(e) => setSupplies(e.target.value)} placeholder="e.g. Eggs & milk" />
          </div>
        </div>
        <div>
          <label className="label"><UserRound size={12} className="mr-1 inline" /> Also one of your customers? (optional)</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— no, supplier only —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. delivers Mondays; ask for Otis" />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        {supplier && (
          <button className="btn-danger" onClick={() => { removeSupplier(supplier.id); onClose() }} aria-label="Delete">
            <Trash2 size={18} />
          </button>
        )}
        <button
          className="btn-primary flex-1"
          disabled={!name.trim()}
          onClick={() => {
            const data = { name: name.trim(), phone: normalizePhone(phone), supplies: supplies.trim() || undefined, customerId: customerId || undefined, note: note.trim() || undefined }
            if (supplier) updateSupplier(supplier.id, data)
            else addSupplier(data)
            onClose()
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  )
}

function TxnModal({ supplier, type, onClose }: { supplier: Supplier; type: SupplierTxnType; onClose: () => void }) {
  const currency = useStore((s) => s.settings.currency)
  const txns = useStore((s) => s.supplierTxns)
  const addSupplierTxn = useStore((s) => s.addSupplierTxn)

  const bal = supplierBalance(txns, supplier.id)
  const [amount, setAmount] = useState<number>(type === 'payment' && bal > 0 ? bal : 0)
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const [ref, setRef] = useState('')
  const [items, setItems] = useState('')
  const [paidNow, setPaidNow] = useState(false)
  const [note, setNote] = useState('')

  const title =
    type === 'delivery' ? `Delivery from ${supplier.name}` : type === 'payment' ? `Pay ${supplier.name}` : `Credit note — ${supplier.name}`

  function save() {
    if (amount <= 0) return
    addSupplierTxn({
      supplierId: supplier.id,
      type,
      amount,
      method: type === 'payment' ? method : undefined,
      ref: ref.trim() || undefined,
      items: type === 'delivery' ? items.trim() || undefined : undefined,
      note: note.trim() || undefined,
    })
    // "Paid on the spot" deliveries record the matching payment too.
    if (type === 'delivery' && paidNow) {
      addSupplierTxn({ supplierId: supplier.id, type: 'payment', amount, method, ref: ref.trim() || undefined, note: 'Paid on delivery' })
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={title}>
      {type === 'payment' && bal > 0 && (
        <p className="mb-2 text-sm text-brand-900/60 dark:text-white/60">You currently owe {money(bal, currency)}.</p>
      )}
      {type === 'creditNote' && (
        <p className="mb-2 text-sm text-brand-900/60 dark:text-white/60">
          Goods returned to the supplier or an agreed reduction — it reduces what you owe them.
        </p>
      )}
      <div className="space-y-3">
        {type === 'delivery' && (
          <div>
            <label className="label">What was delivered</label>
            <input autoFocus className="input" value={items} onChange={(e) => setItems(e.target.value)} placeholder="e.g. 10 trays eggs, 5kg sugar" />
          </div>
        )}
        <div>
          <label className="label">Amount ({currency})</label>
          <input className="input" inputMode="decimal" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
        </div>
        {(type === 'payment' || (type === 'delivery' && paidNow)) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Method</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <option value="mpesa">M-PESA</option>
                <option value="airtel">Airtel Money</option>
                <option value="cash">Cash</option>
                <option value="card">Bank/Card</option>
              </select>
            </div>
            <div>
              <label className="label">Ref (optional)</label>
              <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. RBG6X…" />
            </div>
          </div>
        )}
        {type === 'delivery' && (
          <label className="flex items-center gap-3 rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
            <span className="text-sm font-medium text-brand-900 dark:text-white">Paid on the spot (otherwise it's owed)</span>
          </label>
        )}
        <div>
          <label className="label">Comment (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder='e.g. "Brian paid supplier at 9am"' />
        </div>
      </div>
      <button className="btn-primary mt-4 w-full" disabled={amount <= 0} onClick={save}>
        {type === 'delivery' ? 'Record delivery' : type === 'payment' ? `Pay ${money(amount, currency)}` : 'Record credit note'}
      </button>
    </Modal>
  )
}

function SupplierDetails({ supplier, onClose, onEdit }: { supplier: Supplier; onClose: () => void; onEdit: () => void }) {
  const currency = useStore((s) => s.settings.currency)
  const txns = useStore((s) => s.supplierTxns)
  const customers = useStore((s) => s.customers)

  const mine = useMemo(() => txns.filter((t) => t.supplierId === supplier.id).sort((a, b) => b.at - a.at), [txns, supplier.id])
  const bal = supplierBalance(txns, supplier.id)
  const linked = supplier.customerId ? customers.find((c) => c.id === supplier.customerId) : undefined

  return (
    <Modal open onClose={onClose} title={`${supplier.name} — record`}>
      <div className="mb-3 rounded-2xl bg-brand-50 p-4 dark:bg-brand-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-brand-900/50 dark:text-white/50">Balance</div>
            <div className={`text-2xl font-black ${bal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
              {bal > 0 ? `You owe ${money(bal, currency)}` : bal < 0 ? `${money(-bal, currency)} in your favour` : 'Settled ✓'}
            </div>
          </div>
          <button className="btn-ghost py-1.5 text-sm" onClick={onEdit}>
            <Pencil size={14} /> Edit
          </button>
        </div>
        <div className="mt-2 text-xs text-brand-900/60 dark:text-white/60">
          {displayPhone(supplier.phone)}
          {supplier.supplies ? ` · supplies ${supplier.supplies}` : ''}
          {linked ? ` · also your customer (${linked.name})` : ''}
          {supplier.note ? ` · ${supplier.note}` : ''}
        </div>
      </div>

      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-900/50 dark:text-white/50">History</h3>
      {mine.length === 0 ? (
        <p className="py-4 text-center text-sm text-brand-900/40 dark:text-white/40">No transactions yet — record a delivery or payment.</p>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {mine.map((t) => (
            <div key={t.id} className="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-900 dark:text-white">{TXN_LABEL[t.type]}</span>
                <span className={`text-sm font-black ${t.type === 'delivery' ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                  {t.type === 'delivery' ? '+' : '−'}{money(t.amount, currency)}
                </span>
              </div>
              <div className="text-[11px] text-brand-900/50 dark:text-white/50">
                {shortDateTime(t.at)} · by {t.byStaffName}
                {t.method ? ` · ${t.method === 'mpesa' ? 'M-PESA' : t.method === 'airtel' ? 'Airtel' : t.method}` : ''}
                {t.ref ? ` (${t.ref})` : ''}
              </div>
              {(t.items || t.note) && (
                <div className="mt-1 text-xs text-brand-900/70 dark:text-white/70">
                  {t.items && <span>{t.items}</span>}
                  {t.items && t.note && ' — '}
                  {t.note && <span className="italic">"{t.note}"</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button className="btn-ghost mt-4 w-full" onClick={onClose}>Close</button>
    </Modal>
  )
}
