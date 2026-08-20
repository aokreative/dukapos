const fs = require('fs');
const path = require('path');
function walk(d) {
  let res = [];
  const files = fs.readdirSync(d);
  for (const f of files) {
    const fp = path.join(d, f);
    if (fs.statSync(fp).isDirectory()) res.push(...walk(fp));
    else if (fp.endsWith('.ts') || fp.endsWith('.tsx')) res.push(fp);
  }
  return res;
}
const files = walk('src');
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  let oc = c;
  
  // Remove missing properties from objects
  c = c.replace(/mpesaStkEnabled:.*?,\r?\n?/g, '');
  c = c.replace(/stkEnabled:.*?,\r?\n?/g, '');
  c = c.replace(/mpesaStkEnv:.*?,\r?\n?/g, '');
  c = c.replace(/stkEnv:.*?,\r?\n?/g, '');
  c = c.replace(/mpesaStkShortcode:.*?,\r?\n?/g, '');
  c = c.replace(/mpesaConsumerKey:.*?,\r?\n?/g, '');
  c = c.replace(/stkConsumerKey:.*?,\r?\n?/g, '');
  c = c.replace(/mpesaConsumerSecret:.*?,\r?\n?/g, '');
  c = c.replace(/stkConsumerSecret:.*?,\r?\n?/g, '');
  c = c.replace(/mpesaPasskey:.*?,\r?\n?/g, '');
  c = c.replace(/stkPasskey:.*?,\r?\n?/g, '');
  
  if (c !== oc) {
    fs.writeFileSync(f, c);
    console.log('Fixed properties in', f);
  }
}
