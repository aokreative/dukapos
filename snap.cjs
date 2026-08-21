const { chromium } = require('playwright');
async function snap() {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.route('**/*', (route) => {
    if (route.request().url().includes('supabase.co')) {
      return route.fulfill({ status: 200, body: JSON.stringify({}) });
    }
    route.continue();
  });

  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(1000);
  
  await page.evaluate(() => {
    window.__seeders.seedShop();
    window.__useStore.setState({ _isDemo: true, _cloudSession: 'signedIn', _cloudRole: 'tenant' });
  });

  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'C:/Users/Baple/.gemini/antigravity-ide/brain/c7b3df06-80a9-4fdb-9e19-d788f57531a8/pos_snap3.png' });
  await browser.close();
}
snap();
