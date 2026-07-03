// Decides which customer debts are due for an AUTOMATED reminder right now,
// based on the owner's rules. Pure + testable; the hook that runs it lives in
// useAutomation.ts.
import type { BusinessSettings, Customer, Debt, ReminderLogEntry, ReminderRule } from '../types'
import { buildReminderMessage } from './reminders'
import { daysBetween } from './format'

export interface DueReminder {
  debt: Debt
  customer: Customer
  message: string
  channel: 'whatsapp' | 'sms'
}

export function isQuietHour(now: number, from: number, to: number): boolean {
  if (from === to) return false
  const hour = new Date(now).getHours()
  if (from < to) return hour >= from && hour < to
  return hour >= from || hour < to // wraps midnight (e.g. 21 → 7)
}

export function computeDueReminders(
  args: {
    settings: BusinessSettings
    customers: Customer[]
    debts: Debt[]
    reminderLog: ReminderLogEntry[]
    rule: ReminderRule
  },
  now: number = Date.now(),
): DueReminder[] {
  const { settings, customers, debts, reminderLog, rule } = args
  if (!rule.enabled) return []
  if (isQuietHour(now, rule.quietFrom, rule.quietTo)) return []

  const autoCountByDebt = new Map<string, number>()
  for (const l of reminderLog) {
    if (l.auto && (l.status === 'sent' || l.status === 'simulated')) {
      autoCountByDebt.set(l.debtId, (autoCountByDebt.get(l.debtId) ?? 0) + 1)
    }
  }

  const due: DueReminder[] = []
  for (const debt of debts) {
    if (debt.status !== 'open' || debt.balance <= 0) continue
    if (daysBetween(debt.createdAt, now) < rule.startDay) continue
    if ((autoCountByDebt.get(debt.id) ?? 0) >= rule.maxPerDebt) continue
    // Respect the interval since the last reminder (manual or auto).
    if (debt.lastReminderAt && daysBetween(debt.lastReminderAt, now) < rule.everyDays) continue

    const customer = customers.find((c) => c.id === debt.customerId)
    if (!customer) continue

    due.push({
      debt,
      customer,
      message: buildReminderMessage(settings, customer, debt),
      channel: rule.channel,
    })
  }
  return due
}
