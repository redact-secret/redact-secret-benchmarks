/**
 * CI gate (#690): `benchmarks/evidence-adoption.json` records the one evidence-snapshot adoption in flight. This gate checks structure
 * and consistency only: a candidate is never the active pin, never carries an owner acceptance, and names an existing change report;
 * an accepted adoption is the active pin and carries the owner's acceptance. It reads no measurement and writes nothing; for an accepted adoption it also re-renders the active report from the record and refuses a stale comparison state or Markdown, or a pending interrupted receipt commit (#793, `adoption-report-sync.mjs`). It never
 * reads or writes the authority file: renewing that is the owner's separate, reviewed change. Spec: docs/specs/evidence-adoption.md.
 *
 * Run: npm run adoption:check
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { freshnessProblems } from './adoption-report-sync.mjs';

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

/** The engine candidate (#697) rides next to an accepted adoption on the identical evidence; it is never accepted by this repository's files. */
export function engineCandidateProblems(record, { pin, exists }) {
  const ec = record.engineCandidate;
  if (ec === undefined) return [];
  const problems = [];
  if (record.state !== 'accepted') problems.push('an engine candidate rides on an accepted adoption');
  if (ec.kind !== 'engine-product') problems.push('engineCandidate.kind must be engine-product');
  if (ec.evidenceRelease !== pin.evidenceRelease || ec.manifestDigest !== pin.manifestDigest || ec.snapshotDigest !== pin.snapshotDigest) problems.push('an engine candidate is on the identical evidence as the pin (release, manifest digest, snapshot digest)');
  if (!DIGEST.test(ec.adoptionKey ?? '')) problems.push('engineCandidate.adoptionKey must be sha256:<64 hex>');
  if (!/^v\d+\.\d+\.\d+/.test(ec.engine?.tag ?? '') || !/^[0-9a-f]{40}$/.test(ec.engine?.revision ?? '')) problems.push('engineCandidate.engine needs a tag and a 40-hex revision');
  if (!ec.product?.version || !/^sha512-/.test(ec.product?.integrity ?? '')) problems.push('engineCandidate.product needs a version and a sha512 integrity');
  if (ec.engineCompatibility?.compatible !== true) problems.push('engineCandidate.engineCompatibility must be compatible');
  if (ec.ownerAcceptance !== null) problems.push('an engine candidate carries no owner acceptance (ownerAcceptance must be null)');
  if (!ec.changeReport || !exists(ec.changeReport)) problems.push(`engineCandidate.changeReport ${ec.changeReport} does not exist`);
  return problems;
}

/** A newer evidence release rides next to the accepted adoption as `evidenceCandidate` (#690): never the active pin, never accepted by this repository's files. */
/** The identity digest of a registered product candidate's bytes: sha256 over `name sha256` lines of its packages, sorted. The same bytes give the same digest on any evidence. */
export const packagesDigest = packages => `sha256:${createHash('sha256').update([...packages].map(p => `${p.name} ${p.sha256}`).sort().join('\n') + '\n').digest('hex')}`;

export function evidenceCandidateProblems(record, { pin, exists, read, productCandidates }) {
  const ec = record.evidenceCandidate;
  if (ec === undefined) return [];
  const problems = [];
  if (record.state !== 'accepted') problems.push('an evidence candidate rides next to an accepted adoption');
  if (ec.evidenceRelease === pin.evidenceRelease) problems.push('an evidence candidate is a newer release than the active pin');
  if (!/^snapshot-\d{4}\.\d{2}\.\d{2}(\.\d+)?$/.test(ec.evidenceRelease ?? '')) problems.push('evidenceCandidate.evidenceRelease must be a snapshot tag');
  for (const key of ['manifestDigest', 'snapshotDigest', 'adoptionKey']) if (!DIGEST.test(ec[key] ?? '')) problems.push(`evidenceCandidate.${key} must be sha256:<64 hex>`);
  if (!/^v\d+\.\d+\.\d+/.test(ec.engine?.tag ?? '') || !/^[0-9a-f]{40}$/.test(ec.engine?.revision ?? '')) problems.push('evidenceCandidate.engine needs a tag and a 40-hex revision');
  if (ec.engineCompatibility?.compatible !== true) problems.push('evidenceCandidate.engineCompatibility must be compatible');
  if (ec.product && (!ec.product.version || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(ec.product.integrity ?? ''))) problems.push('evidenceCandidate.product needs a version and a well-formed sha512 integrity (86 base64 characters and ==)');
  if (ec.ownerAcceptance !== null) problems.push('an evidence candidate carries no owner acceptance (ownerAcceptance must be null)');
  if (!ec.changeReport || !exists(ec.changeReport)) problems.push(`evidenceCandidate.changeReport ${ec.changeReport} does not exist`);
  // The product candidate measured on this evidence is the same registered bytes as on the accepted evidence (identity recorded here, bytes in benchmarks/product-candidates.json).
  for (const pc of ec.productCandidates ?? []) {
    const registered = productCandidates?.candidates?.find(c => c.id === pc.id);
    if (!registered) problems.push(`evidenceCandidate.productCandidates names ${pc.id}, which benchmarks/product-candidates.json does not register`);
    else {
      if (registered.product.commit !== pc.commit) problems.push(`evidenceCandidate.productCandidates ${pc.id}: commit ${pc.commit} is not the registered ${registered.product.commit}`);
      if (packagesDigest(registered.packages) !== pc.packagesDigest) problems.push(`evidenceCandidate.productCandidates ${pc.id}: packagesDigest is not the registered packages' (the candidate must be the same bytes on every evidence)`);
    }
  }
  // The prepared acceptance: the owner report, its data and the patch exist, the patch matches the digest file's, and it never fills an owner field.
  if (ec.acceptance) problems.push(...preparedAcceptanceProblems(ec.acceptance, { exists, read }).map(p => p.replace(/^candidate\./, 'evidenceCandidate.')));
  return problems;
}

export function checkEvidenceAdoption() {
  const inputs = readJson('benchmarks/qualification-inputs.json');
  const record = readJson('benchmarks/evidence-adoption.json');
  const context = { pin: inputs.populations.find(p => p.id === 'public-evidence-snapshot').pin, exists: p => existsSync(new URL(p, root)), read: p => readFileSync(new URL(p, root), 'utf8'), productCandidates: readJson('benchmarks/product-candidates.json') };
  return [...evidenceAdoptionProblems(record, context), ...engineCandidateProblems(record, context), ...evidenceCandidateProblems(record, context)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Structure first; then the freshness of the ACTIVE report against the record (#793): a local, deterministic re-render, no remote receipt check and no scanner. Superseded reports stay historical.
  const structure = checkEvidenceAdoption();
  const problems = [...structure, ...(structure.length ? [] : await freshnessProblems())];
  if (problems.length) { console.error(`${problems.length} evidence-adoption problem(s):\n${problems.map(p => `  - ${p}`).join('\n')}`); process.exit(1); }
  console.log(`Evidence adoption: ${readJson('benchmarks/evidence-adoption.json').state}; active pins are untouched by a candidate and no owner acceptance is fabricated.`);
}
