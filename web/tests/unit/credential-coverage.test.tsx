import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CredentialCoverageInput } from '../../services/credential-coverage';
import { resolveCredentialCoverage } from '../../resolvers/credential-coverage';
import { CredentialCoverage } from '../../components/coverage/credential';
import { resolveCredentialMethodology } from '../../resolvers/credential-methodology';
import { CredentialMethodology } from '../../components/evaluation/credential';
import { view } from '../../components/evaluation/domain/storyData';

const input = (over: Record<string, unknown> = {}): CredentialCoverageInput => ({
  evaluation: {
    pipeline: { authority: 'legacy', from: 'committed' }, run: { state: 'not-published', reason: 'synthetic missing run' },
    catalog: { taxonomy: { providers: [{ id: 'sample', name: 'Sample provider' }], families: [
      { id: 'sample:token', provider: 'sample', name: 'Sample token', description: 'A source format.', detectors: ['sample-token'] },
      { id: 'sample:absent', provider: 'sample', name: 'Research pending', description: 'No declaration.', detectors: [] },
    ] }, fixturesByFamily: new Map([['sample:token', [{}]]]) },
    support: undefined,
  },
  scope: { boundTo: { release: 'example.1', revision: 'a'.repeat(40), mode: 'default', check: 'Synthetic source equality check.' },
    readAt: 'b'.repeat(40), statements: [{ kind: 'product-scope', text: 'Encoded carriers are not decoded.' }] }, dossiers: new Map(), ...over,
} as unknown as CredentialCoverageInput);

describe('source-bound credential coverage', () => {
  test('taxonomy mappings and fixture-bearing rows do not manufacture a capability declaration', () => {
    const data = resolveCredentialCoverage(input());
    expect(data.counts.map(row => row.value)).toEqual(['2', 'Not recorded', '1', 'Not recorded']);
    expect(data.providers[0].rows.every(row => row.declaration.startsWith('Unknown:'))).toBe(true);
    expect(data.providers[0].rows.every(row => !row.qualificationHref)).toBe(true);
    expect(data.binding).toMatch(/^Unknown:/);
  });

  test.each([['different release', 'example.2', 'default'], ['different configuration', 'example.1', 'custom']])('%s retains the scope as historical', (_, version, mode) => {
    const source = input();
    source.evaluation.run = { state: 'measured', mode: 'candidate', scanners: [{ id: 'redact-secret', version, mode }] } as never;
    const data = resolveCredentialCoverage(source);
    expect(data.binding).toMatch(/^Historical scope:/);
    expect(data.release).toContain('Candidate, unreleased');
    expect(data.providers[0].rows[0].declaration).toMatch(/^Unknown:/);
  });

  test('a current scope binding does not become family qualification', () => {
    const source = input();
    source.evaluation.run = { state: 'measured', mode: 'published', scanners: [{ id: 'redact-secret', version: 'example.1', mode: 'default' }] } as never;
    expect(resolveCredentialCoverage(source).binding).toMatch(/^Current:/);
    expect(resolveCredentialCoverage(source).providers[0].rows[0].qualification).toMatch(/^Not recorded/);
  });

  test('only the same authority-approved run, release and configuration can supply a family classification', () => {
    const source = input();
    source.evaluation.pipeline = { authority: 'new', from: 'committed', view: { state: 'ready', commands: [] } };
    source.evaluation.run = { state: 'measured', mode: 'published', scanners: [{ id: 'redact-secret', version: 'example.1', mode: 'default' }],
      official: { population: 'synthetic', semanticDigest: 'run-a', scanners: [{ id: 'redact-secret', version: 'example.1', configurationHash: 'config-a' }] } } as never;
    source.qualification = { state: 'ready', view: { populations: [{ population: 'synthetic', artifact: { semanticDigest: 'run-a', scanners: [{ id: 'redact-secret', version: 'example.1', configurationHash: 'config-a' }] } }],
      families: [{ family: 'sample-token', taxonomyFamilies: [{ id: 'sample:token' }], status: { value: 'unsupported', qualificationProfile: null }, contract: { supportedContext: ['literal'] } }] } } as never;
    expect(resolveCredentialCoverage(source).providers[0].rows[0].qualification).toBe('sample-token: unsupported');
    expect(resolveCredentialCoverage(source).providers[0].rows[0].declaration).toMatch(/^Unknown:/);
    (source.qualification as any).view.populations[0].artifact.scanners[0].configurationHash = 'other-config';
    expect(resolveCredentialCoverage(source).providers[0].rows[0].qualification).toMatch(/^Not recorded/);
    (source.qualification as any).view.populations[0].artifact.scanners[0].configurationHash = 'config-a';
    (source.qualification as any).view.populations[0].artifact.semanticDigest = 'other-run';
    expect(resolveCredentialCoverage(source).providers[0].rows[0].qualification).toMatch(/^Not recorded/);
    source.evaluation.pipeline.authority = 'legacy';
    expect(resolveCredentialCoverage(source).providers[0].rows[0].qualification).toMatch(/^Not recorded/);
  });

  test('renders unknown states, full inventory and reciprocal methodology links', () => {
    render(<CredentialCoverage {...resolveCredentialCoverage(input())} />);
    expect(screen.getByRole('link', { name: 'How credentials are evaluated' })).toHaveAttribute('href', '/evaluation/credential/');
    expect(screen.getByRole('link', { name: 'full family inventory' })).toHaveAttribute('href', '/report/families/');
    expect(screen.getByText('Family declarations are not recorded')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'bounded credential policy contract' })).toHaveAttribute('href', expect.stringContaining('/benchmarks/support/policy-qualified-credentials.json'));
    expect(screen.getByText(/outside-contract matches are unknown or incidental/)).toBeInTheDocument();
  });
});

describe('credential methodology projection', () => {
  test('keeps source definitions and limits without result inventories or mutable count summaries', () => {
    const data = resolveCredentialMethodology(view);
    expect(data).not.toHaveProperty('coverage');
    expect(data).not.toHaveProperty('glance');
    expect(data.reading).toBe(view.reading);
    expect(data.method.recorded.text).toContain('protected holdout');
    expect(data.method.methods.map(row => row.term)).toEqual(['twin', 'benign', 'mutation', 'metamorphic', 'differential', 'holdout']);
    render(<CredentialMethodology {...data} />);
    for (const repo of ['credential-evidence', 'credential-eval', 'benchmarks', 'redact-secret']) {
      expect(screen.getByRole('link', { name: repo })).toHaveAttribute('href', repo === 'benchmarks' ? 'https://github.com/redact-secret/redact-secret-benchmarks' : `https://github.com/redact-secret/${repo}`);
    }
    expect(screen.getByRole('link', { name: /Open credential coverage/ })).toHaveAttribute('href', '/coverage/credential/');
    expect(screen.getByRole('link', { name: 'qualification rationale and exclusions' })).toHaveAttribute('href', expect.stringContaining('/docs/specs/policy-qualified-credentials.md'));
    expect(screen.getByText(/independent benign\/twin controls/)).toBeInTheDocument();
  });
});
