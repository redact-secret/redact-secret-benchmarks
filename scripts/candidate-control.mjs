#!/usr/bin/env node
/**
 * The control of a product candidate replay (#698): the published product on the engine candidate, replayed on the SAME evidence as the candidate, so the product build is the
 * only difference. Without an evidence tag that is the accepted evidence's `engineCandidate` of benchmarks/evidence-adoption.json. With `--evidence-tag` and `--manifest-digest`
 * (a new snapshot) it is the adoption record that holds that release and a recorded replay archive of the published build on it; anything else is refused with what to do first.
 *
 *   node scripts/candidate-control.mjs [--evidence-tag <tag> --manifest-digest sha256:<hex>] --field engine.tag|archive.release|archive.sha256|evidenceRelease|queue
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const DIGEST = /^sha256:[0-9a-f]{64}$/;

/** Pure: the control record for an evidence release. Throws with the reason. */
export function controlFor(adoption, { evidenceTag, manifestDigest, requireArchive = true } = {}) {
  const ec = adoption.engineCandidate;
  if (!evidenceTag) {
    // An engine candidate whose replay is not recorded yet (state pending, no archive) is not a control: there is nothing to replay a product candidate against.
    if (ec && (ec.replay?.archive?.release || ec.replay?.state !== 'pending')) return { ...ec, source: 'engineCandidate' };
    // The accepted evidence's own replay is the control once the adoption is accepted: the published product on the accepted engine (its replay copy holds the run records).
    const accepted = adoption.state === 'accepted' ? adoption.candidate : undefined;
    // A later acceptance of the engine and the product on the SAME evidence (`engineProductAcceptance`, #808: alpha.16 measuring core beta.14) moves what a candidate is compared with: the
    // engine and the published product the replay runs on are the ones the owner accepted, and the control is a copy measured at exactly those pins (`replay.acceptedPinsCopy`), never the
    // earlier alpha.15/beta.13 one. A record that has no such acceptance keeps the rule above. The acceptance block itself is read, never written (#657).
    const acceptance = adoption.state === 'accepted' ? adoption.engineProductAcceptance : undefined;
    if (accepted && acceptance) {
      if (acceptance.evidenceRelease !== accepted.evidenceRelease || acceptance.manifestDigest !== accepted.manifestDigest) throw new Error('engineProductAcceptance is for another evidence release than the accepted adoption: a candidate is measured on the accepted evidence');
      if (!acceptance.engine?.tag || !acceptance.engine?.revision || !acceptance.product?.version) throw new Error('engineProductAcceptance records no engine or no product');
      const copy = accepted.replay?.acceptedPinsCopy;
      const at = { ...accepted, engine: acceptance.engine, product: acceptance.product, source: 'engineProductAcceptance' };
      if (!copy) {
        if (requireArchive) throw new Error(`no control at the accepted pins (${acceptance.engine.tag}, @redact-secret/core ${acceptance.product.version}): record candidate.replay.acceptedPinsCopy (a control copy measured at those pins) before replaying a product candidate`);
        return { ...at, replay: { ...accepted.replay, archive: undefined, recordedRuns: undefined } };
      }
      if (copy.engineTag !== acceptance.engine.tag || copy.productVersion !== acceptance.product.version) throw new Error(`the recorded control copy is for ${copy.engineTag} and @redact-secret/core ${copy.productVersion}, the accepted pins are ${acceptance.engine.tag} and ${acceptance.product.version}: it is stale, measure a control copy at the accepted pins`);
      if (requireArchive && (!copy.release || !DIGEST.test(copy.sha256 ?? ''))) throw new Error('the control copy at the accepted pins records no archive (release and sha256)');
      return { ...at, replay: { ...accepted.replay, archive: copy, recordedRuns: copy.recordedRuns, semanticDigests: copy.semanticDigests } };
    }
    const copy = accepted?.replay?.replayCopy ?? accepted?.replay?.archive;
    if (accepted && copy?.release && DIGEST.test(copy.sha256 ?? '') && accepted.engine?.tag && accepted.product?.version) return { ...accepted, replay: { ...accepted.replay, archive: copy }, source: 'candidate' };
    throw new Error('benchmarks/evidence-adoption.json records no engineCandidate and no accepted replay to replay a product candidate on');
  }
  if (!DIGEST.test(manifestDigest ?? '')) throw new Error('--manifest-digest sha256:<64 hex> is required with --evidence-tag');
  const holder = [['evidenceCandidate', adoption.evidenceCandidate], ['candidate', adoption.candidate], ['engineCandidate', ec]].find(([, r]) => r?.evidenceRelease === evidenceTag);
  if (!holder) throw new Error(`benchmarks/evidence-adoption.json records no adoption of ${evidenceTag}: adopt it (adopt-evidence-snapshot.yml) and replay the published control on it first`);
  const [source, record] = holder;
  if (record.manifestDigest !== manifestDigest) throw new Error(`the adoption of ${evidenceTag} records manifest ${record.manifestDigest}, not ${manifestDigest}`);
  if (requireArchive && (!record.replay?.archive?.release || !DIGEST.test(record.replay.archive.sha256 ?? ''))) throw new Error(`the adoption of ${evidenceTag} records no replay archive (release and sha256) of the published control`);
  if (!record.engine?.tag || !record.engine?.revision) throw new Error(`the adoption of ${evidenceTag} records no engine`);
  return { ...record, product: record.product ?? ec?.product, source };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
  try {
    const c = controlFor(JSON.parse(readFileSync(new URL('benchmarks/evidence-adoption.json', root), 'utf8')), { evidenceTag: option('evidence-tag') || undefined, manifestDigest: option('manifest-digest'), requireArchive: String(option('field')).startsWith('archive.') });
    const field = option('field') ?? (() => { throw new Error('--field is required'); })();
    const value = field === 'queue' ? `docs/generated/evidence-adoption/${c.evidenceRelease}.triage-queue.json` : (field.startsWith('archive.') ? `replay.${field}` : field).split('.').reduce((o, k) => o?.[k], c);
    if (value === undefined) throw new Error(`no ${field} in the control record`);
    console.log(value);
  } catch (error) { console.error(`candidate control refused: ${error.message}`); process.exit(1); }
}
