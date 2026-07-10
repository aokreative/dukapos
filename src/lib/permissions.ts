// Role-based access control for the shop device.
// Owner sees everything; Manager runs the shop; Cashier only sells & serves.
import type { Role } from '../types'

export type Capability =
  | 'sell'
  | 'viewDebts' // see debts + send reminders
  | 'manageCustomers'
  | 'manageStock' // add/edit products, adjust stock
  | 'applyDiscount' // give a discount at the till
  | 'voidRefund'
  | 'viewReports'
  | 'manageStaff'
  | 'editSettings'
  | 'viewBilling' // the subscription/billing screen
  | 'useAssistant' // Duka AI — sees sales/profit/debt numbers

const ROLE_CAPS: Record<Role, Capability[]> = {
  owner: [
    'sell', 'viewDebts', 'manageCustomers', 'manageStock', 'applyDiscount', 'voidRefund',
    'viewReports', 'manageStaff', 'editSettings', 'viewBilling', 'useAssistant',
  ],
  manager: [
    'sell', 'viewDebts', 'manageCustomers', 'manageStock', 'applyDiscount', 'voidRefund', 'viewReports', 'useAssistant',
  ],
  cashier: ['sell', 'viewDebts', 'manageCustomers'],
}

export function can(role: Role | undefined, cap: Capability): boolean {
  if (!role) return false
  return ROLE_CAPS[role].includes(cap)
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
}

export const ROLE_BLURB: Record<Role, string> = {
  owner: 'Full control — everything',
  manager: 'Runs the shop; no billing or staff',
  cashier: 'Sells & serves customers only',
}
