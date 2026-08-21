const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => m.type()==='error' && console.log('CERR', m.text()));
  await p.goto('http://localhost:5173/superadmin');
  await p.waitForTimeout(2000);
  const c = await p.content();
  console.log('BLANK:', c.includes('<div id="root"></div>') && c.length < 1000);
  console.log('HTML:', c.substring(0, 1500));
  await b.close();
})();
