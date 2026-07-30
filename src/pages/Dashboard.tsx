import { PageHeader } from '../components/ui'

export default function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
        {/* Revenue Chart Placeholder */}
        <div className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-brand-900/60 dark:text-white/60 mb-2">Revenue — Last 31 Days</h2>
          <div className="text-xs text-brand-900/40 mb-4">All shops combined</div>
          <div className="h-48 flex items-end gap-1">
            {/* Fake bars for demo */}
            {Array.from({ length: 31 }).map((_, i) => (
              <div key={i} className="bg-brand-500 rounded-t-sm w-full" style={{ height: `${Math.max(20, Math.random() * 100)}%` }} />
            ))}
          </div>
        </div>

        {/* Payment Methods Placeholder */}
        <div className="card p-4">
          <h2 className="text-sm font-bold text-brand-900/60 dark:text-white/60 mb-4">Payment Methods</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>M-PESA</span>
                <span className="text-brand-500">62%</span>
              </div>
              <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full bg-brand-500 w-[62%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Cash</span>
                <span className="text-blue-500">28%</span>
              </div>
              <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full bg-blue-500 w-[28%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Card</span>
                <span className="text-amber-500">10%</span>
              </div>
              <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full bg-amber-500 w-[10%]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
           <h2 className="text-sm font-bold text-brand-900/60 dark:text-white/60 mb-4">Recent Transactions</h2>
           <div className="text-sm text-brand-900/40">Loading transactions...</div>
        </div>
        <div className="card p-4">
           <h2 className="text-sm font-bold text-brand-900/60 dark:text-white/60 mb-4">Low Stock Alerts</h2>
           <div className="text-sm text-brand-900/40">Loading alerts...</div>
        </div>
      </div>
    </div>
  )
}
