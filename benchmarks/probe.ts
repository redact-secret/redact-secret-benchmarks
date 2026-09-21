import path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { createHash } from 'node:crypto';

const DEFAULT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function synthetic(label: string, length: number, chars = DEFAULT) {
  let value = '', block = 0;
  while (value.length < length) {
    const h = createHash('sha256').update(`secret-benchmark:never-issued:v2:${label}:${block}`).digest();
    for (const b of h) value += chars[b % chars.length];
    block++;
  }
  return value.slice(0, length);
}

async function main() {
  const options: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(candidate-package|candidate-node-package|candidate-wasm-package)=(.+)$/.exec(arg);
    if (match) options[match[1]] = match[2];
  }
  const installation = await installCandidate({
    core: path.resolve(options['candidate-package']),
    node: path.resolve(options['candidate-node-package']),
    wasm: path.resolve(options['candidate-wasm-package']),
  });
  try {
    const candidate = await loadCandidate(installation);
    const cases: { label: string; value: string }[] = [
      { label: 'slack-shape1-xoxb', value: 'xoxb-' + synthetic('detector-coverage:slack-token:xoxb-', 48) },
      { label: 'slack-shape2-xoxp', value: 'xoxp-' + synthetic('detector-coverage:slack-token:xoxp-', 48) },
      { label: 'slack-shape3-xapp', value: 'xapp-' + synthetic('detector-coverage:slack-token:xapp-', 48) },
      { label: 'slack-shape4-xwfp', value: 'xwfp-' + synthetic('detector-coverage:slack-token:xwfp-', 48) },
      { label: 'slack-shape5-xoxe', value: 'xoxe-' + synthetic('detector-coverage:slack-token:xoxe-', 48) },
      { label: 'slack-shape6-xoxe.xoxb', value: 'xoxe.xoxb-' + synthetic('detector-coverage:slack-token:xoxe.xoxb-', 48) },
      { label: 'slack-shape7-xoxe.xoxp', value: 'xoxe.xoxp-' + synthetic('detector-coverage:slack-token:xoxe.xoxp-', 48) },
      { label: 'cloudflare-shape1-cfut', value: 'cfut_' + synthetic('detector-coverage:cloudflare-token:cfut_', 40) },
    ];
    const fixtures = cases.map((c, i) => ({ id: `probe-${i}`, path: `probe-${i}.txt`, content: c.value + '\n' }));
    const dir = await mkdtemp(path.join(tmpdir(), 'probe-'));
    try {
      for (const f of fixtures) await writeFile(path.join(dir, f.path), f.content, { mode: 0o600 });
      const findings = await candidate.scan(dir, fixtures);
      for (const c of cases) {
        const idx = cases.indexOf(c);
        const hit = findings.filter((f: any) => f.path === `probe-${idx}.txt`);
        console.log(c.label, 'len(after prefix)=', c.value.length, '->', JSON.stringify(hit));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  } finally {
    await removeCandidate(installation);
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
