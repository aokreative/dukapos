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
}

/** What each vertical typically needs — the owner can still toggle any switch. */
export const PRESET_FEATURES: Record<BusinessType, FeatureFlags> = {
  shop: { units: false, expiry: false, warranty: false, wholesale: false },
  restaurant: { units: false, expiry: false, warranty: false, wholesale: false },
  pharmacy: { units: false, expiry: true, warranty: false, wholesale: false },
  hardware: { units: true, expiry: false, warranty: true, wholesale: true },
  electronics: { units: false, expiry: false, warranty: true, wholesale: false },
  boutique: { units: false, expiry: false, warranty: false, wholesale: true },
  agrovet: { units: true, expiry: true, warranty: false, wholesale: false },
  spices: { units: true, expiry: true, warranty: false, wholesale: true },
  wholesale: { units: true, expiry: false, warranty: false, wholesale: true },
}

/** Active feature switches: the explicit setting, or the type's preset. */
export function getFeatures(settings: Pick<BusinessSettings, 'businessType' | 'features'>): FeatureFlags {
  return settings.features ?? PRESET_FEATURES[settings.businessType ?? 'shop'] ?? PRESET_FEATURES.shop
}

export const FEATURE_LABEL: Record<keyof FeatureFlags, { name: string; blurb: string }> = {
  units: { name: 'Sell by weight / measure', blurb: 'kg, grams, litres, metres… with decimal quantities at the till' },
  expiry: { name: 'Expiry dates', blurb: 'Track expiry per item and get expiring-soon warnings' },
  warranty: { name: 'Warranty on receipts', blurb: 'Set warranty months per item — printed on every receipt' },
  wholesale: { name: 'Wholesale prices', blurb: 'A second price that applies automatically from a minimum quantity' },
}

/** Units offered in the product form when "Sell by weight/measure" is on. */
export const UNITS = ['pc', 'kg', 'g', 'L', 'ml', 'm', 'bag', 'tray', 'dozen', 'bale'] as const
