const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('duka-storage', JSON.stringify({
      state: {
        _cloudRole: 'superadmin',
        _cloudSession: 'signedIn',
        _hasHydrated: true,
        staff: [{ id: 'test_staff', name: 'Admin', role: 'owner', pin: '1234', active: true, createdAt: Date.now() }],
        currentStaffId: 'test_staff',
        staffLastActiveAt: Date.now()
      },
      version: 0
    }));
  });
  
  await page.goto('http://localhost:5173/superadmin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const html = await page.content();
  console.log(html.substring(0, 1000)); // Print part of HTML
  await browser.close();
})();
