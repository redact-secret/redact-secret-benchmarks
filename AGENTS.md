## Boundary rule

This repository does not assert product output; it measures and records. An
assertion someone wants to write here is a promotion signal.

## Units of work

Agent skills that carry a piece of work end to end, in `.agents/skills/`
(read identically by Claude Code and Codex):

| Skill | Direction | Produces |
| --- | --- | --- |
| [`resolve-issue`](.agents/skills/resolve-issue/SKILL.md) | issue number → implementation | a workbench branch and verified `wip:` commits, ready for `ghpr` |
| [`review-pr`](.agents/skills/review-pr/SKILL.md) | open PR → merge-ready | applied fixes and wrap-up (changelog, ADR, docs, issue linkage) |
| [`release-regression-check`](.agents/skills/release-regression-check/SKILL.md) | pinned product RC commit → regression view | a fixture-level before/after evidence report ahead of a release decision |
| [`promote-finding`](.agents/skills/promote-finding/SKILL.md) | observed known-gap → product issue | a `reviewed` → `promoted` `benchmarks/known-gaps.json` record and a product-repo issue carrying the handoff |

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
