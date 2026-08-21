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
  BizLocation,
  BusinessSettings,
  CartLine,
  Customer,
  Debt,
  DebtPayment,
  DeliveryLine,
  Expense,
  PaymentMethod,
  Shift,
  PlanId,
  Product,
  ReminderLogEntry,
  ReminderRule,
  ReturnRecord,
  Role,
  Sale,
  StaffMember,
  StockTransfer,
  SubInvoice,
  Subscription,
  Supplier,
  SupplierTxn,
  Tender,
  TransferLine,
  SyncQueueItem,
  SyncOperation,
  KitchenOrder,
  OrderStatus,
} from '../types'

import { uid } from '../lib/id'
import { receiptNo as fmtReceipt } from '../lib/id'
import { normalizePhone } from '../lib/format'
import { PERIOD_DAYS, getPlan, priceFor, periodDaysFor } from '../lib/plans'
import {
  defaultReminderRule,
  defaultSettings,
  defaultSubscription,
} from '../lib/seed'
import { MAIN_LOCATION_ID, defaultLocations, normalizeProduct, stockAt, withStockDelta } from '../lib/stock'

// Durable storage. We write to BOTH IndexedDB and localStorage and read from
// whichever has data. This survives the awkward environments Kenyan shop
// owners actually open the app in — Gmail/WhatsApp in-app browsers, private
// modes, and partitioned webviews — where one store or the other is blocked.
// Whichever succeeds keeps the shop's data; the app never silently resets.
const LS = typeof localStorage !== 'undefined' ? localStorage : null

const idbStorage: StateStorage = {
  getItem: async (name) => {
    let fromIdb: string | null = null
    try {
      fromIdb = (await Promise.race([
        idbGet(name),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('idbGet timeout')), 500))
      ])) ?? null
    } catch {
      /* idb blocked or timed out — fall back to localStorage */
    }
    let fromLs: string | null = null
    try {
      fromLs = LS?.getItem(name) ?? null
    } catch {
      /* ls blocked too */
    }
    // Prefer whichever exists; if both do, parse and compare versions.
    if (fromIdb && fromLs) {
      try {
        const idb = JSON.parse(fromIdb) as any
        const ls = JSON.parse(fromLs) as any
        if (idb.version !== ls.version) {
          const winner = (idb.version > ls.version) ? fromIdb : fromLs
          // Write winner back to both to sync them
          void (idbStorage.setItem(name, winner) as any)
          return winner
        }
        if (idb.state?._savedAt && ls.state?._savedAt) {
          const winner = (idb.state._savedAt > ls.state._savedAt) ? fromIdb : fromLs
          void (idbStorage.setItem(name, winner) as any)
          return winner
        }
      } catch (e) {
        // Fallback to length if unparseable
      }
      return fromIdb.length >= fromLs.length ? fromIdb : fromLs
    }
    return fromIdb ?? fromLs
  },
  setItem: async (name, value) => {
    // Inject a savedAt timestamp so we can break ties on dual-write conflicts
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') {
        if (!parsed.state) parsed.state = {}
        parsed.state._savedAt = Date.now()
        value = JSON.stringify(parsed)
      }
    } catch {}

    // Mirror to localStorage first (synchronous, most reliable), then IndexedDB.
    try {
      LS?.setItem(name, value)
    } catch {
      /* quota or blocked — idb may still take it */
    }
    try {
      await Promise.race([
        idbSet(name, value),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('idbSet timeout')), 500))
      ])
    } catch {
      /* idb blocked or timed out — localStorage mirror carries us */
    }
  },
  removeItem: async (name) => {
    try {
      LS?.removeItem(name)
    } catch {
      /* ignore */
    }
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
  /** Credit the sale to this staff name (defaults to the signed-in cashier). */
  assignedToName?: string
  note?: string
  /** VAT charged ON TOP of the goods amount for this sale (0/absent = none). */
  vatAmount?: number
}

interface State {
  _hasHydrated: boolean
  _booted: boolean
  _cloudSession: 'off' | 'initializing' | 'signedOut' | 'signedIn' | 'error'
  _cloudRole: 'superadmin' | 'tenant' | null
  _cloudOnboarding: 'complete' | 'pending' | null
  _cloudEmail: string | null
  _cloudUnreachable: boolean
  
  _draftShopName: string
  _draftOwnerName: string
  _draftBizType: string | null
  setDraftOnboarding: (patch: Partial<{ _draftShopName: string, _draftOwnerName: string, _draftBizType: string | null }>) => void
  clearDraftOnboarding: () => void

  _isDemo: boolean
  setDemoMode: (v: boolean) => void

  _cartEmpty: boolean
  setCartEmpty: (v: boolean) => void

  dark: boolean

  settings: BusinessSettings
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  debts: Debt[]
  receiptCounter: number

  // branches / warehouses & stock movement
  locations: BizLocation[]
  /** Which location THIS device is selling from (not synced to other devices). */
  currentLocationId: string
  transfers: StockTransfer[]
  returns: ReturnRecord[]
  /** Credit from an exchange-return, auto-applied to the next sale as discount. */
  exchangeCredit: number

  // suppliers
  suppliers: Supplier[]
  supplierTxns: SupplierTxn[]

  /** Waiting sales on THIS device — park one customer, serve the next. */
  parkedCarts: { id: string; lines: CartLine[]; discount: number; at: number; name?: string }[]

  /** Restaurant: orders sent to the kitchen */
  kitchenOrders: KitchenOrder[]

  // running costs & cashier shifts
  expenses: Expense[]
  shifts: Shift[]

  // staff & access
  staff: StaffMember[]
  currentStaffId: string | null
  staffLastActiveAt: number

  // SaaS layer
  subscription: Subscription
  reminderRule: ReminderRule
  reminderLog: ReminderLogEntry[]
  tenantId?: string
  serverBilling: any | null

  // Offline sync queue
  syncQueue: SyncQueueItem[]
  dequeueSyncItems: (ids: string[]) => void
  enqueueSync: (op: SyncOperation) => void

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
  addProduct: (p: Omit<Product, 'id'>) => Product
  updateProduct: (id: string, patch: Partial<Product>) => void
  removeProduct: (id: string) => void
  /** Adjust stock at THIS device's current location. */
  adjustStock: (id: string, delta: number) => void

  // locations & transfers
  addLocation: (l: Omit<BizLocation, 'id' | 'createdAt'>) => void
  updateLocation: (id: string, patch: Partial<BizLocation>) => void
  removeLocation: (id: string) => void
  setCurrentLocation: (id: string) => void
  createTransfer: (input: { fromId: string; toId: string; lines: TransferLine[]; note?: string }) => void
  receiveTransfer: (id: string) => void
  cancelTransfer: (id: string) => void

  // returns
  recordReturn: (input: Omit<ReturnRecord, 'id' | 'at' | 'byStaffName' | 'locationId'>) => void
  clearExchangeCredit: () => void

  // suppliers
  addSupplier: (s: Omit<Supplier, 'id' | 'createdAt' | 'active'>) => void
  updateSupplier: (id: string, patch: Partial<Supplier>) => void
  removeSupplier: (id: string) => void
  addSupplierTxn: (t: Omit<SupplierTxn, 'id' | 'at' | 'byStaffName'>) => void
  /** Itemised goods-in: bumps stock at this location, updates buying prices,
   *  records the delivery (and the payment when paid on the spot). */
  receiveDelivery: (input: {
    supplierId: string
    lines: DeliveryLine[]
    extraAmount?: number
    paidNow?: { method: PaymentMethod; ref?: string }
    note?: string
  }) => void

  // debt comments
  addDebtComment: (debtId: string, text: string) => void

  // parked carts (per device)
  parkCart: (lines: CartLine[], discount: number, name?: string) => void
  removeParkedCart: (id: string) => void

  // kitchen orders
  placeKitchenOrder: (tableNumber: string, lines: CartLine[]) => void
  updateKitchenOrderStatus: (id: string, status: OrderStatus) => void
  removeKitchenOrder: (id: string) => void

  // expenses
  addExpense: (e: Omit<Expense, 'id' | 'at' | 'byStaffName' | 'locationId'>) => void
  removeExpense: (id: string) => void

  // shifts
  openShift: (openingCash: number) => void
  /** Close the signed-in cashier's open shift at this branch; reconciles cash. */
  closeShift: (countedCash: number) => Shift | null

  // customers
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => Customer
  updateCustomer: (id: string, patch: Partial<Customer>) => void
  removeCustomer: (id: string) => void

  // sales + debts
  completeSale: (input: CompleteSaleInput) => Sale
  /** Reverse a mistaken/faulty completed sale: put stock back, cancel any mkopo
   *  debt it created, reverse loyalty points, and mark it VOIDED (kept in
   *  history but excluded from revenue). `byName` records who authorised it. */
  voidSale: (saleId: string, reason: string, byName?: string) => void
  recordDebtPayment: (debtId: string, amount: number, method: PaymentMethod, ref?: string, note?: string) => void
  markReminderSent: (debtId: string, channel: 'whatsapp' | 'sms') => void

  // subscription / billing
  setPlan: (planId: PlanId) => void
  setAutoRenew: (v: boolean) => void
  recordSubscriptionPayment: (planId: PlanId, cycle: BillingCycle, method: 'mpesa' | 'card' | 'manual', ref?: string) => void
  setTenantId: (id: string) => void
  setServerBilling: (v: any | null) => void
  /** Demo helper: shift billing dates so a given status is reproduced. */
  simulateBillingAge: (daysOverdue: number) => void

  // reminders automation
  updateReminderRule: (patch: Partial<ReminderRule>) => void
  logReminder: (entry: Omit<ReminderLogEntry, 'id' | 'at'>) => void

  // data management
  resetDemoData: () => void
  clearAll: () => void
}

function buildCleanState() {
  return {
    settings: defaultSettings,
    products: [] as Product[],
    customers: [] as Customer[],
    sales: [] as Sale[],
    debts: [] as Debt[],
    receiptCounter: 0,
    staff: [] as StaffMember[],
    currentStaffId: null as string | null,
    staffLastActiveAt: 0,
    _booted: false,
    _cloudSession: 'initializing' as const,
    _cloudRole: null as 'superadmin' | 'tenant' | null,
    _cloudOnboarding: null as 'complete' | 'pending' | null,
    _cloudEmail: null as string | null,
    _cloudUnreachable: false,
    _draftShopName: '',
    _draftOwnerName: '',
    _draftBizType: null as string | null,
    _cartEmpty: true,
    locations: defaultLocations(),
    currentLocationId: MAIN_LOCATION_ID,
    transfers: [] as StockTransfer[],
    returns: [] as ReturnRecord[],
    exchangeCredit: 0,
    suppliers: [] as Supplier[],
    supplierTxns: [] as SupplierTxn[],
    parkedCarts: [] as { id: string; name?: string; lines: CartLine[]; discount: number; at: number }[],
    kitchenOrders: [] as KitchenOrder[],
    expenses: [] as Expense[],
    shifts: [] as Shift[],
    subscription: defaultSubscription(),
    reminderRule: defaultReminderRule,
    reminderLog: [] as ReminderLogEntry[],
    serverBilling: null as any | null,
    syncQueue: [] as SyncQueueItem[],
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      _isDemo: false,
      dark: false,
      ...buildCleanState(),

      setHydrated: (v) => set({ _hasHydrated: v }),
      setDemoMode: (v) => set({ _isDemo: v }),
      toggleDark: () => set((s) => ({ dark: !s.dark })),

      dequeueSyncItems: (ids) => set((s) => ({ syncQueue: s.syncQueue.filter((q) => !ids.includes(q.id)) })),
      enqueueSync: (op) => set((s) => ({ syncQueue: [...s.syncQueue, { id: uid('sq_'), op, createdAt: Date.now() }] })),

      staffLogin: (staffId, pin) => {
        const st = get()
        const member = st.staff.find((m) => m.id === staffId && m.active)
        if (member && member.pin === pin) {
          // If this staff member is assigned to a branch, drop them straight
          // into it so they sell that branch's stock (owners still roam).
          const assigned = member.locationId && st.locations.some((l) => l.id === member.locationId) ? member.locationId : null
          set(assigned ? { currentStaffId: staffId, currentLocationId: assigned, staffLastActiveAt: Date.now() } : { currentStaffId: staffId, staffLastActiveAt: Date.now() })
          return true
        }
        return false
      },
      logout: () => set({ currentStaffId: null, staffLastActiveAt: 0 }),
      addStaff: (s) => set((st) => ({ staff: [...st.staff, { ...s, id: uid('staff_'), createdAt: Date.now() }] })),
      updateStaff: (id, patch) =>
        set((st) => ({ staff: st.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      removeStaff: (id) =>
        set((st) => ({
          staff: st.staff.filter((m) => m.id !== id),
          currentStaffId: st.currentStaffId === id ? null : st.currentStaffId,
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addProduct: (p) => {
        const product: Product = { ...p, id: uid('p_') }
        const s = get()
        set({ products: [product, ...s.products] })
        s.enqueueSync({
          table: 'products',
          action: 'insert',
          record: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            stock: Object.values(product.stockByLocation).reduce((a, b) => a + b, 0),
            category: product.category,
          },
        })
        return product
      },
      updateProduct: (id, patch) => {
        const s = get()
        set({ products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
        const updated = get().products.find(p => p.id === id)
        if (updated) {
          s.enqueueSync({
            table: 'products',
            action: 'update',
            record: {
              id: updated.id,
              name: updated.name,
              sku: updated.sku,
              price: updated.price,
              stock: Object.values(updated.stockByLocation).reduce((a, b) => a + b, 0),
              category: updated.category,
            }
          })
        }
      },
      removeProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
      adjustStock: (id, delta) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, stockByLocation: withStockDelta(p, s.currentLocationId, delta) } : p,
          ),
        })),

      // --- Branches, warehouses & stock movement ---------------------------
      addLocation: (l) =>
        set((s) => ({ locations: [...s.locations, { ...l, id: uid('loc_'), createdAt: Date.now() }] })),
      updateLocation: (id, patch) =>
        set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      removeLocation: (id) =>
        set((s) => {
          if (s.locations.length <= 1) return s // always keep at least one
          // Any stock left there moves to the first remaining location.
          const fallback = s.locations.find((l) => l.id !== id)!
          const products = s.products.map((p) => {
            const qty = stockAt(p, id)
            if (!qty) return p
            const moved = withStockDelta(p, fallback.id, qty)
            delete moved[id]
            return { ...p, stockByLocation: moved }
          })
          return {
            locations: s.locations.filter((l) => l.id !== id),
            products,
            currentLocationId: s.currentLocationId === id ? fallback.id : s.currentLocationId,
          }
        }),
      setCurrentLocation: (id) =>
        set((s) => {
          // A staff member locked to a branch (assigned, and not the owner)
          // cannot switch away from it — they sell only in their branch.
          const staff = s.staff.find((m) => m.id === s.currentStaffId)
          const assigned = staff?.locationId
          const locked = !!assigned && staff?.role !== 'owner' && s.locations.some((l) => l.id === assigned)
          if (locked && id !== assigned) return s
          return { currentLocationId: id }
        }),

      createTransfer: ({ fromId, toId, lines, note }) =>
        set((s) => {
          const clean = lines.filter((l) => l.qty > 0)
          if (!clean.length || fromId === toId) return s
          const staffName = s.staff.find((m) => m.id === s.currentStaffId)?.name || 'Staff'
          // Stock leaves the source immediately (it's on the road).
          const products = s.products.map((p) => {
            const line = clean.find((l) => l.productId === p.id)
            return line ? { ...p, stockByLocation: withStockDelta(p, fromId, -line.qty) } : p
          })
          const transfer: StockTransfer = {
            id: uid('tr_'),
            fromId,
            toId,
            lines: clean,
            status: 'pending',
            note,
            createdBy: staffName,
            createdAt: Date.now(),
          }
          return { products, transfers: [transfer, ...s.transfers] }
        }),

      receiveTransfer: (id) =>
        set((s) => {
          const t = s.transfers.find((x) => x.id === id)
          if (!t || t.status !== 'pending') return s
          const staffName = s.staff.find((m) => m.id === s.currentStaffId)?.name || 'Staff'
          const products = s.products.map((p) => {
            const line = t.lines.find((l) => l.productId === p.id)
            return line ? { ...p, stockByLocation: withStockDelta(p, t.toId, line.qty) } : p
          })
          return {
            products,
            transfers: s.transfers.map((x) =>
              x.id === id ? { ...x, status: 'received' as const, receivedBy: staffName, receivedAt: Date.now() } : x,
            ),
          }
        }),

      cancelTransfer: (id) =>
        set((s) => {
          const t = s.transfers.find((x) => x.id === id)
          if (!t || t.status !== 'pending') return s
          // Goods go back to the source.
          const products = s.products.map((p) => {
            const line = t.lines.find((l) => l.productId === p.id)
            return line ? { ...p, stockByLocation: withStockDelta(p, t.fromId, line.qty) } : p
          })
          return {
            products,
            transfers: s.transfers.map((x) => (x.id === id ? { ...x, status: 'cancelled' as const } : x)),
          }
        }),

      // --- Returns ----------------------------------------------------------
      recordReturn: (input) =>
        set((s) => {
          const staffName = s.staff.find((m) => m.id === s.currentStaffId)?.name || 'Staff'
          // Returned goods go back on the shelf at this location.
          const products = s.products.map((p) => {
            const line = input.lines.find((l) => l.productId === p.id)
            return line && p.trackStock !== false
              ? { ...p, stockByLocation: withStockDelta(p, s.currentLocationId, line.qty) }
              : p
          })
          const rec: ReturnRecord = {
            ...input,
            id: uid('ret_'),
            at: Date.now(),
            byStaffName: staffName,
            locationId: s.currentLocationId,
          }
          return {
            products,
            returns: [rec, ...s.returns],
            // Exchanges become credit that the till auto-applies to the next sale.
            exchangeCredit: input.resolution === 'exchange' ? s.exchangeCredit + input.amount : s.exchangeCredit,
          }
        }),
      clearExchangeCredit: () => set({ exchangeCredit: 0 }),

      // --- Suppliers --------------------------------------------------------
      addSupplier: (sup) =>
        set((s) => ({ suppliers: [{ ...sup, id: uid('sup_'), active: true, createdAt: Date.now() }, ...s.suppliers] })),
      updateSupplier: (id, patch) =>
        set((s) => ({ suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      removeSupplier: (id) =>
        set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) })),
      addSupplierTxn: (t) =>
        set((s) => ({
          supplierTxns: [
            {
              ...t,
              id: uid('st_'),
              at: Date.now(),
              byStaffName: s.staff.find((m) => m.id === s.currentStaffId)?.name || 'Staff',
            },
            ...s.supplierTxns,
          ],
        })),

      receiveDelivery: ({ supplierId, lines, extraAmount = 0, paidNow, note }) =>
        set((s) => {
          const clean = lines.filter((l) => l.qty > 0)
          const amount = Math.round((clean.reduce((a, l) => a + l.qty * l.unitCost, 0) + extraAmount) * 100) / 100
          if (amount <= 0) return s
          const byStaffName = s.staff.find((m) => m.id === s.currentStaffId)?.name || 'Staff'
          // Goods land at this location; the buying price becomes the latest cost.
          const products = s.products.map((p) => {
            const line = clean.find((l) => l.productId === p.id)
            if (!line) return p
            return {
              ...p,
              cost: line.unitCost > 0 ? line.unitCost : p.cost,
              stockByLocation:
                p.trackStock !== false ? withStockDelta(p, s.currentLocationId, line.qty) : p.stockByLocation,
            }
          })
          const summary = clean.map((l) => `${l.qty}× ${l.name}`).join(', ')
          const txns: SupplierTxn[] = [
            {
              id: uid('st_'),
              supplierId,
              type: 'delivery',
              amount,
              lines: clean.length ? clean : undefined,
              items: summary || undefined,
              note,
              at: Date.now(),
              byStaffName,
            },
          ]
          if (paidNow) {
            txns.push({
              id: uid('st_'),
              supplierId,
              type: 'payment',
              amount,
              method: paidNow.method,
              ref: paidNow.ref,
              note: 'Paid on delivery',
              at: Date.now() + 1,
              byStaffName,
            })
          }
          return { products, supplierTxns: [...txns, ...s.supplierTxns] }
        }),

      addExpense: (e) =>
        set((s) => ({
          expenses: [
            {
              ...e,
              id: uid('exp_'),
              at: Date.now(),
              byStaffName: s.staff.find((m) => m.id === s.currentStaffId)?.name || 'Staff',
              locationId: s.currentLocationId,
            },
            ...s.expenses,
          ],
        })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      openShift: (openingCash) =>
        set((s) => {
          const staff = s.staff.find((m) => m.id === s.currentStaffId)
          if (!staff) return s
          // One open shift per person per branch.
          const already = s.shifts.some((sh) => sh.staffId === staff.id && sh.locationId === s.currentLocationId && !sh.closedAt)
          if (already) return s
          const shift: Shift = {
            id: uid('shift_'),
            staffId: staff.id,
            staffName: staff.name,
            locationId: s.currentLocationId,
            openedAt: Date.now(),
            openingCash: Math.max(0, openingCash || 0),
          }
          return { shifts: [shift, ...s.shifts] }
        }),

      closeShift: (countedCash) => {
        const s = get()
        const staff = s.staff.find((m) => m.id === s.currentStaffId)
        if (!staff) return null
        const open = s.shifts.find((sh) => sh.staffId === staff.id && sh.locationId === s.currentLocationId && !sh.closedAt)
        if (!open) return null
        // Everything this cashier rang up during the shift at this branch
        // (voided sales are excluded — that cash was handed back).
        const mySales = s.sales.filter(
          (x) => !x.voided && x.createdAt >= open.openedAt && x.cashierName === staff.name && (x.locationId ?? s.currentLocationId) === open.locationId,
        )
        const cashIn = mySales.reduce((a, x) => a + x.tenders.filter((t) => t.method === 'cash').reduce((b, t) => b + t.amount, 0), 0)
        const cashExpenses = s.expenses
          .filter((e) => e.at >= open.openedAt && e.byStaffName === staff.name && e.method === 'cash')
          .reduce((a, e) => a + e.amount, 0)
        const cashRefunds = s.returns
          .filter((r) => r.at >= open.openedAt && r.byStaffName === staff.name && r.resolution === 'refund' && r.method === 'cash')
          .reduce((a, r) => a + r.amount, 0)
        const expectedCash = Math.round((open.openingCash + cashIn - cashExpenses - cashRefunds) * 100) / 100
        const closed: Shift = {
          ...open,
          closedAt: Date.now(),
          countedCash,
          expectedCash,
          variance: Math.round((countedCash - expectedCash) * 100) / 100,
          totalSales: Math.round(mySales.reduce((a, x) => a + x.total, 0) * 100) / 100,
          txCount: mySales.length,
        }
        set((st) => ({ shifts: st.shifts.map((sh) => (sh.id === open.id ? closed : sh)) }))
        return closed
      },

      parkCart: (lines, discount, name) => set((s) => ({ parkedCarts: [...s.parkedCarts, { id: uid(), lines, discount, at: Date.now(), name }] })),
      removeParkedCart: (id) => set((s) => ({ parkedCarts: s.parkedCarts.filter((c) => c.id !== id) })),

      placeKitchenOrder: (tableNumber, lines) => set((s) => {
        const staff = s.staff.find((x) => x.id === s.currentStaffId)
        const now = Date.now()
        const newOrder: KitchenOrder = {
          id: uid('ko_'),
          tableNumber,
          lines,
          status: 'preparing',
          placedAt: now,
          statusChangedAt: now,
          cashierName: staff?.name ?? 'Unknown',
          locationId: s.currentLocationId,
        }
        return { kitchenOrders: [...s.kitchenOrders, newOrder] }
      }),
      updateKitchenOrderStatus: (id, status) => set((s) => ({
        kitchenOrders: s.kitchenOrders.map((o) => (o.id === id ? { ...o, status, statusChangedAt: Date.now() } : o))
      })),
      removeKitchenOrder: (id) => set((s) => ({
        kitchenOrders: s.kitchenOrders.filter((o) => o.id !== id)
      })),

      addDebtComment: (debtId, text) =>
        set((s) => ({
          debts: s.debts.map((d) =>
            d.id === debtId
              ? {
                  ...d,
                  comments: [
                    ...(d.comments ?? []),
                    {
                      id: uid('dc_'),
                      text,
                      at: Date.now(),
                      byStaffName: s.staff.find((m) => m.id === s.currentStaffId)?.name || 'Staff',
                    },
                  ],
                }
              : d,
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
        // Exchange credit from a return is applied automatically as discount.
        const credit = Math.min(state.exchangeCredit, subtotal)
        const discount = Math.min((input.discount || 0) + credit, subtotal)
        // Goods amount, then any VAT added on top → the grand total charged.
        const goods = subtotal - discount
        const vatAmount = Math.max(0, Math.round((input.vatAmount || 0) * 100) / 100)
        const total = Math.round((goods + vatAmount) * 100) / 100
        const creditAmount = input.tenders
          .filter((t) => t.method === 'credit')
          .reduce((sum, t) => sum + t.amount, 0)

        const counter = state.receiptCounter
        const currentStaff = state.staff.find((m) => m.id === state.currentStaffId)
        const cashierName = currentStaff?.name || state.settings.cashierName || 'Cashier'

        // Loyalty: earn a % of the GOODS value back as points (never on tax),
        // and redeem any points tendered (1 point = KES 1). Customer required.
        const loyaltyOn = !!state.settings.loyaltyEnabled && !!input.customerId
        const pointsRedeemed = input.tenders.filter((t) => t.method === 'points').reduce((s, t) => s + t.amount, 0)
        const pointsEarned = loyaltyOn ? Math.floor((goods * (state.settings.loyaltyRate ?? 1)) / 100) : 0

        // Primary payment method for reporting columns
        const primaryTender = input.tenders.length > 0 
          ? [...input.tenders].sort((a, b) => b.amount - a.amount)[0] 
          : undefined
        const mpesaTender = input.tenders.find(t => t.method === 'mpesa')

        const sale: Sale = {
          id: uid('s_'),
          receiptNo: fmtReceipt(counter),
          createdAt: Date.now(),
          lines: input.lines,
          subtotal,
          discount,
          total,
          vatAmount: vatAmount || undefined,
          payment_method: primaryTender?.method,
          mpesa_reference: mpesaTender?.ref || undefined,
          tenders: input.tenders,
          creditAmount,
          customerId: input.customerId,
          cashierName,
          assignedToName: input.assignedToName && input.assignedToName !== cashierName ? input.assignedToName : undefined,
          note: input.note,
          locationId: state.currentLocationId,
          pointsEarned: pointsEarned || undefined,
          pointsRedeemed: pointsRedeemed || undefined,
        }

        // Deduct stock at THIS branch (items flagged "don't track" are skipped).
        // Sum across lines so multiple variations of one product all deplete it.
        const products = state.products.map((p) => {
          if (p.trackStock === false) return p
          const qty = input.lines.filter((l) => l.productId === p.id).reduce((a, l) => a + l.qty, 0)
          return qty > 0 ? { ...p, stockByLocation: withStockDelta(p, state.currentLocationId, -qty) } : p
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
            cashierName,
          })
        }

        // Apply the net points change to the customer's balance.
        const customers =
          input.customerId && (pointsEarned || pointsRedeemed)
            ? state.customers.map((c) =>
                c.id === input.customerId
                  ? { ...c, points: Math.max(0, (c.points || 0) + pointsEarned - pointsRedeemed) }
                  : c,
              )
            : state.customers

        set({
          sales: [sale, ...state.sales],
          products,
          debts,
          customers,
          receiptCounter: counter + 1,
          exchangeCredit: credit > 0 ? state.exchangeCredit - credit : state.exchangeCredit,
        })
        
        // Enqueue to cloud
        const customer = input.customerId ? state.customers.find(c => c.id === input.customerId) : null
        state.enqueueSync({
          table: 'sales',
          action: 'insert',
          record: {
            id: sale.id,
            total: sale.total,
            status: 'completed'
          }
        })
        input.lines.forEach((l) => {
          state.enqueueSync({
            table: 'sale_items',
            action: 'insert',
            record: {
               sale_id: sale.id,
               product_id: l.productId,
               qty: l.qty,
               price: l.price
            }
          })
          const p = products.find((x) => x.id === l.productId)
          if (p && p.trackStock !== false) {
             state.enqueueSync({
               table: 'products',
               action: 'update',
               record: {
                 id: p.id,
                 stock: Object.values(p.stockByLocation).reduce((a, b) => a + b, 0)
               }
             })
          }
        })
        if (creditAmount > 0 && customer) {
          state.enqueueSync({
            table: 'debts',
            action: 'insert',
            record: {
              id: debts[0].id, // The one we just unshifted
              customer_name: customer.name,
              customer_phone: customer.phone,
              amount: creditAmount,
              status: 'unpaid'
            }
          })
        }

        return sale
      },

      voidSale: (saleId, reason, byName) =>
        set((s) => {
          const sale = s.sales.find((x) => x.id === saleId)
          if (!sale || sale.voided) return s
          const who = byName || s.staff.find((m) => m.id === s.currentStaffId)?.name || 'Staff'
          // Goods go back on the shelf at the branch that made the sale.
          const loc = sale.locationId ?? s.currentLocationId
          const products = s.products.map((p) => {
            if (p.trackStock === false) return p
            const qty = sale.lines.filter((l) => l.productId === p.id).reduce((a, l) => a + l.qty, 0)
            return qty > 0 ? { ...p, stockByLocation: withStockDelta(p, loc, qty) } : p
          })
          // Reverse loyalty: take back points earned, return points redeemed.
          const customers =
            sale.customerId && (sale.pointsEarned || sale.pointsRedeemed)
              ? s.customers.map((c) =>
                  c.id === sale.customerId
                    ? { ...c, points: Math.max(0, (c.points || 0) - (sale.pointsEarned || 0) + (sale.pointsRedeemed || 0)) }
                    : c,
                )
              : s.customers
          // Cancel any mkopo debt this sale created — the whole sale is reversed.
          const debts = s.debts.filter((d) => d.saleId !== sale.id)
          const sales = s.sales.map((x) =>
            x.id === saleId ? { ...x, voided: true, voidedAt: Date.now(), voidedBy: who, voidReason: reason.trim() || undefined } : x,
          )
          return { products, customers, debts, sales }
        }),

      recordDebtPayment: (debtId, amount, method, ref, note) =>
        set((s) => ({
          debts: s.debts.map((d) => {
            if (d.id !== debtId) return d
            const pay: DebtPayment = { id: uid('dp_'), amount, method, ref, note, at: Date.now() }
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
      setServerBilling: (v: any | null) => set({ serverBilling: v }),

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

      resetDemoData: () => set({ ...buildCleanState() }),
      clearAll: () =>
        set({
          products: [],
          customers: [],
          sales: [],
          debts: [],
          receiptCounter: 1,
          reminderLog: [],
          transfers: [],
          returns: [],
          exchangeCredit: 0,
          suppliers: [],
          supplierTxns: [],
          expenses: [],
          shifts: [],
          parkedCarts: [],
          kitchenOrders: [],
        }),
      setCartEmpty: (v) => set({ _cartEmpty: v }),
      setDraftOnboarding: (patch) => set((s) => ({ ...s, ...patch })),
      clearDraftOnboarding: () => set({ _draftShopName: '', _draftOwnerName: '', _draftBizType: null }),
    }),
    {
      name: 'duka-pos-v1',
      version: 5,
      migrate: (persisted, version) => {
        const s = persisted as Record<string, unknown> | undefined
        // v1 → v2: single-number stock becomes per-location stock; new
        // branches/transfers/returns state gets sensible defaults.
        if (s && version < 2) {
          const locs = s.locations as BizLocation[] | undefined
          s.locations = locs?.length ? locs : defaultLocations()
          s.currentLocationId = (s.currentLocationId as string) || MAIN_LOCATION_ID
          s.transfers ??= []
          s.returns ??= []
          s.exchangeCredit ??= 0
          s.products = ((s.products as Product[]) || []).map((p) => normalizeProduct(p))
          const oldSettings = s.settings as Partial<BusinessSettings>
          s.settings = { businessType: 'shop' as const, ...oldSettings }
        }
        // v2 → v3: suppliers.
        if (s && version < 3) {
          s.suppliers ??= []
          s.supplierTxns ??= []
        }
        // v3 → v4: expenses, shifts, parked carts.
        if (s && version < 4) {
          s.expenses ??= []
          s.shifts ??= []
          s.parkedCarts ??= []
        }
        // v4 → v5: wipe currentStaffId/serverBilling, and strip daraja credentials
        if (s && version < 5) {
          s.currentStaffId = null
          s.staffLastActiveAt = 0
          s.serverBilling = null

          const locs = s.locations as Record<string, unknown>[] | undefined
          if (locs) {
            s.locations = locs.map((l) => {
              const { stkConsumerKey, stkConsumerSecret, stkPasskey, ...rest } = l
              return rest
            })
          }
          
          const settings = s.settings as Record<string, unknown> | undefined
          if (settings) {
            const { mpesaConsumerKey, mpesaConsumerSecret, mpesaPasskey, ...restSettings } = settings
            s.settings = restSettings
          }
        }
        return persisted as State
      },
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => {
        const {
          _hasHydrated,
          setHydrated,
          _booted,
          _cloudSession,
          _cloudRole,
          _cloudOnboarding,
          _cloudEmail,
          _cloudUnreachable,
          _cartEmpty,
          setCartEmpty,
          setDraftOnboarding,
          clearDraftOnboarding,
          serverBilling,
          _isDemo,
          setDemoMode,
          ...rest
        } = s as unknown as Record<string, unknown>
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

export function selectCurrentLocation(state: State): BizLocation | undefined {
  return state.locations.find((l) => l.id === state.currentLocationId) ?? state.locations[0]
}

/** The branch a staff member is assigned to (if it still exists). */
export function selectAssignedLocationId(state: State): string | undefined {
  const staff = selectCurrentStaff(state)
  const loc = staff?.locationId
  return loc && state.locations.some((l) => l.id === loc) ? loc : undefined
}

/** True when the signed-in staff member is locked to one branch (assigned and
 *  not the owner) — the branch switcher is hidden and selling is confined. */
export function selectBranchLocked(state: State): boolean {
  return !!selectAssignedLocationId(state) && selectCurrentStaff(state)?.role !== 'owner'
}

/** The signed-in cashier's open shift at this branch, if any. */
export function selectOpenShift(state: State): Shift | undefined {
  const staff = selectCurrentStaff(state)
  if (!staff) return undefined
  return state.shifts.find((sh) => sh.staffId === staff.id && sh.locationId === state.currentLocationId && !sh.closedAt)
}

/** What the shop still owes a supplier: deliveries − payments − credit notes. */
export function supplierBalance(txns: SupplierTxn[], supplierId: string): number {
  let bal = 0
  for (const t of txns) {
    if (t.supplierId !== supplierId) continue
    bal += t.type === 'delivery' ? t.amount : -t.amount
  }
  return Math.round(bal * 100) / 100
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
