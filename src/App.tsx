import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore, selectRole } from './store/useStore'
import Layout from './components/Layout'
import LockScreen from './components/LockScreen'
import POS from './pages/POS'
import Debts from './pages/Debts'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Subscription from './pages/Subscription'
import Assistant from './pages/Assistant'
import Branches from './pages/Branches'
import Suppliers from './pages/Suppliers'
import { useAutomation } from './lib/useAutomation'
import { useBillingSync } from './lib/useBillingSync'
import { useCloudSync } from './lib/useCloudSync'
import { can, type Capability } from './lib/permissions'
import type { ReactNode } from 'react'

export default function App() {
  const hydrated = useStore((s) => s._hasHydrated)
  const dark = useStore((s) => s.dark)
  const role = useStore(selectRole)

  // Runs automated debt reminders while the app is open and online.
  useAutomation()
  // Keeps subscription status in step with the platform backend (when connected).
  useBillingSync()
  // Live multi-device cloud sync (when Supabase is configured + shop signed in).
  useCloudSync()

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

  // No one is signed in on this device → show the PIN lock screen.
  if (!role) return <LockScreen />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<POS />} />
        <Route path="/debts" element={<Guard cap="viewDebts" role={role}><Debts /></Guard>} />
        <Route path="/customers" element={<Guard cap="manageCustomers" role={role}><Customers /></Guard>} />
        <Route path="/products" element={<Guard cap="manageStock" role={role}><Products /></Guard>} />
        <Route path="/branches" element={<Guard cap="transferStock" role={role}><Branches /></Guard>} />
        <Route path="/suppliers" element={<Guard cap="manageSuppliers" role={role}><Suppliers /></Guard>} />
        <Route path="/reports" element={<Guard cap="viewReports" role={role}><Reports /></Guard>} />
        <Route path="/assistant" element={<Guard cap="useAssistant" role={role}><Assistant /></Guard>} />
        <Route path="/subscription" element={<Guard cap="viewBilling" role={role}><Subscription /></Guard>} />
        <Route path="/settings" element={<Guard cap="editSettings" role={role}><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

/** Redirects to the till if the signed-in role lacks a capability. */
function Guard({ cap, role, children }: { cap: Capability; role: ReturnType<typeof selectRole>; children: ReactNode }) {
  if (!can(role, cap)) return <Navigate to="/" replace />
  return <>{children}</>
}
