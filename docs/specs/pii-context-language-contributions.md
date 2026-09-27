# PII context language evidence

The first-party `pii-context-v1` evidence corpus covers English (`en`) and
Korean (`ko`). Language is authored evidence metadata. It is never inferred
from the caller, input, jurisdiction, or a translation/model service, and it
never establishes PII identity by itself.

Future language contributions extend
`benchmarks/evaluation/domains/pii/context-evidence-v1.json` through the same
schema and `context-discrimination` method. A contribution must add:

- a reviewed language tag and vocabulary delta with provenance;
- high-signal positive frames plus neutral and negative frames;
- ambiguous-word and benign-prose controls proving that a label alone does not
  establish sensitivity;
- normalization and separator cases appropriate to the script;
- regression evidence for every already registered language; and
- only reserved or deterministic synthetic candidates, never real-person PII.

The vocabulary entry's identity domains constrain where it may be associated.
Adding Korean context does not activate Korean national identifiers, and adding
any later language does not create a jurisdiction or a new evaluator. The
generic corpus loader, method, and accounting strata consume the new data.
