import Ajv from 'ajv';
import schema from '../../schemas/credential-support-input-v1.json' with { type: 'json' };
const valid = new Ajv({ strict: true }).compile(schema);
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === [...keys].sort().join();
const revision = value => /^[a-f0-9]{40}$/.test(value ?? '');
const digest = value => /^[a-f0-9]{64}$/.test(value ?? '');
export function validateCredentialSupportInputs(value, expected) {
  if (!exact(expected, ['schemaVersion','inputType','registryPath','registryCommitment','scope','sources']) ||
      expected.schemaVersion !== 1 || expected.inputType !== 'reviewed-credential-support-binding-index' ||
      expected.registryPath !== 'benchmarks/inputs/credential/support-bindings.json' || !digest(expected.registryCommitment) ||
      sha(value) !== expected.registryCommitment || JSON.stringify(value?.scope) !== JSON.stringify(expected.scope) ||
      JSON.stringify(value?.records?.map(row => row.source)) !== JSON.stringify(expected.sources))
    throw new Error('Credential support reviewed source or registry binding mismatch');
  if (!valid(value)) throw new Error('Credential support input schema mismatch: ' + JSON.stringify(valid.errors));
  if (!exact(value, ['schemaVersion','inputType','scope','records']) || value.schemaVersion !== 1 || value.inputType !== 'current-credential-support-bindings' ||
      !exact(value.scope, ['publishedVersion','publishedSourceCommit','candidateSourceCommits']) || typeof value.scope.publishedVersion !== 'string' ||
      !revision(value.scope.publishedSourceCommit) || !Array.isArray(value.scope.candidateSourceCommits) || value.scope.candidateSourceCommits.some(c => !revision(c)) || !Array.isArray(value.records))
    throw new Error('Invalid current credential support registry');
  const seen = new Set();
  for (const row of value.records) {
    if (!exact(row, ['mode','source','dataSha256','data']) || !['published','candidate'].includes(row.mode) ||
        !exact(row.source, ['path','revision','sha256','productSourceCommit']) || !/^evidence\/[A-Za-z0-9_./-]+\.json$/.test(row.source.path ?? '') || row.source.path.split('/').includes('..') ||
        !revision(row.source.revision) || !revision(row.source.productSourceCommit) || !digest(row.source.sha256) || !digest(row.dataSha256) || sha(row.data) !== row.dataSha256)
      throw new Error('Credential support source or projection binding mismatch');
    const identity = row.mode === 'published' ? row.data?.publishedPackage?.version : row.data?.product?.sourceCommit;
    if (row.mode === 'published' ? identity !== value.scope.publishedVersion || row.source.productSourceCommit !== value.scope.publishedSourceCommit :
        identity !== row.source.productSourceCommit || !value.scope.candidateSourceCommits.includes(identity))
      throw new Error('Credential support does not match explicit current product scope');
    const key = `${row.mode}:${identity}`;
    if (seen.has(key)) throw new Error('Duplicate current credential support identity');
    seen.add(key);
  }
  return structuredClone(value.records);
}
