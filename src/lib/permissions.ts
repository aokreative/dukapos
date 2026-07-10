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
  | 'transferStock' // send/receive stock between branches & warehouse
  | 'manageLocations' // create/edit branches & warehouses
  | 'manageSuppliers' // suppliers: payments, credit notes, add/edit suppliers
  | 'receiveDeliveries' // record goods arriving from a supplier
  | 'recordExpenses' // log running costs (tokens, supplies…)

const ROLE_CAPS: Record<Role, Capability[]> = {
  owner: [
    'sell', 'viewDebts', 'manageCustomers', 'manageStock', 'applyDiscount', 'voidRefund',
    'viewReports', 'manageStaff', 'editSettings', 'viewBilling', 'useAssistant',
    'transferStock', 'manageLocations', 'manageSuppliers', 'receiveDeliveries', 'recordExpenses',
  ],
  manager: [
    'sell', 'viewDebts', 'manageCustomers', 'manageStock', 'applyDiscount', 'voidRefund', 'viewReports', 'useAssistant',
    'transferStock', 'manageSuppliers', 'receiveDeliveries', 'recordExpenses',
  ],
  cashier: ['sell', 'viewDebts', 'manageCustomers', 'receiveDeliveries', 'recordExpenses', 'useAssistant'],
}

export function can(role: Role | undefined, cap: Capability): boolean {
  if (!role) return false
  return ROLE_CAPS[role].includes(cap)
}

/** Role capabilities PLUS any extra permissions the owner granted this person.
 *  This lets a trusted manager run the business owner-style — but the owner
 *  account itself can never be edited, paused or removed by anyone else. */
export function canStaff(staff: { role: Role; extraCaps?: string[] } | undefined, cap: Capability): boolean {
  if (!staff) return false
  return ROLE_CAPS[staff.role].includes(cap) || (staff.extraCaps ?? []).includes(cap)
}

/** Permissions the owner can grant on top of a role (everything except owning). */
export const GRANTABLE: Capability[] = [
  'manageStock', 'applyDiscount', 'voidRefund', 'viewReports', 'manageStaff',
  'editSettings', 'viewBilling', 'useAssistant', 'transferStock', 'manageLocations', 'manageSuppliers',
]

export const CAP_LABEL: Record<Capability, string> = {
  sell: 'Sell at the till',
  viewDebts: 'View debts & remind',
  manageCustomers: 'Manage customers',
  manageStock: 'Manage stock & products',
  applyDiscount: 'Give discounts',
  voidRefund: 'Returns & refunds',
  viewReports: 'View reports & PnL',
  manageStaff: 'Manage staff',
  editSettings: 'Edit settings',
  viewBilling: 'See billing',
  useAssistant: 'Use Duka AI',
  transferStock: 'Branch stock transfers',
  manageLocations: 'Manage branches',
  manageSuppliers: 'Pay suppliers & credit notes',
  receiveDeliveries: 'Receive deliveries',
  recordExpenses: 'Record expenses',
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
