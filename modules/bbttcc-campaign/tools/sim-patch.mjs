#!/usr/bin/env node
/* sim-patch.mjs — run a campaign patch macro OFFLINE against a campaign export, so the result can be linted
 * before the owner applies it live (2026-10-17, built for the Alpha-cut teaching beats).
 *
 *   node modules/bbttcc-campaign/tools/sim-patch.mjs <patch.macro.js> <campaigns-export.json> --out <patched.json>
 *        [--tables <encounterTables-export.json>] [--campaign <id>] [--dry]
 *
 * The macro runs inside a tiny Foundry shim: game.settings.get/set over the export(s), foundry.utils.deepClone,
 * ui.notifications → console, saveDataToFile → no-op, game.user.isGM = true, and the active campaign id = the
 * export's first campaign (or --campaign). `const DRY_RUN = true` is flipped to false unless --dry is given.
 * Writes the patched `campaigns` value to --out (same shape as the export) and prints the macro's own report.
 * Then: bin/ft-lint-campaign <patched.json> --act 1
 */
import fs from "node:fs";
import vm from "node:vm";

const argv = process.argv.slice(2);
const opt = { files: [], out: null, tables: null, campaign: null, dry: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--out") opt.out = argv[++i];
  else if (a === "--tables") opt.tables = argv[++i];
  else if (a === "--campaign") opt.campaign = argv[++i];
  else if (a === "--dry") opt.dry = true;
  else opt.files.push(a);
}
const [macroPath, exportPath] = opt.files;
if (!macroPath || !exportPath || !opt.out) {
  console.error("usage: sim-patch.mjs <patch.macro.js> <campaigns-export.json> --out <patched.json> [--tables t.json] [--campaign id] [--dry]");
  process.exit(2);
}

const loadJson = (p) => { let raw = JSON.parse(fs.readFileSync(p, "utf8")); if (typeof raw === "string") raw = JSON.parse(raw); return raw; };
const settings = {
  "bbttcc-campaign": {
    campaigns: loadJson(exportPath),
    encounterTables: opt.tables ? loadJson(opt.tables) : {},
    directorState: { firedStoryBeats: {} }
  }
};
const campaignId = opt.campaign || Object.keys(settings["bbttcc-campaign"].campaigns)[0];
const written = {};

let code = fs.readFileSync(macroPath, "utf8");
if (!opt.dry) code = code.replace(/const DRY_RUN = true;/, "const DRY_RUN = false;");

const sandbox = {
  console,
  structuredClone,
  JSON, Object, Array, Map, Set, Number, String, Boolean, Date, Math, RegExp, Promise, Error,
  saveDataToFile: () => {},
  foundry: { utils: { deepClone: (v) => structuredClone(v), saveDataToFile: () => {} } },
  ui: { notifications: { info: (m) => console.log("[info]", m), warn: (m) => console.log("[warn]", m), error: (m) => { console.log("[ERROR]", m); process.exitCode = 1; } } },
  game: {
    user: { isGM: true, name: "sim" },
    settings: {
      get: (ns, key) => { const v = settings[ns]?.[key]; if (v === undefined) throw new Error(`"${ns}.${key}" is not a registered game setting`); return v; },
      set: async (ns, key, value) => { settings[ns] = settings[ns] || {}; settings[ns][key] = value; written[`${ns}.${key}`] = true; return value; }
    },
    bbttcc: { api: { campaign: { getActiveCampaignId: () => campaignId } } },
    actors: { get: () => null, contents: [] },
    scenes: { get: () => null, contents: [] }
  }
};
sandbox.globalThis = sandbox;

const result = vm.runInNewContext(code, sandbox, { filename: macroPath });
await Promise.resolve(result);

const out = settings["bbttcc-campaign"].campaigns;
fs.writeFileSync(opt.out, JSON.stringify(typeof out === "string" ? JSON.parse(out) : out, null, 0));
console.log(`\n[sim-patch] wrote ${opt.out} · settings written: ${Object.keys(written).join(", ") || "(none — dry run or no changes)"}`);
