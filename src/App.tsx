import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { canStaff, type Capability } from './lib/permissions'
import Reports from './pages/Reports'
import Assistant from './pages/Assistant'
import SuperAdmin from './pages/SuperAdmin'
import Kitchen from './pages/Kitchen'
import type { ReactNode } from 'react'

function HomeRedirect() {
  const role = useStore(selectRole)
  const staff = useStore(selectCurrentStaff)
  if (!role) return <Navigate to="/" replace />
  // Cashiers without report viewing go to POS. Owners/managers go to Dashboard.
  if (role === 'cashier' && !canStaff(staff, 'viewReports')) {
    return <Navigate to="/pos" replace />
  }
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  const hydrated = useStore((s) => s._hasHydrated)
  const dark = useStore((s) => s.dark)
  const role = useStore(selectRole)
  const staffList = useStore((s) => s.staff)

  // Runs automated debt reminders while the app is open and online.
  useAutomation()
  // Keeps subscription status in step with the platform backend (when connected).
  useBillingSync()
  // Live multi-device cloud sync (when Supabase is configured + shop signed in).
  const { status: cloudStatus } = useCloudSync()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Safety net: never leave anyone staring at the splash screen. If restoring
  // saved data hasn't finished within 3s, open with a fresh session.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useStore.getState()._hasHydrated) useStore.setState({ _hasHydrated: true })
    }, 3000)
    return () => clearTimeout(t)
  }, [])

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-brand-900 text-white">
        <div className="animate-pulse text-center">
          <div className="text-3xl font-black tracking-tight">Duka</div>
          <div className="text-sm text-white/60">loading your shop…</div>
        </div>
      </div>
    )
  }

  const loc = useLocation()

  // Super admin should be accessible without a shop PIN (it has its own token lock)
  const isSuperAdmin = loc.pathname === '/superadmin'

  // SaaS Auth & Onboarding flow
  if (cloudStatus === 'initializing') {
    return (
      <div className="flex h-full items-center justify-center bg-brand-900 text-white">
        <div className="animate-pulse text-center">
          <div className="text-3xl font-black tracking-tight">Duka</div>
          <div className="text-sm text-white/60">connecting…</div>
        </div>
      </div>
    )
  }
  if (cloudStatus === 'signedOut') return <AuthPage />

  // Role-Based Routing: Force superadmins to the superadmin dashboard, and block standard users from it.
  if (cloudStatus === 'superadmin' && loc.pathname !== '/superadmin') {
    return <Navigate to="/superadmin" replace />
  }
  if (cloudStatus !== 'superadmin' && loc.pathname === '/superadmin') {
    return <Navigate to="/" replace />
  }

  if (cloudStatus === 'onboarding') return <OnboardingPage />

  // No staff yet → first-run setup (local-first, works offline too)
  if (staffList.length === 0) return <OnboardingPage />

  // No one is signed in on this device → show the PIN lock screen.
  if (!role && !isSuperAdmin) return <LockScreen />

  if (isSuperAdmin) {
    return (
      <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-brand-900 overflow-y-auto px-4 py-6 md:px-8">
        <Routes>
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="*" element={<Navigate to="/superadmin" replace />} />
        </Routes>
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<Guard cap="viewReports" role={role}><Dashboard /></Guard>} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/debts" element={<Guard cap="viewDebts" role={role}><Debts /></Guard>} />
        <Route path="/products" element={<Guard cap="manageStock" role={role}><Products /></Guard>} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/suppliers" element={<Guard cap="manageStock" role={role}><Suppliers /></Guard>} />
        <Route path="/reports" element={<Guard cap="viewReports" role={role}><Reports /></Guard>} />
        <Route path="/staff" element={<Guard cap="editSettings" role={role}><Staff /></Guard>} />
        <Route path="/warehouse" element={<Guard cap="transferStock" role={role}><Branches /></Guard>} />
        <Route path="/billing" element={<Guard cap="editSettings" role={role}><Subscription /></Guard>} />
        {/* Legacy redirect — old links / bookmarks still work */}
        <Route path="/owner-panel" element={<Navigate to="/billing" replace />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/settings" element={<Guard cap="editSettings" role={role}><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

/** Redirects to the till if the signed-in staff member lacks a capability
 *  (their role's powers plus any extra permissions the owner granted). */
function Guard({ cap, children }: { cap: Capability; role: ReturnType<typeof selectRole>; children: ReactNode }) {
  const staff = useStore(selectCurrentStaff)
  if (!canStaff(staff, cap)) return <Navigate to="/" replace />
  return <>{children}</>
}
