// Context & boundaries beyond the one GitHub PAT shape: every family that sat
// at the detector-coverage floor (one shape × three contexts, no other suite)
// placed in the same text contexts `context-edges` already asks about. Each
// value is built to its family's frozen contract pattern
// (benchmarks/lib/assessment.ts) from its own seed, so none duplicates a
// detector-coverage positive. `supabase-token` is left out: its positives are
// T0 pending and would add no scored row.
//
// Key names are each family's own environment-variable name, the same one its
// detector-coverage `reference` control already uses; for the context-gated
// Datadog and Twilio families that name carries the same-line marker the
// contract review describes, so no companion identifier is needed.

const ALNUM_DASH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const BASE64_BODY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOWER_HEX = "0123456789abcdef";
const DIGITS = "0123456789";
const UPPER_ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** [detector, env-var name, prose label, value builder]. */
export const CONTEXT_FAMILIES = [
  ["datadog-api-key", "DD_API_KEY", "Datadog API key", s => s("value", 32, LOWER_HEX)],
  // redact-secret#671 (product PR #679): the bare 40-hex value is the product's own
  // datadog-application-key-legacy detector since the split; the ddapp_ current
  // shape has its own contract and stays covered by detector-coverage.
  ["datadog-application-key-legacy", "DD_APPLICATION_KEY", "Legacy Datadog application key", s => s("value", 40, LOWER_HEX)],
  ["discord-bot-token", "DISCORD_BOT_TOKEN", "Discord bot token",
    s => `${Buffer.from(s("snowflake", 18, DIGITS)).toString("base64url")}.${s("seg2", 6, ALNUM_DASH)}.${s("seg3", 27, ALNUM_DASH)}`],
  ["grafana-cloud-access-policy-token", "GRAFANA_CLOUD_TOKEN", "Grafana Cloud access policy token", s => `glc_${s("body", 32, BASE64_BODY)}`],
  ["grafana-service-account-token", "GRAFANA_SERVICE_ACCOUNT_TOKEN", "Grafana service account token",
    s => `glsa_${s("body", 32)}_${s("checksum", 8, LOWER_HEX)}`],
  ["microsoft-entra-client-secret", "AZURE_CLIENT_SECRET", "Microsoft Entra client secret",
    s => `${s("prefix", 3, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.~")}8Q~${s("suffix", 33, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.~-")}`],
  ["new-relic-user-api-key", "NEW_RELIC_API_KEY", "New Relic user API key", s => `NRAK-${s("body", 27, UPPER_ALNUM)}`],
  ["sentry-org-auth-token", "SENTRY_ORG_AUTH_TOKEN", "Sentry organization auth token",
    s => `sntrys_eyJ${s("payload", 26, BASE64_BODY)}_${s("signature", 43, BASE64_BODY)}`],
  ["sentry-user-auth-token", "SENTRY_AUTH_TOKEN", "Sentry user auth token", s => `sntryu_${s("body", 64, LOWER_HEX)}`],
  ["telegram-bot-token", "TELEGRAM_BOT_TOKEN", "Telegram bot token", s => `${s("bot-id", 10, DIGITS)}:${s("secret", 35, ALNUM_DASH)}`],
  ["twilio-auth-token", "TWILIO_AUTH_TOKEN", "Twilio auth token", s => s("value", 32, LOWER_HEX)],
  ["twilio-api-key-secret", "TWILIO_API_KEY_SECRET", "Twilio API key secret", s => s("value", 32)],
];

/**
 * One representative per context group the GitHub set covers, minus the
 * Unicode/CRLF line detector-coverage already gives every family:
 * [id, group, (upper, lower, label) => [before, after], extension].
 */
const CONTEXTS = [
  ["no-final-newline", "Boundaries", upper => [`${upper}=`, ""]],
  ["single-quotes", "Quoting", upper => [`${upper}='`, "'\n"]],
  ["json", "Structured text", (_, lower) => [`{"${lower}":"`, '"}\n'], "json"],
  ["yaml", "Structured text", (_, lower) => [`${lower}: "`, '"\n'], "yaml"],
  ["toml", "Structured text", (_, lower) => [`${lower} = "`, '"\n'], "toml"],
  ["python", "Source code", (_, lower) => [`${lower} = '`, "'\n"], "py"],
  ["markdown", "Documentation", (_, __, label) => [`${label}: \``, "`\n"], "md"],
  ["bom", "Encoding", upper => [`﻿${upper}=`, "\n"]],
];

/**
 * `twins[detector]`, when present, maps the positive's value to
 * `{ value, mutation, mutationKind }`: a single documented-property mutation
 * placed in every context, context bytes held constant.
 */
export function buildContextFamilies({ fixture, synthetic }, twins = {}) {
  const fixtures = [];
  for (const [detector, upper, label, make] of CONTEXT_FAMILIES) {
    const value = make((part, length, chars) => synthetic(`context-edges:${detector}:${part}`, length, chars));
    const twin = twins[detector]?.(value);
    for (const [context, group, wrap, extension] of CONTEXTS) {
      const [before, after] = wrap(upper, upper.toLowerCase(), label);
      const id = `${detector}-${context}`;
      fixtures.push({ ...fixture(id, group, [before, { secret: value }, after], extension), detectors: [detector] });
      if (twin) fixtures.push({
        ...fixture(`${id}-twin`, group, [before + twin.value + after], extension),
        detectors: [detector], twinOf: id, mutation: twin.mutation, mutationKind: twin.mutationKind,
      });
    }
  }
  return fixtures;
}
