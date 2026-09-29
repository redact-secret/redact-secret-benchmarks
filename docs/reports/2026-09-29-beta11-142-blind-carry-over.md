# Beta.11 custodian-held blind aggregate: carry-over to candidate 8f97f14

> **Superseded** by the carry-over to `ec9224d`: [`2026-09-29-beta11-142-blind-carry-over-ec9224d.md`](2026-09-29-beta11-142-blind-carry-over-ec9224d.md). Kept as history.

Issue: [#382](https://github.com/redact-secret/redact-secret-benchmarks/issues/382)
(parent [#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376)).
Machine-readable record: [`2026-09-29-beta11-142-blind-carry-over.json`](2026-09-29-beta11-142-blind-carry-over.json).
Carried aggregate: [`2026-09-28-beta11-142-blind-aggregate.json`](2026-09-28-beta11-142-blind-aggregate.json)
(`runId` `1604909b-bd5f-4c2d-b3ab-3eb1bc7d0d61`, report
[`2026-09-28-beta11-142-blind-evaluation.md`](2026-09-28-beta11-142-blind-evaluation.md)).

## What this record is

The `beta11-e1` blind aggregate was measured at product `1db8ff38b16e50c51229eb27025452952bf621e1` (façade
`4681ad42…29a1`). It was **not** measured at the re-bound Beta.11 candidate
`8f97f14d97d73b76602e5396eea35d0a5a4f0eb3`. By maintainer decision of 2026-09-29 it is **carried over** to `8f97f14`:
no new epoch is opened and no blind run is made against `8f97f14`. This departs from rule 2 of
[`docs/specs/blind-evaluation.md`](../specs/blind-evaluation.md) (a new product change needs a new candidate identity and
a new run), and this record is where that departure and its basis are written down.

The custodian's private fixtures were not read, touched or scanned for this record. The `beta11-e1` epoch was not run
again, so it is not spent a second time. The aggregate file and its report are unchanged. The evidence class stays
`custodian-blind`, and the numbers stay outside public qualification, regression totals and support status.

The carried figures, unchanged: leaked spans 3/66 (4.6%, Wilson 95% [1.6%, 12.5%]), false alarms 0/27 ([0, 12.5%]),
unstable 0/84.

## Basis

### (a) The product diff 1db8ff3..8f97f14

| Merge | Scope | Detector source |
| --- | --- | --- |
| #960, #961, #959, #966, #967, #969, #976 | CI, manifests, issue forms, conformance records, docs | none |
| #968 (#951–#955) | crate, package and binding READMEs | none (READMEs only; the core façade hash changes because its README is packed) |
| #991 (`37a1dcd7`), #980 backlog: #981, #982, #983, #984, #985, #986, #989 | 63 files under `crates/`, `packages/`, `bindings/` | performance only; output byte-identical by design |
| #992 (`8f97f14d`), #990 | 18 files | intentional output changes limited to the #990 layouts below |

The #990 layout classes, where output may change by design:

1. `generic-token` streaming false negatives on name forms joined to an operator on a later line (incremental only).
2. `bearer-token`: `Proxy-Authorization:` with `Bearer <12–15 bytes>` on the next line (incremental only), and
   `X-Authorization: Bearer <16+ bytes>` now reported whole-input.
3. A lone `\r` as a line end for every line-reading detector (LF and CRLF unchanged), which also closes the Twilio CLI
   table under `\r`-only endings.
4. A PII phone `ext` marker at a line end reads as an empty extension (PII only, off by default).

### (b) Whole-input and incremental differential over the full public corpus

Both builds are the product `benchmark:candidate` tarballs. The 1db8ff3 side is the build of candidate run
`e56cd9b2-cedc-4e2f-ad93-70062bc3990d`: core `4681ad42…29a1`, node `63f98456…ab60`, wasm `af063366…b1a1`. The 8f97f14
side is the build of run `74888ff3-48ed-4459-b2fe-32906a5a95cb`: core `467111e2…f74c`, node `b32d462b…29f8`, wasm
`b6819bfd…e966`. Each was installed into an isolated directory and driven through the default `@redact-secret/core`
entry (Node addon, default detectors, built-in policy, default placeholder) on Node v22.16.0, darwin-arm64.

- **Corpus:** every fixture of every category in `benchmarks/categories.json` at benchmarks `63a855fab948060fdbd85aa89f852fba0e9d33ec`.
  That is 4,992 fixtures in 46 categories: the 45 scored categories (4,768 fixtures, corpus `a89a8d11…6d75`) plus the
  calibration-only `shadow-scoring-authored`.
- **Per fixture:**
  - whole-input `scanAndRedact`: output text and every finding field;
  - three incremental sessions with the #427 limits (input 1 MiB, buffered 64 KiB, token 8 KiB, multiline 16 KiB):
    one append per line, 64-unit chunks and 7-unit chunks. Each records every append and finalize result: the
    concatenated output text and every finding field, or the error code.
- **Result: 0 of 4,992 fixtures differ**, whole-input or incremental, in any field. The two per-fixture digest files
  are byte-identical (SHA-256 `f8cb201e9cb644c9ded6832827b0e7471613dabf0711e1f525d94186005b2317` on both sides). No
  difference falls outside the #990 classes because no difference occurs. Consistent with that, the public corpus
  has no `X-Authorization` header and no lone `\r`, and its one `Proxy-Authorization` fixture
  (`policy-qualified-credentials--bearer-token-proxy-header`) has the header and value on one line.
- **Incremental versus whole input:** on both sides the same 2 fixtures (`context-edges--long-prefix` and
  `context-edges--long-prefix-twin`) fail every incremental partition with `TOKEN_LIMIT_EXCEEDED`, the declared token
  limit. Every other fixture's incremental output equals its whole-input output in all three partitions.
- **Positive controls:** the harness can see the #990 changes. On synthetic layouts it separates the two builds:
  - `X-Authorization: Bearer <synthetic 29 bytes>`: 1db8ff3 reports nothing whole-input or incremental, and 8f97f14
    reports one `bearer_token` in both.
  - `Proxy-Authorization:` followed by `Bearer <synthetic 14 bytes>` on the next line: both builds report it
    whole-input, but only 8f97f14 reports it with one append per line.

  So the zero above is a result, not a blind spot of the harness.

The scored candidate runs agree. All 4,768 fixture outcomes and all 110 family records are identical at `1db8ff3` and
`8f97f14` in candidate mode ([`../../evidence/860/8f97f14/README.md`](../../evidence/860/8f97f14/README.md)). The
credential mixed-document parity set shows 0 divergences at `8f97f14` with outcomes equal to `1db8ff3`
([`../../evidence/860/381/README.md`](../../evidence/860/381/README.md)).

## What the carry-over does not establish

- It does not measure `8f97f14` on the blind fixtures. It shows that, on 4,992 public fixtures, `8f97f14` produces the
  same findings and output as `1db8ff3`, and that its only intended changes are layouts that the public corpus does not
  contain. A blind fixture that happens to use one of the #990 layouts could read differently at `8f97f14`. Three of those
  changes alter whole-input output (the `X-Authorization` report, lone `\r` line ends, the phone extension), and the
  record cannot say how often the blind fixtures use them.
- The independence limits of the original aggregate apply unchanged: procedural separation only, wide intervals.

## Reproduce

From the benchmarks root at `63a855fab948060fdbd85aa89f852fba0e9d33ec`, install each side's three tarballs into its
own directory (`old/`, `new/`) as `scanners/candidate.mjs` `installCandidate` does. Then run
`node run.mjs <side> <benchmarks root> <side>.json` for both sides and compare the two JSON files.

<details><summary><code>run.mjs</code> (writes digests and finding metadata only, never fixture text)</summary>

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [side, benchRoot, out] = process.argv.slice(2);
const core = await import(pathToFileURL(path.resolve(side, 'node_modules/@redact-secret/core/dist/index.js')).href);
await core.initialize?.();
const limits = { maxInputCodeUnits: 1 << 20, maxBufferedCodeUnits: 64 << 10, maxTokenCodeUnits: 8 << 10, maxMultilineCodeUnits: 16 << 10 };
const sha = s => createHash('sha256').update(s).digest('hex');
const norm = fs => fs.map(f => ({ ...f }));
function chunks(text, size) { const out = []; let i = 0; while (i < text.length) { let j = Math.min(text.length, i + size); const c = text.charCodeAt(j - 1); if (j < text.length && c >= 0xd800 && c <= 0xdbff) j++; out.push(text.slice(i, j)); i = j; } return out; }
function lines(text) { return text.match(/[^\n]*\n|[^\n]+$/g) ?? []; }
function incremental(parts) {
  try {
    const s = core.createIncrementalSanitizer({ limits });
    const results = parts.map(p => s.append(p)); results.push(s.finalize());
    return { status: 'ok', text: results.map(r => r.text).join(''), findings: results.map(r => norm(r.findings)) };
  } catch (e) { return { status: 'error', code: e?.code ?? String(e?.message ?? e).slice(0, 60) }; }
}
const categories = JSON.parse(readFileSync(path.join(benchRoot, 'benchmarks/categories.json'), 'utf8'));
const rows = {};
for (const category of categories) {
  const corpus = JSON.parse(readFileSync(path.join(benchRoot, category.corpus), 'utf8'));
  for (const fixture of corpus.fixtures) {
    const content = fixture.content; if (typeof content !== 'string') continue;
    let whole; try { const r = core.scanAndRedact(content); whole = { status: 'ok', text: r.text, findings: norm(r.findings) }; } catch (e) { whole = { status: 'error', code: e?.code }; }
    const inc = { lines: incremental(lines(content)), c64: incremental(chunks(content, 64)), c7: incremental(chunks(content, 7)) };
    const d = x => x.status === 'ok' ? { text: sha(x.text), findings: JSON.stringify(x.findings) } : { error: x.code };
    rows[`${category.id}--${fixture.id}`] = { whole: d(whole), lines: d(inc.lines), c64: d(inc.c64), c7: d(inc.c7),
      incEqWhole: Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, v.status === 'ok' && whole.status === 'ok' && v.text === whole.text])) };
  }
}
writeFileSync(out, JSON.stringify({ count: Object.keys(rows).length, rows }));
```

</details>
