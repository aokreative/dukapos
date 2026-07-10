// Suppliers — who the shop buys from: wholesalers, farmers, or the neighbor
// next door. Tracks deliveries (what you owe), payments, and credit notes.
// A supplier can be linked to a customer record (customers who also supply).
// Deliveries are itemised: pick catalog items or register brand-new products
// on the spot, with per-delivery buying prices — stock & costs update live.
import { useMemo, useState } from 'react'
import { Truck, Plus, Wallet, ChevronRight, PackageOpen, FileMinus2, Pencil, Trash2, UserRound, Link2, Search, PackagePlus } from 'lucide-react'
import { useStore, supplierBalance, selectRole, selectCurrentLocation } from '../store/useStore'
import { money, displayPhone, normalizePhone, shortDateTime } from '../lib/format'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import { can } from '../lib/permissions'
import { stockAt } from '../lib/stock'
import type { DeliveryLine, PaymentMethod, Supplier, SupplierTxnType } from '../types'

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

  const role = useStore(selectRole)
  const canManage = can(role, 'manageSuppliers')

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [txnFor, setTxnFor] = useState<{ supplier: Supplier; type: SupplierTxnType } | null>(null)
  const [deliveryFor, setDeliveryFor] = useState<Supplier | null>(null)
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
          canManage ? (
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={18} /> Add supplier
            </button>
          ) : undefined
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

                <div className={`mt-3 grid gap-2 ${canManage ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  <button className="btn-ghost py-2 text-xs sm:text-sm" onClick={() => setDeliveryFor(s)}>
                    <PackageOpen size={15} /> Delivery
                  </button>
                  {canManage && (
                    <button className="btn-ghost py-2 text-xs sm:text-sm" onClick={() => setTxnFor({ supplier: s, type: 'payment' })}>
                      <Wallet size={15} /> Pay
                    </button>
                  )}
                  {canManage && (
                    <button className="btn-ghost py-2 text-xs sm:text-sm" onClick={() => setTxnFor({ supplier: s, type: 'creditNote' })}>
                      <FileMinus2 size={15} /> Credit note
                    </button>
                  )}
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
      {deliveryFor && <DeliveryModal supplier={deliveryFor} onClose={() => setDeliveryFor(null)} />}
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
  const [note, setNote] = useState('')

  function save() {
    if (amount <= 0) return
    addSupplierTxn({
      supplierId: supplier.id,
      type,
      amount,
      method: type === 'payment' ? method : undefined,
      ref: ref.trim() || undefined,
      note: note.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={type === 'payment' ? `Pay ${supplier.name}` : `Credit note — ${supplier.name}`}>
      {type === 'payment' && bal > 0 && (
        <p className="mb-2 text-sm text-brand-900/60 dark:text-white/60">You currently owe {money(bal, currency)}.</p>
      )}
      {type === 'creditNote' && (
        <p className="mb-2 text-sm text-brand-900/60 dark:text-white/60">
          Goods returned to the supplier or an agreed reduction — it reduces what you owe them.
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label className="label">Amount ({currency})</label>
          <input autoFocus className="input" inputMode="decimal" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
        </div>
        {type === 'payment' && (
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
        <div>
          <label className="label">Comment (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder='e.g. "Brian paid supplier at 9am"' />
        </div>
      </div>
      <button className="btn-primary mt-4 w-full" disabled={amount <= 0} onClick={save}>
        {type === 'payment' ? `Pay ${money(amount, currency)}` : 'Record credit note'}
      </button>
    </Modal>
  )
}

/**
 * Itemised goods-in. The receiver picks catalog items — or registers a brand
 * new product on the spot (name, model, prices) — sets how many pieces and
 * the buying price for THIS delivery (prices change over time), and stock at
 * this branch plus the product's cost update automatically.
 */
function DeliveryModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const currency = useStore((s) => s.settings.currency)
  const products = useStore((s) => s.products)
  const location = useStore(selectCurrentLocation)
  const receiveDelivery = useStore((s) => s.receiveDelivery)

  const [q, setQ] = useState('')
  const [lines, setLines] = useState<DeliveryLine[]>([])
  const [newProduct, setNewProduct] = useState(false)
  const [paidNow, setPaidNow] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return products
      .filter((p) => p.active && (p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)))
      .filter((p) => !lines.some((l) => l.productId === p.id))
      .slice(0, 6)
  }, [products, q, lines])

  const total = Math.round(lines.reduce((a, l) => a + l.qty * l.unitCost, 0) * 100) / 100

  function addLine(p: { id: string; name: string; cost: number }, qty = 1, unitCost?: number) {
    setLines((ls) => [...ls, { productId: p.id, name: p.name, qty, unitCost: unitCost ?? p.cost }])
    setQ('')
  }
  function patchLine(id: string, patch: Partial<DeliveryLine>) {
    setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, ...patch } : l)))
  }

  return (
    <Modal open onClose={onClose} title={`Delivery from ${supplier.name}`}>
      <p className="-mt-1 mb-2 text-xs text-brand-900/50 dark:text-white/50">
        Goods land at <span className="font-semibold">{location?.name ?? 'this branch'}</span>. Buying prices you enter here update the item's cost.
      </p>

      {/* Find existing items */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={16} />
        <input className="input py-2 pl-9 text-sm" placeholder="Search your items to add…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {matches.length > 0 && (
        <div className="mt-1 space-y-1">
          {matches.map((p) => (
            <button key={p.id} className="flex w-full items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-left text-sm hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15" onClick={() => addLine(p)}>
              <span className="font-medium text-brand-900 dark:text-white">{p.name}</span>
              <span className="text-xs text-brand-900/50 dark:text-white/50">
                {stockAt(p, location?.id ?? '')} here · last cost {money(p.cost, currency)}
              </span>
            </button>
          ))}
        </div>
      )}

      <button className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-600 underline dark:text-gold-400" onClick={() => setNewProduct(true)}>
        <PackagePlus size={13} /> New product (not in your list yet)
      </button>

      {/* Lines */}
      {lines.length > 0 && (
        <div className="mt-3 space-y-2">
          {lines.map((l) => (
            <div key={l.productId} className="rounded-xl border border-black/10 p-2.5 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-brand-900 dark:text-white">{l.name}</span>
                <button className="text-xs text-red-500 underline" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))}>remove</button>
              </div>
              <div className="mt-1.5 grid grid-cols-3 items-end gap-2">
                <div>
                  <label className="label text-[10px]">Pieces</label>
                  <input className="input py-1.5 text-sm" inputMode="numeric" value={l.qty || ''} onChange={(e) => patchLine(l.productId, { qty: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label text-[10px]">Buying price @</label>
                  <input className="input py-1.5 text-sm" inputMode="decimal" value={l.unitCost || ''} onChange={(e) => patchLine(l.productId, { unitCost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="pb-1.5 text-right text-sm font-bold text-brand-900 dark:text-white">{money(l.qty * l.unitCost, currency)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total + payment */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5 dark:bg-brand-900">
        <span className="text-sm font-semibold text-brand-900/70 dark:text-white/70">Delivery total</span>
        <span className="text-lg font-black text-brand-700 dark:text-gold-400">{money(total, currency)}</span>
      </div>
      <label className="mt-2 flex items-center gap-3 rounded-xl bg-black/5 px-3 py-2.5 dark:bg-white/10">
        <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
        <span className="text-sm font-medium text-brand-900 dark:text-white">Paid on the spot (otherwise it's owed)</span>
      </label>
      {paidNow && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select className="input py-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="mpesa">M-PESA</option>
            <option value="airtel">Airtel Money</option>
            <option value="cash">Cash</option>
            <option value="card">Bank/Card</option>
          </select>
          <input className="input py-2 text-sm" placeholder="Ref (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
      )}
      <input className="input mt-2 py-2 text-sm" placeholder='Comment (optional) — e.g. "Wambui collected at 5pm"' value={note} onChange={(e) => setNote(e.target.value)} />

      <button
        className="btn-primary mt-4 w-full"
        disabled={total <= 0 || lines.some((l) => l.qty <= 0)}
        onClick={() => {
          receiveDelivery({
            supplierId: supplier.id,
            lines,
            paidNow: paidNow ? { method, ref: ref.trim() || undefined } : undefined,
            note: note.trim() || undefined,
          })
          onClose()
        }}
      >
        <PackageOpen size={18} /> Receive {lines.reduce((a, l) => a + l.qty, 0)} piece{lines.reduce((a, l) => a + l.qty, 0) !== 1 ? 's' : ''} · {money(total, currency)}
      </button>

      {newProduct && (
        <NewProductInline
          onClose={() => setNewProduct(false)}
          onCreate={(p, qty, buyPrice) => {
            addLine({ id: p.id, name: p.name, cost: buyPrice }, qty, buyPrice)
            setNewProduct(false)
          }}
        />
      )}
    </Modal>
  )
}

/** Register a product that isn't in the catalog yet, right at goods-in. */
function NewProductInline({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (p: { id: string; name: string }, qty: number, buyPrice: number) => void
}) {
  const addProduct = useStore((s) => s.addProduct)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('General')
  const [qty, setQty] = useState(1)
  const [buyPrice, setBuyPrice] = useState(0)
  const [sellPrice, setSellPrice] = useState(0)

  const valid = name.trim() && qty > 0 && buyPrice >= 0 && sellPrice >= 0

  return (
    <Modal open onClose={onClose} title="New product from this delivery">
      <div className="space-y-3">
        <div>
          <label className="label">Product name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HikVision Dome Camera 2MP" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Model / SKU (optional)</label>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. DS-2CE76D0T" />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Cameras" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Pieces</label>
            <input className="input" inputMode="numeric" value={qty || ''} onChange={(e) => setQty(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Buying @</label>
            <input className="input" inputMode="decimal" value={buyPrice || ''} onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Selling @</label>
            <input className="input" inputMode="decimal" value={sellPrice || ''} onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </div>
      <button
        className="btn-primary mt-4 w-full"
        disabled={!valid}
        onClick={() => {
          const p = addProduct({
            name: name.trim(),
            sku: sku.trim(),
            category: category.trim() || 'General',
            price: sellPrice,
            cost: buyPrice,
            stockByLocation: {}, // stock arrives via the delivery itself
            reorderLevel: 2,
            active: true,
            trackStock: true,
          })
          onCreate(p, qty, buyPrice)
        }}
      >
        Add to delivery
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
              {t.lines && t.lines.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs text-brand-900/70 dark:text-white/70">
                  {t.lines.map((l, i) => (
                    <li key={i}>
                      {l.qty}× {l.name} <span className="text-brand-900/40 dark:text-white/40">@ {money(l.unitCost, currency)}</span>
                    </li>
                  ))}
                  {t.note && <li className="italic">"{t.note}"</li>}
                </ul>
              ) : (
                (t.items || t.note) && (
                  <div className="mt-1 text-xs text-brand-900/70 dark:text-white/70">
                    {t.items && <span>{t.items}</span>}
                    {t.items && t.note && ' — '}
                    {t.note && <span className="italic">"{t.note}"</span>}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <button className="btn-ghost mt-4 w-full" onClick={onClose}>Close</button>
    </Modal>
  )
}
