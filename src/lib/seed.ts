// Demo data so the shop works the moment it opens. All prices in KES.
import type { BusinessSettings, Customer, Debt, Product, ReminderRule, Sale, StaffMember, Subscription } from '../types'
import { DEFAULT_TEMPLATE } from './reminders'
import { TRIAL_DAYS } from './plans'
import { uid } from './id'
import { MAIN_LOCATION_ID } from './stock'

export const defaultSettings: BusinessSettings = {
  name: 'Duka',
  tagline: 'Your neighbourhood shop',
  businessType: 'shop',
  phone: '254712000000',
  location: 'Nairobi',
  mpesaType: 'till',
  mpesaTill: '832909',
  mpesaPaybill: '',
  mpesaAccount: '',
  airtelNumber: '',
  acceptCash: true,
  currency: 'KES',
  cashierName: 'Owner',
  reminderTemplate: DEFAULT_TEMPLATE,
  vatEnabled: false,
  vatRate: 16,
  lowStockNudge: true,
  etimsEnabled: false,
  kraPin: '',
}

const now = Date.now()
const day = 24 * 60 * 60 * 1000

export function defaultSubscription(): Subscription {
  const t = Date.now()
  return {
    planId: 'standard',
    billingCycle: 'monthly',
    startedAt: t,
    trialEndsAt: t + TRIAL_DAYS * day,
    currentPeriodEnd: t + TRIAL_DAYS * day,
    autoRenew: true,
    invoices: [],
  }
}

export function seedStaff(): StaffMember[] {
  const t = Date.now()
  return [
    { id: 'staff_owner', name: 'Owner', role: 'owner', pin: '1234', active: true, createdAt: t },
    { id: 'staff_cashier', name: 'Cashier', role: 'cashier', pin: '0000', active: true, createdAt: t },
  ]
}

export const defaultReminderRule: ReminderRule = {
  enabled: true,
  startDay: 3,
  everyDays: 3,
  maxPerDebt: 4,
  channel: 'whatsapp',
  quietFrom: 21, // 9pm
  quietTo: 7, // 7am
}

export function seedProducts(): Product[] {
  // Shop-floor stock at the main branch; a healthy buffer in the warehouse so
  // the transfer feature is demoable immediately.
  const p = (name: string, sku: string, category: string, price: number, cost: number, stock: number, reorder: number): Product => ({
    id: uid('p_'),
    name,
    sku,
    category,
    price,
    cost,
    stockByLocation: { [MAIN_LOCATION_ID]: stock, loc_wh: Math.round(stock * 1.5) },
    reorderLevel: reorder,
    active: true,
  })
  return [
    p('Unga Pembe 2kg', '6001', 'Flour', 175, 148, 40, 10),
    p('Sugar 1kg', '6002', 'Groceries', 165, 140, 30, 10),
    p('Cooking Oil 1L', '6003', 'Groceries', 320, 285, 18, 6),
    p('Milk 500ml', '6004', 'Dairy', 60, 50, 24, 12),
    p('Bread 400g', '6005', 'Bakery', 70, 58, 15, 8),
    p('Rice 2kg', '6006', 'Groceries', 260, 225, 22, 8),
    p('Soda 500ml', '6007', 'Drinks', 70, 55, 48, 24),
    p('Water 1L', '6008', 'Drinks', 50, 35, 60, 24),
    p('Soap Bar', '6009', 'Household', 55, 42, 36, 12),
    p('Salt 1kg', '6010', 'Groceries', 45, 33, 20, 8),
    p('Tea Leaves 250g', '6011', 'Groceries', 145, 120, 14, 6),
    p('Matchbox', '6012', 'Household', 10, 6, 100, 30),
    p('Airtime 50', '6013', 'Airtime', 50, 48, 200, 0),
    p('Eggs (tray)', '6014', 'Dairy', 380, 330, 8, 4),
    p('Maize Meal 1kg', '6015', 'Flour', 95, 80, 5, 12), // low stock on purpose
  ]
}

export function seedCustomers(): Customer[] {
  const c = (name: string, phone: string, note?: string): Customer => ({
    id: uid('c_'),
    name,
    phone,
    note,
    createdAt: now - 40 * day,
  })
  return [
    c('Mama Njeri', '254712345678', 'Regular — buys weekly'),
    c('John Otieno', '254723456789'),
    c('Grace Wanjiku', '254701234567', 'Salon next door'),
    c('Boda Boda Sacco', '254733222111', 'Group tab'),
  ]
}

/** Seed a couple of open debts so the reminder feature is visible immediately. */
export function seedDebtsAndSales(customers: Customer[]): { debts: Debt[]; sales: Sale[] } {
  const debts: Debt[] = []
  const sales: Sale[] = []

  const mk = (cust: Customer, receiptNo: string, amount: number, ageDays: number) => {
    const saleId = uid('s_')
    const createdAt = now - ageDays * day
    sales.push({
      id: saleId,
      receiptNo,
      createdAt,
      lines: [{ productId: 'seed', name: 'Assorted goods', price: amount, qty: 1 }],
      subtotal: amount,
      discount: 0,
      total: amount,
      tenders: [{ method: 'credit', amount }],
      creditAmount: amount,
      customerId: cust.id,
      cashierName: 'Owner',
      locationId: MAIN_LOCATION_ID,
    })
    debts.push({
      id: uid('d_'),
      customerId: cust.id,
      saleId,
      receiptNo,
      originalAmount: amount,
      balance: amount,
      createdAt,
      status: 'open',
      payments: [],
      cashierName: 'Owner',
    })
  }

  mk(customers[0], 'R-00001', 1200, 12) // Mama Njeri, 12 days
  mk(customers[1], 'R-00002', 3500, 47) // John Otieno, overdue
  mk(customers[3], 'R-00003', 8600, 95) // Boda Boda Sacco, very overdue

  return { debts, sales }
}
