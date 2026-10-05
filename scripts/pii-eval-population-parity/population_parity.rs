//! Benchmark-owned driver (redact-secret-benchmarks #664) for the upstream parity comparator.
//!
//! The comparator itself is pii-eval's, unmodified (`tests/parity/*`, ADR 0012). This file only points it at another
//! dataset: the oracle input and the oracle export of one benchmark population (or one population-family cell), and writes
//! a sanitized summary of what the comparator found. Integers, enumerated states, synthetic case ids and layer names only.
//!
//! It is copied into `crates/pii-eval-cli/tests/` of a pristine checkout of the pinned pii-eval commit by
//! `scripts/run-pii-population-dual-run.mjs`; it is not part of pii-eval.
//!
//! Environment: `PII_POPULATION_DIR` (a directory holding `parity-input.json` and `oracle-export.json`) and
//! `PII_POPULATION_OUT` (the summary file to write).

mod parity;

use std::collections::BTreeMap;

use parity::compare::{Class, RateView, compare};
use parity::json::*;
use parity::model::*;
use pii_eval_contracts::Sha256Digest;
use serde_json::{Value, json};

fn rate(r: &RateView) -> Value {
    match r {
        RateView::Null => json!({"kind": "null"}),
        RateView::Insufficient => json!({"kind": "insufficient-evidence"}),
        RateView::Value { point, bound, n } => json!({"kind": "value", "point": point, "bound": bound, "n": n}),
    }
}

#[test]
fn population_parity_summary() {
    let dir = std::path::PathBuf::from(std::env::var("PII_POPULATION_DIR").expect("PII_POPULATION_DIR"));
    let out = std::env::var("PII_POPULATION_OUT").expect("PII_POPULATION_OUT");
    let input_bytes = std::fs::read(dir.join("parity-input.json")).expect("parity-input.json");
    let export_bytes = std::fs::read(dir.join("oracle-export.json")).expect("oracle-export.json");
    let ds = Dataset {
        input: serde_json::from_slice(&input_bytes).expect("input is JSON"),
        export: serde_json::from_slice(&export_bytes).expect("export is JSON"),
        input_bytes,
        export_bytes,
    };
    let cmp = compare(&ds);
    let rc = rust_corpus(&ds.input, &ds.export);

    let mut aggregated: BTreeMap<(String, String, String), (u64, Vec<Value>, Vec<&'static str>)> = BTreeMap::new();
    for d in &cmp.differences {
        let key = (d.layer.to_owned(), d.ids.join("+"), d.aspect.clone());
        let e = aggregated.entry(key).or_insert((0, Vec::new(), d.ids.clone()));
        e.0 += 1;
        e.1.push(json!({"scanner": d.scanner, "subject": d.subject, "oracle": d.oracle, "rust": d.rust}));
    }
    let differences: Vec<Value> = aggregated
        .into_iter()
        .map(|((layer, ids, aspect), (count, rows, id_list))| {
            let class = id_list.iter().map(|i| parity::compare::class_of(i)).min().unwrap_or(Class::Unexplained);
            json!({"layer": layer, "aspect": aspect, "ids": id_list, "idsKey": ids, "class": class.as_str(), "count": count, "rows": rows})
        })
        .collect();
    let canonical: BTreeMap<String, Value> = cmp
        .canonical
        .iter()
        .map(|(scanner, views)| {
            let metrics: BTreeMap<String, Value> = views
                .iter()
                .map(|(id, v)| {
                    (word(id), json!({
                        "status": word(&v.status), "effectiveN": v.effective_n, "rate": rate(&v.rate),
                        "counts": {"eligible": v.counts.eligible, "measured": v.counts.measured, "numerator": v.counts.numerator,
                                   "unresolved": v.counts.unresolved, "notMeasured": v.counts.not_measured,
                                   "notApplicable": v.counts.not_applicable, "total": v.counts.total},
                    }))
                })
                .collect();
            (scanner.clone(), json!(metrics))
        })
        .collect();
    let snapshot = rc.snapshot();
    let summary = json!({
        "schema": "pii-eval-population-parity-summary/1",
        "inputSha256": Sha256Digest::of_bytes(&ds.input_bytes).as_str(),
        "exportSha256": Sha256Digest::of_bytes(&ds.export_bytes).as_str(),
        "compared": cmp.compared,
        "refusedByEngineMethods": rc.refused.len(),
        "unexplained": cmp.unexplained().len(),
        "compatibilityDifferences": cmp.compat_differences().len(),
        "differences": differences,
        "canonicalMetrics": canonical,
        "engineSnapshot": {
            "semanticDigest": serde_json::to_value(&snapshot).expect("snapshot")["semanticDigest"].clone(),
            "body": serde_json::to_value(&rc.body).expect("body"),
        },
    });
    std::fs::write(out, format!("{}\n", serde_json::to_string_pretty(&summary).unwrap())).unwrap();
    // The compatibility protocol promises equality: a difference there is a defect, never classified.
    assert_eq!(cmp.compat_differences().len(), 0, "the compatibility layers must not differ");
}
