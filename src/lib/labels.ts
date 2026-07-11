// Wording + feature presets that adapt to the business type chosen at
// onboarding. A preset only flips feature switches — the till flow never
// changes, so cashiers always get the same fast experience.
import type { BusinessType, BusinessSettings, FeatureFlags } from '../types'

export interface BizLabels {
  /** Nav + page title for the catalogue. */
  stock: string
  /** Plural noun for the things being sold. */
  items: string
  /** Singular, for forms. */
  item: string
  searchHint: string
  addLabel: string
}

export function bizLabels(t: BusinessType | undefined): BizLabels {
  if (t === 'restaurant') {
    return {
      stock: 'Menu',
      items: 'menu items',
      item: 'Menu item',
      searchHint: 'Search menu…',
      addLabel: 'Add dish',
    }
  }
  return {
    stock: 'Stock',
    items: 'products',
    item: 'Product',
    searchHint: 'Search product or scan barcode…',
    addLabel: 'Add',
  }
}

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  shop: 'Duka / Mini-mart',
  restaurant: 'Restaurant & Café',
  pharmacy: 'Pharmacy / Chemist',
  hardware: 'Hardware',
  electronics: 'Electronics / CCTV / Phones',
  boutique: 'Boutique / Shoes / Clothing',
  agrovet: 'Agrovet / Agro shop',
  spices: 'Spices, Herbs & Cereals',
  wholesale: 'Wholesale / Distribution',
  babyshop: 'Baby Shop',
  autospares: 'Auto Spares',
}

/** What each vertical typically needs — the owner can still toggle any switch.
 *  (Selling by weight/measure is always available to every business.)
 *  Branches & warehouse is ON everywhere by default so the tab is always
 *  present; a simple single shop can switch it off in Settings → Features. */
export const PRESET_FEATURES: Record<BusinessType, FeatureFlags> = {
  shop: { expiry: false, warranty: false, wholesale: false, branches: true },
  restaurant: { expiry: false, warranty: false, wholesale: false, branches: true },
  pharmacy: { expiry: true, warranty: false, wholesale: false, branches: true },
  hardware: { expiry: false, warranty: true, wholesale: true, branches: true },
  electronics: { expiry: false, warranty: true, wholesale: false, branches: true },
  boutique: { expiry: false, warranty: false, wholesale: true, branches: true },
  agrovet: { expiry: true, warranty: false, wholesale: false, branches: true },
  spices: { expiry: true, warranty: false, wholesale: true, branches: true },
  wholesale: { expiry: false, warranty: false, wholesale: true, branches: true },
  babyshop: { expiry: true, warranty: false, wholesale: false, branches: true },
  autospares: { expiry: false, warranty: true, wholesale: true, branches: true },
}

/** Active feature switches: the type's preset, overridden by any explicit
 *  toggles the owner has set (missing keys fall back to the preset). */
export function getFeatures(settings: Pick<BusinessSettings, 'businessType' | 'features'>): FeatureFlags {
  const preset = PRESET_FEATURES[settings.businessType ?? 'shop'] ?? PRESET_FEATURES.shop
  return { ...preset, ...(settings.features ?? {}) }
}

export const FEATURE_LABEL: Record<keyof FeatureFlags, { name: string; blurb: string }> = {
  expiry: { name: 'Expiry dates', blurb: 'Track expiry per item and get expiring-soon warnings' },
  warranty: { name: 'Warranty on receipts', blurb: 'Set warranty months per item — printed on every receipt' },
  wholesale: { name: 'Wholesale prices', blurb: 'A second price that applies automatically from a minimum quantity' },
  branches: { name: 'Branches & warehouse', blurb: 'Multiple locations with stock transfers — off for simple single shops' },
}

/** Units offered in the product form when "Sell by weight/measure" is on. */
export const UNITS = ['pc', 'kg', 'g', 'L', 'ml', 'm', 'bag', 'tray', 'dozen', 'bale'] as const
