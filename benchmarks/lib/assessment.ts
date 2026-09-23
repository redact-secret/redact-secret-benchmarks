import type { Fixture, Range, Kind, Tier, Assessment, FormatContract } from '../types.ts';
// Classification is authored from input construction and provider evidence,
// never scanner outcomes. Unknown fixtures fail closed into T0 (pending).
// Protocol: docs/specs/measurement-v4.md §2.1, §2.6, §6.
import { KINDS, TIERS } from './lattice.ts';

export const kinds = {
  'must-redact': { title: 'Must redact', description: 'Authored secret spans with an evidence tier. Leaked span rate, leaked byte rate and collateral ratio are the headline numbers; twin discrimination measures whether a near-identical control stays clean.' },
  'must-not-flag': { title: 'Must not flag', description: 'Controls that assert silence: malformed shapes, near misses, public identifiers, placeholders, references and prose. False alarm rate is the headline number.' },
  policy: { title: 'Policy', description: 'Spans that follow this project’s masking policy rather than a provider format: standalone IDs, generic literals, bearer values, URI passwords, OTP seeds and retained legacy expectations. Never merged with must-redact.' },
};
export const tiers = {
  T1: { title: 'Provider-documented', description: 'The provider (or an RFC) documents the lexical shape the contract requires. Tool sources are corroboration only.' },
  T2: { title: 'Tool-corroborated', description: 'No usable provider documentation; at least one pinned scanner registration or a structural argument supports the shape.' },
  T3: { title: 'Project policy', description: 'This project’s masking policy. Honest, and never compared with provider-documented formats.' },
  T0: { title: 'Pending', description: 'No adequate evidence yet. Observations are inspectable but unscored.' },
};

const observedAt = '2026-09-17';
const th = (path: string, label?: string) => ({ tool: 'trufflehog 3.97.4', label: label ?? path, url: `https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/${path}.go` });
const gl = { tool: 'gitleaks 8.30.1', label: 'gitleaks.toml', url: 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml' };
const unprobeable = (reason: string, at = '2026-09-20') => ({ reason, observedAt: at });
const provider = (url: string, formatVersion: string, covers: string, observedAtOverride = observedAt) => ({ url, observedAt: observedAtOverride, formatVersion, covers });

/**
 * Format contracts. `tier` is the evidence tier a format-correct positive
 * earns. T1 requires `providerSource`; tool sources are never sufficient.
 * `covers` records what the provider document actually establishes so a
 * contract cannot quietly claim more than its evidence.
 */
export const contracts: Record<string, FormatContract> = {
  'aws-access-key': { tier: 'T1', pattern: '^AKIA[A-Z2-7]{16}$', providerSource: provider('https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes', 'IAM unique-ID prefix table', 'AKIA/ASIA/ABIA/ACCA prefixes, and AIDA as the IAM-user unique-ID prefix rather than an access key (re-checked 2026-09-20, #36); 16-character base32 body and 40-character secret are tool-corroborated'), corroboration: [th('aws/access_keys/accesskey'), gl], companion: 'A separate 40-character secret access key is required. ASIA additionally needs a session token and is not covered by this contract.' },
  'github-token': { tier: 'T1', pattern: '^(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}$', providerSource: provider('https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats', '2021-04 prefix scheme', 'ghp_/gho_/ghu_/ghs_/ghr_ prefixes and underscore separator; 36-character body is tool-corroborated (checksum in the last six characters per github.blog/2021-04-05)'), corroboration: [th('github/v2/github'), gl], review: 'Re-checked 2026-09-20 (#46): docs.github.com also documents github_pat_ (fine-grained token) as a real, different prefix outside this contract\'s ghp_/gho_/ghu_/ghs_/ghr_ set, backing a prefix twin. github.blog/security/application-security/behind-githubs-new-authentication-token-formats confirms the parenthetical checksum claim (CRC32, Base62-encoded, last six characters) but the checksum is not part of this contract\'s lexical pattern, so a checksum-only mutation still satisfies it and cannot be constructed as a twin here.' },
  'gitlab-token': { tier: 'T1', pattern: '^glpat-[A-Za-z0-9_-]{20}$', providerSource: provider('https://docs.gitlab.com/security/tokens/', 'token prefix table', 'glpat- prefix; 20-character legacy body is tool-corroborated, routable tokens are not covered'), corroboration: [th('gitlab/v2/gitlab_v2'), gl], review: 'Re-checked 2026-09-20 (#46): the same prefix table documents glpat- as shared by four token kinds (none the positive this contract covers) and lists gldt-, glrt-/glrtr-, glcbt- and others as the gl- stem\'s other members; the prefix twin instead breaks the gl- stem itself (xlpat- vs glpat-), since a mutation matching one of those other real prefixes (gldt-) was empirically not discriminated by the redact-secret scanner.' },
  'openai-token': { tier: 'T2', pattern: '^sk-(?:[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}|(?:proj|svcacct)-[A-Za-z0-9_-]{74}T3BlbkFJ[A-Za-z0-9_-]{74})$', corroboration: [th('openai/openai'), gl], review: 'OpenAI publishes no key-format documentation (platform docs require authentication). Marker and lengths are tool-corroborated only.' },
  'anthropic-token': { tier: 'T2', pattern: '^sk-ant-api03-[A-Za-z0-9_-]{93}AA$', corroboration: [th('anthropic/anthropic'), gl], review: 'Anthropic API documentation describes authentication headers but not the key format. Shape is tool-corroborated only. Re-checked 2026-09-20 against platform.claude.com/docs/en/get-api-key (#33): the page states only the sk-ant- prefix, no body length or alphabet. No length/alphabet twin is authored for this family; it is un-probeable from provider evidence.' },
  'shopify-token': { tier: 'T1', pattern: '^shp(?:at|pa)_[a-f0-9]{32}$', providerSource: provider('https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens', 'shpat_/shppa_ opaque tokens', 'shpat_ and shppa_ prefixes; 32-hex body is tool-corroborated'), corroboration: [th('shopify/shopify'), gl], companion: 'A myshopify.com shop domain must accompany the token.', review: 'Re-checked 2026-09-20 (#33): the page calls the body an "opaque string" and states no length or character class. No length/alphabet twin is authored for this family; it is un-probeable from provider evidence.' },
  'vault-token': { tier: 'T1', pattern: '^hv[sbr]\\.[A-Za-z0-9_-]{24,}$', providerSource: provider('https://developer.hashicorp.com/vault/docs/concepts/tokens', 'hvs./hvb./hvr. prefixes, 24+ random characters', 'prefixes and minimum length; the provider states the structure is opaque, so the 90–120-character rule the pinned tools use is corroboration, not contract'), corroboration: [th('hashicorpvault/hashicorpvaulttoken/hashicorpvaulttoken'), gl], companion: 'An explicit Vault endpoint is supplied. This is a service-token shape, not a validated encoded Vault payload.', review: 'Re-checked 2026-09-20 (#46): the same page documents exactly three prefixes (hvs./hvb./hvr.), all already in this contract\'s pattern; the prefix twin (hvx.) is a single-character deviation from the documented set rather than a real alternate token type, since no fourth Vault token prefix exists to cite.' },
  'stripe-token': { tier: 'T1', pattern: '^[rs]k_(?:live|test)_[A-Za-z0-9]{32}$', providerSource: provider('https://docs.stripe.com/keys', 'sk_/rk_/pk_ key types', 'sk_live_/sk_test_/rk_live_/rk_test_ secret and restricted keys, pk_ publishable keys documented as safe to expose, sk_org_ organization keys; 32-character body is tool-corroborated'), corroboration: [th('stripe/stripe'), gl], review: 'Re-checked 2026-09-20 (#33): the page documents key types and safety-to-expose per prefix, nothing about body length or alphabet. No length/alphabet twin is authored for this family; it is un-probeable from provider evidence.' },
  'slack-token': { tier: 'T1', pattern: '^xoxb-[0-9]{12}-[0-9]{12}-[A-Za-z0-9]{24}$', providerSource: provider('https://docs.slack.dev/authentication/tokens', 'xoxb-/xoxp-/xapp-/xwfp- prefixes, dash-separated sections', 'prefixes and section structure with the secret last; numeric section widths and 24-character secret are tool-corroborated'), corroboration: [th('slack/slack'), gl], review: 'Re-checked 2026-09-20 (#45): the page documents the xoxb-/xoxp-/xapp-/xwfp- prefixes (workflow tokens are stated to begin xwfp-) but gives no section widths or alphabet for any of them, including xoxb-\'s own team-id, bot-id and secret segments. No length/alphabet twin is authored for this family; it is un-probeable from provider evidence. Re-checked again 2026-09-20 (#46): a prefix twin using xoxp- (the documented user-token prefix) was empirically not discriminated by the redact-secret scanner, so the prefix twin instead breaks the xox- stem every documented Slack prefix shares or extends (xoyb- vs xoxb-).' },
  'pypi-token': { tier: 'T1', pattern: '^pypi-[A-Za-z0-9_-]{85,}$', providerSource: provider('https://docs.pypi.org/api/secrets/', 'pypi- prefix, base64-serialized PyMacaroon, {85,} length floor', 'docs.pypi.org\'s own detection-format page publishes this contract\'s exact regex, pypi-[A-Za-z0-9-_]{85,}: the pypi- prefix, a "-" separator, a base64 PyMacaroon serialization, an 85-character floor and no ceiling', '2026-09-21'), corroboration: [th('pypi/pypi'), gl], references: ['https://pypi.org/help/#apitoken'], review: 'Re-checked 2026-09-21 (#104/#107, docs/decisions/2026-09-21-author-pypi-macaroon-positives-synthetically.md): the prior review here read "no lexical length contract" from pypi.org/help alone; docs.pypi.org/api/secrets instead publishes the exact regex now used as this contract\'s pattern, and #104 verified it is also what the pinned scanners and this project\'s own product key on. A positive is additionally constructed as a well-formed libmacaroons v2 body (VERSION, LOCATION("pypi.org"), IDENTIFIER, one caveat, SIGNATURE) per the linked decision record, not merely an arbitrary {85,}-byte run.' },
  'huggingface-token': { tier: 'T2', pattern: '^hf_[A-Za-z0-9]{34}$', corroboration: [th('huggingface/huggingface'), gl], review: 'Hugging Face documentation shows only an hf_ placeholder, no alphabet. Re-verified 2026-09-20 (#45) against the pinned source: TruffleHog\'s huggingface detector matches `\\b(?:hf_|api_org_)[a-zA-Z0-9]{34}\\b`, alphanumeric; gitleaks\'s huggingface-access-token rule matches `\\b(hf_(?i:[a-z]{34}))...`, letters-only. TruffleHog\'s registration alone is sufficient T2 corroboration for the alphanumeric body, matching this project\'s single-tool T2 precedent elsewhere; gitleaks would not flag a digit-bearing instance.' },
  'docker-token': { tier: 'T2', pattern: '^dckr_(?:pat_[A-Za-z0-9_-]{27}|oat_[A-Za-z0-9_-]{32})$', corroboration: [th('dockerhub/v2/dockerhub')], review: 'Docker access-token documentation does not describe the dckr_pat_/dckr_oat_ format. Shape is tool-corroborated only.' },
  'cloudflare-token': { tier: 'T1', pattern: '^cfut_[A-Za-z0-9]{40}[a-f0-9]{8}$', providerSource: provider('https://developers.cloudflare.com/fundamentals/api/get-started/create-token/', 'cfut_ scannable format', 'cfut_ prefix documented as the scannable token format; 40+8 body structure is tool-corroborated'), corroboration: [th('cloudflareapitoken/v2/cloudflareapitoken')], review: 'Re-checked 2026-09-20 (#46): the page documents cfut_ as the only scannable-format prefix, with no other type documented; the prefix twin (cfux_) is a single-character deviation from that exact string.' },
  'digitalocean-token': { tier: 'T1', pattern: '^do[por]_v1_[a-f0-9]{64}$', providerSource: provider('https://docs.digitalocean.com/release-notes/api/', '2022-03-29 token prefixes', 'dop_v1_/doo_v1_/dor_v1_ prefixes; 64-hex body is tool-corroborated'), corroboration: [th('digitaloceanv2/digitaloceanv2'), gl], review: 'Re-checked 2026-09-20 (#46): the release notes document exactly three prefixes (dop_v1_/doo_v1_/dor_v1_), all already in this contract\'s pattern; the prefix twin (dox_v1_) is a single-character deviation from the documented set rather than a real fourth token type, since none is documented.' },
  'linear-token': { tier: 'T2', pattern: '^lin_api_[A-Za-z0-9]{40}$', corroboration: [th('linearapi/linearapi'), gl], review: 'Linear API documentation does not describe the lin_api_ format. Shape is tool-corroborated only; the OAuth variant has no contract.' },
  'supabase-token': { tier: 'T0', corroboration: [th('supabasetoken/supabasetoken')], candidateSource: provider('https://supabase.com/docs/guides/api/api-keys', 'sb_secret_/sb_publishable_ short strings', 'prefixes only; body length and alphabet are undocumented'), review: 'Re-checked 2026-09-22 (#127, following #45): Supabase still documents only the sb_secret_/sb_publishable_ prefixes, not body length or alphabet, and the pinned TruffleHog detector covers the different sbp_ management-token prefix instead. redact-secret#515 is closed (PR #535): the product split sbp_/sbp_v0_ into its own supabase-management-token detector (T1 in this file already) but left sb_secret_\'s at_least(20, is_alnum_dash) support-policy floor unchanged, naming two mutually contradictory third-party proposals for the body (openssl rand -hex 24 vs. an unmerged gitleaks issue) as its own reason not to fabricate a length. This corpus\'s bar is unmet on that same evidence, not on an open product issue: pending until a shipped scanner rule or Supabase\'s own documentation states one body grammar; never substitute credential classes.', unprobeable: unprobeable('The positive is T0 pending, so no pair can be scored. The provider page documents sb_publishable_ as safe to expose, so a public-prefix twin is expressible; it is deferred until body evidence lifts the positive out of T0.') },
  // #515/#81: a distinct credential class from `supabase-token` above (a PAT
  // authenticates a Supabase account, `sb_secret_` a project's data API);
  // neither's evidence is used for the other, per product repo's
  // https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-20-scope-supabase-management-token-and-secret-key-independence.md.
  'supabase-management-token': { tier: 'T1', pattern: '^sbp_(?:v0_)?[a-z0-9]{40}$', providerSource: provider('https://supabase.com/docs/guides/platform/personal-access-tokens', 'sbp_/sbp_v0_ personal access tokens', 'documents the sbp_ prefix by example (sbp_fc...) and the classic-vs-scoped distinction; states no exact body grammar', '2026-09-20'), corroboration: [th('supabasetoken/supabasetoken')], review: 'Body length and alphabet are tool-corroborated, not provider-documented: TruffleHog\'s supabase detector is anchored to [a-z0-9]{40} for the classic sbp_ prefix and carries no underscore in its class, so it cannot match the versioned sbp_v0_ prefix the same docs page\'s scoped-token walkthrough names — this contract closes that gap as a second, identical-body shape, the same "adopt the sibling prefix, keep the body shape" move already made for hugging-face-token\'s api_org_ shape. No TruffleHog implementation code is used, only its published match shape, per AGENTS.md.' },
  'vercel-token': { tier: 'T0', corroboration: [th('vercel/vercel')], candidateSource: provider('https://vercel.com/docs/accounts/access-tokens', 'vcp_/vci_/vca_/vcr_/vck_ prefixed opaque tokens', 'prefixes are now documented per credential type (personal/integration/app-access/app-refresh/API-key, via the token-format changelog); the body is stated to be an opaque format not intended to be human-readable, with no length or alphabet given', '2026-09-20'), review: 'Re-checked 2026-09-22 (#127, following #45): Vercel documents all five prefixes (vcp_/vci_/vca_/vcr_/vck_) as visual/scanning markers, but no page states a body length or alphabet for any of them; the pinned TruffleHog detector matches only a different, unprefixed 24-character contextual credential (Vercel\'s OAuth code-exchange access_token/client_secret) that this shape\'s own evidence excludes as a separate surface. redact-secret#516 is closed (PR #536): the product\'s own taxonomy audit (docs/audits/evidence/516/README.md) reached the identical conclusion — all five prefixed classes stay pending T0, no detector was authored — and recorded the same unblocking condition this contract uses. This corpus\'s bar is unmet on that same evidence, not on an open product issue.', unprobeable: unprobeable('The positive is T0 pending. Vercel documents the prefixes as scanning markers but states the body is intentionally opaque, so no lexical grammar exists to mutate; deferred until a shipped scanner rule or Vercel\'s own documentation states one body length/alphabet rule in prose.') },
  'npm-token': { tier: 'T1', pattern: '^npm_[A-Za-z0-9]{36}$', providerSource: provider('https://github.blog/changelog/2021-09-23-npm-has-a-new-access-token-format/', '2021-09 npm_ prefix scheme', 'npm_ prefix, underscore delimiter and six-character Base62 CRC32 checksum; 36-character body is tool-corroborated'), corroboration: [th('npmtokenv2/npmtokenv2'), gl], review: 'Re-checked 2026-09-20 (#46): the same page documents the npm_ prefix (npmx_ is a single-character deviation) and states the delimiter changed from a pre-2021 hyphen to the documented underscore, backing prefix and boundary twins. The page also documents the checksum, but it is not part of this contract\'s lexical pattern, so a checksum-only mutation still satisfies it and cannot be constructed as a twin here.' },
  'google-api-key': { tier: 'T2', pattern: '^AIza[A-Za-z0-9_-]{35}$', corroboration: [gl], review: 'Google publishes no API-key format documentation. The AIza prefix and 35-character suffix are gitleaks-corroborated only; the pinned TruffleHog detectors cover Gemini and OAuth2 credentials, not this generic API-key shape.' },
  'sendgrid-token': { tier: 'T1', pattern: '^SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}$', providerSource: provider('https://support.sendgrid.com/hc/en-us/articles/44146758703387-Can-I-Use-a-Reduced-Shorter-API-Key-Size-in-SendGrid', 'fixed 69-character key length', 'the total key is documented as always 69 characters and never shorter; the SG. prefix, the dot-separated id/secret segments, the 22/43 character split between them and the alphabet are tool-corroborated, not this citation', '2026-09-20'), corroboration: [th('sendgrid/sendgrid'), gl] },
  'microsoft-entra-client-secret': { tier: 'T2', pattern: '^[A-Za-z0-9_.~-]{3}\\dQ~[A-Za-z0-9_.~-]{31,34}$', corroboration: [th('azure_entra/serviceprincipal/v2/spv2', 'Azure Entra Service Principal v2'), gl], review: 'Microsoft publishes no client-secret value grammar (only that it must be recorded immediately). redact-secret-benchmarks#161 (following redact-secret#655\'s web-search pass) found the 3-character lead excluded "-", a false negative: portal- and CLI-issued secrets starting with "-" are real (four independent reports, one measured at 8Q~/40, including one that breaks `az login -p`), TruffleHog 3.97.4\'s azure_entra/serviceprincipal/v2 detector (merged 2024-11-20; the earlier review only checked v1, which has no Q~ marker) already accepts "-" in the lead, and Microsoft\'s own scanner rule (microsoft/security-utilities SEC101/156 — provider code, not documentation) agrees. Widened to match; gitleaks\'s azure-ad-client-secret rule still excludes "-", so it stays cited for the marker only. The same research found the marker digit unconstrained (any \\d, not just 7/8) and uncoupled from length (SEC101/156 pairs 7Q~ with exactly 37 total and 8Q~ with exactly 40); #161 leaves those two looser-contract points open as separate precision issues, not fixed here.', twinSource: provider('https://learn.microsoft.com/en-us/purview/sit-defn-azure-ad-client-secret', 'Purview Entra client secret definition', 'learn.microsoft.com states the client secret is "a combination of up to 40 characters" of letters, digits, "-", "_", "." and "~". It backs a length twin (41 characters) only; the digit+Q~ marker is example- and tool-corroborated (redact-secret#655) and the positive tier is unchanged', '2026-09-22') },
  'azure-devops-personal-access-token': { tier: 'T3', references: ['https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate#pat-format'], review: 'Azure DevOps documents an 84-character token with a fixed AZDO marker at bytes 76-80, but that citation is not independently verified here and no pinned scanner rule corroborates this exact shape: the pinned TruffleHog azuredevopspersonalaccesstoken detector instead matches an unrelated 52-character lowercase-alphanumeric, keyword-gated value. Treated as unevidenced pending a verified provider source or matching tool corroboration. Re-checked 2026-09-20 (#36): the provider statement was observed and is recorded as twinSource for a length twin only; the positive tier is unchanged.', twinSource: provider('https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate#pat-format', '84-character PAT with AZDO signature', 'tokens are 84 characters long with a fixed AZDO signature at positions 76-80; the alphabet is not documented', '2026-09-20') },
  'notion-token': { tier: 'T2', pattern: '^secret_[A-Za-z0-9]{43}$', corroboration: [th('notion/notion')], review: 'Covers only the legacy secret_ token shape; the current ntn_-prefixed format (Notion\'s 2024-09 rollout) has no contract here. The pinned gitleaks notion-api-token rule targets the newer ntn_ shape instead, so only TruffleHog\'s notion detector (which matches secret_ exactly) corroborates this contract.' },
  'atlassian-api-token': { tier: 'T2', pattern: '^ATAT[A-Za-z0-9_-]{100,}$', corroboration: [gl], review: 'Atlassian explicitly disclaims a fixed token length. Gitleaks\'s atlassian-api-token rule corroborates the ATAT-prefixed family with a narrower, more specific shape (literal ATATT3 prefix, exact 186-byte body) than this minimum-length contract. The pinned TruffleHog atlassian detector instead targets the distinct ATCT access-token family, not this API-token shape.' },
  'twilio-auth-token': { tier: 'T2', corroboration: [th('twilio/twilio')], review: 'Twilio documents the Auth Token\'s functional role but no character-class grammar. The bare 32-character lowercase-hex shape, gated on a same-line Account SID or the word "twilio", is corroborated by TruffleHog\'s twilio detector; no pinned gitleaks rule covers this bare value.', unprobeable: unprobeable('Re-checked 2026-09-22 (redact-secret#662): no twilio.com page states a length or alphabet. twilio-cli\'s "must be 32 characters" check is provider code on github.com, which this project has not yet accepted as documentation.', '2026-09-22') },
  'twilio-api-key-secret': { tier: 'T2', corroboration: [th('twilioapikey/twilioapikey')], review: 'Twilio documents the API Key Secret\'s functional role but no character-class grammar. The bare 32-character alphanumeric shape, gated on a same-line API Key SID or the word "twilio", is corroborated by TruffleHog\'s twilioapikey detector; gitleaks\'s twilio-api-key rule instead targets the SK-prefixed SID, not this bare secret.', unprobeable: unprobeable('Re-checked 2026-09-22 (redact-secret#661, exhaustive): Twilio types the secret as a bare string everywhere; only the companion SK SID has a documented pattern, and a companion is not the secret.', '2026-09-22') },
  'telegram-bot-token': { tier: 'T2', pattern: '^[0-9]{5,}:[A-Za-z0-9_-]{34,}$', corroboration: [th('telegrambottoken/telegrambottoken')], review: 'Telegram\'s own documentation gives exactly one example token and no formal grammar. TruffleHog\'s telegrambottoken detector corroborates the general digits:secret shape; gitleaks\'s telegram-bot-api-token rule requires an additional literal uppercase "A" leading the secret segment that this contract does not require, so it is not cited.', unprobeable: unprobeable('Re-checked 2026-09-22 (redact-secret#660, exhaustive): core.telegram.org gives example tokens only. The Bot API server\'s acceptance check (tdlib/telegram-bot-api) is code on github.com, not documentation.', '2026-09-22') },
  // #128: a bare three-segment base64url value is lexically indistinguishable
  // from a JWT, so the pinned detector requires segment 1 to decode to a
  // numeric snowflake (crates/secret-scan-core/src/detectors/discord.rs's
  // module doc, product repo) — a structural constraint `pattern` alone
  // can't express. `validate` lets `lexical.mutate()` (benchmarks/operators/
  // lexical.ts) treat a `lexical.prefix-change` mutation of segment 1's
  // first byte as contract-invalid even though the regex still matches,
  // instead of asserting `same-detection` for a value the detector's own
  // documented rule rejects.
  // #159: the legacy 24/6/27 example is Discord's only documented shape, but
  // redact-secret/redact-secret#646's broad-discovery and web-search passes
  // (community write-ups, empirical reports and independent third-party tool
  // regexes, none a pinned scanner) converge on segment 3 growing from 27 to
  // 38 characters since roughly May 2022, and segment 1 growing from 24 to 26
  // characters once a bot's snowflake ID reaches 19 digits (2022-07-22
  // onward; base64url arithmetic over the ID, not provider text). The pattern
  // below covers exactly the three attested combinations (24/6/27, 24/6/38,
  // 26/6/38); 26/6/27 is excluded, since 19-digit IDs did not exist before
  // the segment-3 length change.
  'discord-bot-token': { tier: 'T2', pattern: '^(?:[A-Za-z0-9_-]{24}\\.[A-Za-z0-9_-]{6}\\.[A-Za-z0-9_-]{27}|[A-Za-z0-9_-]{24}\\.[A-Za-z0-9_-]{6}\\.[A-Za-z0-9_-]{38}|[A-Za-z0-9_-]{26}\\.[A-Za-z0-9_-]{6}\\.[A-Za-z0-9_-]{38})$', validate: value => /^[0-9]+$/.test(Buffer.from(value.split('.', 1)[0], 'base64url').toString('latin1')), corroboration: [th('discordbottoken/discordbottoken')], review: 'Discord\'s own single documented example matches the legacy 24/6/27 shape exactly, corroborated by TruffleHog\'s discordbottoken detector (its \\b-anchored regex matches only that exact width). Re-checked 2026-09-22 (redact-secret#646, redact-secret-benchmarks#159): no pinned scanner or Discord-owned page documents the current 24/6/38 or 26/6/38 shapes; the body-length change is corroborated only by third-party tool regexes and dated empirical reports (see redact-secret#646\'s broad-discovery and web-search passes), never by either pinned scanner, so it stays prose-only, not a `corroboration` entry. Gitleaks\'s discord-api-token and discord-client-secret rules target different, unrelated Discord credential shapes and are not cited.', unprobeable: unprobeable('Re-checked 2026-09-22 (redact-secret#646, exhaustive, including the current-shape passes for redact-secret-benchmarks#159): no Discord-owned page or OpenAPI spec states a segment count, encoding, length or alphabet for any issued shape; the reference shows one legacy-shape example header. An example is not a grammar.', '2026-09-22') },
  'sentry-user-auth-token': { tier: 'T2', pattern: '^sntryu_[0-9a-f]{64}$', corroboration: [gl], review: 'Sentry documents auth-token creation and scoping but no character-class grammar. Gitleaks\'s sentry-user-token rule matches this shape exactly; no pinned TruffleHog detector covers the user (non-organization) token.', unprobeable: unprobeable('Re-checked 2026-09-22 (redact-secret#659): no Sentry domain states the format. The sntryu_ prefix appears in sentry-cli\'s CHANGELOG and Sentry\'s source on github.com; whether that meets the provider-source bar is an open maintainer decision.', '2026-09-22') },
  'sentry-org-auth-token': { tier: 'T2', pattern: '^sntrys_eyJ[A-Za-z0-9+/]{26,}={0,2}_[A-Za-z0-9+/]{43}$', corroboration: [th('sentryorgtoken/sentryorgtoken'), gl], review: 'Sentry documents no character-class grammar. Gitleaks\'s sentry-org-token rule anchors on a stricter literal marker (a base64-encoded "region_url" JSON key) than this contract requires; TruffleHog\'s sentryorgtoken detector matches a coarser fixed-length body. Both corroborate the same sntrys_eyJ...-prefixed, underscore-separated, 43-byte-signature family.', unprobeable: unprobeable('Re-checked 2026-09-22 (redact-secret#658): no Sentry domain states the format. Sentry\'s merged RFC 0091 (getsentry/rfcs) documents the sntrys_ prefix and PREFIX_FACTS_SECRET structure, but is hosted on github.com; whether that meets the provider-source bar is an open maintainer decision.', '2026-09-22') },
  'datadog-api-key': { tier: 'T2', corroboration: [th('datadogapikey/datadogapikey')], review: 'Datadog documents the DD-API-KEY header and DD_API_KEY environment variable but no character-class grammar. The bare 32-character shape, gated on a same-line datadog/dd marker, is corroborated by TruffleHog\'s datadogapikey detector; the pinned gitleaks datadog-access-token rule instead matches a 40-character body (the application-key length), not this one.', twinSource: provider('https://github.com/DataDog/documentation/blob/2fa3c70e353a887edbbf57fe45aedbd3efd4419d/hugo/data/api/v1/full_spec.yaml#L571-L577', 'OpenAPI v1 ApiKey.key minLength/maxLength 32', 'Datadog\'s own OpenAPI spec (the source that renders the docs.datadoghq.com Key Management reference) fixes the v1 API key value at exactly 32 characters and names the DD-API-KEY header and DD_API_KEY variable (redact-secret#644). It backs a length twin only; the alphabet stays tool-corroborated and the positive tier is unchanged', '2026-09-22') },
  // #162/redact-secret#645: two live shapes. The legacy bare 40-hex shape has no grammar
  // of its own (gated on a same-line datadog/dd marker; still scored as policy in
  // detector-coverage, see CONTEXT_GATED) and keeps its own tool corroboration below. The
  // current ddapp_-prefixed shape carries real identifying grammar and earns this
  // contract's T1 tier; `pattern` covers that shape only.
  'datadog-application-key': { tier: 'T1', pattern: '^ddapp_[A-Za-z0-9]{34}$',
    providerSource: provider('https://docs.datadoghq.com/account_management/personal-access-tokens/', 'Access-token comparison table (mirrored at /account_management/service-access-tokens/)', 'Application keys column: "Identifiable prefix … ddapp_ (new)" establishes ddapp_ as the identifying prefix of current-format application keys. Body length (34 characters) and alphabet are not stated on this page; both are corroborated only by Datadog-owned code and a third-party partner doc, never by a provider-domain page', '2026-09-22'),
    corroboration: [
      th('datadogtoken/datadogtoken'), gl,
      { tool: 'DataDog/datadog-agent (Agent app-key validator)', label: 'pkg/privateactionrunner/util/keys.go', url: 'https://github.com/DataDog/datadog-agent/blob/main/pkg/privateactionrunner/util/keys.go#L16' },
      { tool: 'DataDog/datadog-agent (Agent log/config scrubber)', label: 'pkg/util/scrubber/default.go', url: 'https://github.com/DataDog/datadog-agent/blob/main/pkg/util/scrubber/default.go#L65-L70' },
      { tool: 'DataDog/cloudformation-template', label: 'aws_quickstart/datadog_agentless_saas.yaml AllowedPattern', url: 'https://github.com/DataDog/cloudformation-template/blob/master/aws_quickstart/datadog_agentless_saas.yaml' },
      { tool: 'DataDog/terraform-module-datadog-agentless-scanner', label: 'azure/arm ValidatePattern', url: 'https://github.com/DataDog/terraform-module-datadog-agentless-scanner/blob/main/azure/arm/agentless-api-call.ps1#L12' },
      { tool: 'AWS Secrets Manager partner doc', label: 'DatadogApplicationKey rotation guide', url: 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/mes-partner-DatadogApplicationKey.html' },
    ],
    review: 'Re-checked 2026-09-22 (redact-secret#162, product research at redact-secret#645): the legacy bare 40-character shape, gated on a same-line datadog/dd marker, is unchanged and corroborated only by TruffleHog\'s datadogtoken detector and gitleaks\'s datadog-access-token rule, neither of which accepts ddapp_. The current shape carries its own identifying grammar: a ddapp_ prefix Datadog documents on its own domain (personal-access-tokens and service-access-tokens comparison tables), plus a 34-character body corroborated only by Datadog-owned code (the Agent app-key validator, the Agent scrubber, CloudFormation and ARM templates) and AWS\'s partner doc. The Agent scrubber alone allows an underscore inside the body where every other Datadog-owned validator, and every corroborating source, states pure alphanumeric; that source is read as lenient-by-design, not as the real grammar, so `pattern` stays alphanumeric-only. Neither pinned scanner registers any rule for this shape.' },
  'grafana-service-account-token': { tier: 'T2', pattern: '^glsa_[A-Za-z0-9]{32}_[0-9A-Fa-f]{8}$', corroboration: [th('grafanaserviceaccount/grafanaserviceaccount'), gl], review: 'Grafana\'s own example request shows the glsa_ prefix but documents no full grammar. Gitleaks\'s grafana-service-account-token rule matches this two-segment shape exactly; TruffleHog\'s grafanaserviceaccount detector corroborates the same 41-byte total body length with a single wider character class that does not separately distinguish the hex checksum segment.', twinSource: provider('https://grafana.com/blog/new-in-grafana-9-1-service-accounts-are-now-ga/', 'glsa service-account token prefix', 'Grafana\'s own 9.1 GA post states service account tokens carry "a \'glsa\' prefix" and a checksum, without its position or width. It backs a prefix twin only; the checksum segment stays tool-corroborated and the positive tier is unchanged', '2026-09-22') },
  'grafana-cloud-access-policy-token': { tier: 'T2', pattern: '^glc_[A-Za-z0-9+/]{32,}$', corroboration: [gl], review: 'Grafana documents no grammar for Cloud access policy tokens beyond the glc_ prefix. Gitleaks\'s grafana-cloud-api-token rule matches this shape; the pinned TruffleHog grafana detector instead requires an additional literal eyJ JSON marker immediately after the prefix that this contract does not require, so it is not cited.', twinSource: provider('https://grafana.com/docs/grafana-cloud/machine-learning/ai-observability/get-started/grafana-cloud/', 'glc_ access-policy token prefix', 'grafana.com, immediately after creating a Cloud access policy token: "Tokens start with glc_". It backs a prefix twin only; body length and alphabet stay tool-corroborated and the positive tier is unchanged', '2026-09-22') },
  'new-relic-user-api-key': { tier: 'T2', pattern: '^NRAK-[A-Z0-9]{27}$', corroboration: [th('newrelicuserkey/newrelicuserkey'), gl], review: 'The NRAK- prefix comes from New Relic\'s own Terraform provider migration guide, not its API-keys documentation, so this is tool-corroborated rather than provider-documented here. Both gitleaks\'s new-relic-user-api-key rule and TruffleHog\'s newrelicuserkey detector match this shape exactly.', twinSource: provider('https://docs.newrelic.com/docs/infrastructure-as-code/terraform/terraform-intro/', 'NRAK- user-key prefix', 'docs.newrelic.com states "Most user keys begin with the prefix NRAK-". It backs a prefix twin only; body length and alphabet stay tool-corroborated and the positive tier is unchanged', '2026-09-22') },
  'new-relic-license-key': { tier: 'T2', pattern: '^([0-9a-f]{32}|eu01xx[0-9a-f]{26})FFFFNRAL$', corroboration: [th('newreliclicensekey/newreliclicensekey')], references: ['https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/'], review: 'Re-checked 2026-09-22 (redact-secret/redact-secret#656, #160): the currently issued generation is tool-corroborated. TruffleHog 3.97.4\'s newreliclicensekey detector matches exactly `\\b(([0-9a-f]{32}|eu01xx[0-9a-f]{26})FFFFNRAL)\\b` — a 40-character US or EU-region string ending in the literal FFFFNRAL; no gitleaks rule targets the license key at all. New Relic\'s own canonical page, docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/, still says only "a 40-character hexadecimal string" and is silent on the marker, contradicted by this shape; a second docs.newrelic.com page (see twinSource) independently states the marker in prose. Two earlier, still-issued generations are corroborated by neither pinned tool and stay outside this pattern: a legacy all-hex 40-character key with no marker, and an intermediate 36-hex-plus-NRAL key (without the FFFF segment) that New Relic\'s own docs-website repository\'s internal key-format check script labels the "OLD" ingest key — provider-authored code hosted on github.com, not accepted as documentation here, per this file\'s existing precedent for e.g. sentry-org-auth-token and twilio-auth-token. A fixture whose value does not match this pattern falls back to the policy classification already used for other multi-generation families (e.g. vault-token, slack-token).', twinSource: provider('https://docs.newrelic.com/docs/opentelemetry/integrations/ibm-mq/host/', 'ingest license key length and NRAL suffix', 'the page states, twice, in its NRDOT and OpenTelemetry Collector Contrib environment-variable examples: "New Relic ingest license key (40 chars, suffix NRAL)" — establishing total length 40 and a literal NRAL suffix. It backs a length twin and a marker/suffix twin only; the exact FFFFNRAL 8-byte marker, the 32-byte hex body before it and the eu01xx region form stay tool-corroborated and the positive tier is unchanged', '2026-09-22') },
  // #520/#81: legacy FCM HTTP/XMPP "server key" only. Service-account JSON
  // exports and AIza-prefixed keys are covered elsewhere (private-key,
  // google-api-key); no dedicated contract for those here, per product
  // repo's
  // https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-20-add-firebase-server-key-detection-and-client-config-discrimination.md.
  'firebase-server-key': { tier: 'T2', pattern: '^AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}$', corroboration: [{ tool: 'nuclei-templates (projectdiscovery)', label: 'firebase-fcm-server-key-disclosure.yaml', url: 'https://github.com/projectdiscovery/nuclei-templates/blob/8cf94b93a389a47bef77b89f8c8915b2755018f0/http/exposures/tokens/firebase-fcm-server-key-disclosure.yaml' }], review: 'Neither Google\'s current documentation nor either of this suite\'s pinned scanners publishes a rule for this shape: TruffleHog\'s own proto/detector_type.proto reserves both Firebase = 33 and FirebaseCloudMessaging = 102, explicitly marked "Not yet implemented", and no gitleaks 8.30.1 rule names Firebase at all. The single corroboration source above (not one of this suite\'s pinned, version-tracked scanners) pins the exact two-segment width — AAAA + 7 bytes + ":" + 140 bytes, 152 bytes total, regex AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140} — observed 2026-09-20 at the commit pinned in its URL. The AAAA prefix itself is additionally corroborated by two independent non-tool sources (a 2024 B4X developer-forum FCM-deprecation thread and an independent FCM-takeover security writeup, both observed 2026-09-20; recorded here as prose, not as further corroboration entries, since neither is a scanner). A shorter or longer segment, a missing or misplaced separator, or a wider embedded run is an intentional false negative rather than a fuzzy match. status-criteria.json requires a T1 providerSource for stable; this family cannot reach stable on this evidence and is expected to classify provisional.' },
  'terraform-cloud-token': { tier: 'T1', pattern: '^[A-Za-z0-9]{14}\\.atlasv1\\.[A-Za-z0-9]{67}$', providerSource: provider('https://developer.hashicorp.com/terraform/cloud-docs/api-docs/user-tokens', 'HCP Terraform/Enterprise 14+67-byte API token', 'three independent HCP Terraform API-reference pages (user-tokens, organization-tokens, team-tokens) each publish a full example token; every one of the three is exactly 14 bytes before the literal .atlasv1. marker and exactly 67 bytes after it, and the mirrored Terraform Enterprise organization-tokens page publishes the identical shape and example, confirming Cloud and Enterprise are one grammar rather than two. Neither page documents a checksum or any marker beyond the literal .atlasv1. tag', '2026-09-21'), corroboration: [th('terraformcloudpersonaltoken/terraformcloudpersonaltoken'), gl], review: 'Two independently maintained tools recognize the family without agreeing with each other on the exact width: gitleaks 8.30.1\'s hashicorp-tf-api-token/hashicorp-tf-password rules use a looser 60-70-byte range over a wider [A-Za-z0-9_=-] tail alphabet, while trufflehog 3.97.4\'s terraformcloudpersonaltoken detector matches all three official examples exactly at the 14/67 width. This contract freezes the tighter, provider-confirmed exact width (matching trufflehog, not gitleaks\' looser range) over the looser single-tool range, per the precedent already set for provider-backed exact-width contracts. HashiCorp\'s own documentation shows one identical grammar for user, organization, team, agent-pool and self-hosted Enterprise tokens, so one shape covers the full family with no branching logic. A malformed marker, a one-byte-short segment, or the documentation\'s own doc-style placeholder (xxxxxx.atlasv1.zzzzzzzzzzzzz, itself far short of the documented 14/67 widths) is a documented false negative rather than a fuzzy match.' },
  'pulumi-access-token': { tier: 'T1', pattern: '^pul-[a-f0-9]{40}$', providerSource: provider('https://www.pulumi.com/docs/reference/cloud-rest-api/access-tokens/', 'pul- prefixed opaque token', 'Pulumi\'s own Cloud REST API reference states, of the token-creation response: "The response includes the token ID and the tokenValue (prefixed with \'pul-\')." Its personal-access-tokens sibling page carries the identical sentence. Neither page states a length or alphabet for the value that follows the prefix', '2026-09-21'), corroboration: [th('pulumi/pulumi'), gl], review: 'Body length and alphabet are tool-corroborated, not provider-documented: gitleaks 8.30.1\'s pulumi-api-token rule and trufflehog 3.97.4\'s pulumi detector independently pin exactly 40 lowercase hexadecimal bytes after the prefix; neither registers any other length or alphabet, so this contract asserts none. Both tools pin the body to exactly 40 bytes rather than a floor, so a 39- or 41-byte body is an intentional false negative. github.com/plenoai/pleno-dlp, the second tool the product ADR cites for this family, is not one of this suite\'s pinned scanners and is recorded here only as prose, never as a pinned corroboration entry. All three token kinds (personal, organization, team) share this one prefix and body shape; Pulumi\'s own REST API reference documents no kind-specific prefix.' },
  'private-key': { tier: 'T1', providerSource: provider('https://www.rfc-editor.org/rfc/rfc7468', 'RFC 7468 textual encodings', 'BEGIN/END PRIVATE KEY labels and base64 body; the reviewed control is additionally parsed as PKCS#8 offline'), corroboration: [th('privatekey/privatekey')], structural: true, review: 'Legacy PEM bodies decode to public prose, not key material. Only the locally parseable Ed25519 PKCS#8 control is a positive.' },
  jwt: { tier: 'T1', providerSource: provider('https://www.rfc-editor.org/rfc/rfc7519', 'RFC 7519 compact serialization', 'three base64url segments; the reviewed control is additionally signature-verified offline'), corroboration: [th('jwt/jwt')], structural: true, review: 'Legacy JWT is expired, fabricated and HS256. TruffleHog explicitly skips HMAC JWTs; that is a policy difference. Re-checked 2026-09-20 (#46): RFC 7519 §3 requires base64url encoding for every segment; base64url never uses "+" (only base64\'s own alphabet does), backing an alphabet twin alongside the existing boundary (missing-signature) twin.' },
  'bearer-token': { tier: 'T3', references: ['https://www.rfc-editor.org/rfc/rfc6750#section-2.1'], review: 'Bearer is a transport scheme, not a provider-specific credential format. Generic value masking is project policy.', twinSource: provider('https://www.rfc-editor.org/rfc/rfc6750#section-2.1', 'RFC 6750 b64token ABNF', 'credentials = "Bearer" 1*SP b64token, with b64token limited to ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" and trailing "="; no length is stated', '2026-09-20') },
  'connection-string': { tier: 'T3', references: ['https://www.rfc-editor.org/rfc/rfc3986#section-3.2.1'], review: 'The password is the inner span; the whole URI is the authored envelope, so a whole-URI finding is covered with measured collateral instead of a footnote.', twinSource: provider('https://www.rfc-editor.org/rfc/rfc3986#section-3.2.1', 'RFC 3986 userinfo', 'userinfo is delimited from the host by "@" and the deprecated user:password form places the password after the first ":". The password value has no grammar, so twins mutate the context, not the value', '2026-09-20') },
  'otpauth-uri': { tier: 'T3', references: ['https://github.com/google/google-authenticator/wiki/Key-Uri-Format'], review: 'The seed is the inner span; the whole otpauth URI is the authored envelope.', twinSource: provider('https://github.com/google/google-authenticator/wiki/Key-Uri-Format', 'Key URI format, secret parameter', 'secret is REQUIRED and Base32 per RFC 3548 with padding omitted; no length is stated', '2026-09-20') },
  'generic-token': { tier: 'T3', references: [], review: 'An arbitrary literal in a sensitive field is a masking-policy case, not a provider-format ground truth.', twinSource: provider('https://github.com/redact-secret/redact-secret-benchmarks/blob/main/docs/decisions/2026-09-20-extend-twins-to-assignment-context.md', 'context-twin decision (#36)', 'no provider exists for an arbitrary literal. The recorded decision is that the twin keeps the value and mutates exactly one property of the assignment context; silence is project policy, never a format claim', '2026-09-20') },
};

export const evidence = (family?: string) => {
  const c = contracts[family ?? ''];
  if (!c) return [];
  return [...(c.providerSource ? [c.providerSource.url] : []), ...(c.corroboration ?? []).map(s => s.url), ...(c.references ?? [])];
};

const decide = (kind: Kind, tier: Tier, reason: string, family?: string): Assessment => ({ kind, tier, reason, ...(family ? { contract: family } : {}), sources: evidence(family) });
const policy = (reason: string, family?: string) => decide('policy', 'T3', reason, family);
const pending = (reason: string, family?: string, kind: Kind = 'must-redact') => decide(kind, 'T0', reason, family);
const control = (tier: Tier, reason: string, family?: string) => decide('must-not-flag', tier, reason, family);
/** `context` keeps the value and mutates one property of the assignment context (docs/decisions/2026-09-20-extend-twins-to-assignment-context.md). */
export const MUTATION_KINDS = ['length', 'alphabet', 'prefix', 'boundary', 'public-prefix', 'context'];
/**
 * A mutation axis is only valid when the mutated value falls outside every
 * format the provider issues — `fixtures:check` enforces this automatically
 * (`benchmarks/lib/lexical-separability.ts`): no `must-not-flag` fixture may
 * satisfy the frozen `pattern` of a `must-redact`, scored-tier positive that
 * declares the same `contract`. A conditional mutation (e.g. `.toUpperCase()`
 * of a byte that might already be case-insensitive) can silently no-op; prefer
 * an unconditional literal substitution. See
 * docs/decisions/2026-09-21-check-lexical-separability.md.
 */
const NEAR_MISS = 'Malformed-by-construction control: prefix-only, truncated, mis-delimited or public-material shape of a contracted family. Expected silence follows from construction.';
const PLACEHOLDER = 'Placeholder, reference, template, mask, documentation or ordinary text. Expected silence is project policy.';
const PUBLIC_OR_ENCODED = 'Public identifier or benign encoding constructed to contain no credential: silence follows from construction.';
const PUBLIC_ID = 'Public identifier constructed to contain no credential: silence follows from construction.';
const MILESTONE_CLOSED = 'Placeholder, tutorial, reference, template or mask control whose expected silence follows a closed redact-secret issue decision, not a universal secret definition.';
/** Decision 2 default (docs/decisions/2026-09-21-add-untargeted-benign-corpus.md): every `real-world-shapes`
 * fixture is T3 — ordinary content has no credential grammar to be malformed against, so "this file contains
 * no secret" rests on construction and this project's own policy, never provider or tool evidence. */
const REAL_WORLD_SHAPE = 'Real-world-shaped synthetic content, authored locally and not ingested from any external source (docs/decisions/2026-09-21-add-untargeted-benign-corpus.md). No provider or tool evidence grounds its silence: expected silence is project policy (T3).';
const bytesOf = (f: Fixture, r: Range) => new TextDecoder().decode(new TextEncoder().encode(f.content).slice(r.start, r.end));
export const matches = (family: string, value: string) => Boolean(contracts[family ?? '']?.pattern) && new RegExp(contracts[family ?? ''].pattern!).test(value);

/**
 * Benign-control (`must-not-flag`) taxonomy axis (#91). Kept out of `Assessment`
 * itself: the field is compared byte-for-byte against checked-in corpora
 * (`cases.ts`'s "Stale case assessment" check), so a new field there forces a
 * corpus-wide rewrite for zero measurement gain. `pending` is reserved for T0
 * controls with no reviewed rule and is never returned by `controlAxis` itself
 * — callers assign it once a control's tier is known to be T0.
 */
export type Axis = 'public-identifier' | 'placeholder' | 'reference' | 'ordinary-prose' | 'near-miss' | 'encoded-value' | 'pending';
export const AXES: readonly Axis[] = ['public-identifier', 'placeholder', 'reference', 'ordinary-prose', 'near-miss', 'encoded-value', 'pending'];

/**
 * `real-world-shapes`' (#95) own taxonomy — structurally separate from `AXES`
 * above (#91's family-control vocabulary). These controls are untargeted (no
 * `detectors`, no `fixture-detectors.json` entry) and must never be able to
 * count toward any family's `benign.minimumAxes`, even by accident: a value
 * from this vocabulary is never a member of `AXES`, so it can never be
 * mistaken for reviewed family-control evidence. See
 * docs/decisions/2026-09-21-add-untargeted-benign-corpus.md.
 */
export type RealWorldAxis = 'realworld-config' | 'realworld-logs' | 'realworld-lockfile' | 'realworld-source' | 'realworld-docs';
export const REAL_WORLD_AXES: readonly RealWorldAxis[] = ['realworld-config', 'realworld-logs', 'realworld-lockfile', 'realworld-source', 'realworld-docs'];

type ControlRule = { test: (f: Fixture) => boolean; tier: Tier; reason: string; axis: Exclude<Axis, 'pending'> | RealWorldAxis; family?: (f: Fixture) => string | undefined };
const idSuffix = (...suffixes: string[]) => (f: Fixture) => suffixes.some(s => f.id.endsWith(`-${s}`));
const idIn = (...ids: string[]) => (f: Fixture) => ids.includes(f.id);
const groupIn = (...groups: string[]) => (f: Fixture) => groups.includes(f.group);
const always = () => true;
const detectorFamily = (f: Fixture) => f.detectors?.[0];

/**
 * Single source for classifyControl's must-not-flag tier/reason AND
 * controlAxis's taxonomy (#91): every reviewed must-not-flag branch is one
 * row here, evaluated in category then array order (first match wins), so a
 * suffix/id/group added to one side cannot be missed by the other. Rows that
 * originate from the same pre-#91 branch keep that branch's exact `tier` and
 * `reason` (`classifyFixture`'s output is compared byte-for-byte against
 * checked-in corpora); only `axis` may distinguish them.
 */
const CONTROL_RULES: Record<string, ControlRule[]> = {
  'detector-coverage': [
    // #45: missing-marker/-identifier/-segment/-separator/-keyword/-json-marker cover a
    // required same-line or in-value marker the family's shape depends on; short-* covers
    // truncation below the reviewed minimum; invalid-alphabet and *-identifier-embedding
    // cover a broken character class or a boundary violation against adjacent text. All are
    // the same malformed-by-construction argument as the suffixes above, just per-family.
    { test: idSuffix('prefix-only', 'short-body', 'public-block', 'missing-signature', 'missing-value', 'no-password', 'missing-secret', 'short-secret', 'missing-marker', 'short-suffix', 'missing-identifier', 'short-token', 'missing-segment', 'short-final-segment', 'missing-json-marker', 'short-signature', 'short-key', 'missing-separator', 'short-checksum', 'missing-keyword', 'invalid-alphabet', 'leading-identifier-embedding', 'trailing-identifier-embedding', 'dash-identifier-embedding', 'short-current-final-segment', 'short-current-first-segment'), tier: 'T2', reason: NEAR_MISS, axis: 'near-miss', family: detectorFamily },
    { test: idSuffix('reference', 'public-url'), tier: 'T3', reason: PLACEHOLDER, axis: 'reference', family: detectorFamily },
    { test: idSuffix('mask', 'label-prose'), tier: 'T3', reason: PLACEHOLDER, axis: 'placeholder', family: detectorFamily },
    { test: idSuffix('ordinary-dotted-name', 'ordinary-prose'), tier: 'T3', reason: PLACEHOLDER, axis: 'ordinary-prose', family: detectorFamily },
    // #107: a provider's own public, non-secret identifier (e.g. pypi.org/help's
    // "unique identifier displayed on PyPI"), and an unrelated encoded value that
    // merely looks like one — distinct from the near-miss/placeholder/reference
    // axes above, per the taxonomy CONTRIBUTION.md names for the product.
    { test: idSuffix('public-id'), tier: 'T2', reason: PUBLIC_ID, axis: 'public-identifier', family: detectorFamily },
    { test: idSuffix('encoded-value'), tier: 'T2', reason: PUBLIC_OR_ENCODED, axis: 'encoded-value', family: detectorFamily },
  ],
  'sendgrid-regressions': [
    { test: idIn('short-id', 'short-secret', 'missing-separator', 'wrong-separator', 'wrong-prefix', 'prefix-only'), tier: 'T2', reason: NEAR_MISS, axis: 'near-miss', family: () => 'sendgrid-token' },
    { test: idIn('masked'), tier: 'T3', reason: PLACEHOLDER, axis: 'placeholder', family: () => 'sendgrid-token' },
    { test: idIn('documentation'), tier: 'T3', reason: PLACEHOLDER, axis: 'ordinary-prose', family: () => 'sendgrid-token' },
  ],
  'negative-controls': [
    { test: idIn('prefix-only', 'short-github', 'short-gitlab', 'short-npm', 'short-sendgrid', 'short-slack', 'pem-label-only'), tier: 'T2', reason: NEAR_MISS, axis: 'near-miss' },
    { test: idIn('sha256', 'commit-hash', 'uuid', 'public-url', 'public-email'), tier: 'T2', reason: PUBLIC_OR_ENCODED, axis: 'public-identifier' },
    { test: idIn('base64-text'), tier: 'T2', reason: PUBLIC_OR_ENCODED, axis: 'encoded-value' },
    { test: idIn('shell-reference', 'template-reference', 'token-variable'), tier: 'T3', reason: PLACEHOLDER, axis: 'reference' },
    { test: idIn('unicode-prose', 'numbers'), tier: 'T3', reason: PLACEHOLDER, axis: 'ordinary-prose' },
    { test: idIn('empty', 'whitespace', 'empty-assignment', 'redacted', 'masked', 'null-json'), tier: 'T3', reason: PLACEHOLDER, axis: 'placeholder' },
  ],
  accuracy: [
    { test: idIn('public-id'), tier: 'T2', reason: PUBLIC_ID, axis: 'public-identifier' },
    { test: idIn('placeholder'), tier: 'T3', reason: PLACEHOLDER, axis: 'reference' },
    { test: idIn('documentation', 'ordinary-text'), tier: 'T3', reason: PLACEHOLDER, axis: 'ordinary-prose' },
    { test: idIn('empty-config'), tier: 'T3', reason: PLACEHOLDER, axis: 'placeholder' },
  ],
  'token-contexts': [
    { test: idIn('env-reference'), tier: 'T3', reason: PLACEHOLDER, axis: 'reference' },
    { test: idIn('ordinary-text'), tier: 'T3', reason: PLACEHOLDER, axis: 'ordinary-prose' },
  ],
  'reference-syntax': [{ test: always, tier: 'T3', reason: PLACEHOLDER, axis: 'reference' }],
  'milestone-6-closed': [
    { test: groupIn('#254 · AWS documentation literals', '#255 · Tutorial URL passwords', '#256 · Connection placeholders', '#257 · Placeholder vocabulary', '#264 · Masked values'), tier: 'T3', reason: MILESTONE_CLOSED, axis: 'placeholder' },
    { test: groupIn('#262 · Line boundaries'), tier: 'T3', reason: MILESTONE_CLOSED, axis: 'near-miss' },
    { test: idIn('issue-265-properties'), tier: 'T3', reason: MILESTONE_CLOSED, axis: 'ordinary-prose' },
    { test: groupIn('#263 · Fully delimited templates', '#266 · Flow collections', '#278 · Code reference exclusions', '#280 · Secret-manager grammars'), tier: 'T3', reason: MILESTONE_CLOSED, axis: 'reference' },
    { test: idIn('issue-265-secret-key-ref'), tier: 'T3', reason: MILESTONE_CLOSED, axis: 'reference' },
  ],
  // #95: untargeted, own axis vocabulary (REAL_WORLD_AXES, disjoint from AXES) — `group` doubles as
  // the shape label since every fixture belongs to exactly one of the five shapes.
  'real-world-shapes': REAL_WORLD_AXES.map(axis => ({ test: groupIn(axis), tier: 'T3' as Tier, reason: REAL_WORLD_SHAPE, axis })),
};

/** Pure sibling of classifyControl's must-not-flag branch: same table, axis instead of tier/reason. Null means no reviewed rule (fail closed in loadCases). */
export function controlAxis(category: string, f: Fixture): Axis | RealWorldAxis | null {
  if (f.twinOf) return null;
  for (const rule of CONTROL_RULES[category] ?? []) if (rule.test(f)) return rule.axis;
  return null;
}

function classifyControl(category: string, f: Fixture): Assessment {
  if (f.twinOf) {
    const family = f.detectors?.[0];
    if (!contracts[family ?? '']) throw new Error(`Unknown twin contract: ${f.id}`);
    if (!f.mutation || !f.mutationKind) throw new Error(`Twin without mutation: ${f.id}`);
    if (f.mutationKind === 'context') {
      if (contracts[family ?? ''].tier !== 'T3') throw new Error(`Context twin on a contracted value grammar: ${f.id}`);
      return control('T3', `Negative twin of ${f.twinOf}: ${f.mutation}. The value is unchanged and exactly one property of the assignment context differs; expected silence is project policy, as the positive's expectation is.`, family);
    }
    const documented = f.mutationKind === 'public-prefix' && contracts[family ?? ''].tier === 'T1';
    return control(documented ? 'T1' : 'T2', `Negative twin of ${f.twinOf}: ${f.mutation}. ${documented ? 'The provider documents this namespace as public, so silence is provider-evidenced.' : 'Exactly one structural property differs from the positive; silence follows from construction.'}`, family);
  }
  for (const rule of CONTROL_RULES[category] ?? []) {
    if (rule.test(f)) return control(rule.tier, rule.reason, rule.family?.(f));
  }
  return pending('No reviewed control rule for this input. Excluded from comparative scores until reviewed.', undefined, 'must-not-flag');
}

/** Values with no grammar of their own, recognized only beside a same-line identifier or keyword. */
const CONTEXT_GATED = ['twilio-auth-token', 'twilio-api-key-secret', 'datadog-api-key', 'datadog-application-key'];

export function classifyFixture(category: string, f: Fixture): Assessment {
  if (!f.expected.some(r => (r.role ?? 'secret') === 'secret')) return classifyControl(category, f);
  if (category === 'common-formats') {
    const family = f.detectors?.[0];
    if (!contracts[family ?? '']) throw new Error(`Unknown format contract: ${f.id}`);
    return decide('must-redact', contracts[family ?? ''].tier, f.formatReason!, family);
  }
  if (category === 'accuracy') return policy('Legacy SYNTHETIC/filler example; not an independently reviewed credential format. Original regression expectation retained.');
  if (category === 'reference-syntax') return policy('Literal value in a sensitive field; tests generic masking rather than a provider credential.');
  if (category === 'milestone-6-closed') {
    if ([254, 257, 263, 264, 280].includes(f.issue!)) return policy('Mutated documentation, placeholder, template, mask or reference. Expected masking follows a redact-secret issue decision, not a universal secret definition.');
    return policy('Issue-specific literal/password range; expectations are the project’s masking policy.');
  }
  if (category === 'detector-coverage') {
    const family = f.detectors![0];
    const value = bytesOf(f, f.expected[0]);
    // #162: datadog-application-key's ddapp_-prefixed shape carries its own identifying
    // grammar (unlike its grammar-less legacy sibling this list otherwise covers), so a
    // fixture whose value matches that grammar skips the blanket policy return below and
    // is scored on the contract's T1 tier instead, same as any other lexically evidenced family.
    if (['bearer-token', 'connection-string', 'otpauth-uri', 'generic-token', ...CONTEXT_GATED, 'azure-devops-personal-access-token'].includes(family) && !(family === 'datadog-application-key' && matches(family, value)))
      return policy(contracts[family ?? ''].review!, family);
    if (family === 'aws-access-key') return policy('Standalone access-key ID without secret key/session token. Some legacy ASIA values also use digits outside the base32 alphabet.', family);
    if (family === 'shopify-token') return policy('Token shape is plausible, but the shop domain the contract requires is absent.', family);
    if (family === 'vault-token' && matches(family, value)) return policy('Token shape meets the provider’s prefix and minimum-length documentation, but the Vault endpoint the contract requires is absent.', family);
    if (family === 'private-key' || family === 'jwt') return policy(contracts[family ?? ''].review!, family);
    if (contracts[family ?? ''].tier === 'T0') return pending(contracts[family ?? ''].review!, family);
    // Variant support must not be inferred from a related family name. Each reason below is
    // this family's own re-checked evidence gap (#45), not a shared placeholder.
    if (family === 'linear-token' && value.startsWith('lin_oauth_'))
      return pending('Re-checked 2026-09-22 (#127, following #45): Linear documents no OAuth access-token grammar, and neither pinned tool registers a lin_oauth_ pattern — trufflehog\'s linearapi and gitleaks\'s linear-api-key detectors both match only lin_api_. redact-secret#551 briefly turned this guard\'s floor into an exact length on tool-agreement grounds shared with other families, but redact-secret#570/#571 (closed; no tracked issue remains open) found that regressed real oauth tokens and restored it to an open, unevidenced floor (RunLength::OpenFloor) — confirming, not resolving, the same gap. Pending until a pinned scanner registration or Linear documentation describes this shape.', family);
    if (family === 'stripe-token' && /^(?:sk_org_|whsec_)/.test(value))
      return pending('Re-checked 2026-09-22 (#127, following #45): Stripe\'s key-types page names sk_org_ organization keys and the webhooks page documents whsec_ as the signing-secret prefix, but neither page nor the pinned trufflehog (`[rs]k_live_[a-zA-Z0-9]{20,247}`, live-only) or gitleaks (`(?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{10,99}`, no org alternative) stripe rules establish a body length or alphabet for either prefix. redact-secret#513 is closed (PR #533): the product adopted both prefixes on that same provider prefix documentation alone, recording its own 20-byte alnum-run floor as a support-policy choice, not independent evidence. This corpus\'s bar is unmet on that same evidence, not on an open product issue: pending until a pinned scanner registers a rule or Stripe documents a body length or alphabet for either prefix.', family);
    if (family === 'slack-token' && value.startsWith('xwfp-'))
      return pending('Re-checked 2026-09-22 (#127, following #45): the Slack tokens page documents the xwfp- prefix for workflow tokens but states no section widths or alphabet for it, the same gap already recorded for xoxb-; the pinned trufflehog slack detector covers only xoxb-/xoxp-/xoxa-/xoxr-, and gitleaks\'s slack-webhook-url rule matches only the full hooks.slack.com/workflows/... URL, not a bare token. redact-secret#512 is closed (PR #532): the product completed xoxp-/xoxe-/xoxe.xoxb-/xoxe.xoxp- on tool-corroborated section grammar but explicitly left xapp- and xwfp- as an unpromoted interim guard, since xwfp- has no tool source at all and clears neither this project\'s two-source nor provider-plus-tool bar. This corpus\'s bar is unmet on that same evidence, not on an open product issue: pending until a pinned scanner registers a rule or Slack documents xwfp-\'s section widths or alphabet.', family);
    if (!matches(family, value)) return policy('Legacy prefix-plus-random-body does not meet the reviewed length, alphabet or internal structure. Historical positive expectation retained only as a regression.', family);
    return decide('must-redact', contracts[family ?? ''].tier, 'Synthetic value matches the pinned lexical format contract. Provider issuance, payload/checksum validity and liveness are not claimed.', family);
  }
  // context-edges' non-GitHub contexts (fixtures/generated/context-families.mjs) name their own family.
  const family = category === 'sendgrid-regressions' ? 'sendgrid-token'
    : category === 'context-edges' ? f.detectors?.[0] ?? 'github-token'
    : category === 'token-contexts' ? 'github-token'
    : category === 'credential-formats' ? ({ ghp: 'github-token', gho: 'github-token', ghu: 'github-token', ghs: 'github-token', ghr: 'github-token', gitlab: 'gitlab-token', npm: 'npm-token', sendgrid: 'sendgrid-token', slack: 'slack-token' } as Record<string, string>)[f.id.split('-')[0]] : null;
  // Same keyword-gated families detector-coverage scores as policy: no value grammar to match.
  if (category === 'context-edges' && family && CONTEXT_GATED.includes(family)) return policy(contracts[family].review!, family);
  if (family && f.expected.every(r => matches(family, bytesOf(f, r))))
    return decide('must-redact', contracts[family ?? ''].tier, 'Source-backed lexical shape in an explicit context test; repeated shapes are not independent provider coverage.', family);
  return pending('No reviewed classification rule. Excluded from comparative scores until input and expectation have been reviewed.');
}

export function validateContracts() {
  for (const [family, c] of Object.entries(contracts)) {
    if (!TIERS.includes(c.tier)) throw new Error(`Invalid contract tier: ${family}`);
    if (c.tier === 'T1' && !(c.providerSource?.url && c.providerSource.observedAt && c.providerSource.formatVersion)) throw new Error(`T1 contract without provider source: ${family}`);
    if (c.tier === 'T2' && !c.corroboration?.length) throw new Error(`T2 contract without corroboration: ${family}`);
    if (c.tier !== 'T1' && c.providerSource) throw new Error(`Provider source on non-T1 contract: ${family}`);
    if (c.twinSource && !(c.twinSource.url && c.twinSource.observedAt && c.twinSource.formatVersion && c.twinSource.covers)) throw new Error(`Incomplete twin source: ${family}`);
    if (c.unprobeable && !(c.unprobeable.reason?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.unprobeable.observedAt))) throw new Error(`Un-probeable without reason or date: ${family}`);
    if (c.unprobeable && c.twinSource) throw new Error(`Un-probeable contract with a twin source: ${family}`);
  }
}

export function validateAssessment(f: Fixture) {
  const a = f.assessment;
  if (!a || !KINDS.includes(a.kind) || !TIERS.includes(a.tier) || typeof a.reason !== 'string' || !a.reason.trim() || !Array.isArray(a.sources)) throw new Error(`Missing or invalid assessment: ${f.id}`);
  const secrets = f.expected.filter(r => (r.role ?? 'secret') === 'secret');
  if (a.kind === 'must-not-flag') {
    if (secrets.length) throw new Error(`Control with secret spans: ${f.id}`);
    if (f.twinOf && (typeof f.mutation !== 'string' || !f.mutation.trim() || !MUTATION_KINDS.includes(f.mutationKind!))) throw new Error(`Invalid twin metadata: ${f.id}`);
    if (!f.twinOf && (f.mutation || f.mutationKind)) throw new Error(`Mutation without twin: ${f.id}`);
    if (a.tier === 'T1' && !(f.twinOf && contracts[a.contract ?? '']?.providerSource)) throw new Error(`T1 control without provider evidence: ${f.id}`);
    return;
  }
  if (f.twinOf) throw new Error(`Positive fixture cannot be a twin: ${f.id}`);
  if (!secrets.length) throw new Error(`Positive fixture without secret span: ${f.id}`);
  if (a.tier === 'T0') return;
  if (a.kind === 'policy') { if (a.tier !== 'T3') throw new Error(`Policy rows are T3: ${f.id}`); return; }
  if (a.tier === 'T3') throw new Error(`must-redact cannot be T3: ${f.id}`);
  const contract = contracts[a.contract ?? ''];
  if (!contract || contract.tier !== a.tier || !a.sources.length) throw new Error(`Missing format evidence: ${f.id}`);
  if (!contract.pattern && !contract.structural) throw new Error(`No reviewed format validator: ${f.id}`);
  const values = secrets.map(r => bytesOf(f, r));
  if (a.contract === 'aws-access-key') {
    if (values.length !== 2 || !new RegExp(contract.pattern!).test(values[0]) || !/^[A-Za-z0-9/+]{40}$/.test(values[1])) throw new Error(`Incomplete AWS pair: ${f.id}`);
  } else if (contract.pattern && !values.every(v => new RegExp(contract.pattern!).test(v))) throw new Error(`Format contract violation: ${f.id}`);
  if (a.contract === 'shopify-token' && !/[a-zA-Z0-9-]+\.myshopify\.com/.test(f.content)) throw new Error(`Missing shop domain: ${f.id}`);
  if (a.contract === 'vault-token' && !/https:\/\/[a-zA-Z0-9-]+\.hashicorp\.cloud/.test(f.content)) throw new Error(`Missing Vault endpoint: ${f.id}`);
}
