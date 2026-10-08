// Share the existing family and PII contracts; only the credential source envelope differs.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const output = new URL('../schemas/support-matrix-from-view-v1.json', import.meta.url);
export function viewMatrixSchema() {
  const base = read('schemas/support-matrix-v1.json');
  const text = { type: 'string', minLength: 1 };
  const digest = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' };
  const closed = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
  const schema = closed({
    schema: { const: 'redact-secret/support-matrix-from-view/v1' },
    mode: { enum: ['published', 'candidate-projection'] },
    publication: { enum: ['public', 'internal'] },
    source: closed({
      view: closed({ schema: text, adapter: closed({ id: text, version: { type: 'integer', minimum: 1 } }),
        policyRevision: { type: 'string', pattern: '^rs-policy-[0-9]+:sha256:[a-f0-9]{64}$' } }),
      populations: { type: 'array', minItems: 1, items: closed({ population: text, runClass: { enum: ['public', 'internal'] },
        semanticDigest: digest, artifactDigest: digest, engineVersion: text,
        scannerBuilds: { type: 'object', minProperties: 1, additionalProperties: { type: ['string', 'null'] } },
        scannerVersions: { type: 'object', minProperties: 1, additionalProperties: { type: ['string', 'null'] } } }) },
      publishedPackage: closed({ packageName: { const: '@redact-secret/core' }, version: text }),
    }, ['view', 'populations']),
    ...Object.fromEntries(['providerCount', 'familyCount', 'distribution', 'stableDistribution', 'families', 'findingTypeSource', 'piiCurrentQualification']
      .map(key => [key, base.properties[key]])),
  }, ['schema', 'mode', 'publication', 'source', 'providerCount', 'familyCount', 'distribution', 'stableDistribution', 'families', 'findingTypeSource']);
  return { $schema: base.$schema, $id: 'urn:redact-secret-benchmarks:support-matrix-from-view:1', ...schema,
    allOf: [{ if: { properties: { mode: { const: 'published' } }, required: ['mode'] },
      then: { properties: { publication: { const: 'public' }, source: { required: ['publishedPackage'] } } },
      else: { properties: { publication: { const: 'internal' } } } }], definitions: base.definitions };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const expected = JSON.stringify(viewMatrixSchema(), null, 2) + '\n';
  if (process.argv.includes('--write')) writeFileSync(output, expected);
  else if (readFileSync(output, 'utf8') !== expected) throw new Error('Qualification-view matrix schema is stale');
}
