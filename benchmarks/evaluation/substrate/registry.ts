export interface Registry<T> { register(entry: T): Registry<T>; get(id: string): T; values(): T[] }

/** Internal deterministic registry. Loading and third-party discovery stay out of this contract. */
export function createRegistry<T extends { id: string; version: number }>(kind: string, functions: (keyof T)[]): Registry<T> {
  const entries = new Map<string, T>();
  return {
    register(entry: T) {
      if (!entry || !/^[a-z][a-z0-9.-]*$/.test(entry.id) ||
          !Number.isInteger(entry.version) || entry.version < 1 ||
          functions.some(key => typeof entry[key] !== 'function'))
        throw new Error(`Invalid ${kind} registration`);
      if (entries.has(entry.id)) throw new Error(`Duplicate ${kind}: ${entry.id}`);
      entries.set(entry.id, Object.freeze({ ...entry }));
      return this;
    },
    get(id: string) {
      if (!entries.has(id)) throw new Error(`Unknown ${kind}: ${id}`);
      return entries.get(id)!;
    },
    values: () => [...entries.values()],
  };
}
