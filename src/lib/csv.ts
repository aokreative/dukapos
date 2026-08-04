// CSV import/export — QuickBooks-friendly.
// Import: accepts standard QuickBooks product/service and customer CSV
// exports (and any similar spreadsheet), cleans + dedupes, and inserts.
// Export: produces clean CSVs that QuickBooks (and Excel) can import.
import type { Customer, Product, Sale, Supplier } from '../types'
import { MAIN_LOCATION_ID } from './stock'
import { normalizePhone } from './format'
import { uid } from './id'

/** Minimal robust CSV parser (quotes, commas, CRLF). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQ = false
      } else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/** Find a column index by any of several header names (case-insensitive). */
function col(headers: string[], ...names: string[]): number {
  const h = headers.map((x) => x.trim().toLowerCase())
  for (const n of names) {
    const i = h.indexOf(n.toLowerCase())
    if (i !== -1) return i
  }
  // loose contains-match as fallback
  for (const n of names) {
    const i = h.findIndex((x) => x.includes(n.toLowerCase()))
    if (i !== -1) return i
  }
  return -1
}

const num = (v: string | undefined) => {
  const n = parseFloat((v ?? '').replace(/[^\d.-]/g, ''))
  return isNaN(n) ? 0 : n
}

export interface ImportResult {
  added: number
  updated: number
  skipped: number
}

/** Import products from a QuickBooks (or generic) CSV. Dedupe: SKU, then name. */
export function importProductsCSV(
  text: string,
  existing: Product[],
  locationId: string = MAIN_LOCATION_ID,
): { result: ImportResult; toAdd: Omit<Product, 'id'>[]; toUpdate: { id: string; patch: Partial<Product> }[] } {
  const rows = parseCSV(text)
  if (rows.length < 2) return { result: { added: 0, updated: 0, skipped: 0 }, toAdd: [], toUpdate: [] }
  const H = rows[0]
  const cName = col(H, 'Product/Service Name', 'Item Name', 'Product Name', 'Name', 'Item')
  const cSku = col(H, 'SKU', 'Barcode', 'Code')
  const cPrice = col(H, 'Sales Price', 'Price', 'Rate', 'Sales Price / Rate', 'Selling Price')
  const cCost = col(H, 'Purchase Cost', 'Cost', 'Buying Price')
  const cQty = col(H, 'Quantity On Hand', 'Qty On Hand', 'Quantity', 'Stock', 'Qty')
  const cCat = col(H, 'Category', 'Type', 'Income Account')
  if (cName === -1) return { result: { added: 0, updated: 0, skipped: rows.length - 1 }, toAdd: [], toUpdate: [] }

  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku.toLowerCase(), p]))
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]))
  const seen = new Set<string>()
  const toAdd: Omit<Product, 'id'>[] = []
  const toUpdate: { id: string; patch: Partial<Product> }[] = []
  let skipped = 0

  for (const r of rows.slice(1)) {
    const name = (r[cName] ?? '').trim()
    if (!name) {
      skipped++
      continue
    }
    const sku = cSku !== -1 ? (r[cSku] ?? '').trim() : ''
    const key = (sku || name).toLowerCase()
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    const price = cPrice !== -1 ? num(r[cPrice]) : 0
    const cost = cCost !== -1 ? num(r[cCost]) : 0
    const qty = cQty !== -1 ? num(r[cQty]) : 0
    const category = cCat !== -1 ? (r[cCat] ?? '').trim() || 'Imported' : 'Imported'
    const match = (sku && bySku.get(sku.toLowerCase())) || byName.get(name.toLowerCase())
    if (match) {
      toUpdate.push({ id: match.id, patch: { price: price || match.price, cost: cost || match.cost } })
    } else {
      toAdd.push({
        name,
        sku,
        category,
        price,
        cost,
        stockByLocation: { [locationId]: qty },
        reorderLevel: 5,
        active: true,
        trackStock: true,
      })
    }
  }
  return { result: { added: toAdd.length, updated: toUpdate.length, skipped }, toAdd, toUpdate }
}

/** Import customers from a QuickBooks (or generic) CSV. Dedupe: phone, then name. */
export function importCustomersCSV(
  text: string,
  existing: Customer[],
): { result: ImportResult; toAdd: Omit<Customer, 'id' | 'createdAt'>[] } {
  const rows = parseCSV(text)
  if (rows.length < 2) return { result: { added: 0, updated: 0, skipped: 0 }, toAdd: [] }
  const H = rows[0]
  const cName = col(H, 'Customer full name', 'Display Name', 'Customer', 'Full Name', 'Name')
  const cPhone = col(H, 'Phone Numbers', 'Phone', 'Mobile', 'Phone Number')
  const cNote = col(H, 'Note', 'Notes', 'Memo')
  if (cName === -1) return { result: { added: 0, updated: 0, skipped: rows.length - 1 }, toAdd: [] }

  const byPhone = new Set(existing.map((c) => c.phone))
  const byName = new Set(existing.map((c) => c.name.toLowerCase()))
  const seen = new Set<string>()
  const toAdd: Omit<Customer, 'id' | 'createdAt'>[] = []
  let skipped = 0

  for (const r of rows.slice(1)) {
    const name = (r[cName] ?? '').trim()
    if (!name) {
      skipped++
      continue
    }
    const phone = cPhone !== -1 ? normalizePhone((r[cPhone] ?? '').trim()) : ''
    const key = (phone || name).toLowerCase()
    if (seen.has(key) || (phone && byPhone.has(phone)) || byName.has(name.toLowerCase())) {
      skipped++
      continue
    }
    seen.add(key)
    toAdd.push({ name, phone: phone || '254700000000', note: cNote !== -1 ? (r[cNote] ?? '').trim() || undefined : undefined })
  }
  return { result: { added: toAdd.length, updated: 0, skipped }, toAdd }
}

// --- Export ------------------------------------------------------------------

function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export function productsToCSV(products: Product[], stockOf: (p: Product) => number): (string | number)[][] {
  return [
    ['Product/Service Name', 'SKU', 'Category', 'Sales Price', 'Purchase Cost', 'Quantity On Hand'],
    ...products.map((p) => [p.name, p.sku, p.category, p.price, p.cost, stockOf(p)]),
  ]
}

export function customersToCSV(customers: Customer[]): (string | number)[][] {
  return [
    ['Display Name', 'Phone', 'Note'],
    ...customers.map((c) => [c.name, c.phone, c.note ?? '']),
  ]
}

export function salesToCSV(sales: Sale[], customerName: (id?: string) => string): (string | number)[][] {
  return [
    ['Date', 'Receipt', 'Customer', 'Items', 'Subtotal', 'Discount', 'VAT', 'Total', 'Payment', 'Cashier', 'Note'],
    // Voided (reversed) sales are not exported — they are not revenue.
    ...sales.filter((s) => !s.voided).map((s) => [
      new Date(s.createdAt).toISOString(),
      s.receiptNo,
      customerName(s.customerId),
      s.lines.map((l) => `${l.qty}x ${l.name}`).join('; '),
      s.subtotal,
      s.discount,
      s.vatAmount ?? 0,
      s.total,
      s.tenders.map((t) => `${t.method}:${t.amount}`).join('; '),
      s.cashierName,
      s.note ?? '',
    ]),
  ]
}

/** Import suppliers from a CSV. Columns: Name, Phone, Supplies. Dedupe: phone, then name. */
export function importSuppliersCSV(
  text: string,
  existing: Supplier[],
): { result: ImportResult; toAdd: Omit<Supplier, 'id' | 'createdAt' | 'active'>[] } {
  const rows = parseCSV(text)
  if (rows.length < 2) return { result: { added: 0, updated: 0, skipped: 0 }, toAdd: [] }
  const H = rows[0]
  const cName = col(H, 'Supplier', 'Supplier Name', 'Name', 'Company', 'Vendor')
  const cPhone = col(H, 'Phone', 'Mobile', 'Contact', 'Phone Number')
  const cSupplies = col(H, 'Supplies', 'Items', 'Products', 'Description')
  const cNote = col(H, 'Note', 'Notes', 'Memo')
  if (cName === -1) return { result: { added: 0, updated: 0, skipped: rows.length - 1 }, toAdd: [] }

  const byPhone = new Set(existing.map((s) => s.phone))
  const byName = new Set(existing.map((s) => s.name.toLowerCase()))
  const seen = new Set<string>()
  const toAdd: Omit<Supplier, 'id' | 'createdAt' | 'active'>[] = []
  let skipped = 0

  for (const r of rows.slice(1)) {
    const name = (r[cName] ?? '').trim()
    if (!name) { skipped++; continue }
    const phone = cPhone !== -1 ? normalizePhone((r[cPhone] ?? '').trim()) : '254700000000'
    const key = (phone || name).toLowerCase()
    if (seen.has(key) || byName.has(name.toLowerCase()) || (phone !== '254700000000' && byPhone.has(phone))) {
      skipped++
      continue
    }
    seen.add(key)
    toAdd.push({
      name,
      phone,
      supplies: cSupplies !== -1 ? (r[cSupplies] ?? '').trim() || undefined : undefined,
      note: cNote !== -1 ? (r[cNote] ?? '').trim() || undefined : undefined,
    })
  }
  return { result: { added: toAdd.length, updated: 0, skipped }, toAdd }
}

export function suppliersToCSV(suppliers: Supplier[]): (string | number)[][] {
  return [
    ['Supplier Name', 'Phone', 'Supplies', 'Note'],
    ...suppliers.map((s) => [s.name, s.phone, s.supplies ?? '', s.note ?? '']),
  ]
}

export const csvUid = uid
