/**
 * The landing page (`/`): the question the site answers, one illustrated reading, the three places that answer it and the
 * rules of the benchmark. Pure: counts and the build line come in from `resolvers/pages.ts`; nothing here knows a ledger value,
 * and a figure that was not supplied is left out of the sentence it would have been in.
 *
 * The two examples are illustrations of how a result is read, not recorded rows (a recorded row's bytes are not held by the
 * qualification view), so the page says so and shows no scanner's output. They are synthetic: the credential is assembled from
 * parts at module load, so no token-shaped literal sits in the repository (push protection, gitleaks) and none was ever issued.
 */
import type { Question, Rule, SpecimenExample, SpecimenLine } from '../components/landing/types';
import { int, isoDate } from './format';

export interface LandingInputs {
  /** Credential families in the catalog the pages were built from, or null when there is none. */
  families: number | null;
  /** Personal-data kinds the PII evidence records, or null when it did not validate. */
  piiKinds: number | null;
}

export interface BuildInputs {
  /** `redact-secret` version, or null. */
  version: string | null;
  /** Set when the run measured an unreleased candidate. */
  candidateCommit: string | null;
  inputs: number | null;
  /** An ISO timestamp or date of the run. */
  generatedAt: string | null;
}

export interface LandingData {
  eyebrow: string;
  headline: { before: string; emphasis: string; after: string };
  lede: { before: string; strong: string; after: string };
  caveat: { label: string; text: string };
  specimen: { eyebrow: string; choiceLabel: string; replayLabel: string; examples: SpecimenExample[] };
  questionsLabel: string;
  questions: Question[];
  rulesLabel: string;
  rules: Rule[];
}

const bytes = (text: string): number => new TextEncoder().encode(text).length;

/** The byte range the expected secret occupies in the lines, joined by newlines: `bytes 48-141` (end exclusive). */
export function expectedRange(lines: SpecimenLine[]): string {
  let offset = 0;
  for (const line of lines) {
    if (typeof line !== 'string') {
      const start = offset + bytes(line.before);
      return `bytes ${start}–${start + bytes(line.secret)}`;
    }
    offset += bytes(line) + 1;
  }
  return 'not present';
}

/** A fine-grained-token-shaped string that was never issued: the shape, a visible EXAMPLE and filler. Assembled so it is not a literal here. */
export const syntheticToken = (): string => ['github', 'pat', '11EXAMPLE'.padEnd(22, '0'), 'X'.repeat(59)].join('_');

function examples(): SpecimenExample[] {
  const credentialLines: SpecimenLine[] = [
    'provider "github" {',
    '  owner = "acme"',
    { before: '  token = "', secret: syntheticToken(), after: '"' },
    '}',
  ];
  const personalLines: SpecimenLine[] = [
    'Subject: refund for order 48213',
    '',
    { before: 'Hi, please send the receipt to ', secret: 'mina.park@sample-mail.test', after: ' instead.' },
    'Thanks!',
  ];
  return [
    {
      id: 'credential', label: 'Credential', name: 'example/provider.tf', lines: credentialLines, expected: expectedRange(credentialLines), result: 'Exact',
      caption: 'A synthetic token in a Terraform block. The dashed box is the answer written in advance; the solid bar is a redaction of exactly those bytes, which the report calls Exact. An illustration of the reading, not a recorded row.',
    },
    {
      id: 'personal', label: 'Personal data', name: 'example/support-ticket.txt', lines: personalLines, expected: expectedRange(personalLines), result: 'Exact',
      caption: 'A synthetic support message with an email address. The same reading: the answer first, then the bytes a scanner removed. An illustration of the reading, not a recorded row.',
    },
  ];
}

/** "152 credential families and 6 kinds of personal data", or the part that is known, or nothing. */
export function scopeText({ families, piiKinds }: LandingInputs): string {
  const parts = [
    families === null ? null : `${int(families)} credential ${families === 1 ? 'family' : 'families'}`,
    piiKinds === null ? null : `${int(piiKinds)} ${piiKinds === 1 ? 'kind' : 'kinds'} of personal data`,
  ].filter((p): p is string => p !== null);
  return parts.join(' and ');
}

/** The footer's run line: `redact-secret 0.1.0-beta.11 · 5,034 inputs · run 2026-09-30`, each part left out when unknown; null when none is known. */
export function buildLine(b: BuildInputs | null): string | null {
  if (!b) return null;
  const date = isoDate(b.generatedAt ?? undefined);
  const product = b.candidateCommit ? `redact-secret candidate ${b.candidateCommit.slice(0, 7)} (unreleased)` : b.version ? `redact-secret ${b.version}` : null;
  const parts = [product, b.inputs === null ? null : `${int(b.inputs)} inputs`, date ? `run ${date}` : null].filter((p): p is string => p !== null);
  return parts.length ? parts.join(' · ') : null;
}

export function resolveLanding(inputs: LandingInputs): LandingData {
  const scope = scopeText(inputs);
  return {
    eyebrow: 'Open benchmark for redact-secret',
    headline: { before: 'How exactly does it find', emphasis: 'secrets', after: '?' },
    lede: {
      before: 'This site measures one thing: how accurately and how efficiently redact-secret finds credentials and personal data in text, ',
      strong: 'byte for byte',
      after: ', on synthetic inputs whose answers were written before any scanner ran. The numbers on the pages link to the rows behind them.',
    },
    caveat: { label: 'Not a ranking', text: 'Other tools run on the same inputs for reference. They are listed, never scored against each other.' },
    specimen: { eyebrow: 'How one input is read', choiceLabel: 'Example', replayLabel: 'Replay', examples: examples() },
    questionsLabel: 'What the benchmark answers',
    questions: [
      {
        href: '/report/', kicker: 'Accuracy', title: 'Does it hide every secret, and only secrets?',
        text: `Missed bytes, false alarms and near-twins it must tell apart${scope ? `, for ${scope}` : ''}.`, action: 'Read the report →',
      },
      {
        href: '/comparison/performance/', kicker: 'Efficiency', title: 'How long does it take on real-shaped text?',
        text: 'Time across sizes, shapes and text built to slow scanners down, shown as absolute times.', action: 'See performance →',
      },
      {
        href: '/evaluation/', kicker: 'Method', title: 'How do we know the answers are right?',
        text: 'Six evaluation methods, pinned scanner versions, a review ledger and a look at each release candidate.', action: 'See how it is evaluated →',
      },
    ],
    rulesLabel: 'The rules of the benchmark',
    rules: [
      { strong: 'Same inputs', rest: ' for every tool' },
      { strong: 'Answers written first', rest: ', then scanners run' },
      { strong: 'Pinned versions', rest: ', named machines' },
      { strong: 'Counts beside every rate', rest: '' },
    ],
  };
}
