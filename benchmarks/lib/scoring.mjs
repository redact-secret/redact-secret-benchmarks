import { containment } from "./containment.mjs";

function byteBoundaries(content) {
  const boundaries = new Set([0]);
  let offset = 0;
  for (const char of content) {
    offset += Buffer.byteLength(char);
    boundaries.add(offset);
  }
  return boundaries;
}

export function validateCorpus(corpus) {
  if (!corpus || !Array.isArray(corpus.fixtures) || !corpus.fixtures.length)
    throw new Error("Empty corpus");
  const ids = new Set(),
    paths = new Set();
  for (const f of corpus.fixtures) {
    if (
      !f ||
      typeof f.id !== "string" ||
      !/^[a-z0-9-]+$/.test(f.id) ||
      ids.has(f.id)
    )
      throw new Error("Invalid fixture id");
    if (
      typeof f.path !== "string" ||
      !/^[a-zA-Z0-9_./-]+$/.test(f.path) ||
      f.path.startsWith("/") ||
      f.path.split("/").some((p) => !p || p === ".." || p === ".") ||
      paths.has(f.path)
    )
      throw new Error("Unsafe or duplicate path");
    ids.add(f.id);
    paths.add(f.path);
    if (typeof f.content !== "string" || !Array.isArray(f.expected))
      throw new Error("Invalid fixture");
    const bytes = Buffer.byteLength(f.content);
    const boundaries = byteBoundaries(f.content);
    let end = 0;
    for (const r of f.expected) {
      if (
        !r ||
        !Number.isInteger(r.start) ||
        !Number.isInteger(r.end) ||
        r.start < end ||
        r.end <= r.start ||
        r.end > bytes ||
        !boundaries.has(r.start) ||
        !boundaries.has(r.end)
      )
        throw new Error("Invalid UTF-8 range");
      end = r.end;
    }
  }
  return corpus;
}

export function score(fixtures, findings) {
  const known = new Map(fixtures.map((f) => [f.path, f]));
  const boundaries = new Map(
    fixtures.map((f) => [f.path, byteBoundaries(f.content)]),
  );
  if (!Array.isArray(findings)) throw new Error("Invalid normalized findings");
  const unique = new Map();
  for (const r of findings) {
    const f = known.get(r?.path);
    if (
      !f ||
      !Number.isInteger(r.start) ||
      !Number.isInteger(r.end) ||
      r.start < 0 ||
      r.end <= r.start ||
      r.end > Buffer.byteLength(f.content) ||
      !boundaries.get(r.path).has(r.start) ||
      !boundaries.get(r.path).has(r.end)
    )
      throw new Error("Invalid normalized finding");
    unique.set(`${r.path}:${r.start}:${r.end}`, r);
  }
  const rows = fixtures.map((f) => {
    const actual = [...unique.values()]
      .filter((r) => r.path === f.path)
      .map(({ start, end }) => ({ start, end }));
    const expected = f.expected.map(({ start, end }) => ({ start, end }));
    const tp = expected.filter((e) =>
      actual.some((a) => a.start === e.start && a.end === e.end),
    ).length;
    return {
      id: f.id,
      path: f.path,
      group: f.group,
      ...(f.assessment ? { assessment: f.assessment } : {}),
      expected,
      actual,
      ...containment(expected, actual),
      tp,
      fp: actual.length - tp,
      fn: expected.length - tp,
      tn: expected.length === 0 && actual.length === 0 ? 1 : 0,
    };
  });
  const totals = rows.reduce(
    (t, r) => ({
      contained: t.contained + r.contained,
      broader: t.broader + r.broader,
      tp: t.tp + r.tp,
      fp: t.fp + r.fp,
      fn: t.fn + r.fn,
      tn: t.tn + r.tn,
    }),
    { tp: 0, fp: 0, fn: 0, tn: 0, contained: 0, broader: 0 },
  );
  const { tp, fp, fn } = totals;
  return {
    ...totals,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    f1: 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : null,
    rows,
  };
}
