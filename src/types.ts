// ---------------------------------------------------------------------------
// Duka POS — domain types
// A deliberately small, flat model that runs entirely offline on the device.
// ---------------------------------------------------------------------------

export type PaymentMethod = 'cash' | 'mpesa' | 'airtel' | 'card' | 'credit'

// Staff & access control -----------------------------------------------------
export type Role = 'owner' | 'manager' | 'cashier'

export interface StaffMember {
  id: string
  name: string
  role: Role
  pin: string // 4–6 digits; gates the device
  phone?: string
  active: boolean
  createdAt: number
}

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number // selling price, KES
  cost: number // buying price, KES (for profit)
  stock: number
  reorderLevel: number
  active: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string // stored normalised as 2547XXXXXXXX
  note?: string
  createdAt: number
}

export interface CartLine {
  productId: string
  name: string
  price: number
  qty: number
}

/** One tender within a sale — supports split payments. */
export interface Tender {
  method: PaymentMethod
  amount: number
  ref?: string // M-PESA code / card ref
}

export interface Sale {
  id: string
  receiptNo: string
  createdAt: number
  lines: CartLine[]
  subtotal: number
  discount: number
  total: number
  tenders: Tender[]
  /** Portion sold on credit (mkopo) — becomes/updates a debt. */
  creditAmount: number
  customerId?: string
  cashierName: string
}

export type DebtStatus = 'open' | 'settled'

/** A running debt ledger per credit sale. Payments reduce the balance. */
export interface Debt {
  id: string
  customerId: string
  saleId: string
  receiptNo: string
  originalAmount: number
  balance: number
  createdAt: number
  status: DebtStatus
  lastReminderAt?: number
  lastReminderChannel?: 'whatsapp' | 'sms'
  payments: DebtPayment[]
}

export interface DebtPayment {
  id: string
  amount: number
  method: PaymentMethod // how the customer settled (cash/mpesa/card)
  ref?: string
  at: number
}

export interface BusinessSettings {
  name: string
  tagline: string
  phone: string // shop contact, normalised
  location: string
  // How debtors can pay you back — included in every reminder.
  mpesaType: 'till' | 'paybill' | 'none'
  mpesaTill: string
  mpesaPaybill: string
  mpesaAccount: string
  /** Airtel Money number/till — shown in reminders when set. */
  airtelNumber: string
  acceptCash: boolean
  currency: string // 'KES'
  cashierName: string
  // Reminder message template. Placeholders: {name} {business} {amount} {receipt} {pay}
  reminderTemplate: string
  vatEnabled: boolean
  vatRate: number // e.g. 16
  lowStockNudge: boolean
  // KRA eTIMS (electronic tax invoicing). When on, receipts carry the KRA PIN
  // and (with a live backend) each sale is submitted to eTIMS.
  etimsEnabled: boolean
  kraPin: string
}

// ---------------------------------------------------------------------------
// SaaS layer — the POS itself is a subscription product.
// ---------------------------------------------------------------------------

export type PlanId = 'micro' | 'standard' | 'growth' | 'chain'

export interface PlanLimits {
  shops: number
  staff: number
  products: number
  monthlyTx: number
}

export interface Plan {
  id: PlanId
  name: string
  swahili: string
  price: number // KES per month
  limits: PlanLimits // Infinity means unlimited
  blurb: string
  features: string[]
}

/** Lifecycle of the shop's own subscription to Duka POS. */
export type SubStatus = 'trial' | 'active' | 'grace' | 'restricted' | 'suspended'

export type BillingCycle = 'monthly' | 'annual'

export interface SubInvoice {
  id: string
  planId: PlanId
  amount: number
  cycle: BillingCycle
  periodStart: number
  periodEnd: number
  issuedAt: number
  paidAt?: number
  method?: 'mpesa' | 'card' | 'manual'
  ref?: string
  status: 'paid' | 'pending' | 'failed'
}

export interface Subscription {
  planId: PlanId
  billingCycle: BillingCycle
  startedAt: number
  trialEndsAt: number
  currentPeriodEnd: number // next due date once paid
  lastPaymentAt?: number
  autoRenew: boolean
  invoices: SubInvoice[]
}

/** Rules that drive automated debt reminders (customer debts, not billing). */
export interface ReminderRule {
  enabled: boolean
  startDay: number // begin auto-reminding once a debt is this many days old
  everyDays: number // repeat interval between reminders
  maxPerDebt: number // stop after this many auto reminders on one debt
  channel: 'whatsapp' | 'sms'
  quietFrom: number // hour 0-23 — do not send during quiet hours
  quietTo: number
}

export interface ReminderLogEntry {
  id: string
  debtId: string
  customerId: string
  customerName: string
  channel: 'whatsapp' | 'sms'
  message: string
  at: number
  auto: boolean
  status: 'sent' | 'simulated' | 'queued' | 'failed'
  detail?: string
}
