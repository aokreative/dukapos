// Wording that adapts to the business type chosen at onboarding.
import type { BusinessType } from '../types'

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
  shop: 'Duka / Retail shop',
  restaurant: 'Restaurant & Café',
}
