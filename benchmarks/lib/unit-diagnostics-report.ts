// Human rendering of a unit-diagnostics report (#380). Every table is one
// segment — one domain × kind × tier × scope — in one unit. Nothing is summed
// across segments, and no precision/recall/F1 or tool ranking is derived.
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');
const cell = (n: number, d: number) => `${n} (${pct(n, d)})`;

export function renderUnitDiagnostics(report: any): string {
  const p = report.product;
  const lines: string[] = [];
  lines.push(`# Unit-safe diagnostics — ${report.mode} ${p.package}@${p.version}`, '');
  lines.push('Diagnostics only (#380). The measurement protocol v4 headline — leaked-span rate, leaked-byte rate, collateral ratio and false-alarm rate per kind × tier — is unchanged and remains authoritative; its counts are reproduced under **v4 reference** and cross-checked. Span units and file units are never combined, and no precision, recall, F1 or scanner ranking is derived.', '');
  lines.push('## Identity', '');
  lines.push(`- Mode: **${report.mode}**`);
  lines.push(`- Product: \`${p.package}\` version \`${p.version}\` (declared \`${p.declaredVersion}\`)`);
  if (p.candidate) {
    lines.push(`- Candidate source commit: \`${p.candidate.sourceCommit}\``);
    for (const [k, v] of Object.entries(p.candidate.artifactSha256)) lines.push(`- Candidate ${k} artifact SHA-256: \`${v}\``);
  } else lines.push(`- Benchmark lockfile SHA-256: \`${p.lockHash}\``);
  lines.push(`- Corpus identity: \`${report.corpus.identity}\` (${Object.keys(report.corpus.categories).length} categories, pinned by \`benchmarks/pin-manifest.json\` @ \`${report.corpus.pinManifestRevision}\`)`);
  lines.push(`- Benchmark revision: \`${report.provenance.benchmarkRevision}\`${report.provenance.dirty ? ' (dirty)' : ''}`);
  lines.push(`- Report schema: unit-diagnostics v${report.schemaVersion}; digest \`${report.digest}\``);
  lines.push(`- Output verification: ${report.configuration.api}; placeholder \`${report.configuration.placeholderFormat}\``);
  lines.push(`- PII: ${report.domains.pii.status} — ${report.domains.pii.reason}`, '');

  const segments = Object.entries<any>(report.segments);
  const span = segments.filter(([, s]) => s.unit === 'secret-span');
  const file = segments.filter(([, s]) => s.unit === 'file');

  lines.push('## Secret-span units (must-redact, policy)', '');
  lines.push('Detection is the v4 lattice over every finding, any action. Sanitization is measured on the product\'s actual `scanAndRedact` output: `removed` means no byte of the span survives. A `warn`/`allow` finding is a detection and never a sanitization success.', '');
  lines.push('| Segment | Spans | EXACT | COVERED | OVERBROAD | PARTIAL | MISS | Output removed | Output partial leak | Output leaked | Failed |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [key, s] of span) {
    const failed = Object.values<number>(s.failedSpans).reduce((a, b) => a + b, 0);
    const d = s.eligibleSpans;
    lines.push(`| \`${key}\` | ${d} | ${s.detection.EXACT} | ${s.detection.COVERED} | ${s.detection.OVERBROAD} | ${s.detection.PARTIAL} | ${s.detection.MISS} | ${cell(s.sanitization.removed, d)} | ${s.sanitization['partial-leak']} | ${s.sanitization.leaked} | ${failed} |`);
  }
  lines.push('', '### Sanitization by the action of the findings on the span', '');
  lines.push('| Segment | none: leaked | warn/allow only: leaked | redact/block: removed / partial / leaked | mixed: removed / partial / leaked | Output leaked bytes / secret bytes | Plaintext still in output |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [key, s] of span) {
    const c = s.sanitizationByActionClass;
    const trio = (x: any) => `${x.removed} / ${x['partial-leak']} / ${x.leaked}`;
    lines.push(`| \`${key}\` | ${c.none.leaked} | ${c['non-destructive'].leaked} | ${trio(c.destructive)} | ${trio(c.mixed)} | ${s.outputLeakedBytes} / ${s.secretBytes} | ${s.plaintextInOutput} |`);
  }
  lines.push('', '### Collateral in positive files (out-of-envelope diagnostics, not true negatives)', '');
  lines.push('| Segment | Files | Files with out-of-envelope findings | Out-of-envelope findings by action | Output bytes replaced outside envelopes | v4 collateral bytes |');
  lines.push('| --- | ---: | ---: | --- | ---: | ---: |');
  for (const [key, s] of span) {
    const actions = Object.entries(s.collateral.outOfEnvelopeFindings).map(([a, n]) => `${a} ${n}`).join(', ') || '—';
    lines.push(`| \`${key}\` | ${s.files} | ${s.collateral.filesWithOutOfEnvelopeFindings} | ${actions} | ${s.collateral.outputCollateralBytes} | ${s.v4.collateralBytes} |`);
  }

  lines.push('', '## File units (must-not-flag)', '');
  lines.push('`clean` is the true-negative diagnostic; any finding is the false-positive diagnostic, split by the strongest action it carried. Family strata (a declared contract, including twins read globally here) and global untargeted controls are separate rows and never share a denominator.', '');
  lines.push('| Segment | Files | Clean | Flagged: warn/allow only | Flagged: redact/block | Strongest action | Flagged: own family or unattributed / other family only | v4 flagged (twin-scoped) | Failed |');
  lines.push('| --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: |');
  for (const [key, s] of file) {
    const d = s.eligibleFiles;
    const failed = Object.values<number>(s.failedFiles).reduce((a, b) => a + b, 0);
    const strongest = Object.entries(s.strongestAction).map(([a, n]) => `${a} ${n}`).join(', ') || '—';
    lines.push(`| \`${key}\` | ${d} | ${cell(s.states.clean, d)} | ${s.states['flagged-non-destructive']} | ${s.states['flagged-destructive']} | ${strongest} | ${s.stratum.scope === 'family' ? `${s.flaggedAttribution['own-or-unattributed']} / ${s.flaggedAttribution['other-family-only']}` : 'n/a'} | ${s.v4.flaggedFiles} | ${failed} |`);
  }

  const leaking = span.flatMap(([key, s]) => Object.entries<any>(s.families ?? {})
    .filter(([, f]) => f.sanitization.leaked + f.sanitization['partial-leak'] > 0).map(([family, f]) => `| \`${key}\` | ${family} | ${f.eligibleSpans} | ${f.sanitization['partial-leak']} | ${f.sanitization.leaked} | ${f.sanitizationByActionClass['non-destructive'].leaked} |`));
  lines.push('', '## Family strata with any span left readable in the output', '');
  if (leaking.length) {
    lines.push('| Segment | Family | Spans | Partial leak | Leaked | of which warn/allow only |', '| --- | --- | ---: | ---: | ---: | ---: |', ...leaking);
  } else lines.push('None.');
  const flagged = file.flatMap(([key, s]) => Object.entries<any>(s.families ?? {})
    .filter(([, f]) => f.states['flagged-destructive'] + f.states['flagged-non-destructive'] > 0).map(([family, f]) => `| \`${key}\` | ${family} | ${f.eligibleFiles} | ${f.states['flagged-non-destructive']} | ${f.states['flagged-destructive']} | ${f.flaggedAttribution['other-family-only']} | ${f.v4.flaggedFiles} |`));
  lines.push('', '## Family strata with any flagged control file', '');
  if (flagged.length) lines.push('| Segment | Family | Files | Warn/allow only | Redact/block | Other family only | v4 flagged |', '| --- | --- | ---: | ---: | ---: | ---: | ---: |', ...flagged);
  else lines.push('None.');

  lines.push('', '## v4 reference (authoritative, unchanged)', '');
  lines.push('Counts from the unchanged v4 scorer over the same findings; the diagnostics above reproduce `spans`, `leakedSpans`, `leakedBytes`, `secretBytes`, `collateralBytes`, control `files` and control `flaggedFiles` exactly (checked at generation). v4 scopes a twin\'s false alarm to its own family, so it can be lower than the any-flag file count above; the \"other family only\" column is the difference).', '');
  lines.push('| Group | Values |', '| --- | --- |');
  for (const [key, g] of Object.entries<any>(report.v4Reference)) lines.push(`| \`${key}\` | ${Object.entries(g).map(([k, v]) => `${k} ${v}`).join(' · ')} |`);
  if (Object.keys(report.pending).length) {
    lines.push('', '## Unscored (T0)', '');
    for (const [key, n] of Object.entries(report.pending)) lines.push(`- \`${key}\`: ${n} files, never scored`);
  }
  return `${lines.join('\n')}\n`;
}
