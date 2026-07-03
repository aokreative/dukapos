// ---------------------------------------------------------------------------
// Duka POS — domain types
// A deliberately small, flat model that runs entirely offline on the device.
// ---------------------------------------------------------------------------

export type PaymentMethod = 'cash' | 'mpesa' | 'card' | 'credit'

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
  acceptCash: boolean
  currency: string // 'KES'
  cashierName: string
  // Reminder message template. Placeholders: {name} {business} {amount} {receipt} {pay}
  reminderTemplate: string
  vatEnabled: boolean
  vatRate: number // e.g. 16
  lowStockNudge: boolean
}
