const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  // Try default chromium, fallback to msedge if it fails
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.log('Failed to launch chromium, trying msedge...');
    browser = await chromium.launch({ channel: 'msedge' });
  }

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => {
    errors.push(`PageError: ${err.message}`);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`ConsoleError: ${msg.text()}`);
    }
  });

  const baseUrl = 'http://localhost:5173';

  async function checkPage(path, name) {
    console.log(`\nNavigating to ${name}...`);
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(e => console.log('Navigation timeout, continuing...'));
    await page.waitForTimeout(1000);
    const title = await page.title();
    const content = await page.content();
    const isBlank = content.includes('<div id="root"></div>') && content.length < 1000;
    
    console.log(`Title: ${title}`);
    console.log(`Status: ${isBlank ? 'BLANK' : 'RENDERS'}`);
    
    // Attempt login if on lock screen
    if (content.includes('Enter PIN') || content.includes('Quick PIN')) {
      console.log('Login screen detected. Attempting login...');
      await page.evaluate(() => {
        // Find input or just type if there's a global listener
        const buttons = Array.from(document.querySelectorAll('button'));
        const p1 = buttons.find(b => b.textContent === '1');
        const login = buttons.find(b => b.textContent === 'Unlock' || b.textContent.includes('Login'));
        if (p1 && login) {
           p1.click(); p1.click(); p1.click(); p1.click();
           login.click();
        } else {
           // Type on document if it uses keydown
           document.dispatchEvent(new KeyboardEvent('keydown', {key: '1'}));
           document.dispatchEvent(new KeyboardEvent('keydown', {key: '1'}));
           document.dispatchEvent(new KeyboardEvent('keydown', {key: '1'}));
           document.dispatchEvent(new KeyboardEvent('keydown', {key: '1'}));
        }
      });
      await page.waitForTimeout(1500);
    }
  }

  await checkPage('/', 'POS');
  
  console.log('\n--- Interacting with POS ---');
  // Attempt to add item to cart and click charge
  try {
    await page.evaluate(() => {
      // Find a product to click
      const products = Array.from(document.querySelectorAll('div, button')).filter(el => el.textContent && el.textContent.includes('KES') && !el.textContent.includes('Charge'));
      if (products.length > 0) products[0].click();
    });
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      // Find charge button
      const buttons = Array.from(document.querySelectorAll('button'));
      const chargeBtn = buttons.find(b => b.textContent && b.textContent.includes('Charge'));
      if (chargeBtn) chargeBtn.click();
    });
    await page.waitForTimeout(1000);
    
    const content = await page.content();
    if (content.includes('Cash') && content.includes('M-PESA')) {
      console.log('Payment modal opened successfully with multi-tender UI.');
    } else {
      console.log('Payment modal did not open or missing M-PESA/Cash.');
    }
  } catch (e) {
    console.log('Failed to interact with POS: ' + e.message);
  }

  await checkPage('/products', 'Products');
  await checkPage('/sales', 'Sales');
  await checkPage('/settings', 'Settings');
  
  console.log('\n--- Verifying Settings page ---');
  const settingsContent = await page.content();
  if (settingsContent.includes('Assistant') || settingsContent.includes('Automation')) {
    console.log('Assistant/AutomationPanel is visible in Settings.');
  } else {
    console.log('Assistant/AutomationPanel NOT visible in Settings.');
  }

  await checkPage('/settings/branches', 'Branches');
  await checkPage('/dashboard', 'Dashboard');
  await checkPage('/customers', 'Customers');

  console.log('\n--- Verifying CustomerProfile ---');
  try {
    await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      if (rows.length > 0) rows[0].click();
    });
    await page.waitForTimeout(1000);
    const content = await page.content();
    if (content.includes('Profile') || content.includes('Statement') || content.includes('Debt')) {
      console.log('CustomerProfile modal opened correctly.');
    } else {
      console.log('CustomerProfile modal not found.');
    }
  } catch (e) {
    console.log('Failed to click customer: ' + e.message);
  }

  console.log('\n=== Errors Collected ===');
  if (errors.length === 0) {
    console.log('None.');
  } else {
    errors.forEach(e => console.log(e));
  }

  await browser.close();
})();
