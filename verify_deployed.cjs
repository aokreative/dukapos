const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const url = 'https://rncqjyckqixulmazeolq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuY3FqeWNrcWl4dWxtYXplb2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDYwMTQsImV4cCI6MjA5OTEyMjAxNH0.zfTFEWQ_4NZZvuK5J8U7kiJwS6bCu0lwJFBe0ez-Tv8';
const supabase = createClient(url, key);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('Browser Console:', msg.text()));
  page.on('pageerror', err => console.log('Browser Error:', err.message));
  
  const testEmail = `test-${Date.now()}@example.com`;
  
  console.log("[1] Signing up on deployed build...");
  await page.goto('https://dukapos-beta.vercel.app', { waitUntil: 'networkidle' });
  await page.click('text="Sign up"');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button:has-text("Create account")');

  console.log("[2] Completing Onboarding...");
  await page.waitForSelector('text="Let\'s set up your shop"');
  await page.fill('input[placeholder="e.g. Mama Njeri Supermarket"]', 'Test Deployed Shop');
  await page.fill('input[placeholder="e.g. Jane Wambui"]', 'Test Deployed Owner');
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Pharmacy")');
  await page.click('button:has-text("Continue")');
  const pinInputs = await page.locator('input[type="password"]').all();
  await pinInputs[0].fill('123456');
  await pinInputs[1].fill('123456');
  await page.click('button:has-text("Launch My Shop")');

  console.log("[3] Verifying POS landing...");
  await page.waitForTimeout(4000); // Give time for sync queue to run
  console.log("    Current URL:", page.url());

  const storeState = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('duka-storage') || '{}').state || {};
    return {
      staffCount: s.staff?.length || 0,
      currentStaffId: s.currentStaffId,
      onboarding: s._cloudOnboarding,
      queueLength: s.syncQueue?.length || 0,
      syncQueue: s.syncQueue
    };
  });
  console.log("    Store State:", storeState);

  console.log("[4] Reloading to verify POS stickiness...");
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log("    Current URL after reload:", page.url());

  console.log("[5] Adding product & sale...");
  await page.goto('https://dukapos-beta.vercel.app/products', { waitUntil: 'networkidle' });
  await page.waitForSelector('text="Add Product"');
  await page.click('text="Add Product"');
  await page.fill('input[placeholder="e.g. Blue Band 250g"]', 'Deployed Test Product');
  await page.fill('input[placeholder="0"]', '200');
  await page.click('button:has-text("Save Product")');
  await page.waitForTimeout(2000);
  
  await page.goto('https://dukapos-beta.vercel.app/pos', { waitUntil: 'networkidle' });
  await page.click('text="Deployed Test Product"');
  await page.click('button:has-text("Charge")');
  await page.click('button:has-text("Cash")');
  await page.waitForTimeout(3000);

  const { data: sales } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(1);
  console.log("    Latest Sale in Supabase:", sales[0] ? { receiptNo: sales[0].receipt_no, total: sales[0].total } : 'None');

  console.log("[6] Testing Demo Seeder as Superadmin...");
  // Clear site data
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  
  // Inject superadmin
  await page.evaluate(() => {
    const s = {
      state: {
        _cloudRole: 'superadmin',
        _cloudSession: 'signedIn',
        _cloudOnboarding: 'pending',
        _hasHydrated: true,
        staff: [{ id: 'test_staff', name: 'Admin', role: 'owner', pin: '1234', active: true, createdAt: Date.now() }],
        currentStaffId: 'test_staff',
        staffLastActiveAt: Date.now()
      },
      version: 0
    };
    localStorage.setItem('duka-storage', JSON.stringify(s));
    localStorage.setItem('sb-rncqjyckqixulmazeolq-auth-token', JSON.stringify({
        access_token: 'dummy',
        user: { id: 'dummy-id', email: 'aokreative@gmail.com' }
    }));
  });

  // Intercept the network so our injected session works
  await page.route('**/auth/v1/session', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ session: { access_token: 'dummy', user: { id: 'dummy-id', email: 'aokreative@gmail.com' } } })
    });
  });
  await page.route('**/auth/v1/user', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'dummy-id', email: 'aokreative@gmail.com' })
    });
  });

  await page.goto('https://dukapos-beta.vercel.app/superadmin', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(2000);
  await page.click('text="🎬 Demo Control"');
  await page.click('text="Seed Pharmacy"');
  
  console.log("    Waiting for redirect after seed...");
  await page.waitForTimeout(4000);
  console.log("    Current URL after seed:", page.url());
  
  const hasDemoProduct = await page.locator('text="Panadol 500mg"').isVisible();
  console.log("    Panadol found in POS:", hasDemoProduct);
  
  const demoStoreState = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('duka-storage') || '{}').state || {};
    return {
      onboarding: s._cloudOnboarding,
      queueLength: s.syncQueue?.length || 0
    };
  });
  console.log("    Demo Store State:", demoStoreState);

  await browser.close();
  console.log("Done.");
})();
