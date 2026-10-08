# Current public PII comparison, 2026-10-08

## Recorded execution

[Run 37785871226](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37785871226)
succeeded on benchmark commit `9c1b82cc3b98396f2b5db89a1aff7bec97a702ae`,
first attempt. The Ubuntu 24.04 job took 47 seconds; the comparison driver took
7,080 milliseconds. The pinned Linux pii-eval engine is
`b1c097e40bad456e52f904f626cca00b69c45612`, protocol pii-v1 revision 2, schema 1.4.

The comparison launches eight fresh public/synthetic runs, with two scanner
replays each. It also records 40 installed-product activation captures across
native Node and forced WASM. It executes no protected run or profile-cost job.

Baseline is the published npm beta.14 source
`0c62fd38bca75c5b28b042dc79789b708ebf1d17`. Candidate is the unpublished,
qualified beta.14 build at `5696d7e1a2950bdf54fa21244f351e1c4b171f25`, core PR #1284,
qualification run `37772337995`. Their installed core tree digests are distinct.
The release label alone cannot distinguish them.

The [record](../../benchmarks/pii-candidate-comparison/record.json) binds the
workflow repository, immutable commit, run ID and attempt, upload archive digest,
receipt and all eight durable public artifacts. The collector verified the
GitHub metadata and archive, the plan at the workflow commit, and the production
consumer before writing those copies. `npm run pii:comparison:check` rechecks
the committed evidence without dispatching or running a scanner.

## Descriptive comparison

| Population | Memberships | Compared metric cells | Changed cells | Available deltas | Withheld deltas |
| --- | ---: | ---: | ---: | ---: | ---: |
| oracle-plan | 146 | 710 | 0 | 47 | 663 |
| qualification-plan | 266 | 360 | 0 | 75 | 285 |
| diagnostic-balanced | 477 | 530 | 0 | 118 | 412 |
| benign-heavy-stress | 299 | 530 | 0 | 119 | 411 |

The cells preserve exact family, language and control strata, quantities and
denominators. All 2,130 cell objects agree between the two products. Of these,
359 supply an available numeric delta, each zero; 1,771 retain a withheld delta.
Withheld or unresolved quantities are not converted into a measured zero.
Memberships overlap across views and are not pooled into an independent sample.

This is public measurement evidence. It is not a support qualification verdict,
primitive-validator conformance, an independent ground-truth review, a cost-gate
acceptance, or a protected result. Existing beta.13 official authority and pins
remain unchanged. Current qualification remains pending for all six families;
historical beta.11 qualification remains separately identified.

## Cost and failure provenance

The owner approved one public comparison job, maximum 15 minutes, eight runs
with two replays each and zero protected runs. Initial
[run 37784294084](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37784294084)
failed in the dispatch guard after about 20 seconds: an artifact-only JSON
parser rejected valid null fields in GitHub metadata. No scanner started and no
measurement artifact was produced. The failure is retained in
`benchmarks/pii-candidate-comparison/failed-dispatches.json`.

The fix retains the strict parser for committed decisions and uses normal JSON
for GitHub metadata. Six focused tests and a read-only check against the actual
GitHub response passed. The owner explicitly renewed approval for one corrected
dispatch; the successful run uses that new committed decision. No automatic
retry or approval reuse occurred.

## Remaining sequence

#615 has current installed activation evidence, but trusted qualification binding
remains separate. #616 has the official paired comparison and an explicit
primitive-validator seam reason. #618 consumes the recorded evidence and keeps
historical qualification, current measurement, withheld values and peer readiness
distinct. #647 exposes the exact candidate and current pending reasons in both
matrix paths and reconciles released credential families against the canonical
qualification view.

#667 and #619 remain unexecuted pending operational custody and their exact
public, cost and membership prerequisites. A preparation inventory does not
approve a deferral, create an epoch, spend an attempt, or permit the historical
local custodian to impersonate the new route. #576 requires reviewed actual peer
adapters and same-population observations before an accuracy comparison.

## Core consumption contract

The dedicated committed `benchmarks/support-matrix-from-view.json` carries the
canonical credential qualification view, its policy revision and three exact
population identities. Each population preserves the four measured scanner
versions and build kinds; the published package identity is derived only when
all product manifests agree on a released version. Finding-type keys use the
pinned detector inventory and existing reviewed arrival table, never observed
scanner output. The separate `schemas/support-matrix-from-view-v1.json` shares
the existing family/current-PII contracts and validates this source envelope.

No measurement timestamp or product source commit is inferred from a release
label. Core retains the historical legacy matrix and v1 distribution feed;
canonical qualification-view consumption uses a distinct v2 feed because the
old contract requires a non-null measurement timestamp. Current PII comparison
identity is separate from the released credential manifests and leaves all six
current PII family qualifications pending.
