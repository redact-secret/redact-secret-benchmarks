/**
 * Produce one beta.10 release record (#287) by binding the credential and
 * PII domains' own evidence for one release candidate. This script does not
 * decide which commit is the release candidate -- every identity is a
 * required argument, supplied by whoever runs an official release-record
 * production for a specific candidate. It only reads already-produced
 * evidence files and calls assembleReleaseRecord; it measures nothing
 * itself.
 *
 * Run: node --import tsx scripts/produce-beta10-release-record.mjs \
 *   --benchmark-revision=<40-hex benchmarks-repo commit> \
 *   --credential-profile=measurement-v4|evaluation-v1 \
 *   --performance-budget=<path to a BudgetReport JSON> \
 *   --credential-candidate=<path to a 'candidate' evidence JSON> \
 *   --credential-qualification=<path to a 'qualification' evidence JSON> \
 *   --pii-qualification=<path to a PiiQualificationReport JSON> \
 *   --pii-binding=<path to a PiiTrustedProductBinding JSON> \
 *   --output=<path>
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assembleReleaseRecord } from '../benchmarks/evaluation/release-record.ts';
import { piiSupportRegistry } from '../benchmarks/evaluation/domains/pii/support-v2.ts';

const REQUIRED = ['benchmark-revision', 'credential-profile', 'performance-budget', 'credential-candidate',
  'credential-qualification', 'pii-qualification', 'pii-binding', 'output'];

const rawArgs = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--([a-z-]+)=(.+)$/.exec(argument);
  if (!match || Object.hasOwn(rawArgs, match[1])) throw new Error(`Invalid argument: ${argument}`);
  rawArgs[match[1]] = match[2];
}
const missing = REQUIRED.filter(key => !rawArgs[key]);
if (missing.length) throw new Error(`Missing required --<flag>: ${missing.join(', ')}`);
if (!/^[a-f0-9]{40}$/.test(rawArgs['benchmark-revision'])) throw new Error('--benchmark-revision must be 40 hex characters');
if (!['measurement-v4', 'evaluation-v1'].includes(rawArgs['credential-profile']))
  throw new Error("--credential-profile must be 'measurement-v4' or 'evaluation-v1'");

const readJson = async flag => JSON.parse(await readFile(path.resolve(rawArgs[flag]), 'utf8'));

const registryFamilies = piiSupportRegistry.families.map(row => row.family);
const record = assembleReleaseRecord({
  benchmarkRevision: rawArgs['benchmark-revision'],
  credentialProfile: rawArgs['credential-profile'],
  performanceBudget: await readJson('performance-budget'),
  credentialCandidateEvidence: await readJson('credential-candidate'),
  credentialQualification: await readJson('credential-qualification'),
  piiQualification: await readJson('pii-qualification'),
  piiBinding: await readJson('pii-binding'),
  registryFamilies,
});

const outputPath = path.resolve(rawArgs.output);
await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`${record.artifactCommitment} ${record.reportType} product=${record.identity.productSourceCommit}`);
