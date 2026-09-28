# oclm-content

Workbook month content for **OCLM Scheduler**. Installed apps download it from
[jsDelivr](https://www.jsdelivr.com/) so new months appear without installing a new version:

```
https://cdn.jsdelivr.net/gh/jorgerosal/oclm-content@main/manifest.json
https://cdn.jsdelivr.net/gh/jorgerosal/oclm-content@main/bundle.json
```

> **This repository is public.** It holds workbook structure only: titles, references,
> times, songs and roles. Never commit congregation data such as names, assignments,
> contact details or settings. Those stay on each device. The checks reject files that
> look like they contain such data.

## Layout

```
source/<LANG>/<YYYYMM>.json   One file per language and month (edit these)
manifest.json                 Built: list of months and the content version
bundle.json                   Built: every month in one file, downloaded by the app
scripts/                      validate, build and reminder scripts (Node 20+, no dependencies)
.github/workflows/            Automation (see below)
```

Languages: `BCL` Bicol, `CEB` Cebuano, `EN` English, `HIL` Hiligaynon, `ILO` Iloko,
`PAG` Pangasinan, `SL` Sign Language, `TL` Tagalog, `WAR` Waray-waray.

Do not edit `manifest.json` or `bundle.json` by hand; they are rebuilt automatically.

## Adding a new month

**Easiest:** in OCLM Scheduler open **Settings → Maintainer → Content Editor**, choose this
folder, edit or add the month, then click **Publish**. It saves the file, rebuilds, commits
and pushes.

**By hand:** copy the previous month's file for that language, update it, then run:

```bash
npm run validate   # check every month file
npm run build      # rebuild manifest.json and bundle.json
```

Commit and push. The Publish workflow rebuilds anyway, so pushing only `source/` is fine.

### Month file rules (checked automatically)

- File `source/<LANG>/<YYYYMM>.json`; `period` and `language` match the file and folder.
- `firstMonday` is the Monday of the first week, e.g. `2026-09-07`.
- Week ids are `YYYYMM.1`, `YYYYMM.2`, … in order; each has a `week` label, `bibleReading` and 3 songs.
- Each week has `gems`, `ministry` and `living` parts. Part ids start with the week id,
  e.g. `202609.1.4`; reader parts end in `.r` and have no time.
- Every other part has a `time` of 1–60 minutes and at least one role:
  `elder`, `ms`, `br` (Bible reading), `demo`, `talk`, `cbs` (CBS conductor), `rdr` (CBS reader).
- `autofills` must point to parts in the same week.
- No text such as `undefined` or `null`; no email addresses; no congregation fields.

The same month should have the same number of weeks and the same `firstMonday` in every
language; differences are reported as warnings.

## Automation

| Workflow | When | What it does |
|---|---|---|
| **Validate** | Every pull request | Runs `scripts/validate.mjs`. A failing check blocks the merge. |
| **Publish** | Push to `main` that changes `source/` or `scripts/` | Validates, rebuilds `manifest.json` and `bundle.json`, commits them, and clears the jsDelivr cache so apps get the update right away. |
| **Workbook reminder** | 1st and 15th of each month | Opens or updates the issue **"Workbook months needed"** listing languages without content for the current and next two months, and closes it once everything is in. |

Check locally what is missing:

```bash
npm run upcoming
```

## How the app uses this

- On launch, and when the refresh button in the app header is pressed, the app fetches
  `manifest.json`. If its `version` is newer than what the device has, it downloads
  `bundle.json` and caches it for offline use.
- `version` is the time of the last commit that changed `source/`, so it only changes when
  the content does.
- `schemaVersion` changes only if the month format changes in a way older apps can't read;
  older apps then keep their current content instead of breaking.

## Volunteers

To help with a language, fork the repository, add or fix files under `source/<LANG>/`, and
open a pull request. The Validate check runs automatically, and the maintainer reviews and
merges it.
