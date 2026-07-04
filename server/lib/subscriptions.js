// ---------------------------------------------------------------------------
// Tenant subscription registry — the SERVER-SIDE source of truth for who is
// paid up. Each shop using Duka POS is a "tenant". The app reads its status
// from here, so a shop can't bypass billing by clearing its device.
//
// Storage is a JSON file for a simple single-instance deploy. For real scale,
// swap these functions for a database (Postgres/Supabase) — the interface
// stays the same.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPlan, priceFor, periodDaysFor, TRIAL_DAYS, GRACE_DAYS, RESTRICT_UNTIL_DAY } from './plans.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '..', 'data')
const FILE = resolve(DATA_DIR, 'tenants.json')
const DAY = 24 * 60 * 60 * 1000

/** @type {Map<string, any>} */
const tenants = new Map()

function load() {
  try {
    if (existsSync(FILE)) {
      const arr = JSON.parse(readFileSync(FILE, 'utf8'))
      for (const t of arr) tenants.set(t.id, t)
    }
  } catch {
    /* start empty on any read/parse error */
  }
}
function save() {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify([...tenants.values()], null, 2))
  } catch {
    /* best-effort; DB replaces this in production */
  }
}
load()

function normalizePhone(raw) {
  let s = String(raw || '').replace(/\D/g, '')
  if (s.startsWith('254')) return s
  if (s.startsWith('0')) return '254' + s.slice(1)
  if (s.startsWith('7') || s.startsWith('1')) return '254' + s
  return s
}

/** Same billing state machine as the app (src/lib/billing.ts). */
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

export function publicView(t) {
  const s = evaluateStatus(t)
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
    amountDue: priceFor(t.planId, t.cycle),
    invoices: t.invoices || [],
  }
}

export function findByPhone(phone) {
  const n = normalizePhone(phone)
  for (const t of tenants.values()) if (t.phone === n) return t
  return null
}

export function getTenant(id) {
  return tenants.get(id) || null
}

/** Create a tenant (on trial) or update an existing one's plan/phone. */
export function registerTenant({ business, phone, planId = 'standard', cycle = 'monthly', autoRenew = true }) {
  const n = normalizePhone(phone)
  let t = n ? findByPhone(n) : null
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
      invoices: [],
    }
    tenants.set(t.id, t)
  }
  save()
  return t
}

/** Mark a successful payment — extends the paid period. */
export function renew(id, { ref, method = 'mpesa', cycle } = {}) {
  const t = tenants.get(id)
  if (!t) return null
  const now = Date.now()
  const useCycle = cycle || t.cycle
  const from = Math.max(now, t.currentPeriodEnd)
  const periodEnd = from + periodDaysFor(useCycle) * DAY
  const amount = priceFor(t.planId, useCycle)
  t.cycle = useCycle
  t.lastPaymentAt = now
  t.currentPeriodEnd = periodEnd
  t.invoices = [
    { id: randomUUID(), planId: t.planId, cycle: useCycle, amount, method, ref: ref || null, periodStart: from, periodEnd, paidAt: now, status: 'paid' },
    ...(t.invoices || []),
  ].slice(0, 100)
  save()
  return t
}

export function setLastChargeAttempt(id) {
  const t = tenants.get(id)
  if (t) {
    t.lastChargeAttemptAt = Date.now()
    save()
  }
}

/** Test/demo helper: shift a tenant's dates to reproduce a billing state. */
export function simulateAge(id, daysOverdue) {
  const t = tenants.get(id)
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
  save()
  return t
}

/**
 * Tenants that should be auto-charged now: auto-renew on, past/at due date,
 * not suspended-beyond-recovery, and not already attempted in the last 12h.
 */
export function listDueForCharge(now = Date.now()) {
  const out = []
  for (const t of tenants.values()) {
    if (!t.autoRenew) continue
    const { status } = evaluateStatus(t, now)
    const dueForCharge = status === 'active' ? t.currentPeriodEnd - now <= DAY : ['grace', 'restricted', 'suspended'].includes(status)
    if (!dueForCharge) continue
    if (t.lastChargeAttemptAt && now - t.lastChargeAttemptAt < 12 * 60 * 60 * 1000) continue
    out.push(t)
  }
  return out
}

export function allTenants() {
  return [...tenants.values()].map(publicView)
}

export { getPlan }
