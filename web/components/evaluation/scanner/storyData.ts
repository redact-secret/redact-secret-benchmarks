/** Synthetic story data: made-up scanners, versions and digests. Nothing here is a ledger value. */
import type { ScannerModeNoteData, ScannerProfileData, ScannerRosterRow } from './types';

export const rosterRows: ScannerRosterRow[] = [
  { id: 'alpha-lib', name: 'Alpha Library', kind: 'Runtime library', version: '1.2.3', pinnedIn: 'package.json', mode: 'Published npm package · default detectors' },
  { id: 'beta-scan', name: 'Beta Scan', kind: 'Repository scanner', version: '4.5.6', pinnedIn: 'qualification/suite-v1.json', mode: 'Directory scan · default rules' },
  { id: 'gamma-lib', name: 'Gamma Library', kind: 'Runtime library', version: '0.9.0', pinnedIn: 'package.json', mode: 'Published npm package · secrets-only (two detector groups disabled) · JavaScript engine' },
];

export const rosterNotRecorded: ScannerRosterRow[] = rosterRows.map(r => ({ ...r, kind: null, mode: null }));

export const repositoryScanner: ScannerProfileData = {
  id: 'beta-scan',
  name: 'Beta Scan',
  version: '4.5.6',
  kind: 'Repository scanner',
  description: 'Built to find secrets in files and directories before they are committed.',
  groups: [
    {
      title: 'Install and pin',
      facts: [
        { term: 'Pinned version', value: '4.5.6', code: true, note: 'qualification/suite-v1.json' },
        { term: 'Installed from', value: 'Release archive', note: 'beta-scan_4.5.6_linux_x64.tar.gz, SHA-256 checked before it is extracted' },
        { term: 'Location', value: 'Read-only directory first on PATH', note: 'so it cannot update itself' },
      ],
    },
    {
      title: 'How it ran',
      facts: [
        { term: 'Mode line', value: 'Directory scan · default rules' },
        { term: 'Limits', value: '120 s timeout · 64 MiB output' },
        { term: 'Configuration hash', value: '0123abcd…', code: true, note: 'the same in all 3 snapshots' },
      ],
    },
    {
      title: 'Where it ran',
      facts: [
        { term: 'Binary', value: 'darwin-arm64', note: '3 snapshots, 2026-10-01' },
        { term: 'Replays', value: '2 per snapshot, ranges agreed' },
        { term: 'Host OS release, CPU, Node', value: null },
      ],
    },
    {
      title: 'Rules',
      facts: [
        { term: 'Rules', value: '222', note: 'rule file 4.5.6 · 71 target a taxonomy family' },
      ],
    },
  ],
  command: { summary: 'Exact arguments', label: 'Beta Scan arguments', text: 'dir <input-root> --no-banner --no-color --exit-code 0 --report-format json --report-path -' },
  outOfScope: ['Git history scanning: only the directory scan of the fixture files is run.', 'Custom rule files and environment rule overrides: default rules only.'],
  compared: [{ label: 'Accuracy', href: '/comparison/accuracy/?with=beta-scan' }],
};

export const runtimeLibrary: ScannerProfileData = {
  id: 'gamma-lib',
  name: 'Gamma Library',
  version: '0.9.0',
  kind: 'Runtime library',
  description: 'Built to redact secrets and personal data from text at runtime. Run secrets-only here.',
  groups: [
    {
      title: 'Install and pin',
      facts: [
        { term: 'Pinned version', value: '0.9.0', code: true, note: 'package.json, exact' },
        { term: 'Installed from', value: 'npm, gamma-lib', note: 'lockfile integrity sha512-AbCd…' },
      ],
    },
    {
      title: 'How it ran',
      facts: [
        { term: 'Mode line', value: 'Published npm package · secrets-only · JavaScript engine' },
        { term: 'Options', value: 'disable: [pii, generic]', code: true },
        { term: 'Runtime comparison call', value: 'redact(), synchronous' },
      ],
    },
    {
      title: 'Where it ran',
      facts: [
        { term: 'Runtime comparison', value: 'linux x64 · Node v22.0.0', note: 'Example CPU, 4 CPUs · 0.9.0' },
        { term: 'Accuracy snapshots', value: 'npm lockfile build', note: '3 snapshots, 2026-10-01' },
      ],
    },
    { title: 'Rules', facts: [{ term: 'Detectors', value: '81', note: 'rule file 0.9.0 · 37 target a taxonomy family' }] },
  ],
  command: null,
  outOfScope: ['Personal-data detectors: disabled for this run.', 'Engines that are not published to a registry: not measured.', 'Confidence tuning: package defaults.'],
  compared: [
    { label: 'Accuracy', href: '/comparison/accuracy/?with=gamma-lib' },
    { label: 'Runtime', href: '/comparison/runtime/' },
    { label: 'Features', href: '/comparison/feature/' },
    { label: 'Performance', href: '/comparison/performance/?with=gamma-lib' },
  ],
};

/** A scanner whose environment the repository does not describe: every group says so, and nothing is made up. */
export const notRecorded: ScannerProfileData = {
  id: 'delta-lib',
  name: 'Delta Library',
  version: '2.0.0',
  kind: null,
  description: null,
  groups: [
    { title: 'Install and pin', facts: [{ term: 'Pinned version', value: '2.0.0', code: true, note: 'package.json, exact' }, { term: 'Installed from', value: null }] },
    { title: 'How it ran', facts: [{ term: 'Mode line', value: null }, { term: 'Configuration hash', value: null }] },
    { title: 'Where it ran', facts: [{ term: 'Snapshots', value: null }, { term: 'Host OS release, CPU, Node', value: null }] },
    { title: 'Rules', facts: [{ term: 'Detectors', value: null }] },
  ],
  command: null,
  outOfScope: null,
  compared: [],
};

/** Long names, an unbroken digest and many statements: each wraps inside its column. */
export const longContent: ScannerProfileData = {
  ...runtimeLibrary,
  id: 'long-lib',
  name: 'A Scanner With A Very Long Display Name That Keeps Going',
  groups: [
    { title: 'Install and pin', facts: [{ term: 'Artifact digest', value: 'a'.repeat(64), code: true, note: 'as recorded in each of 68 snapshots, every one of them from a different surface of the benchmark' }, { term: 'Installed from', value: 'npm, @example-scope/a-package-with-a-long-name' }] },
    { title: 'How it ran', facts: [{ term: 'Arguments', value: 'filesystem <input-root> --json --no-verification --no-update --results=verified,unknown,unverified', code: true }] },
  ],
  outOfScope: Array.from({ length: 6 }, (_, i) => `Statement ${i + 1}: something this benchmark does not run for this scanner, written the way the registry words it.`),
  command: { summary: 'Exact arguments', label: 'Arguments', text: `dir <input-root> ${'--a-long-flag-value '.repeat(12)}` },
};

export const publishedNote: ScannerModeNoteData = {
  title: 'Published and candidate',
  mode: 'published',
  modeLabel: 'This run measured the released redact-secret 1.0.0.',
  paragraphs: [
    'Published measures the released npm package. Candidate measures an unreleased redact-secret build at a named commit. The other scanners run at their pinned release in both modes.',
  ],
};

export const candidateNote: ScannerModeNoteData = {
  ...publishedNote,
  mode: 'candidate',
  modeLabel: 'This run measured an unreleased redact-secret build, 1.1.0-rc.1 at commit 0123456789ab.',
};

export const noRunNote: ScannerModeNoteData = { ...publishedNote, mode: null, modeLabel: 'No benchmark run is published for this checkout, so no mode is recorded.' };
