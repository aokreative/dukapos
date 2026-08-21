const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  console.log('Navigating to https://dukapos-beta.vercel.app/ ...');
  await page.goto('https://dukapos-beta.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // 1. Fresh profile -> signup
  console.log('1. Signing up...');
  await page.click('text="Sign up"');
  await page.waitForTimeout(500);
  await page.fill('input[type="email"]', `test${Date.now()}@test.com`);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000); // Wait for auth to settle

  // 1b. three onboarding steps
  console.log('Onboarding step 1...');
  await page.fill('input[placeholder="e.g. Mama Njeri Supermarket"]', 'My Shop');
  await page.fill('input[placeholder="e.g. Jane Wambui"]', 'Agent');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(1000);

  console.log('Onboarding step 2...');
  // Click first biz type button
  await page.locator('button.group').first().click();
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(1000);

  console.log('Onboarding step 3...');
  // The first input type=password is PIN, the second is Confirm PIN
  await page.locator('input[type="password"]').first().fill('123456');
  await page.locator('input[type="password"]').nth(1).fill('123456');
  await page.click('button:has-text("Launch My Shop")');
  await page.waitForTimeout(3000);

  // 2. Evaluate Zustand state
  console.log('2. Evaluating Zustand state...');
  const state = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('keyval-store');
      request.onsuccess = (e) => {
        const db = e.target.result;
        try {
          const transaction = db.transaction('keyval', 'readonly');
          const store = transaction.objectStore('keyval');
          const getReq = store.get('dukapos-storage');
          getReq.onsuccess = () => {
            const raw = getReq.result;
            if (!raw) return resolve(null);
            const s = JSON.parse(raw).state;
            resolve({
              staff: s.staff.length,
              currentStaffId: s.currentStaffId,
              onboarding: s._cloudOnboarding,
              queue: s.syncQueue.length
            });
          };
          getReq.onerror = () => reject(getReq.error);
        } catch (err) {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
  console.log('OBSERVED VALUES:', state);

  // 3. Reload
  console.log('3. Reloading page...');
  await page.reload();
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  console.log('URL after reload:', currentUrl);
  if (currentUrl.includes('/pos')) {
    console.log('✅ Still in POS after reload');
  } else {
    console.log('❌ Did NOT stay in POS after reload');
  }

  // 4. Add a product -> ring a cash sale
  console.log('4. Adding a product and ringing a sale...');
  await page.locator('nav a:has-text("Stock")').first().click();
  await page.waitForTimeout(1000);
  
  // click "Add Product"
  await page.locator('button:has-text("Add")').first().click();
  await page.waitForTimeout(500);
  await page.fill('input[placeholder="e.g. Unga"]', 'Test Product');
  await page.fill('input[placeholder="e.g. 150"]', '100');
  await page.click('button:has-text("Save Product")');
  await page.waitForTimeout(1000);
  
  // Go to POS
  await page.locator('nav a:has-text("Point of Sale")').first().click();
  await page.waitForTimeout(1000);
  
  // Click product
  await page.locator('button.card').first().click();
  await page.waitForTimeout(500);
  
  // Click Charge
  await page.locator('button:has-text("Charge")').first().click();
  await page.waitForTimeout(500);
  
  // Click Exact cash
  await page.locator('button:has-text("Exact cash")').first().click();
  await page.waitForTimeout(1000);
  
  // Verify Sales
  await page.locator('nav a:has-text("Reports")').first().click();
  await page.waitForTimeout(1000);
  
  const salesRows = await page.locator('table tbody tr').count();
  console.log(`Sales table has ${salesRows} row(s).`);

  await browser.close();
})();
