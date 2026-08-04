#!/usr/bin/env node
// scripts/seed-demo.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Demo account seed for Duka POS Phase 4
// Creates: "Baple Gadgets" shop (Duka/Mini Mart) + demo@baplegadgets.com user
//
// USAGE:
//   1. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (copy from Supabase → Settings → API → Secret keys)
//   2. Run: node scripts/seed-demo.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')

// Load .env.local for the service role key
function loadEnv() {
  const env = {}
  const files = ['.env.local', '.env.production', '.env']
  for (const f of files) {
    const p = join(root, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const [k, ...v] = line.split('=')
      if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim()
    }
  }
  return env
}

const env = loadEnv()

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(`
❌ Missing environment variables.

Please add the following to .env.local in the project root:

  SUPABASE_SERVICE_ROLE_KEY=sb_secret_...your-key-here...

You can find it at: Supabase dashboard → Settings → API → Secret keys → default

Then run: node scripts/seed-demo.mjs
`)
  process.exit(1)
}

const DEMO_EMAIL = 'demo@baplegadgets.com'
const DEMO_PASSWORD = 'demo1234'
const SHOP_NAME = 'Baple Gadgets'
const BUSINESS_TYPE = 'shop' // Duka/Mini Mart maps to 'shop' type

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('\n🚀 Duka POS — Demo Account Seed\n')
  console.log(`   Shop: ${SHOP_NAME}`)
  console.log(`   Email: ${DEMO_EMAIL}`)
  console.log(`   Password: ${DEMO_PASSWORD}\n`)

  // ── 1. Create / fetch auth user ───────────────────────────────────────────
  console.log('1️⃣  Creating Supabase Auth user...')
  let userId

  // Try to create; if email exists, look it up instead
  const { data: createData, error: createErr } = await sb.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true, // skip the confirmation email for the demo account
  })

  if (createErr) {
    if (createErr.message.includes('already been registered') || createErr.code === 'email_exists') {
      console.log('   ℹ️  User already exists — fetching...')
      const { data: listData } = await sb.auth.admin.listUsers()
      const existing = listData?.users?.find((u) => u.email === DEMO_EMAIL)
      if (!existing) {
        console.error('   ❌ Could not find existing user:', createErr.message)
        process.exit(1)
      }
      userId = existing.id
      // Reset password to make sure it's demo1234
      await sb.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD })
      console.log(`   ✅ Found user: ${userId}`)
    } else {
      console.error('   ❌ Create user failed:', createErr.message)
      process.exit(1)
    }
  } else {
    userId = createData.user.id
    console.log(`   ✅ Created user: ${userId}`)
  }

  // ── 2. Create / fetch shop ────────────────────────────────────────────────
  console.log('\n2️⃣  Setting up shop...')
  let shopId

  // Check if a shop already exists for this owner
  const { data: existingShops } = await sb.from('shops').select('id, name').eq('owner_id', userId)
  if (existingShops && existingShops.length > 0) {
    shopId = existingShops[0].id
    console.log(`   ℹ️  Shop already exists (${existingShops[0].name}) — updating...`)
    await sb.from('shops').update({
      name: SHOP_NAME,
      business_type: BUSINESS_TYPE,
      onboarding_complete: true,
    }).eq('id', shopId)
    console.log(`   ✅ Shop updated: ${shopId}`)
  } else {
    const { data: newShop, error: shopErr } = await sb.from('shops').insert({
      owner_id: userId,
      name: SHOP_NAME,
      business_type: BUSINESS_TYPE,
      onboarding_complete: true,
    }).select('id').single()

    if (shopErr) {
      console.error('   ❌ Shop creation failed:', shopErr.message)
      // If business_type column doesn't exist yet, try without it
      if (shopErr.message.includes('business_type')) {
        console.log('   ⚠️  Migration not yet applied — run the migration first:')
        console.log('      npx supabase db push  OR  apply it in Supabase SQL Editor')
      }
      process.exit(1)
    }
    shopId = newShop.id
    console.log(`   ✅ Shop created: ${shopId}`)
  }

  // ── 3. Seed some products into Supabase ───────────────────────────────────
  console.log('\n3️⃣  Seeding demo products...')

  const products = [
    { shop_id: shopId, name: 'Unga Pembe 2kg', sku: '6001', price: 175, stock: 40, category: 'Flour' },
    { shop_id: shopId, name: 'Sugar 1kg', sku: '6002', price: 165, stock: 30, category: 'Groceries' },
    { shop_id: shopId, name: 'Cooking Oil 1L', sku: '6003', price: 320, stock: 18, category: 'Groceries' },
    { shop_id: shopId, name: 'Milk 500ml', sku: '6004', price: 60, stock: 24, category: 'Dairy' },
    { shop_id: shopId, name: 'Bread 400g', sku: '6005', price: 70, stock: 15, category: 'Bakery' },
    { shop_id: shopId, name: 'Rice 2kg', sku: '6006', price: 260, stock: 22, category: 'Groceries' },
    { shop_id: shopId, name: 'Soda 500ml', sku: '6007', price: 70, stock: 48, category: 'Drinks' },
    { shop_id: shopId, name: 'Water 1L', sku: '6008', price: 50, stock: 60, category: 'Drinks' },
    { shop_id: shopId, name: 'Soap Bar', sku: '6009', price: 55, stock: 36, category: 'Household' },
    { shop_id: shopId, name: 'Salt 1kg', sku: '6010', price: 45, stock: 20, category: 'Groceries' },
    { shop_id: shopId, name: 'Airtime 50', sku: '6011', price: 50, stock: 200, category: 'Airtime' },
    { shop_id: shopId, name: 'Matchbox', sku: '6012', price: 10, stock: 100, category: 'Household' },
  ]

  // Delete any existing seeded products for this shop to start fresh
  await sb.from('products').delete().eq('shop_id', shopId)

  const { error: prodErr } = await sb.from('products').insert(products)
  if (prodErr) {
    console.warn('   ⚠️  Products seed failed (non-fatal):', prodErr.message)
  } else {
    console.log(`   ✅ ${products.length} products seeded`)
  }

  // ── 4. Output credentials ─────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('✅ DEMO ACCOUNT READY')
  console.log('═'.repeat(60))
  console.log(`\n  🏪 Shop Name  : ${SHOP_NAME}`)
  console.log(`  📧 Email      : ${DEMO_EMAIL}`)
  console.log(`  🔑 Password   : ${DEMO_PASSWORD}`)
  console.log(`  🆔 User ID    : ${userId}`)
  console.log(`  🆔 Shop ID    : ${shopId}`)
  console.log('\n  To log in, open the app and use:')
  console.log(`  Settings → Data & Sync → Cloud sync → Sign In`)
  console.log(`  Email: ${DEMO_EMAIL}  |  Password: ${DEMO_PASSWORD}`)
  console.log('\n' + '═'.repeat(60) + '\n')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
