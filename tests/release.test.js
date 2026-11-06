import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the complete released module graph and styles have matching offline cache entries', () => {
  const root = new URL('../', import.meta.url);
  const { version } = JSON.parse(fs.readFileSync(new URL('package.json', root)));
  const html = fs.readFileSync(new URL('dist/index.html', root), 'utf8');
  const sw = fs.readFileSync(new URL('dist/sw.js', root), 'utf8');
  const cached = new Set([...sw.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const resources = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+\.(?:js|css)(?:\?[^"#]+)?)"/g)]
    .map((m) => m[1]);
  for (const file of fs.readdirSync(new URL('dist/', root))) {
    if (file.endsWith('.js') && file !== 'sw.js') {
      const js = fs.readFileSync(new URL('dist/' + file, root), 'utf8');
      resources.push(...[...js.matchAll(/from\s+['"](\.\/[^'"]+\.js(?:\?[^'"]+)?)['"]/g)].map((m) => m[1]));
    }
  }
  assert.ok(resources.length > 10, 'check the whole application dependency graph');
  for (const resource of resources) {
    assert.equal(resource.split('?')[1], `v=${version}`, resource);
    assert.ok(cached.has(resource), `Missing offline resource: ${resource}`);
    assert.ok(fs.existsSync(new URL('dist/' + resource.split('?')[0], root)), resource);
  }
  assert.ok(sw.includes(`ripple-room-v${version}`));
});
