import { useMemo, useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Tag, RotateCcw } from 'lucide-react'
import { useStore } from '../store/useStore'
import { money } from '../lib/format'
import type { CartLine, Product, Sale, Tender } from '../types'
import PaymentModal from '../components/PaymentModal'
import Receipt from '../components/Receipt'
import ReturnModal from '../components/ReturnModal'
import { EmptyState } from '../components/ui'
import { useBilling } from '../components/Billing'
import { selectRole } from '../store/useStore'
import { can } from '../lib/permissions'
import { submitEtimsInvoice } from '../lib/api'
import { stockAt } from '../lib/stock'
import { bizLabels } from '../lib/labels'

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
  const labels = bizLabels(useStore((s) => s.settings.businessType))
  const [returnOpen, setReturnOpen] = useState(false)

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

  function add(p: Product) {
    setCart((c) => {
      const found = c.find((l) => l.productId === p.id)
      if (found) return c.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
      return [...c, { productId: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }
  function setQty(productId: string, qty: number) {
    setCart((c) => (qty <= 0 ? c.filter((l) => l.productId !== productId) : c.map((l) => (l.productId === productId ? { ...l, qty } : l))))
  }
  function clearCart() {
    setCart([])
    setDiscount(0)
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
            <input autoFocus className="input pl-10" placeholder={labels.searchHint} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
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
            return (
              <button key={p.id} onClick={() => add(p)} className="card flex flex-col p-3 text-left transition active:scale-[0.97]">
                <div className="flex-1">
                  <div className="line-clamp-2 font-semibold text-brand-900 dark:text-white">{p.name}</div>
                  <div className="mt-0.5 text-xs text-brand-900/40 dark:text-white/40">{p.category}</div>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="font-black text-brand-700 dark:text-gold-400">{money(p.price, currency)}</span>
                  {tracked && (
                    <span className={`text-[10px] font-semibold ${low ? 'text-red-500' : 'text-brand-900/40 dark:text-white/40'}`}>{here} left</span>
                  )}
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
          held={held}
          canDiscount={canDiscount}
        />
      </div>

      {/* Mobile cart bar */}
      {count > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} className="fixed inset-x-3 bottom-20 z-20 flex items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 text-white shadow-lg md:hidden">
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart size={20} /> {count} item{count > 1 ? 's' : ''}
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
    </div>
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
            <button className="text-xs font-semibold text-red-500" onClick={clearCart}>
              Clear
            </button>
          )}
        </div>
      )}

      {cart.length === 0 ? (
        <p className="py-8 text-center text-sm text-brand-900/40 dark:text-white/40">Tap products to add them.</p>
      ) : (
        <div className="max-h-[46vh] space-y-2 overflow-y-auto">
          {cart.map((l) => (
            <div key={l.productId} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-brand-900 dark:text-white">{l.name}</div>
                <div className="text-xs text-brand-900/50 dark:text-white/50">{money(l.price, currency)} each</div>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded-lg bg-black/5 p-1.5 dark:bg-white/10" onClick={() => setQty(l.productId, l.qty - 1)}>
                  <Minus size={14} />
                </button>
                <span className="w-7 text-center font-bold text-brand-900 dark:text-white">{l.qty}</span>
                <button className="rounded-lg bg-black/5 p-1.5 dark:bg-white/10" onClick={() => setQty(l.productId, l.qty + 1)}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="w-20 text-right text-sm font-bold text-brand-900 dark:text-white">{money(l.price * l.qty, currency)}</div>
              <button className="text-red-400" onClick={() => setQty(l.productId, 0)}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
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
        <button className="btn-primary mt-3 w-full text-lg" disabled={cart.length === 0} onClick={onCharge}>
          Charge {money(total, currency)}
        </button>
      )}
    </div>
  )
}
