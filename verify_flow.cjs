const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('Browser Console:', msg.text()));
  page.on('pageerror', err => console.log('Browser Error:', err.message));
  
  const testEmail = `test-${Date.now()}@example.com`;
  
  console.log("[1] Signing up...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.click('text="Sign up"');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button:has-text("Create account")');

  console.log("[2] Onboarding...");
  await page.waitForSelector('text="Let\'s set up your shop"');
  await page.fill('input[placeholder="e.g. Mama Njeri Supermarket"]', 'Test Shop');
  await page.fill('input[placeholder="e.g. Jane Wambui"]', 'Test Owner');
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Pharmacy")');
  await page.click('button:has-text("Continue")');
  const pinInputs = await page.locator('input[type="password"]').all();
  await pinInputs[0].fill('123456');
  await pinInputs[1].fill('123456');
  await page.click('button:has-text("Launch My Shop")');

  console.log("[3] Verifying POS landing...");
  await page.waitForTimeout(3000);
  console.log("    Current URL:", page.url());

  console.log("[5] Mocking Superadmin...");
  await page.evaluate(() => {
    // 1. Set duka-storage
    const s = JSON.parse(localStorage.getItem('duka-storage') || '{}');
    if (!s.state) s.state = {};
    s.state._cloudRole = 'superadmin';
    s.state._cloudSession = 'signedIn';
    localStorage.setItem('duka-storage', JSON.stringify(s));
    
    // 2. Set supabase auth token so getSession() works
    localStorage.setItem('sb-rncqjyckqixulmazeolq-auth-token', JSON.stringify({
        access_token: 'dummy',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'dummy',
        user: {
            id: 'dummy',
            email: 'aokreative@gmail.com',
            role: 'authenticated',
            aud: 'authenticated',
            app_metadata: {},
            user_metadata: {}
        }
    }));
  });

  console.log("[6] Testing Demo Seeder...");
  await page.goto('http://localhost:5173/superadmin', { waitUntil: 'networkidle' });
  await page.click('text="🎬 Demo Control"');
  await page.click('text="Seed Pharmacy"');
  
  console.log("    Waiting for redirect...");
  await page.waitForTimeout(4000);
  console.log("    Current URL after seed:", page.url());
  
  if (page.url().includes('onboarding')) {
      console.log("    FAIL: Redirected to onboarding!");
  } else {
      console.log("    SUCCESS: Did not get redirected to onboarding.");
  }
  
  const hasDemoProduct = await page.locator('text="Panadol 500mg"').isVisible();
  console.log("    Panadol found in POS:", hasDemoProduct);
  
  await browser.close();
  console.log("Done.");
})();
