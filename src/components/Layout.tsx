import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  ShoppingCart,
  Package,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  PieChart,
  Users,
  Truck,
  Building2,
  Crown,
  Sparkles,
  LogOut
} from 'lucide-react'
import { useStore, selectTotalOwed, selectCurrentStaff } from '../store/useStore'
import { money } from '../lib/format'
import { useOnline } from '../lib/useOnline'
import { canStaff, type Capability } from '../lib/permissions'
import { BillingBanner, Paywall, useBilling } from './Billing'
import ShiftBar from './ShiftBar'

// Note: PiggyBank and ChefHat are added.
import { PiggyBank, ChefHat, UtensilsCrossed } from 'lucide-react'
import { getFeatures } from '../lib/labels'


export default function Layout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const dark = useStore((s) => s.dark)
  const toggleDark = useStore((s) => s.toggleDark)
  const shopName = useStore((s) => s.settings.name)
  const totalOwed = useStore(selectTotalOwed)
  const online = useOnline()
  const loc = useLocation()
  const { billing } = useBilling()
  const billingAlert = billing.status !== 'active'
  const currentStaff = useStore(selectCurrentStaff)
  const logout = useStore((s) => s.logout)
  const settings = useStore((s) => s.settings)
  const currentStaffFull = useStore(selectCurrentStaff)
  const isPharmacy = settings.businessType === 'pharmacy'
  const isRestaurant = settings.businessType === 'restaurant'
  const features = getFeatures(settings)

  const nav = [
    { to: '/dashboard', label: 'Dashboard', icon: Home, cap: 'viewReports' as Capability },
    { to: '/pos', label: isRestaurant ? 'New Order' : 'Point of Sale', icon: isRestaurant ? UtensilsCrossed : ShoppingCart },
    { to: '/kitchen', label: 'Kitchen', icon: ChefHat },
    { to: '/products', label: isRestaurant ? 'Menu' : 'Inventory', icon: Package, cap: 'manageStock' as Capability },
    { to: '/debts', label: 'Debts & Mkopo', icon: PiggyBank, cap: 'viewDebts' as Capability },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/suppliers', label: 'Suppliers', icon: Truck, cap: 'manageStock' as Capability },
    { to: '/reports', label: 'Reports', icon: PieChart, cap: 'viewReports' as Capability },
    { to: '/assistant', label: 'Duka AI', icon: Sparkles, cap: 'useAssistant' as Capability },
    { to: '/warehouse', label: isRestaurant ? 'Store' : 'Warehouse', icon: Building2, cap: 'transferStock' as Capability },
    { to: '/billing', label: 'Billing', icon: Crown, cap: 'editSettings' as Capability },
    { to: '/settings', label: 'Settings', icon: SettingsIcon, cap: 'editSettings' as Capability },
  ].filter((n) => {
    if (n.cap && !canStaff(currentStaffFull, n.cap)) return false
    if (isPharmacy && (n.to === '/customers' || n.to === '/debts')) return false
    if (isRestaurant && (n.to === '/suppliers' || n.to === '/debts')) return false
    if (!isRestaurant && n.to === '/kitchen') return false
    if (!features.branches && n.to === '/warehouse') return false
    return true
  })

  return (
    <div className="flex h-screen flex-col md:flex-row overflow-hidden">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-[#0A4C24] p-4 md:hidden shrink-0">
        <div className="text-xl font-black tracking-tight text-white">Duka</div>
        <button className="text-white" onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Sidebar navigation — fixed height, never scrolls away */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0A4C24] transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 md:shrink-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <Brand shopName={shopName} logo={settings.logo} light />
          <button className="text-white md:hidden" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin" onClick={() => setMenuOpen(false)}>
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
        <div className="px-4">
          {currentStaff && (
            <button onClick={logout} className="mb-4 flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3 text-left transition w-full hover:bg-red-500/20 active:scale-[0.98]" title="Lock System / Sign out">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-300">{currentStaff.name.charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-red-100">{currentStaff.name}</span>
                <span className="block text-[11px] font-bold tracking-wide uppercase text-red-400">Lock System</span>
              </span>
              <LogOut size={18} className="text-red-400 shrink-0" />
            </button>
          )}
          <FooterControls dark={dark} toggleDark={toggleDark} online={online} light />
        </div>
      </div>

      {/* Content column — this is the only scrollable area */}
      <div className="flex min-w-0 flex-1 flex-col bg-gray-50 dark:bg-brand-900 overflow-y-auto">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-white px-4 py-3 shadow-sm dark:bg-brand-900 md:hidden">
          <Brand shopName={shopName} logo={settings.logo} />
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
              <button onClick={logout} className="flex items-center gap-1 rounded-full bg-black/5 py-1 pl-1 pr-2.5 dark:bg-white/10" title="Sign out">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-gold-400">{currentStaff.name.charAt(0).toUpperCase()}</span>
                <LogOut size={13} className="text-brand-900/50 dark:text-white/50" />
              </button>
            )}
          </div>
        </header>

        <BillingBanner />
        <ShiftBar />

        {/* Content */}
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:overflow-visible" key={loc.pathname}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] dark:bg-brand-900 md:hidden">
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

function Brand({ shopName, logo, light }: { shopName: string; logo?: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {logo ? (
        <img src={logo} alt="" className="h-10 w-10 rounded bg-white object-contain p-0.5 shadow-sm shadow-brand-900/20" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-gold-400 text-lg font-black text-brand-900 shadow-sm shadow-brand-900/30">D</div>
      )}
      <div className="leading-tight">
        <div className={`text-sm font-black tracking-widest uppercase ${light ? 'text-white' : 'text-brand-900 dark:text-white'}`}>DUKA POS</div>
        <div className={`text-xs font-medium ${light ? 'text-white/70' : 'text-brand-900/50 dark:text-white/50'}`}>{shopName || 'Kamau Hardware'}</div>
      </div>
    </div>
  )
}

function FooterControls({ dark, toggleDark, online, light }: { dark: boolean; toggleDark: () => void; online: boolean; light?: boolean }) {
  return (
    <div className="mt-auto flex items-center justify-between">
      <span
        className={`chip ${online ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}
      >
        {online ? <Wifi size={13} /> : <WifiOff size={13} />}
        {online ? 'Online' : 'Offline'}
      </span>
      <button className={`rounded-full p-2 ${light ? 'text-white/70 hover:bg-white/10' : 'text-brand-900/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10'}`} onClick={toggleDark} aria-label="Toggle theme">
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  )
}

function railClass(active: boolean) {
  return `flex items-center gap-3 px-4 py-3 text-sm font-semibold transition ${
    active
      ? 'border-l-4 border-[#FFD700] bg-white/10 text-[#FFD700]'
      : 'border-l-4 border-transparent text-white/70 hover:bg-white/5 hover:text-white'
  }`
}

function tabClass(active: boolean) {
  return `flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 transition ${
    active ? 'text-brand-600 dark:text-gold-400' : 'text-brand-900/50 dark:text-white/50'
  }`
}
