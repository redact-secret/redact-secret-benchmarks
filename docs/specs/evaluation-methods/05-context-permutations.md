# Context permutations

Status: evaluation method definition v1

## Purpose

Verify that detection behavior is preserved when the same value appears in
semantically ordinary containers, quoting styles, encodings, and line-ending
forms. This is a metamorphic test: the context changes while the credential
expectation remains explicit.

## Inputs

- A canonical fixture and its authored assessment.
- Registered context or encoding operators with declared applicability.
- Representative forms such as bare text, environment assignment, JSON, YAML,
  TOML, source code, Markdown, URI, quotes, Unicode surroundings, CRLF, and
  missing final newline.

## Procedure

1. Select only operators compatible with the source case.
2. Transform structure around the value without modifying secret bytes unless
   the operator explicitly remaps and records them.
3. Recalculate UTF-8 spans and envelopes from construction, never by searching
   scanner output.
4. Run the source and all variants together.
5. Compare each variant with the declared metamorphic relation.

## Assertions

- Positive coverage and silence expectations must survive supported context
  transformations.
- An unsupported transformation is skipped with a reason, not counted as a
  pass.
- Generation or range-remapping errors are method errors, not scanner failures.

## Reporting

Report the source case, operator and version, context label, fixture hash,
mapped ranges, per-scanner outcomes, and relation-level violations. Contexts
must remain separable so one large family cannot hide a weak context.

## Exit criteria

Each supported context is deterministic, syntactically intentional, and has a
reviewable relation to its source case.
