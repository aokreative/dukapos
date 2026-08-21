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

  console.log("[1.1] Completing Onboarding steps...");
  await page.waitForSelector('text="Let\'s set up your shop"');
  await page.fill('input[placeholder="e.g. Mama Njeri Supermarket"]', 'Test Deployed Shop');
  await page.fill('input[placeholder="e.g. Jane Wambui"]', 'Test Deployed Owner');
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Pharmacy")');
  await page.click('button:has-text("Continue")');
  const pinInputs = await page.locator('input[type="password"]').all();
  await pinInputs[0].fill('123456');
  await pinInputs[1].fill('123456');

  // We expect an alert if the upsert fails. Let's handle it.
  page.on('dialog', async dialog => {
    console.log('Dialog opened:', dialog.message());
    await dialog.accept();
  });

  await page.click('button:has-text("Launch My Shop")');
  
  console.log("[1.2] Verifying POS landing...");
  await page.waitForTimeout(4000); 
  console.log("    Current URL:", page.url());

  console.log("[2] Logging State...");
  const stateLog = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('duka-pos-v1') || '{}').state || {};
    return {
      staff: s.staff?.length || 0,
      currentStaffId: s.currentStaffId,
      onboarding: s._cloudOnboarding,
      queue: s.syncQueue?.length || 0,
      syncQueueData: s.syncQueue
    };
  });
  console.log("    Store State:", stateLog);

  // Poll localStorage every 100ms for 5 seconds to catch the exact moment it changes
  await page.evaluate(() => {
    window._pollTimer = setInterval(() => {
      const s = JSON.parse(localStorage.getItem('duka-pos-v1') || '{}').state || {};
      if (s.staff && s.staff.length === 0) {
        console.error("STAFF BECAME EMPTY AT:", Date.now());
        console.error("STATE IS:", s);
        clearInterval(window._pollTimer);
      }
    }, 100);
  });
  
  await page.waitForTimeout(5000);

  console.log("[3] Reloading to verify POS stickiness...");
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log("    Current URL after reload:", page.url());

  console.log("[4] Adding product & ringing cash sale...");
  await page.goto('https://dukapos-beta.vercel.app/products', { waitUntil: 'networkidle' });
  
  try {
    await page.waitForSelector('button:has-text("Add")', { timeout: 10000 });
  } catch (e) {
    console.log("Add button not found. Maybe we are locked out? Let's check state.");
    const stateLog2 = await page.evaluate(() => JSON.parse(localStorage.getItem('duka-pos-v1') || '{}').state || {});
    console.log(stateLog2);
    if (page.url().includes('dashboard') || await page.locator('text="Who is on the till?"').isVisible()) {
      console.log("We are on the lock screen. Unlocking...");
      await page.waitForTimeout(2000);
      await page.locator('button', { hasText: 'Test Deployed Owner' }).click().catch(() => {});
      const digits = ['1', '2', '3', '4', '5', '6'];
      for (const d of digits) {
        await page.locator(`button:has-text("${d}")`).first().click();
      }
      await page.waitForTimeout(2000);
      await page.goto('https://dukapos-beta.vercel.app/products', { waitUntil: 'networkidle' });
    }
  }

  await page.click('button:has-text("Add")');
  await page.fill('input[placeholder="e.g. Paracetamol 500mg"]', 'Deployed Test Product');
  await page.locator('input[inputmode="decimal"]').first().fill('200'); // Price
  await page.fill('label:has-text("Stock") + input', '100'); // Stock
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(2000);
  
  await page.goto('https://dukapos-beta.vercel.app/pos', { waitUntil: 'networkidle' });
  await page.click('text="Deployed Test Product"', { force: true });
  await page.click('button:has-text("Charge")');
  await page.click('button:has-text("Cash")');
  await page.waitForTimeout(3000);

  const { data: sales } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(1);
  console.log("    Latest Sale in Supabase:", sales[0] ? { receiptNo: sales[0].receipt_no, total: sales[0].total } : 'None');

  console.log("[5] Testing Demo Seeder as Superadmin...");
  await context.clearCookies();
  await page.goto('https://dukapos-beta.vercel.app', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await window.indexedDB.databases();
    for (const db of dbs) {
      window.indexedDB.deleteDatabase(db.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  
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
    localStorage.setItem('duka-pos-v1', JSON.stringify(s));
    localStorage.setItem('sb-rncqjyckqixulmazeolq-auth-token', JSON.stringify({
        access_token: 'dummy',
        user: { id: 'dummy-id', email: 'aokreative@gmail.com' }
    }));
  });

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
  
  console.log("[6] Confirm seeder cleared syncQueue...");
  const demoStoreState = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('duka-pos-v1') || '{}').state || {};
    return {
      onboarding: s._cloudOnboarding,
      queueLength: s.syncQueue?.length || 0
    };
  });
  console.log("    Demo Store State:", demoStoreState);

  await browser.close();
  console.log("Done.");
})();
