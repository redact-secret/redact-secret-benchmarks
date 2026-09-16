/** Registry comparison only: absence of a dedicated detector is not a scan result. */
export function filterInventory(entries, { query = '', tool = 'all', status = 'no-dedicated-detector' } = {}) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return entries.filter(row =>
    (tool === 'all' || row.tool === tool) &&
    (status === 'all' || row.status === status) &&
    words.every(word => `${row.id} ${row.tool} ${row.relatedDetector ?? ''} ${row.activation}`.toLowerCase().includes(word)),
  );
}
