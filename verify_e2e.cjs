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

  const testEmail = `test-e2e-${Date.now()}@example.com`;
  const testPassword = 'password123';
  
  console.log(`[a] Loading deployed URL (https://dukapos-beta.vercel.app)...`);
  await page.goto('https://dukapos-beta.vercel.app', { waitUntil: 'networkidle' });
  
  console.log("[a] Verifying sign-in page appears directly (no watchdog)...");
  await page.waitForSelector('text="Sign in"');
  console.log("    -> Success: Sign in page loaded.");

  console.log(`[b] Signing up with new email: ${testEmail}...`);
  await page.click('text="Sign up"');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button:has-text("Create account")');

  console.log("[c] Onboarding step 1: Shop info...");
  await page.waitForSelector('text="Let\'s set up your shop"');
  await page.fill('input[placeholder="e.g. Mama Njeri Supermarket"]', 'Test E2E Shop');
  await page.fill('input[placeholder="e.g. Jane Wambui"]', 'Test Owner');
  await page.click('button:has-text("Continue")');

  console.log("[c] Onboarding step 2: Biz Type...");
  await page.waitForSelector('text="What kind of business?"');
  await page.click('button:has-text("Pharmacy")');
  await page.click('button:has-text("Continue")');

  console.log("[c] Onboarding step 3: Owner PIN...");
  await page.waitForSelector('text="Create your owner PIN"');
  const pinInputs = await page.locator('input[type="password"]').all();
  await pinInputs[0].fill('123456');
  await pinInputs[1].fill('123456');
  
  console.log("[c] Hitting 'Launch My Shop'...");
  await page.click('button:has-text("Launch My Shop")');

  console.log("[d] Landing in the POS...");
  await page.waitForTimeout(5000);
  const currentUrl = page.url();
  console.log("    -> Current URL:", currentUrl);
  await page.screenshot({ path: 'pos-landing.png' });

  if (!currentUrl.includes('/pos') && !currentUrl.includes('/dashboard')) {
    console.error("FAIL: Did not land in POS. Saving screenshot.");
  } else {
    console.log("    -> POS loaded successfully.");
  }

  console.log("[e] Querying the actual shop row in Supabase...");
  const { data: shops, error: shopsErr } = await supabase.from('shops').select('*').order('created_at', { ascending: false }).limit(1);
  if (shopsErr) console.error("Error querying shops:", shopsErr);
  else {
    console.log("    -> Actual shop row created in Supabase:");
    console.log(JSON.stringify(shops[0], null, 2));
  }

  console.log("[f] Reloading to verify staff is intact...");
  await page.reload();
  await page.waitForSelector('text="POS"', { timeout: 10000 });
  console.log("    -> Reloaded successfully, did not hit LockScreen. Staff is intact!");

  // g. Go back an onboarding step and resubmit
  // Since we can't easily go back after reload, we will just manually navigate to onboarding
  console.log("[g] Going back to onboarding to resubmit...");
  // Clear the local state `onboarding` flag so it doesn't redirect
  await page.evaluate(() => {
    localStorage.setItem('duka-storage', localStorage.getItem('duka-storage').replace('"_cloudOnboarding":"complete"', '"_cloudOnboarding":"pending"'));
  });
  await page.goto('https://dukapos-beta.vercel.app', { waitUntil: 'networkidle' });
  await page.waitForSelector('text="Let\'s set up your shop"');
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Hardware")'); // Change to hardware
  await page.click('button:has-text("Continue")');
  const pinInputs2 = await page.locator('input[type="password"]').all();
  await pinInputs2[0].fill('123456');
  await pinInputs2[1].fill('123456');
  await page.click('button:has-text("Launch My Shop")');
  await page.waitForSelector('text="POS"', { timeout: 15000 });
  console.log("    -> Upsert succeeded, POS loaded.");

  const { data: shops2 } = await supabase.from('shops').select('*').order('created_at', { ascending: false }).limit(2);
  console.log("    -> Shop business_type updated to:", shops2[0].business_type);
  if (shops2.length > 1 && shops2[0].owner_id === shops2[1].owner_id) {
    console.error("    -> FAIL: created a second shop!");
  } else {
    console.log("    -> SUCCESS: did not create a second shop!");
  }

  console.log("[e] Adding a product and ringing a cash sale...");
  await page.goto('https://dukapos-beta.vercel.app/products', { waitUntil: 'networkidle' });
  await page.waitForSelector('text="Add Product"');
  await page.click('text="Add Product"');
  await page.fill('input[placeholder="e.g. Blue Band 250g"]', 'E2E Test Product');
  await page.fill('input[placeholder="0"]', '150'); // Price
  await page.click('button:has-text("Save Product")');
  await page.waitForTimeout(2000);
  
  await page.goto('https://dukapos-beta.vercel.app/pos', { waitUntil: 'networkidle' });
  await page.click('text="E2E Test Product"');
  await page.click('button:has-text("Charge")');
  await page.click('button:has-text("Cash")');
  
  console.log("    -> UI actions attempted, checking sales table...");
  await page.waitForTimeout(3000);
  const { data: sales } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(1);
  console.log("    -> Latest sale in db:", JSON.stringify(sales[0] || {}, null, 2));

  await browser.close();
  console.log("Verification complete.");
})();
