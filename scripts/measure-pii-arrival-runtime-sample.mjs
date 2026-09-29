import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--([a-z][a-z0-9-]*)=(.*)$/.exec(argument);
  if (!match || Object.hasOwn(args, match[1])) throw new Error('invalid sample arguments');
  args[match[1]] = match[2];
}
const allowed = ['module', 'selectors-base64', 'workload-base64'];
if (JSON.stringify(Object.keys(args).sort()) !== JSON.stringify([...allowed].sort()) || allowed.some(key => !args[key]))
  throw new Error('invalid sample argument set');
const selectors = JSON.parse(Buffer.from(args['selectors-base64'], 'base64url').toString('utf8'));
const workload = Buffer.from(args['workload-base64'], 'base64url').toString('utf8');
if (!Array.isArray(selectors) || selectors.some(value => typeof value !== 'string') || typeof workload !== 'string' || !workload)
  throw new Error('invalid sample inputs');
const module = await import(pathToFileURL(args.module).href);
const measure = async operation => { const start = performance.now(); await operation(); return performance.now() - start; };
const initialize = await measure(() => module.initialize(selectors.length ? { pii: selectors } : undefined));
const wholeInput = await measure(() => module.scan(workload));
const incrementalLineCalls = await measure(() => workload.split('\n').forEach(line => module.scan(line)));
process.stdout.write(`${JSON.stringify({ initialize, wholeInput, incrementalLineCalls })}\n`);
