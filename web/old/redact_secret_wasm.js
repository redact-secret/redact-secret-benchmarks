/* @ts-self-types="./redact_secret_wasm.d.ts" */

/**
 * A finding as returned to JavaScript: safe metadata plus the policy
 * action, with no matched value.
 */
export class Finding {
    static __wrap(ptr) {
        const obj = Object.create(Finding.prototype);
        obj.__wbg_ptr = ptr;
        FindingFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    static __unwrap(jsValue) {
        if (!(jsValue instanceof Finding)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FindingFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_finding_free(ptr, 0);
    }
    /**
     * The policy action: `"redact"`, `"block"`, `"warn"`, or `"allow"`.
     * @returns {string}
     */
    get action() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.finding_action(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * The confidence: `"low"`, `"medium"`, or `"high"`.
     * @returns {string}
     */
    get confidence() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.finding_confidence(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * The id of the detector that produced this finding.
     * @returns {string}
     */
    get detector() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.finding_detector(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * The deterministic finding id (`finding-1`, `finding-2`, ...).
     * @returns {string}
     */
    get id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.finding_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * The invisible-character-obfuscation signal: `"none"` or
     * `"invisible-characters"`.
     * @returns {string}
     */
    get obfuscation() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.finding_obfuscation(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * The finding's range, in UTF-16 code units.
     * @returns {Range}
     */
    get range() {
        const ret = wasm.finding_range(this.__wbg_ptr);
        return Range.__wrap(ret);
    }
    /**
     * The finding type (for example `"jwt"`, `"aws_access_key_id"`).
     * @returns {string}
     */
    get type() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.finding_type(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) Finding.prototype[Symbol.dispose] = Finding.prototype.free;

/**
 * The immutable result of one `append` or `finalize` call: the sanitized
 * text that call resolved, and the findings it finalized.
 */
export class IncrementalResult {
    static __wrap(ptr) {
        const obj = Object.create(IncrementalResult.prototype);
        obj.__wbg_ptr = ptr;
        IncrementalResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IncrementalResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_incrementalresult_free(ptr, 0);
    }
    /**
     * The findings this call finalized, in input order.
     * @returns {Finding[]}
     */
    get findings() {
        const ret = wasm.incrementalresult_findings(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * The sanitized text this call resolved. May be empty when the call
     * only extended the retained, still-unresolved window.
     * @returns {string}
     */
    get text() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.incrementalresult_text(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) IncrementalResult.prototype[Symbol.dispose] = IncrementalResult.prototype.free;

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
    static __wrap(ptr) {
        const obj = Object.create(IncrementalSanitizer.prototype);
        obj.__wbg_ptr = ptr;
        IncrementalSanitizerFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IncrementalSanitizerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_incrementalsanitizer_free(ptr, 0);
    }
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
    abort() {
        const ret = wasm.incrementalsanitizer_abort(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
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
     * @param {string} chunk
     * @returns {IncrementalResult}
     */
    append(chunk) {
        const ptr0 = passStringToWasm0(chunk, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.incrementalsanitizer_append(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return IncrementalResult.__wrap(ret[0]);
    }
    /**
     * Supplies the end-of-input boundary, resolving whatever the session
     * still retained, and moves it to `finalized`.
     *
     * # Errors
     *
     * The same codes as `append`, minus the input-limit failure, plus
     * `INVALID_STATE` outside the `accepting` state — including a second
     * `finalize`, which never re-emits the first one's result.
     * @returns {IncrementalResult}
     */
    finalize() {
        const ret = wasm.incrementalsanitizer_finalize(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return IncrementalResult.__wrap(ret[0]);
    }
    /**
     * The session's lifecycle state: `"accepting"`, `"finalized"`,
     * `"aborted"`, or `"failed"`.
     * @returns {string}
     */
    get state() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.incrementalsanitizer_state(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) IncrementalSanitizer.prototype[Symbol.dispose] = IncrementalSanitizer.prototype.free;

/**
 * A `[start, end)` range in UTF-16 code units, matching how JavaScript
 * indexes a `string`.
 */
export class Range {
    static __wrap(ptr) {
        const obj = Object.create(Range.prototype);
        obj.__wbg_ptr = ptr;
        RangeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RangeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_range_free(ptr, 0);
    }
    /**
     * The exclusive end offset, in UTF-16 code units.
     * @returns {number}
     */
    get end() {
        const ret = wasm.range_end(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * The inclusive start offset, in UTF-16 code units.
     * @returns {number}
     */
    get start() {
        const ret = wasm.range_start(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) Range.prototype[Symbol.dispose] = Range.prototype.free;

/**
 * The redacted text alongside every finding that produced it.
 */
export class ScanAndRedactResult {
    static __wrap(ptr) {
        const obj = Object.create(ScanAndRedactResult.prototype);
        obj.__wbg_ptr = ptr;
        ScanAndRedactResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ScanAndRedactResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_scanandredactresult_free(ptr, 0);
    }
    /**
     * Every finding `scan` produced for `input`, in the same order `scan`
     * alone would have returned them.
     * @returns {Finding[]}
     */
    get findings() {
        const ret = wasm.scanandredactresult_findings(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * `input` with every `redact`/`block` finding replaced by its
     * placeholder.
     * @returns {string}
     */
    get text() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.scanandredactresult_text(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) ScanAndRedactResult.prototype[Symbol.dispose] = ScanAndRedactResult.prototype.free;

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
 * @param {number} max_input_code_units
 * @param {number} max_buffered_code_units
 * @param {number} max_token_code_units
 * @param {number} max_multiline_code_units
 * @param {Function | null} [policy]
 * @param {Function | null} [formatter]
 * @returns {IncrementalSanitizer}
 */
export function createIncrementalSanitizer(max_input_code_units, max_buffered_code_units, max_token_code_units, max_multiline_code_units, policy, formatter) {
    const ret = wasm.createIncrementalSanitizer(max_input_code_units, max_buffered_code_units, max_token_code_units, max_multiline_code_units, isLikeNone(policy) ? 0 : addToExternrefTable0(policy), isLikeNone(formatter) ? 0 : addToExternrefTable0(formatter));
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return IncrementalSanitizer.__wrap(ret[0]);
}

/**
 * Idempotently initializes the module: builds and caches the built-in
 * detector registry. Every later call, whether or not the first one
 * succeeded, returns the same cached result without rebuilding it.
 *
 * # Errors
 *
 * Returns a fixed, input-free `INITIALIZATION_FAILED` error when the
 * registry cannot be built.
 * @param {string[]} pii
 */
export function initialize(pii) {
    const ptr0 = passArrayJsValueToWasm0(pii, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.initialize(ptr0, len0);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

/**
 * Returns the canonical credentials/PII activation identity.
 * Returns the canonical PII activation identity.
 *
 * # Errors
 *
 * Returns a fixed initialization error before successful initialization.
 * @returns {string}
 */
export function piiActivation() {
    let deferred2_0;
    let deferred2_1;
    try {
        const ret = wasm.piiActivation();
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
            ptr1 = 0; len1 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Returns the detector profile this artifact was compiled for: `"full"`
 * (the default build) or `"common"` (`--no-default-features`)
 * (`decision-define-detector-profile-and-pack-contract`).
 *
 * Fixed at compile time and readable before [`initialize`], so a loader can
 * reject an artifact of the wrong profile before using it.
 * @returns {string}
 */
export function profile() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.profile();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

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
 * @param {string} input
 * @param {Finding[]} findings
 * @param {Function | null} [formatter]
 * @param {number | null} [max_input_bytes]
 * @param {number | null} [max_findings]
 * @returns {string}
 */
export function redact(input, findings, formatter, max_input_bytes, max_findings) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayJsValueToWasm0(findings, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.redact(ptr0, len0, ptr1, len1, isLikeNone(formatter) ? 0 : addToExternrefTable0(formatter), isLikeNone(max_input_bytes) ? Number.MAX_SAFE_INTEGER : (max_input_bytes) >>> 0, isLikeNone(max_findings) ? Number.MAX_SAFE_INTEGER : (max_findings) >>> 0);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

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
 * @param {string} input
 * @param {Function | null} [policy]
 * @param {number | null} [max_input_bytes]
 * @param {number | null} [max_findings]
 * @param {Uint8Array | null} [ruleset]
 * @returns {Finding[]}
 */
export function scan(input, policy, max_input_bytes, max_findings, ruleset) {
    const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(ruleset) ? 0 : passArray8ToWasm0(ruleset, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.scan(ptr0, len0, isLikeNone(policy) ? 0 : addToExternrefTable0(policy), isLikeNone(max_input_bytes) ? Number.MAX_SAFE_INTEGER : (max_input_bytes) >>> 0, isLikeNone(max_findings) ? Number.MAX_SAFE_INTEGER : (max_findings) >>> 0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayJsValueFromWasm0(ret[0], ret[1]);
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v3;
}

/**
 * Scans `input`, then redacts it with the resulting findings, in one call.
 * Equivalent to calling [`scan`] followed by [`redact`] with its result, but
 * without a round trip through JavaScript for the intermediate findings.
 *
 * # Errors
 *
 * The same as [`scan`] and [`redact`].
 * @param {string} input
 * @param {Function | null} [policy]
 * @param {Function | null} [formatter]
 * @param {number | null} [max_input_bytes]
 * @param {number | null} [max_findings]
 * @param {Uint8Array | null} [ruleset]
 * @returns {ScanAndRedactResult}
 */
export function scanAndRedact(input, policy, formatter, max_input_bytes, max_findings, ruleset) {
    const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(ruleset) ? 0 : passArray8ToWasm0(ruleset, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.scanAndRedact(ptr0, len0, isLikeNone(policy) ? 0 : addToExternrefTable0(policy), isLikeNone(formatter) ? 0 : addToExternrefTable0(formatter), isLikeNone(max_input_bytes) ? Number.MAX_SAFE_INTEGER : (max_input_bytes) >>> 0, isLikeNone(max_findings) ? Number.MAX_SAFE_INTEGER : (max_findings) >>> 0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ScanAndRedactResult.__wrap(ret[0]);
}

/**
 * Returns the shared product version.
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_string_get_92ab86bb19cbc12f: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_7bbd9cceba9949ad: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.call(arg1, arg2, arg3);
            return ret;
        }, arguments); },
        __wbg_finding_new: function(arg0) {
            const ret = Finding.__wrap(arg0);
            return ret;
        },
        __wbg_finding_unwrap: function(arg0) {
            const ret = Finding.__unwrap(arg0);
            return ret;
        },
        __wbg_new_a32a1ab6c6655abe: function(arg0, arg1) {
            const ret = new Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_bebc3f4757acf305: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_set_a377297433dfea63: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_name_6e2a5da46a9ae1e7: function(arg0, arg1, arg2) {
            arg0.name = getStringFromWasm0(arg1, arg2);
        },
        __wbindgen_generic_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./redact_secret_wasm_bg.js": import0,
    };
}

const FindingFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_finding_free(ptr, 1));
const IncrementalResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_incrementalresult_free(ptr, 1));
const IncrementalSanitizerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_incrementalsanitizer_free(ptr, 1));
const RangeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_range_free(ptr, 1));
const ScanAndRedactResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_scanandredactresult_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('redact_secret_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
