// Builds manifest.json and bundle.json (what the app downloads through jsDelivr).
// Usage: node scripts/build.mjs [--check]
//   --check  exit 1 if the committed files are out of date (used in CI).
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { LANGUAGES, ROOT, SCHEMA_VERSION, loadMonths, periodOf } from "./lib.mjs";

const MANIFEST = path.join(ROOT, "manifest.json");
const BUNDLE = path.join(ROOT, "bundle.json");

/**
 * The version must only change when the content changes, so it is taken from the last
 * commit that touched source/. The app compares versions as ISO strings, so always UTC.
 */
function contentVersion() {
  try {
    const iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", "source"], { cwd: ROOT, encoding: "utf8" }).trim();
    if (iso) return new Date(iso).toISOString();
  } catch {
    // Not a git checkout; fall through.
  }
  return new Date().toISOString();
}

function stripVisualFields(value) {
  if (Array.isArray(value)) return value.map(stripVisualFields);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (key === "thumbnail" || key === "thumbnailMode") continue;
    out[key] = stripVisualFields(v);
  }
  return out;
}

async function build() {
  const months = (await loadMonths()).filter((m) => m.data && Array.isArray(m.data.weeks));
  const version = contentVersion();
  const manifest = { schemaVersion: SCHEMA_VERSION, version, bundle: "bundle.json", languages: [], months: [] };
  const bundle = { schemaVersion: SCHEMA_VERSION, version, data: {} };

  for (const m of months) {
    const period = periodOf(m.file);
    if (!bundle.data[m.lang]) {
      bundle.data[m.lang] = {};
      manifest.languages.push({ code: m.lang, name: LANGUAGES[m.lang] ?? m.lang });
    }
    bundle.data[m.lang][period] = stripVisualFields({ ...m.data, period, language: m.lang });
    manifest.months.push({ lang: m.lang, period, display: m.data.display ?? period, publish: m.data.publish !== false });
  }

  return {
    manifest: JSON.stringify(manifest, null, 2) + "\n",
    // Compact: this file is downloaded by every app on launch.
    bundle: JSON.stringify(bundle) + "\n",
  };
}

const out = await build();

if (process.argv.includes("--check")) {
  const current = {
    manifest: await readFile(MANIFEST, "utf8").catch(() => ""),
    bundle: await readFile(BUNDLE, "utf8").catch(() => ""),
  };
  if (current.manifest !== out.manifest || current.bundle !== out.bundle) {
    console.log("manifest.json / bundle.json are out of date. Run: npm run build");
    process.exitCode = 1;
  } else {
    console.log("manifest.json and bundle.json are up to date.");
  }
} else {
  await writeFile(MANIFEST, out.manifest, "utf8");
  await writeFile(BUNDLE, out.bundle, "utf8");
  const m = JSON.parse(out.manifest);
  console.log(`Built ${m.months.length} months in ${m.languages.length} languages (version ${m.version}).`);
}
