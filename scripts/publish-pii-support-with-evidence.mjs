import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Forward the existing publisher's options without passing them to the sidecar.
for (const args of [
  ['--import', 'tsx', fileURLToPath(new URL('./publish-pii-support.ts', import.meta.url)), ...process.argv.slice(2)],
  [fileURLToPath(new URL('./pii-evidence-publication.mjs', import.meta.url)), '--write'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
