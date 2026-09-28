// Shared helpers for the content scripts. No dependencies: plain Node 20+.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_DIR = path.join(ROOT, "source");

/** Bump only when the month file format changes in a way older apps cannot read. */
export const SCHEMA_VERSION = 1;

export const LANGUAGES = {
  BCL: "Bicol",
  CEB: "Cebuano",
  EN: "English",
  HIL: "Hiligaynon",
  ILO: "Iloko",
  PAG: "Pangasinan",
  SL: "Sign Language",
  TL: "Tagalog",
  WAR: "Waray-waray",
};

export const ROLES = new Set(["elder", "ms", "br", "demo", "talk", "cbs", "rdr"]);
export const SECTIONS = ["gems", "ministry", "living"];

/** Loads every source/<LANG>/<YYYYMM>.json file. Parse errors are reported, not thrown. */
export async function loadMonths() {
  const months = [];
  const langDirs = (await readdir(SOURCE_DIR, { withFileTypes: true }).catch(() => []))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const lang of langDirs) {
    const files = (await readdir(path.join(SOURCE_DIR, lang))).filter((f) => f.endsWith(".json")).sort();
    for (const file of files) {
      const rel = `source/${lang}/${file}`;
      const raw = await readFile(path.join(SOURCE_DIR, lang, file), "utf8");
      try {
        months.push({ lang, file, rel, data: JSON.parse(raw) });
      } catch (error) {
        months.push({ lang, file, rel, data: null, parseError: error.message });
      }
    }
  }
  return months;
}

export function periodOf(file) {
  return path.basename(file, ".json");
}

export function toDateKey(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(`${key ?? ""}`)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}
