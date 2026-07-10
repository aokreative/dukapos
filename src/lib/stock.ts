// Per-location stock helpers. Every product's stock lives in a map keyed by
// location id (branches + warehouses). These helpers keep the arithmetic in
// one place.
import type { BizLocation, Product } from '../types'

/** The default location every business starts with. */
export const MAIN_LOCATION_ID = 'loc_main'

export function defaultLocations(): BizLocation[] {
  return [
    { id: MAIN_LOCATION_ID, name: 'Main Shop', type: 'branch', createdAt: Date.now() },
    { id: 'loc_wh', name: 'Warehouse', type: 'warehouse', createdAt: Date.now() },
  ]
}

/** Units of a product at one location. */
export function stockAt(p: Product, locationId: string): number {
  return p.stockByLocation?.[locationId] ?? 0
}

/** Units of a product across all locations. */
export function totalStock(p: Product): number {
  return Object.values(p.stockByLocation ?? {}).reduce((a, b) => a + b, 0)
}

/** New stock map with `delta` applied at a location (never below zero). */
export function withStockDelta(p: Product, locationId: string, delta: number): Record<string, number> {
  const cur = stockAt(p, locationId)
  return { ...(p.stockByLocation ?? {}), [locationId]: Math.max(0, cur + delta) }
}

/** Migrate a legacy product shape ({ stock: number }) to per-location stock. */
export function normalizeProduct(p: Product & { stock?: number }): Product {
  if (p.stockByLocation) return p
  const { stock, ...rest } = p
  return { ...rest, stockByLocation: { [MAIN_LOCATION_ID]: stock ?? 0 } } as Product
}

export const LOCATION_TYPE_LABEL: Record<BizLocation['type'], string> = {
  branch: 'Branch',
  warehouse: 'Warehouse / store',
}
