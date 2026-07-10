// ---------------------------------------------------------------------------
// Cloud sync (Supabase) — makes Duka a true ONLINE multi-device POS.
//
// Each shop signs in once (email + password). Its POS data then lives in the
// cloud and every signed-in device shares it live: a sale on one phone appears
// on the other. Offline still works — local state is the working copy and
// syncs when back online.
//
// Configured via VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY. Without them the
// app simply stays local-only (no cloud section shown as connected).
// ---------------------------------------------------------------------------
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { BizLocation, Customer, Debt, Product, ReminderLogEntry, ReturnRecord, Sale, StaffMember, StockTransfer } from '../types'
import { normalizeProduct } from './stock'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || ''

export const cloudConfigured = !!(url && key)

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient | null {
  if (!cloudConfigured) return null
  if (!client) client = createClient(url, key)
  return client
}

/** The slice of app state that syncs across devices. */
export interface SyncedState {
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  debts: Debt[]
  staff: StaffMember[]
  reminderLog: ReminderLogEntry[]
  receiptCounter: number
  locations: BizLocation[]
  transfers: StockTransfer[]
  returns: ReturnRecord[]
}

/** Fill defaults & migrate legacy shapes on state coming from the cloud. */
export function normalizeSynced(s: Partial<SyncedState>): SyncedState {
  return {
    products: (s.products ?? []).map((p) => normalizeProduct(p as Product & { stock?: number })),
    customers: s.customers ?? [],
    sales: s.sales ?? [],
    debts: s.debts ?? [],
    staff: s.staff ?? [],
    reminderLog: s.reminderLog ?? [],
    receiptCounter: s.receiptCounter ?? 1,
    locations: s.locations ?? [],
    transfers: s.transfers ?? [],
    returns: s.returns ?? [],
  }
}

/**
 * Merge remote + local so nothing important is ever lost:
 * - sales / reminderLog are append-only → union by id
 * - debts union by id; when both sides have one, keep the one with more
 *   payments (payments only grow), tie-break to lower balance (more paid)
 * - customers union by id (edits are rare; either copy is fine)
 * - products / staff: prefer the side that changed most recently (LWW by
 *   version), falling back to union for items only one side has
 * - receiptCounter: max of both so numbers never collide backwards
 */
export function mergeState(local: SyncedState, remote: SyncedState, remoteIsNewer: boolean): SyncedState {
  const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]))

  const unionAppendOnly = <T extends { id: string }>(a: T[], b: T[]) => {
    const m = byId(a)
    for (const x of b) if (!m.has(x.id)) m.set(x.id, x)
    return [...m.values()]
  }

  const mergeDebts = (a: Debt[], b: Debt[]) => {
    const m = byId(a)
    for (const d of b) {
      const cur = m.get(d.id)
      if (!cur) m.set(d.id, d)
      else {
        const pick =
          d.payments.length !== cur.payments.length
            ? d.payments.length > cur.payments.length ? d : cur
            : d.balance < cur.balance ? d : cur
        m.set(d.id, pick)
      }
    }
    return [...m.values()]
  }

  const lwwUnion = <T extends { id: string }>(preferred: T[], other: T[]) => {
    const m = byId(preferred)
    for (const x of other) if (!m.has(x.id)) m.set(x.id, x)
    return [...m.values()]
  }

  // Transfers: union by id; if both sides have one, the more "final" status
  // wins (received/cancelled beats pending) so a receive is never undone.
  const mergeTransfers = (a: StockTransfer[], b: StockTransfer[]) => {
    const rank = { pending: 0, cancelled: 1, received: 2 } as const
    const m = byId(a)
    for (const t of b) {
      const cur = m.get(t.id)
      if (!cur || rank[t.status] > rank[cur.status]) m.set(t.id, t)
    }
    return [...m.values()].sort((x, y) => y.createdAt - x.createdAt)
  }

  const [prefP, otherP] = remoteIsNewer ? [remote, local] : [local, remote]
  return {
    sales: unionAppendOnly(local.sales, remote.sales).sort((a, b) => b.createdAt - a.createdAt),
    reminderLog: unionAppendOnly(local.reminderLog, remote.reminderLog).sort((a, b) => b.at - a.at).slice(0, 500),
    returns: unionAppendOnly(local.returns, remote.returns).sort((a, b) => b.at - a.at),
    transfers: mergeTransfers(local.transfers, remote.transfers),
    debts: mergeDebts(remoteIsNewer ? remote.debts : local.debts, remoteIsNewer ? local.debts : remote.debts),
    customers: lwwUnion(prefP.customers, otherP.customers),
    products: lwwUnion(prefP.products, otherP.products),
    staff: lwwUnion(prefP.staff, otherP.staff),
    locations: lwwUnion(prefP.locations, otherP.locations),
    receiptCounter: Math.max(local.receiptCounter, remote.receiptCounter),
  }
}
