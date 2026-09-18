// Internal contracts only; no loading, discovery or external compatibility API.
export function createRegistry(kind, functions) {
  const entries = new Map();
  return {
    register(entry) {
      if (!entry || !/^[a-z][a-z0-9.-]*$/.test(entry.id) ||
          !Number.isInteger(entry.version) || entry.version < 1 ||
          functions.some(key => typeof entry[key] !== 'function'))
        throw new Error(`Invalid ${kind} registration`);
      if (entries.has(entry.id)) throw new Error(`Duplicate ${kind}: ${entry.id}`);
      entries.set(entry.id, Object.freeze({ ...entry }));
      return this;
    },
    get(id) {
      if (!entries.has(id)) throw new Error(`Unknown ${kind}: ${id}`);
      return entries.get(id);
    },
    values: () => [...entries.values()],
  };
}
