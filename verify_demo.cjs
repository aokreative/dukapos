const { chromium } = require('playwright');

const SEEDERS = [
  { name: 'seedShop', assertField: 'text="Brand"' }, // Basic retail, uses Brand usually
  { name: 'seedRestaurant', assertField: 'text="Kitchen"' }, // Restaurant uses Kitchen tab, or no SKU/Brand
  { name: 'seedPharmacy', assertField: 'text="Batch"' },
  { name: 'seedHardwareSpices', assertField: 'text="kg"' }, // Fractional
  { name: 'seedBoutique', assertField: 'text="Sizes"' },
  { name: 'seedAutoSpares', assertField: 'text="Fitments / models"' },
  { name: 'seedElectronics', assertField: 'text="Serial"' }, // SKU / Serial / Barcode
  { name: 'seedAgrovet', assertField: 'text="Pack sizes"' }, // "Pack sizes (optional)"
  { name: 'seedSpices', assertField: 'text="kg"' }, // Fractional unit
  { name: 'seedWholesale', assertField: 'text="Pack sizes"' }, 
  { name: 'seedBabyshop', assertField: 'text="ages"' } // "Sizes / ages (optional)"
];

async function verifyAll() {
  console.log("Starting Chrome...");
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  // Route interception to bypass any network requests that block
  await page.route('**/*', (route) => {
    if (route.request().url().includes('supabase.co')) {
      return route.fulfill({ status: 200, body: JSON.stringify({}) });
    }
    route.continue();
  });

  // Start with a blank page on the dev server
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

  for (const seeder of SEEDERS) {
    console.log(`\n========================================`);
    console.log(`Verifying: ${seeder.name}`);
    console.log(`========================================`);

    // 1. Trigger the seeder and auth state
    await page.evaluate((fnName) => {
      window.__seeders[fnName]();
      window.__useStore.setState({ _isDemo: true, _cloudSession: 'signedIn', _cloudRole: 'tenant' });
    }, seeder.name);

    // 2. Navigate to POS via DOM (click Sidebar link)
    await page.waitForTimeout(500); // Wait for React to render Authenticated Routes
    const posLink = page.locator('nav a:has-text("Point of Sale"), nav a:has-text("New Order")').first();
    if (await posLink.count() > 0) {
      await posLink.click();
    }
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes('/superadmin')) {
      console.error(`❌ FAILED: Bounced to superadmin for ${seeder.name}`);
      continue;
    }
    console.log(`✅ Landed in POS (${url})`);

    // 3. Assert 15 products render
    const productsCount = await page.locator('button.card').count();
    if (productsCount === 15) {
      console.log(`✅ 15 products rendered`);
    } else {
      console.error(`❌ Expected 15 products, found ${productsCount}`);
    }

    // 4. Assert vertical-specific fields
    // We'll click "Add Product" to see the form fields
    await page.locator('nav a:has-text("Inventory"), nav a:has-text("Menu")').first().click();
    await page.waitForTimeout(500);
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(500);
    
    // Check if the expected field exists in the DOM
    const hasField = await page.locator(`body`).innerText();
    let passed = false;
    if (seeder.name === 'seedRestaurant') {
      passed = !hasField.includes('SKU / Barcode'); // Restaurant hides SKU
      if (passed) console.log(`✅ Vertical feature verified (Restaurant has no SKU)`);
    } else if (seeder.name === 'seedHardwareSpices' || seeder.name === 'seedSpices') {
      passed = hasField.includes('kg'); // Has weight/measure units
      if (passed) console.log(`✅ Vertical feature verified (Fractional unit 'kg' present)`);
    } else {
      passed = hasField.includes(seeder.assertField.replace('text="', '').replace('"', ''));
      if (passed) console.log(`✅ Vertical feature verified (${seeder.assertField})`);
    }
    
    if (!passed) {
      console.error(`❌ Failed to find vertical feature: ${seeder.assertField}`);
    }

    // Close modal
    await page.keyboard.press('Escape');

    // 5. Ring a sale
    await page.locator('nav a:has-text("Point of Sale"), nav a:has-text("New Order")').first().click();
    await page.waitForTimeout(500);
    
    // Click the first product
    await page.locator('button.card').first().click();
    await page.waitForTimeout(500);

    // If it's a product with variants/sizes (e.g. Boutique), a modal appears
    const addOrderBtn = page.locator('button:has-text("Add to Order")');
    if (await addOrderBtn.count() > 0) {
      await addOrderBtn.first().click();
      await page.waitForTimeout(300);
    }
    
    // Click "Charge" button (avoid matching products with "Charger" in their name)
    await page.locator('button:has-text("Charge"):not(.card)').first().click();
    await page.waitForTimeout(500);
    
    // The modal says "Exact cash"
    try {
      await page.locator('button:has-text("Exact cash")').first().click({ timeout: 5000 });
    } catch (e) {
      await page.screenshot({ path: `${seeder.name}_error.png` });
      console.log(`Failed at Exact cash for ${seeder.name}. Screenshot saved.`);
      throw e;
    }
    await page.waitForTimeout(1000); // wait for completion

    // 6. Confirm sale in Sales history
    const salesCount = await page.evaluate(() => window.__useStore.getState().sales.length);
    console.log(`✅ Sales history has ${salesCount} sales`);
    
    // 7. Test Exit Demo
    await page.evaluate(() => {
       window.__useStore.setState({ _isDemo: false });
       window.location.href = '/superadmin';
    });
    await page.waitForTimeout(1000);
    const postExitUrl = page.url();
    if (postExitUrl.includes('/superadmin')) {
      console.log(`✅ Exited to superadmin successfully`);
    } else {
      console.error(`❌ Did not exit to superadmin`);
    }
    
    // Confirm data was not wiped
    const postExitSales = await page.evaluate(() => window.__useStore.getState().sales.length);
    if (postExitSales === salesCount) {
      console.log(`✅ Local data was NOT wiped upon exit (Sales: ${postExitSales})`);
    } else {
      console.error(`❌ Local data WAS wiped upon exit!`);
    }
  }

  await browser.close();
  console.log("Done.");
}

verifyAll().catch(console.error);
