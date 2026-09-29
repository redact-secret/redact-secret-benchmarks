//! #427 job runner for the `redact-secret` Rust crate. The harness writes its `Cargo.toml` with either the published
//! registry version or a path to an exact core checkout. Ranges stay native (UTF-8 bytes); texts travel as hex so
//! this runner needs no dependency beyond the crate under test.
//!
//! Job lines: `SEL <selector>...`, `ILIM <input> <buffered> <token> <multiline>`, then per case `CASE <key> <hex>`,
//! `PART <id> <cuts|->`, `WLIM <id> <max-input-bytes> <max-findings>`, `IFAIL <id> <input> <buffered> <token> <multiline> <cuts|->`, `END`.
//! Cuts are Unicode code point positions. Usage: rust-runner <job.txt> <result.json>
use redact_secret::{
    DefaultPolicy, DetectorRegistry, Finding, IncrementalLimits, IncrementalSanitizer, PiiSelection, SecretScanError,
    WholeInputLimits, default_placeholder_formatter, redact, redact_with_limits, scan, scan_and_redact,
    scan_and_redact_with_limits, scan_with_limits, RANGE_UNIT, VERSION,
};

fn hex(text: &str) -> String { text.bytes().map(|b| format!("{b:02x}")).collect() }
fn unhex(value: &str) -> String {
    let bytes: Vec<u8> = (0..value.len()).step_by(2).map(|i| u8::from_str_radix(&value[i..i + 2], 16).unwrap()).collect();
    String::from_utf8(bytes).unwrap()
}
fn code(error: SecretScanError) -> String { format!("\"errorCode\":\"{}\"", error.code().as_str()) }
fn findings_json(findings: &[Finding]) -> String {
    let rows: Vec<String> = findings.iter().map(|f| format!(
        "{{\"type\":\"{}\",\"detector\":\"{}\",\"action\":\"{}\",\"confidence\":\"{}\",\"start\":{},\"end\":{}}}",
        f.type_name(), f.detector(), f.action().as_str(), f.confidence().as_str(), f.range().start(), f.range().end())).collect();
    format!("[{}]", rows.join(","))
}
fn cuts(value: &str) -> Vec<usize> { if value == "-" { vec![] } else { value.split(',').map(|v| v.parse().unwrap()).collect() } }
fn chunks<'a>(input: &'a str, cuts: &[usize]) -> Vec<&'a str> {
    let offsets: Vec<usize> = input.char_indices().map(|(i, _)| i).chain(std::iter::once(input.len())).collect();
    let mut out = Vec::new(); let mut previous = 0;
    for cut in cuts.iter().copied().chain(std::iter::once(offsets.len() - 1)) { out.push(&input[offsets[previous]..offsets[cut]]); previous = cut; }
    out
}
fn state_name(sanitizer: &IncrementalSanitizer) -> String { format!("{:?}", sanitizer.state()).to_lowercase() }

fn session(selection: &PiiSelection, limits: [usize; 4], parts: &[&str]) -> String {
    let limits = match IncrementalLimits::new(limits[0], limits[1], limits[2], limits[3]) {
        Ok(value) => value,
        Err(error) => return format!("\"status\":\"error\",{},\"textHex\":\"\",\"findings\":[],\"state\":null", code(error)),
    };
    let mut sanitizer = match IncrementalSanitizer::with_built_in_and_pii(limits, selection) {
        Ok(value) => value,
        Err(error) => return format!("\"status\":\"error\",{},\"textHex\":\"\",\"findings\":[],\"state\":null", code(error)),
    };
    let mut text = String::new(); let mut findings: Vec<Finding> = Vec::new();
    for part in parts {
        match sanitizer.append(part) {
            Ok(result) => { text.push_str(result.text()); findings.extend_from_slice(result.findings()); }
            Err(error) => return format!("\"status\":\"error\",{},\"textHex\":\"{}\",\"findings\":{},\"state\":\"{}\"", code(error), hex(&text), findings_json(&findings), state_name(&sanitizer)),
        }
    }
    match sanitizer.finalize() {
        Ok(result) => { text.push_str(result.text()); findings.extend_from_slice(result.findings());
            format!("\"status\":\"ok\",\"textHex\":\"{}\",\"findings\":{},\"state\":\"{}\"", hex(&text), findings_json(&findings), state_name(&sanitizer)) }
        Err(error) => format!("\"status\":\"error\",{},\"textHex\":\"{}\",\"findings\":{},\"state\":\"{}\"", code(error), hex(&text), findings_json(&findings), state_name(&sanitizer)),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let job = std::fs::read_to_string(&args[1]).expect("job");
    let mut ilim = [0usize; 4];
    let mut cases: Vec<String> = Vec::new();
    let mut current: Option<(String, String, Vec<String>, Vec<String>, Vec<String>)> = None;
    let mut registry: Option<(PiiSelection, DetectorRegistry)> = None;
    for line in job.lines() {
        let fields: Vec<&str> = line.split(' ').collect();
        match fields[0] {
            "SEL" => { let selectors: Vec<String> = fields[1..].iter().filter(|v| !v.is_empty()).map(|v| v.to_string()).collect();
                let refs: Vec<&str> = selectors.iter().map(String::as_str).collect();
                let selection = PiiSelection::parse(&refs).expect("selection");
                let built = DetectorRegistry::with_built_in_and_pii(&selection).expect("registry");
                registry = Some((selection, built)); }
            "ILIM" => { for i in 0..4 { ilim[i] = fields[i + 1].parse().unwrap(); } }
            "CASE" => { current = Some((fields[1].to_string(), unhex(fields[2]), vec![], vec![], vec![])); }
            "PART" | "WLIM" | "IFAIL" => {
                let (_, input, parts, wlims, ifails) = current.as_mut().unwrap();
                let (selection, reg) = registry.as_ref().unwrap();
                match fields[0] {
                    "PART" => parts.push(format!("{{\"id\":\"{}\",{}}}", fields[1], session(selection, ilim, &chunks(input, &cuts(fields[2]))))),
                    "WLIM" => {
                        let limits = WholeInputLimits::new(fields[2].parse().unwrap(), fields[3].parse().unwrap()).expect("limits");
                        let s = match scan_with_limits(input, reg, &DefaultPolicy, &limits) { Ok(f) => format!("\"status\":\"ok\",\"count\":{}", f.len()), Err(e) => format!("\"status\":\"error\",{}", code(e)) };
                        let r = match scan(input, reg, &DefaultPolicy).and_then(|f| redact_with_limits(input, &f, &default_placeholder_formatter, &limits)) {
                            Ok(t) => format!("\"status\":\"ok\",\"textHex\":\"{}\"", hex(&t)), Err(e) => format!("\"status\":\"error\",{}", code(e)) };
                        let sr = match scan_and_redact_with_limits(input, reg, &DefaultPolicy, &default_placeholder_formatter, &limits) {
                            Ok(res) => format!("\"status\":\"ok\",\"textHex\":\"{}\"", hex(res.text())), Err(e) => format!("\"status\":\"error\",{}", code(e)) };
                        wlims.push(format!("{{\"id\":\"{}\",\"scan\":{{{}}},\"redact\":{{{}}},\"scanAndRedact\":{{{}}}}}", fields[1], s, r, sr));
                    }
                    _ => { let mut limits = [0usize; 4]; for i in 0..4 { limits[i] = fields[i + 2].parse().unwrap(); }
                        ifails.push(format!("{{\"id\":\"{}\",{}}}", fields[1], session(selection, limits, &chunks(input, &cuts(fields[6]))))); }
                }
            }
            "END" => {
                let (key, input, parts, wlims, ifails) = current.take().unwrap();
                let (_, reg) = registry.as_ref().unwrap();
                let s = match scan(&input, reg, &DefaultPolicy) { Ok(f) => format!("\"status\":\"ok\",\"findings\":{}", findings_json(&f)), Err(e) => format!("\"status\":\"error\",{}", code(e)) };
                let r = match scan(&input, reg, &DefaultPolicy).and_then(|f| redact(&input, &f, &default_placeholder_formatter)) {
                    Ok(t) => format!("\"status\":\"ok\",\"textHex\":\"{}\"", hex(&t)), Err(e) => format!("\"status\":\"error\",{}", code(e)) };
                let sr = match scan_and_redact(&input, reg, &DefaultPolicy, &default_placeholder_formatter) {
                    Ok(res) => format!("\"status\":\"ok\",\"textHex\":\"{}\",\"findings\":{}", hex(res.text()), findings_json(res.findings())), Err(e) => format!("\"status\":\"error\",{}", code(e)) };
                cases.push(format!("{{\"key\":\"{}\",\"scan\":{{{}}},\"redact\":{{{}}},\"scanAndRedact\":{{{}}},\"partitions\":[{}],\"wholeLimits\":[{}],\"incrementalFailures\":[{}]}}",
                    key, s, r, sr, parts.join(","), wlims.join(","), ifails.join(",")));
            }
            _ => {}
        }
    }
    let activation = registry.as_ref().map(|(_, reg)| reg.activation_identity().to_string()).unwrap_or_default();
    let out = format!("{{\"identity\":{{\"rangeUnit\":\"{}\",\"version\":\"{}\",\"artifact\":\"rust-crate\",\"piiActivation\":\"{}\"}},\"cases\":[{}]}}",
        RANGE_UNIT, VERSION, activation, cases.join(","));
    std::fs::write(&args[2], out).expect("write");
}
