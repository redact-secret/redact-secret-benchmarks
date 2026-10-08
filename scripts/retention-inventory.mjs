#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventoryAt, removalDryRun, renderInventory } from './lib/retention-inventory.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const inventory = inventoryAt(root, value('--ref'), value('--references') ? JSON.parse(readFileSync(value('--references'), 'utf8')) : []);
if (args.includes('--dry-run')) {
  const result = removalDryRun(inventory, value('--manifest') ? JSON.parse(readFileSync(value('--manifest'), 'utf8')) : undefined);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
} else {
  const out = resolve(root, value('--out') ?? 'results-output/hygiene');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'inventory.json'), `${JSON.stringify(inventory)}\n`);
  writeFileSync(resolve(out, 'inventory.md'), renderInventory(inventory));
  console.log(JSON.stringify({ sourceCommit: inventory.sourceCommit, ...inventory.summary, output: out }));
}
