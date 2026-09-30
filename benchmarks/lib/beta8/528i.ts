import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, R1014, RULINGS_R1_R3, RULINGS_R2_R8, B528, product, at, src, GITLEAKS_CONFIG, splitGraduated } from './528-sources.ts';

// Issue #528, slice i: Beta.12 contract for Honeycomb ingest keys (#1014 rank 9, READY for ingest keys; handoff
// docs/audits/evidence/1014/honeycomb.md; product redact-secret#1034). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1: the hc[x]ik_ prefix and the rule that the key value is the key id and secret concatenated (docs); the 58-byte
// body (the docs placeholder, the libhoney-go 64-byte gate and fixtures, R5); the [a-z0-9] alphabet (the SDK fixtures,
// R5); and the classic ingest form ^hc[a-z]ic_[a-z0-9]{58}$ in two provider SDKs (R1). The management key
// (hc[x]mk_ + 26 + : + 32) is ISSUANCE-GATED on the alphabet of both segments and is not claimed: it is authored neither
// as a positive nor as a control, and only an hc?mk_ + 58 prefix twin touches it.
export const issue = '528i';

const DOCS = 'https://docs.honeycomb.io/api/authentication';
const LIBHONEY_GO = 'https://github.com/honeycombio/libhoney-go/blob/02e9dbf361012fafbe8698f429b65630500dc10a/libhoney.go#L74-L178';
const LIBHONEY_GO_TEST = 'https://github.com/honeycombio/libhoney-go/blob/02e9dbf361012fafbe8698f429b65630500dc10a/libhoney_test.go#L1225-L1250';
const LIBHONEY_PY = 'https://github.com/honeycombio/libhoney-py/blob/11b59417c1df1d97384dc5e870f2ea462da02b80/libhoney/client.py#L11-L18';
const TERRAFORM = 'https://github.com/honeycombio/terraform-provider-honeycombio/blob/b74d528db4fd6d01503e1b46a13b2146a38b45c3/internal/provider/api_key_resource.go#L417-L420';
const HANDOFF = handoff('honeycomb.md');
const RESEARCH = researchTable('5900447540');

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1039). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'honeycomb-api-key': {
    tier: 'T1',
    pattern: '^hc[a-z]i[kc]_[a-z0-9]{58}$',
    providerSource: provider(DOCS, 'Honeycomb docs "Authentication": ingest key ids carry hc[x]ik_, "The character shown as [x] varies and is assigned at key creation", and "The key value is the Key ID and Secret concatenated with no separator" (58-byte placeholder body); honeycombio/libhoney-go libhoney.go (02e9dbf, 2026-04-14): classicIngestKeyRegex ^hc[a-z]ic_[a-z0-9]*$ applied when len(key) == 64, with 64-byte hcxik_/hcxic_ fixtures; honeycombio/libhoney-py client.py (11b5941): ^hc[a-z]ic_[a-z0-9]{58}$; re-checked 2026-09-29', 'hc + one [a-z] + ik_ (environment) or ic_ (classic) + exactly 58 [a-z0-9], 64 in all', at),
    corroboration: [],
    references: [DOCS, LIBHONEY_GO, LIBHONEY_GO_TEST, LIBHONEY_PY, TERRAFORM, HANDOFF, RESEARCH, HANDOFF_INDEX, R1014, RULINGS_R1_R3, RULINGS_R2_R8, product(1034), B528],
    review: 'Arrival evidence (#528, product redact-secret#1034; #1014 handoff honeycomb.md, READY for ingest keys). An ingest key sends telemetry into an environment; a leak lets anyone write or spoof events and burn the quota, and ingest keys are routinely pasted into OpenTelemetry collector configs. T1: the prefix and the id-plus-secret concatenation are the docs; the 58-byte body is the docs placeholder, the libhoney-go 64-byte gate and its fixtures (R5); the alphabet is the SDK fixtures (R5) and the classic regex in two provider SDKs (R1). The whole 64 bytes are the span. Excluded: key ids alone (hc?ik_/hc?mk_ + 26, and hc?lk_ and hc?en_ ids; non-secret, shown in the UI and API), 22-character configuration keys and 32-hex classic keys (no distinctive shape; credentials that generic context covers, so authored neither way) and the management key (ISSUANCE-GATED on the alphabet of both segments; authored neither way). Neither pinned peer reads this shape: trufflehog 3.97.4 Honeycomb wants a 32-hex or 22-alphanumeric value near the keyword Honeycomb (classic and configuration keys), and gitleaks 8.30.1 has no rule.',
    fields: [
      field({ field: 'prefix', claim: 'hc + one [a-z] type letter + ik_ (environment ingest) or ic_ (classic ingest)', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS, 'hc[x]ik_; [x] varies'), src(LIBHONEY_PY, 'hc[a-z]ic_'), src(LIBHONEY_GO, 'classicIngestKeyRegex')] }),
      field({ field: 'body-length', claim: 'exactly 58 after the prefix (a 26-byte key id then the secret, concatenated with no separator); 64 in all', basis: 'provider-example', status: 'frozen', sources: [src(DOCS, 'the ingest placeholder body is 58'), src(LIBHONEY_GO, 'len(key) == 64 gate'), src(LIBHONEY_GO_TEST, '64-byte fixtures'), src(TERRAFORM, 'key.ID + key.Secret'), src(RULINGS_R2_R8, 'R5')] }),
      field({ field: 'alphabet', claim: 'lowercase alphanumeric [a-z0-9]', basis: 'provider-code', status: 'frozen', sources: [src(LIBHONEY_PY, '[a-z0-9]{58}'), src(LIBHONEY_GO_TEST, 'fixtures'), src(RULINGS_R2_R8, 'R5')] }),
      field({ field: 'key-id', claim: 'the first 26 body bytes are the key id, a non-secret identifier; hc?lk_ and hc?en_ are configuration-key and environment ids', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS)], note: 'A key id or environment id alone is a benign control; a 26-byte run fails the 58-byte body.' }),
      field({ field: 'management-key', claim: 'hc[x]mk_ + 26 + : + 32: prefix and lengths documented, alphabet of both segments not found', basis: 'provider-documentation', status: 'unresolved', sources: [src(DOCS), src(HANDOFF, 'ISSUANCE-GATED')], note: 'Not this family. Authored neither as a positive nor as a control; only an hcxmk_ + 58 prefix twin exists.' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'transport', claim: 'HONEYCOMB_API_KEY; the X-Honeycomb-Team header; OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=…; an OpenTelemetry collector headers map; libhoney.Init', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'test axes')] }),
      field({ field: 'peer-lag', claim: 'trufflehog 3.97.4 Honeycomb is keyword-gated on Honeycomb with \\b([0-9a-f]{32}|[0-9a-zA-Z]{22})\\b (classic and configuration keys), so it lags on every ingest key and stays unmapped; no Honeycomb rule in gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src(th('honeycomb/honeycomb').url, 'Honeycomb'), src(GITLEAKS_CONFIG, 'no honeycomb rule')] }),
    ],
  },
};

const split = splitGraduated(authored, ['honeycomb-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'honeycomb-api-key': 'documented-24' };
