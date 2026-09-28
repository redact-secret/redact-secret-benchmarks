import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

export async function verifyImplementationFreeze(plan, root = process.cwd()) {
  if (plan.implementationFreeze?.algorithm !== 'sha256-file-bytes' || !Array.isArray(plan.implementationFreeze.files))
    throw new Error('Invalid PII profile-cost implementation freeze');
  for (const entry of plan.implementationFreeze.files) {
    const actual = sha256(await readFile(path.resolve(root, entry.path)));
    if (actual !== entry.sha256) throw new Error(`PII profile-cost implementation drift: ${entry.path}`);
  }
  return true;
}

export function parseAdapterSample(stdout, stderr) {
  if (stderr !== '' || stdout.split('\n').filter(Boolean).length !== 1) throw new Error('Invalid PII profile-cost adapter process output');
  let sample;
  try { sample = JSON.parse(stdout); } catch (error) { throw new Error('Invalid PII profile-cost adapter JSON', { cause: error }); }
  const metric = candidate => Number.isFinite(candidate) && candidate >= 0 ||
    exact(candidate, ['status', 'reasonCode']) && candidate.status === 'not-applicable' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.reasonCode);
  if (!exact(sample, ['import', 'initialize', 'wholeInput', 'incremental', 'bytesPerSecond', 'memory']) ||
      !exact(sample.bytesPerSecond, ['wholeInput', 'incremental']) || sample.memory === null || typeof sample.memory !== 'object' ||
      Array.isArray(sample.memory) || [sample.import, sample.initialize, sample.wholeInput, sample.incremental,
        sample.bytesPerSecond.wholeInput, sample.bytesPerSecond.incremental].some(value => !metric(value)))
    throw new Error('Invalid PII profile-cost adapter sample');
  for (const metric of Object.values(sample.memory)) if (!(Number.isFinite(metric) && metric >= 0) &&
      !(exact(metric, ['status', 'reasonCode']) && metric.status === 'not-applicable' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metric.reasonCode)))
    throw new Error('Invalid PII profile-cost adapter memory metric');
  return sample;
}

export function parseSingleInput(text) {
  if (text.split('\n').filter(Boolean).length !== 1) throw new Error('Invalid PII profile-cost adapter input framing');
  const input = JSON.parse(text);
  if (!exact(input, ['credentialProfile', 'selectors', 'expectedActivation', 'expectedArtifact', 'workloadBase64', 'chunksBase64']) ||
      !['full', 'common'].includes(input.credentialProfile) || !Array.isArray(input.selectors) ||
      input.selectors.some(value => typeof value !== 'string') || typeof input.expectedActivation !== 'string' ||
      !['addon', 'wasm', 'compiled'].includes(input.expectedArtifact) || typeof input.workloadBase64 !== 'string' ||
      !Array.isArray(input.chunksBase64) || input.chunksBase64.some(value => typeof value !== 'string'))
    throw new Error('Invalid PII profile-cost adapter input');
  return input;
}
