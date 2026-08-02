import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { generateIcon } from "./gen-icons";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");

async function bundle(entry: string, outfile: string): Promise<void> {
  const result = await Bun.build({
    entrypoints: [join(root, entry)],
    target: "browser",
    minify: true,
    sourcemap: "none",
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log.message);
    throw new Error(`bundle failed for ${entry}`);
  }
  const artifact = result.outputs[0];
  if (artifact === undefined) throw new Error(`no output for ${entry}`);
  const code = await artifact.text();
  if (/^\s*(import|export)\b/m.test(code)) {
    throw new Error(`${outfile} contains module syntax; it must be a classic script`);
  }
  await Bun.write(join(dist, outfile), code);
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "icons"), { recursive: true });

await bundle("src/background.ts", "background.js");
await bundle("src/content/capture.ts", "content.js");
await bundle("src/exporter/exporter.ts", "exporter.js");

await Bun.write(join(dist, "manifest.json"), Bun.file(join(root, "src/manifest.json")));
await Bun.write(join(dist, "exporter.html"), Bun.file(join(root, "src/exporter/exporter.html")));

for (const size of [16, 48, 128]) {
  await Bun.write(join(dist, "icons", `icon${size}.png`), generateIcon(size));
}

console.info("built extension into dist/");
