// ---------------------------------------------------------------------------
// Demo Seeders — rich mock data for each business vertical.
// IMPORTANT: These write ONLY to the local Zustand store.
// They NEVER push to Supabase or any remote database.
// Use ONLY for sales presentations and client demos.
// ---------------------------------------------------------------------------
import { useStore } from '../store/useStore'
import { MAIN_LOCATION_ID } from './stock'
import { uid } from './id'
import type { Product, Customer, StaffMember, Debt, Sale, BusinessSettings } from '../types'

const now = Date.now()
const day = 86_400_000

// ── helpers ─────────────────────────────────────────────────────────────────

function p(
  name: string,
  sku: string,
  category: string,
  price: number,
  cost: number,
  stock: number,
  reorder = 5,
  extra: Partial<Product> = {},
): Product {
  return {
    id: uid('p_'),
    name,
    sku,
    category,
    price,
    cost,
    stockByLocation: { [MAIN_LOCATION_ID]: stock, loc_wh: Math.round(stock * 1.5) },
    reorderLevel: reorder,
    active: true,
    ...extra,
  }
}

function customer(name: string, phone: string, note?: string): Customer {
  return { id: uid('c_'), name, phone, note, createdAt: now - 30 * day }
}

function demoStaff(ownerName: string): StaffMember[] {
  return [
    { id: uid('staff_'), name: ownerName, role: 'owner', pin: '1234', active: true, createdAt: now },
    { id: uid('staff_'), name: 'Jane Cashier', role: 'cashier', pin: '0000', active: true, createdAt: now },
  ]
}

function baseSettings(overrides: Partial<BusinessSettings>): BusinessSettings {
  return {
    name: 'Demo Shop',
    tagline: '',
    businessType: 'shop',
    phone: '254712000000',
    location: 'Nairobi',
    mpesaType: 'till',
    mpesaTill: '832909',
    mpesaPaybill: '',
    mpesaAccount: '',
    airtelNumber: '',
    acceptCash: true,
    currency: 'KES',
    cashierName: 'Owner',
    reminderTemplate: 'Hello {name}, you owe {amount}. Please settle at your earliest convenience.',
    vatEnabled: false,
    vatRate: 16,
    vatMode: 'exclusive',
    loyaltyEnabled: false,
    loyaltyRate: 1,
    lowStockNudge: true,
    etimsEnabled: false,
    kraPin: '',
                            ...overrides,
  }
}

function seedSalesAndDebts(customers: Customer[], productList: Product[], staffName: string) {
  const sales: Sale[] = []
  const debts: Debt[] = []
  let counter = 1

  const mk = (cust: Customer, amount: number, ageDays: number, paid: boolean) => {
    const saleId = uid('s_')
    const rNo = `R-${String(counter++).padStart(5, '0')}`
    const at = now - ageDays * day
    const line = productList[Math.floor(Math.random() * productList.length)]
    sales.push({
      id: saleId,
      receiptNo: rNo,
      createdAt: at,
      lines: [{ productId: line.id, name: line.name, price: amount, qty: 1 }],
      subtotal: amount,
      discount: 0,
      total: amount,
      tenders: paid ? [{ method: 'cash', amount }] : [{ method: 'credit', amount }],
      creditAmount: paid ? 0 : amount,
      customerId: cust.id,
      cashierName: staffName,
      locationId: MAIN_LOCATION_ID,
    })
    if (!paid) {
      debts.push({
        id: uid('d_'),
        customerId: cust.id,
        saleId,
        receiptNo: rNo,
        originalAmount: amount,
        balance: amount,
        createdAt: at,
        status: 'open',
        payments: [],
        cashierName: staffName,
      })
    }
  }

  if (customers[0]) mk(customers[0], 1500, 14, false)
  if (customers[1]) mk(customers[1], 4200, 30, false)
  if (customers[0]) mk(customers[0], 800, 3, true)
  if (customers[2]) mk(customers[2], 2100, 5, true)

  return { sales, debts }
}


// ── 2. RESTAURANT ───────────────────────────────────────────────────────────

export function seedRestaurant() {
  const products: Product[] = [
    p('Ugali + Sukuma Wiki', 'R001', 'Main Meal', 120, 45, 0, 0, { trackStock: false }),
    p('Ugali + Beef Stew', 'R002', 'Main Meal', 200, 75, 0, 0, { trackStock: false }),
    p('Chapati (1 pc)', 'R003', 'Bread', 30, 10, 0, 0, { trackStock: false }),
    p('Githeri Special', 'R004', 'Main Meal', 100, 38, 0, 0, { trackStock: false }),
    p('Pilau (small)', 'R005', 'Rice', 180, 65, 0, 0, { trackStock: false }),
    p('Soda 300ml', 'R006', 'Drinks', 60, 40, 50, 20),
    p('Water 500ml', 'R007', 'Drinks', 40, 25, 60, 24),
    p('Fresh Juice', 'R008', 'Drinks', 80, 35, 0, 0, { trackStock: false }),
    p('Mandazi (2 pcs)', 'R009', 'Snacks', 30, 10, 0, 0, { trackStock: false }),
    p('Samosa (2 pcs)', 'R010', 'Snacks', 50, 20, 0, 0, { trackStock: false }),
    p('Tea (cup)', 'R011', 'Hot Drinks', 30, 8, 0, 0, { trackStock: false }),
    p('Coffee', 'R012', 'Hot Drinks', 50, 15, 0, 0, { trackStock: false }),
    p('Nyama Choma 250g', 'R013', 'Grill', 350, 200, 0, 0, { trackStock: false }),
    p('Chips (regular)', 'R014', 'Snacks', 120, 45, 0, 0, { trackStock: false }),
    p('Omena + Ugali', 'R015', 'Main Meal', 150, 55, 0, 0, { trackStock: false }),
  ]
  const customers = [
    customer('Table 1 — Walk-in', '254700000001'),
    customer('Brian Omondi', '254711234567', 'Delivery regular'),
    customer('City Council Canteen', '254722334455', 'Daily lunch order'),
  ]
  const staff = demoStaff('Rose (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Rose (Owner)')

  applyDemo(
    baseSettings({ name: 'Mama Rose Kitchen', businessType: 'restaurant', tagline: 'Home-cooked meals' }),
    products, customers, staff, sales, debts,
  )
}

// ── 3. PHARMACY ─────────────────────────────────────────────────────────────

export function seedPharmacy() {
  const exp = (months: number) => {
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return d.toISOString().slice(0, 10)
  }
  const products: Product[] = [
    p('Panadol 500mg (strip)', 'PH001', 'Analgesics', 25, 15, 80, 20, { brand: 'GSK', expiryDate: exp(18), batchNumber: 'BT-2024-A' }),
    p('Amoxicillin 500mg (caps x10)', 'PH002', 'Antibiotics', 120, 75, 30, 10, { prescription: true, expiryDate: exp(12), batchNumber: 'BT-2024-B' }),
    p('Ibuprofen 400mg (strip)', 'PH003', 'Analgesics', 40, 25, 60, 15),
    p('ORS Sachet', 'PH004', 'Rehydration', 15, 8, 100, 30, { expiryDate: exp(24) }),
    p('Metformin 500mg (tabs x30)', 'PH005', 'Diabetes', 220, 140, 20, 6, { prescription: true, expiryDate: exp(10) }),
    p('Salbutamol Inhaler', 'PH006', 'Respiratory', 480, 320, 8, 3, { prescription: true, brand: 'Ventolin', expiryDate: exp(8) }),
    p('Vitamin C 250mg (tab)', 'PH007', 'Vitamins', 5, 2, 200, 50),
    p('Multivitamin (strip x10)', 'PH008', 'Vitamins', 120, 80, 40, 10),
    p('Oral Rehydration Salts', 'PH009', 'Rehydration', 35, 20, 50, 15, { expiryDate: exp(20) }),
    p('Chloroquine 250mg', 'PH010', 'Antimalarials', 85, 50, 25, 8, { prescription: true, expiryDate: exp(15) }),
    p('Surgical Gloves (pair)', 'PH011', 'Medical Supplies', 45, 30, 60, 20),
    p('Bandage Roll', 'PH012', 'Medical Supplies', 60, 35, 40, 10),
    p('Digital Thermometer', 'PH013', 'Medical Devices', 650, 420, 5, 2, { warrantyMonths: 12 }),
    p('BP Monitor', 'PH014', 'Medical Devices', 2800, 1900, 3, 1, { brand: 'Omron', warrantyMonths: 24 }),
    p('Antacid Syrup 100ml', 'PH015', 'GI Tract', 95, 60, 18, 5, { expiryDate: exp(14) }),
  ]
  const customers = [
    customer('Mary Mwangi', '254712111222', 'Chronic — monthly BP meds'),
    customer('Peter Kamau', '254723222333', 'Diabetic patient'),
    customer('St. Francis Clinic', '254701333444', 'Bulk orders weekly'),
  ]
  const staff = demoStaff('Dr. Aisha (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Dr. Aisha (Owner)')

  applyDemo(
    baseSettings({ name: 'Aisha Pharmacy', businessType: 'pharmacy', tagline: 'Your health, our priority' }),
    products, customers, staff, sales, debts,
  )
}

// ── 4. BOUTIQUE ─────────────────────────────────────────────────────────────

export function seedBoutique() {
  const products: Product[] = [
    p('Ladies Dress (Casual)', 'BQ001', 'Dresses', 1800, 1100, 12, 3, { sizes: ['S', 'M', 'L', 'XL'], colors: ['Red', 'Black', 'Blue'] }),
    p('Men\'s Chinos', 'BQ002', 'Trousers', 2200, 1400, 8, 3, { sizes: ['28', '30', '32', '34', '36'], colors: ['Khaki', 'Navy', 'Olive'] }),
    p('Ladies Blouse', 'BQ003', 'Tops', 950, 580, 15, 5, { sizes: ['S', 'M', 'L'], colors: ['White', 'Pink', 'Yellow'] }),
    p('Men\'s T-Shirt', 'BQ004', 'Tops', 600, 350, 30, 10, { sizes: ['S', 'M', 'L', 'XL', 'XXL'], colors: ['White', 'Black', 'Grey'] }),
    p('Ladies Skirt (Midi)', 'BQ005', 'Skirts', 1200, 720, 10, 4, { sizes: ['S', 'M', 'L'], colors: ['Black', 'Floral'] }),
    p('Men\'s Suit Jacket', 'BQ006', 'Formal', 6500, 4200, 4, 2, { sizes: ['38', '40', '42', '44'], colors: ['Navy', 'Charcoal'] }),
    p('Sneakers (Unisex)', 'BQ007', 'Shoes', 3200, 2000, 6, 2, { sizes: ['36', '37', '38', '39', '40', '41', '42'], colors: ['White', 'Black'] }),
    p('Ladies Handbag', 'BQ008', 'Accessories', 1800, 1100, 8, 3, { colors: ['Brown', 'Black', 'Red'] }),
    p('Men\'s Belt (Leather)', 'BQ009', 'Accessories', 750, 450, 12, 4, { colors: ['Black', 'Brown'] }),
    p('Ankara Fabric (per yard)', 'BQ010', 'Fabric', 350, 220, 50, 10, { unit: 'yard', colors: ['Mixed'] }),
    p('Kids Dress (Girls)', 'BQ011', 'Kids', 800, 480, 10, 4, { sizes: ['2Y', '4Y', '6Y', '8Y'], colors: ['Pink', 'Purple'] }),
    p('School Uniform Shirt', 'BQ012', 'School', 450, 280, 25, 8, { sizes: ['S', 'M', 'L'], colors: ['White'] }),
    p('Denim Jacket', 'BQ013', 'Jackets', 2800, 1800, 5, 2, { sizes: ['S', 'M', 'L', 'XL'], colors: ['Blue', 'Black'] }),
    p('Ladies Heels', 'BQ014', 'Shoes', 2200, 1400, 6, 2, { sizes: ['36', '37', '38', '39', '40'], colors: ['Black', 'Nude', 'Red'] }),
    p('Sunglasses', 'BQ015', 'Accessories', 550, 300, 15, 5, { colors: ['Black', 'Brown', 'Gold'] }),
  ]
  const customers = [
    customer('Wanjiru Maina', '254712444555', 'VIP — buys every week'),
    customer('Amina Hassan', '254723555666'),
    customer('Zawadi Events', '254701666777', 'Bulk orders for events'),
  ]
  const staff = demoStaff('Fatuma (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Fatuma (Owner)')

  applyDemo(
    baseSettings({ name: 'Fatuma\'s Boutique', businessType: 'boutique', tagline: 'Fashion for every occasion' }),
    products, customers, staff, sales, debts,
  )
}

// ── 5. AUTO SPARES ──────────────────────────────────────────────────────────

export function seedAutoSpares() {
  const products: Product[] = [
    p('Engine Oil 5W30 1L', 'AS001', 'Lubricants', 850, 580, 24, 6, { brand: 'Total', warrantyMonths: 0 }),
    p('Air Filter — Toyota Corolla', 'AS002', 'Filters', 1200, 750, 10, 3, { compatibility: 'Toyota Corolla 2010–2020' }),
    p('Oil Filter — Nissan Note', 'AS003', 'Filters', 750, 480, 12, 4, { compatibility: 'Nissan Note 2005–2015' }),
    p('Brake Pads (front) — Probox', 'AS004', 'Brakes', 2800, 1800, 6, 2, { brand: 'Brembo', compatibility: 'Toyota Probox 2002–2022', warrantyMonths: 6 }),
    p('Brake Pads (front) — Axio', 'AS005', 'Brakes', 3200, 2100, 5, 2, { compatibility: 'Toyota Axio 2006–2022', warrantyMonths: 6 }),
    p('Wiper Blades (pair)', 'AS006', 'Wipers', 900, 550, 15, 4, { compatibility: 'Universal 24"' }),
    p('Spark Plugs (set x4)', 'AS007', 'Engine', 1800, 1100, 8, 3, { brand: 'NGK', compatibility: 'Most 1400–1800cc engines' }),
    p('Car Battery 45Ah', 'AS008', 'Electrical', 8500, 5800, 4, 1, { brand: 'Exide', warrantyMonths: 12 }),
    p('Alternator Belt — Demio', 'AS009', 'Engine', 1100, 680, 8, 3, { compatibility: 'Mazda Demio 2002–2016' }),
    p('Shock Absorber (front)', 'AS010', 'Suspension', 4500, 2900, 4, 2, { brand: 'Monroe', compatibility: 'Toyota Fielder 2006–2022', warrantyMonths: 12 }),
    p('Radiator Cap', 'AS011', 'Cooling', 350, 200, 20, 6),
    p('Coolant 1L', 'AS012', 'Cooling', 650, 400, 12, 4, { brand: 'Prestone' }),
    p('Clutch Plate — Surf', 'AS013', 'Transmission', 6800, 4500, 3, 1, { compatibility: 'Toyota Surf 3RZ 1996–2002' }),
    p('Headlight Bulb H4', 'AS014', 'Electrical', 450, 280, 20, 6),
    p('Timing Belt Kit', 'AS015', 'Engine', 3500, 2200, 5, 2, { brand: 'Gates', compatibility: 'Honda Fit 2008–2014', warrantyMonths: 6 }),
  ]
  const customers = [
    customer('Kiprotich Garage', '254712777888', 'Workshop — weekly orders'),
    customer('Quick Fix Motors', '254723888999', 'Loyal customer'),
    customer('Nairobi Taxi Sacco', '254701999000', 'Fleet of 40 cars'),
  ]
  const staff = demoStaff('Mwenda (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Mwenda (Owner)')

  applyDemo(
    baseSettings({ name: 'Mwenda Auto Spares', businessType: 'autospares', tagline: 'Genuine parts, guaranteed' }),
    products, customers, staff, sales, debts,
  )
}

// ── 6. HARDWARE & SPICES ────────────────────────────────────────────────────

export function seedHardwareSpices() {
  const products: Product[] = [
    // Hardware
    p('Cement (50kg bag)', 'HW001', 'Building', 800, 620, 30, 10, { unit: 'bag', brand: 'Bamburi' }),
    p('Iron Rod 12mm (per m)', 'HW002', 'Steel', 180, 130, 100, 20, { unit: 'm' }),
    p('Roofing Sheet 30g (per m)', 'HW003', 'Roofing', 950, 680, 50, 10, { unit: 'm', brand: 'Mabati Rolling Mills' }),
    p('Nails (per kg)', 'HW004', 'Fasteners', 150, 100, 20, 5, { unit: 'kg' }),
    p('Timber 2x4 (per m)', 'HW005', 'Wood', 120, 85, 80, 15, { unit: 'm' }),
    p('PVC Pipe 4" (per m)', 'HW006', 'Plumbing', 350, 230, 40, 10, { unit: 'm' }),
    p('Electrical Wire 2.5mm (per m)', 'HW007', 'Electrical', 85, 55, 100, 20, { unit: 'm' }),
    p('Paint (20L)', 'HW008', 'Paints', 4200, 2800, 8, 2, { brand: 'Sadolin' }),
    // Spices
    p('Black Pepper (per 100g)', 'SP001', 'Spices', 180, 110, 5, 1, { unit: 'kg' }),
    p('Cumin Seeds (per 100g)', 'SP002', 'Spices', 150, 90, 4, 1, { unit: 'kg' }),
    p('Coriander Powder (per 100g)', 'SP003', 'Spices', 120, 70, 5, 1, { unit: 'kg' }),
    p('Turmeric (per 100g)', 'SP004', 'Spices', 130, 80, 6, 1, { unit: 'kg' }),
    p('Cardamom (per 50g)', 'SP005', 'Spices', 250, 160, 2, 1, { unit: 'kg' }),
    p('Rice (Basmati, per kg)', 'SP006', 'Cereals', 180, 130, 50, 10, { unit: 'kg' }),
    p('Red Lentils (per kg)', 'SP007', 'Cereals', 160, 110, 30, 8, { unit: 'kg' }),
  ]
  const customers = [
    customer('Mwalimu Construction', '254712100200', 'School project bulk buyer'),
    customer('Farida Kitchen Spices', '254723200300', 'Reseller — weekly top-up'),
    customer('Kariuki Fundis', '254701300400', 'Multiple jua kali workers'),
  ]
  const staff = demoStaff('Njoroge (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Njoroge (Owner)')

  applyDemo(
    baseSettings({ name: 'Njoroge Hardware & Spices', businessType: 'hardware', tagline: 'Build it right, cook it right' }),
    products, customers, staff, sales, debts,
  )
}

// ── Core apply function ──────────────────────────────────────────────────────
// Writes ONLY to local Zustand. No Supabase calls.

function applyDemo(
  settings: BusinessSettings,
  products: Product[],
  customers: Customer[],
  staff: StaffMember[],
  sales: Sale[],
  debts: Debt[],
) {
  useStore.setState({
    settings,
    products,
    customers,
    staff,
    currentStaffId: staff[0]?.id ?? null,
    staffLastActiveAt: Date.now(),
    sales,
    debts,
    receiptCounter: sales.length + 1,
    expenses: [],
    shifts: [],
    parkedCarts: [],
    kitchenOrders: [],
    transfers: [],
    returns: [],
    exchangeCredit: 0,
    suppliers: [],
    supplierTxns: [],
    syncQueue: [], // ← never sync demo data to Supabase
    reminderLog: [],
  })
}

// ── Wipe ────────────────────────────────────────────────────────────────────

export function wipeLocalStore() {
  useStore.setState({
    settings: {
      name: '',
      tagline: '',
      businessType: 'shop',
      phone: '',
      location: '',
      mpesaType: 'till',
      mpesaTill: '',
      mpesaPaybill: '',
      mpesaAccount: '',
      airtelNumber: '',
      acceptCash: true,
      currency: 'KES',
      cashierName: '',
      reminderTemplate: '',
      vatEnabled: false,
      vatRate: 16,
      vatMode: 'exclusive',
      loyaltyEnabled: false,
      loyaltyRate: 1,
      lowStockNudge: true,
      etimsEnabled: false,
      kraPin: '',
                                        },
    products: [],
    customers: [],
    staff: [],
    currentStaffId: null,
    staffLastActiveAt: 0,
    sales: [],
    debts: [],
    receiptCounter: 0,
    expenses: [],
    shifts: [],
    parkedCarts: [],
    kitchenOrders: [],
    transfers: [],
    returns: [],
    exchangeCredit: 0,
    suppliers: [],
    supplierTxns: [],
    syncQueue: [],
    reminderLog: [],
  })
}
