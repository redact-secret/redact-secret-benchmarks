import { fixture, synthetic } from "./build.mjs";

export const BASETEN_SOURCE = "https://docs.baseten.co/organization/api-keys.md";
export const BASETEN_CONTRACT = Object.freeze({
  tier: "T1", observedAt: "2026-10-08", source: BASETEN_SOURCE,
  pattern: "^b10_[A-Za-z0-9]{8}\\.[A-Za-z0-9]{32}$",
  scope: "Keys created on or after 2026-10-01 15:00 GMT only. Earlier keys have no documented grammar and remain a false negative.",
});

// Authored only from the provider's published regex, never detector code or output.
// The public seed constructs new filler, with no issued/example credential input.
export function buildBasetenArrival() {
  const rows = [];
  const id = synthetic("baseten-independent-829:id", 8);
  const body = synthetic("baseten-independent-829:body", 32);
  const value = `b10_${id}.${body}`;
  const add = (slug, before, token, after, positive = false, extra = {}) => {
    rows.push({
      ...fixture(slug, "Baseten independent arrival", [before, positive ? { secret: token } : token, after]),
      assessment: { kind: positive ? "must-redact" : "must-not-flag", tier: positive || extra.twinOf ? "T1" : "T3",
        reason: positive ? "Complete provider-documented new key grammar." : extra.twinOf ? "One property falls outside the provider-documented complete grammar." : "Independently authored benign sibling or placeholder; no complete documented key.",
        sources: [BASETEN_SOURCE] },
      ...extra,
    });
  };
  for (const [slug, before, after] of [
    ["bare", "", "\n"], ["env", "BASETEN_API_KEY=", "\n"],
    ["shell", 'export BASETEN_API_KEY="', '"\n'], ["json", '{"api_key":"', '"}\n'],
    ["header", "Authorization: Api-Key ", "\n"], ["sdk", 'client = Client(api_key="', '")\n'],
  ]) add(slug, before, value, after, true);
  const replace = (text, index, ch) => text.slice(0, index) + ch + text.slice(index + 1);
  const twins = [
    ["id-short", `b10_${id.slice(0, -1)}.${body}`, "length"],
    ["id-long", `b10_${id}A.${body}`, "length"],
    ["body-short", `b10_${id}.${body.slice(0, -1)}`, "length"],
    ["body-long", `b10_${id}.${body}A`, "length"],
    ["id-dash", `b10_${replace(id, 3, "-")}.${body}`, "alphabet"],
    ["id-underscore", `b10_${replace(id, 3, "_")}.${body}`, "alphabet"],
    ["body-dash", `b10_${id}.${replace(body, 15, "-")}`, "alphabet"],
    ["body-underscore", `b10_${id}.${replace(body, 15, "_")}`, "alphabet"],
    ["separator-colon", `b10_${id}:${body}`, "separator"],
    ...["B10_", "b1o_", "b100_", "b10-", "bt10_"].map((prefix, index) => [`prefix-${index}`, `${prefix}${id}.${body}`, "prefix"]),
  ];
  for (const [slug, token, mutationKind] of twins) add(slug, "", token, "\n", false,
    { twinOf: "bare", mutation: slug, mutationKind });
  for (const [slug, token] of [
    ["id-only", id], ["prefix-only", "b10_"], ["unprefixed-sibling", `${id}.${body}`],
    ["placeholder", "<your-api-key>"], ["masked", "*".repeat(45)],
    ["reference", "process.env.BASETEN_API_KEY"], ["guidance", "Create an API key and store it in a secret manager."],
    ["identifier", "baseten_workspace_fixture"],
  ]) add(slug, "", token, "\n");
  return rows;
}

export function validateBasetenArrival(rows) {
  const grammar = new RegExp(BASETEN_CONTRACT.pattern);
  if (rows.length !== 28 || new Set(rows.map(row => row.id)).size !== 28) throw new Error("invalid-baseten-corpus");
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const row of rows) {
    if (row.expected.length) {
      for (const span of row.expected) {
        const value = Buffer.from(row.content).subarray(span.start, span.end).toString();
        if (value.length !== 45 || !grammar.test(value)) throw new Error("invalid-baseten-positive");
      }
    } else if (grammar.test(row.content.trim())) throw new Error("invalid-baseten-control");
    if (row.twinOf && !byId.get(row.twinOf)?.expected.length) throw new Error("invalid-baseten-twin");
  }
  return rows;
}
