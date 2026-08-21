// Tiny id + receipt-number helpers. No external dependency needed.

export function uid(prefix = ''): string {
  // Use crypto.randomUUID to ensure Postgres uuid compatibility, but keep the signature
  // for legacy support. We drop the prefix so it parses as a standard UUID.
  return crypto.randomUUID()
}

/** Sequential-looking receipt number based on a running counter. */
export function receiptNo(counter: number): string {
  return `R-${String(counter).padStart(5, '0')}`
}
