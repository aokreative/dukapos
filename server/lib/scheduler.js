// Automatic billing scheduler. On an interval it finds shops whose payment is
// due and charges them automatically (via the injected chargeTenant function,
// which sends an M-PESA STK push / renews in simulation). This is what makes
// monthly charging hands-off on the platform side.
import { listDueForCharge, setLastChargeAttempt } from './subscriptions.js'

export function startScheduler({ chargeTenant, intervalMs = 60 * 60 * 1000 }) {
  let running = false

  async function tick() {
    if (running) return
    running = true
    try {
      const due = await listDueForCharge()
      if (due.length) console.log(`[billing] ${due.length} tenant(s) due — auto-charging`)
      for (const t of due) {
        await setLastChargeAttempt(t.id)
        try {
          await chargeTenant(t)
        } catch (e) {
          console.error(`[billing] charge failed for ${t.id}: ${e.message}`)
        }
      }
    } finally {
      running = false
    }
  }

  // First sweep shortly after boot, then on the interval.
  const first = setTimeout(tick, 5000)
  const id = setInterval(tick, intervalMs)
  return {
    stop: () => {
      clearTimeout(first)
      clearInterval(id)
    },
    runOnce: tick,
  }
}
