import { useMemo, useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Tag, RotateCcw, PauseCircle, Zap } from 'lucide-react'
import { useStore } from '../store/useStore'
import { money } from '../lib/format'
import type { CartLine, Product, Sale, Tender } from '../types'
import PaymentModal from '../components/PaymentModal'
import Receipt from '../components/Receipt'
import ReturnModal from '../components/ReturnModal'
import { Modal, EmptyState } from '../components/ui'
import { useBilling } from '../components/Billing'
import { selectRole } from '../store/useStore'
import { can } from '../lib/permissions'
import { submitEtimsInvoice } from '../lib/api'
import { stockAt } from '../lib/stock'
import { bizLabels, getFeatures } from '../lib/labels'
import { uid } from '../lib/id'

/** Cart identity: a product plus its chosen variation (so Red and Blue are
 *  separate lines). */
const lineKey = (l: { productId: string; variant?: string }) => l.productId + '␟' + (l.variant ?? '')

export default function POS() {
  const products = useStore((s) => s.products)
  const completeSale = useStore((s) => s.completeSale)
  const currency = useStore((s) => s.settings.currency)
  const { billing } = useBilling()
  const held = !billing.canSell
  const role = useStore(selectRole)
  const canDiscount = can(role, 'applyDiscount')
  const canRefund = can(role, 'voidRefund')
  const locId = useStore((s) => s.currentLocationId)
  const exchangeCredit = useStore((s) => s.exchangeCredit)
  const clearExchangeCredit = useStore((s) => s.clearExchangeCredit)
  const settings = useStore((s) => s.settings)
  const labels = bizLabels(settings.businessType)
  const features = getFeatures(settings)
  const parkedCarts = useStore((s) => s.parkedCarts)
  const parkCart = useStore((s) => s.parkCart)
  const removeParkedCart = useStore((s) => s.removeParkedCart)
  const [returnOpen, setReturnOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [variantFor, setVariantFor] = useState<Product | null>(null)

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [payOpen, setPayOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.category)))], [products])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return products.filter((p) => {
      if (!p.active) return false
      if (cat !== 'All' && p.category !== cat) return false
      if (!t) return true
      return p.name.toLowerCase().includes(t) || p.sku.includes(t)
    })
  }, [products, q, cat])

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  // Exchange credit (from a return) reduces what the customer pays now.
  const total = Math.max(0, subtotal - discount - exchangeCredit)
  const count = cart.reduce((s, l) => s + l.qty, 0)

  /** The price for a given quantity — wholesale tier kicks in automatically. */
  function priceFor(p: Product, qty: number): { price: number; wholesale: boolean } {
    if (features.wholesale && p.wholesalePrice && qty >= (p.wholesaleMinQty ?? 12)) {
      return { price: p.wholesalePrice, wholesale: true }
    }
    return { price: p.price, wholesale: false }
  }

  function add(p: Product, variant?: string) {
    // A product with variations asks the cashier to pick one first.
    if (p.variants && p.variants.length > 0 && variant === undefined) {
      setVariantFor(p)
      return
    }
    const k = lineKey({ productId: p.id, variant })
    setCart((c) => {
      const found = c.find((l) => lineKey(l) === k)
      if (found) {
        const qty = found.qty + 1
        const { price, wholesale } = priceFor(p, qty)
        return c.map((l) => (lineKey(l) === k ? { ...l, qty, price, wholesale } : l))
      }
      const { price, wholesale } = priceFor(p, 1)
      return [
        ...c,
        {
          productId: p.id,
          name: variant ? `${p.name} · ${variant}` : p.name,
          variant,
          price,
          qty: 1,
          wholesale,
          unit: p.unit && p.unit !== 'pc' ? p.unit : undefined,
          warrantyMonths: features.warranty ? p.warrantyMonths : undefined,
        },
      ]
    })
  }
  function setQty(key: string, qty: number) {
    setCart((c) => {
      if (qty <= 0) return c.filter((l) => lineKey(l) !== key)
      return c.map((l) => {
        if (lineKey(l) !== key) return l
        const p = products.find((x) => x.id === l.productId)
        const { price, wholesale } = p ? priceFor(p, qty) : { price: l.price, wholesale: l.wholesale ?? false }
        return { ...l, qty, price, wholesale }
      })
    })
  }
  function clearCart() {
    setCart([])
    setDiscount(0)
  }

  // Scanner support: a barcode scanner "types" the code then presses Enter.
  // Exact SKU match → straight into the cart, ready for the next scan.
  function onSearchEnter() {
    const t = q.trim().toLowerCase()
    if (!t) return
    const exact = products.find((p) => p.active && p.sku.toLowerCase() === t)
    if (exact) {
      add(exact)
      setQ('')
    }
  }

  function park() {
    if (cart.length === 0) return
    parkCart(cart, discount)
    clearCart()
    setCartOpen(false)
  }
  function resume(id: string) {
    const entry = parkedCarts.find((p) => p.id === id)
    if (!entry) return
    // If something is already in the cart, park it first — nothing is lost.
    if (cart.length > 0) parkCart(cart, discount)
    setCart(entry.lines)
    setDiscount(entry.discount)
    removeParkedCart(id)
  }

  function onComplete(tenders: Tender[], customerId?: string, extras?: { assignedToName?: string; note?: string }) {
    const sale = completeSale({ lines: cart, discount, tenders, customerId, ...extras })
    // KRA eTIMS: submit the invoice in the background when enabled.
    const st = useStore.getState().settings
    if (st.etimsEnabled) {
      const vat = st.vatEnabled ? Math.round((sale.total * st.vatRate) / (100 + st.vatRate)) : 0
      void submitEtimsInvoice({
        receiptNo: sale.receiptNo,
        total: sale.total,
        vat,
        at: sale.createdAt,
        lines: sale.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
      })
    }
    setLastSale(sale)
    setPayOpen(false)
    setCartOpen(false)
    clearCart()
    setReceiptOpen(true)
  }

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-6">
      {/* Products */}
      <div>
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={18} />
            <input
              autoFocus
              className="input pl-10"
              placeholder={labels.searchHint}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearchEnter()
              }}
            />
          </div>
          <button className="btn-ghost whitespace-nowrap px-3" title="Sell something not in your list" onClick={() => setQuickOpen(true)}>
            <Zap size={17} /> <span className="hidden sm:inline">Quick item</span>
          </button>
          {canRefund && (
            <button className="btn-ghost whitespace-nowrap px-3" title="Return / exchange goods" onClick={() => setReturnOpen(true)}>
              <RotateCcw size={17} /> <span className="hidden sm:inline">Return</span>
            </button>
          )}
        </div>
        {exchangeCredit > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-gold-500/15 px-3 py-2 text-sm font-semibold text-gold-600 dark:text-gold-400">
            <span>Exchange credit: {money(exchangeCredit, currency)} — applies to the next sale automatically</span>
            <button className="text-xs underline" onClick={clearExchangeCredit}>dismiss</button>
          </div>
        )}
        {parkedCarts.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {parkedCarts.map((p) => (
              <button key={p.id} className="chip bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300" onClick={() => resume(p.id)}>
                <PauseCircle size={13} /> Waiting: {p.lines[0]?.name.slice(0, 14)}{p.lines.length > 1 ? ` +${p.lines.length - 1}` : ''} · {money(p.lines.reduce((a, l) => a + l.price * l.qty, 0), currency)}
              </button>
            ))}
          </div>
        )}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip whitespace-nowrap ${cat === c ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const here = stockAt(p, locId)
            const tracked = p.trackStock !== false
            const low = tracked && here <= p.reorderLevel
            const unitTag = p.unit && p.unit !== 'pc' ? `/${p.unit}` : ''
            return (
              <button key={p.id} onClick={() => add(p)} className="card flex flex-col overflow-hidden p-0 text-left transition active:scale-[0.97]">
                {p.thumb && (
                  <div className="relative">
                    <img src={p.thumb} alt="" className="h-28 w-full object-cover" />
                    {p.variants && p.variants.length > 0 && (
                      <span className="absolute bottom-1 left-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">{p.variants.length} options</span>
                    )}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-3">
                  <div className="line-clamp-2 font-semibold text-brand-900 dark:text-white">{p.name}</div>
                  <div className="mt-0.5 text-xs text-brand-900/40 dark:text-white/40">{p.category}</div>
                  <div className="mt-auto flex items-end justify-between pt-2">
                    <span className="font-black text-brand-700 dark:text-gold-400">
                      {money(p.price, currency)}
                      {unitTag && <span className="text-[10px] font-semibold text-brand-900/40 dark:text-white/40">{unitTag}</span>}
                    </span>
                    {tracked && (
                      <span className={`text-[10px] font-semibold ${low ? 'text-red-500' : 'text-brand-900/40 dark:text-white/40'}`}>{here} left</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={<Search size={32} />} title="No products match" hint="Try another search or category." />
            </div>
          )}
        </div>
      </div>

      {/* Cart — desktop panel */}
      <div className="hidden md:block">
        <CartPanel
          cart={cart}
          subtotal={subtotal}
          discount={discount}
          setDiscount={setDiscount}
          total={total}
          currency={currency}
          setQty={setQty}
          clearCart={clearCart}
          onCharge={() => setPayOpen(true)}
          onPark={park}
          held={held}
          canDiscount={canDiscount}
        />
      </div>

      {/* Mobile cart bar */}
      {count > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} className="fixed inset-x-3 bottom-20 z-20 flex items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 text-white shadow-lg md:hidden">
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart size={20} /> {Math.round(count * 100) / 100} item{count > 1 ? 's' : ''}
          </span>
          <span className="text-lg font-black">{money(total, currency)}</span>
        </button>
      )}

      {/* Mobile cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 dark:bg-brand-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-900 dark:text-white">Cart</h2>
              <button className="rounded-full p-1.5 text-brand-900/60 dark:text-white/60" onClick={() => setCartOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <CartPanel
              cart={cart}
              subtotal={subtotal}
              discount={discount}
              setDiscount={setDiscount}
              total={total}
              currency={currency}
              setQty={setQty}
              clearCart={clearCart}
              onCharge={() => setPayOpen(true)}
              onPark={park}
              held={held}
              canDiscount={canDiscount}
              embedded
            />
          </div>
        </div>
      )}

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} total={total} onComplete={onComplete} />
      <Receipt sale={lastSale} open={receiptOpen} onClose={() => setReceiptOpen(false)} onNewSale={() => setReceiptOpen(false)} />
      {returnOpen && <ReturnModal onClose={() => setReturnOpen(false)} />}
      {variantFor && (
        <Modal open onClose={() => setVariantFor(null)} title={`Choose a variation — ${variantFor.name}`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variantFor.variants!.map((v) => (
              <button
                key={v}
                className="chip justify-center bg-black/5 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-600 hover:text-white dark:bg-white/10 dark:text-white"
                onClick={() => { add(variantFor, v); setVariantFor(null) }}
              >
                {v}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {quickOpen && (
        <QuickItemModal
          currency={currency}
          onClose={() => setQuickOpen(false)}
          onAdd={(name, price, qty) => {
            setCart((c) => [...c, { productId: uid('custom_'), name, price, qty }])
            setQuickOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** Sell something that isn't in the catalogue — a service, a one-off item. */
function QuickItemModal({
  currency,
  onClose,
  onAdd,
}: {
  currency: string
  onClose: () => void
  onAdd: (name: string, price: number, qty: number) => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [qty, setQty] = useState(1)
  return (
    <Modal open onClose={onClose} title="Quick item">
      <p className="-mt-1 mb-2 text-xs text-brand-900/50 dark:text-white/50">
        For one-off items or services not in your list. Stock is not affected.
      </p>
      <div className="space-y-3">
        <div>
          <label className="label">What is it?</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Repair service / Special order" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Price ({currency})</label>
            <input className="input" inputMode="decimal" value={price || ''} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Qty</label>
            <input className="input" inputMode="decimal" value={qty || ''} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </div>
      <button className="btn-primary mt-4 w-full" disabled={!name.trim() || price <= 0 || qty <= 0} onClick={() => onAdd(name.trim(), price, qty)}>
        Add to cart · {money(price * qty, currency)}
      </button>
    </Modal>
  )
}

function CartPanel({
  cart,
  subtotal,
  discount,
  setDiscount,
  total,
  currency,
  setQty,
  clearCart,
  onCharge,
  onPark,
  held,
  canDiscount,
  embedded,
}: {
  cart: CartLine[]
  subtotal: number
  discount: number
  setDiscount: (n: number) => void
  total: number
  currency: string
  setQty: (id: string, qty: number) => void
  clearCart: () => void
  onCharge: () => void
  onPark?: () => void
  held?: boolean
  canDiscount?: boolean
  embedded?: boolean
}) {
  return (
    <div className={embedded ? '' : 'card sticky top-4 p-4'}>
      {!embedded && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-brand-900 dark:text-white">
            <ShoppingCart size={18} /> Cart
          </h2>
          {cart.length > 0 && (
            <div className="flex items-center gap-3">
              {onPark && (
                <button className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400" onClick={onPark} title="Park this sale and serve the next customer">
                  <PauseCircle size={13} /> Park
                </button>
              )}
              <button className="text-xs font-semibold text-red-500" onClick={clearCart}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {cart.length === 0 ? (
        <p className="py-8 text-center text-sm text-brand-900/40 dark:text-white/40">Tap products to add them.</p>
      ) : (
        <div className="max-h-[46vh] space-y-2 overflow-y-auto">
          {cart.map((l) => {
            const k = l.productId + '␟' + (l.variant ?? '')
            return (
            <div key={k} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-brand-900 dark:text-white">{l.name}</div>
                <div className="text-xs text-brand-900/50 dark:text-white/50">
                  {money(l.price, currency)}{l.unit ? `/${l.unit}` : ' each'}
                  {l.wholesale && <span className="ml-1 font-semibold text-gold-600 dark:text-gold-400">wholesale</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded-lg bg-black/5 p-1.5 dark:bg-white/10" onClick={() => setQty(k, Math.round((l.qty - 1) * 100) / 100)}>
                  <Minus size={14} />
                </button>
                {l.unit ? (
                  <input
                    className="w-14 rounded-lg border border-black/10 bg-white py-1 text-center text-sm font-bold text-brand-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
                    inputMode="decimal"
                    value={l.qty || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setQty(k, isNaN(v) ? 0.01 : v)
                    }}
                  />
                ) : (
                  <span className="w-7 text-center font-bold text-brand-900 dark:text-white">{l.qty}</span>
                )}
                <button className="rounded-lg bg-black/5 p-1.5 dark:bg-white/10" onClick={() => setQty(k, Math.round((l.qty + 1) * 100) / 100)}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="w-20 text-right text-sm font-bold text-brand-900 dark:text-white">{money(l.price * l.qty, currency)}</div>
              <button className="text-red-400" onClick={() => setQty(k, 0)}>
                <Trash2 size={15} />
              </button>
            </div>
          )})}
        </div>
      )}

      <div className="mt-3 space-y-2 border-t border-black/5 pt-3 dark:border-white/10">
        <div className="flex justify-between text-sm text-brand-900/70 dark:text-white/70">
          <span>Subtotal</span>
          <span>{money(subtotal, currency)}</span>
        </div>
        {canDiscount && (
          <div className="flex items-center justify-between text-sm text-brand-900/70 dark:text-white/70">
            <span className="flex items-center gap-1">
              <Tag size={14} /> Discount
            </span>
            <input className="input w-24 py-1.5 text-right text-sm" inputMode="decimal" value={discount || ''} placeholder="0" onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))} />
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-bold text-brand-900 dark:text-white">Total</span>
          <span className="text-2xl font-black text-brand-700 dark:text-gold-400">{money(total, currency)}</span>
        </div>
      </div>

      {held ? (
        <div className="mt-3 rounded-xl bg-red-100 px-3 py-3 text-center text-sm font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
          Selling is paused — pay your subscription to continue.
        </div>
      ) : (
        <>
          <button className="btn-primary mt-3 w-full text-lg" disabled={cart.length === 0} onClick={onCharge}>
            Charge {money(total, currency)}
          </button>
          {embedded && onPark && cart.length > 0 && (
            <button className="btn-ghost mt-2 w-full" onClick={onPark}>
              <PauseCircle size={16} /> Park this sale — serve the next customer
            </button>
          )}
        </>
      )}
    </div>
  )
}
