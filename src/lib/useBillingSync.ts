// Keeps the app's subscription status in step with the platform backend.
// When VITE_API_URL is set, the shop is registered with the biller and its
// paid/unpaid status is read from the server — so holds and suspensions are
// authoritative (a shop can't dodge billing by clearing its device). When no
// backend is configured, this does nothing and the app uses local billing.
import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { registerTenant, getTenantStatus, isLive } from './api'
import { isValidPhone } from './format'

const SYNC_MS = 60_000

export function useBillingSync() {
  useEffect(() => {
    if (!isLive) return
    let cancelled = false
    const pushed = { planId: '', cycle: '', autoRenew: null as boolean | null }

    async function sync() {
      const st = useStore.getState()
      if (!isValidPhone(st.settings.phone)) return

      const { tenantId, subscription, settings } = st
      const changed =
        pushed.planId !== subscription.planId ||
        pushed.cycle !== subscription.billingCycle ||
        pushed.autoRenew !== subscription.autoRenew

      let view = null
      if (!tenantId || changed) {
        view = await registerTenant({
          business: settings.name,
          phone: settings.phone,
          planId: subscription.planId,
          cycle: subscription.billingCycle,
          autoRenew: subscription.autoRenew,
        })
        if (view) {
          pushed.planId = subscription.planId
          pushed.cycle = subscription.billingCycle
          pushed.autoRenew = subscription.autoRenew
          if (view.id !== tenantId) useStore.getState().setTenantId(view.id)
        }
      } else {
        view = await getTenantStatus(tenantId)
      }
      if (view && !cancelled) useStore.getState().setServerBilling(view)
    }

    sync()
    const id = setInterval(sync, SYNC_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])
}
