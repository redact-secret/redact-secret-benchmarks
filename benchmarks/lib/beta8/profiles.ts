import type { Fixture, FixtureProfile } from '../../types.ts';

/**
 * Advisory Beta.8 fixture-profile counts. The thresholds transcribe #206's
 * draft profiles so #207–#212 can report where each family stands; #206 owns
 * the machine-readable, versioned criteria and the fail-closed classification
 * gate. Nothing here changes a support status.
 */
export const PROFILE_FLOORS: Record<FixtureProfile, { total: number; positives: number; controls: number; twinPairs: number; contextTwinPairs: number; positiveAxes: number; controlAxes: number }> = {
  'arrival-24': { total: 24, positives: 6, controls: 8, twinPairs: 5, contextTwinPairs: 0, positiveAxes: 4, controlAxes: 4 },
  'documented-24': { total: 24, positives: 6, controls: 8, twinPairs: 5, contextTwinPairs: 0, positiveAxes: 4, controlAxes: 4 },
  'empirical-40': { total: 40, positives: 10, controls: 14, twinPairs: 8, contextTwinPairs: 0, positiveAxes: 6, controlAxes: 5 },
  // Context-constrained: no bare-value claim, 10 context-twin pairs, at least 6 confusion (control) axes.
  'context-48': { total: 48, positives: 10, controls: 0, twinPairs: 10, contextTwinPairs: 10, positiveAxes: 0, controlAxes: 6 },
};

/** Positive-context vocabulary for `Fixture.contextAxis`. Serialization wrappers of one context are one axis. */
export const POSITIVE_AXES = [
  'env', 'shell-export', 'header', 'basic-auth', 'url', 'sdk-config', 'source-code', 'structured-file',
  'ci-config', 'container-config', 'prose', 'tool-output', 'log', 'cli',
] as const;

export interface ProfileFixture { category: string; fixture: Fixture; targets: string[]; controlAxis: string | null }
export interface ProfileCount {
  target: string; issue: number | string; profile: FixtureProfile; total: number; positives: number; controls: number;
  twinPairs: number; contextTwinPairs: number; positiveAxes: string[]; controlAxes: string[]; unlabeledPositives: number;
  debt: string[];
}

const isSecret = (f: Fixture) => f.expected.some(r => (r.role ?? 'secret') === 'secret');

/** Count every fixture (any category) whose targets include `target`, against its declared profile's floors. */
export function countProfile(target: string, issue: number | string, profile: FixtureProfile, all: ProfileFixture[], contextGated: boolean): ProfileCount {
  const mine = all.filter(x => x.targets.includes(target));
  const positives = mine.filter(x => isSecret(x.fixture) && !x.fixture.twinOf);
  const twins = mine.filter(x => x.fixture.twinOf);
  const controls = mine.filter(x => !isSecret(x.fixture) && !x.fixture.twinOf);
  const positiveAxes = [...new Set(positives.map(x => x.fixture.contextAxis).filter((a): a is string => Boolean(a)))].sort();
  const controlAxes = [...new Set(controls.map(x => x.controlAxis).filter((a): a is string => Boolean(a)))].sort();
  const contextTwinPairs = twins.filter(x => x.fixture.mutationKind === 'context').length;
  const floor = PROFILE_FLOORS[profile], debt: string[] = [];
  const need = (label: string, have: number, want: number) => { if (have < want) debt.push(`${label} ${have}/${want}`); };
  need('total', mine.length, floor.total);
  need('positives', positives.length, floor.positives);
  need('controls', controls.length, floor.controls);
  need('twin pairs', twins.length, floor.twinPairs);
  need('context-twin pairs', contextTwinPairs, floor.contextTwinPairs);
  need('positive axes', positiveAxes.length, floor.positiveAxes);
  need('control axes', controlAxes.length, floor.controlAxes);
  if (profile === 'context-48' && !contextGated) debt.push('context-48 needs a context-gated contract (no bare-value claim)');
  return {
    target, issue, profile, total: mine.length, positives: positives.length, controls: controls.length,
    twinPairs: twins.length, contextTwinPairs, positiveAxes, controlAxes,
    unlabeledPositives: positives.filter(x => !x.fixture.contextAxis).length, debt,
  };
}
