import { useState } from 'react'
import { Clock, X, CheckCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { PageHeader, EmptyState } from '../components/ui'
import PaymentModal from '../components/PaymentModal'
import type { KitchenOrder, Tender } from '../types'

export default function Kitchen() {
  const kitchenOrders = useStore((s) => s.kitchenOrders)
  const updateKitchenOrderStatus = useStore((s) => s.updateKitchenOrderStatus)
  const completeSale = useStore((s) => s.completeSale)
  const locId = useStore((s) => s.currentLocationId)

  const [payOpenFor, setPayOpenFor] = useState<KitchenOrder | null>(null)

  const activeOrders = kitchenOrders
    .filter((o) => o.locationId === locId && ['preparing', 'ready', 'served'].includes(o.status))
    .sort((a, b) => (a.statusChangedAt || a.placedAt) - (b.statusChangedAt || b.placedAt))

  const preparing = activeOrders.filter((o) => o.status === 'preparing')
  const ready = activeOrders.filter((o) => o.status === 'ready')
  const served = activeOrders.filter((o) => o.status === 'served')

  function handleCompletePayment(tenders: Tender[]) {
    if (!payOpenFor) return
    completeSale({
      lines: payOpenFor.lines,
      discount: 0,
      tenders,
      note: `Table ${payOpenFor.tableNumber}`
    })
    updateKitchenOrderStatus(payOpenFor.id, 'charged')
    setPayOpenFor(null)
  }

  const renderCard = (order: KitchenOrder) => {
    const mins = Math.floor((Date.now() - order.placedAt) / 60000)
    
    let headerColor = 'bg-brand-900'
    let ringColor = ''
    if (order.status === 'ready') {
      headerColor = 'bg-amber-500'
      ringColor = 'ring-2 ring-amber-500'
    } else if (order.status === 'served') {
      headerColor = 'bg-brand-600'
      ringColor = 'ring-2 ring-brand-500'
    }

    return (
      <div key={order.id} className={`card flex flex-col overflow-hidden ${ringColor}`}>
        <div className={`p-3 text-white flex items-center justify-between ${headerColor}`}>
          <div className="font-bold text-lg">Table {order.tableNumber}</div>
          <div className="flex items-center gap-1 text-sm font-medium">
            <Clock size={14} /> {mins}m
          </div>
        </div>

        <div className="flex-1 p-3 overflow-y-auto" style={{ maxHeight: '250px' }}>
          <div className="flex items-center justify-between border-b border-black/5 pb-2 mb-3">
            <div className="text-xs text-brand-900/50">Waiter: {order.cashierName}</div>
            {(order.status === 'preparing' || order.status === 'ready') && (
              <button onClick={() => updateKitchenOrderStatus(order.id, 'cancelled')} className="text-red-500 hover:bg-red-50 p-1 rounded-md transition" title="Cancel Order">
                <X size={16} />
              </button>
            )}
          </div>
          <ul className="space-y-3">
            {order.lines.map((line, i) => (
              <li key={i} className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{line.qty}x</span> {line.name}
                  {line.size && <div className="text-xs text-brand-900/60 dark:text-white/60">Size: {line.size}</div>}
                  {line.modifiers && (
                    <div className="text-sm font-medium text-amber-600 bg-amber-50 rounded px-1.5 mt-0.5 inline-block">
                      + {line.modifiers}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5">
          {order.status === 'preparing' && (
            <button
              onClick={() => updateKitchenOrderStatus(order.id, 'ready')}
              className="btn-primary w-full py-3 text-lg font-bold"
            >
              Prepared
            </button>
          )}
          {order.status === 'ready' && (
            <button
              onClick={() => updateKitchenOrderStatus(order.id, 'served')}
              className="btn-primary w-full py-3 text-lg font-bold !bg-amber-500 hover:!bg-amber-600"
            >
              Picked & Served
            </button>
          )}
          {order.status === 'served' && (
            <button
              onClick={() => setPayOpenFor(order)}
              className="btn-primary w-full py-3 text-lg font-bold !bg-green-600 hover:!bg-green-700"
            >
              Charge
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Kitchen & Pass" subtitle={`${activeOrders.length} active tickets`} />

      {activeOrders.length === 0 ? (
        <EmptyState icon={<CheckCircle size={32} />} title="All Clear" hint="No active kitchen orders." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden min-h-[500px]">
          {/* Column 1: Kitchen (Preparing) */}
          <div className="flex flex-col bg-black/5 dark:bg-white/5 rounded-2xl p-4 overflow-hidden">
            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
              Kitchen 
              <span className="bg-brand-900 text-white text-xs px-2 py-1 rounded-full">{preparing.length}</span>
            </h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              {preparing.map(renderCard)}
            </div>
          </div>

          {/* Column 2: Pass (Ready) */}
          <div className="flex flex-col bg-amber-500/10 rounded-2xl p-4 overflow-hidden">
            <h2 className="text-xl font-bold text-amber-700 dark:text-amber-500 mb-4 flex items-center justify-between">
              Waiting / Pass
              <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">{ready.length}</span>
            </h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              {ready.map(renderCard)}
            </div>
          </div>

          {/* Column 3: Floor (Served) */}
          <div className="flex flex-col bg-brand-500/10 rounded-2xl p-4 overflow-hidden">
            <h2 className="text-xl font-bold text-brand-700 dark:text-brand-500 mb-4 flex items-center justify-between">
              Floor (Served)
              <span className="bg-brand-500 text-white text-xs px-2 py-1 rounded-full">{served.length}</span>
            </h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              {served.map(renderCard)}
            </div>
          </div>
        </div>
      )}

      {payOpenFor && (
        <PaymentModal
          open={true}
          onClose={() => setPayOpenFor(null)}
          total={payOpenFor.lines.reduce((s, l) => s + l.price * l.qty, 0)}
          onComplete={handleCompletePayment}
        />
      )}
    </div>
  )
}
