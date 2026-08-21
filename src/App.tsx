import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore, selectRole, selectCurrentStaff } from './store/useStore'
import Layout from './components/Layout'
import LockScreen from './components/LockScreen'
import POS from './pages/POS'
import Debts from './pages/Debts'
import Settings from './pages/Settings'
import Sales from './pages/Sales'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import Branches from './pages/Branches'
import Subscription from './pages/Subscription'
import Staff from './pages/Staff'
import Dashboard from './pages/Dashboard'
import AuthPage from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import { useAutomation } from './lib/useAutomation'
import { useBillingSync } from './lib/useBillingSync'
import { useCloudSync } from './lib/useCloudSync'
import { useStaffSession } from './lib/useStaffSession'
import { canStaff, type Capability } from './lib/permissions'
import Reports from './pages/Reports'
import Assistant from './pages/Assistant'
import SuperAdmin from './pages/SuperAdmin'
import Kitchen from './pages/Kitchen'
import { ErrorBoundary } from './components/ErrorBoundary'

export function resetAuth() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (url) {
    try {
      // Iterate keys and remove any matching /^sb-.*-auth-token/
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.match(/^sb-.*-auth-token/)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
    } catch { /* malformed URL */ }
  }

  useStore.setState({ currentStaffId: null, serverBilling: null, staffLastActiveAt: 0 })
  window.location.href = '/'
}

export function BootWatchdog({ children }: { children: ReactNode }) {
  const [stuck, setStuck] = useState(false)
  const booted = useStore((s) => s._booted)

  useEffect(() => {
    if (booted) return
    const t = setTimeout(() => setStuck(true), 8000)
    return () => clearTimeout(t)
  }, [booted])

  if (stuck && !booted) {
    const { _cloudSession, _cloudRole, _hasHydrated } = useStore.getState()
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-brand-900 p-8 text-center text-white">
        <div className="text-3xl font-black">Duka</div>
        <p className="text-white/60">The app failed to start within 8 seconds.</p>
        <div className="rounded-xl bg-white/5 p-4 text-left text-sm font-mono text-white/50">
          <div>Hydrated: {String(_hasHydrated)}</div>
          <div>Session: {_cloudSession}</div>
          <div>Role: {_cloudRole || 'none'}</div>
        </div>
        <button
          className="rounded-xl bg-red-600 px-6 py-3 font-bold text-white"
          onClick={resetAuth}
        >
          Reset app data
        </button>
      </div>
    )
  }

  return <>{children}</>
}

function BootSplash({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-brand-900 text-white">
      <div className="animate-pulse text-center">
        <div className="text-3xl font-black tracking-tight">Duka</div>
        <div className="text-sm text-white/60">{label}</div>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-6xl font-black text-brand-900/20 dark:text-white/10">404</div>
      <p className="text-brand-900/60 dark:text-white/60">This page doesn't exist.</p>
      <a href="/" className="rounded-xl bg-brand-600 px-6 py-3 font-bold text-white">
        Go home
      </a>
    </div>
  )
}

function HomeRedirect() {
  const staffRole = useStore(selectRole)
  const staff = useStore(selectCurrentStaff)
  const cloudRole = useStore((s) => s._cloudRole)

  if (cloudRole === 'superadmin') return <Navigate to="/superadmin" replace />

  if (staffRole === 'cashier' && !canStaff(staff, 'viewReports')) {
    return <Navigate to="/pos" replace />
  }

  if (staffRole) return <Navigate to="/dashboard" replace />
  return <Navigate to="/pos" replace />
}

export default function App() {
  const hydrated = useStore((s) => s._hasHydrated)
  const dark = useStore((s) => s.dark)
  const staffSessionValid = useStaffSession()
  
  const session = useStore((s) => s._cloudSession)
  const role = useStore((s) => s._cloudRole)
  const onboarding = useStore((s) => s._cloudOnboarding)
  const unreachable = useStore((s) => s._cloudUnreachable)
  const staffCount = useStore((s) => s.staff.length)

  useAutomation()
  useBillingSync()
  useCloudSync()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    if (hydrated && session !== 'initializing') {
      useStore.setState({ _booted: true })
    }
  }, [hydrated, session])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!useStore.getState()._hasHydrated) useStore.setState({ _hasHydrated: true })
    }, 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <ErrorBoundary onReset={resetAuth}>
      {!hydrated ? (
        <BootSplash label="loading your shop…" />
      ) : session === 'initializing' ? (
        <BootSplash label="connecting…" />
      ) : session === 'signedOut' || session === 'error' ? (
        <AuthPage unreachable={unreachable || session === 'error'} />
      ) : session === 'off' ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center bg-brand-900 text-white">
          <div className="text-xl font-bold text-red-400">Database Offline</div>
          <p className="text-white/60">Vercel env vars are missing or Supabase is unconfigured.</p>
        </div>
      ) : session !== 'signedIn' ? (
        /* Final fallback: any unrecognised session value → AuthPage.
           This is what made /superadmin blank while signed out. */
        <AuthPage unreachable={unreachable} />
      ) : role === 'superadmin' ? (
        <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-brand-900 overflow-y-auto px-4 py-6 md:px-8">
          <Routes>
            <Route path="/superadmin" element={<SuperAdmin />} />
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      ) : onboarding === 'pending' || staffCount === 0 ? (
        <OnboardingPage />
      ) : !staffSessionValid ? (
        <LockScreen />
      ) : (
        <Layout isSuperAdmin={false}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/dashboard" element={<Guard cap="viewReports"><Dashboard /></Guard>} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/debts" element={<Guard cap="viewDebts"><Debts /></Guard>} />
            <Route path="/products" element={<Guard cap="manageStock"><Products /></Guard>} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Guard cap="manageStock"><Suppliers /></Guard>} />
            <Route path="/reports" element={<Guard cap="viewReports"><Reports /></Guard>} />
            <Route path="/staff" element={<Guard cap="editSettings"><Staff /></Guard>} />
            <Route path="/warehouse" element={<Guard cap="transferStock"><Branches /></Guard>} />
            <Route path="/billing" element={<Guard cap="editSettings"><Subscription /></Guard>} />
            <Route path="/owner-panel" element={<Navigate to="/billing" replace />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/settings" element={<Guard cap="editSettings"><Settings /></Guard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      )}
    </ErrorBoundary>
  )
}

function Guard({ cap, children }: { cap: Capability; children: ReactNode }) {
  const staff = useStore(selectCurrentStaff)
  if (!canStaff(staff, cap)) return <Navigate to="/pos" replace />
  return <>{children}</>
}

