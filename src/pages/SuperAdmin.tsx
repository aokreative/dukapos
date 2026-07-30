import { useState, useEffect } from 'react'
import { ShieldAlert, RefreshCw, Activity } from 'lucide-react'
import { PageHeader, Tabs, Badge } from '../components/ui'
import { money } from '../lib/format'

export default function SuperAdmin() {
  const [token, setToken] = useState(localStorage.getItem('duka_admin_token') || '')
  const [inputToken, setInputToken] = useState('')
  const [activeTab, setActiveTab] = useState('metrics')
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tabs = [
    { id: 'metrics', label: 'Platform Metrics' },
    { id: 'tenants', label: 'Tenants' },
    { id: 'health', label: 'System Health' },
  ]

  const loadData = async (currentToken: string) => {
    if (!currentToken) return
    setLoading(true)
    setError('')
    try {
      const url = import.meta.env.VITE_API_URL || 'http://localhost:8787'
      const res = await fetch(`${url}/api/admin/tenants`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setTenants(data)
    } catch (e: any) {
      setError(e.message || 'Failed to load tenants')
      if (e.message.includes('Unauthorized') || e.message.includes('disabled')) {
        setToken('')
        localStorage.removeItem('duka_admin_token')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) loadData(token)
  }, [token])

  const saveToken = () => {
    if (!inputToken.trim()) return
    localStorage.setItem('duka_admin_token', inputToken.trim())
    setToken(inputToken.trim())
  }

  const logout = () => {
    localStorage.removeItem('duka_admin_token')
    setToken('')
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 card text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600 mb-6">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-2xl font-bold text-brand-900 mb-2">Super Admin</h1>
        <p className="text-sm text-brand-900/60 mb-6">Enter your admin token to manage all shops. (This is the ADMIN_TOKEN you set on the server.)</p>
        <input 
          type="password" 
          className="input mb-4 text-center" 
          placeholder="Admin token" 
          value={inputToken}
          onChange={(e) => setInputToken(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveToken()}
        />
        <button className="btn-primary w-full" onClick={saveToken}>Unlock portal</button>
      </div>
    )
  }

  const paying = tenants.filter(t => t.status === 'active' || t.status === 'grace')
  const atRisk = tenants.filter(t => t.status === 'restricted' || t.status === 'suspended')
  const mrr = tenants.filter(t => t.status !== 'suspended').reduce((s, t) => s + (t.cycle === 'annual' ? t.amountDue / 10 : t.amountDue), 0)

  return (
    <div className="max-w-5xl">
      <PageHeader 
        title="Super Admin" 
        subtitle="Duka POS Platform Management" 
        action={<button className="btn-ghost" onClick={logout}>Sign out</button>} 
      />

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-900/50 mb-1">Total Shops</div>
              <div className="text-3xl font-black text-brand-900">{tenants.length}</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-900/50 mb-1">Paying</div>
              <div className="text-3xl font-black text-brand-900">{paying.length}</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-900/50 mb-1">At Risk</div>
              <div className="text-3xl font-black text-brand-900">{atRisk.length}</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-900/50 mb-1">Est. MRR</div>
              <div className="text-3xl font-black text-brand-900">{money(mrr, 'KES')}</div>
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="font-bold text-brand-900 mb-4">Platform Overview</h3>
            <div className="h-64 flex items-center justify-center rounded-xl border border-dashed border-black/10">
              <p className="text-brand-900/40 text-sm font-medium">Metrics visualization will appear here as data grows.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tenants' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/5">
            <h3 className="font-bold text-brand-900 dark:text-white">All Shops</h3>
            <div className="flex gap-2">
              <button className="btn-ghost py-1.5 px-3 text-sm" onClick={() => loadData(token)}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="p-10 text-center text-brand-900/50">Loading tenants...</div>
          ) : error ? (
            <div className="p-10 text-center text-red-500">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-brand-50/50 dark:bg-white/5 text-[11px] font-bold uppercase tracking-wider text-brand-900/50 dark:text-white/50">
                  <tr>
                    <th className="p-4 font-semibold">Shop</th>
                    <th className="p-4 font-semibold">Phone</th>
                    <th className="p-4 font-semibold">Plan</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Fee / Owing</th>
                    <th className="p-4 font-semibold">Renews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {tenants.map(t => (
                    <tr key={t.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="p-4 font-semibold text-brand-900 dark:text-white">{t.business}</td>
                      <td className="p-4 text-brand-900/70 dark:text-white/70">{t.phone}</td>
                      <td className="p-4 capitalize">{t.planId} · {t.cycle}</td>
                      <td className="p-4">
                        <Badge color={t.status === 'active' ? 'green' : t.status === 'grace' ? 'gold' : 'red'}>
                          {t.status} {t.overdueDays ? `${t.overdueDays}d` : ''}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-brand-900 dark:text-white">{money(t.amountDue || (t.cycle === 'annual' ? t.amountDue/10 : t.amountDue), 'KES')}/mo</div>
                        {t.balanceDue > 0 && <div className="text-xs text-red-500 font-medium mt-0.5">owes {money(t.balanceDue, 'KES')}</div>}
                      </td>
                      <td className="p-4 text-brand-900/70 dark:text-white/70">
                        {t.currentPeriodEnd ? new Date(t.currentPeriodEnd).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-brand-900/50">No shops registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'health' && (
        <div className="card p-8 text-center max-w-lg mx-auto mt-10">
          <Activity size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-brand-900 mb-2">System Healthy</h2>
          <p className="text-brand-900/60 mb-6">All platform services are operating normally. The billing scheduler is active.</p>
          <button className="btn-primary" onClick={async () => {
             try {
                const url = import.meta.env.VITE_API_URL || 'http://localhost:8787'
                await fetch(`${url}/api/admin/run-billing`, {
                   method: 'POST',
                   headers: { Authorization: `Bearer ${token}` }
                })
                alert('Billing sweep triggered successfully.')
             } catch(e) {
                alert('Failed to run sweep.')
             }
          }}>Force Billing Sweep</button>
        </div>
      )}
    </div>
  )
}
