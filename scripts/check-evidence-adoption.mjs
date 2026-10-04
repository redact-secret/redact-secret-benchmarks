/**
 * CI gate (#690): `benchmarks/evidence-adoption.json` records the one evidence-snapshot adoption in flight. This gate checks structure
 * and consistency only: a candidate is never the active pin, never carries an owner acceptance, and names an existing change report;
 * an accepted adoption is the active pin and carries the owner's acceptance. It reads no measurement and writes nothing. It never
 * reads or writes the authority file: renewing that is the owner's separate, reviewed change. Spec: docs/specs/evidence-adoption.md.
 *
 * Run: npm run adoption:check
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const readJson = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

/** Pure: `pin` is the floors population pin of benchmarks/qualification-inputs.json; `exists(path)` tells whether a repo file exists; `read(path)` returns a repo file's text (only the prepared acceptance is checked through it). */
export function evidenceAdoptionProblems(record, { pin, exists, read }) {
  const problems = [];
  if (record.schema !== 'redact-secret/evidence-adoption/v1') problems.push('schema must be redact-secret/evidence-adoption/v1');
  if (!['none', 'candidate', 'accepted'].includes(record.state)) { problems.push('state must be none, candidate or accepted'); return problems; }
  if (record.state === 'none') { if (record.candidate !== undefined) problems.push('state none carries no candidate'); return problems; }
  const c = record.candidate ?? {};
  if (!/^snapshot-\d{4}\.\d{2}\.\d{2}(\.\d+)?$/.test(c.evidenceRelease ?? '')) problems.push('candidate.evidenceRelease must be a snapshot tag');
  for (const f of ['manifestDigest', 'snapshotDigest', 'adoptionKey']) if (!DIGEST.test(c[f] ?? '')) problems.push(`candidate.${f} must be sha256:<64 hex>`);
  if (!/^[0-9a-f]{40}$/.test(c.sourceRevision ?? '')) problems.push('candidate.sourceRevision must be a full 40-hex commit');
  if (c.engineCompatibility?.compatible !== true) problems.push('a candidate is recorded only after the engine compatibility preflight passed');
  if (!c.changeReport || !exists(c.changeReport)) problems.push(`candidate.changeReport ${c.changeReport} does not exist`);
  if (c.acceptance) problems.push(...preparedAcceptanceProblems(c.acceptance, { exists, read }));
  const isPin = c.evidenceRelease === pin.evidenceRelease;
  if (record.state === 'candidate') {
    if (isPin) problems.push('a candidate is not the active pin; once pinned, the adoption is accepted or withdrawn');
    if (c.ownerAcceptance !== null) problems.push('a candidate carries no owner acceptance (ownerAcceptance must be null)');
  } else {
    if (!isPin || c.manifestDigest !== pin.manifestDigest || c.snapshotDigest !== pin.snapshotDigest) problems.push('an accepted adoption must be the active pin (release, manifest digest, snapshot digest)');
    const a = c.ownerAcceptance;
    if (!a?.acceptedBy || !/^\d{4}-\d{2}-\d{2}$/.test(a?.acceptedOn ?? '') || !a?.decision || !exists(a.decision)) problems.push('an accepted adoption needs ownerAcceptance { acceptedBy, acceptedOn, decision (an existing docs/decisions file) }');
  }
  return problems;
}

/**
 * The prepared acceptance (#680): the owner report, its data and the patch the owner applies exist, the patch matches its recorded digest, and the patch never fills an
 * owner field (every added acceptedBy or acceptedOn line is the OWNER-TO-SET placeholder, so the gates stay red until the owner decides).
 */
export function preparedAcceptanceProblems(acceptance, { exists, read }) {
  const problems = [];
  for (const f of ['report', 'comparison', 'patch', 'patchDigestFile']) if (!acceptance[f] || !exists(acceptance[f])) problems.push(`candidate.acceptance.${f} ${acceptance[f]} does not exist`);
  if (problems.length || !read) return problems;
  const patch = read(acceptance.patch);
  const recorded = /^([0-9a-f]{64})\b/.exec(read(acceptance.patchDigestFile))?.[1];
  const actual = createHash('sha256').update(patch).digest('hex');
  if (recorded !== actual) problems.push(`candidate.acceptance.patch has sha256 ${actual}, ${acceptance.patchDigestFile} records ${recorded ?? 'none'}`);
  for (const line of patch.split('\n')) if (/^\+/.test(line) && /"accepted(By|On)"/.test(line) && !line.includes('OWNER-TO-SET')) problems.push(`the prepared patch fills an owner field: ${line.slice(0, 120)}`);
  return problems;
}

export function checkEvidenceAdoption() {
  const inputs = readJson('benchmarks/qualification-inputs.json');
  return evidenceAdoptionProblems(readJson('benchmarks/evidence-adoption.json'), { pin: inputs.populations.find(p => p.id === 'public-evidence-snapshot').pin, exists: p => existsSync(new URL(p, root)), read: p => readFileSync(new URL(p, root), 'utf8') });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkEvidenceAdoption();
  if (problems.length) { console.error(`${problems.length} evidence-adoption problem(s):\n${problems.map(p => `  - ${p}`).join('\n')}`); process.exit(1); }
  console.log(`Evidence adoption: ${readJson('benchmarks/evidence-adoption.json').state}; active pins are untouched by a candidate and no owner acceptance is fabricated.`);
}
