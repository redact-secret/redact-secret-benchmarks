/**
 * Scope accounting of one or more RunArtifacts, as a safe summary (#725): per scanner, the engine's disposition counts, native-type histogram, classification
 * version, configuration identity and limits (benchmarks/qualification/scope-accounting.ts), with a declared credential profile compared against its default
 * as a separate observation. Reporting only: nothing is re-classified, filtered or scored here, no matched value or raw output is read (the artifacts carry
 * none), and a legacy artifact reads Unknown, never zero.
 *
 *   node --import tsx scripts/summarize-scope-accounting.ts --out <dir> --artifact <name>=<file> [--artifact <name>=<file> ...]
 *     [--mode published|candidate] [--origin <text>] [--platform <text>] [--population <id>] [--note <text>]
 *
 * Each artifact is read from its bytes (a methods artifact can exceed a string) and is NOT validated against the vendored RunArtifact schema, which belongs to the
 * accepted engine: an engine candidate's artifact carries v1.8 fields that schema refuses by design. The accounting is checked against the retained findings.
 * Writes `<dir>/scope-accounting.json` and `scope-accounting.md`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { declaredProfiles } from '../benchmarks/lib/peer-rule-families.ts';
import { parseBuffer } from '../benchmarks/qualification/large-json.ts';
import { profileEffectsOf, scopeByScanner, scannerTotals, type ScannerRunWithScope } from '../benchmarks/qualification/scope-accounting.ts';
import type { RunArtifact } from '../benchmarks/qualification/run-artifact.ts';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const all = (name: string): string[] => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const out = option('out');
const inputs = all('artifact').map(spec => { const at = spec.indexOf('='); if (at < 1) throw new Error('--artifact is <name>=<file>'); return { name: spec.slice(0, at), file: spec.slice(at + 1) }; });
if (!out || !inputs.length) throw new Error('usage: summarize-scope-accounting.ts --out <dir> --artifact <name>=<file> [...] [--mode published|candidate] [--origin <text>] [--platform <text>] [--population <id>] [--note <text>]');
const mode = option('mode') ?? 'not stated';
if (!['published', 'candidate', 'not stated'].includes(mode)) throw new Error('--mode is published or candidate');
const registry = JSON.parse(readFileSync(new URL('../scanners/peer-registry.json', import.meta.url), 'utf8'));
const profiles = declaredProfiles(registry);

const int = (n: number): string => n.toLocaleString('en-US');
const documents = inputs.map(({ name, file }) => {
  const bytes = readFileSync(file);
  const artifact = parseBuffer(bytes) as RunArtifact;
  if (artifact.schema !== 'credential-eval/run-artifact/v1') throw new Error(`${file}: not a RunArtifact v1`);
  const entries = scopeByScanner(artifact);
  const runs = artifact.scanners as ScannerRunWithScope[];
  return {
    name, file: path.basename(file), bytes: bytes.length,
    engine: artifact.manifest.engine, protocol: artifact.manifest.protocol_version, runClass: artifact.manifest.run_class ?? null, publication: artifact.manifest.publication ?? null,
    configHash: artifact.manifest.config_hash, evidence: { revision: artifact.manifest.evidence.revision, corpusDigest: artifact.manifest.evidence.corpus_digest, release: artifact.manifest.evidence.release ?? null },
    methods: artifact.manifest.methods.map(m => m.id),
    scope: entries.map(e => ({ ...e, declared: profiles[e.scanner] ? { profileOf: profiles[e.scanner] } : { default: true }, totals: scannerTotals(runs.find(r => r.scanner === e.scanner)!) })),
    profileEffects: profileEffectsOf(artifact, profiles, option('population') ?? 'not stated'),
  };
});
const summary = {
  schema: 'redact-secret-benchmarks/scope-accounting-summary/v1',
  mode, origin: option('origin') ?? null, platform: option('platform') ?? null, note: option('note') ?? null,
  boundary: 'Counts are the engine\'s (credential-eval ADR 0016) over the findings each artifact retains. Nothing was re-classified, filtered or scored here; an unresolved type is neither a false positive nor ignored; a profile is a separate configuration, not a speed-up; Unknown means no accounting was recorded, not zero.',
  artifacts: documents,
};
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'scope-accounting.json'), `${JSON.stringify(summary, null, 2)}\n`);

const md: string[] = [`# Scope accounting`, '', `Mode: **${mode}**${summary.origin ? ` · origin: ${summary.origin}` : ''}${summary.platform ? ` · platform: ${summary.platform}` : ''}`, '', summary.boundary, ''];
if (summary.note) md.push(summary.note, '');
for (const d of documents) {
  md.push(`## ${d.name}`, '', `Engine ${d.engine.version} · ${d.protocol} · run class ${d.runClass ?? 'not recorded'} · config ${d.configHash.slice(0, 19)} · evidence ${d.evidence.release?.tag ?? d.evidence.revision}${d.methods.length ? ` · methods ${d.methods.join(', ')}` : ''}`, '');
  md.push('| Scanner | Configuration | State | Retained findings | Native label | Mapped credential | Credential-related unmapped | Out of scope | Ambiguous | Label unavailable | Unrecognized label |', '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const e of d.scope) {
    const x = (n: number | null | undefined) => (n === null || n === undefined ? 'Unknown' : int(n));
    const dd = e.dispositions;
    md.push(`| ${e.scanner} | ${e.declared.default ? 'default' : `profile of ${(e.declared as { profileOf: string }).profileOf}`} · ${e.profile.configurationHash.slice(0, 19)} | ${e.state} | ${x(e.retainedFindings)} | ${x(e.labelled)} | ${x(dd?.mapped_credential)} | ${x(dd?.credential_related_unmapped)} | ${x(dd?.out_of_scope)} | ${x(dd?.ambiguous)} | ${x(dd?.native_label_unavailable)} | ${x(dd?.unrecognized_label)} |`);
  }
  md.push('');
  for (const e of d.scope.filter(s => s.state === 'accounted')) {
    md.push(`### ${e.scanner}: native types (top 15 of ${int(e.labels.length)})`, '', `Classification ${e.classification!.table.id} · accounting v${e.classification!.accountingVersion} · multi-label findings ${x2(e.multiLabelFindings)} · conflicting label sets ${x2(e.conflictingLabelFindings)}`, '', '| Native type | Findings | With family | Reviewed scope | Status |', '| --- | ---: | ---: | --- | --- |');
    for (const l of e.labels.slice(0, 15)) md.push(`| ${l.label} | ${int(l.findings)} | ${int(l.withFamily)} | ${l.scope ?? 'outside the reviewed set'} | ${l.status ?? 'not classified'} |`);
    md.push('');
  }
  for (const p of d.profileEffects) {
    md.push(`### ${p.profile.scanner} against ${p.default.scanner}`, '', `Outcome deltas (profile minus default): ${(['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS'] as const).map(o => `${o} ${p.delta.outcomes[o] > 0 ? '+' : ''}${p.delta.outcomes[o]}`).join(' · ')} · benign controls flagged ${p.delta.benignFlagged > 0 ? '+' : ''}${p.delta.benignFlagged} · retained findings ${p.delta.retainedFindings === null ? 'Unknown' : (p.delta.retainedFindings > 0 ? '+' : '') + int(p.delta.retainedFindings)} · denominators equal: ${p.denominatorsEqual}`, '', p.note, '');
  }
}
function x2(n: number | null): string { return n === null ? 'Unknown' : int(n); }
writeFileSync(path.join(out, 'scope-accounting.md'), `${md.join('\n')}\n`);
console.log(md.join('\n'));
