// Subscription plans for Duka POS — tiered by the SIZE of the business.
// The recommender picks the smallest plan whose limits fit the shop.
import type { Plan, PlanId, PlanLimits } from '../types'

export const TRIAL_DAYS = 14
export const PERIOD_DAYS = 30
export const GRACE_DAYS = 7 // fully functional, daily pay reminder
export const RESTRICT_UNTIL_DAY = 14 // day 8–14: POS held (view only)
// day 15+ : suspended

export const PLANS: Plan[] = [
  {
    id: 'micro',
    name: 'Micro',
    swahili: 'Duka Ndogo',
    price: 500,
    limits: { shops: 1, staff: 2, products: 300, monthlyTx: 1500 },
    blurb: 'A single small kiosk or duka just getting started.',
    features: ['1 shop', 'Up to 2 staff', 'Up to 300 products', 'Debt reminders (WhatsApp/SMS)', 'Offline selling'],
  },
  {
    id: 'standard',
    name: 'Standard',
    swahili: 'Duka',
    price: 1500,
    limits: { shops: 1, staff: 5, products: 2000, monthlyTx: 8000 },
    blurb: 'A busy single shop with a few staff.',
    features: ['1 shop', 'Up to 5 staff', 'Up to 2,000 products', 'Automated debt reminders', 'Full reports', 'M-PESA reconciliation'],
  },
  {
    id: 'growth',
    name: 'Growth',
    swahili: 'Duka Biashara',
    price: 4500,
    limits: { shops: 3, staff: 15, products: 8000, monthlyTx: 40000 },
    blurb: 'A growing business with more than one branch.',
    features: ['Up to 3 shops', 'Up to 15 staff', 'Up to 8,000 products', 'Loyalty program', 'Multi-shop reports', 'Priority support'],
  },
  {
    id: 'chain',
    name: 'Chain',
    swahili: 'Duka Mtandao',
    price: 12000,
    limits: { shops: Infinity, staff: Infinity, products: Infinity, monthlyTx: Infinity },
    blurb: 'A chain or wholesaler running many shops.',
    features: ['Unlimited shops', 'Unlimited staff', 'Unlimited products', 'API access', 'Warehouse & transfers', 'Dedicated support'],
  },
]

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[1]
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
