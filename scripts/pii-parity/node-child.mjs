/**
 * One #427 JavaScript surface in its own process (PII activation is process-wide and a different later selection is
 * rejected). Usage: node node-child.mjs <installation-root> <addon|wasm> <job.json> <result.json>
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runJob } from './js-runner.mjs';

const [root, expected, jobFile, outFile] = process.argv.slice(2);
const job = JSON.parse(await readFile(jobFile, 'utf8'));
const api = await import(pathToFileURL(path.join(root, 'node_modules/@redact-secret/core/dist/index.js')).href);
await api.initialize(job.selectors.length ? { pii: job.selectors } : {});
if (api.artifact() !== expected) throw new Error(`surface loaded ${api.artifact()}, expected ${expected}`);
await writeFile(outFile, JSON.stringify(runJob(api, job)));
