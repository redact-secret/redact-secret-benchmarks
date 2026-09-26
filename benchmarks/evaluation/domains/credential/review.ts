import { hash } from '../../../engine/model.ts';

/** Product identity is intentionally excluded so reviewed peer disagreements survive releases. */
export function reviewEntryId(caseId: string, sourceHash: unknown, entry: Record<string, any>, legacy = false) {
  const tools = entry.evidence?.tools;
  const keyed = !legacy && Array.isArray(tools)
    ? { ...entry, evidence: { ...entry.evidence, tools: tools.map((tool: any) => (tool?.id === 'redact-secret' ? { id: tool.id } : tool)) } }
    : entry;
  return hash({ case: caseId, source: sourceHash, ...keyed });
}
