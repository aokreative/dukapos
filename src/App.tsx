import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import POS from './pages/POS'
import Debts from './pages/Debts'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

export default function App() {
  const hydrated = useStore((s) => s._hasHydrated)
  const dark = useStore((s) => s.dark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

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

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<POS />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/products" element={<Products />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
