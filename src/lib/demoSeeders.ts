// ---------------------------------------------------------------------------
// Demo Seeders — rich mock data for each business vertical.
// IMPORTANT: These write ONLY to the local Zustand store.
// They NEVER push to Supabase or any remote database.
// Use ONLY for sales presentations and client demos.
// ---------------------------------------------------------------------------
import { useStore } from '../store/useStore'
import { MAIN_LOCATION_ID, defaultLocations } from './stock'
import { uid } from './id'
import type { Product, Customer, StaffMember, Debt, Sale, BusinessSettings, KitchenOrder } from '../types'

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

  const ko = (table: string, minsAgo: number, status: KitchenOrder['status'], pIndex: number): KitchenOrder => ({
    id: uid('ko_'),
    tableNumber: table,
    lines: [{ productId: products[pIndex].id, name: products[pIndex].name, price: products[pIndex].price, qty: 1 }],
    status,
    placedAt: now - minsAgo * 60000,
    statusChangedAt: now - (minsAgo - 5) * 60000,
    cashierName: staff[1].name,
    locationId: MAIN_LOCATION_ID,
  })

  const kitchenOrders = [
    ko('Table 4', 15, 'preparing', 0),
    ko('Table 2', 8, 'ready', 1),
    ko('VIP 1', 3, 'served', 4)
  ]

  applyDemo(
    baseSettings({ name: 'Mama Rose Kitchen', businessType: 'restaurant', tagline: 'Home-cooked meals' }),
    products, customers, staff, sales, debts, kitchenOrders
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

// ── 6. SHOP (DUKA / MINI-MART) ──────────────────────────────────────────────
export function seedShop() {
  const products: Product[] = [
    p('Sugar 1kg', 'SH001', 'Groceries', 150, 120, 100, 20),
    p('Milk 500ml', 'SH002', 'Dairy', 60, 50, 50, 15),
    p('Bread 400g', 'SH003', 'Bakery', 65, 55, 30, 10),
    p('Maize Flour 2kg', 'SH004', 'Groceries', 220, 180, 80, 20),
    p('Cooking Oil 1L', 'SH005', 'Groceries', 350, 290, 40, 10),
    p('Salt 500g', 'SH006', 'Groceries', 30, 20, 100, 20),
    p('Tea Leaves 250g', 'SH007', 'Groceries', 150, 110, 60, 15),
    p('Rice 1kg', 'SH008', 'Groceries', 200, 160, 90, 20),
    p('Washing Powder 500g', 'SH009', 'Detergents', 180, 140, 50, 10),
    p('Bar Soap', 'SH010', 'Detergents', 120, 90, 70, 15),
    p('Toothpaste 100g', 'SH011', 'Personal Care', 150, 110, 40, 10),
    p('Tissue Paper (2-pack)', 'SH012', 'Household', 80, 60, 100, 20),
    p('Drinking Water 1L', 'SH013', 'Drinks', 70, 50, 60, 15),
    p('Soda 500ml', 'SH014', 'Drinks', 80, 60, 120, 30),
    p('Biscuits 100g', 'SH015', 'Snacks', 50, 35, 80, 20),
  ]
  const customers = [
    customer('Mama Jane', '254710123456', 'Neighbor'),
    customer('John Doe', '254722987654', 'Local resident'),
    customer('Wanjiku', '254733456789', 'Regular buyer'),
  ]
  const staff = demoStaff('Kamau (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Kamau (Owner)')
  applyDemo(
    baseSettings({ name: 'Kamau Mini-Mart', businessType: 'shop', tagline: 'Your daily needs' }),
    products, customers, staff, sales, debts,
  )
}

// ── 7. ELECTRONICS ──────────────────────────────────────────────────────────
export function seedElectronics() {
  const products: Product[] = [
    p('HDMI Cable 1.5m', 'EL001', 'Cables', 350, 150, 50, 10, { brand: 'Generic' }),
    p('Extension Cable 4-way', 'EL002', 'Power', 850, 500, 30, 10, { brand: 'Tronic' }),
    p('Flash Drive 32GB', 'EL003', 'Storage', 800, 450, 40, 10, { brand: 'SanDisk' }),
    p('MicroSD Card 64GB', 'EL004', 'Storage', 1200, 700, 25, 5, { brand: 'Kingston' }),
    p('Wireless Mouse', 'EL005', 'Accessories', 1500, 800, 20, 5, { brand: 'Logitech', warrantyMonths: 12 }),
    p('Phone Charger Type-C', 'EL006', 'Accessories', 500, 250, 60, 15, { brand: 'Samsung' }),
    p('Bluetooth Earbuds', 'EL007', 'Audio', 2500, 1200, 15, 5, { brand: 'Oraimo', warrantyMonths: 6 }),
    p('CCTV Camera Outdoor', 'EL008', 'Security', 4500, 2800, 10, 3, { brand: 'Hikvision', warrantyMonths: 12 }),
    p('LED Bulb 9W', 'EL009', 'Lighting', 250, 120, 100, 20, { brand: 'Philips' }),
    p('Smart Watch', 'EL010', 'Wearables', 3500, 2000, 12, 4, { warrantyMonths: 6 }),
    p('Laptop Bag 15.6"', 'EL011', 'Accessories', 1800, 900, 20, 5),
    p('VGA Cable 3m', 'EL012', 'Cables', 450, 200, 15, 5),
    p('Power Bank 10000mAh', 'EL013', 'Power', 2200, 1300, 25, 8, { brand: 'Anker', warrantyMonths: 12 }),
    p('Wireless Keyboard', 'EL014', 'Accessories', 2800, 1500, 10, 3, { brand: 'HP', warrantyMonths: 12 }),
    p('Network Cable Cat6 (1m)', 'EL015', 'Networking', 100, 40, 200, 50),
  ]
  const customers = [
    customer('Tech Solutions Ltd', '254711111111', 'B2B client'),
    customer('David', '254722222222', 'Gadget enthusiast'),
    customer('Mary', '254733333333', 'Student'),
  ]
  const staff = demoStaff('Ken (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Ken (Owner)')
  applyDemo(
    baseSettings({ name: 'Ken Electronics', businessType: 'electronics', tagline: 'Gadgets & Accessories' }),
    products, customers, staff, sales, debts,
  )
}

// ── 8. AGROVET ──────────────────────────────────────────────────────────────
export function seedAgrovet() {
  const products: Product[] = [
    p('DAP Fertilizer 50kg', 'AG001', 'Fertilizer', 3500, 3000, 40, 10, { brand: 'Osho' }),
    p('CAN Fertilizer 50kg', 'AG002', 'Fertilizer', 2800, 2400, 50, 15, { brand: 'Osho' }),
    p('Dairy Meal 70kg', 'AG003', 'Feeds', 2200, 1800, 30, 10, { brand: 'Unga' }),
    p('Layers Mash 50kg', 'AG004', 'Feeds', 2400, 2000, 25, 8, { brand: 'Fugo' }),
    p('Maize Seeds 2kg', 'AG005', 'Seeds', 500, 350, 100, 20, { brand: 'Kenya Seed' }),
    p('Cabbage Seeds 10g', 'AG006', 'Seeds', 150, 100, 50, 10, { brand: 'Simlaw' }),
    p('Tick Wash 100ml', 'AG007', 'Vet Medicine', 250, 150, 40, 10),
    p('Dewormer (Cattle) 500ml', 'AG008', 'Vet Medicine', 800, 500, 20, 5),
    p('Weed Killer 1L', 'AG009', 'Pesticides', 1200, 850, 30, 10, { brand: 'Twiga' }),
    p('Insecticide 50ml', 'AG010', 'Pesticides', 300, 180, 60, 15),
    p('Mineral Block 2kg', 'AG011', 'Supplements', 450, 300, 40, 10),
    p('Milking Salve 500g', 'AG012', 'Supplies', 200, 120, 50, 15),
    p('Chicken Drinker 3L', 'AG013', 'Equipment', 350, 200, 20, 5),
    p('Knapsack Sprayer 16L', 'AG014', 'Equipment', 2500, 1800, 10, 3),
    p('Dog Food 5kg', 'AG015', 'Pet Food', 1500, 1100, 15, 5, { brand: 'Josera' }),
  ]
  const customers = [
    customer('Mzee Juma', '254711112222', 'Dairy farmer'),
    customer('Alice', '254722223333', 'Poultry farmer'),
    customer('Kiprono', '254733334444', 'Maize farmer'),
  ]
  const staff = demoStaff('Grace (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Grace (Owner)')
  applyDemo(
    baseSettings({ name: 'Grace Agrovet', businessType: 'agrovet', tagline: 'Farming solutions' }),
    products, customers, staff, sales, debts,
  )
}

// ── 9. SPICES ───────────────────────────────────────────────────────────────
export function seedSpices() {
  const products: Product[] = [
    p('Pilau Masala', 'SP001', 'Spices', 100, 50, 2, 0.5, { unit: 'kg' }), // 2kg in stock
    p('Tea Masala', 'SP002', 'Spices', 150, 80, 1.5, 0.5, { unit: 'kg' }),
    p('Black Pepper (Ground)', 'SP003', 'Spices', 200, 120, 1, 0.2, { unit: 'kg' }),
    p('Garlic Powder', 'SP004', 'Spices', 180, 100, 1.2, 0.3, { unit: 'kg' }),
    p('Ginger Powder', 'SP005', 'Spices', 160, 90, 1.5, 0.3, { unit: 'kg' }),
    p('Turmeric Powder', 'SP006', 'Spices', 120, 70, 2, 0.5, { unit: 'kg' }),
    p('Cinnamon Sticks', 'SP007', 'Spices', 250, 150, 0.8, 0.2, { unit: 'kg' }),
    p('Green Grams (Ndengu)', 'SP008', 'Cereals', 180, 130, 50, 10, { unit: 'kg' }),
    p('Yellow Beans', 'SP009', 'Cereals', 200, 150, 40, 10, { unit: 'kg' }),
    p('Njahi (Black Beans)', 'SP010', 'Cereals', 220, 160, 30, 10, { unit: 'kg' }),
    p('Pishori Rice', 'SP011', 'Cereals', 250, 190, 60, 15, { unit: 'kg' }),
    p('Groundnuts (Raw)', 'SP012', 'Nuts', 300, 220, 20, 5, { unit: 'kg' }),
    p('Baobab Seeds (Mabuyu)', 'SP013', 'Snacks', 100, 60, 5, 1, { unit: 'kg' }),
    p('Honey 500ml', 'SP014', 'Specialty', 450, 300, 15, 5, { unit: 'pc' }), // pc for honey
    p('Chia Seeds', 'SP015', 'Healthy Foods', 600, 400, 3, 0.5, { unit: 'kg' }),
  ]
  const customers = [
    customer('Mama Ntilie', '254711999999', 'Restaurant owner'),
    customer('Fatuma', '254722888888', 'Bulk buyer'),
    customer('Ahmed', '254733777777', 'Regular customer'),
  ]
  const staff = demoStaff('Ali (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Ali (Owner)')
  applyDemo(
    baseSettings({ name: 'Ali Spices & Cereals', businessType: 'spices', tagline: 'Fresh and pure' }),
    products, customers, staff, sales, debts,
  )
}

// ── 10. WHOLESALE ───────────────────────────────────────────────────────────
export function seedWholesale() {
  const products: Product[] = [
    p('Sugar 50kg Sack', 'WH001', 'Groceries', 6500, 5800, 100, 20),
    p('Maize Flour (12 x 2kg) Bale', 'WH002', 'Flour', 2400, 2100, 80, 15),
    p('Wheat Flour (12 x 2kg) Bale', 'WH003', 'Flour', 2600, 2300, 60, 10),
    p('Cooking Oil 20L Jerrycan', 'WH004', 'Oil', 5800, 5200, 40, 10),
    p('Rice 25kg Bag (Sindano)', 'WH005', 'Rice', 3200, 2800, 120, 30),
    p('Salt (40 x 500g) Carton', 'WH006', 'Groceries', 1000, 850, 50, 10),
    p('Tea Leaves (50 x 50g) Carton', 'WH007', 'Beverages', 2200, 1900, 30, 8),
    p('Milk (12 x 500ml) Carton', 'WH008', 'Dairy', 650, 580, 150, 40),
    p('Soda (24 x 300ml) Crate', 'WH009', 'Drinks', 1100, 950, 200, 50),
    p('Bottled Water (12 x 1L) Carton', 'WH010', 'Drinks', 600, 450, 80, 20),
    p('Bar Soap (10 x 1kg) Carton', 'WH011', 'Detergents', 1500, 1250, 60, 15),
    p('Washing Powder (12 x 500g) Bale', 'WH012', 'Detergents', 1800, 1500, 40, 10),
    p('Tissue Paper (10 x 4-pack) Bale', 'WH013', 'Household', 1400, 1100, 70, 15),
    p('Matches (10 x 10-box) Carton', 'WH014', 'Household', 500, 400, 50, 10),
    p('Biscuits (24 x 50g) Box', 'WH015', 'Snacks', 600, 480, 90, 20),
  ]
  const customers = [
    customer('Kamau Shop', '254711122122', 'Retailer in CBD'),
    customer('Mama Jane Kiosk', '254722233233', 'Estate kiosk'),
    customer('SuperMart Ltd', '254733344344', 'Supermarket'),
  ]
  const staff = demoStaff('Peter (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Peter (Owner)')
  applyDemo(
    baseSettings({ name: 'Peter Wholesale Distributors', businessType: 'wholesale', tagline: 'Bulk supplies at great prices' }),
    products, customers, staff, sales, debts,
  )
}

// ── 11. BABYSHOP ────────────────────────────────────────────────────────────
export function seedBabyshop() {
  const products: Product[] = [
    p('Pampers Size 3 (Jumbo)', 'BB001', 'Diapers', 2200, 1800, 30, 10, { brand: 'Pampers' }),
    p('Huggies Size 4', 'BB002', 'Diapers', 2000, 1600, 25, 8, { brand: 'Huggies' }),
    p('Baby Wipes 80pcs', 'BB003', 'Hygiene', 350, 200, 60, 15, { brand: 'Johnson\'s' }),
    p('Baby Lotion 500ml', 'BB004', 'Hygiene', 850, 600, 20, 5, { brand: 'Cussons' }),
    p('Baby Powder 200g', 'BB005', 'Hygiene', 400, 250, 30, 10, { brand: 'Johnson\'s' }),
    p('Feeding Bottle 250ml', 'BB006', 'Feeding', 600, 400, 40, 10, { brand: 'Philips Avent' }),
    p('Formula Milk No. 1 (400g)', 'BB007', 'Feeding', 1500, 1200, 15, 5, { brand: 'Nan', expiryDate: new Date(Date.now() + 180 * day).toISOString().slice(0, 10) }),
    p('Baby Cerelac 400g', 'BB008', 'Feeding', 750, 550, 25, 8, { brand: 'Nestle' }),
    p('Onesie (3-6 Months)', 'BB009', 'Clothing', 500, 300, 50, 15),
    p('Baby Romper', 'BB010', 'Clothing', 800, 500, 30, 10),
    p('Baby Socks (3-pack)', 'BB011', 'Clothing', 300, 150, 40, 10),
    p('Stroller', 'BB012', 'Gear', 12000, 8500, 5, 2, { brand: 'Graco' }),
    p('Baby Carrier', 'BB013', 'Gear', 3500, 2200, 10, 3),
    p('Cot Bedding Set', 'BB014', 'Nursery', 2500, 1600, 12, 4),
    p('Teething Toy', 'BB015', 'Toys', 450, 250, 35, 10),
  ]
  const customers = [
    customer('Sarah', '254711234123', 'New mom'),
    customer('Mercy', '254722345234', 'Expectant mother'),
    customer('John (Gift Buyer)', '254733456345', 'Baby shower shopper'),
  ]
  const staff = demoStaff('Stella (Owner)')
  const { sales, debts } = seedSalesAndDebts(customers, products, 'Stella (Owner)')
  applyDemo(
    baseSettings({ name: 'Stella Babyshop', businessType: 'babyshop', tagline: 'Everything for your little one' }),
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
  kitchenOrders?: KitchenOrder[],
) {
  useStore.setState({
    settings,
    products,
    customers,
    staff,
    currentStaffId: staff[0]?.id ?? null,
    staffLastActiveAt: Date.now(),
    _cloudOnboarding: 'complete',
    locations: defaultLocations(),
    sales,
    debts,
    receiptCounter: sales.length + 1,
    expenses: [],
    shifts: [],
    parkedCarts: [],
    kitchenOrders: kitchenOrders ?? [],
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
