// @vitest-environment node
/**
 * Which pipeline the PII evaluation is authoritative from (#666): the one committed value, read by one service. The committed value is never
 * asserted: a test chooses the authority in an overlay root, so the suite means the same before and after any switch. Every authorisation here
 * is a synthetic fixture of the validator and never an acceptance. The PII authority is independent of the credential one.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AUTHORITY_FILE, PII_AUTHORITY_FILE, REAL_ROOT, authorityFile, edited, overlay, piiAuthorityFile } from './overlay';

beforeEach(() => { vi.unstubAllEnvs(); });

async function modules(root: string) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  return { authority: await import('../../services/pii-authority'), domains: await import('../../services/domains') };
}

describe('loadPiiAuthority', () => {
  test('the committed file is valid and names one of the two pipelines, with every exit criterion listed', async () => {
    const { authority } = await modules(REAL_ROOT);
    const state = await authority.loadPiiAuthority();
    expect(['legacy', 'new']).toContain(state.authority);
    expect(state.from).toBe('committed');
    expect(state.total).toBeGreaterThan(0);
    expect(state.unmet.length).toBeLessThanOrEqual(state.total);
  });

  test.each(['legacy', 'new'] as const)('a root pinned to %s reads %s', async value => {
    const { authority } = await modules(overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile(value) }));
    await expect(authority.loadPiiAuthority()).resolves.toMatchObject({ authority: value, from: 'committed' });
  });

  test('the public criteria are counted apart from the protected path, which never counts against them', async () => {
    const { authority } = await modules(overlay({ [PII_AUTHORITY_FILE]: edited(PII_AUTHORITY_FILE, f => { f.exitCriteria.forEach((c: { scope: string; state: string }) => { c.state = c.scope === 'protected' ? 'unmet' : 'met'; }); }) }));
    const state = await authority.loadPiiAuthority();
    expect(state.unmet).toEqual([]);
    expect(state.total).toBe(7);
    expect(state.protectedPending).toEqual(['protected-path-live']);
  });

  test('an absent file means legacy', async () => {
    const { authority } = await modules(overlay({ [PII_AUTHORITY_FILE]: null }));
    await expect(authority.loadPiiAuthority()).resolves.toMatchObject({ authority: 'legacy', from: 'default', file: undefined, refusal: null });
  });

  test.each([
    ['not JSON', '{'],
    ['an unknown value', edited(PII_AUTHORITY_FILE, f => { f.authority = 'both'; })],
    ['a missing criterion', edited(PII_AUTHORITY_FILE, f => { f.exitCriteria.pop(); })],
  ])('a malformed file fails the build rather than selecting a pipeline: %s', async (_name, text) => {
    const { authority } = await modules(overlay({ [PII_AUTHORITY_FILE]: text }));
    await expect(authority.loadPiiAuthority()).rejects.toThrow();
  });

  test('new without an owner authorisation is refused with the reason, and a credential setting does not change that', async () => {
    const root = overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile('new', false), [AUTHORITY_FILE]: authorityFile('new') });
    const { authority } = await modules(root);
    const state = await authority.loadPiiAuthority();
    expect(state.authority).toBe('new');
    expect(state.refusal).toMatch(/no owner authorisation is recorded/);
    expect(state.refusal).toMatch(/credential authority setting is not authorisation for PII/);
  });
});

describe('the PII evaluation under each authority', () => {
  test('legacy carries its stamp: the legacy source, the criteria still unmet and who decides, and the evaluation is otherwise the committed one', async () => {
    const { domains } = await modules(overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile('legacy') }));
    const pii = await domains.loadPiiEvaluation();
    expect(pii.authority.authority).toBe('legacy');
    expect(pii.authority.source).toMatch(/benchmark-owned scorer/);
    expect(pii.authority.total).toBe(7);
    expect(pii.authority.decidedBy).toMatch(/owner/);
    expect(pii.state).not.toBe('not-recorded');
  });

  test('new is not recorded without an authorisation, says so, and never falls back to the legacy evaluation', async () => {
    const { domains } = await modules(overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile('new', false) }));
    const pii = await domains.loadPiiEvaluation();
    expect(pii.state).toBe('not-recorded');
    if (pii.state !== 'not-recorded') throw new Error('unreachable');
    expect(pii.reason).toMatch(/no owner authorisation is recorded/);
    expect(pii.authority.authority).toBe('new');
  });

  test('an authorised new reads the pii-eval measurement from the committed durable copies when nothing is published, with the product unbound', async () => {
    const { domains } = await modules(overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile('new') }));
    const pii = await domains.loadPiiEvaluation();
    expect(pii.authority.authority).toBe('new');
    expect(pii.state).not.toBe('not-recorded');
    if (pii.state === 'not-recorded') throw new Error('unreachable');
    expect(pii.piiEvalMeasurement?.populations.length).toBeGreaterThan(0);
    expect(pii.piiEvalMeasurement?.populations.every(p => p.productProjection && p.productBinding.state === 'publication-product-not-measured')).toBe(true);
  });

  test('new whose committed copies do not validate is not recorded and never falls back to the legacy evaluation', async () => {
    const copy = 'benchmarks/pii-eval-official-run/oracle-plan.public-synthetic-artifact.json';
    const { domains } = await modules(overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile('new'), [copy]: '{}' }));
    const pii = await domains.loadPiiEvaluation();
    expect(pii.state).toBe('not-recorded');
    if (pii.state !== 'not-recorded') throw new Error('unreachable');
    expect(pii.reason).toMatch(/did not validate/);
    expect(pii.authority.authority).toBe('new');
  });

  test('the rollback: flipping the value to new and back to legacy restores the legacy evaluation byte for byte', async () => {
    const legacy = JSON.stringify(await (await modules(overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile('legacy') }))).domains.loadPiiEvaluation());
    const flipped = (await (await modules(overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile('new', false) }))).domains.loadPiiEvaluation());
    expect(flipped.state).toBe('not-recorded');
    const rolledBack = JSON.stringify(await (await modules(overlay({ [PII_AUTHORITY_FILE]: piiAuthorityFile('legacy') }))).domains.loadPiiEvaluation());
    expect(rolledBack).toBe(legacy);
  });

  test('the credential authority is not an input: the legacy PII evaluation is the same under either credential value', async () => {
    const a = JSON.stringify(await (await modules(overlay({ [AUTHORITY_FILE]: authorityFile('legacy') }))).domains.loadPiiEvaluation());
    const b = JSON.stringify(await (await modules(overlay({ [AUTHORITY_FILE]: authorityFile('new') }))).domains.loadPiiEvaluation());
    expect(b).toBe(a);
  });
});
