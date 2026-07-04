// Billing state machine — decides whether the POS is fully usable, held, or
// suspended based on the subscription dates. This is what "holds" the POS when
// payment is pending.
import type { Subscription, SubStatus } from '../types'
import type { TenantView } from './api'
import { GRACE_DAYS, RESTRICT_UNTIL_DAY, getPlan } from './plans'
import { daysBetween } from './format'

const DAY = 24 * 60 * 60 * 1000

export interface BillingState {
  status: SubStatus
  effectiveDue: number // the date payment is/was due
  overdueDays: number // days past due (0 if not overdue)
  trialDaysLeft: number // days left in trial (0 if not trialing)
  canSell: boolean // false => POS is held
  locked: boolean // true => fully suspended paywall
  planId: Subscription['planId']
  price: number
}

export function evaluateBilling(sub: Subscription, now: number = Date.now()): BillingState {
  const plan = getPlan(sub.planId)
  const paid = !!sub.lastPaymentAt
  const base = {
    planId: sub.planId,
    price: plan.price,
  }

  // In trial, unpaid but within the trial window.
  if (!paid && now < sub.trialEndsAt) {
    return {
      ...base,
      status: 'trial',
      effectiveDue: sub.trialEndsAt,
      overdueDays: 0,
      trialDaysLeft: Math.max(0, Math.ceil((sub.trialEndsAt - now) / (1000 * 60 * 60 * 24))),
      canSell: true,
      locked: false,
    }
  }

  const due = paid ? sub.currentPeriodEnd : sub.trialEndsAt
  if (now <= due) {
    return { ...base, status: 'active', effectiveDue: due, overdueDays: 0, trialDaysLeft: 0, canSell: true, locked: false }
  }

  const over = daysBetween(due, now)
  if (over <= GRACE_DAYS) {
    // Grace: still fully functional, but nudge to pay.
    return { ...base, status: 'grace', effectiveDue: due, overdueDays: over, trialDaysLeft: 0, canSell: true, locked: false }
  }
  if (over <= RESTRICT_UNTIL_DAY) {
    // Restricted: can view & pay, but cannot process sales — the POS is held.
    return { ...base, status: 'restricted', effectiveDue: due, overdueDays: over, trialDaysLeft: 0, canSell: false, locked: false }
  }
  // Suspended: full paywall.
  return { ...base, status: 'suspended', effectiveDue: due, overdueDays: over, trialDaysLeft: 0, canSell: false, locked: true }
}

/** Build billing state from the server's authoritative tenant status. */
export function billingFromServer(v: TenantView, now: number = Date.now()): BillingState {
  const plan = getPlan(v.planId as Subscription['planId'])
  return {
    status: v.status,
    effectiveDue: v.status === 'trial' ? v.trialEndsAt : v.currentPeriodEnd,
    overdueDays: v.overdueDays,
    trialDaysLeft: v.status === 'trial' ? Math.max(0, Math.ceil((v.trialEndsAt - now) / DAY)) : 0,
    canSell: v.canSell,
    locked: v.locked,
    planId: v.planId as Subscription['planId'],
    price: plan.price,
  }
}

export const STATUS_LABEL: Record<SubStatus, string> = {
  trial: 'Free trial',
  active: 'Active',
  grace: 'Payment due',
  restricted: 'On hold',
  suspended: 'Suspended',
}

export const STATUS_COLOR: Record<SubStatus, 'green' | 'amber' | 'red' | 'blue'> = {
  trial: 'blue',
  active: 'green',
  grace: 'amber',
  restricted: 'red',
  suspended: 'red',
}
