/** Join raw results back to reviewed sources before a domain projects public fields. */
export function projectKnownResults<TSource extends { id: string }, TResult extends { id: string }, TProjected>(options: {
  sources: TSource[];
  results: TResult[];
  accepts: (source: TSource, result: TResult) => boolean;
  project: (source: TSource, result: TResult) => TProjected;
  refusal: string;
}) {
  const known = new Map(options.sources.map(source => [source.id, source]));
  return options.results.map(result => {
    const source = known.get(result.id);
    if (!source || !options.accepts(source, result)) throw new Error(options.refusal);
    return options.project(source, result);
  });
}
