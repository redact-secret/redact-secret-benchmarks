// Guard for #404: T3 (project policy) must not carry a peer column in the
// default-mode `docs/generated/release-comparison.md`. A T3 positive is, by
// construction, a case a peer cannot match by design rather than by defect
// (docs/specs/measurement-v4.md §2.6), so a multi-scanner row there reads as
// a detection defect that does not exist.
const HEADING = /^### (.+) · T3 /;

/** Every `### <kind> · T3 …` section in `markdown` and its data-row count. */
export function t3Sections(markdown: string): { heading: string; rows: number }[] {
  const lines = markdown.split('\n');
  const sections: { heading: string; rows: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = HEADING.exec(lines[i]);
    if (!heading) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('###') && !lines[j].startsWith('| Scanner')) j++;
    if (j >= lines.length || !lines[j].startsWith('| Scanner')) { sections.push({ heading: heading[1], rows: 0 }); continue; }
    j += 2; // header row + separator row
    let rows = 0;
    while (j < lines.length && lines[j].startsWith('|')) { rows++; j++; }
    sections.push({ heading: heading[1], rows });
  }
  return sections;
}

/** Failures for a default-mode comparison: any T3 section with more than the product's own row. */
export function t3PeerRowFailures(markdown: string): string[] {
  return t3Sections(markdown)
    .filter(section => section.rows > 1)
    .map(section => `${section.heading} · T3: ${section.rows} scanner rows in a default-mode comparison (peer columns on T3 must be an explicit opt-in, --include-t3-peers)`);
}
