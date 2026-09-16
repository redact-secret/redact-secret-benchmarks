import { escape as e, percent, type Report } from "../types";

export function accuracy(report: Report): string {
  const complete = report.scanners.filter((s) => s.status === "complete");
  const groups = [
    ...new Set(complete.flatMap((s) => s.rows!.map((r) => r.group))),
  ];
  const breakdown = complete.length
    ? `<section class="panel"><div class="section-heading"><div><h2>Coverage by group</h2><p>Detected / expected spans, or clean / negative files. False positives are shown separately.</p></div></div><div class="table-scroll"><table><thead><tr><th>Fixture group</th><th>Files</th>${complete.map((s) => `<th>${e(s.name)}</th>`).join("")}</tr></thead><tbody>${groups
        .map(
          (group) =>
            `<tr><td>${e(group)}</td><td>${complete[0].rows!.filter((r) => r.group === group).length}</td>${complete
              .map((s) => {
                const rows = s.rows!.filter((r) => r.group === group);
                const expected = rows.reduce(
                  (n, r) => n + r.expected.length,
                  0,
                );
                const tp = rows.reduce((n, r) => n + r.tp, 0),
                  fp = rows.reduce((n, r) => n + r.fp, 0),
                  tn = rows.reduce((n, r) => n + r.tn, 0);
                return `<td><strong>${expected ? `${tp} / ${expected} detected` : `${tn} / ${rows.length} clean`}</strong><small>${fp} false positives</small></td>`;
              })
              .join("")}</tr>`,
        )
        .join("")}</tbody></table></div></section>`
    : "";
  const references = (report.references ?? []).filter((url) =>
    /^https:\/\/github\.com\/redact-secret\/redact-secret\/issues\/\d+$/.test(
      url,
    ),
  );
  const review = report.milestoneReview;
  const releaseContext = review
    ? `<section class="panel"><div class="section-heading"><div><h2>Release regression coverage</h2><p>Target: ${e(review.targetRelease)} · issue review: ${e(review.reviewedAt)}</p></div><span class="tag">NPM WHOLE-INPUT</span></div><p>${e(review.validation)}</p><p class="footnote">Not evaluated: ${review.unverifiedSurfaces.map(e).join(" · ")}</p><div class="table-scroll"><table><thead><tr><th>Closed issue</th><th>Separate validation required</th></tr></thead><tbody>${review.outOfScopeIssues.map((item) => `<tr><td><a href="https://github.com/redact-secret/redact-secret/issues/${Number(item.issue)}">#${Number(item.issue)} ↗</a></td><td class="wrap-cell">${e(item.reason)}</td></tr>`).join("")}</tbody></table></div></section>`
    : "";
  return `<div class="notice"><span class="dot"></span><div><strong>Synthetic corpus · preliminary results</strong><p>${e(report.reviewStatus)}. These controlled fixtures do not establish overall comparative product quality.</p>${report.scope ? `<p>${e(report.scope)}</p>` : ""}${references.length ? `<p>Related issues: ${references.map((url) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">#${e(url.split("/").pop())} ↗</a>`).join(" · ")}</p>` : ""}</div></div>
  <section class="stats" aria-label="Run summary"><article><span>FIXTURE FILES</span><strong>${report.fixtureCount}</strong><small>Identical inputs for every scanner</small></article><article><span>EXPECTED SECRETS</span><strong>${report.expectedCount}</strong><small>Synthetic, never-issued values</small></article><article><span>SCANNERS COMPLETED</span><strong>${complete.length}<em> / ${report.scanners.length}</em></strong><small>Unavailable tools are not scored</small></article></section>
  <section class="panel"><div class="section-heading"><div><h2>Detection performance</h2><p>Exact-range matches · higher is better</p></div><span class="tag">LOCAL / OFFLINE VERIFICATION</span></div>
  <div class="chart-legend"><span><i class="precision"></i>Precision</span><span><i class="recall"></i>Recall</span><span><i class="f1"></i>F1 score</span></div>
  <div class="charts">${report.scanners.map((s) => `<article class="scanner-chart"><div class="scanner-title"><h3>${e(s.name)}</h3><span class="status ${e(s.status)}">${e(s.status)}</span></div><p class="version">${s.version ? `v${e(s.version)}` : "Binary not available"}</p>${s.status === "complete" ? (["precision", "recall", "f1"] as const).map((key) => `<div class="bar-row"><span>${key === "f1" ? "F1 score" : key[0].toUpperCase() + key.slice(1)}</span><div class="track"><div class="bar ${key}" style="width:${(s[key] ?? 0) * 100}%"></div></div><b>${percent(s[key])}</b></div>`).join("") : `<div class="unavailable">${e(s.message)}</div>`}</article>`).join("")}</div></section>
  <section class="panel"><div class="section-heading"><div><h2>Scanner results</h2><p>Counts are secret spans; true negatives count clean files.</p></div></div><div class="table-scroll"><table><thead><tr><th>Scanner</th><th>True positives</th><th>False positives</th><th>Missed secrets</th><th>Clean negatives</th><th>Elapsed*</th></tr></thead><tbody>${report.scanners.map((s) => `<tr><td><strong>${e(s.name)}</strong><small>${e(s.mode)}</small></td>${["tp", "fp", "fn", "tn"].map((k) => `<td>${s.status === "complete" ? s[k as "tp"] : "—"}</td>`).join("")}<td>${s.durationMs == null ? "—" : `${s.durationMs.toFixed(1)} ms`}</td></tr>`).join("")}</tbody></table></div><p class="footnote">* One diagnostic wall-clock measurement, including adapter overhead. This is not a throughput benchmark.</p></section>
  ${releaseContext}
  ${breakdown}
  <section class="panel"><div class="section-heading"><div><h2>Fixture explorer</h2><p>Inspect outcomes and byte ranges and open the exact synthetic test input.</p></div><label class="search-label">Filter fixtures<input id="filter" placeholder="Search fixture or group…" type="search"/></label></div>
  ${
    complete.length
      ? `<div class="table-scroll"><table><thead><tr><th>Fixture</th><th>Ground truth</th>${complete.map((s) => `<th>${e(s.name)}</th>`).join("")}</tr></thead><tbody id="fixture-rows">${complete[0]
          .rows!.map(
            (row) =>
              `<tr data-search="${e(`${row.id} ${row.group}`.toLowerCase())}"><td><strong><a class="text-link" href="/fixture/${e(report.category)}--${e(row.id)}">${e(row.id)} ↗</a></strong><small>${e(row.group)}</small></td><td>${row.expected.length ? `${row.expected.length} secret span(s)` : "Negative control"}<small>${row.expected.map((r) => `[${r.start}, ${r.end})`).join(" · ")}</small></td>${complete
                .map((s) => {
                  const r = s.rows!.find((r) => r.id === row.id)!;
                  return `<td><span class="outcome ${r.fp || r.fn ? "miss" : "pass"}">${r.fp || r.fn ? `${r.fp} FP / ${r.fn} missed` : "Exact match"}</span><small>${r.actual.map((a) => `[${a.start}, ${a.end})`).join(" · ") || "No findings"}</small></td>`;
                })
                .join("")}</tr>`,
          )
          .join(
            "",
          )}</tbody></table><p id="no-matches" hidden>No fixtures match this filter.</p></div>`
      : '<p class="empty">No completed scanners. Install a supported scanner and run the benchmark again.</p>'
  }</section>`;
}
