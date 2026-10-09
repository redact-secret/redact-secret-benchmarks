/**
 * Produce one cross-domain release record by binding the credential and PII domains' own evidence for one release
 * source commit (#287, #449). It measures nothing: every identity and evidence path is an argument, supplied by
 * whoever produces the record for a specific release. Naming the release commit is a maintainer decision.
 *
 * Schema 2 (any release):
 *   node --import tsx scripts/produce-release-record.mjs \
 *     --release-version=<x.y.z[-pre]> --source-commit=<40-hex redact-secret commit> \
 *     --benchmark-revision=<40-hex benchmarks commit> --credential-profile=measurement-v4|evaluation-v1 \
 *     --performance-budget=<BudgetReport JSON> --credential-candidate=<'candidate' evidence JSON> \
 *     --credential-qualification=<'qualification' evidence JSON> --output=<path> \
 *     --pii-route=trusted-product-binding --pii-qualification=<PiiQualificationReport JSON> --pii-binding=<PiiTrustedProductBinding JSON>
 *   or
 *     --pii-route=pii-b11-protected-v1 --pii-protected-binding=<reviewed protected-support-bindings-v1.json id> \
 *     [--source-equivalence=<reviewed release-source-equivalences-v1.json id>]
 *
 * Schema 1 (`beta10-release-record`) is produced by explicit --schema=1 using
 * produceSchema1 below.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assembleReleaseRecord, assembleReleaseRecordV2, PII_TRUSTED_PRODUCT_ROUTE } from '../benchmarks/evaluation/release-record.ts';
import { verifyReleaseRecordEvidence } from '../benchmarks/evaluation/release-record-evidence.ts';
import { measurementOutput, writeMeasurement } from './lib/measurement-output.mjs';
import { piiSupportRegistry } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { PII_PROTECTED_ROUTE, piiReviewedProtectedRoute } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const registryFamilies = piiSupportRegistry.families.map(row => row.family);
const SHARED = ['benchmark-revision', 'credential-profile', 'performance-budget', 'credential-candidate', 'credential-qualification', 'output'];

export function parseArguments(argv) {
  const args = {};
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.+)$/.exec(argument);
    if (!match || Object.hasOwn(args, match[1])) throw new Error(`Invalid argument: ${argument}`);
    args[match[1]] = match[2];
  }
  args.output ??= path.join(repositoryRoot, 'results-output/release-records', `record-${Date.now()}.json`);
  return args;
}

function requireArgs(args, keys, allowed) {
  const missing = keys.filter(key => !args[key]);
  if (missing.length) throw new Error(`Missing required --<flag>: ${missing.join(', ')}`);
  const unknown = Object.keys(args).filter(key => !allowed.includes(key));
  if (unknown.length) throw new Error(`Unknown --<flag>: ${unknown.join(', ')}`);
  if (!/^[a-f0-9]{40}$/.test(args['benchmark-revision'])) throw new Error('--benchmark-revision must be 40 hex characters');
  if (!['measurement-v4', 'evaluation-v1'].includes(args['credential-profile'])) throw new Error("--credential-profile must be 'measurement-v4' or 'evaluation-v1'");
}

const readJson = async file => JSON.parse(await readFile(path.resolve(file), 'utf8'));

async function write(record, output) {
  writeMeasurement(measurementOutput(output, repositoryRoot), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${record.artifactCommitment} ${record.reportType} product=${record.identity.productSourceCommit}`);
  return record;
}

/** The unchanged beta.10 path: schema 1, PII through the v1 trusted product binding. */
export async function produceSchema1(args) {
  const keys = [...SHARED, 'pii-qualification', 'pii-binding'];
  requireArgs(args, keys, keys);
  return write(assembleReleaseRecord({
    benchmarkRevision: args['benchmark-revision'], credentialProfile: args['credential-profile'],
    performanceBudget: await readJson(args['performance-budget']),
    credentialCandidateEvidence: await readJson(args['credential-candidate']), credentialQualification: await readJson(args['credential-qualification']),
    piiQualification: await readJson(args['pii-qualification']), piiBinding: await readJson(args['pii-binding']), registryFamilies,
  }), args.output);
}

export async function produceSchema2(args) {
  const base = [...SHARED, 'release-version', 'source-commit', 'pii-route'];
  const route = args['pii-route'];
  // --suite names the snapshot a frozen record was produced with; without it a new record is checked against the live qualification/suite-v1.json.
  if (route === PII_TRUSTED_PRODUCT_ROUTE) requireArgs(args, [...base, 'pii-qualification', 'pii-binding'], [...base, 'pii-qualification', 'pii-binding', 'suite']);
  else if (route === PII_PROTECTED_ROUTE) requireArgs(args, [...base, 'pii-protected-binding'], [...base, 'pii-protected-binding', 'source-equivalence', 'suite']);
  else if (!route) requireArgs(args, base, [...base, 'suite']);
  else throw new Error(`--pii-route must be '${PII_TRUSTED_PRODUCT_ROUTE}' or '${PII_PROTECTED_ROUTE}'`);
  if (!/^[a-f0-9]{40}$/.test(args['source-commit'])) throw new Error('--source-commit must be 40 hex characters');
  const common = {
    releaseVersion: args['release-version'], sourceCommit: args['source-commit'], benchmarkRevision: args['benchmark-revision'],
    credentialProfile: args['credential-profile'], performanceBudget: await readJson(args['performance-budget']),
    credentialCandidateEvidence: await readJson(args['credential-candidate']), credentialQualification: await readJson(args['credential-qualification']),
    sourceEquivalenceId: args['source-equivalence'] ?? null, suite: args.suite ? await readJson(args.suite) : undefined,
  };
  let record;
  if (route === PII_TRUSTED_PRODUCT_ROUTE) {
    record = assembleReleaseRecordV2({ ...common, piiRoute: route, piiQualification: await readJson(args['pii-qualification']),
      piiBinding: await readJson(args['pii-binding']), registryFamilies });
  } else {
    const binding = piiReviewedProtectedRoute(args['pii-protected-binding']);
    if (!binding) throw new Error('--pii-protected-binding does not name a reviewed entry');
    const disposition = await readJson(path.join(repositoryRoot, binding.evidenceDirectory, 'pii-beta11-protected-disposition-v2.json'));
    record = assembleReleaseRecordV2({ ...common, piiRoute: route, piiProtectedBinding: binding, piiProtectedDisposition: disposition });
  }
  await verifyReleaseRecordEvidence(record, registryFamilies, repositoryRoot, common.suite);
  return write(record, args.output);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = parseArguments(process.argv.slice(2));
  const schema = args.schema ?? '2';
  delete args.schema;
  if (schema === '1') await produceSchema1(args);
  else if (schema === '2') await produceSchema2(args);
  else throw new Error('--schema must be 1 or 2');
}
