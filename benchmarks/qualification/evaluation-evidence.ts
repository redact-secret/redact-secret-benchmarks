import { contracts, AXES, REAL_WORLD_AXES } from '../evaluation/domains/credential/assessment.ts';
import { canonical, sha256Hex } from './canonical.ts';

/**
 * The evaluation evidence file of the methods-enabled official run (credential-eval
 * `credential-eval/evaluation-evidence/v1`, docs/contracts/README.md RunConfig). It is the product contract table the
 * evaluation methods read: family patterns, the two segment rules the structural operator hard-codes, the named value
 * validators, the benign taxonomy vocabulary and the family allowlist rule. It is derived from the product contracts,
 * never hand-authored, so a contract change re-keys the methods run's `config_hash` through its digest. Product-owned
 * (docs/specs/official-runs.md, "The methods run"); credential-eval embeds no family or vocabulary of its own.
 */
export const EVALUATION_EVIDENCE_SCHEMA = 'credential-eval/evaluation-evidence/v1';
export const EVALUATION_EVIDENCE_FILE = 'benchmarks/qualification/evaluation-evidence.json';

/** Segment layouts the structural operator hard-codes (operators/structural.ts). */
const SEGMENTS: Record<string, { delimiter: string; removable: number[] }> = {
  'sendgrid-token': { delimiter: '.', removable: [1, 2] },
  'slack-token': { delimiter: '-', removable: [1, 2, 3] },
};
/** The credential-eval compat validator that implements each product value validator, by family. */
const VALIDATORS: Record<string, string> = {
  'discord-bot-token': 'legacy:discord-bot-token',
  'confluent-cloud-api-secret': 'legacy:confluent-cloud-api-secret',
  'gitlab-runner-authentication-token': 'legacy:gitlab-routable-optional',
  'gitlab-routable-personal-access-token': 'legacy:gitlab-routable-required',
};
const byteOrder = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));

export function buildEvaluationEvidence() {
  const families: Record<string, unknown> = {}, validators: Record<string, string> = {};
  for (const id of Object.keys(contracts).sort(byteOrder)) {
    const c = contracts[id] as { pattern?: string; validate?: unknown };
    families[id] = { ...(c.pattern ? { pattern: c.pattern } : {}), ...(SEGMENTS[id] ? { segments: SEGMENTS[id] } : {}) };
    if (c.validate) {
      if (!VALIDATORS[id]) throw new Error(`contract ${id} has a value validator with no credential-eval validator mapped (benchmarks/qualification/evaluation-evidence.ts)`);
      validators[id] = VALIDATORS[id];
    }
  }
  for (const id of Object.keys(VALIDATORS)) if (!validators[id]) throw new Error(`mapped validator ${id} no longer exists in the contract table`);
  return {
    schema: EVALUATION_EVIDENCE_SCHEMA,
    families, validators,
    benign_taxonomies: [...new Set([...AXES, ...REAL_WORLD_AXES])].sort(byteOrder),
    classification_allowlist: true,
  };
}

export const serializeEvaluationEvidence = () => `${canonical(buildEvaluationEvidence())}\n`;
/** credential-eval's digest of the file: SHA-256 of its canonical JSON (evidence.rs `load`). */
export const evaluationEvidenceDigest = () => `sha256:${sha256Hex(canonical(buildEvaluationEvidence()))}`;
