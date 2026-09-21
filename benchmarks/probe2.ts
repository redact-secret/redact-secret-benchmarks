import { createOperators } from './operators/index.ts';
import { createMethods } from './methods/index.ts';
import { loadCases } from './engine/cases.ts';
import { generateCase } from './engine/model.ts';

async function main() {
  const operators = createOperators(), methods = createMethods();
  const cases = await loadCases(operators);
  const targets = [
    'detector-coverage--slack-token-shape-1-bare--mutation',
    'detector-coverage--slack-token-shape-2-bare--mutation',
    'detector-coverage--slack-token-shape-3-bare--mutation',
    'detector-coverage--slack-token-shape-4-bare--mutation',
    'detector-coverage--slack-token-shape-5-bare--mutation',
    'detector-coverage--slack-token-shape-6-bare--mutation',
    'detector-coverage--slack-token-shape-7-bare--mutation',
    'detector-coverage--cloudflare-token-shape-1-bare--mutation',
  ];
  for (const id of targets) {
    const c = cases.find(x => x.id === id);
    if (!c) { console.log(id, 'NOT FOUND'); continue; }
    const g = generateCase(c, methods, operators);
    const canonical = g.variants.find(v => v.id === 'canonical') ?? g.variants[0];
    console.log(id, '| variants:', g.variants.map(v => v.id).join(','), '| canonical content prefix:', JSON.stringify(canonical.fixture.content.slice(0, 15)), '| full length:', canonical.fixture.content.length, '| kind:', canonical.fixture.assessment.kind, '| tier:', canonical.fixture.assessment.tier);
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
