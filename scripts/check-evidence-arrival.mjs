/**
 * CI gate for the detector evidence arrival contract (#52): a detector
 * family may not enter the corpus missing any of the evidence kinds
 * measurement-v4 requires before its numbers mean anything — provider/tool
 * evidence, canonical positives, negative twins, adversarial benign
 * controls, metamorphic cases, mutation cases, and differential
 * observation. Un-probeable dimensions are the one documented exception
 * (#33): a family with `contracts[id].unprobeable` recorded satisfies the
 * negative-twins element without an authored twin.
 *
 * This is presence, not pass rate: it answers "does the evidence exist",
 * never "did it pass". Clearing this gate is necessary for the `stable`
 * support status (benchmarks/support/status.ts), never sufficient — the
 * pass-rate floors there are a separate, later check over the same cases.
 *
 * Run: npm run arrival:check
 */
import { pathToFileURL } from 'node:url';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { contracts } from '../benchmarks/lib/assessment.ts';

const isPositive = seed => !seed.twinOf && seed.expected.some(r => (r.role ?? 'secret') === 'secret');

/** One row per required evidence kind: how to detect it, and what to tell a contributor who is missing it. */
const ELEMENTS = [
  {
    id: 'provider/tool evidence',
    present: (_family, _cases, contract) => Boolean(contract.providerSource || contract.twinSource || contract.candidateSource || contract.corroboration?.length),
    describe: family => `record a providerSource, twinSource, candidateSource, or at least one corroboration entry for "${family}" in benchmarks/lib/assessment.ts, each carrying a url, an observedAt date, and what it establishes`,
  },
  {
    id: 'canonical positives',
    present: (_family, cases) => cases.some(c => c.method === 'differential' && isPositive(c.seed)),
    describe: family => `author a fixture assigned to "${family}" carrying its documented shape in a realistic context`,
  },
  {
    id: 'negative twins',
    present: (_family, cases, contract) => Boolean(contract.unprobeable) || cases.some(c => c.method === 'twin'),
    describe: family => `author a twin fixture (twinOf + mutation + mutationKind) for "${family}", or record contracts["${family}"].unprobeable with a reason if no provider grammar exists to mutate (#33)`,
  },
  {
    id: 'adversarial benign controls',
    present: (_family, cases) => cases.some(c => c.method === 'benign'),
    describe: family => `author a control fixture assigned to "${family}" — a public identifier, placeholder, reference, or ordinary prose that must not be flagged`,
  },
  {
    id: 'metamorphic cases',
    present: (_family, cases) => cases.some(c => c.method === 'metamorphic'),
    describe: family => `assign a fixture to "${family}" that carries an encoding, whitespace, CRLF, Unicode, or chunk-boundary variant (benchmarks/operators/context.ts)`,
  },
  {
    id: 'mutation cases',
    present: (_family, cases) => cases.some(c => c.method === 'mutation'),
    describe: family => `assign a fixture to "${family}" whose prefix, length, alphabet, or separator can be mutated (benchmarks/operators/lexical.ts)`,
  },
  {
    id: 'differential observation',
    present: (_family, cases) => cases.some(c => c.method === 'differential'),
    describe: family => `assign at least one fixture to "${family}" in benchmarks/fixture-detectors.json so it is run against the pinned scanners`,
  },
];

/** Every required element this one family is missing, each naming the element and what to author. `cases` may cover any number of families; only those targeting `family` are considered. */
export function familyArrivalProblems(family, cases, contract) {
  const familyCases = cases.filter(c => c.targets.includes(family));
  return ELEMENTS.filter(element => !element.present(family, familyCases, contract))
    .map(element => `${family}: missing ${element.id} — ${element.describe(family)}`);
}

export async function checkEvidenceArrival() {
  const cases = await loadCases(createOperators());
  const problems = [];
  for (const family of Object.keys(contracts).sort()) problems.push(...familyArrivalProblems(family, cases, contracts[family]));
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await checkEvidenceArrival();
  for (const problem of problems) console.error(`::error::${problem}`);
  if (problems.length) process.exitCode = 1;
  else console.log(`Evidence arrival gate passed: every registered family (${Object.keys(contracts).length}) carries all ${ELEMENTS.length} required evidence kinds.`);
}
