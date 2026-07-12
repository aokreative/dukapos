// Plan prices (KES) — mirror of the app's src/lib/plans.ts. Keep in sync.
export const PLANS = {
  micro: { name: 'Starter', price: 5000 },
  standard: { name: 'Standard', price: 15000 },
  growth: { name: 'Advanced', price: 45000 },
  chain: { name: 'Enterprise', price: 50000 },
}

export const TRIAL_DAYS = 14
export const PERIOD_DAYS = 30
export const ANNUAL_PERIOD_DAYS = 365
export const ANNUAL_MONTHS_CHARGED = 10 // pay 10, get 12
export const GRACE_DAYS = 7
export const RESTRICT_UNTIL_DAY = 14

export function getPlan(id) {
  return PLANS[id] || PLANS.standard
}

export function priceFor(planId, cycle) {
  const p = getPlan(planId).price
  return cycle === 'annual' ? p * ANNUAL_MONTHS_CHARGED : p
}

export function periodDaysFor(cycle) {
  return cycle === 'annual' ? ANNUAL_PERIOD_DAYS : PERIOD_DAYS
}
