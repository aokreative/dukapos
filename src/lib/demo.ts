// Per-vertical demo catalogues — picking a business type in Settings offers to
// load sample products that match it, so demos to clients look real instantly.
// Every item has a brand + category; units/expiry/warranty/wholesale where the
// vertical actually uses them.
import type { BusinessType, Product } from '../types'
import { MAIN_LOCATION_ID } from './stock'
import { uid } from './id'

interface D {
  n: string // name
  b?: string // brand
  c: string // category
  p: number // selling price
  k: number // cost
  s?: number // stock (default 10)
  u?: string // unit
  w?: number // warranty months
  wp?: number // wholesale price
  wq?: number // wholesale min qty
  e?: string // expiry (ISO)
  nt?: boolean // trackStock=false
}

function mk(d: D): Omit<Product, 'id'> {
  return {
    name: d.n,
    brand: d.b,
    sku: '',
    category: d.c,
    price: d.p,
    cost: d.k,
    stockByLocation: { [MAIN_LOCATION_ID]: d.s ?? 10 },
    reorderLevel: 3,
    active: true,
    trackStock: d.nt ? false : true,
    unit: d.u,
    warrantyMonths: d.w,
    wholesalePrice: d.wp,
    wholesaleMinQty: d.wq,
    expiryDate: d.e,
  }
}

const inMonths = (m: number) => new Date(Date.now() + m * 30 * 86400000).toISOString().slice(0, 10)

const CATALOGS: Partial<Record<BusinessType, D[]>> = {
  electronics: [
    { n: 'iPhone 17 Pro Max 256GB', b: 'Apple', c: 'Phones', p: 215000, k: 198000, s: 4, w: 12 },
    { n: 'Samsung Galaxy A56', b: 'Samsung', c: 'Phones', p: 42000, k: 37500, s: 8, w: 24 },
    { n: 'AirPods Pro 3', b: 'Apple', c: 'Audio', p: 38000, k: 33000, s: 6, w: 12 },
    { n: 'Smart TV 43" 4K', b: 'Hisense', c: 'TVs', p: 46500, k: 40000, s: 5, w: 24 },
    { n: 'Dome Camera 2MP', b: 'HikVision', c: 'CCTV', p: 4800, k: 3500, s: 20, w: 12, wp: 4200, wq: 10 },
    { n: 'Bullet Camera 5MP', b: 'Dahua', c: 'CCTV', p: 7200, k: 5600, s: 14, w: 12, wp: 6500, wq: 10 },
    { n: 'NVR 8-Channel', b: 'HikVision', c: 'CCTV', p: 18500, k: 14800, s: 6, w: 12 },
    { n: 'Coaxial Cable 200m Roll', b: 'TMT', c: 'Cables', p: 8500, k: 6800, s: 7, w: 0 },
    { n: 'Coaxial Cable 100m Roll', b: 'TMT', c: 'Cables', p: 4600, k: 3600, s: 9 },
    { n: 'Coaxial Cable (per metre)', b: 'TMT', c: 'Cables', p: 60, k: 38, s: 400, u: 'm' },
    { n: 'Cat 6 Cable (per metre)', b: 'D-Link', c: 'Cables', p: 85, k: 55, s: 305, u: 'm' },
    { n: 'HDMI Cable 1.5m', b: 'Ugreen', c: 'Cables', p: 850, k: 520, s: 25 },
    { n: 'Power Supply 12V 5A', b: 'Generic', c: 'CCTV', p: 1400, k: 950, s: 18, w: 6 },
    { n: 'Phone Screen Protector', b: 'Generic', c: 'Accessories', p: 500, k: 150, s: 60, wp: 300, wq: 12 },
  ],
  pharmacy: [
    { n: 'Panadol Extra (strip)', b: 'GSK', c: 'Pain relief', p: 120, k: 80, s: 80, e: inMonths(14) },
    { n: 'Mara Moja (strip)', b: 'Sphinx', c: 'Pain relief', p: 60, k: 38, s: 100, e: inMonths(10) },
    { n: 'Amoxicillin 500mg (10s)', b: 'Cosmos', c: 'Antibiotics', p: 350, k: 240, s: 40, e: inMonths(8) },
    { n: 'Vitamin C 1000mg (30s)', b: 'Nature\'s Way', c: 'Supplements', p: 950, k: 640, s: 25, e: inMonths(20) },
    { n: 'Zinc + Multivitamin (60s)', b: 'Centrum', c: 'Supplements', p: 1850, k: 1350, s: 15, e: inMonths(22) },
    { n: 'Omega-3 Fish Oil (60s)', b: 'Seven Seas', c: 'Supplements', p: 1600, k: 1150, s: 12, e: inMonths(16) },
    { n: 'Cough Syrup 100ml', b: 'Benylin', c: 'Cold & flu', p: 480, k: 330, s: 30, e: inMonths(12) },
    { n: 'ORS Sachet', b: 'WHO Formula', c: 'First aid', p: 40, k: 22, s: 120, e: inMonths(24) },
    { n: 'Digital Thermometer', b: 'Omron', c: 'Devices', p: 850, k: 560, s: 10, w: 6 },
    { n: 'BP Machine', b: 'Omron', c: 'Devices', p: 6500, k: 5100, s: 4, w: 12 },
    { n: 'Surgical Gloves (pair)', b: 'Safeplus', c: 'First aid', p: 50, k: 25, s: 200 },
    { n: 'Face Masks (50s box)', b: 'Safeplus', c: 'First aid', p: 450, k: 280, s: 30, e: inMonths(30) },
  ],
  hardware: [
    { n: 'Cement 50kg', b: 'Simba', c: 'Building', p: 780, k: 690, s: 60, wp: 740, wq: 20 },
    { n: 'Steel Bar D10 (12m)', b: 'Devki', c: 'Building', p: 950, k: 810, s: 80, wp: 890, wq: 20 },
    { n: 'Nails (per kg)', b: 'Generic', c: 'Fasteners', p: 220, k: 150, s: 50, u: 'kg' },
    { n: 'Binding Wire (per kg)', b: 'Generic', c: 'Fasteners', p: 190, k: 130, s: 40, u: 'kg' },
    { n: 'Paint 4L Supergloss White', b: 'Crown', c: 'Paint', p: 2600, k: 2050, s: 15 },
    { n: 'Paint 20L Emulsion', b: 'Basco', c: 'Paint', p: 7800, k: 6300, s: 8, wp: 7200, wq: 5 },
    { n: 'PPR Pipe (per metre)', b: 'Kentainers', c: 'Plumbing', p: 180, k: 120, s: 200, u: 'm' },
    { n: 'Electric Cable 2.5mm (per metre)', b: 'East African Cables', c: 'Electrical', p: 95, k: 62, s: 500, u: 'm' },
    { n: 'Padlock 50mm', b: 'Tri-Circle', c: 'Security', p: 650, k: 420, s: 25, w: 3 },
    { n: 'Claw Hammer', b: 'Stanley', c: 'Tools', p: 950, k: 620, s: 12, w: 6 },
    { n: 'Angle Grinder 4.5"', b: 'Bosch', c: 'Power tools', p: 7500, k: 5900, s: 5, w: 12 },
    { n: 'Water Tank 1000L', b: 'Kentank', c: 'Plumbing', p: 11500, k: 9600, s: 6, w: 12 },
  ],
  agrovet: [
    { n: 'DAP Fertiliser 50kg', b: 'Yara', c: 'Fertiliser', p: 4200, k: 3700, s: 30, wp: 3950, wq: 10 },
    { n: 'CAN Fertiliser (per kg)', b: 'Yara', c: 'Fertiliser', p: 95, k: 70, s: 400, u: 'kg' },
    { n: 'Maize Seed 2kg (H614)', b: 'Kenya Seed', c: 'Seeds', p: 780, k: 620, s: 40, e: inMonths(10) },
    { n: 'Sukuma Seeds 50g', b: 'Simlaw', c: 'Seeds', p: 180, k: 110, s: 60, e: inMonths(14) },
    { n: 'Dairy Meal 70kg', b: 'Unga', c: 'Feeds', p: 3400, k: 2950, s: 25, wp: 3200, wq: 5 },
    { n: 'Chick Mash (per kg)', b: 'Fugo', c: 'Feeds', p: 85, k: 62, s: 300, u: 'kg' },
    { n: 'Acaricide 100ml', b: 'Norbrook', c: 'Animal health', p: 850, k: 610, s: 20, e: inMonths(18) },
    { n: 'Dewormer 1L', b: 'Ultravetis', c: 'Animal health', p: 1900, k: 1450, s: 12, e: inMonths(15) },
    { n: 'Spray Pump 20L', b: 'Jacto', c: 'Equipment', p: 3800, k: 2900, s: 6, w: 6 },
  ],
  boutique: [
    { n: 'Ladies Handbag', b: 'Zara Style', c: 'Bags', p: 2500, k: 1400, s: 10, wp: 1900, wq: 6 },
    { n: 'Official Shirt (M)', b: 'Van Heusen', c: 'Shirts', p: 1800, k: 1050, s: 12 },
    { n: 'Official Shirt (L)', b: 'Van Heusen', c: 'Shirts', p: 1800, k: 1050, s: 12 },
    { n: 'Sneakers — Size 40', b: 'Nike', c: 'Shoes', p: 4500, k: 3100, s: 6, wp: 3800, wq: 6 },
    { n: 'Sneakers — Size 42', b: 'Nike', c: 'Shoes', p: 4500, k: 3100, s: 8, wp: 3800, wq: 6 },
    { n: 'Leather Official Shoes 41', b: 'Bata', c: 'Shoes', p: 3800, k: 2600, s: 7 },
    { n: 'Ladies Dress (Free size)', b: 'Mango', c: 'Dresses', p: 2200, k: 1300, s: 9 },
    { n: 'Kids T-Shirt', b: 'H&M', c: 'Kids', p: 650, k: 380, s: 20, wp: 480, wq: 12 },
    { n: 'Maasai Shuka', b: 'Local', c: 'Accessories', p: 900, k: 550, s: 15, wp: 700, wq: 10 },
    { n: 'Belt (Genuine leather)', b: 'Local', c: 'Accessories', p: 800, k: 450, s: 14 },
  ],
  spices: [
    { n: 'Pilipili Powder (per kg)', b: 'Own blend', c: 'Spices', p: 800, k: 520, s: 25, u: 'kg', wp: 650, wq: 5, e: inMonths(12) },
    { n: 'Turmeric Powder (per kg)', b: 'Own blend', c: 'Spices', p: 900, k: 600, s: 20, u: 'kg', wp: 750, wq: 5, e: inMonths(12) },
    { n: 'Cumin/Binzari (per 100g)', b: 'Own blend', c: 'Spices', p: 120, k: 75, s: 80, u: 'g', e: inMonths(10) },
    { n: 'Pilau Masala 100g Pack', b: 'Tropical Heat', c: 'Packed', p: 180, k: 120, s: 40, e: inMonths(15) },
    { n: 'Cinnamon Sticks (per 100g)', b: 'Zanzibar', c: 'Spices', p: 150, k: 90, s: 50, e: inMonths(20) },
    { n: 'Dried Rosemary (per 50g)', b: 'Own farm', c: 'Herbs', p: 100, k: 55, s: 30, e: inMonths(9) },
    { n: 'Moringa Powder (per 100g)', b: 'Own farm', c: 'Herbs', p: 250, k: 150, s: 25, e: inMonths(11) },
    { n: 'Njugu Karanga (per kg)', b: 'Local', c: 'Cereals', p: 400, k: 280, s: 35, u: 'kg', wp: 340, wq: 10 },
    { n: 'Green Grams (per kg)', b: 'Local', c: 'Cereals', p: 220, k: 160, s: 60, u: 'kg', wp: 190, wq: 20 },
  ],
  babyshop: [
    { n: 'Diapers Size 3 (48s)', b: 'Pampers', c: 'Diapers', p: 1450, k: 1100, s: 20, e: inMonths(30) },
    { n: 'Diapers Size 4 (44s)', b: 'Huggies', c: 'Diapers', p: 1500, k: 1150, s: 18, e: inMonths(30) },
    { n: 'Baby Formula Stage 1 400g', b: 'NAN', c: 'Feeding', p: 1750, k: 1450, s: 15, e: inMonths(12) },
    { n: 'Baby Wipes (80s)', b: 'Softcare', c: 'Hygiene', p: 250, k: 160, s: 40 },
    { n: 'Feeding Bottle 250ml', b: 'Avent', c: 'Feeding', p: 950, k: 600, s: 12 },
    { n: 'Baby Romper 0-3m', b: 'Carter\'s', c: 'Clothing', p: 750, k: 420, s: 15 },
    { n: 'Baby Shawl', b: 'Local', c: 'Clothing', p: 1200, k: 700, s: 10 },
    { n: 'Petroleum Jelly 250g', b: 'Ballet', c: 'Hygiene', p: 320, k: 210, s: 30, e: inMonths(24) },
    { n: 'Baby Walker', b: 'Generic', c: 'Gear', p: 4500, k: 3200, s: 4 },
  ],
  autospares: [
    { n: 'Engine Oil 5W-30 4L', b: 'Total', c: 'Oils & fluids', p: 4200, k: 3300, s: 20, wp: 3800, wq: 6 },
    { n: 'Oil Filter (Toyota)', b: 'Toyota Genuine', c: 'Filters', p: 950, k: 620, s: 25, w: 3 },
    { n: 'Air Filter (Probox/Fielder)', b: 'Sakura', c: 'Filters', p: 1200, k: 800, s: 18 },
    { n: 'Brake Pads (Front, Vitz)', b: 'Bendix', c: 'Brakes', p: 3500, k: 2500, s: 10, w: 6 },
    { n: 'Car Battery N50', b: 'Chloride Exide', c: 'Batteries', p: 9800, k: 8000, s: 8, w: 12 },
    { n: 'Wiper Blades (pair)', b: 'Bosch', c: 'Accessories', p: 1400, k: 900, s: 15 },
    { n: 'Spark Plugs (set of 4)', b: 'NGK', c: 'Engine', p: 2200, k: 1500, s: 12, w: 3 },
    { n: 'Bulb H4 12V', b: 'Osram', c: 'Electrical', p: 450, k: 260, s: 30, wp: 350, wq: 10 },
    { n: 'ATF Fluid 1L', b: 'Castrol', c: 'Oils & fluids', p: 1100, k: 820, s: 20 },
  ],
  restaurant: [
    { n: 'Chips Masala', c: 'Mains', p: 250, k: 90, nt: true },
    { n: 'Beef Pilau', c: 'Mains', p: 350, k: 160, nt: true },
    { n: 'Ugali Beef', c: 'Mains', p: 300, k: 140, nt: true },
    { n: 'Chapati', c: 'Sides', p: 30, k: 12, nt: true },
    { n: 'Chicken 1/4', c: 'Mains', p: 450, k: 250, nt: true },
    { n: 'Samosa', c: 'Snacks', p: 50, k: 22, nt: true },
    { n: 'Chai (cup)', c: 'Drinks', p: 50, k: 18, nt: true },
    { n: 'Fresh Juice (Passion)', c: 'Drinks', p: 150, k: 60, nt: true },
    { n: 'Soda 500ml', b: 'Coca-Cola', c: 'Drinks', p: 80, k: 55, s: 48 },
    { n: 'Water 1L', b: 'Keringet', c: 'Drinks', p: 100, k: 65, s: 60 },
  ],
  wholesale: [
    { n: 'Sugar 50kg Bale', b: 'Mumias', c: 'Bales', p: 7400, k: 6900, s: 30, wp: 7150, wq: 5 },
    { n: 'Unga Bale (12×2kg)', b: 'Pembe', c: 'Bales', p: 1980, k: 1820, s: 40, wp: 1900, wq: 10 },
    { n: 'Rice 25kg Bag', b: 'Daawat', c: 'Bags', p: 4300, k: 3900, s: 25, wp: 4100, wq: 5 },
    { n: 'Cooking Oil 10L', b: 'Fresh Fri', c: 'Cartons', p: 3200, k: 2900, s: 20, wp: 3050, wq: 5 },
    { n: 'Soap Carton (100 bars)', b: 'Menengai', c: 'Cartons', p: 4800, k: 4300, s: 15, wp: 4550, wq: 3 },
    { n: 'Tissue Bale (40 rolls)', b: 'Hanan', c: 'Bales', p: 1500, k: 1280, s: 25, wp: 1400, wq: 5 },
    { n: 'Biscuits Carton (48s)', b: 'Britannia', c: 'Cartons', p: 2100, k: 1800, s: 18, wp: 1950, wq: 4 },
    { n: 'Salt Bale (24×1kg)', b: 'Kensalt', c: 'Bales', p: 950, k: 820, s: 30, wp: 890, wq: 10 },
  ],
}

/** Sample products for a business type — undefined when the base duka set fits. */
export function demoProductsFor(type: BusinessType): Omit<Product, 'id'>[] | undefined {
  const list = CATALOGS[type]
  return list?.map(mk)
}

export function demoProductsWithIds(type: BusinessType): Product[] | undefined {
  return demoProductsFor(type)?.map((p) => ({ ...p, id: uid('p_') }))
}
