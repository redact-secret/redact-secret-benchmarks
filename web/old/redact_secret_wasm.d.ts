/* tslint:disable */
/* eslint-disable */

/**
 * A finding as returned to JavaScript: safe metadata plus the policy
 * action, with no matched value.
 */
export class Finding {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The policy action: `"redact"`, `"block"`, `"warn"`, or `"allow"`.
     */
    readonly action: string;
    /**
     * The confidence: `"low"`, `"medium"`, or `"high"`.
     */
    readonly confidence: string;
    /**
     * The id of the detector that produced this finding.
     */
    readonly detector: string;
    /**
     * The deterministic finding id (`finding-1`, `finding-2`, ...).
     */
    readonly id: string;
    /**
     * The invisible-character-obfuscation signal: `"none"` or
     * `"invisible-characters"`.
     */
    readonly obfuscation: string;
    /**
     * The finding's range, in UTF-16 code units.
     */
    readonly range: Range;
    /**
     * The finding type (for example `"jwt"`, `"aws_access_key_id"`).
     */
    readonly type: string;
}

/**
 * The immutable result of one `append` or `finalize` call: the sanitized
 * text that call resolved, and the findings it finalized.
 */
export class IncrementalResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The findings this call finalized, in input order.
     */
    readonly findings: Finding[];
    /**
     * The sanitized text this call resolved. May be empty when the call
     * only extended the retained, still-unresolved window.
     */
    readonly text: string;
}

/**
 * A bounded incremental sanitization session over the built-in detectors.
 *
 * Lifecycle: a session starts `accepting` and accepts `append`, `finalize`,
 * and `abort`. Exactly one successful `finalize` moves it to `finalized`;
 * `abort` moves it to `aborted`; any limit, detector, policy, or
 * placeholder failure moves it to `failed`. All three are terminal: every
 * later operation raises `INVALID_STATE`, and every terminal transition
 * discards the plaintext the core still retained.
 */
export class IncrementalSanitizer {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Discards every byte the session still retained and moves it to
     * `aborted`, emitting no further text or findings.
     *
     * # Errors
     *
     * `INVALID_STATE` outside the `accepting` state, so a second `abort`,
     * or an `abort` after `finalize`, is rejected rather than silently
     * accepted.
     */
    abort(): void;
    /**
     * Appends `chunk` to the logical input and returns whatever became
     * resolvable.
     *
     * Text and findings are emitted only once their detection window is
     * closed, so a call that only extends an open construct returns an
     * empty `text` and no findings. Nothing is lost: a later `append` or
     * `finalize` emits it.
     *
     * # Errors
     *
     * `INVALID_STATE` outside the `accepting` state,
     * `INPUT_LIMIT_EXCEEDED`, `BUFFER_LIMIT_EXCEEDED`,
     * `TOKEN_LIMIT_EXCEEDED`, or `MULTILINE_LIMIT_EXCEEDED` when a declared
     * limit is reached, and `DETECTOR_FAILURE`, `INVALID_CANDIDATE`,
     * `POLICY_FAILURE`, `INVALID_POLICY_ACTION`, `PLACEHOLDER_FAILURE`, or
     * `INVALID_PLACEHOLDER` when resolving a closed unit fails. Every one
     * of them is terminal and discards retained plaintext.
     */
    append(chunk: string): IncrementalResult;
    /**
     * Supplies the end-of-input boundary, resolving whatever the session
     * still retained, and moves it to `finalized`.
     *
     * # Errors
     *
     * The same codes as `append`, minus the input-limit failure, plus
     * `INVALID_STATE` outside the `accepting` state — including a second
     * `finalize`, which never re-emits the first one's result.
     */
    finalize(): IncrementalResult;
    /**
     * The session's lifecycle state: `"accepting"`, `"finalized"`,
     * `"aborted"`, or `"failed"`.
     */
    readonly state: string;
}

/**
 * A `[start, end)` range in UTF-16 code units, matching how JavaScript
 * indexes a `string`.
 */
export class Range {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The exclusive end offset, in UTF-16 code units.
     */
    readonly end: number;
    /**
     * The inclusive start offset, in UTF-16 code units.
     */
    readonly start: number;
}

/**
 * The redacted text alongside every finding that produced it.
 */
export class ScanAndRedactResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Every finding `scan` produced for `input`, in the same order `scan`
     * alone would have returned them.
     */
    readonly findings: Finding[];
    /**
     * `input` with every `redact`/`block` finding replaced by its
     * placeholder.
     */
    readonly text: string;
}

/**
 * Creates a bounded incremental sanitization session over the built-in
 * detectors (`decision-define-runtime-bindings`).
 *
 * `policy`, when given, is called once per finalized finding as
 * `(findingMetadata, context) => string`, returning `"redact"`, `"block"`,
 * `"warn"`, or `"allow"`. `formatter`, when given, is called once per
 * replaced finding as `(findingMetadata, context) => string`. Both receive
 * only safe metadata, never the input or a matched value, and both are
 * numbered across the whole session rather than per call.
 *
 * # Errors
 *
 * Returns `INVALID_LIMITS` when the four limits are non-positive or do not
 * satisfy the documented relationship between them.
 */
export function createIncrementalSanitizer(max_input_code_units: number, max_buffered_code_units: number, max_token_code_units: number, max_multiline_code_units: number, policy?: Function | null, formatter?: Function | null): IncrementalSanitizer;

/**
 * Idempotently initializes the module: builds and caches the built-in
 * detector registry. Every later call, whether or not the first one
 * succeeded, returns the same cached result without rebuilding it.
 *
 * # Errors
 *
 * Returns a fixed, input-free `INITIALIZATION_FAILED` error when the
 * registry cannot be built.
 */
export function initialize(pii: string[]): void;

/**
 * Returns the canonical credentials/PII activation identity.
 * Returns the canonical PII activation identity.
 *
 * # Errors
 *
 * Returns a fixed initialization error before successful initialization.
 */
export function piiActivation(): string;

/**
 * Returns the detector profile this artifact was compiled for: `"full"`
 * (the default build) or `"common"` (`--no-default-features`)
 * (`decision-define-detector-profile-and-pack-contract`).
 *
 * Fixed at compile time and readable before [`initialize`], so a loader can
 * reject an artifact of the wrong profile before using it.
 */
export function profile(): string;

/**
 * Redacts `input` using `findings` (as returned by [`scan`] for the same
 * `input`), replacing every `redact`/`block` finding's span with a
 * placeholder from `formatter` (or the built-in default formatter when
 * `formatter` is omitted).
 *
 * `formatter`, when given, is called as `formatter(findingMetadata,
 * context)` and must return the placeholder string.
 * `maxInputBytes`/`maxFindings`, when omitted, use the core's default whole-
 * input bound (`decision-bound-whole-input-operations-by-default`).
 *
 * # Errors
 *
 * Returns a fixed `NOT_INITIALIZED` error, without inspecting `input`, when
 * [`initialize`] has not yet succeeded. Otherwise returns the sanitized,
 * input-free error the core redaction pass or a failing `formatter` call
 * produces, including `INPUT_LIMIT_EXCEEDED`, `FINDING_LIMIT_EXCEEDED`, and
 * `INVALID_LIMITS`.
 */
export function redact(input: string, findings: Finding[], formatter?: Function | null, max_input_bytes?: number | null, max_findings?: number | null): string;

/**
 * Scans `input` for secrets, in registration order with the documented
 * overlap precedence, and evaluates `policy` (or the built-in default
 * policy when `policy` is omitted) once per finding.
 *
 * `policy`, when given, is called as `policy(findingMetadata, context)` and
 * must return one of `"redact"`, `"block"`, `"warn"`, or `"allow"`.
 * `maxInputBytes`/`maxFindings`, when omitted, use the core's default whole-
 * input bound (`decision-bound-whole-input-operations-by-default`).
 *
 * # Errors
 *
 * Returns a fixed `NOT_INITIALIZED` error, without inspecting `input`, when
 * [`initialize`] has not yet succeeded. Otherwise returns the sanitized,
 * input-free error the core pipeline or a failing `policy` call produces,
 * including `INPUT_LIMIT_EXCEEDED`, `FINDING_LIMIT_EXCEEDED`, and
 * `INVALID_LIMITS`. Returns `INVALID_RULESET` when `ruleset` is given and
 * does not parse.
 *
 * `ruleset`, when given, is a caller-supplied declarative ruleset
 * (`decision-define-declarative-detector-ruleset-contract`); its declared
 * detectors register after every built-in, so a ruleset detector can add
 * detections but never outrank a built-in's resolved finding.
 */
export function scan(input: string, policy?: Function | null, max_input_bytes?: number | null, max_findings?: number | null, ruleset?: Uint8Array | null): Finding[];

/**
 * Scans `input`, then redacts it with the resulting findings, in one call.
 * Equivalent to calling [`scan`] followed by [`redact`] with its result, but
 * without a round trip through JavaScript for the intermediate findings.
 *
 * # Errors
 *
 * The same as [`scan`] and [`redact`].
 */
export function scanAndRedact(input: string, policy?: Function | null, formatter?: Function | null, max_input_bytes?: number | null, max_findings?: number | null, ruleset?: Uint8Array | null): ScanAndRedactResult;

/**
 * Returns the shared product version.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_finding_free: (a: number, b: number) => void;
    readonly __wbg_incrementalresult_free: (a: number, b: number) => void;
    readonly __wbg_incrementalsanitizer_free: (a: number, b: number) => void;
    readonly __wbg_range_free: (a: number, b: number) => void;
    readonly __wbg_scanandredactresult_free: (a: number, b: number) => void;
    readonly createIncrementalSanitizer: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly finding_action: (a: number) => [number, number];
    readonly finding_confidence: (a: number) => [number, number];
    readonly finding_detector: (a: number) => [number, number];
    readonly finding_id: (a: number) => [number, number];
    readonly finding_obfuscation: (a: number) => [number, number];
    readonly finding_range: (a: number) => number;
    readonly finding_type: (a: number) => [number, number];
    readonly incrementalresult_findings: (a: number) => [number, number];
    readonly incrementalresult_text: (a: number) => [number, number];
    readonly incrementalsanitizer_abort: (a: number) => [number, number];
    readonly incrementalsanitizer_append: (a: number, b: number, c: number) => [number, number, number];
    readonly incrementalsanitizer_finalize: (a: number) => [number, number, number];
    readonly incrementalsanitizer_state: (a: number) => [number, number];
    readonly initialize: (a: number, b: number) => [number, number];
    readonly piiActivation: () => [number, number, number, number];
    readonly profile: () => [number, number];
    readonly range_end: (a: number) => number;
    readonly range_start: (a: number) => number;
    readonly redact: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly scan: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly scanAndRedact: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
    readonly scanandredactresult_findings: (a: number) => [number, number];
    readonly scanandredactresult_text: (a: number) => [number, number];
    readonly version: () => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
