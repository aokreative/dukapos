// Keeps the app's subscription status in step with the platform backend.
// When VITE_API_URL is set, the shop is registered with the biller and its
// paid/unpaid status is read from the server — so holds and suspensions are
// authoritative (a shop can't dodge billing by clearing its device). When no
// backend is configured, this does nothing and the app uses local billing.
import { useEffect } from 'react'



export function useBillingSync() {
  useEffect(() => {
    // Disabled (IntaSend deferred)
  }, [])
}
