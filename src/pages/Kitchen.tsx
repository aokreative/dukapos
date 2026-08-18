import { CheckCircle, Clock } from 'lucide-react'
import { useStore } from '../store/useStore'
import { PageHeader, EmptyState } from '../components/ui'

export default function Kitchen() {
  const kitchenOrders = useStore((s) => s.kitchenOrders)
  const updateKitchenOrderStatus = useStore((s) => s.updateKitchenOrderStatus)
  const locId = useStore((s) => s.currentLocationId)

  const activeOrders = kitchenOrders
    .filter((o) => o.locationId === locId && o.status !== 'served')
    .sort((a, b) => a.placedAt - b.placedAt)

  return (
    <div>
      <PageHeader title="Kitchen Display" subtitle={`${activeOrders.length} active orders`} />

      {activeOrders.length === 0 ? (
        <EmptyState icon={<CheckCircle size={32} />} title="All Clear" hint="No active kitchen orders." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activeOrders.map((order) => {
            const mins = Math.floor((Date.now() - order.placedAt) / 60000)
            const isReady = order.status === 'ready'

            return (
              <div key={order.id} className={`card flex flex-col overflow-hidden ${isReady ? 'ring-2 ring-brand-500' : ''}`}>
                <div className={`p-3 text-white flex items-center justify-between ${isReady ? 'bg-brand-600' : 'bg-brand-900'}`}>
                  <div className="font-bold text-lg">Table {order.tableNumber}</div>
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <Clock size={14} /> {mins}m
                  </div>
                </div>

                <div className="flex-1 p-3 overflow-y-auto" style={{ maxHeight: '300px' }}>
                  <div className="text-xs text-brand-900/50 mb-3 border-b border-black/5 pb-2">
                    Waiter: {order.cashierName}
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
                  {!isReady ? (
                    <button
                      onClick={() => updateKitchenOrderStatus(order.id, 'ready')}
                      className="btn-primary w-full py-3 text-lg font-bold"
                    >
                      Mark Ready
                    </button>
                  ) : (
                    <button
                      onClick={() => updateKitchenOrderStatus(order.id, 'served')}
                      className="btn-ghost w-full py-3 text-lg font-bold text-brand-600"
                    >
                      Mark Served (Done)
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
