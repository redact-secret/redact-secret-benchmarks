#!/usr/bin/env node
/**
 * Build the `explain` map of a control contrast by rule on semantic ids (#772, #773): corpus effect (the change report's changed cases and the
 * positives whose twin changed), then engine effect (a case whose findings and expected spans are unchanged but whose scored outcome differs,
 * because no isolating replay was made), with the engine effect split by MECHANISM where the case data shows more than one:
 *
 *   node scripts/attribute-engine-effect.mjs --raw <contrast-snapshots --out file run with an empty explain> --corpus <explainFromReport map> \
 *     --twins <json {twin id: seed id}> --out <explain.json>
 *
 * The limit of this attribution (stated in every report): it is a rule over the artifacts, not a measurement. An engine-only replay was not made
 * (by decision, CI cost), so a mechanism is read from the case-level data of both runs; a case that no rule names stays unexplained and `--strict` refuses it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ENGINE_TWIN_SCOPING = 'engine: twin scoping of credential-eval (alpha.13 and later, ADR 0018, same family under the legacy and the evidence id); the findings and the expected spans are unchanged, only the scored outcome differs';

/** Mechanisms behind the same scoring change. A case id matching `twin` carries `cause`; the positive a matching twin belongs to carries it too. */
export const ENGINE_MECHANISMS = [
  {
    key: 'provider-wide-coverage',
    twin: /^anthropic--anthropic-(admin01|api01)-key-api03-prefix-twin$/,
    cause: 'engine: twin scoping of credential-eval (alpha.13 and later, ADR 0018); the product finding is unchanged (anthropic_api_key / anthropic-token, redact) and provider-wide coverage maps anthropic-token to anthropic:, so a sibling-class detection reads as the twin\'s own family (credential-eval issue, draft 01); other scanners: twin scoping, only the scored outcome differs',
  },
  {
    key: 'vercel-security-first-fallback',
    twin: /^vercel--vercel-(app-access|app-refresh|personal-access)-token-(body-55|body-57|hyphen-in-body|underscore-in-body)-twin$/,
    cause: 'engine: twin scoping of credential-eval (alpha.13 and later, ADR 0018); the product reports the off-contract body as the unqualified vercel_token by its documented security-first fallback (core #1036, detector-families.md) and the scored twin outcome reflects that behaviour, which the evidence declares must be silent; scoring is faithful and the expectation\'s strength is the subject of credential-evidence draft 02; other scanners: twin scoping, only the scored outcome differs',
  },
];

const seedOf = id => id.split('--').slice(0, 2).join('--');

/** Pure: the explain map for the raw (unexplained) differences of a contrast, given the corpus-effect map and the twin->positive map. */
export function attributeEngineEffect(rawDifferences, corpusExplain, twinOf = {}) {
  const out = { ...corpusExplain };
  const mechanismOf = new Map();
  for (const m of ENGINE_MECHANISMS) for (const [twin, seed] of Object.entries(twinOf)) if (m.twin.test(twin)) { mechanismOf.set(twin, m); mechanismOf.set(seed, mechanismOf.get(seed) ?? m); }
  for (const d of rawDifferences) {
    if (!['case', 'assertion', 'review-occurrence-added'].includes(d.kind)) continue;
    const id = d.kind === 'case' ? d.id : d.id.split('|')[0];
    const seed = seedOf(id);
    if (id in out || seed in out) continue;
    out[seed] = (mechanismOf.get(seed) ?? { cause: ENGINE_TWIN_SCOPING }).cause;
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const need = name => { const at = args.indexOf(`--${name}`); if (at < 0) { console.error(`--${name} is required`); process.exit(2); } return args[at + 1]; };
  const read = file => JSON.parse(readFileSync(file, 'utf8'));
  const raw = read(need('raw')), twinOf = read(need('twins')), corpus = read(need('corpus'));
  writeFileSync(need('out'), JSON.stringify(attributeEngineEffect([...(raw.explainedDifferences ?? []), ...(raw.unexplainedDifferences ?? [])].filter(d => !d.cause), corpus, twinOf)));
}
