import { readFile, writeFile } from "node:fs/promises";
import { buildCorpora } from "../fixtures/generated/build.mjs";
import { validateCorpus } from "../benchmarks/lib/scoring.mjs";

const check = process.argv.includes("--check");
for (const [id, corpus] of Object.entries(buildCorpora())) {
  validateCorpus(corpus);
  const file = new URL(`../fixtures/generated/${id}.json`, import.meta.url);
  const serialized = JSON.stringify(corpus, null, 2) + "\n";
  if (check) {
    if ((await readFile(file, "utf8")) !== serialized)
      throw new Error(
        `Generated corpus drift: ${id}. Run npm run fixtures:generate.`,
      );
  } else await writeFile(file, serialized);
  console.log(
    `${check ? "Checked" : "Generated"} ${id}: ${corpus.fixtures.length} files`,
  );
}
