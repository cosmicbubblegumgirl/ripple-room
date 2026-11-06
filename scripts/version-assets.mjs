import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const { version } = JSON.parse(fs.readFileSync(new URL('package.json', root)));
for (const file of fs.readdirSync(new URL('dist/', root))) {
  if (!file.endsWith('.js') || file === 'sw.js') continue;
  const path = new URL('dist/' + file, root);
  const text = fs.readFileSync(path, 'utf8').replace(
    /(from\s+['"])(\.\/[^'"?]+\.js)(?:\?v=[^'"]+)?(['"])/g,
    `$1$2?v=${version}$3`,
  );
  fs.writeFileSync(path, text);
}
const html = new URL('dist/index.html', root);
fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace(
  /((?:src|href)="\.\/[^"?]+\.(?:js|css))(?:\?v=[^"]+)?"/g,
  `$1?v=${version}"`,
));
const sw = new URL('dist/sw.js', root);
fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8')
  .replace(/const CACHE = '[^']+';/, `const CACHE = 'ripple-room-v${version}';`)
  .replace(/('\.\/[^'?]+\.(?:js|css))(?:\?v=[^']+)?'/g, `$1?v=${version}'`));
console.log(`Versioned application assets for ${version}.`);
