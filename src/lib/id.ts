// Tiny id + receipt-number helpers. No external dependency needed.

export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 8)
  const time = Date.now().toString(36).slice(-4)
  return `${prefix}${time}${rand}`
}

/** Sequential-looking receipt number based on a running counter. */
export function receiptNo(counter: number): string {
  return `R-${String(counter).padStart(5, '0')}`
}
