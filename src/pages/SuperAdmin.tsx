import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIdleTimer } from '../lib/useIdleTimer'
import { useStore } from '../store/useStore'
import {
  RefreshCw,
  Activity,
  Trash2,
  PauseCircle,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  Search,
  AlertTriangle,
  X,
  ShieldAlert,
  Store,
  FlaskConical,
  Zap,
  Trash,
} from 'lucide-react'
import { PageHeader, Tabs, Badge } from '../components/ui'
import { money } from '../lib/format'
import { supabase } from '../lib/cloud'
import {
  seedRestaurant,
  seedPharmacy,
  seedBoutique,
  seedAutoSpares,
  seedHardwareSpices,
  wipeLocalStore,
  seedShop,
  seedElectronics,
  seedAgrovet,
  seedSpices,
  seedWholesale,
  seedBabyshop,
} from '../lib/demoSeeders'

// ── Confirmation dialog ────────────────────────────────────────────────────
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="card w-full max-w-sm p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-brand-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-brand-900/60 dark:text-white/60">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost py-2 px-4 text-sm" onClick={onCancel}>Cancel</button>
          <button
            className={`btn py-2 px-4 text-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tenant row with expand ─────────────────────────────────────────────────
function TenantRow({
  t,
  onSuspend,
  onReactivate,
  onDelete,
  actionLoading,
}: {
  t: any
  onSuspend: (id: string, name: string) => void
  onReactivate: (id: string, name: string) => void
  onDelete: (id: string, name: string) => void
  actionLoading: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const isBusy = actionLoading === t.id
  const isSuspended = t.status === 'suspended'

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="p-4">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-brand-900/40 dark:text-white/40 shrink-0" /> : <ChevronRight size={14} className="text-brand-900/40 dark:text-white/40 shrink-0" />}
            <span className="font-semibold text-brand-900 dark:text-white">{t.business}</span>
          </div>
        </td>
        <td className="p-4 text-brand-900/70 dark:text-white/70">{t.phone || '—'}</td>
        <td className="p-4 capitalize text-brand-900/70 dark:text-white/70">{t.planId} · {t.cycle}</td>
        <td className="p-4">
          <Badge color={t.status === 'active' ? 'green' : t.status === 'grace' ? 'gold' : 'red'}>
            {t.status}{t.overdueDays ? ` ${t.overdueDays}d` : ''}
          </Badge>
        </td>
        <td className="p-4">
          <div className="font-semibold text-brand-900 dark:text-white">{money(t.amountDue || 0, 'KES')}/mo</div>
          {t.balanceDue > 0 && <div className="text-xs text-red-500 font-medium mt-0.5">owes {money(t.balanceDue, 'KES')}</div>}
        </td>
        <td className="p-4 text-brand-900/70 dark:text-white/70 text-sm">
          {t.currentPeriodEnd ? new Date(t.currentPeriodEnd).toLocaleDateString() : '—'}
        </td>
        <td className="p-4">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isSuspended ? (
              <button
                className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs font-bold text-green-600 hover:bg-green-500/20 transition disabled:opacity-50 dark:text-green-400"
                disabled={isBusy}
                onClick={() => onReactivate(t.id, t.business)}
                title="Reactivate account"
              >
                <PlayCircle size={13} /> Reactivate
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-500/20 transition disabled:opacity-50 dark:text-amber-400"
                disabled={isBusy}
                onClick={() => onSuspend(t.id, t.business)}
                title="Suspend account"
              >
                <PauseCircle size={13} /> Suspend
              </button>
            )}
            <button
              className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/20 transition disabled:opacity-50 dark:text-red-400"
              disabled={isBusy}
              onClick={() => onDelete(t.id, t.business)}
              title="Delete account permanently"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-black/[0.015] dark:bg-white/[0.02]">
          <td colSpan={7} className="px-8 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-900/40 dark:text-white/40">Shop ID</div>
                <div className="mt-1 font-mono text-xs text-brand-900/70 dark:text-white/70 break-all">{t.id}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-900/40 dark:text-white/40">Owner Email</div>
                <div className="mt-1 text-brand-900/70 dark:text-white/70">{t.email || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-900/40 dark:text-white/40">Business Type</div>
                <div className="mt-1 capitalize text-brand-900/70 dark:text-white/70">{t.businessType || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-900/40 dark:text-white/40">Joined</div>
                <div className="mt-1 text-brand-900/70 dark:text-white/70">
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState('metrics')
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [confirm, setConfirm] = useState<{
    type: 'suspend' | 'reactivate' | 'delete'
    tenantId: string
    tenantName: string
  } | null>(null)

  const tabs = [
    { id: 'metrics', label: 'Platform Metrics' },
    { id: 'tenants', label: `Tenants (${tenants.length})` },
    { id: 'health', label: 'System Health' },
    { id: 'demo', label: '🎬 Demo Control' },
  ]

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const sb = supabase()
      if (!sb) throw new Error('Cloud disconnected')
      const { data, error: rpcError } = await sb.rpc('get_all_tenants')
      if (rpcError) throw rpcError
      setTenants(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e.message || 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Strict Security & Session Management ──────────────────────────────────
  const forceLogout = useCallback(async () => {
    const sb = supabase()
    if (sb) await sb.auth.signOut()
    wipeLocalStore()
    window.location.href = '/' // Hard redirect ensures React state is fully flushed
  }, [])

  // 1. Inactivity Auto-Logout (15 minutes)
  useIdleTimer(15, forceLogout)

  // 2. Strict Route Protection on Mount
  useEffect(() => {
    const verifySession = async () => {
      const sb = supabase()
      if (!sb) return
      
      const { data, error } = await sb.auth.getSession()
      if (error || !data?.session || data.session.user?.email !== 'aokreative@gmail.com') {
        forceLogout()
      }
    }
    verifySession()
  }, [forceLogout])


  const logout = async () => {
    await forceLogout()
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async function executeSuspend(tenantId: string) {
    setActionLoading(tenantId)
    setActionError('')
    try {
      const sb = supabase()
      if (!sb) throw new Error('Cloud disconnected')
      const { error: e } = await sb.rpc('admin_suspend_tenant', { p_shop_id: tenantId })
      if (e) throw e
      setTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, status: 'suspended' } : t))
    } catch (e: any) {
      setActionError(`Failed to suspend: ${e.message}`)
    } finally {
      setActionLoading(null)
      setConfirm(null)
    }
  }

  async function executeReactivate(tenantId: string) {
    setActionLoading(tenantId)
    setActionError('')
    try {
      const sb = supabase()
      if (!sb) throw new Error('Cloud disconnected')
      const { error: e } = await sb.rpc('admin_reactivate_tenant', { p_shop_id: tenantId })
      if (e) throw e
      setTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, status: 'active' } : t))
    } catch (e: any) {
      setActionError(`Failed to reactivate: ${e.message}`)
    } finally {
      setActionLoading(null)
      setConfirm(null)
    }
  }

  async function executeDelete(tenantId: string) {
    setActionLoading(tenantId)
    setActionError('')
    try {
      const sb = supabase()
      if (!sb) throw new Error('Cloud disconnected')
      const { error: e } = await sb.rpc('admin_delete_tenant', { p_shop_id: tenantId })
      if (e) throw e
      setTenants((prev) => prev.filter((t) => t.id !== tenantId))
    } catch (e: any) {
      setActionError(`Failed to delete: ${e.message}`)
    } finally {
      setActionLoading(null)
      setConfirm(null)
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const paying = tenants.filter((t) => t.status === 'active' || t.status === 'grace')
  const atRisk = tenants.filter((t) => t.status === 'restricted' || t.status === 'suspended')
  const mrr = tenants.filter((t) => t.status !== 'suspended').reduce((s, t) => {
    const amount = t.amountDue || 0
    const cycle = t.cycle || 'monthly'
    return s + (cycle === 'annual' ? amount / 10 : amount)
  }, 0)

  const filtered = tenants.filter((t) =>
    !search.trim() ||
    t.business?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-6xl">
      {confirm && (
        <ConfirmDialog
          danger={confirm.type === 'delete'}
          title={
            confirm.type === 'delete'
              ? `Delete "${confirm.tenantName}"?`
              : confirm.type === 'suspend'
              ? `Suspend "${confirm.tenantName}"?`
              : `Reactivate "${confirm.tenantName}"?`
          }
          message={
            confirm.type === 'delete'
              ? 'This is permanent. All shop data, billing history, and the owner account will be removed from the cloud. This cannot be undone.'
              : confirm.type === 'suspend'
              ? 'The shop will lose access immediately. The owner will see a suspension notice when they try to log in.'
              : 'The shop will regain full access immediately.'
          }
          confirmLabel={
            confirm.type === 'delete' ? 'Yes, Delete Permanently' :
            confirm.type === 'suspend' ? 'Suspend Account' : 'Reactivate Account'
          }
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.type === 'suspend') executeSuspend(confirm.tenantId)
            else if (confirm.type === 'reactivate') executeReactivate(confirm.tenantId)
            else executeDelete(confirm.tenantId)
          }}
        />
      )}

      <PageHeader
        title="Super Admin"
        subtitle="Duka POS Platform Management"
        action={<button className="btn-ghost" onClick={logout}>Sign out</button>}
      />

      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500 ring-1 ring-red-500/20">
          <ShieldAlert size={16} />
          {actionError}
          <button onClick={() => setActionError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ── Metrics ───────────────────────────────────────────────────────── */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Shops', value: tenants.length, color: 'text-brand-700 dark:text-gold-400' },
              { label: 'Paying', value: paying.length, color: 'text-green-600 dark:text-green-400' },
              { label: 'At Risk / Suspended', value: atRisk.length, color: 'text-red-600 dark:text-red-400' },
              { label: 'Est. MRR', value: money(mrr, 'KES'), color: 'text-brand-700 dark:text-gold-400' },
            ].map((kpi) => (
              <div key={kpi.label} className="card p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-900/50 dark:text-white/50 mb-1">{kpi.label}</div>
                <div className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</div>
              </div>
            ))}
          </div>
          <div className="card p-6">
            <h3 className="font-bold text-brand-900 dark:text-white mb-4">Platform Overview</h3>
            <div className="h-40 flex items-center justify-center rounded-xl border border-dashed border-black/10 dark:border-white/10">
              <p className="text-brand-900/40 dark:text-white/40 text-sm font-medium">Metrics visualization will appear here as data grows.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tenants ───────────────────────────────────────────────────────── */}
      {activeTab === 'tenants' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-black/5 dark:border-white/5">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/30 dark:text-white/30" />
              <input
                type="text"
                placeholder="Search by name, phone, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-xl border border-black/10 dark:border-white/10 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:text-white"
              />
            </div>
            <button className="btn-ghost py-1.5 px-3 text-sm" onClick={() => loadData()}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-brand-900/50 dark:text-white/50">Loading tenants…</div>
          ) : error ? (
            <div className="p-10 text-center text-red-500">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-brand-50/50 dark:bg-white/5 text-[11px] font-bold uppercase tracking-wider text-brand-900/50 dark:text-white/50">
                  <tr>
                    <th className="p-4">Shop</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Fee / Owing</th>
                    <th className="p-4">Renews</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {filtered.map((t) => (
                    <TenantRow
                      key={t.id}
                      t={t}
                      actionLoading={actionLoading}
                      onSuspend={(id, name) => setConfirm({ type: 'suspend', tenantId: id, tenantName: name })}
                      onReactivate={(id, name) => setConfirm({ type: 'reactivate', tenantId: id, tenantName: name })}
                      onDelete={(id, name) => setConfirm({ type: 'delete', tenantId: id, tenantName: name })}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center">
                        <Store size={32} className="mx-auto mb-2 text-brand-900/20 dark:text-white/20" />
                        <p className="text-brand-900/50 dark:text-white/50 text-sm">
                          {search ? 'No shops match your search.' : 'No shops registered yet.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Health ────────────────────────────────────────────────────────── */}
      {activeTab === 'health' && (
        <div className="card p-8 text-center max-w-lg mx-auto mt-10">
          <Activity size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-brand-900 dark:text-white mb-2">System Healthy</h2>
          <p className="text-brand-900/60 dark:text-white/60 mb-6">All platform services are operating normally. The billing scheduler is active.</p>
          <button
            className="btn-primary"
            onClick={async () => {
              try {
                const url = import.meta.env.VITE_API_URL || 'http://localhost:8787'
                const sb = supabase()
                const { data } = await sb?.auth.getSession() || {}
                await fetch(`${url}/api/admin/run-billing`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${data?.session?.access_token}` },
                })
                alert('Billing sweep triggered successfully.')
              } catch {
                alert('Failed to run sweep.')
              }
            }}
          >
            Force Billing Sweep
          </button>
        </div>
      )}

      {/* ── Demo Control Center ───────────────────────────────────────────── */}
      {activeTab === 'demo' && <DemoControlCenter />}
    </div>
  )
}

// ── Demo Control Center component ─────────────────────────────────────────
const SEEDERS = [
  {
    id: 'restaurant',
    label: 'Seed Restaurant',
    icon: '🍽️',
    desc: '15 menu items (no stock tracking), tables & kitchen flow.',
    color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:border-orange-400/60',
    fn: seedRestaurant,
  },
  {
    id: 'pharmacy',
    label: 'Seed Pharmacy',
    icon: '💊',
    desc: '15 drugs with expiry dates, batch numbers & Rx flags.',
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60',
    fn: seedPharmacy,
  },
  {
    id: 'boutique',
    label: 'Seed Boutique',
    icon: '👗',
    desc: '15 clothing items with sizes, colors & accessories.',
    color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30 hover:border-pink-400/60',
    fn: seedBoutique,
  },
  {
    id: 'autospares',
    label: 'Seed Auto Spares',
    icon: '🔧',
    desc: '15 parts with compatibility (Make/Model/Year) & warranty.',
    color: 'from-slate-500/20 to-slate-600/10 border-slate-500/30 hover:border-slate-400/60',
    fn: seedAutoSpares,
  },
  {
    id: 'hardware',
    label: 'Seed Hardware & Spices',
    icon: '🏗️',
    desc: '15 items sold by kg/m/bag — fractional quantities demo.',
    color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/60',
    fn: seedHardwareSpices,
  },
  {
    id: 'shop',
    label: 'Seed Duka / Mini-Mart',
    icon: '🏪',
    desc: '15 groceries and household items for basic retail.',
    color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/60',
    fn: seedShop,
  },
  {
    id: 'electronics',
    label: 'Seed Electronics',
    icon: '💻',
    desc: '15 gadgets with warranties and serial numbers.',
    color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-400/60',
    fn: seedElectronics,
  },
  {
    id: 'agrovet',
    label: 'Seed Agrovet',
    icon: '🌱',
    desc: '15 farming supplies with expiry dates and pack sizes.',
    color: 'from-lime-500/20 to-lime-600/10 border-lime-500/30 hover:border-lime-400/60',
    fn: seedAgrovet,
  },
  {
    id: 'spices',
    label: 'Seed Spices & Cereals',
    icon: '🌶️',
    desc: '15 cereals & spices sold by fractional kg weight.',
    color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 hover:border-yellow-400/60',
    fn: seedSpices,
  },
  {
    id: 'wholesale',
    label: 'Seed Wholesale',
    icon: '📦',
    desc: '15 bulk items with wholesale pricing layers.',
    color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 hover:border-indigo-400/60',
    fn: seedWholesale,
  },
  {
    id: 'babyshop',
    label: 'Seed Baby Shop',
    icon: '👶',
    desc: '15 baby items with sizes and age ranges.',
    color: 'from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-500/30 hover:border-fuchsia-400/60',
    fn: seedBabyshop,
  },
]

function DemoControlCenter() {
  const navigate = useNavigate()
  const [seeded, setSeeded] = useState<string | null>(null)
  const [wiping, setWiping] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)

  function runSeed(seeder: typeof SEEDERS[0]) {
    seeder.fn()
    setSeeded(seeder.label)
    useStore.setState({ _isDemo: true })
    setTimeout(() => {
      setSeeded(null)
      navigate('/pos', { replace: true })
    }, 500) // Small delay so they see the success toast briefly before jumping
  }

  function runWipe() {
    setWiping(true)
    wipeLocalStore()
    setConfirmWipe(false)
    setTimeout(() => {
      setWiping(false)
    }, 800)
  }

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/30">
        <FlaskConical size={20} className="shrink-0 text-amber-500 mt-0.5" />
        <div>
          <p className="font-bold text-amber-600 dark:text-amber-400">Local Only — Never synced to Supabase</p>
          <p className="mt-0.5 text-sm text-amber-600/80 dark:text-amber-400/70">
            All seed buttons write exclusively to this device's local store. No demo data touches the production database. 
            Use this for client presentations only.
          </p>
        </div>
      </div>

      {/* Success toast */}
      {seeded && (
        <div className="flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400 ring-1 ring-green-500/20">
          <Zap size={15} /> {seeded} loaded — open the POS to demo it! Demo PIN: Owner 1234 · Cashier 0000
        </div>
      )}

      {/* Seed buttons grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SEEDERS.map((s) => (
          <button
            key={s.id}
            onClick={() => runSeed(s)}
            className={`group flex flex-col items-start gap-3 rounded-2xl border bg-gradient-to-br p-5 text-left transition-all duration-200 hover:shadow-lg active:scale-[0.98] ${s.color}`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-3xl">{s.icon}</span>
              <Zap size={16} className="text-white/20 transition group-hover:text-white/60" />
            </div>
            <div>
              <div className="font-bold text-brand-900 dark:text-white">{s.label}</div>
              <div className="mt-1 text-xs text-brand-900/60 dark:text-white/50">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Wipe section */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <Trash size={18} />
            </div>
            <div>
              <div className="font-bold text-brand-900 dark:text-white">Clear Demo Data (Wipe Local Store)</div>
              <div className="text-xs text-brand-900/50 dark:text-white/50">Clears all local data. Refuses to run if there are unsynced changes in the queue.</div>
            </div>
          </div>
          {confirmWipe ? (
            <div className="flex gap-2">
              <button className="btn-ghost py-2 px-3 text-sm" onClick={() => setConfirmWipe(false)}>Cancel</button>
              <button className="btn-danger py-2 px-3 text-sm" onClick={runWipe} disabled={wiping}>
                {wiping ? 'Wiping…' : 'Confirm Wipe'}
              </button>
            </div>
          ) : (
            <button 
              className="btn-danger py-2 px-4 text-sm disabled:opacity-50" 
              onClick={() => setConfirmWipe(true)}
              disabled={useStore((s) => s.syncQueue.length > 0)}
              title={useStore((s) => s.syncQueue.length > 0) ? 'Cannot wipe: sync queue has pending items' : ''}
            >
              Clear Demo Data
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

