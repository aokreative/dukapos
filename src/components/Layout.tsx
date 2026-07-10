import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  Settings as SettingsIcon,
  HandCoins,
  CreditCard,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  Lock,
  Sparkles,
} from 'lucide-react'
import { useStore, selectTotalOwed, selectCurrentStaff, selectRole, selectCurrentLocation } from '../store/useStore'
import { money } from '../lib/format'
import { useOnline } from '../lib/useOnline'
import { can, ROLE_LABEL, type Capability } from '../lib/permissions'
import { bizLabels } from '../lib/labels'
import { Building2 } from 'lucide-react'
import { BillingBanner, Paywall, useBilling } from './Billing'

const NAV: { to: string; label: string; icon: typeof ShoppingCart; cap?: Capability }[] = [
  { to: '/', label: 'Sell', icon: ShoppingCart },
  { to: '/debts', label: 'Debts', icon: HandCoins, cap: 'viewDebts' },
  { to: '/customers', label: 'Customers', icon: Users, cap: 'manageCustomers' },
  { to: '/products', label: 'Stock', icon: Package, cap: 'manageStock' },
  { to: '/branches', label: 'Branches', icon: Building2, cap: 'transferStock' },
  { to: '/reports', label: 'Reports', icon: BarChart3, cap: 'viewReports' },
  { to: '/assistant', label: 'Duka AI', icon: Sparkles, cap: 'useAssistant' },
  { to: '/subscription', label: 'Billing', icon: CreditCard, cap: 'viewBilling' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, cap: 'editSettings' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const dark = useStore((s) => s.dark)
  const toggleDark = useStore((s) => s.toggleDark)
  const shopName = useStore((s) => s.settings.name)
  const totalOwed = useStore(selectTotalOwed)
  const online = useOnline()
  const loc = useLocation()
  const { billing } = useBilling()
  const billingAlert = billing.status !== 'active'
  const role = useStore(selectRole)
  const currentStaff = useStore(selectCurrentStaff)
  const logout = useStore((s) => s.logout)
  const labels = bizLabels(useStore((s) => s.settings.businessType))
  const location = useStore(selectCurrentLocation)
  const multiLoc = useStore((s) => s.locations.length > 1)
  const nav = NAV.filter((n) => !n.cap || can(role, n.cap)).map((n) =>
    n.to === '/products' ? { ...n, label: labels.stock } : n,
  )

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col md:flex-row">
      {/* Desktop side rail */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-black/5 bg-white px-3 py-5 dark:border-white/10 dark:bg-brand-900 md:flex">
        <Brand shopName={shopName} />
        {multiLoc && location && (
          <NavLink to="/branches" className="mt-2 flex items-center gap-1.5 rounded-lg bg-black/5 px-2.5 py-1.5 text-[11px] font-semibold text-brand-900/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15">
            <Building2 size={12} /> At: {location.name}
          </NavLink>
        )}
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => railClass(isActive)} end={n.to === '/'}>
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.to === '/debts' && totalOwed > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {money(totalOwed).replace('KES ', '')}
                </span>
              )}
              {n.to === '/subscription' && billingAlert && <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" />}
            </NavLink>
          ))}
        </nav>
        {currentStaff && (
          <button onClick={logout} className="mb-2 flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-left transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15" title="Lock / switch user">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-gold-400">{currentStaff.name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-brand-900 dark:text-white">{currentStaff.name}</span>
              <span className="block text-[11px] text-brand-900/50 dark:text-white/50">{role && ROLE_LABEL[role]}</span>
            </span>
            <Lock size={15} className="text-brand-900/40 dark:text-white/40" />
          </button>
        )}
        <FooterControls dark={dark} toggleDark={toggleDark} online={online} />
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-brand-900 md:hidden">
          <Brand shopName={shopName} />
          <div className="flex items-center gap-1">
            <span
              className={`chip ${online ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'}`}
              title={online ? 'Online' : 'Offline — sales still work'}
            >
              {online ? <Wifi size={13} /> : <WifiOff size={13} />}
              {online ? 'Online' : 'Offline'}
            </span>
            <button className="rounded-full p-2 text-brand-900/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10" onClick={toggleDark} aria-label="Toggle theme">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {currentStaff && (
              <button onClick={logout} className="flex items-center gap-1 rounded-full bg-black/5 py-1 pl-1 pr-2.5 dark:bg-white/10" title="Lock / switch user">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-gold-400">{currentStaff.name.charAt(0).toUpperCase()}</span>
                <Lock size={13} className="text-brand-900/50 dark:text-white/50" />
              </button>
            )}
          </div>
        </header>

        <BillingBanner />

        {/* Content */}
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10" key={loc.pathname}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/10 dark:bg-brand-900/95 md:hidden">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => tabClass(isActive)} end={n.to === '/'}>
            <div className="relative">
              <n.icon size={20} />
              {n.to === '/debts' && totalOwed > 0 && (
                <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
              {n.to === '/subscription' && billingAlert && <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-amber-400" />}
            </div>
            <span className="text-[9px] font-medium">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Suspended account paywall */}
      <Paywall />
    </div>
  )
}

function Brand({ shopName }: { shopName: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-black text-gold-400">D</div>
      <div className="leading-tight">
        <div className="text-base font-black tracking-tight text-brand-900 dark:text-white">{shopName || 'Duka'}</div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-brand-900/40 dark:text-white/40">POS</div>
      </div>
    </div>
  )
}

function FooterControls({ dark, toggleDark, online }: { dark: boolean; toggleDark: () => void; online: boolean }) {
  return (
    <div className="mt-auto flex items-center justify-between">
      <span
        className={`chip ${online ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'}`}
      >
        {online ? <Wifi size={13} /> : <WifiOff size={13} />}
        {online ? 'Online' : 'Offline'}
      </span>
      <button className="rounded-full p-2 text-brand-900/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10" onClick={toggleDark} aria-label="Toggle theme">
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  )
}

function railClass(active: boolean) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    active ? 'bg-brand-600 text-white' : 'text-brand-900/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10'
  }`
}

function tabClass(active: boolean) {
  return `flex flex-1 flex-col items-center gap-0.5 py-2 transition ${
    active ? 'text-brand-600 dark:text-gold-400' : 'text-brand-900/50 dark:text-white/50'
  }`
}
