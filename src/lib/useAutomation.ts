// Runs the automated reminder engine while the app is open and online.
// Automated sends go through the backend relay (or simulation) — they never
// open a WhatsApp/SMS tab, so they are truly hands-off.
import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { computeDueReminders } from './automation'
import { evaluateBilling } from './billing'
import { sendReminder } from './api'
import { useOnline } from './useOnline'

const TICK_MS = 60_000 // check once a minute while open
const BATCH = 3 // send at most a few per tick to avoid bursts

export function useAutomation() {
  const online = useOnline()
  const busy = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function tick() {
      if (busy.current || !navigator.onLine) return
      const st = useStore.getState()
      if (!st.reminderRule.enabled) return

      // Don't auto-chase customers while our own account is held/suspended.
      const billing = evaluateBilling(st.subscription)
      if (!billing.canSell) return

      const due = computeDueReminders({
        settings: st.settings,
        customers: st.customers,
        debts: st.debts,
        reminderLog: st.reminderLog,
        rule: st.reminderRule,
      })
      if (due.length === 0) return

      busy.current = true
      try {
        for (const item of due.slice(0, BATCH)) {
          if (cancelled) break
          const res = await sendReminder({
            channel: item.channel,
            phone: item.customer.phone,
            message: item.message,
            business: st.settings.name,
          })
          useStore.getState().logReminder({
            debtId: item.debt.id,
            customerId: item.customer.id,
            customerName: item.customer.name,
            channel: item.channel,
            message: item.message,
            auto: true,
            status: res.status === 'failed' ? 'failed' : res.status,
            detail: res.ref ? `${res.detail ?? ''} ${res.ref}`.trim() : res.detail,
          })
          if (res.ok) useStore.getState().markReminderSent(item.debt.id, item.channel)
        }
      } finally {
        busy.current = false
      }
    }

    // Kick off shortly after load, then on an interval.
    const first = setTimeout(tick, 2500)
    const id = setInterval(tick, TICK_MS)
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(id)
    }
  }, [online])
}
