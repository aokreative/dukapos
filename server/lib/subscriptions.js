// ---------------------------------------------------------------------------
// Tenant subscription registry — the SERVER-SIDE source of truth for who is
// paid up. Each shop using Duka POS is a "tenant". The app reads its status
// from here, so a shop can't bypass billing by clearing its device.
//
// Storage is pluggable: a zero-config JSON file by default, or Postgres/Supabase
// when DATABASE_URL is set. Business logic below is storage-agnostic.
// ---------------------------------------------------------------------------
import { randomUUID } from 'node:crypto'
import { getPlan, priceFor, periodDaysFor, TRIAL_DAYS, GRACE_DAYS, RESTRICT_UNTIL_DAY } from './plans.js'
import { createMemoryStore } from './store.memory.js'

const DAY = 24 * 60 * 60 * 1000
let store = null

export async function initSubscriptions() {
  if (process.env.DATABASE_URL) {
    const { createPgStore } = await import('./store.pg.js')
    store = await createPgStore(process.env.DATABASE_URL)
  } else {
    store = createMemoryStore()
  }
  await store.init()
  return store.kind
}

export function storeKind() {
  return store?.kind || 'memory'
}

function normalizePhone(raw) {
  let s = String(raw || '').replace(/\D/g, '')
  if (s.startsWith('254')) return s
  if (s.startsWith('0')) return '254' + s.slice(1)
  if (s.startsWith('7') || s.startsWith('1')) return '254' + s
  return s
}

/** Same billing state machine as the app (src/lib/billing.ts). Pure. */
export function evaluateStatus(t, now = Date.now()) {
  const paid = !!t.lastPaymentAt
  if (!paid && now < t.trialEndsAt) return { status: 'trial', due: t.trialEndsAt, overdueDays: 0 }
  const due = paid ? t.currentPeriodEnd : t.trialEndsAt
  if (now <= due) return { status: 'active', due, overdueDays: 0 }
  const over = Math.floor((now - due) / DAY)
  if (over <= GRACE_DAYS) return { status: 'grace', due, overdueDays: over }
  if (over <= RESTRICT_UNTIL_DAY) return { status: 'restricted', due, overdueDays: over }
  return { status: 'suspended', due, overdueDays: over }
}

/** What a tenant owes for the current cycle: plan price + AI add-on (if on). */
export function cycleAmount(t) {
  const base = priceFor(t.planId, t.cycle)
  const addon = t.aiEnabled ? (t.aiAddonPrice ?? 2500) : 0
  return base + addon
}

export function publicView(t) {
  const s = evaluateStatus(t)
  const owed = cycleAmount(t)
  const paidTowards = t.paidTowardsCycle || 0
  return {
    id: t.id,
    business: t.business,
    phone: t.phone,
    planId: t.planId,
    cycle: t.cycle,
    autoRenew: t.autoRenew,
    status: s.status,
    canSell: s.status === 'trial' || s.status === 'active' || s.status === 'grace',
    locked: s.status === 'suspended',
    overdueDays: s.overdueDays,
    currentPeriodEnd: t.currentPeriodEnd,
    trialEndsAt: t.trialEndsAt,
    lastPaymentAt: t.lastPaymentAt || null,
    amountDue: owed,
    // AI add-on (controlled from the Super-Admin portal).
    aiEnabled: !!t.aiEnabled,
    aiAddonPrice: t.aiAddonPrice ?? 2500,
    // Partial-payment tracking: what's still outstanding for the current cycle.
    paidTowardsCycle: paidTowards,
    balanceDue: Math.max(0, owed - paidTowards),
    invoices: t.invoices || [],
  }
}

export async function findByPhone(phone) {
  const n = normalizePhone(phone)
  return n ? store.getByPhone(n) : null
}

export async function getTenant(id) {
  return store.getById(id)
}

/** Create a tenant (on trial) or update an existing one's plan/phone. */
export async function registerTenant({ business, phone, planId = 'standard', cycle = 'monthly', autoRenew = true }) {
  const n = normalizePhone(phone)
  let t = n ? await store.getByPhone(n) : null
  const now = Date.now()
  if (t) {
    t.business = business || t.business
    t.planId = planId || t.planId
    t.cycle = cycle || t.cycle
    t.autoRenew = autoRenew
  } else {
    t = {
      id: randomUUID(),
      business: business || 'Duka',
      phone: n,
      planId,
      cycle,
      autoRenew,
      createdAt: now,
      trialEndsAt: now + TRIAL_DAYS * DAY,
      currentPeriodEnd: now + TRIAL_DAYS * DAY,
      lastPaymentAt: null,
      lastChargeAttemptAt: null,
      aiEnabled: false,
      aiAddonPrice: 2500,
      paidTowardsCycle: 0,
      invoices: [],
    }
  }
  await store.put(t)
  return t
}

/** Admin: turn the AI add-on on/off for a client and set its (adjustable) price. */
export async function setAiAddon(id, { enabled, price } = {}) {
  const t = await store.getById(id)
  if (!t) return null
  if (typeof enabled === 'boolean') t.aiEnabled = enabled
  if (typeof price === 'number' && price >= 0) t.aiAddonPrice = price
  await store.put(t)
  return t
}

/**
 * Apply a payment towards the current cycle (manual admin entry, or a matched
 * M-PESA till payment). Full payment renews & unlocks; a SHORT payment leaves
 * the shop owing the balance (and, if overdue, still locked) until it's cleared.
 * Returns { renewed, owed, paid, balanceDue }.
 */
export async function applyPayment(id, { amount = 0, ref, method = 'mpesa' } = {}) {
  const t = await store.getById(id)
  if (!t) return null
  const owed = cycleAmount(t)
  const paid = (t.paidTowardsCycle || 0) + Math.max(0, amount)
  if (paid + 1 >= owed) {
    // Fully covered — renew the period and carry any overpayment forward.
    const carryover = Math.max(0, Math.round((paid - owed) * 100) / 100)
    await renew(id, { ref, method }) // resets paidTowardsCycle to 0
    const fresh = await store.getById(id)
    fresh.paidTowardsCycle = carryover
    await store.put(fresh)
    return { renewed: true, owed, paid, balanceDue: 0, tenant: fresh }
  }
  // Short payment — record it, keep the balance outstanding.
  t.paidTowardsCycle = paid
  await store.put(t)
  return { renewed: false, owed, paid, balanceDue: Math.max(0, owed - paid), tenant: t }
}

/** Mark a successful payment — extends the paid period. */
export async function renew(id, { ref, method = 'mpesa', cycle } = {}) {
  const t = await store.getById(id)
  if (!t) return null
  const now = Date.now()
  const useCycle = cycle || t.cycle
  const from = Math.max(now, t.currentPeriodEnd)
  const periodEnd = from + periodDaysFor(useCycle) * DAY
  const amount = priceFor(t.planId, useCycle)
  t.cycle = useCycle
  t.lastPaymentAt = now
  t.currentPeriodEnd = periodEnd
  t.paidTowardsCycle = 0 // cycle fully covered; partial-payment bucket resets
  t.invoices = [
    { id: randomUUID(), planId: t.planId, cycle: useCycle, amount, method, ref: ref || null, periodStart: from, periodEnd, paidAt: now, status: 'paid' },
    ...(t.invoices || []),
  ].slice(0, 100)
  await store.put(t)
  return t
}

export async function setLastChargeAttempt(id) {
  const t = await store.getById(id)
  if (t) {
    t.lastChargeAttemptAt = Date.now()
    await store.put(t)
  }
}

/** Test/demo helper: shift a tenant's dates to reproduce a billing state. */
export async function simulateAge(id, daysOverdue) {
  const t = await store.getById(id)
  if (!t) return null
  const now = Date.now()
  if (daysOverdue <= 0) {
    t.lastPaymentAt = now
    t.trialEndsAt = now - DAY
    t.currentPeriodEnd = now + 30 * DAY
  } else {
    t.lastPaymentAt = now - (30 + daysOverdue) * DAY
    t.trialEndsAt = now - (35 + daysOverdue) * DAY
    t.currentPeriodEnd = now - daysOverdue * DAY
    t.lastChargeAttemptAt = null
  }
  await store.put(t)
  return t
}

/**
 * Tenants that should be auto-charged now: auto-renew on, past/at due date,
 * and not already attempted in the last 12h.
 */
export async function listDueForCharge(now = Date.now()) {
  const all = await store.all()
  return all.filter((t) => {
    if (!t.autoRenew) return false
    const { status } = evaluateStatus(t, now)
    const dueForCharge = status === 'active' ? t.currentPeriodEnd - now <= DAY : ['grace', 'restricted', 'suspended'].includes(status)
    if (!dueForCharge) return false
    if (t.lastChargeAttemptAt && now - t.lastChargeAttemptAt < 12 * 60 * 60 * 1000) return false
    return true
  })
}

export async function allTenants() {
  return (await store.all()).map(publicView)
}

export { getPlan }
