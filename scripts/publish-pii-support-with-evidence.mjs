import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Forward the existing publisher's options without passing them to the sidecar.
for (const args of [
  ['--import', 'tsx', resolve(root, 'scripts/publish-pii-support.ts'), ...process.argv.slice(2)],
  [resolve(root, 'scripts/pii-evidence-publication.mjs'), '--write'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
