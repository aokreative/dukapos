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
  /** "Park a sale" wording — restaurants hold orders per table/customer. */
  park: string
  parkHint: string
}

export function bizLabels(t: BusinessType | undefined): BizLabels {
  if (t === 'restaurant') {
    return {
      stock: 'Menu',
      items: 'menu items',
      item: 'Menu item',
      searchHint: 'Search menu…',
      addLabel: 'Add dish',
      park: 'Hold order',
      parkHint: 'Hold this table’s order — start the next one',
    }
  }
  return {
    stock: 'Stock',
    items: 'products',
    item: 'Product',
    searchHint: 'Search product or scan barcode…',
    addLabel: 'Add',
    park: 'Park',
    parkHint: 'Park this sale and serve the next customer',
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

// --- Product form, tailored per business type --------------------------------
// Each vertical sees ONLY the fields that make sense for it, with wording that
// matches the trade — a restaurant adding a dish is never asked for a brand,
// barcode or colour; a boutique gets sizes & colours front and centre.
export interface ProductFieldConfig {
  /** SKU/barcode field (restaurants don't barcode dishes). */
  sku: boolean
  skuLabel: string
  brand: boolean
  brandLabel: string
  brandPlaceholder: string
  variants: boolean
  variantsLabel: string
  variantsPlaceholder: string
  /** Sold-by unit picker (kg/m/L…) — off where it never applies. */
  unit: boolean
  namePlaceholder: string
  categoryPlaceholder: string
  costLabel: string
}

const DEFAULT_FIELDS: ProductFieldConfig = {
  sku: true,
  skuLabel: 'SKU / Barcode',
  brand: true,
  brandLabel: 'Brand (optional)',
  brandPlaceholder: 'e.g. Menengai',
  variants: true,
  variantsLabel: 'Variations (optional) — sizes / flavours',
  variantsPlaceholder: 'e.g. 250g, 500g, 1kg',
  unit: true,
  namePlaceholder: 'e.g. Sugar 1kg',
  categoryPlaceholder: 'e.g. Groceries, Drinks, Household',
  costLabel: 'Buying price',
}

const FIELDS_BY_TYPE: Partial<Record<BusinessType, Partial<ProductFieldConfig>>> = {
  restaurant: {
    sku: false,
    brand: false,
    unit: false,
    variantsLabel: 'Portion options (optional)',
    variantsPlaceholder: 'e.g. Regular, Large, Family',
    namePlaceholder: 'e.g. Chicken Biryani',
    categoryPlaceholder: 'e.g. Mains, Sides, Drinks',
    costLabel: 'Ingredient cost per serving (optional)',
  },
  pharmacy: {
    brandLabel: 'Manufacturer / brand (optional)',
    brandPlaceholder: 'e.g. GSK, Dawa',
    variantsLabel: 'Strengths / pack sizes (optional)',
    variantsPlaceholder: 'e.g. 250mg, 500mg · or 10s, 30s',
    namePlaceholder: 'e.g. Paracetamol 500mg',
    categoryPlaceholder: 'e.g. Painkillers, Antibiotics, First aid',
  },
  hardware: {
    brandPlaceholder: 'e.g. Simba Cement, Stanley',
    variantsLabel: 'Sizes (optional)',
    variantsPlaceholder: 'e.g. 4-inch, 6-inch · or 1L, 5L',
    namePlaceholder: 'e.g. Nails 3-inch',
    categoryPlaceholder: 'e.g. Cement, Tools, Paint, Plumbing',
  },
  electronics: {
    skuLabel: 'SKU / Serial / Barcode',
    brandPlaceholder: 'e.g. HikVision, Samsung',
    variantsLabel: 'Colours / models (optional)',
    variantsPlaceholder: 'e.g. Black, Silver · or 32GB, 64GB',
    namePlaceholder: 'e.g. HDMI Cable 1.5m',
    categoryPlaceholder: 'e.g. Cables, Phones, CCTV, Accessories',
  },
  boutique: {
    unit: false,
    brandPlaceholder: 'e.g. Nike, Zara',
    variantsLabel: 'Sizes & colours',
    variantsPlaceholder: 'e.g. S, M, L, XL · or 38, 39, 40 · Red, Blue',
    namePlaceholder: 'e.g. Ladies Denim Jacket',
    categoryPlaceholder: 'e.g. Dresses, Shoes, Kids, Accessories',
  },
  agrovet: {
    brandPlaceholder: 'e.g. Twiga, Osho',
    variantsLabel: 'Pack sizes (optional)',
    variantsPlaceholder: 'e.g. 100g, 250g, 1kg',
    namePlaceholder: 'e.g. DAP Fertiliser',
    categoryPlaceholder: 'e.g. Seeds, Feeds, Vet medicine, Tools',
  },
  spices: {
    sku: false,
    brand: false,
    variants: false,
    namePlaceholder: 'e.g. Pilau Masala',
    categoryPlaceholder: 'e.g. Spices, Cereals, Herbs',
    costLabel: 'Buying price per unit',
  },
  wholesale: {
    variantsLabel: 'Pack sizes (optional)',
    variantsPlaceholder: 'e.g. 24-pack, carton, bale',
    namePlaceholder: 'e.g. Rice 25kg bag',
    categoryPlaceholder: 'e.g. Cereals, Drinks, Detergents',
  },
  babyshop: {
    unit: false,
    brandPlaceholder: 'e.g. Pampers, Johnson’s',
    variantsLabel: 'Sizes / ages (optional)',
    variantsPlaceholder: 'e.g. 0-3m, 3-6m · or S, M, L',
    namePlaceholder: 'e.g. Diapers Size 3',
    categoryPlaceholder: 'e.g. Diapers, Feeding, Clothes, Toys',
  },
  autospares: {
    skuLabel: 'Part number / barcode',
    brandLabel: 'Make / brand (optional)',
    brandPlaceholder: 'e.g. Toyota, Bosch, NGK',
    variantsLabel: 'Fitments / models (optional)',
    variantsPlaceholder: 'e.g. Corolla NZE, Probox, Vitz',
    namePlaceholder: 'e.g. Oil Filter C-110',
    categoryPlaceholder: 'e.g. Filters, Brakes, Oils, Bulbs',
  },
}

/** The product-form field set for a business type. */
export function productFields(t: BusinessType | undefined): ProductFieldConfig {
  return { ...DEFAULT_FIELDS, ...(FIELDS_BY_TYPE[t ?? 'shop'] ?? {}) }
}
