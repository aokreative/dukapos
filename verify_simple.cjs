const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('Browser Console:', msg.text()));
  page.on('pageerror', err => console.log('Browser Error:', err.message));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  console.log("[1] Setting state...");
  await page.evaluate(() => {
    localStorage.setItem('duka-storage', JSON.stringify({
      state: {
        _cloudRole: 'superadmin',
        _cloudSession: 'signedIn',
        _cloudOnboarding: 'complete',
        _hasHydrated: true,
        staff: [{ id: 'test_staff', name: 'Admin', role: 'owner', pin: '1234', active: true, createdAt: Date.now() }],
        currentStaffId: 'test_staff',
        staffLastActiveAt: Date.now()
      },
      version: 0
    }));
  });

  console.log("[2] Going to Superadmin...");
  await page.goto('http://localhost:5173/superadmin', { waitUntil: 'networkidle' });
  
  // Intercept network to prevent redirects from auth failure
  await page.route('**/auth/v1/session', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        session: { access_token: 'dummy', user: { id: 'dummy-id', email: 'aokreative@gmail.com' } }
      })
    });
  });
  
  await page.waitForTimeout(1000);
  
  console.log("[3] Clicking Demo Control...");
  await page.click('text="🎬 Demo Control"');
  
  console.log("[4] Clicking Seed Pharmacy...");
  await page.click('text="Seed Pharmacy"');
  
  await page.waitForTimeout(2000);
  console.log("Current URL:", page.url());

  const store = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('duka-storage') || '{}');
    return s.state?.products?.length;
  });
  console.log("Products in store after seed:", store);
  
  await browser.close();
})();
