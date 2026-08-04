// Subscription plans for Duka POS — tiered by the SIZE of the business.
// The recommender picks the smallest plan whose limits fit the shop.
//
// These are "from" prices — a starting point. The owner can adjust the amount
// billed per client from the Super-Admin portal (e.g. Enterprise is custom).
// Starter from KES 2,999, Standard from 5,999, Advanced from 12,999,
// Enterprise — contact sales for custom pricing. Annual billing = 2 months free.
import type { Plan, PlanId, PlanLimits } from '../types'

export const TRIAL_DAYS = 14
export const PERIOD_DAYS = 30
export const ANNUAL_PERIOD_DAYS = 365
export const ANNUAL_MONTHS_CHARGED = 10 // pay 10, get 12 (2 months free)
export const GRACE_DAYS = 7 // fully functional, daily pay reminder
export const RESTRICT_UNTIL_DAY = 14 // day 8–14: POS held (view only)
// day 15+ : suspended

export type BillingCycle = 'monthly' | 'annual'

export const PLANS: Plan[] = [
  {
    id: 'micro',
    name: 'Starter',
    swahili: 'Duka Ndogo',
    price: 2999,
    limits: { shops: 1, staff: 2, products: 500, monthlyTx: 3000 },
    blurb: 'A single small kiosk or duka just getting started.',
    features: ['1 shop', 'Up to 2 staff', 'Up to 500 products', 'Offline selling', 'One-tap WhatsApp/SMS debt reminders', 'Receipts & daily sales'],
  },
  {
    id: 'standard',
    name: 'Standard',
    swahili: 'Duka',
    price: 5999,
    limits: { shops: 1, staff: 6, products: 3000, monthlyTx: 15000 },
    blurb: 'A busy single shop that wants to get paid on time.',
    features: ['Everything in Starter', 'Up to 6 staff', 'Up to 3,000 products', 'Automated debt reminders', 'Full sales & profit reports', 'M-PESA payments & split tender'],
  },
  {
    id: 'growth',
    name: 'Advanced',
    swahili: 'Duka Biashara',
    price: 12999,
    limits: { shops: 3, staff: 20, products: 12000, monthlyTx: Infinity },
    blurb: 'A growing business with more than one branch.',
    features: ['Everything in Standard', 'Up to 3 shops', 'Up to 20 staff', 'Up to 12,000 products', 'Loyalty & customer points', 'Priority support'],
  },
  {
    id: 'chain',
    name: 'Enterprise',
    swahili: 'Duka Mtandao',
    price: 0,
    isCustom: true,
    limits: { shops: Infinity, staff: Infinity, products: Infinity, monthlyTx: Infinity },
    blurb: 'A chain or wholesaler running many shops & a warehouse — custom-priced.',
    features: ['Everything in Advanced', 'Unlimited shops & staff', 'Unlimited products', 'Warehouse & stock transfers', 'API access', 'Dedicated account manager'],
  },
]

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[1]
}

/** Annual price for a plan (2 months free). */
export function annualPrice(plan: Plan): number {
  return plan.price * ANNUAL_MONTHS_CHARGED
}

/** The amount charged for a plan on a given billing cycle. */
export function priceFor(plan: Plan, cycle: BillingCycle): number {
  return cycle === 'annual' ? annualPrice(plan) : plan.price
}

export function periodDaysFor(cycle: BillingCycle): number {
  return cycle === 'annual' ? ANNUAL_PERIOD_DAYS : PERIOD_DAYS
}

export interface SizeInputs {
  shops: number
  staff: number
  products: number
  monthlyTx: number
}

/** Recommend the smallest plan that fits the business size. */
export function recommendPlan(size: SizeInputs): Plan {
  const fits = (l: PlanLimits) =>
    size.shops <= l.shops && size.staff <= l.staff && size.products <= l.products && size.monthlyTx <= l.monthlyTx
  return PLANS.find((p) => fits(p.limits)) ?? PLANS[PLANS.length - 1]
}

export function limitLabel(n: number): string {
  return n === Infinity ? 'Unlimited' : n.toLocaleString('en-KE')
}
