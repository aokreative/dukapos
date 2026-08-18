import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, PackagePlus, Pencil, Plus, Minus, AlertTriangle, Trash2, MapPin, Copy, CalendarClock, Image as ImageIcon, Truck } from 'lucide-react'
import { useStore, selectCurrentLocation } from '../store/useStore'
import { money } from '../lib/format'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import { stockAt, totalStock } from '../lib/stock'
import { bizLabels, getFeatures, productFields, UNITS } from '../lib/labels'
import type { FeatureFlags, Product } from '../types'

const DAY = 24 * 60 * 60 * 1000

/** Downscale a photo to a crisp square thumbnail (≈256px JPEG data URL) so
 *  product images look sharp on the bigger till tiles while staying fast and
 *  sync-friendly. */
export function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const size = 256
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
  const navigate = useNavigate()
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
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => navigate('/suppliers')} title="Add stock from a supplier and record the purchase">
              <Truck size={18} /> <span className="hidden sm:inline">Receive delivery</span>
            </button>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <PackagePlus size={18} /> {labels.addLabel}
            </button>
          </div>
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
                  <img src={p.thumb} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10" />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-black text-brand-600 dark:bg-white/10 dark:text-gold-400">
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
    sizes?: string[]
    colors?: string[]
    compatibility?: string
    batchNumber?: string
    prescription?: boolean
  }) => void
  onDelete?: () => void
}) {
  // Fields tailored to the shop's trade — a restaurant never sees brand or
  // barcode; a boutique gets sizes & colours. Editing an item that already has
  // a hidden field's value keeps that field visible so nothing is stranded.
  const bizType = useStore((s) => s.settings.businessType)
  const pf = productFields(bizType)
  const showSku = pf.sku || !!product?.sku
  const showBrand = pf.brand || !!product?.brand
  const showVariants = pf.variants || !!(product?.variants && product.variants.length)
  const showUnit = pf.unit || !!(product?.unit && product.unit !== 'pc')

  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [price, setPrice] = useState<number>(product?.price ?? 0)
  const [cost, setCost] = useState<number>(product?.cost ?? 0)
  const [stock, setStock] = useState<number>(product ? stockAt(product, locId) : 0)
  const [reorderLevel, setReorder] = useState<number>(product?.reorderLevel ?? 5)
  // New restaurant dishes are made to order — stock counting off by default.
  const [trackStock, setTrackStock] = useState<boolean>(
    product ? product.trackStock !== false : useStore.getState().settings.businessType !== 'restaurant',
  )
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
  
  const [sizes, setSizes] = useState<string>((product?.sizes ?? []).join(', '))
  const [colors, setColors] = useState<string>((product?.colors ?? []).join(', '))
  const [compatibility, setCompatibility] = useState<string>(product?.compatibility ?? '')
  const [batchNumber, setBatchNumber] = useState<string>(product?.batchNumber ?? '')
  const [prescription, setPrescription] = useState<boolean>(product?.prescription ?? false)

  const valid = name.trim() && price >= 0

  return (
    <Modal open onClose={onClose} title={product ? `Edit ${itemLabel.toLowerCase()}` : `New ${itemLabel.toLowerCase()}`}>
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={pf.namePlaceholder} />
        </div>
        {(showSku || showBrand) && (
          <div className={showSku && showBrand ? 'grid grid-cols-2 gap-3' : ''}>
            {showSku && (
              <div>
                <label className="label">{pf.skuLabel}</label>
                <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="6001" />
              </div>
            )}
            {showBrand && (
              <div>
                <label className="label">{pf.brandLabel}</label>
                <input className="input" list="duka-brands" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={pf.brandPlaceholder} />
                <datalist id="duka-brands">
                  {existingBrands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
            )}
          </div>
        )}
        <div>
          <label className="label">Category (pick one or type a new one)</label>
          <input className="input" list="duka-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={pf.categoryPlaceholder} />
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
            <label className="label">{pf.costLabel}</label>
            <input className="input" inputMode="decimal" value={cost || ''} onChange={(e) => setCost(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        {showUnit && (
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
        )}
        <div>
          <label className="label">Photo (optional)</label>
          <div className="flex items-center gap-3">
            {thumb ? (
              <img src={thumb} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/15" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-black/5 text-brand-900/30 dark:bg-white/10 dark:text-white/30">
                <ImageIcon size={24} />
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
        {showVariants && (
          <div>
            <label className="label">{pf.variantsLabel}</label>
            <input className="input" value={variants} onChange={(e) => setVariants(e.target.value)} placeholder={pf.variantsPlaceholder} />
            <p className="mt-1 text-xs text-brand-900/50 dark:text-white/50">Separate with commas. At the till, the cashier picks one and it's printed on the receipt.</p>
          </div>
        )}
        {(pf.sizes || pf.colors) && (
          <div className="grid grid-cols-2 gap-3">
            {pf.sizes && (
              <div>
                <label className="label">{pf.sizesLabel}</label>
                <input className="input" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder={pf.sizesPlaceholder} />
                <p className="mt-1 text-xs text-brand-900/50 dark:text-white/50">Separate with commas.</p>
              </div>
            )}
            {pf.colors && (
              <div>
                <label className="label">{pf.colorsLabel}</label>
                <input className="input" value={colors} onChange={(e) => setColors(e.target.value)} placeholder={pf.colorsPlaceholder} />
                <p className="mt-1 text-xs text-brand-900/50 dark:text-white/50">Separate with commas.</p>
              </div>
            )}
          </div>
        )}
        {pf.compatibility && (
          <div>
            <label className="label">{pf.compatibilityLabel}</label>
            <input className="input" value={compatibility} onChange={(e) => setCompatibility(e.target.value)} placeholder={pf.compatibilityPlaceholder} />
            <p className="mt-1 text-xs text-brand-900/50 dark:text-white/50">Describe what this part fits. Staff can search for "Corolla 2018" at the till.</p>
          </div>
        )}
        {(pf.batchNumber || pf.prescription) && (
          <div className="grid grid-cols-2 gap-3">
            {pf.batchNumber && (
              <div>
                <label className="label">Batch number</label>
                <input className="input" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="e.g. BATCH-A001" />
              </div>
            )}
            {pf.prescription && (
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={prescription} onChange={(e) => setPrescription(e.target.checked)} />
                  <span className="font-medium">Prescription only</span>
                </label>
              </div>
            )}
          </div>
        )}
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
        <label className="flex items-start gap-3 rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
          <span className="text-sm">
            <span className="block font-medium text-brand-900 dark:text-white">Count stock for this item</span>
            <span className="block text-xs text-brand-900/50 dark:text-white/50">
              ON: the app keeps a running quantity and shows “X left”, warns when low, and deducts one on every sale.
              Turn OFF for things you never count — a cooked meal, a service (haircut, repair), or airtime — so it sells without a stock number.
            </span>
          </span>
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
              sizes: pf.sizes && sizes ? sizes.split(',').map((v) => v.trim()).filter(Boolean) : undefined,
              colors: pf.colors && colors ? colors.split(',').map((v) => v.trim()).filter(Boolean) : undefined,
              compatibility: pf.compatibility && compatibility.trim() ? compatibility.trim() : undefined,
              batchNumber: pf.batchNumber && batchNumber.trim() ? batchNumber.trim() : undefined,
              prescription: pf.prescription && prescription ? true : undefined,
            })
          }
        >
          Save
        </button>
      </div>
    </Modal>
  )
}
