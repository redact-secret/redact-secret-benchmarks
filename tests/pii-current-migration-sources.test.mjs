import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, symlink, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { buildPlan } from '../scripts/pii-official-plan.mjs';
import { comparisonPlan } from '../scripts/pii-candidate-comparison-plan.mjs';
import { PII_CONVERSION_OBSERVATION_SOURCE } from '../benchmarks/evaluation/domains/pii/conversion-observation.mjs';
import { piiScorerReferenceSource } from '../benchmarks/evaluation/domains/pii/scorer-reference.mjs';
const root = process.cwd();
const json = file => readFile(path.join(root,file),'utf8').then(JSON.parse);

test('canonical minimal observation preserves the complete committed official and candidate plans', async () => {
  assert.deepEqual(buildPlan(), await json('benchmarks/pii-eval-official-execution-plan.json'));
  assert.deepEqual(comparisonPlan(), await json('benchmarks/pii-candidate-comparison/plan.json'));
  const migration=await json('benchmarks/pii-eval-migration.json');
  assert.equal(migration.benchmarkPopulations.observation.sha256,PII_CONVERSION_OBSERVATION_SOURCE.sha256);
  assert.equal(migration.benchmarkPopulations.report.sha256,piiScorerReferenceSource.sha256);
});

test('migration validator rejects forged original source digests without reading historical payloads', async () => {
  await mkdir(path.join(root,'results-output'), {recursive:true});
  const overlay=await mkdtemp(path.join(root,'results-output/pii-migration-source-'));
  try {
    await mkdir(path.join(overlay,'scripts'), {recursive:true});
    await mkdir(path.join(overlay,'benchmarks'), {recursive:true});
    await cp(path.join(root,'scripts/check-pii-eval-migration.mjs'),path.join(overlay,'scripts/check-pii-eval-migration.mjs'));
    await symlink(path.join(root,'scripts/lib'),path.join(overlay,'scripts/lib'),'dir');
    await symlink(path.join(root,'benchmarks/evaluation'),path.join(overlay,'benchmarks/evaluation'),'dir');
    for (const role of ['report','observation']) {
      const record=await json('benchmarks/pii-eval-migration.json');record.benchmarkPopulations[role].sha256='a'.repeat(64);
      await writeFile(path.join(overlay,'benchmarks/pii-eval-migration.json'),JSON.stringify(record));
      await assert.rejects(promisify(execFile)(process.execPath,[path.join(overlay,'scripts/check-pii-eval-migration.mjs')],{cwd:root}), /original report or observation source binding drift/);
    }
  } finally {await rm(overlay,{recursive:true,force:true});}
});
