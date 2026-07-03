// Money, phone and date helpers — Kenya-first.

/** Format a number as Kenyan Shillings, e.g. 1500 -> "KES 1,500". */
export function money(n: number, currency = 'KES'): string {
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100
  const hasCents = Math.abs(rounded % 1) > 0.0001
  return `${currency} ${rounded.toLocaleString('en-KE', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

/** Format without the currency prefix, for compact chips. */
export function amount(n: number): string {
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100
  const hasCents = Math.abs(rounded % 1) > 0.0001
  return rounded.toLocaleString('en-KE', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

/**
 * Normalise a Kenyan phone number to the international dialling form
 * WhatsApp / SMS links expect (no plus): "2547XXXXXXXX" / "2541XXXXXXXX".
 * Accepts 07…, 01…, +2547…, 2547…, 7…
 */
export function normalizePhone(raw: string): string {
  let s = (raw || '').replace(/[^\d]/g, '')
  if (!s) return ''
  if (s.startsWith('254')) return s
  if (s.startsWith('0')) return '254' + s.slice(1)
  if (s.startsWith('7') || s.startsWith('1')) return '254' + s
  return s
}

/** Pretty local display, e.g. "0712 345 678". */
export function displayPhone(raw: string): string {
  const s = normalizePhone(raw)
  if (s.length === 12 && s.startsWith('254')) {
    const local = '0' + s.slice(3)
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
  }
  return raw
}

/** Basic validity check for a Kenyan Safaricom/Airtel number. */
export function isValidPhone(raw: string): boolean {
  const s = normalizePhone(raw)
  return /^254(7|1)\d{8}$/.test(s)
}

export function daysBetween(from: number, to: number = Date.now()): number {
  return Math.floor((to - from) / (1000 * 60 * 60 * 24))
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function shortDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeDays(ts: number): string {
  const d = daysBetween(ts)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

/** 0-30 / 31-60 / 61-90 / 90+ aging bucket for a debt. */
export function agingBucket(createdAt: number): '0-30' | '31-60' | '61-90' | '90+' {
  const d = daysBetween(createdAt)
  if (d <= 30) return '0-30'
  if (d <= 60) return '31-60'
  if (d <= 90) return '61-90'
  return '90+'
}
