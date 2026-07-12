// ---------------------------------------------------------------------------
// Duka POS — domain types
// A deliberately small, flat model that runs entirely offline on the device.
// ---------------------------------------------------------------------------

export type PaymentMethod = 'cash' | 'mpesa' | 'airtel' | 'card' | 'credit' | 'points'

/** What kind of business runs this POS — switches wording & feature presets. */
export type BusinessType =
  | 'shop' // duka, kiosk, mini-mart, general retail
  | 'restaurant'
  | 'pharmacy'
  | 'hardware'
  | 'electronics' // incl. CCTV, phones, accessories
  | 'boutique' // clothes & shoes
  | 'agrovet'
  | 'spices' // spices, herbs, cereals — anything weighed out
  | 'wholesale' // Kamukunji-style wholesale & distribution
  | 'babyshop'
  | 'autospares'

/** Optional feature switches — presets set them per business type, and the
 *  owner can toggle any of them in Settings. Everything stays simple: a
 *  feature that's off never appears anywhere. */
export interface FeatureFlags {
  /** Expiry dates on products + expiring-soon warnings (pharmacy, agrovet). */
  expiry: boolean
  /** Warranty months on products, printed on receipts (electronics, hardware). */
  warranty: boolean
  /** Second price tier that kicks in automatically at a minimum quantity. */
  wholesale: boolean
  /** Branches & warehouse: hidden entirely for simple single-shop businesses. */
  branches: boolean
}
// NOTE: selling by weight/measure (kg/g/L/m/…) is a CORE capability for every
// business type — any item can be given a unit, e.g. an electronics shop sells
// coaxial cable per metre AND as a full roll (two catalog entries).

// Branches, warehouses & stock movement ---------------------------------------
export type LocationType = 'branch' | 'warehouse'

/** A place that holds stock: a branch that sells, or a warehouse/store. */
export interface BizLocation {
  id: string
  name: string
  type: LocationType
  /** Optional salesperson/keeper responsible for this location. */
  assignedStaffId?: string
  createdAt: number
  // --- Optional per-branch M-PESA override -----------------------------------
  // A branch with its own Till/Paybill collects into ITS OWN number. When set,
  // receipts and reminders for sales made at this branch use these instead of
  // the shop's default (Settings). Leave unset and the shop default applies.
  mpesaType?: 'till' | 'paybill'
  mpesaTill?: string
  mpesaPaybill?: string
  mpesaAccount?: string
}

export interface TransferLine {
  productId: string
  name: string
  qty: number
}

export type TransferStatus = 'pending' | 'received' | 'cancelled'

/** Stock moving between locations (warehouse→branch or branch→branch). */
export interface StockTransfer {
  id: string
  fromId: string
  toId: string
  lines: TransferLine[]
  status: TransferStatus
  note?: string
  createdBy: string
  createdAt: number
  receivedBy?: string
  receivedAt?: number
}

// Suppliers -------------------------------------------------------------------
/**
 * Someone the shop buys from — a wholesaler, a farmer, or the neighbor next
 * door. Can be linked to a Customer record (a customer who also supplies you).
 */
export interface Supplier {
  id: string
  name: string
  phone: string
  /** What they supply, e.g. "Eggs & milk", "Vegetables". */
  supplies?: string
  /** Link when this supplier is also one of your customers. */
  customerId?: string
  note?: string
  active: boolean
  createdAt: number
}

export type SupplierTxnType = 'delivery' | 'payment' | 'creditNote'

/** One line of an itemised delivery — qty received at a unit buying price. */
export interface DeliveryLine {
  productId: string
  name: string
  qty: number
  unitCost: number
}

/**
 * Money/goods movement with a supplier:
 *  - delivery: goods received — increases what you owe (unless paid on the spot)
 *  - payment: you paid them — reduces what you owe
 *  - creditNote: goods returned to them / agreed reduction — reduces what you owe
 */
export interface SupplierTxn {
  id: string
  supplierId: string
  type: SupplierTxnType
  amount: number
  /** For payments: how you paid. */
  method?: PaymentMethod
  ref?: string
  /** For deliveries: what arrived, free text (simple mode). */
  items?: string
  /** For deliveries: itemised lines — stock & buying prices update from these. */
  lines?: DeliveryLine[]
  note?: string
  at: number
  byStaffName: string
}

// Expenses ---------------------------------------------------------------------
/** A running cost: electricity tokens, tissue, tape, receipt rolls, rent… */
export interface Expense {
  id: string
  name: string
  amount: number
  category: string
  method: PaymentMethod
  note?: string
  at: number
  byStaffName: string
  locationId: string
}

// Shifts (cash at hand → close desk) --------------------------------------------
/** One cashier's working session at a branch: opens with the float ("cash at
 *  hand"), closes with a count — sales & expected cash are reconciled. */
export interface Shift {
  id: string
  staffId: string
  staffName: string
  locationId: string
  openedAt: number
  /** The float the cashier starts the day/shift with. */
  openingCash: number
  closedAt?: number
  /** What the cashier counted in the drawer at close. */
  countedCash?: number
  /** openingCash + cash taken during the shift (computed at close). */
  expectedCash?: number
  /** countedCash − expectedCash (negative = short). */
  variance?: number
  totalSales?: number
  txCount?: number
}

export type ReturnResolution = 'refund' | 'exchange'

/** A customer bringing goods back — refunded or exchanged; stock goes back in. */
export interface ReturnRecord {
  id: string
  saleId?: string
  receiptNo: string
  customerId?: string
  lines: TransferLine[]
  amount: number
  resolution: ReturnResolution
  /** For refunds: how the money went back (cash / mpesa / airtel). */
  method?: PaymentMethod
  note?: string
  byStaffName: string
  at: number
  locationId: string
}

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
  /** Extra permissions granted by the OWNER on top of the role — lets a
   * trusted manager run the business owner-style. The owner account itself
   * can never be edited, paused or removed by anyone else. */
  extraCaps?: string[]
  /** Branch this staff member is assigned to. When set, they log in straight
   * into that branch and can sell ONLY there (owners always roam). Leave unset
   * for staff who move between branches. */
  locationId?: string
}

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number // selling price, KES
  cost: number // buying price, KES (for profit)
  /** Brand/make, e.g. HikVision, Panadol, Simba Cement. */
  brand?: string
  /** Units on hand per location id (branches + warehouses). */
  stockByLocation: Record<string, number>
  reorderLevel: number
  active: boolean
  /** false = don't deplete stock on sale (e.g. made-to-order restaurant dishes). */
  trackStock?: boolean
  /** Unit of sale: 'pc' (default), 'kg', 'g', 'L', 'ml', 'm', 'bag', 'tray'… */
  unit?: string
  /** Wholesale tier: this price applies when qty >= wholesaleMinQty. */
  wholesalePrice?: number
  wholesaleMinQty?: number
  /** ISO date (YYYY-MM-DD) — pharmacy/agrovet/perishables. */
  expiryDate?: string
  /** Printed on the receipt for electronics/hardware. */
  warrantyMonths?: number
  /** Tiny product photo (compressed data URL, ~64px) shown at the till. */
  thumb?: string
  /** Optional variations (e.g. colours or sizes). When set, the cashier picks
   *  one at the till and it's recorded on the line & receipt. */
  variants?: string[]
}

export interface Customer {
  id: string
  /** Person's name — or the shop/business name when isShop. */
  name: string
  phone: string // stored normalised as 2547XXXXXXXX
  /** This customer is itself a shop/business (B2B customer). */
  isShop?: boolean
  ownerName?: string
  ownerPhone?: string
  note?: string
  createdAt: number
  /** Loyalty points balance (1 point = KES 1 to redeem). */
  points?: number
}

export interface CartLine {
  productId: string
  name: string
  price: number
  qty: number
  /** Chosen variation (e.g. a colour or size) for this line. */
  variant?: string
  /** Unit snapshot ('kg', 'm'…) — enables decimal quantities for this line. */
  unit?: string
  /** True when the wholesale price tier is applied to this line. */
  wholesale?: boolean
  /** Warranty snapshot, printed on the receipt. */
  warrantyMonths?: number
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
  /** Who physically served the sale (signed-in staff). */
  cashierName: string
  /** Who the sale is credited to — may differ from cashierName when one
   * cashier rings up a sale on a colleague's behalf. */
  assignedToName?: string
  /** Free comment on the transaction, e.g. "delivered to the salon". */
  note?: string
  /** Which branch made the sale. */
  locationId?: string
  /** Loyalty points earned on this sale (when loyalty is on & a customer is attached). */
  pointsEarned?: number
  /** Loyalty points redeemed as payment on this sale. */
  pointsRedeemed?: number
  // --- Void (reverse a mistaken/faulty sale) ---------------------------------
  // A voided sale stays in history for the record but is struck through and
  // excluded from all revenue, profit, cash-up and tax figures. Voiding puts the
  // stock back, cancels any mkopo debt it created, and reverses loyalty points.
  voided?: boolean
  voidedAt?: number
  /** Who authorised the void (the manager/owner, even if a cashier rang it). */
  voidedBy?: string
  voidReason?: string
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
  /** Who served this credit sale — settles "who gave out this debt" disputes. */
  cashierName?: string
  comments?: DebtComment[]
}

export interface DebtPayment {
  id: string
  amount: number
  method: PaymentMethod // how the customer settled (cash/mpesa/card)
  ref?: string
  note?: string
  at: number
}

/** A free-text comment on a debt, e.g. "promised to clear on Friday". */
export interface DebtComment {
  id: string
  text: string
  at: number
  byStaffName: string
}

export interface BusinessSettings {
  name: string
  tagline: string
  /** Chosen at onboarding — sets wording & feature presets for the vertical. */
  businessType: BusinessType
  /** Explicit feature switches; when unset, the businessType preset applies. */
  features?: FeatureFlags
  phone: string // shop contact, normalised
  location: string
  // How debtors can pay you back — included in every reminder.
  mpesaType: 'till' | 'paybill' | 'none'
  mpesaTill: string
  mpesaPaybill: string
  mpesaAccount: string
  // --- The shop's OWN M-PESA STK (so the "Prompt" at the till pushes the bill
  // to the customer's phone and the money lands in THIS shop's till/Paybill).
  // These are the shop's own Safaricom Daraja keys — never ours. Optional: when
  // off/blank the till still works, the customer just pays the till manually. ---
  mpesaStkEnabled?: boolean
  mpesaConsumerKey?: string
  mpesaConsumerSecret?: string
  mpesaPasskey?: string
  /** The Paybill or Till/Store number STK collects into (defaults to the till/paybill above). */
  mpesaStkShortcode?: string
  mpesaStkEnv?: 'sandbox' | 'production'
  /** Airtel Money number/till — shown in reminders when set. */
  airtelNumber: string
  acceptCash: boolean
  currency: string // 'KES'
  cashierName: string
  // Reminder message template. Placeholders: {name} {business} {amount} {receipt} {pay}
  reminderTemplate: string
  vatEnabled: boolean
  vatRate: number // e.g. 16
  /** Loyalty points: customers earn loyaltyRate% of each sale back as points
   *  (1 point = KES 1), redeemable at the till. Off by default. */
  loyaltyEnabled?: boolean
  loyaltyRate?: number // percent back, e.g. 1 = 1%
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
