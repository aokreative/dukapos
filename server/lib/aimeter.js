// AI usage metering, quotas and short-term dedupe — the monetization guardrails.
//
// - Tracks how many AI requests each tenant makes per day.
// - Enforces a per-tenant daily quota (default 50), configurable per plan/tenant.
// - De-duplicates identical questions from the same tenant for 5 minutes so a
//   rapid double-click never double-bills Google.
//
// State is in-process (one Render instance). For a single small deployment this
// is exactly right; if you scale to multiple instances later, back these maps
// with the same Postgres store the subscriptions use.

const DEFAULT_DAILY_QUOTA = Number(process.env.AI_DAILY_QUOTA) || 50
const DEDUPE_MS = 5 * 60 * 1000

// tenantId -> { day: 'YYYY-MM-DD', count: n }
const usage = new Map()
// key `${tenantId}:${questionHash}` -> { at, answer }
const dedupe = new Map()

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Total AI requests a tenant has made today. */
export function usageToday(tenantId) {
  const u = usage.get(tenantId)
  if (!u || u.day !== today()) return 0
  return u.count
}

function bump(tenantId) {
  const d = today()
  const u = usage.get(tenantId)
  if (!u || u.day !== d) usage.set(tenantId, { day: d, count: 1 })
  else u.count += 1
}

/** How many queries this tenant has left today. */
export function remainingToday(tenantId, quota = DEFAULT_DAILY_QUOTA) {
  return Math.max(0, quota - usageToday(tenantId))
}

function hash(s) {
  // tiny stable hash for the dedupe key
  let h = 0
  const str = String(s).toLowerCase().replace(/\s+/g, ' ').trim()
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return h.toString(36)
}

/** Cached answer for an identical recent question, or null. */
export function cachedAnswer(tenantId, question) {
  const key = `${tenantId}:${hash(question)}`
  const hit = dedupe.get(key)
  if (hit && Date.now() - hit.at < DEDUPE_MS) return hit.answer
  return null
}

export function cacheAnswer(tenantId, question, answer) {
  dedupe.set(`${tenantId}:${hash(question)}`, { at: Date.now(), answer })
  // opportunistic cleanup
  if (dedupe.size > 5000) {
    const cutoff = Date.now() - DEDUPE_MS
    for (const [k, v] of dedupe) if (v.at < cutoff) dedupe.delete(k)
  }
}

/**
 * Gate an AI request. Returns:
 *  - { allow:false, reason:'quota', ... }  when over the daily cap
 *  - { allow:true, cached:<answer|null> }  otherwise (cached hit skips billing)
 * Call `record()` after a real (non-cached) model call succeeds.
 */
export function gate(tenantId, question, quota = DEFAULT_DAILY_QUOTA) {
  const cached = cachedAnswer(tenantId, question)
  if (cached) return { allow: true, cached }
  if (usageToday(tenantId) >= quota) {
    return { allow: false, reason: 'quota', used: usageToday(tenantId), quota }
  }
  return { allow: true, cached: null }
}

export function record(tenantId, question, answer) {
  bump(tenantId)
  cacheAnswer(tenantId, question, answer)
}

export function meterSummary(tenantId, quota = DEFAULT_DAILY_QUOTA) {
  return { used: usageToday(tenantId), quota, remaining: remainingToday(tenantId, quota) }
}

export { DEFAULT_DAILY_QUOTA }
