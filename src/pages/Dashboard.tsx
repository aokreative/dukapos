import { useMemo } from 'react'
import { PageHeader, Badge } from '../components/ui'
import { useStore, selectCurrentStaff, selectCurrentLocation } from '../store/useStore'
import { stockAt } from '../lib/stock'
import { money } from '../lib/format'
import { Package } from 'lucide-react'

export default function Dashboard() {
  const staff = useStore(selectCurrentStaff)
  const location = useStore(selectCurrentLocation)
  const locId = location?.id ?? 'loc_main'
  const sales = useStore(s => s.sales)
  const products = useStore(s => s.products)
  const customers = useStore(s => s.customers)

  // 1. Revenue - Last 31 Days
  const { chartData, total31Days } = useMemo(() => {
    const now = Date.now()
    const msPerDay = 24 * 60 * 60 * 1000
    const buckets = Array.from({ length: 31 }, () => 0)
    let total = 0
    sales.forEach(sale => {
      const daysAgo = Math.floor((now - sale.createdAt) / msPerDay)
      if (daysAgo >= 0 && daysAgo < 31) {
        buckets[30 - daysAgo] += sale.total
        total += sale.total
      }
    })
    const maxVal = Math.max(...buckets, 1) // avoid div by 0
    return {
      chartData: buckets.map((v, i) => ({ 
        val: v, 
        pct: (v / maxVal) * 100,
        day: 30 - i
      })),
      total31Days: total
    }
  }, [sales])

  // 2. Payment Methods (Last 31 Days)
  const paymentMethods = useMemo(() => {
    const counts: Record<string, number> = { mpesa: 0, cash: 0, card: 0, other: 0 }
    let total = 0
    const now = Date.now()
    const msPerDay = 24 * 60 * 60 * 1000

    sales.forEach(s => {
      const daysAgo = Math.floor((now - s.createdAt) / msPerDay)
      if (daysAgo < 31) {
        s.tenders.forEach(t => {
          const amt = t.amount
          total += amt
          if (t.method === 'mpesa') counts.mpesa += amt
          else if (t.method === 'cash') counts.cash += amt
          else if (t.method === 'card') counts.card += amt
          else counts.other += amt
        })
      }
    })
    
    if (total === 0) return { mpesa: 0, cash: 0, card: 0, other: 0, total }
    return {
      mpesa: Math.round((counts.mpesa / total) * 100),
      cash: Math.round((counts.cash / total) * 100),
      card: Math.round((counts.card / total) * 100),
      other: Math.round((counts.other / total) * 100),
      total
    }
  }, [sales])

  // 3. Recent Transactions
  const recentTx = useMemo(() => {
    return [...sales].sort((a,b) => b.createdAt - a.createdAt).slice(0, 5)
  }, [sales])

  // 4. Low Stock Alerts
  const lowStock = useMemo(() => {
    return products
      .filter(p => p.trackStock !== false)
      .map(p => {
        const totalStock = stockAt(p, locId)
        return { ...p, totalStock }
      })
      .filter(p => p.totalStock <= (p.reorderLevel || 0))
      .sort((a,b) => a.totalStock - b.totalStock)
      .slice(0, 5)
  }, [products, locId])

  return (
    <div className="pb-10">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${staff?.name || 'Owner'}`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
        {/* Revenue Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-sm font-bold text-brand-900/60 dark:text-white/60 mb-1">Revenue — Last 31 Days</h2>
              <div className="text-xs text-brand-900/40">All shops combined</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-brand-900 dark:text-white">{money(total31Days, 'KES')}</div>
              <div className="text-xs font-semibold text-green-500">Gross Sales</div>
            </div>
          </div>

          <div className="h-48 flex items-end gap-[2px]">
            {chartData.map((d, i) => (
              <div 
                key={i} 
                className="bg-[#00D67D] hover:bg-brand-400 transition-colors w-full group relative" 
                style={{ height: `${Math.max(2, d.pct)}%` }} 
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-brand-900 text-white text-xs font-bold py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                  {money(d.val, 'KES')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="card p-5 flex flex-col">
          <h2 className="text-sm font-bold text-brand-900/60 dark:text-white/60 mb-6">Payment Methods</h2>
          
          {paymentMethods.total === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-brand-900/40 font-medium">No sales in 31 days</div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-brand-900 dark:text-white">M-PESA</span>
                  <span className="text-brand-500">{paymentMethods.mpesa}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                  <div className="h-full bg-brand-500 transition-all duration-1000" style={{ width: `${paymentMethods.mpesa}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-brand-900 dark:text-white">Cash</span>
                  <span className="text-blue-500">{paymentMethods.cash}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${paymentMethods.cash}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-brand-900 dark:text-white">Card</span>
                  <span className="text-amber-500">{paymentMethods.card}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${paymentMethods.card}%` }} />
                </div>
              </div>
              {paymentMethods.other > 0 && (
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-brand-900 dark:text-white">Other</span>
                    <span className="text-gray-500">{paymentMethods.other}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                    <div className="h-full bg-gray-500 transition-all duration-1000" style={{ width: `${paymentMethods.other}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Transactions */}
        <div className="card p-5">
           <h2 className="text-sm font-bold text-brand-900/60 dark:text-white/60 mb-4">Recent Transactions</h2>
           {recentTx.length === 0 ? (
             <div className="text-sm text-brand-900/40 font-medium py-4 text-center">No transactions yet.</div>
           ) : (
             <div className="divide-y divide-black/5 dark:divide-white/5">
               {recentTx.map(tx => {
                 const customer = tx.customerId ? customers.find(c => c.id === tx.customerId) : null
                 const name = customer ? customer.name : 'Walk-in'
                 const initials = name.charAt(0).toUpperCase()
                 const itemsCount = tx.lines.reduce((sum, line) => sum + line.qty, 0)
                 
                 return (
                 <div key={tx.id} className="py-3 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-full bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 font-bold text-xs">
                       {initials}
                     </div>
                     <div>
                       <div className="text-sm font-bold text-brand-900 dark:text-white">{name}</div>
                       <div className="text-[11px] font-semibold text-brand-900/50 dark:text-white/50">
                         {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {itemsCount} items
                       </div>
                     </div>
                   </div>
                   <div className="text-right">
                     <div className="text-sm font-black text-brand-900 dark:text-white">{money(tx.total, 'KES')}</div>
                     <div className="text-[11px] font-bold text-brand-900/40 dark:text-white/40">
                       {tx.tenders.map(t => t.method).join(', ')}
                     </div>
                   </div>
                 </div>
               )})}
             </div>
           )}
        </div>

        {/* Low Stock Alerts */}
        <div className="card p-5">
           <div className="flex justify-between items-center mb-4">
             <h2 className="text-sm font-bold text-brand-900/60 dark:text-white/60">Low Stock Alerts</h2>
             {lowStock.length > 0 && <Badge color="red">{lowStock.length} Items</Badge>}
           </div>
           
           {lowStock.length === 0 ? (
             <div className="text-sm text-brand-900/40 font-medium py-4 text-center">All stock levels are healthy!</div>
           ) : (
             <div className="divide-y divide-black/5 dark:divide-white/5">
               {lowStock.map(p => (
                 <div key={p.id} className="py-3 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                       <Package size={14} />
                     </div>
                     <div>
                       <div className="text-sm font-bold text-brand-900 dark:text-white">{p.name}</div>
                       <div className="text-[11px] font-semibold text-brand-900/50 dark:text-white/50">{p.category}</div>
                     </div>
                   </div>
                   <div className="text-right">
                     <div className="text-sm font-black text-red-600 dark:text-red-400">
                       {p.totalStock} <span className="text-xs font-semibold">{p.unit || 'left'}</span>
                     </div>
                     <div className="text-[11px] font-bold text-brand-900/40 dark:text-white/40">Min: {p.reorderLevel || 0}</div>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
