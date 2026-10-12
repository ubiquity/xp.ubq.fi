// Assemble .cf-assets/ for the Cloudflare deployment of xp.ubq.fi.
// Mirrors the old Deno proxy resolution: a non-API path P tries src/P then
// dist/P, and "/" serves the root index.html.
import { copy, ensureDir, walk } from "jsr:@std/fs@1";
import { dirname, extname, join } from "jsr:@std/path@1";

const OUT = ".cf-assets";

async function place(src: string, dest: string): Promise<void> {
  await ensureDir(dirname(dest));
  await copy(src, dest, { overwrite: true });
}

await Deno.remove(OUT, { recursive: true }).catch(() => {});
await ensureDir(OUT);

await place("index.html", join(OUT, "index.html"));

// src/** -> /src/** and (except index.html) -> /
for await (const entry of walk("src", { includeDirs: false })) {
  const rel = entry.path.slice("src/".length);
  await place(entry.path, join(OUT, "src", rel));
  if (rel !== "index.html") await place(entry.path, join(OUT, rel));
}

// dist/** -> / and /dist/**, when the bundle has been built
try {
  for await (const entry of walk("dist", { includeDirs: false })) {
    const rel = entry.path.slice("dist/".length);
    await place(entry.path, join(OUT, rel));
    await place(entry.path, join(OUT, "dist", rel));
  }
} catch {
  console.warn("no dist/ directory; run the bundle build first");
}

// Fixture artifacts (optional) + a manifest for /api/artifacts?runId=test
const fixtureNames: string[] = [];
try {
  for await (const entry of walk("tests/fixtures/artifacts", { includeDirs: false })) {
    if (extname(entry.path) === ".zip") {
      const name = entry.path.split("/").pop()!.replace(/\.zip$/, "");
      fixtureNames.push(name);
      await place(entry.path, join(OUT, "tests", "fixtures", "artifacts", `${name}.zip`));
    }
  }
} catch {
  console.warn("no test fixtures; /api/artifacts?runId=test will be empty");
}
await Deno.writeTextFile(join(OUT, "fixture-manifest.json"), JSON.stringify({ artifacts: fixtureNames }));

console.log(JSON.stringify({ assembled: OUT, fixtures: fixtureNames.length }));
