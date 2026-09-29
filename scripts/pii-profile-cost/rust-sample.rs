use std::io::{self, Read};
use std::time::Instant;

use base64::Engine as _;
use redact_secret::{default_placeholder_formatter, scan, DefaultPolicy, DetectorRegistry, IncrementalLimits,
    IncrementalSanitizer, PiiSelection};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Input {
    credential_profile: String,
    selectors: Vec<String>,
    expected_activation: String,
    expected_artifact: String,
    workload_base64: String,
    chunks_base64: Vec<String>,
}

fn memory_status(name: &str) -> Option<u64> {
    let status = std::fs::read_to_string("/proc/self/status").ok()?;
    let line = status.lines().find(|line| line.starts_with(name))?;
    line.split_whitespace().nth(1)?.parse::<u64>().ok().map(|kib| kib * 1024)
}

fn unavailable(reason: &str) -> Value {
    json!({ "status": "not-applicable", "reasonCode": reason })
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut encoded = String::new();
    io::stdin().read_to_string(&mut encoded)?;
    if encoded.lines().count() != 1 { return Err("invalid input framing".into()); }
    let input: Input = serde_json::from_str(&encoded)?;
    if !matches!(input.credential_profile.as_str(), "full" | "common") { return Err("invalid credential profile".into()); }
    let workload = String::from_utf8(base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(input.workload_base64)?)?;
    let mut chunks = Vec::with_capacity(input.chunks_base64.len());
    for chunk in input.chunks_base64 {
        chunks.push(String::from_utf8(base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(chunk)?)?);
    }
    let bytes = workload.len() as f64;
    let borrowed = input.selectors.iter().map(String::as_str).collect::<Vec<_>>();
    let started = Instant::now();
    let selection = PiiSelection::parse(&borrowed)?;
    let registry = if input.credential_profile == "common" {
        DetectorRegistry::with_common_built_in_and_pii(&selection)?
    } else {
        DetectorRegistry::with_built_in_and_pii(&selection)?
    };
    if registry.activation_identity() != input.expected_activation || input.expected_artifact != "compiled" {
        return Err("rust activation or artifact identity mismatch".into());
    }
    let initialize = started.elapsed().as_secs_f64() * 1000.0;
    let started = Instant::now();
    let _findings = scan(&workload, &registry, &DefaultPolicy)?;
    let whole_input = started.elapsed().as_secs_f64() * 1000.0;
    let limits = IncrementalLimits::new(std::cmp::max(workload.len() + 1024, 65_536), 32_768, 8_192, 16_384)?;
    let started = Instant::now();
    let mut session = if input.credential_profile == "common" {
        IncrementalSanitizer::with_common_built_in_and_pii_policy_and_formatter(
            limits, &selection, Box::new(DefaultPolicy), Box::new(default_placeholder_formatter))?
    } else {
        IncrementalSanitizer::with_built_in_and_pii(limits, &selection)?
    };
    for chunk in &chunks { let _ = session.append(chunk)?; }
    let _ = session.finalize()?;
    let incremental = started.elapsed().as_secs_f64() * 1000.0;
    drop(session); drop(chunks); drop(workload);
    let peak = memory_status("VmHWM:").map(Value::from).unwrap_or_else(|| unavailable("linux-proc-status-unavailable"));
    let retained = memory_status("VmRSS:").map(Value::from).unwrap_or_else(|| unavailable("linux-proc-status-unavailable"));
    let throughput = |milliseconds: f64| if milliseconds == 0.0 { f64::MAX } else { bytes * 1000.0 / milliseconds };
    println!("{}", json!({
        "import": unavailable("compiled-surface-has-no-runtime-import"),
        "initialize": initialize,
        "wholeInput": whole_input,
        "incremental": incremental,
        "bytesPerSecond": { "wholeInput": throughput(whole_input), "incremental": throughput(incremental) },
        "memory": { "processPeakRss": peak, "processRetainedRss": retained }
    }));
    Ok(())
}
