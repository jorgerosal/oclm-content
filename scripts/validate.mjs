// Checks every month file before it is published. Exit code 1 on any error.
// Usage: node scripts/validate.mjs [--quiet]
import { LANGUAGES, ROLES, SECTIONS, loadMonths, parseDateKey, periodOf, toDateKey } from "./lib.mjs";

// Congregation data must never be committed here: this repository is public.
const FORBIDDEN_KEYS = new Set([
  "name", "firstName", "lastName", "namePrefix", "phone", "email", "notes", "gender",
  "publisher", "publishers", "pubs", "assigned", "assignee", "assignments", "pid", "a",
  "cong", "congregation", "householdId", "unavailability",
]);
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const quiet = process.argv.includes("--quiet");
const errors = [];
const warnings = [];

function scanForPersonalData(value, where) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanForPersonalData(v, `${where}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) errors.push(`${where}: field "${key}" looks like congregation data and is not allowed in this public repo.`);
      scanForPersonalData(v, `${where}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && EMAIL_RE.test(value)) {
    errors.push(`${where}: contains an email address.`);
  }
  if (typeof value === "string" && /\b(undefined|null|NaN)\b/.test(value)) {
    errors.push(`${where}: contains "${value}" (a placeholder left by a broken edit).`);
  }
}

function checkMonth({ lang, file, rel, data, parseError }) {
  const err = (msg) => errors.push(`${rel}: ${msg}`);
  const warn = (msg) => warnings.push(`${rel}: ${msg}`);

  if (parseError) return err(`invalid JSON (${parseError})`);
  if (!/^\d{6}\.json$/.test(file)) return err("file name must be YYYYMM.json");
  if (!LANGUAGES[lang]) err(`unknown language folder "${lang}" (expected one of ${Object.keys(LANGUAGES).join(", ")})`);

  const period = periodOf(file);
  if (`${data.period}`.replace("-", "") !== period) err(`"period" is ${data.period} but the file is ${period}.json`);
  if (data.language !== lang) err(`"language" is ${data.language} but the folder is ${lang}`);
  for (const key of ["display", "title"]) if (!`${data[key] ?? ""}`.trim()) err(`"${key}" is empty`);
  if (typeof data.publish !== "boolean") warn(`"publish" should be true or false`);

  const firstMonday = parseDateKey(data.firstMonday);
  if (!firstMonday) err(`"firstMonday" must be a date like 2026-09-07`);
  else if (firstMonday.getDay() !== 1) err(`"firstMonday" ${data.firstMonday} is not a Monday`);

  if (!Array.isArray(data.weeks) || data.weeks.length === 0) return err(`"weeks" is empty`);
  if (data.weeks.length < 3 || data.weeks.length > 6) warn(`has ${data.weeks.length} weeks`);

  const seenIds = new Set();
  data.weeks.forEach((week, wi) => {
    const expectedWeekId = `${period}.${wi + 1}`;
    const w = `week ${wi + 1}`;
    if (week.id !== expectedWeekId) err(`${w}: id is "${week.id}", expected "${expectedWeekId}"`);
    if (week.order !== undefined && week.order !== wi + 1) err(`${w}: order is ${week.order}, expected ${wi + 1}`);
    if (!`${week.week ?? ""}`.trim()) err(`${w}: "week" label is empty`);
    if (!`${week.bibleReading ?? ""}`.trim()) err(`${w}: "bibleReading" is empty`);
    if (!Array.isArray(week.songs) || week.songs.length !== 3 || week.songs.some((s) => !`${s ?? ""}`.trim())) {
      err(`${w}: needs exactly 3 song numbers`);
    }

    if (firstMonday) {
      const monday = new Date(firstMonday);
      monday.setDate(monday.getDate() + wi * 7);
      if (wi === 0 && monday.getMonth() !== firstMonday.getMonth()) err(`${w}: first week does not start in the month`);
      week._monday = toDateKey(monday);
    }

    for (const section of SECTIONS) {
      const parts = week.parts?.[section];
      if (!Array.isArray(parts)) {
        err(`${w}: missing "${section}" parts`);
        continue;
      }
      if (parts.length === 0) err(`${w}: "${section}" has no parts`);
      parts.forEach((part, pi) => {
        const p = `${w} ${section}[${pi}]`;
        if (typeof part.id !== "string" || !part.id.startsWith(`${expectedWeekId}.`)) {
          err(`${p}: id "${part.id}" must start with "${expectedWeekId}."`);
        }
        if (seenIds.has(part.id)) err(`${p}: duplicate id "${part.id}"`);
        seenIds.add(part.id);

        const isReader = /\.r$/.test(part.id ?? "");
        if (!isReader) {
          if (typeof part.time !== "number" || part.time <= 0 || part.time > 60) err(`${p}: "time" must be minutes between 1 and 60`);
        }
        if (!Array.isArray(part.roles) || part.roles.length === 0) err(`${p}: "roles" is empty`);
        for (const role of part.roles ?? []) if (!ROLES.has(role)) err(`${p}: unknown role "${role}"`);
        if (!`${part.title ?? part.reference ?? ""}`.trim() && !isReader) warn(`${p}: has neither title nor reference`);
      });
    }

    // Autofill targets must exist in the same week.
    const idsInWeek = new Set(SECTIONS.flatMap((s) => (week.parts?.[s] ?? []).map((p) => p.id)));
    for (const s of SECTIONS) {
      for (const part of week.parts?.[s] ?? []) {
        for (const target of part.autofills ?? []) {
          if (!idsInWeek.has(target)) err(`${w}: autofill target "${target}" does not exist`);
        }
      }
    }

    // Meeting length sanity check (about 105 minutes of timed parts plus songs).
    const minutes = SECTIONS.flatMap((s) => week.parts?.[s] ?? []).reduce((sum, p) => sum + (typeof p.time === "number" ? p.time : 0), 0);
    if (minutes < 60 || minutes > 110) warn(`${w}: timed parts add up to ${minutes} minutes`);
    delete week._monday;
  });

  scanForPersonalData(data, rel);
}

const months = await loadMonths();
if (months.length === 0) errors.push("No month files found under source/.");
months.forEach(checkMonth);

// Weeks of the same month should line up across languages.
const byPeriod = new Map();
for (const m of months) {
  if (!m.data?.weeks) continue;
  const key = periodOf(m.file);
  if (!byPeriod.has(key)) byPeriod.set(key, []);
  byPeriod.get(key).push(m);
}
for (const [period, list] of byPeriod) {
  const firstMondays = new Set(list.map((m) => m.data.firstMonday));
  if (firstMondays.size > 1) warnings.push(`${period}: languages disagree on firstMonday (${[...firstMondays].join(", ")})`);
  const weekCounts = new Set(list.map((m) => m.data.weeks.length));
  if (weekCounts.size > 1) warnings.push(`${period}: languages have different week counts (${list.map((m) => `${m.lang}=${m.data.weeks.length}`).join(", ")})`);
}

if (!quiet || errors.length) {
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`error    ${e}`);
}
console.log(`\nChecked ${months.length} month files: ${errors.length} error(s), ${warnings.length} warning(s).`);
if (errors.length) process.exitCode = 1;
