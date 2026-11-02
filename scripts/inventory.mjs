import fs from 'node:fs';
import vm from 'node:vm';
const app = fs
  .readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8')
  .replace(
    /const (metricLabels|metricValue|policyNames|prefLabels|actionsList)\s*=\s*/g,
    'const $1=',
  );
function between(start, end) {
  const i = app.indexOf(start),
    j = app.indexOf(end, i);
  if (i < 0 || j < 0) throw Error('Missing inventory source section');
  return app.slice(i, j);
}
const pieces = [
  between('const metricLabels=', 'const metricValue='),
  between('const policyNames=', 'function policyDisplay'),
  between('const prefLabels=', 'function prefToggle'),
  between('const actionsList=', 'function capabilitiesDialog'),
];
const context = {};
vm.createContext(context);
vm.runInContext(
  pieces.join('\n') + '\nthis.inventory=capabilities();',
  context,
);
const list = JSON.parse(JSON.stringify(context.inventory));
if (new Set(list.map((c) => c.id)).size !== list.length)
  throw Error('Duplicate capability identifier');
for (const c of list.filter((x) => x.type === 'action'))
  if (!app.includes("case '" + c.key + "':"))
    throw Error('No action handler for ' + c.key);
if (list.length <= 240)
  throw Error(
    'The inventory must cover more than 240 working controls, tools and measures.',
  );
const groups = Object.groupBy(list, (c) => c.category);
const text =
  '# Inside Ripple Room\n\n' +
  list.length +
  ' documented tools, controls and analytic measures. These are individually addressable in the in-app inventory. This count includes analytic measures and settings; it is not a claim that each is a separate product module.\n\n' +
  Object.entries(groups)
    .map(
      ([group, items]) =>
        '## ' +
        group +
        '\n\n| Capability | Identifier |\n|---|---|\n' +
        items.map((c) => '| ' + c.label + ' | `' + c.id + '` |').join('\n'),
    )
    .join('\n\n') +
  '\n';
const output = new URL('../CAPABILITIES.md', import.meta.url);
if (process.argv.includes('--check')) {
  if (fs.readFileSync(output, 'utf8') !== text)
    throw Error('Capability documentation is stale');
  console.log(
    list.length + ' capabilities; all command entries have handlers.',
  );
} else {
  fs.writeFileSync(output, text);
  fs.writeFileSync(
    new URL('../dist/capabilities.json', import.meta.url),
    JSON.stringify(list, null, 2) + '\n',
  );
  console.log('Documented ' + list.length + ' tools, controls and measures.');
}
