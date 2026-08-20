const fs = require('fs');

// 1. Fix billing.ts
let bl = fs.readFileSync('src/lib/billing.ts', 'utf8');
bl = bl.replace(/'bg-green-500'/g, "'green'");
bl = bl.replace(/'bg-blue-500'/g, "'blue'");
bl = bl.replace(/'bg-amber-500'/g, "'amber'");
bl = bl.replace(/'bg-red-500'/g, "'red'");
bl = bl.replace(/'bg-red-900'/g, "'red'");
fs.writeFileSync('src/lib/billing.ts', bl);

// 2. Fix useAutomation.ts
let a = fs.readFileSync('src/lib/useAutomation.ts', 'utf8');
a = a.replace(/cancelled = true\r?\n/g, '');
fs.writeFileSync('src/lib/useAutomation.ts', a);

// 3. Fix Branches.tsx
let br = fs.readFileSync('src/pages/Branches.tsx', 'utf8');
br = br.replace(/<div className="mt-3 rounded-2xl bg-black\/5 p-4 dark:bg-white\/10">[\s\S]*?<\/div>\r?\n/g, '');
fs.writeFileSync('src/pages/Branches.tsx', br);
