import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  Settings as SettingsIcon,
  HandCoins,
  Moon,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useStore, selectTotalOwed } from '../store/useStore'
import { money } from '../lib/format'
import { useOnline } from '../lib/useOnline'

const NAV = [
  { to: '/', label: 'Sell', icon: ShoppingCart },
  { to: '/debts', label: 'Debts', icon: HandCoins },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/products', label: 'Stock', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function Layout({ children }: { children: ReactNode }) {
  const dark = useStore((s) => s.dark)
  const toggleDark = useStore((s) => s.toggleDark)
  const shopName = useStore((s) => s.settings.name)
  const totalOwed = useStore(selectTotalOwed)
  const online = useOnline()
  const loc = useLocation()

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col md:flex-row">
      {/* Desktop side rail */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-black/5 bg-white px-3 py-5 dark:border-white/10 dark:bg-brand-900 md:flex">
        <Brand shopName={shopName} />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => railClass(isActive)} end={n.to === '/'}>
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.to === '/debts' && totalOwed > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {money(totalOwed).replace('KES ', '')}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <FooterControls dark={dark} toggleDark={toggleDark} online={online} />
      </aside>

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
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10" key={loc.pathname}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/10 dark:bg-brand-900/95 md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => tabClass(isActive)} end={n.to === '/'}>
            <div className="relative">
              <n.icon size={22} />
              {n.to === '/debts' && totalOwed > 0 && (
                <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </div>
            <span className="text-[10px] font-medium">{n.label}</span>
          </NavLink>
        ))}
      </nav>
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
