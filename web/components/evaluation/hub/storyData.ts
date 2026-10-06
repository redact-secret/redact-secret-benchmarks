import type { EvaluationHubProps } from './EvaluationHub';
import type { HubMethod, HubPhase, HubRunData, HubScanner } from './types';

/** Synthetic values for stories: the shape of a run, never a recorded count. */
export const pendingPhases: HubPhase[] = [
  { label: 'Scanners', title: 'What did each scanner record?', description: 'One scanner at a time, across every evaluation method.', action: 'Not in this build yet' },
  { label: 'Release candidate', title: 'What changed in the release candidate?', description: 'A pinned candidate read against the published release.', action: 'Not in this build yet' },
  { label: 'Personal data', title: 'How is personal data evaluated?', description: 'The personal-data domain: its families, fixtures and what was recorded.', action: 'Not in this build yet' },
  { label: 'Credentials', title: 'How are credentials evaluated?', description: 'The credential domain: its families, fixtures and what was recorded.', action: 'Not in this build yet' },
];

export const builtPhases: HubPhase[] = [
  { href: '/evaluation/scanner/', label: 'Scanners', title: 'What did each scanner record?', description: 'One scanner at a time, across every evaluation method.', action: 'Scanners →' },
  { href: '/evaluation/rc/', label: 'Release candidate', title: 'What changed in the release candidate?', description: 'A pinned candidate read against the published release.', action: 'Release candidate →' },
  { href: '/evaluation/pii/', label: 'Personal data', title: 'How is personal data evaluated?', description: 'The personal-data domain: its families, fixtures and what was recorded.', action: 'Personal data →' },
  { href: '/evaluation/credential/', label: 'Credentials', title: 'How are credentials evaluated?', description: 'The credential domain: its families, fixtures and what was recorded.', action: 'Credentials →' },
];

export const methods: HubMethod[] = [
  { id: 'twin', href: '/evaluation/method/twin/', name: 'Twin', question: 'Does the scanner tell a secret from its harmless twin?', fact: '120 pairs' },
  { id: 'benign', href: '/evaluation/method/benign/', name: 'Benign', question: 'Does the scanner leave harmless look-alikes alone?', fact: '90 controls' },
  { id: 'metamorphic', href: '/evaluation/method/metamorphic/', name: 'Metamorphic', question: 'Does a scanner find the same thing when only the surrounding text changes?', fact: '300 source cases' },
  { id: 'mutation', href: '/evaluation/method/mutation/', name: 'Mutation', question: 'Does a scanner still find a value that was altered but is still valid?', fact: '300 source cases' },
  { id: 'differential', href: '/evaluation/method/differential/', name: 'Differential', question: 'Where does another scanner report something different from redact-secret?', fact: '400 inputs' },
  { id: 'holdout', href: '/evaluation/method/holdout/', name: 'Holdout', question: 'Did the frozen candidate run its holdout cases?', fact: '12 cases' },
];

export const noFacts: HubMethod[] = methods.map(m => ({ ...m, fact: undefined }));

export const scanners: HubScanner[] = [
  { id: 'redact-secret', name: 'redact-secret', version: '1.2.3', mode: 'Published npm package · default detectors', observed: 'Fresh, 2026-10-01', status: 'complete' },
  { id: 'scanner-b', name: 'scanner-b', version: '4.5.6', mode: 'Directory scan · default rules', observed: 'Fresh, 2026-10-01', status: 'complete' },
  { id: 'scanner-c', name: 'scanner-c', version: '7.8.9', mode: 'Filesystem scan · verification disabled', observed: 'Snapshot, 2026-09-28', status: 'complete' },
  { id: 'scanner-d', name: 'scanner-d', version: '0.1.0', mode: 'Published npm package · secrets-only', observed: 'Snapshot, 2026-09-28', status: 'unavailable' },
];

export const recordedRun: Extract<HubRunData, { state: 'recorded' }> = {
  state: 'recorded',
  title: 'The run behind these pages',
  description: 'Run 0a1b2c3d, finished 2026-10-01, from revision 1a2b3c4. The method pages read this one run, so it is stated here and not on each page. Holdout reads a separate qualification run.',
  scanners,
};

export const missingRun: HubRunData = {
  state: 'not-measured',
  title: 'The run behind these pages',
  description: 'Every method page except holdout reads one evaluation run.',
  reason: 'public/results/evaluation-bundle-v1.json is absent: no evaluation was published for this checkout.',
  command: 'npm run eval:discover\nnpm run eval:publish',
};

export const hubArgs: EvaluationHubProps = {
  eyebrow: 'EVALUATION',
  title: 'How the evaluation reads a scanner',
  lede: 'Six methods read the same synthetic inputs in different ways: authored pairs, harmless look-alikes, changed context, altered values, one scanner against another, and a frozen holdout. Pick a question, or a method.',
  meta: [{ label: 'Run', value: '0a1b2c3d · 2026-10-01' }, { label: 'Accounting', value: 'v1.1' }],
  phasesLabel: 'Evaluation pages',
  phases: builtPhases,
  methodsTitle: 'The six methods',
  methodsIntro: 'Each page says how the method runs, what the run recorded for it and how to read that, then lists its exact inputs.',
  methods,
  run: recordedRun,
  principlesTitle: 'How to read every page',
  principles: [
    { title: 'Recorded, not judged', text: 'A figure is what a run recorded. This site does not rank scanners or call a result good or bad.' },
    { title: 'Read a number in its row', text: 'Every scanner reads the same synthetic inputs, and a cell is a count of one kind of check. Counts are never added across rows or scanners.' },
    { title: 'Needs review is not a score', text: 'A check whose expected outcome is unresolved is counted apart. It is neither passed nor failed.' },
    { title: 'A peer is not ground truth', text: 'Where two scanners differ, the difference is evidence to read, not a vote.' },
  ],
};
