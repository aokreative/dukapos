import { useMemo, useState } from 'react'
import { Search, PackagePlus, Pencil, Plus, Minus, AlertTriangle, Trash2, MapPin, Copy, CalendarClock, Image as ImageIcon } from 'lucide-react'
import { useStore, selectCurrentLocation } from '../store/useStore'
import { money } from '../lib/format'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import { stockAt, totalStock } from '../lib/stock'
import { bizLabels, getFeatures, UNITS } from '../lib/labels'
import type { FeatureFlags, Product } from '../types'

const DAY = 24 * 60 * 60 * 1000

/** Downscale a photo to a crisp square thumbnail (≈160px JPEG data URL, ~8–15KB)
 *  so product images look sharp on modern screens while staying fast and
 *  sync-friendly. */
export function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const size = 160
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      // cover-crop to square
      const s = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => resolve('')
    img.src = url
  })
}
/** 'expired' | 'soon' (≤90 days) | null */
function expiryState(p: Product): 'expired' | 'soon' | null {
  if (!p.expiryDate) return null
  const t = new Date(p.expiryDate + 'T00:00:00').getTime()
  if (isNaN(t)) return null
  if (t < Date.now()) return 'expired'
  if (t < Date.now() + 90 * DAY) return 'soon'
  return null
}

export default function Products() {
  const products = useStore((s) => s.products)
  const settings = useStore((s) => s.settings)
  const currency = settings.currency
  const labels = bizLabels(settings.businessType)
  const features = getFeatures(settings)
  const addProduct = useStore((s) => s.addProduct)
  const updateProduct = useStore((s) => s.updateProduct)
  const removeProduct = useStore((s) => s.removeProduct)
  const adjustStock = useStore((s) => s.adjustStock)
  const location = useStore(selectCurrentLocation)
  const locations = useStore((s) => s.locations)
  const locId = location?.id ?? 'loc_main'

  const [q, setQ] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)

  const isLow = (p: Product) => p.trackStock !== false && stockAt(p, locId) <= p.reorderLevel
  const lowCount = products.filter(isLow).length
  const expiringCount = features.expiry ? products.filter((p) => expiryState(p) !== null).length : 0

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return products
      .filter(
        (p) =>
          (!t || p.name.toLowerCase().includes(t) || p.sku.includes(t)) &&
          (!lowOnly || isLow(p)) &&
          (!expiringOnly || expiryState(p) !== null),
      )
      .sort((a, b) => (Number(isLow(b)) - Number(isLow(a))) || a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, q, lowOnly, expiringOnly, locId])

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
        {features.expiry && (
          <button className={`chip whitespace-nowrap px-4 ${expiringOnly ? 'bg-amber-500 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`} onClick={() => setExpiringOnly((v) => !v)}>
            <CalendarClock size={14} /> Expiring {expiringCount > 0 && `(${expiringCount})`}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<PackagePlus size={32} />} title={`No ${labels.items}`} hint={`Add ${labels.items} to start selling.`} />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const here = stockAt(p, locId)
            const elsewhere = totalStock(p) - here
            const low = isLow(p)
            const exp = features.expiry ? expiryState(p) : null
            return (
              <div key={p.id} className="card flex items-center gap-3 p-3">
                {p.thumb ? (
                  <img src={p.thumb} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-black text-brand-600 dark:bg-white/10 dark:text-gold-400">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-brand-900 dark:text-white">{p.name}</span>
                    {low && <Badge color="red">low</Badge>}
                    {exp === 'expired' && <Badge color="red">EXPIRED</Badge>}
                    {exp === 'soon' && <Badge color="amber">exp {p.expiryDate}</Badge>}
                    {p.trackStock === false && <Badge color="amber">no stock count</Badge>}
                  </div>
                  <div className="text-xs text-brand-900/50 dark:text-white/50">
                    {p.brand ? `${p.brand} · ` : ''}{p.category}{p.sku ? ` · SKU ${p.sku}` : ''} · {money(p.price, currency)}
                    {p.unit && p.unit !== 'pc' ? `/${p.unit}` : ''}
                    {features.wholesale && p.wholesalePrice ? ` · WS ${money(p.wholesalePrice, currency)}@${p.wholesaleMinQty ?? 12}+` : ''}
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
                <button
                  className="rounded-lg p-2 text-brand-900/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
                  title="Duplicate (for sizes/colours/variants)"
                  onClick={() => {
                    const { id, ...rest } = p
                    void id
                    addProduct({ ...rest, name: `${p.name} (copy)`, stockByLocation: {} })
                  }}
                >
                  <Copy size={15} />
                </button>
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
          itemLabel={labels.item}
          features={features}
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
  features,
  onClose,
  onSave,
  onDelete,
}: {
  product: Product | null
  locId: string
  locationName?: string
  itemLabel: string
  features: FeatureFlags
  onClose: () => void
  onSave: (data: {
    name: string
    sku: string
    category: string
    price: number
    cost: number
    stock: number
    reorderLevel: number
    trackStock: boolean
    unit?: string
    thumb?: string
    brand?: string
    variants?: string[]
    wholesalePrice?: number
    wholesaleMinQty?: number
    expiryDate?: string
    warrantyMonths?: number
  }) => void
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
  const [unit, setUnit] = useState<string>(product?.unit ?? 'pc')
  const [thumb, setThumb] = useState<string>(product?.thumb ?? '')
  const [brand, setBrand] = useState<string>(product?.brand ?? '')
  const [variants, setVariants] = useState<string>((product?.variants ?? []).join(', '))
  const all = useStore((s) => s.products)
  const existingCategories = useMemo(() => [...new Set(all.map((p) => p.category).filter(Boolean))].sort(), [all])
  const existingBrands = useMemo(() => [...new Set(all.map((p) => p.brand).filter((b): b is string => !!b))].sort(), [all])
  const [wholesalePrice, setWholesalePrice] = useState<number>(product?.wholesalePrice ?? 0)
  const [wholesaleMinQty, setWholesaleMinQty] = useState<number>(product?.wholesaleMinQty ?? 12)
  const [expiryDate, setExpiryDate] = useState<string>(product?.expiryDate ?? '')
  const [warrantyMonths, setWarrantyMonths] = useState<number>(product?.warrantyMonths ?? 0)
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
            <label className="label">Brand (optional)</label>
            <input className="input" list="duka-brands" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. HikVision" />
            <datalist id="duka-brands">
              {existingBrands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
        </div>
        <div>
          <label className="label">Category (pick one or type a new one)</label>
          <input className="input" list="duka-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Groceries" />
          <datalist id="duka-categories">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sold by</label>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u === 'pc' ? 'piece (pc)' : u}</option>
              ))}
            </select>
          </div>
          <div className="self-end pb-2 text-xs text-brand-900/40 dark:text-white/40">
            {unit !== 'pc' ? `Price is per ${unit}; the till accepts decimals (e.g. 0.5 ${unit}).` : 'Whole pieces at the till. Sell by kg/m/L by picking a unit.'}
          </div>
        </div>
        <div>
          <label className="label">Photo (optional)</label>
          <div className="flex items-center gap-3">
            {thumb ? (
              <img src={thumb} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/15" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-black/5 text-brand-900/30 dark:bg-white/10 dark:text-white/30">
                <ImageIcon size={22} />
              </div>
            )}
            <label className="btn-ghost cursor-pointer py-2 text-sm">
              {thumb ? 'Change photo' : '📷 Add photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) setThumb(await shrinkImage(f))
                }}
              />
            </label>
            {thumb && (
              <button className="text-xs text-red-500 underline" onClick={() => setThumb('')}>remove</button>
            )}
          </div>
        </div>
        <div>
          <label className="label">Variations (optional) — colours / sizes</label>
          <input className="input" value={variants} onChange={(e) => setVariants(e.target.value)} placeholder="e.g. Red, Blue, Black  ·  or  S, M, L, XL" />
          <p className="mt-1 text-xs text-brand-900/50 dark:text-white/50">Separate with commas. At the till, the cashier picks one and it's printed on the receipt.</p>
        </div>
        {features.wholesale && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Wholesale price (optional)</label>
              <input className="input" inputMode="decimal" value={wholesalePrice || ''} onChange={(e) => setWholesalePrice(parseFloat(e.target.value) || 0)} placeholder="applies at qty…" />
            </div>
            <div>
              <label className="label">…from qty</label>
              <input className="input" inputMode="numeric" value={wholesaleMinQty || ''} onChange={(e) => setWholesaleMinQty(parseInt(e.target.value) || 0)} placeholder="12" />
            </div>
          </div>
        )}
        {(features.expiry || features.warranty) && (
          <div className="grid grid-cols-2 gap-3">
            {features.expiry && (
              <div>
                <label className="label">Expiry date (optional)</label>
                <input className="input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            )}
            {features.warranty && (
              <div>
                <label className="label">Warranty months (optional)</label>
                <input className="input" inputMode="numeric" value={warrantyMonths || ''} onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 0)} placeholder="e.g. 12" />
              </div>
            )}
          </div>
        )}
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
        <button
          className="btn-primary flex-1"
          disabled={!valid}
          onClick={() =>
            onSave({
              name: name.trim(),
              sku: sku.trim(),
              category: category.trim() || 'Other',
              price,
              cost,
              stock,
              reorderLevel,
              trackStock,
              unit: unit !== 'pc' ? unit : undefined,
              thumb: thumb || undefined,
              brand: brand.trim() || undefined,
              variants: variants.split(',').map((v) => v.trim()).filter(Boolean).length
                ? variants.split(',').map((v) => v.trim()).filter(Boolean)
                : undefined,
              wholesalePrice: features.wholesale && wholesalePrice > 0 ? wholesalePrice : undefined,
              wholesaleMinQty: features.wholesale && wholesalePrice > 0 ? wholesaleMinQty || 12 : undefined,
              expiryDate: features.expiry && expiryDate ? expiryDate : undefined,
              warrantyMonths: features.warranty && warrantyMonths > 0 ? warrantyMonths : undefined,
            })
          }
        >
          Save
        </button>
      </div>
    </Modal>
  )
}
