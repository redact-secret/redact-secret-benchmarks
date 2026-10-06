/**
 * The words of the evaluation pages: what each method is, how it runs, how to read what it records. Static
 * copy, written once here so a page never repeats another page's sentence. Neutral by rule (boundary rule):
 * it states what a check asks and what a number counts, never that a result is good or bad, and never ranks.
 * Decision: docs/decisions/2026-10-01-show-each-evaluation-method-in-one-fixed-order.md.
 */
import type { MethodId } from '../lib/methods';

export interface MethodCopy {
  name: string;
  /** The question the method answers, as a reader would ask it. */
  question: string;
  /** One or two sentences under the title: what the method is. */
  lede: string;
  /** How it runs, in the same three labelled steps for every method. */
  input: string;
  change: string;
  check: string;
  /** What the one number in the table is, said once under the table. */
  cellMeaning: string;
  /** What is specific to reading this method. The rules every method shares are on the overview. */
  read: string[];
  /** The noun a count of this method's cases takes: "pairs", "controls". */
  unit: { one: string; other: string };
}

export const METHOD_COPY: Record<MethodId, MethodCopy> = {
  twin: {
    name: 'Twin',
    question: 'Does the scanner tell a secret from its harmless twin?',
    lede: 'Each case is an authored pair: a value that should be redacted, and the same text with one authored change that makes it not a secret. A scanner has to treat the two sides differently.',
    input: 'An authored pair: a positive text and its negative twin.',
    change: 'One authored change turns the secret into something that is not one.',
    check: 'The positive side is detected within its expected envelope, the twin is left alone, and the pair flips between the two.',
    cellMeaning: 'Checks that did not hold, of those scored for that scanner.',
    read: [
      'The first row is the pair as a whole. The next two are its sides, so a pair that was not told apart shows up in at least one of them.',
      'A pair with a side whose expected outcome is unresolved (tier T0) is counted apart and in none of these rows.',
    ],
    unit: { one: 'pair', other: 'pairs' },
  },
  benign: {
    name: 'Benign',
    question: 'Does the scanner leave harmless look-alikes alone?',
    lede: 'Controls that resemble secrets but are not: placeholders, references, near misses, public identifiers, encoded values and ordinary text. None is transformed. Each should produce no finding.',
    input: 'A control from a named taxonomy, read as authored.',
    change: 'None. The control is not transformed.',
    check: 'The scanner reports nothing on it. A control is counted once per scanner, however many findings it gets.',
    cellMeaning: 'Controls flagged, of the controls in that taxonomy.',
    read: [
      'The taxonomy rows split one set of controls, so read a number inside its row. They are not added up here.',
      'Real-world-shaped controls are measured apart from every family: a flag there is discovery evidence about ordinary content, not about a family. A warn-only finding on ordinary prose is accepted by the product policy, so the last group separates the actions that gate from the ones that only warn.',
    ],
    unit: { one: 'control', other: 'controls' },
  },
  metamorphic: {
    name: 'Metamorphic',
    question: 'Does a scanner find the same thing when only the surrounding text changes?',
    lede: 'A transform changes the context around a value (a prefix, indentation, line endings, a JSON, YAML, Markdown or quoted wrapper) and nothing else. The scanner should detect the same thing as it did on the original text.',
    input: 'A source case, read once as authored and once per transform.',
    change: 'A context or encoding operator wraps or re-encodes the text. The value is not changed.',
    check: 'The detection after the transform equals the detection before it (same-detection). The transformed text is also read on its own.',
    cellMeaning: 'Transformed texts where the check did not hold, of those scored for that scanner.',
    read: [
      'A scanner that missed the value on both sides holds the relation, so the second group reads the transformed text on its own. Together they tell the two cases apart.',
      'A source with an unresolved expectation (tier T0) is counted apart and in none of these rows.',
    ],
    unit: { one: 'source case', other: 'source cases' },
  },
  mutation: {
    name: 'Mutation',
    question: 'Does a scanner still find a value that was altered but is still valid?',
    lede: 'An operator alters the secret itself: its length, its last or first character, its alphabet, a delimiter or a segment. Whether the altered value is still a secret depends on the format contract, and the result is scored only where the contract says it is.',
    input: 'A source case with a single secret in a known format.',
    change: 'A lexical, boundary or structural operator alters the value.',
    check: 'Where the altered value still matches the format contract, the scanner is expected to detect it as before. Where it no longer matches, the expectation is deferred and nothing is scored.',
    cellMeaning: 'Altered values where the check did not hold, of those scored for that scanner.',
    read: [
      'Most altered values no longer match the format. Those are deferred to review, because a scanner may reasonably report a valid substring or ignore the value.',
      'The authored pairs in this method are the twin method. They are not repeated here.',
    ],
    unit: { one: 'source case', other: 'source cases' },
  },
  differential: {
    name: 'Differential',
    question: 'Where does another scanner report something different from redact-secret?',
    lede: 'The canonical input of each case is read by redact-secret and by each peer, and the ranges each one reports are compared. A difference is review evidence. A peer is not ground truth and a difference is not a failure of either tool.',
    input: 'The canonical input of each case, unchanged.',
    change: 'None.',
    check: 'redact-secret and the peer report the same ranges, or they differ in one of the stated ways. A difference is queued for review.',
    cellMeaning: 'Inputs that fell in that row, of the inputs both tools completed.',
    read: [
      'Rows are exclusive: an input falls in one of the first five rows. The classification rows are a second view of the same inputs, not more of them.',
      'Family classification can be not comparable even when the ranges compare, for instance when a family is not mapped.',
    ],
    unit: { one: 'input', other: 'inputs' },
  },
  holdout: {
    name: 'Holdout',
    question: 'Did the frozen candidate run its holdout cases?',
    lede: 'Frozen cases run in isolation against a frozen candidate. Only aggregate counts cross the publication boundary, so there is no case to open. Execution-qualified means the infrastructure ran its contract, not that a scanner detects well.',
    input: 'Frozen public control cases, sealed at execution.',
    change: 'None.',
    check: 'Each scanner is read against the cases once. Counts are kept per stratum: the expected kind and tier.',
    cellMeaning: 'Checks that did not hold, of those scored for that scanner.',
    read: [
      'This page reads a qualification run, which is a separate snapshot from the discovery run the other methods read.',
      'Public controls cannot establish independent detector performance, and the aggregate has no detector attribution or unique affected cases.',
    ],
    unit: { one: 'case', other: 'cases' },
  },
};

/** What each operator changes, in a clause. Keyed by the operator id the report carries. */
export const OPERATOR_COPY: Record<string, string> = {
  'authored.twin': 'An authored change that turns the secret into its negative twin',
  'context.unicode-prefix': 'Puts a line of non-ASCII text before the value',
  'context.indent': 'Indents the text by four spaces',
  'encoding.crlf': 'Changes line endings to CRLF',
  'context.json': 'Wraps the value as a JSON string',
  'context.quote': 'Wraps the value in double quotes',
  'context.single-quote': 'Wraps the value in single quotes',
  'context.yaml': 'Wraps the value as a YAML scalar',
  'context.markdown': 'Wraps the value in inline code',
  'lexical.length-minus-one': 'Drops the last character of the secret',
  'lexical.length-plus-one': 'Appends one character to the secret',
  'lexical.replace-last': 'Replaces the last character of the secret',
  'lexical.invalid-alphabet': 'Replaces the last character with one outside the format',
  'lexical.prefix-change': 'Replaces the first character of the secret',
  'boundary.remove-delimiter': 'Removes one delimiter (dot, underscore or hyphen) from the secret',
  'structural.remove-segment': 'Removes one delimited segment (SendGrid and Slack token formats only)',
};

/** The commands that write the evaluation bundle (public/results/evaluation-bundle-v1.json), named wherever a page has nothing to show without it. */
export const EVAL_COMMANDS = 'npm run eval:discover\nnpm run eval:publish';

export const HUB_COPY = {
  eyebrow: 'EVALUATION',
  title: 'How the evaluation reads a scanner',
  lede: 'Six methods read the same synthetic inputs in different ways: authored pairs, harmless look-alikes, changed context, altered values, one scanner against another, and a frozen holdout. Pick a question, or a method.',
  phasesLabel: 'Evaluation pages',
  methodsTitle: 'The six methods',
  methodsIntro: 'Each page says how the method runs, what the run recorded for it and how to read that, then lists its exact inputs.',
  principlesTitle: 'How to read every page',
  principles: [
    { title: 'Recorded, not judged', text: 'A figure is what a run recorded. This site does not rank scanners or call a result good or bad.' },
    { title: 'Read a number in its row', text: 'Every scanner reads the same synthetic inputs, and a cell is a count of one kind of check. Counts are never added across rows or scanners.' },
    { title: 'Needs review is not a score', text: 'A check whose expected outcome is unresolved is counted apart. It is neither passed nor failed.' },
    { title: 'A peer is not ground truth', text: 'Where two scanners differ, the difference is evidence to read, not a vote.' },
  ],
};
