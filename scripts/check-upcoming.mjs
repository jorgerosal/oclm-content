// Lists languages that are missing workbook months for the coming months.
// Usage: node scripts/check-upcoming.mjs [monthsAhead=2] [--markdown]
import { LANGUAGES, loadMonths, periodOf } from "./lib.mjs";

const ahead = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 2);
const markdown = process.argv.includes("--markdown");

const now = new Date();
const periods = [];
for (let i = 0; i <= ahead; i++) {
  const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
  periods.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
}

const have = new Set((await loadMonths()).filter((m) => m.data).map((m) => `${m.lang}/${periodOf(m.file)}`));
const langs = Object.keys(LANGUAGES);
const missing = [];
for (const period of periods) {
  const langsMissing = langs.filter((lang) => !have.has(`${lang}/${period}`));
  if (langsMissing.length) missing.push({ period, langs: langsMissing });
}

const label = (p) => new Date(Number(p.slice(0, 4)), Number(p.slice(4)) - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });

if (markdown) {
  if (!missing.length) console.log("All languages have workbook content for the next months.");
  else {
    console.log("The following workbook months are not in `source/` yet:\n");
    for (const m of missing) console.log(`- **${label(m.period)}** (\`${m.period}\`): ${m.langs.map((l) => `${LANGUAGES[l]} (${l})`).join(", ")}`);
    console.log("\nAdd them with the Content Editor in OCLM Scheduler (Settings → Maintainer), or as `source/<LANG>/<YYYYMM>.json`.");
  }
} else {
  for (const m of missing) console.log(`${m.period}: ${m.langs.join(", ")}`);
  if (!missing.length) console.log("Nothing missing.");
}
process.exitCode = missing.length ? 2 : 0;
