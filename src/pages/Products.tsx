import { useMemo, useState } from 'react'
import { Search, PackagePlus, Pencil, Plus, Minus, AlertTriangle, Trash2, MapPin } from 'lucide-react'
import { useStore, selectCurrentLocation } from '../store/useStore'
import { money } from '../lib/format'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import { stockAt, totalStock } from '../lib/stock'
import { bizLabels } from '../lib/labels'
import type { Product } from '../types'

export default function Products() {
  const products = useStore((s) => s.products)
  const currency = useStore((s) => s.settings.currency)
  const labels = bizLabels(useStore((s) => s.settings.businessType))
  const addProduct = useStore((s) => s.addProduct)
  const updateProduct = useStore((s) => s.updateProduct)
  const removeProduct = useStore((s) => s.removeProduct)
  const adjustStock = useStore((s) => s.adjustStock)
  const location = useStore(selectCurrentLocation)
  const locations = useStore((s) => s.locations)
  const locId = location?.id ?? 'loc_main'

  const [q, setQ] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)

  const isLow = (p: Product) => p.trackStock !== false && stockAt(p, locId) <= p.reorderLevel
  const lowCount = products.filter(isLow).length

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return products
      .filter((p) => (!t || p.name.toLowerCase().includes(t) || p.sku.includes(t)) && (!lowOnly || isLow(p)))
      .sort((a, b) => (Number(isLow(b)) - Number(isLow(a))) || a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, q, lowOnly, locId])

  return (
    <div>
      <PageHeader
        title={labels.stock}
        subtitle={
          locations.length > 1
            ? `${products.length} ${labels.items} · showing stock at ${location?.name ?? 'this branch'}`
            : `${products.length} ${labels.items}`
        }
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <PackagePlus size={18} /> {labels.addLabel}
          </button>
        }
      />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={18} />
          <input className="input pl-10" placeholder={`Search ${labels.items} or SKU`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className={`chip whitespace-nowrap px-4 ${lowOnly ? 'bg-red-500 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`} onClick={() => setLowOnly((v) => !v)}>
          <AlertTriangle size={14} /> Low {lowCount > 0 && `(${lowCount})`}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<PackagePlus size={32} />} title={`No ${labels.items}`} hint={`Add ${labels.items} to start selling.`} />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const here = stockAt(p, locId)
            const elsewhere = totalStock(p) - here
            const low = isLow(p)
            return (
              <div key={p.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-brand-900 dark:text-white">{p.name}</span>
                    {low && <Badge color="red">low</Badge>}
                    {p.trackStock === false && <Badge color="amber">no stock count</Badge>}
                  </div>
                  <div className="text-xs text-brand-900/50 dark:text-white/50">
                    {p.category} · SKU {p.sku} · {money(p.price, currency)}
                    {locations.length > 1 && elsewhere > 0 && p.trackStock !== false && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-brand-600 dark:text-gold-400"><MapPin size={10} /> +{elsewhere} elsewhere</span>
                    )}
                  </div>
                </div>
                {p.trackStock !== false && (
                  <div className="flex items-center gap-1">
                    <button className="rounded-lg bg-black/5 p-2 dark:bg-white/10" onClick={() => adjustStock(p.id, -1)} aria-label="Decrease">
                      <Minus size={14} />
                    </button>
                    <span className={`w-10 text-center font-bold ${low ? 'text-red-600 dark:text-red-400' : 'text-brand-900 dark:text-white'}`}>{here}</span>
                    <button className="rounded-lg bg-black/5 p-2 dark:bg-white/10" onClick={() => adjustStock(p.id, 1)} aria-label="Increase">
                      <Plus size={14} />
                    </button>
                  </div>
                )}
                <button className="rounded-lg p-2 text-brand-900/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10" onClick={() => setEditing(p)}>
                  <Pencil size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {(creating || editing) && (
        <ProductForm
          product={editing}
          locId={locId}
          locationName={location?.name}
          itemLabel={bizLabels(useStore.getState().settings.businessType).item}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={(data) => {
            const { stock, ...rest } = data
            if (editing) {
              updateProduct(editing.id, { ...rest, stockByLocation: { ...editing.stockByLocation, [locId]: stock } })
            } else {
              addProduct({ ...rest, stockByLocation: { [locId]: stock }, active: true })
            }
            setCreating(false)
            setEditing(null)
          }}
          onDelete={
            editing
              ? () => {
                  removeProduct(editing.id)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function ProductForm({
  product,
  locId,
  locationName,
  itemLabel,
  onClose,
  onSave,
  onDelete,
}: {
  product: Product | null
  locId: string
  locationName?: string
  itemLabel: string
  onClose: () => void
  onSave: (data: { name: string; sku: string; category: string; price: number; cost: number; stock: number; reorderLevel: number; trackStock: boolean }) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [category, setCategory] = useState(product?.category ?? 'Groceries')
  const [price, setPrice] = useState<number>(product?.price ?? 0)
  const [cost, setCost] = useState<number>(product?.cost ?? 0)
  const [stock, setStock] = useState<number>(product ? stockAt(product, locId) : 0)
  const [reorderLevel, setReorder] = useState<number>(product?.reorderLevel ?? 5)
  const [trackStock, setTrackStock] = useState<boolean>(product?.trackStock !== false)
  const valid = name.trim() && price >= 0

  return (
    <Modal open onClose={onClose} title={product ? `Edit ${itemLabel.toLowerCase()}` : `New ${itemLabel.toLowerCase()}`}>
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sugar 1kg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">SKU / Barcode</label>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="6001" />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Groceries" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Selling price</label>
            <input className="input" inputMode="decimal" value={price || ''} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Buying price</label>
            <input className="input" inputMode="decimal" value={cost || ''} onChange={(e) => setCost(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
          <span className="text-sm font-medium text-brand-900 dark:text-white">Count stock for this item <span className="text-brand-900/50 dark:text-white/50">(turn off for made-to-order dishes)</span></span>
        </label>
        {trackStock && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stock{locationName ? ` at ${locationName}` : ' on hand'}</label>
              <input className="input" inputMode="numeric" value={stock || ''} onChange={(e) => setStock(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label">Reorder at</label>
              <input className="input" inputMode="numeric" value={reorderLevel || ''} onChange={(e) => setReorder(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        {onDelete && (
          <button className="btn-danger" onClick={onDelete} aria-label="Delete">
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn-primary flex-1" disabled={!valid} onClick={() => onSave({ name: name.trim(), sku: sku.trim(), category: category.trim() || 'Other', price, cost, stock, reorderLevel, trackStock })}>
          Save
        </button>
      </div>
    </Modal>
  )
}
