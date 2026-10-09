/** Historical locators resolve to reviewed provenance, never to a Markdown status guess. */
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
const root = new URL('../../', import.meta.url);
export const PROVENANCE_FILE = 'benchmarks/governance/decision-provenance.json';
const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(json('schemas/decision-provenance-v1.json'));
const validateOwner = new Ajv2020({ strict: true, allErrors: true }).compile(json('schemas/owner-authorisation-v1.json'));
export function ownerAuthorisationProblems(value) {
  if (!validateOwner(value)) return (validateOwner.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`);
  if (value.status === 'accepted' && (!/^\d{4}-\d{2}-\d{2}$/.test(value.owner.acceptedOn) || (!value.owner.acceptedBy.trim() || value.owner.acceptedBy.trim() === 'OWNER-TO-SET') || (!value.ruling.trim() || value.ruling.trim() === 'OWNER-TO-SET') || !value.uses.length)) return ['accepted authorisation needs actual owner, date, ruling and scoped targets'];
  return [];
}
export function provenanceProblems(record) {
  const problems = [];
  if (!validate(record)) return (validate.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`);
  for (const key of ['path', 'decisionId']) if (new Set(record.records.map(r => r[key])).size !== record.records.length) problems.push(`duplicate ${key}`);
  if (record.records.some(r => r.sourceCommit !== record.sourceCommit)) problems.push('record source differs from reviewed archive source');
  return problems;
}
export function loadDecisionProvenance() {
  const record = json(PROVENANCE_FILE);
  const problems = provenanceProblems(record);
  if (problems.length) throw new Error(`Invalid decision provenance: ${problems.join('; ')}`);
  return record;
}
export function decisionRecord(locator, { record = loadDecisionProvenance(), read = json } = {}) {
  if (/^benchmarks\/governance\/authorisations\/[0-9a-z-]+\.json$/.test(locator ?? '')) {
    try {
      const value = read(locator);
      if (ownerAuthorisationProblems(value).length) return undefined;
      return value;
    } catch { return undefined; }
  }
  return record.records.find(row => row.path === locator);
}
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export function decisionStatus(locator, options = {}) {
  const row = decisionRecord(locator, options);
  if (!row) return undefined;
  if (options.role && !row.uses?.some(use => use.role === options.role && canonical(use.target) === canonical(options.target))) return undefined;
  return row.status;
}

/** Accepted evidence identity excludes evolving replay/deployment receipts, which do not renew owner scope. */
export function evidenceAdoptionTarget(candidate) {
  return { evidenceRelease: candidate.evidenceRelease, manifestDigest: candidate.manifestDigest, snapshotDigest: candidate.snapshotDigest,
    sourceRevision: candidate.sourceRevision, engine: candidate.engine, product: candidate.product ?? null, ownerAcceptance: candidate.ownerAcceptance };
}
