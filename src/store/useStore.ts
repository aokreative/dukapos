// ---------------------------------------------------------------------------
// Duka POS store — a single Zustand store persisted to IndexedDB.
// Everything runs on the device; no server needed. This is the "offline-first"
// core: sales, stock, customers and debts all live locally and survive reloads.
// ---------------------------------------------------------------------------
import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

import type {
  BillingCycle,
  BusinessSettings,
  CartLine,
  Customer,
  Debt,
  DebtPayment,
  PaymentMethod,
  PlanId,
  Product,
  ReminderLogEntry,
  ReminderRule,
  Role,
  Sale,
  StaffMember,
  SubInvoice,
  Subscription,
  Tender,
} from '../types'
import type { TenantView } from '../lib/api'
import { uid } from '../lib/id'
import { receiptNo as fmtReceipt } from '../lib/id'
import { normalizePhone } from '../lib/format'
import { PERIOD_DAYS, getPlan, priceFor, periodDaysFor } from '../lib/plans'
import {
  defaultReminderRule,
  defaultSettings,
  defaultSubscription,
  seedCustomers,
  seedDebtsAndSales,
  seedProducts,
  seedStaff,
} from '../lib/seed'

// Fail-soft storage: some browsers (in-app webviews, strict private modes)
// block IndexedDB. If that happens the app must still open — it just runs as
// a fresh session for that visit instead of hanging on the splash screen.
const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await idbGet(name)) ?? null
    } catch {
      return null
    }
  },
  setItem: async (name, value) => {
    try {
      await idbSet(name, value)
    } catch {
      /* storage unavailable — keep running in memory */
    }
  },
  removeItem: async (name) => {
    try {
      await idbDel(name)
    } catch {
      /* ignore */
    }
  },
}

export interface CompleteSaleInput {
  lines: CartLine[]
  discount: number
  tenders: Tender[]
  customerId?: string
}

interface State {
  _hasHydrated: boolean
  dark: boolean

  settings: BusinessSettings
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  debts: Debt[]
  receiptCounter: number

  // staff & access
  staff: StaffMember[]
  currentStaffId: string | null

  // SaaS layer
  subscription: Subscription
  reminderRule: ReminderRule
  reminderLog: ReminderLogEntry[]
  /** When connected to the backend, the server's authoritative billing status. */
  tenantId?: string
  serverBilling: TenantView | null

  // lifecycle
  setHydrated: (v: boolean) => void
  toggleDark: () => void

  // staff & access
  staffLogin: (staffId: string, pin: string) => boolean
  logout: () => void
  addStaff: (s: Omit<StaffMember, 'id' | 'createdAt'>) => void
  updateStaff: (id: string, patch: Partial<StaffMember>) => void
  removeStaff: (id: string) => void

  // settings
  updateSettings: (patch: Partial<BusinessSettings>) => void

  // products
  addProduct: (p: Omit<Product, 'id'>) => void
  updateProduct: (id: string, patch: Partial<Product>) => void
  removeProduct: (id: string) => void
  adjustStock: (id: string, delta: number) => void

  // customers
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => Customer
  updateCustomer: (id: string, patch: Partial<Customer>) => void
  removeCustomer: (id: string) => void

  // sales + debts
  completeSale: (input: CompleteSaleInput) => Sale
  recordDebtPayment: (debtId: string, amount: number, method: PaymentMethod, ref?: string) => void
  markReminderSent: (debtId: string, channel: 'whatsapp' | 'sms') => void

  // subscription / billing
  setPlan: (planId: PlanId) => void
  setAutoRenew: (v: boolean) => void
  recordSubscriptionPayment: (planId: PlanId, cycle: BillingCycle, method: 'mpesa' | 'card' | 'manual', ref?: string) => void
  setTenantId: (id: string) => void
  setServerBilling: (v: TenantView | null) => void
  /** Demo helper: shift billing dates so a given status is reproduced. */
  simulateBillingAge: (daysOverdue: number) => void

  // reminders automation
  updateReminderRule: (patch: Partial<ReminderRule>) => void
  logReminder: (entry: Omit<ReminderLogEntry, 'id' | 'at'>) => void

  // data management
  resetDemoData: () => void
  clearAll: () => void
}

function buildSeed() {
  const customers = seedCustomers()
  const { debts, sales } = seedDebtsAndSales(customers)
  return {
    settings: defaultSettings,
    products: seedProducts(),
    customers,
    sales,
    debts,
    receiptCounter: 4, // seeds used R-00001..R-00003
    staff: seedStaff(),
    currentStaffId: 'staff_owner' as string | null,
    subscription: defaultSubscription(),
    reminderRule: defaultReminderRule,
    reminderLog: [] as ReminderLogEntry[],
    serverBilling: null as TenantView | null,
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      dark: false,
      ...buildSeed(),

      setHydrated: (v) => set({ _hasHydrated: v }),
      toggleDark: () => set((s) => ({ dark: !s.dark })),

      staffLogin: (staffId, pin) => {
        const st = get()
        const member = st.staff.find((m) => m.id === staffId && m.active)
        if (member && member.pin === pin) {
          set({ currentStaffId: staffId })
          return true
        }
        return false
      },
      logout: () => set({ currentStaffId: null }),
      addStaff: (s) => set((st) => ({ staff: [...st.staff, { ...s, id: uid('staff_'), createdAt: Date.now() }] })),
      updateStaff: (id, patch) =>
        set((st) => ({ staff: st.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      removeStaff: (id) =>
        set((st) => ({
          staff: st.staff.filter((m) => m.id !== id),
          currentStaffId: st.currentStaffId === id ? null : st.currentStaffId,
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addProduct: (p) => set((s) => ({ products: [{ ...p, id: uid('p_') }, ...s.products] })),
      updateProduct: (id, patch) =>
        set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removeProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
      adjustStock: (id, delta) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p,
          ),
        })),

      addCustomer: (c) => {
        const customer: Customer = {
          ...c,
          phone: normalizePhone(c.phone),
          id: uid('c_'),
          createdAt: Date.now(),
        }
        set((s) => ({ customers: [customer, ...s.customers] }))
        return customer
      },
      updateCustomer: (id, patch) =>
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === id ? { ...c, ...patch, phone: patch.phone ? normalizePhone(patch.phone) : c.phone } : c,
          ),
        })),
      removeCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),

      completeSale: (input) => {
        const state = get()
        const subtotal = input.lines.reduce((sum, l) => sum + l.price * l.qty, 0)
        const discount = Math.min(input.discount || 0, subtotal)
        const total = subtotal - discount
        const creditAmount = input.tenders
          .filter((t) => t.method === 'credit')
          .reduce((sum, t) => sum + t.amount, 0)

        const counter = state.receiptCounter
        const currentStaff = state.staff.find((m) => m.id === state.currentStaffId)
        const sale: Sale = {
          id: uid('s_'),
          receiptNo: fmtReceipt(counter),
          createdAt: Date.now(),
          lines: input.lines,
          subtotal,
          discount,
          total,
          tenders: input.tenders,
          creditAmount,
          customerId: input.customerId,
          cashierName: currentStaff?.name || state.settings.cashierName || 'Cashier',
        }

        // Deduct stock for real catalog items.
        const products = state.products.map((p) => {
          const line = input.lines.find((l) => l.productId === p.id)
          return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p
        })

        // Create a debt if any credit was taken and a customer is attached.
        const debts = [...state.debts]
        if (creditAmount > 0 && input.customerId) {
          debts.unshift({
            id: uid('d_'),
            customerId: input.customerId,
            saleId: sale.id,
            receiptNo: sale.receiptNo,
            originalAmount: creditAmount,
            balance: creditAmount,
            createdAt: sale.createdAt,
            status: 'open',
            payments: [],
          })
        }

        set({
          sales: [sale, ...state.sales],
          products,
          debts,
          receiptCounter: counter + 1,
        })
        return sale
      },

      recordDebtPayment: (debtId, amount, method, ref) =>
        set((s) => ({
          debts: s.debts.map((d) => {
            if (d.id !== debtId) return d
            const pay: DebtPayment = { id: uid('dp_'), amount, method, ref, at: Date.now() }
            const balance = Math.max(0, Math.round((d.balance - amount) * 100) / 100)
            return {
              ...d,
              balance,
              status: balance <= 0 ? 'settled' : 'open',
              payments: [...d.payments, pay],
            }
          }),
        })),

      markReminderSent: (debtId, channel) =>
        set((s) => ({
          debts: s.debts.map((d) =>
            d.id === debtId ? { ...d, lastReminderAt: Date.now(), lastReminderChannel: channel } : d,
          ),
        })),

      setPlan: (planId) => set((s) => ({ subscription: { ...s.subscription, planId } })),
      setAutoRenew: (v) => set((s) => ({ subscription: { ...s.subscription, autoRenew: v } })),
      setTenantId: (id) => set({ tenantId: id }),
      setServerBilling: (v) => set({ serverBilling: v }),

      recordSubscriptionPayment: (planId, cycle, method, ref) =>
        set((s) => {
          const now = Date.now()
          const plan = getPlan(planId)
          const amount = priceFor(plan, cycle)
          // New period starts from whichever is later: now, or the current due date.
          const from = Math.max(now, s.subscription.currentPeriodEnd)
          const periodEnd = from + periodDaysFor(cycle) * 24 * 60 * 60 * 1000
          const invoice: SubInvoice = {
            id: uid('inv_'),
            planId,
            amount,
            cycle,
            periodStart: from,
            periodEnd,
            issuedAt: now,
            paidAt: now,
            method,
            ref,
            status: 'paid',
          }
          return {
            subscription: {
              ...s.subscription,
              planId,
              billingCycle: cycle,
              lastPaymentAt: now,
              currentPeriodEnd: periodEnd,
              invoices: [invoice, ...s.subscription.invoices],
            },
          }
        }),

      simulateBillingAge: (daysOverdue) =>
        set((s) => {
          const DAY = 24 * 60 * 60 * 1000
          const now = Date.now()
          if (daysOverdue <= 0) {
            // Healthy: paid, due 30 days out.
            return {
              subscription: {
                ...s.subscription,
                lastPaymentAt: now,
                trialEndsAt: now - 1 * DAY,
                currentPeriodEnd: now + PERIOD_DAYS * DAY,
              },
            }
          }
          // Overdue by N days: last payment a period+N ago, due N days in the past.
          return {
            subscription: {
              ...s.subscription,
              lastPaymentAt: now - (PERIOD_DAYS + daysOverdue) * DAY,
              trialEndsAt: now - (PERIOD_DAYS + daysOverdue + 5) * DAY,
              currentPeriodEnd: now - daysOverdue * DAY,
            },
          }
        }),

      updateReminderRule: (patch) => set((s) => ({ reminderRule: { ...s.reminderRule, ...patch } })),
      logReminder: (entry) =>
        set((s) => ({
          reminderLog: [{ ...entry, id: uid('rl_'), at: Date.now() }, ...s.reminderLog].slice(0, 500),
        })),

      resetDemoData: () => set({ ...buildSeed() }),
      clearAll: () =>
        set({
          products: [],
          customers: [],
          sales: [],
          debts: [],
          receiptCounter: 1,
          reminderLog: [],
        }),
    }),
    {
      name: 'duka-pos-v1',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => {
        const { _hasHydrated, setHydrated, ...rest } = s as unknown as Record<string, unknown>
        void _hasHydrated
        void setHydrated
        return rest
      },
      onRehydrateStorage: () => (state, error) => {
        // Open the app no matter what — even if restoring saved data failed.
        if (state) state.setHydrated(true)
        else useStore.setState({ _hasHydrated: true })
        if (error) console.warn('Duka: could not restore saved data', error)
      },
    },
  ),
)

// ---- Derived selectors (pure functions over state) -------------------------

export interface DebtorSummary {
  customer: Customer
  totalBalance: number
  debts: Debt[]
  oldestAt: number
  lastReminderAt?: number
}

export function selectOpenDebtsByCustomer(state: State): DebtorSummary[] {
  const open = state.debts.filter((d) => d.status === 'open' && d.balance > 0)
  const byCustomer = new Map<string, Debt[]>()
  for (const d of open) {
    const arr = byCustomer.get(d.customerId) ?? []
    arr.push(d)
    byCustomer.set(d.customerId, arr)
  }
  const out: DebtorSummary[] = []
  for (const [customerId, debts] of byCustomer) {
    const customer = state.customers.find((c) => c.id === customerId)
    if (!customer) continue
    const totalBalance = debts.reduce((s, d) => s + d.balance, 0)
    const oldestAt = Math.min(...debts.map((d) => d.createdAt))
    const lastReminderAt = debts
      .map((d) => d.lastReminderAt ?? 0)
      .reduce((a, b) => Math.max(a, b), 0)
    out.push({
      customer,
      totalBalance,
      debts,
      oldestAt,
      lastReminderAt: lastReminderAt || undefined,
    })
  }
  // Biggest / oldest debts first — those are the ones to chase.
  return out.sort((a, b) => b.totalBalance - a.totalBalance)
}

export function selectTotalOwed(state: State): number {
  return state.debts.filter((d) => d.status === 'open').reduce((s, d) => s + d.balance, 0)
}

export function selectCurrentStaff(state: State): StaffMember | undefined {
  return state.staff.find((m) => m.id === state.currentStaffId)
}

export function selectRole(state: State): Role | undefined {
  return selectCurrentStaff(state)?.role
}

export interface Usage {
  shops: number
  staff: number
  products: number
  monthlyTx: number
}

/** Current usage of the shop, for comparing against plan limits. */
export function selectUsage(state: State): Usage {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthlyTx = state.sales.filter((s) => s.createdAt >= monthStart.getTime()).length
  return {
    shops: 1, // single-shop MVP
    staff: 1,
    products: state.products.length,
    monthlyTx,
  }
}
