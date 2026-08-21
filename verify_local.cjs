const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const url = 'https://rncqjyckqixulmazeolq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuY3FqeWNrcWl4dWxtYXplb2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDYwMTQsImV4cCI6MjA5OTEyMjAxNH0.zfTFEWQ_4NZZvuK5J8U7kiJwS6bCu0lwJFBe0ez-Tv8';
const supabase = createClient(url, key);

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // To trace console errors easily
  page.on('pageerror', err => console.log('Browser Error:', err.message));
  page.on('console', msg => console.log('Browser Console:', msg.text()));

  const testEmail = `test-local-${Date.now()}@example.com`;
  const testPassword = 'password123';
  
  console.log(`[1] Loading local URL (http://localhost:5173)...`);
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  console.log("[2] Signing up with new email:", testEmail);
  await page.waitForSelector('text="Sign in"');
  await page.click('text="Sign up"');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button:has-text("Create account")');

  console.log("[3] Onboarding step 1: Shop info...");
  await page.waitForSelector('text="Let\'s set up your shop"');
  await page.fill('input[placeholder="e.g. Mama Njeri Supermarket"]', 'Test Local Shop');
  await page.fill('input[placeholder="e.g. Jane Wambui"]', 'Test Local Owner');
  await page.click('button:has-text("Continue")');

  console.log("[3] Onboarding step 2: Biz Type...");
  await page.waitForSelector('text="What kind of business?"');
  await page.click('button:has-text("Pharmacy")');
  await page.click('button:has-text("Continue")');

  console.log("[3] Onboarding step 3: Owner PIN...");
  await page.waitForSelector('text="Create your owner PIN"');
  const pinInputs = await page.locator('input[type="password"]').all();
  await pinInputs[0].fill('123456');
  await pinInputs[1].fill('123456');
  
  console.log("[3] Hitting 'Launch My Shop'...");
  await page.click('button:has-text("Launch My Shop")');

  console.log("[4] Landing in the POS...");
  await page.waitForTimeout(3000);
  let currentUrl = page.url();
  console.log("    -> Current URL:", currentUrl);
  
  if (!currentUrl.includes('/pos') && !currentUrl.includes('/dashboard')) {
    console.error("FAIL: Did not land in POS.");
  } else {
    console.log("    -> POS loaded successfully.");
  }

  console.log("[5] Reloading to verify offline-first onboarding doesn't loop...");
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  currentUrl = page.url();
  console.log("    -> Current URL after reload:", currentUrl);

  console.log("[6] Adding a product and ringing a cash sale...");
  await page.goto('http://localhost:5173/products', { waitUntil: 'networkidle' });
  await page.waitForSelector('text="Add Product"');
  await page.click('text="Add Product"');
  await page.fill('input[placeholder="e.g. Blue Band 250g"]', 'Local Test Product');
  await page.fill('input[placeholder="0"]', '150'); // Price
  await page.click('button:has-text("Save Product")');
  await page.waitForTimeout(2000);
  
  await page.goto('http://localhost:5173/pos', { waitUntil: 'networkidle' });
  await page.click('text="Local Test Product"');
  await page.click('button:has-text("Charge")');
  await page.click('button:has-text("Cash")');
  await page.waitForTimeout(2000);

  console.log("[7] Superadmin login...");
  // Inject superadmin role locally
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('duka-storage') || '{}');
    if (!s.state) s.state = {};
    s.state._cloudRole = 'superadmin';
    s.state._cloudSession = 'signedIn';
    localStorage.setItem('duka-storage', JSON.stringify(s));
  });
  await page.goto('http://localhost:5173/superadmin', { waitUntil: 'networkidle' });
  
  console.log("[8] Running Seeder...");
  await page.click('text="🎬 Demo Control"');
  await page.click('text="Seed Pharmacy"');
  await page.waitForTimeout(3000); // Wait for seed & redirect
  
  console.log("    -> Current URL after seeder:", page.url());
  
  console.log("[9] Verify demo data loads...");
  const hasDemoProduct = await page.locator('text="Panadol 500mg"').isVisible();
  console.log("    -> Panadol found:", hasDemoProduct);

  await browser.close();
  console.log("Verification complete.");
})();
