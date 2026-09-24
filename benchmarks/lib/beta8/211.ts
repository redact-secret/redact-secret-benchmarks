import type { ArrivalFamily, FieldClaim, FixtureProfile, FormatContract } from '../../types.ts';
import { gl, provider, th } from '../contract-sources.ts';

// Issue #211. Owned by that issue only; see docs/specs/beta8-evidence.md.
// Research inputs: #222 (slack:app-level-token), #223 (github:fine-grained-personal-access-token),
// #224 (stripe:webhook-signing-secret), #225 (notion:integration-token), routed by #215 and #211's
// "Agent-processed research handoff" comment. No value below was provider-issued, observed or derived
// from a real credential; every structural claim carries the basis its evidence actually has.
export const issue = 211;

const OBSERVED = '2026-09-24';
const src = (url: string, note?: string, observedAt = OBSERVED) => ({ url, observedAt, ...(note ? { note } : {}) });
const field = (name: string, claim: string, basis: FieldClaim['basis'], status: FieldClaim['status'], sources: FieldClaim['sources'], note?: string): FieldClaim =>
  ({ field: name, claim, basis, status, sources, ...(note ? { note } : {}) });

const GITHUB_FORMATS = 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats';
const GITHUB_DISCUSSION = 'https://github.com/orgs/community/discussions/36441';
const SLACK_TOKENS = 'https://docs.slack.dev/authentication/tokens';
const SLACK_SOCKET_MODE = 'https://docs.slack.dev/apis/events-api/using-socket-mode';
const STRIPE_WEBHOOKS = 'https://docs.stripe.com/webhooks';
const STRIPE_ENDPOINT_OBJECT = 'https://docs.stripe.com/api/webhook_endpoints/object';
const STRIPE_SCRUB = 'https://github.com/stripe/stripe-cli/blob/master/pkg/reporting/scrub.go';
const NOTION_CHANGELOG = 'https://developers.notion.com/page/changelog';

/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'github-fine-grained-pat', taxonomy: 'github:fine-grained-personal-access-token', issue,
    reason: 'The taxonomy maps no detector to this family: the registry github-token contract is the 2021 ghp_/gho_/ghu_/ghs_/ghr_ + 36 scheme, which github_pat_ does not fit. The product ships github_pat_ matching inside its shared github-token detector (redact-secret#517), but a shared implementation does not make this the same family; findings are scored by span, not by which detector fired.' },
  { id: 'slack-app-level-token', taxonomy: 'slack:app-level-token', issue,
    reason: 'The taxonomy maps no detector to this family: the registry slack-token contract is xoxb- only. The product matches xapp- through an unpromoted interim guard inside its shared slack-token detector (redact-secret#512 left it interim); that is not a reviewed contract for this family. Re-checked at the registry pin f2082ab: redact-secret#729 replaced that guard with a sectioned grammar and its own slack_app_level_token finding type, still inside the shared slack-token detector, so this stays an arrival family.' },
  { id: 'stripe-webhook-signing-secret', taxonomy: 'stripe:webhook-signing-secret', issue,
    reason: 'The taxonomy maps no detector to this family: the registry stripe-token contract covers sk_/rk_ live/test keys, and classifyFixture sends stripe-token whsec_ shapes to pending. The product matches whsec_ inside its shared stripe-token detector on a support-policy floor (redact-secret#513); Stripe states webhook signing secrets are not API keys. Re-checked at the registry pin f2082ab: redact-secret#729 gives whsec_ its own stripe_webhook_signing_secret finding type, still inside the shared stripe-token detector, so this stays an arrival family.' },
  { id: 'notion-integration-token', taxonomy: 'notion:integration-token', issue,
    reason: 'The taxonomy maps no detector to this family: the registry notion-token contract is the legacy secret_ family only (notion:legacy-integration-token), which stays a separate family. The current ntn_ prefix replaced secret_ for newly generated tokens from 2024-09-25; the product recognizes ntn_ in its shared notion detector, which does not merge the two families here.' },
];

const githubFields: FieldClaim[] = [
  field('prefix', 'Fine-grained personal access tokens begin with the literal github_pat_.', 'provider-documentation', 'frozen',
    [src(GITHUB_FORMATS, "Token-formats table lists github_pat_ as the fine-grained PAT prefix; it gives no length, alphabet, segment or checksum for it.")]),
  field('segments', 'After the prefix: 22 characters, one underscore, 59 characters (93 in total).', 'community', 'provisional',
    [src(GITHUB_DISCUSSION, 'csine-pro 2022-10-19 proposed github_pat_[a-zA-Z-0-9]{22}_[a-zA-Z-0-9]{59} (the class admits a literal "-", probably a typo). hpsin (fine-grained PAT PM by content; authorAssociation NONE) replied 2022-10-24 "Your regex looks good" — a provider-staff endorsement in a community thread, not documentation.', '2026-09-24'),
      src('https://gist.github.com/magnetikonline/073afe7909ffdd6f10ef06a00bc3bc88', 'Community gist: ^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$. The product decision behind redact-secret#517 cites this gist and GitGuardian; the product implementation is therefore downstream of this community grammar, not independent evidence.')],
    'Recorded as community evidence with a staff endorsement. Kept visibly below the provider-documented prefix; the #223 hands-on checklist (93 total, one underscore at body offset 22) is human corroboration.'),
  field('body-length', 'The body after github_pat_ is 82 characters.', 'tool', 'provisional',
    [src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'gitleaks 8.30.1 github-fine-grained-pat: github_pat_\\w{82} (no right boundary).'),
      src('https://github.com/praetorian-inc/noseyparker/blob/main/crates/noseyparker/data/default/builtin/rules/github.yml', 'np.github.7: \\b(github_pat_[0-9a-zA-Z_]{82})\\b.'),
      src('https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-github/src/index.ts', 'secretlint: (?<!\\p{L})github_pat_[A-Za-z0-9_]{82}(?![A-Za-z0-9_]).'),
      src('https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/github/v2/github.go', 'trufflehog 3.97.4 github v2: (?:…|github_pat)_[a-zA-Z0-9_]{36,255} — a tolerant range, not a width claim.')],
    'Three exact-82 tool rules (not independent of the community grammar they cite) against tolerant ranges (TruffleHog 36–255, r-lib/gh 36–244). No length twin is authored.'),
  field('alphabet', 'Each segment is [A-Za-z0-9]; the only underscore after the prefix is the separator.', 'community', 'provisional',
    [src('https://gist.github.com/magnetikonline/073afe7909ffdd6f10ef06a00bc3bc88'),
      src('https://github.blog/changelog/2021-03-04-authentication-token-format-updates/', 'Provider changelog for the 2021 gh?_ scheme: [A-Za-z0-9_] and "up to 255 characters". It predates github_pat_ and names only the five gh?_ prefixes.', '2026-09-24')],
    'Tools accept an underscore anywhere in the 82-character body (\\w / [A-Za-z0-9_]). No fixture asserts silence on an underscore-shifted body; the separator twin uses ".", which no source admits.'),
  field('checksum', 'Whether the last characters of segment 2 carry a CRC32/Base62 checksum like the 2021 gh?_ scheme.', 'community', 'unresolved',
    [src('https://github.com/odomojuli/regextokens', 'Community claim that all GitHub v2 tokens carry a checksum; no provider source for github_pat_.'),
      src(GITHUB_DISCUSSION, 'hpsin 2022-10-24: "purely a high-entropy string that\'s looked up on our backend" — denies embedded data, says nothing explicit about a checksum.'),
      src('https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/', 'Documents CRC32/Base62 only for the 2021 gh?_ scheme.')],
    'No checksum is claimed or computed; positives are random synthetic bodies.'),
  field('segment-1-lead', 'Whether segment 1 always begins "11".', 'community', 'unresolved',
    [src(GITHUB_DISCUSSION, 'jasontempleman-eaton 2024-02-22 hypothetical masked display github_pat_11AS***.'), src('https://github.com/openhoo/hooray/issues/171', 'Anecdotal "github_pat_11AAAAAA0…" shape.')],
    'Not claimed. Some positives start segment 1 with "11" and some do not, so no fixture depends on it either way.'),
  field('ghes-parity', 'Whether GHES (GA from 3.17) issues the same github_pat_ shape.', 'provider-documentation', 'unresolved',
    [src('https://github.blog/changelog/2025-03-18-fine-grained-pats-are-now-generally-available/', 'GA; GHES expected in 3.17; token_id appears in API calls and audit logs. Format parity is not stated.')]),
];

const slackFields: FieldClaim[] = [
  field('prefix', 'App-level tokens begin with the literal xapp-.', 'provider-documentation', 'frozen',
    [src(SLACK_TOKENS, '"App-level token strings begin with xapp-." No section widths, alphabet, length or example.'),
      src(SLACK_SOCKET_MODE, 'Placeholders only (SLACK_APP_TOKEN=\'xapp-***\', Authorization: Bearer xapp-1-123); the token goes in the Authorization header.')]),
  field('section-structure', 'After the prefix: a digit section, then three more dash-separated sections (digit, alphanumeric, digit, alphanumeric).', 'provider-code', 'provisional',
    [src('https://github.com/slackapi/java-slack-sdk', 'Java SDK socket-mode guide/sample placeholder xapp-1-<A+3>-<3 digits>-<3 x>: version digit first. Placeholder widths are not real.'),
      src('https://github.com/slackapi/slack-cli', 'internal/goutils/strings_test.go placeholder xapp-1-<A+3>-<4 digits>-<4 upper>.'),
      src('https://github.com/slackapi/python-slack-sdk', 'Contradiction: the python SDK socket-mode mock uses xapp-<A+3>-<3 digits>-<3 lower> with no version section.'),
      src('https://github.com/gitleaks/gitleaks/blob/master/cmd/generate/config/rules/slack.go', 'gitleaks SlackAppLevelToken (?i)xapp-\\d-[A-Z0-9]+-\\d+-[a-z0-9]+, "based on a limited number of examples".')],
    'Provider-authored placeholders disagree on whether the version section exists; no provider page states section count. The contract pattern uses this 4-section order with open widths only so positives are well-formed; no twin or control removes the version section or asserts silence on the python-mock order.'),
  field('section-widths', 'Section widths 1 / 11 / 13 / 64 (97 characters total).', 'tool', 'unresolved',
    [src('https://github.com/google/osv-scalibr/blob/main/veles/secrets/slacktoken/detector.go', 'veles xapp-\\d{1,10}-[A-Za-z0-9]{11}-[0-9]{13}-[a-fA-F0-9]{64}; "presumably" hedges the version width.'),
      src('https://github.com/mongodb/kingfisher', 'Kingfisher imports the identical regex (not independent).'),
      src('https://github.com/praetorian-inc/noseyparker/blob/main/crates/noseyparker/data/default/builtin/rules/slack.yml', 'Contradiction: np.slack.5 \\b(xapp-[0-9]{12}-[a-zA-Z0-9/+]{24})\\b — two sections, 42 characters.')],
    'Not frozen. Positives use 1/11/13/64 so they satisfy gitleaks, veles/kingfisher, the product\'s interim xapp-[A-Za-z0-9_-]{20,} floor and Slack CLI\'s prefix-only redaction; they cannot also satisfy Nosey Parker\'s 2-section shape, which is recorded, never asserted against: no fixture uses a 42-character xapp- value.'),
  field('alphabet', 'Section 2 uppercase alphanumeric (app-ID-like); final section lowercase hex.', 'tool', 'unresolved',
    [src('https://github.com/gitleaks/gitleaks/blob/master/cmd/generate/config/rules/slack.go', 'Case-insensitive; TP samples use lowercase hex tails. Two of three cited samples do not start section 2 with "A", so "section 2 is the App ID" is not consistently supported.'),
      src('https://github.com/google/osv-scalibr/blob/main/veles/secrets/slacktoken/detector.go', 'Accepts [a-fA-F0-9] for the tail.')],
    'Not frozen; the pattern accepts any alphanumeric in sections 2 and 4. No fixture twins on tail case or width.'),
  field('app-id-embedding', 'Whether section 2 equals the public App ID.', 'research-hypothesis', 'unresolved',
    [src('https://github.com/google/osv-scalibr/blob/main/veles/secrets/slacktoken/detector.go', 'Calls section 2 "an app ID" without a source.')],
    'An App ID alone is a public identifier and is used as a public-id control; nothing asserts it is or is not embedded.'),
];

const stripeFields: FieldClaim[] = [
  field('prefix', 'Webhook signing secrets begin with the literal whsec_ (Dashboard, API and CLI; snapshot and thin destinations alike).', 'provider-documentation', 'frozen',
    [src(STRIPE_WEBHOOKS, 'Dashboard "Reveal secret": a signing secret beginning with whsec_; v2 event destinations return a value that "starts with whsec_".'),
      src('https://docs.stripe.com/webhooks/signature', 'Dashboard and CLI secrets both start with whsec_ but differ.')]),
  field('context', 'The secret is configured per webhook endpoint (STRIPE_WEBHOOK_SECRET / endpoint_secret / signing_secret) and passed to the SDK signature verifier.', 'provider-documentation', 'frozen',
    [src(STRIPE_WEBHOOKS, 'Code samples read the endpoint secret into the constructEvent / construct_event verifier.'),
      src('https://docs.stripe.com/keys', '"Webhook signing secrets aren\'t API keys—they\'re per-webhook secrets."')],
    'Context-gated: whsec_ is also issued by Svix/Standard Webhooks (base64, 24–64 bytes), so the prefix alone does not attribute a value to Stripe. Every positive carries a same-line Stripe context; non-Stripe whsec_ values are neither positives nor controls here (#224 left that contract decision open).'),
  field('body-alphabet', 'The body may be alphanumeric or base64 with + / and = padding.', 'provider-code', 'provisional',
    [src(STRIPE_SCRUB, 'Stripe CLI error-report scrubber \\bwhsec_[a-zA-Z0-9+/]+=* ("base64 alphabet + optional = padding"); conservative scrubbing, not a generator statement.'),
      src('https://github.com/stripe/stripe-cli/blob/master/canary/testutil/sanitize.go', 'The same repo\'s canary sanitizer uses whsec_[a-zA-Z0-9]{10,} (alphanumeric only).')],
    'Stripe\'s own code disagrees with itself. Positives are alphanumeric (satisfying every candidate); the contract pattern admits + / = so no fixture asserts silence on them.'),
  field('body-length', 'The body is at least 32 characters; 32 and 64 are the widths sources show.', 'provider-example', 'provisional',
    [src(STRIPE_ENDPOINT_OBJECT, 'The API reference example secret has a 32-character mixed-case alphanumeric body. "Only returned at creation" via the API.'),
      src('https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/.env.example', 'Provider-code placeholder whsec_ + 64 zeros.'),
      src('https://github.com/trufflesecurity/trufflehog/pull/4973', 'Unmerged: exact 32 or 64 alphanumeric.'),
      src('https://github.com/trufflesecurity/trufflehog/pull/4920', 'Unmerged: 32–64 of [A-Za-z0-9+/].')],
    'Not exhaustive (#224): an example is not a grammar. The 32 floor only keeps short documentation placeholders out of the pattern; no twin mutates width, and no zero-filled 64-character placeholder is authored as a control because it would satisfy the pattern.'),
  field('mode-marker', 'No live/test marker in the value.', 'provider-documentation', 'provisional',
    [src(STRIPE_WEBHOOKS, 'Test and live endpoints have different secrets; the prefix carries no mode segment.')]),
  field('checksum', 'Whether the body has a checksum or embedded id.', 'research-hypothesis', 'unresolved',
    [src(STRIPE_WEBHOOKS, 'Nothing stated. SDKs HMAC with the whole string as UTF-8 bytes and never decode it (stripe-go/node/python webhook code).')]),
];

const notionFields: FieldClaim[] = [
  field('prefix', 'Newly generated Public API tokens begin with ntn_ from 2024-09-25; existing secret_ tokens keep working.', 'provider-documentation', 'frozen',
    [src(NOTION_CHANGELOG, 'Changelog 2024-09-11. Also: Notion "strongly advise[s] against" regex identification; the format "may change over time"; treat tokens as opaque.')],
    'secret_ is the separate legacy family notion:legacy-integration-token (registry notion-token); it is never a control or twin here.'),
  field('body', 'After ntn_: 11 digits then 35 alphanumerics (50 characters total).', 'tool', 'provisional',
    [src('https://github.com/gitleaks/gitleaks/blob/83d9cd684c87d95d656c1458ef04895a7f1cbd8e/config/gitleaks.toml#L2652', 'gitleaks 8.30.1 notion-api-token: \\b(ntn_[0-9]{11}[A-Za-z0-9]{32}[A-Za-z0-9]{3})(?:[\\x60\'"\\s;]|\\\\[nr]|$), entropy 4.'),
      src('https://github.com/secretlint/secretlint/tree/master/packages/%40secretlint/secretlint-rule-notion', '(?<!\\p{L})ntn_[0-9]{11}[A-Za-z0-9]{35}(?![A-Za-z0-9]).'),
      src('https://github.com/gitleaks/gitleaks/pull/1890', 'Single contributor\'s samples; Betterleaks/Kingfisher/TruffleHog PR #4318 share the lineage (not independent).'),
      src('https://github.com/flare-collection/flare-redact/blob/c652ea7946028b70527069d7c282752b8a0ccee3/spec/detectors.json#L1472', 'Disagrees: ntn_[A-Za-z0-9]{40,50} with no digit run.')],
    'Provider warns against exactly this kind of grammar. Positives use 11+35 so they satisfy gitleaks, secretlint, flare-redact (46 in 40–50), makenotion/lore\'s ntn_[A-Za-z0-9_-]{20,} redaction and the product; no twin mutates the digit run or the length.'),
  field('digit-run-semantics', 'What the 11-digit run is (timestamp, per-workspace/bot id, random).', 'community', 'unresolved',
    [src('https://github.com/gitleaks/gitleaks/pull/1890', '"11-digit timestamp" claim; 11 digits fits neither epoch seconds nor ms; the three samples share one lead.')]),
  field('role', 'Whether internal-integration, PAT, ntn-CLI and OAuth access tokens share one ntn_ grammar.', 'provider-code', 'unresolved',
    [src('https://developers.notion.com/guides/get-started/personal-access-tokens.md', 'PATs exist (2026); their prefix appears only in placeholders (ntn_***).'),
      src('https://github.com/makenotion/notion-mcp-server/blob/main/src/openapi-mcp-server/mcp/token.ts', 'Comment: ntn_ for "current internal & OAuth integration tokens".'),
      src('https://github.com/makenotion/lore/blob/main/src/auth/token-prefix.ts', 'ntn_ PATs and CLI tokens are "indistinguishable by prefix"; development_ntn_ for dev-environment tokens.')],
    'Roles are not merged: every positive is an internal-integration context (NOTION_TOKEN / NOTION_API_KEY / installation access token). PAT, OAuth and org-bot tokens are secrets of undetermined grammar, so they are neither positives nor controls; development_ntn_ is recorded, never asserted either way.'),
];

/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {
  'github-fine-grained-pat': {
    tier: 'T2', pattern: '^github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}$', fields: githubFields,
    candidateSource: provider(GITHUB_FORMATS, 'github_pat_ fine-grained PAT prefix', 'the github_pat_ prefix only; no length, alphabet, segment or checksum', OBSERVED),
    corroboration: [{ ...gl, label: 'github-fine-grained-pat' }, th('github/v2/github', 'github v2 (github_pat_ in a 36–255 range)'),
      { tool: 'noseyparker', label: 'np.github.7', url: 'https://github.com/praetorian-inc/noseyparker/blob/main/crates/noseyparker/data/default/builtin/rules/github.yml' },
      { tool: 'secretlint', label: 'secretlint-rule-github', url: 'https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-github/src/index.ts' }],
    references: [GITHUB_DISCUSSION, 'https://gist.github.com/magnetikonline/073afe7909ffdd6f10ef06a00bc3bc88', 'https://github.com/redact-secret/redact-secret-benchmarks/issues/223'],
    review: 'Arrival contract (#211, research #223, observed 2026-09-24). T2, not T1: GitHub documents only the github_pat_ prefix; the 22 + "_" + 59 body positives depend on rests on a community grammar (discussion 36441, the magnetikonline gist) that a GitHub PM endorsed in-thread, and on exact-82 tool rules (gitleaks 8.30.1, Nosey Parker, secretlint). No checksum, fixed "11" lead or GHES parity is claimed. Twins mutate only properties no source admits (prefix spelling, case, the "_" separator, a non-alphanumeric byte, a glued leading letter); none mutates width, because TruffleHog and r-lib/gh accept 36–255 and GitHub\'s 2021 guidance says tokens may grow to 255. The product matches this shape inside its shared github-token detector, so a product finding on a twin is recorded as co-detection by that family, not as a false alarm for this one.',
  },
  'slack-app-level-token': {
    tier: 'T2', pattern: '^xapp-[0-9]+-[A-Za-z0-9]+-[0-9]+-[A-Za-z0-9]+$', fields: slackFields,
    candidateSource: provider(SLACK_TOKENS, 'xapp- app-level token prefix', 'the xapp- prefix only; no section widths, alphabet or length', OBSERVED),
    corroboration: [{ ...gl, label: 'slack-app-token' },
      { tool: 'osv-scalibr veles', label: 'slacktoken', url: 'https://github.com/google/osv-scalibr/blob/main/veles/secrets/slacktoken/detector.go' }],
    references: [SLACK_SOCKET_MODE, 'https://github.com/slackapi/slack-cli', 'https://github.com/redact-secret/redact-secret-benchmarks/issues/222'],
    review: 'Arrival contract (#211, research #222, observed 2026-09-24). T2: Slack documents only the xapp- prefix; the four-section order comes from provider-authored placeholders (Java SDK, Slack CLI tests) that the python SDK mock contradicts, and widths/alphabet come from gitleaks and veles/kingfisher (one lineage), which Nosey Parker\'s two-section 42-character rule contradicts outright. The pattern therefore fixes the prefix and section order with open widths; widths and alphabet are unresolved. Positives use the 1/11/13/64 shape so every candidate relied on accepts them; no fixture uses a 42-character value or removes the version section. The pinned trufflehog 3.97.4 has no xapp- detector. Slack\'s own CLI redacts xapp-[\\w.-]* on prefix alone.',
  },
  'stripe-webhook-signing-secret': {
    tier: 'T1', pattern: '^whsec_[A-Za-z0-9+/]{32,}={0,2}$', contextGated: true, fields: stripeFields,
    providerSource: provider(STRIPE_WEBHOOKS, 'whsec_ webhook endpoint signing secret', 'the whsec_ prefix and the per-endpoint configuration context; no body length or alphabet', OBSERVED),
    references: [STRIPE_ENDPOINT_OBJECT, 'https://docs.stripe.com/keys', 'https://docs.stripe.com/webhooks/signature', STRIPE_SCRUB, 'https://github.com/redact-secret/redact-secret-benchmarks/issues/224'],
    review: 'Arrival contract (#211, research #224, observed 2026-09-24). Context-constrained and provisional, per #211: Stripe documents the whsec_ prefix and where the secret is configured, never a body length or alphabet; its only full-length example has 32 alphanumerics, its own CLI scrubber admits base64 + / =, its canary sanitizer does not, and Svix/Standard Webhooks issue whsec_ too. Positives therefore score as policy beside a same-line Stripe context, use alphanumeric 32- or 64-character bodies that satisfy every candidate rule, and no twin mutates width or introduces + / =. Neither pinned peer (gitleaks 8.30.1, trufflehog 3.97.4) registers a whsec_ rule. Stripe-Signature digests, we_/ed_/evt_ ids and pk_ publishable keys are public controls. The public-prefix twin swaps whsec_ for pk_live_, which docs.stripe.com/keys documents as safe to expose.',
  },
  'notion-integration-token': {
    tier: 'T2', pattern: '^ntn_[0-9]{11}[A-Za-z0-9]{35}$', fields: notionFields,
    candidateSource: provider(NOTION_CHANGELOG, '2024-09 Public API token prefix migration', 'the ntn_ prefix for newly generated tokens and the secret_ legacy relationship; no body grammar', OBSERVED),
    corroboration: [{ ...gl, label: 'notion-api-token' },
      { tool: 'secretlint', label: 'secretlint-rule-notion', url: 'https://github.com/secretlint/secretlint/tree/master/packages/%40secretlint/secretlint-rule-notion' }],
    references: ['https://developers.notion.com/guides/get-started/internal-integrations.md', 'https://github.com/makenotion/lore/blob/main/src/auth/token-prefix.ts', 'https://github.com/redact-secret/redact-secret-benchmarks/issues/225'],
    review: 'Arrival contract (#211, research #225, observed 2026-09-24). T2: Notion documents the ntn_ prefix (2024-09-25 rollout; secret_ tokens keep working as the separate legacy family) and advises against regex validation because the format may change. The 11-digit + 35-alphanumeric body is tool-only and traces to one contributor (gitleaks #1890 lineage) plus secretlint; flare-redact disagrees (40–50, no digit run) and Notion\'s own docs placeholder has no digit run. Twins therefore mutate only the prefix spelling, case, separator, a glued leading letter or a non-alphanumeric byte — never the digit run or the length. PAT, OAuth, org-bot and internal-integration roles are not merged: positives are internal-integration contexts only, and other ntn_ roles are neither positives nor controls. The pinned trufflehog 3.97.4 notion detector matches secret_ only.',
  },
};

/** The Beta.8 profile each target this issue owns is authored toward (registry detector ids or arrival ids). */
export const profiles: Record<string, FixtureProfile> = {
  'github-fine-grained-pat': 'arrival-24',
  'slack-app-level-token': 'arrival-24',
  'stripe-webhook-signing-secret': 'arrival-24',
  'notion-integration-token': 'arrival-24',
};
