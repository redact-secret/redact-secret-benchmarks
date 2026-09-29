---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: firebase
families:
  - id: firebase:server-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://firebase.googleblog.com/2017/01/debugging-firebase-cloud-messaging-on.html
        - https://firebase.google.com/support/releases
        - https://github.com/firebase/firebase-js-sdk/blob/5ab2fc6f889be5226f44d2e50c7eb20144f69338/integration/messaging/test/utils/sendMessage.js
        - https://github.com/projectdiscovery/nuclei-templates/blob/8cf94b93a389a47bef77b89f8c8915b2755018f0/http/exposures/tokens/firebase-fcm-server-key-disclosure.yaml
      issues:
        - redact-secret/redact-secret#649
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/649/README.md
      researchedAt: 2026-09-24
    blockedBy: "No Google page states the shape; tool regexes trace to one 2020 write-up. The legacy FCM API was shut down in 2024, so a fresh key cannot be issued to check."
---

# Firebase

Firebase Cloud Messaging (FCM) issued legacy HTTP and XMPP server keys, sent as `Authorization: key=<key>`. Google stopped creating legacy server keys in March 2020 (`firebase.google.com/support/releases`) and shut the legacy API down from June to July 2024, so no new key can be issued. Historical leaks are the remaining exposure.

## Families

### `firebase:server-key` — Legacy FCM server key

- **Shape:** literal `AAAA` plus 7 characters (an 11-character head that base64url-decodes to the 64-bit Firebase project number), a literal `:`, then a 140-character body from `[A-Za-z0-9_-]`. Every real key measured has `APA91b` right after the colon; the contract does not require it. Late-2016 keys have 162 to 183-character bodies (8 of 66 unique real keys measured); about 88% of keys from 2017 onward have 140.
- **Sources:** T2, not T1. Google's only length statement (Firebase blog, 2017-01-31) is "a giant 175-character string", which the 140 contract does not match, and its only published `Authorization: key=` example is the older `AIza` form. Corroboration: a real key in the Firebase JS SDK's own integration test (measured 11 + `:` + 140), nuclei-templates, Burp BCheck, Nosey Parker/titus, a Laravel scrubber and PyRIT. All tool regexes copy one 2020 write-up.
- **Issuance:** impossible: the legacy API is closed.
- **Collisions:** FCM registration tokens (the 2017 Firebase blog calls a 153-character one a string that looks a lot like a server key) look similar and use the same `APA91b` body start; the `AIza` Google API key form belongs to `google:generic-api-key`.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#649 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/649/README.md). Core's detector comments call the prefix and lengths "documented"; no provider does.

## Candidates that are not families yet

- **Late-2016 generation (162 to 183-character bodies).** Not covered by the exact 140 contract; recorded as bounded, no fixture asserts silence on it.

## Open questions

1. Retire the family or keep it as a historical-leak detector? #649 left that to #575; no ruling was found.
2. Should `APA91b` be required? It would lower false positives but existing synthetic fixtures would miss.
3. Any provider statement of the 140 width, or of why the head starts with `AAAA` (it follows from project numbers below 2^40)?

## Research log

- [redact-secret#649](https://github.com/redact-secret/redact-secret/issues/649) — T1 hunt: NOT FOUND, exhaustive (2026-09-23); T2 contract accepted through corroboration on 2026-09-24. The record also cites earlier evidence in #520.
- [redact-secret#575](https://github.com/redact-secret/redact-secret/issues/575) — Epic A roll-up; excluded from the second batch.
