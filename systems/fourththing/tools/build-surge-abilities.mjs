#!/usr/bin/env node
// Generate the surge-abilities compendium source — one discrete Foundry Item per
// _FT_SURGE_MENU entry, so Automated Animations can be configured per-ability and
// _ftSurgeExecute can invoke ftPlayAutoAnimation(actor, item). Re-run whenever the
// menu changes, then recompile the pack:
//   node systems/fourththing/tools/build-surge-abilities.mjs
//   fvtt package pack -n surge-abilities \
//     --in systems/fourththing/packs/_source/surge-abilities \
//     --out systems/fourththing/packs
//
// The menu is pure data, so we slice the array literal out of module.js and eval
// it rather than importing the whole system module (which expects a Foundry env).

import { readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SYS  = resolve(here, "..");
const OUT  = resolve(SYS, "packs/_source/surge-abilities");

const src = readFileSync(resolve(SYS, "module.js"), "utf8");

// Slice from `const _FT_SURGE_MENU = [` to the first line that is exactly `];`.
const startTok = "const _FT_SURGE_MENU = [";
const startIdx = src.indexOf(startTok);
if (startIdx < 0) throw new Error("Could not find _FT_SURGE_MENU in module.js");
const after = src.slice(startIdx + startTok.length - 1); // keep the opening [
const endIdx = after.search(/\n\];/);
if (endIdx < 0) throw new Error("Could not find end of _FT_SURGE_MENU");
const arrayLiteral = after.slice(0, endIdx + 2); // include the closing ]
// eslint-disable-next-line no-eval
const MENU = eval(arrayLiteral);
if (!Array.isArray(MENU) || !MENU.length) throw new Error("Parsed menu is empty");

const BUCKET_IMG = {
  off:  "icons/svg/sword.svg",
  def:  "icons/svg/shield.svg",
  heal: "icons/svg/regen.svg",
  narr: "icons/svg/dice-target.svg",
};
const BUCKET_LABEL = { off: "Offense", def: "Defense", heal: "Heal", narr: "Narrative" };

const CLASS_TAGS = ["classFilter", "forge", "mandate", "trance", "bulwarkPath",
  "courierRoute", "pactDoctrine", "wlRefraction", "clDoctrine"];
const pretty = (s) => String(s ?? "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();
function classLabel(e) {
  if (e.classFilter)  return pretty(Array.isArray(e.classFilter) ? e.classFilter[0] : e.classFilter);
  if (e.forge)        return `Forge ▸ ${pretty(e.forge)}`;
  if (e.mandate)      return `Mandate ▸ ${pretty(e.mandate)}`;
  if (e.trance)       return `Trance ▸ ${pretty(e.trance)}`;
  if (e.bulwarkPath)  return `Bulwark ▸ ${pretty(e.bulwarkPath)}`;
  if (e.courierRoute) return `Route ▸ ${pretty(e.courierRoute)}`;
  if (e.pactDoctrine) return `Doctrine ▸ ${pretty(e.pactDoctrine)}`;
  if (e.wlRefraction) return `Refraction ▸ ${pretty(e.wlRefraction)}`;
  if (e.clDoctrine)   return `Doctrine ▸ ${pretty(e.clDoctrine)}`;
  return "";
}
const isClass = (e) => CLASS_TAGS.some(t => e[t] != null);

// Stable 16-char id: "ftsurge" (7) + 9-digit index.
const idFor = (i) => `ftsurge${String(i + 1).padStart(9, "0")}`;

// Clean stale source so removed menu keys don't leave orphan items.
try { for (const f of readdirSync(OUT)) if (f.endsWith(".json")) rmSync(resolve(OUT, f)); } catch {}
mkdirSync(OUT, { recursive: true });

let n = 0;
for (let i = 0; i < MENU.length; i++) {
  const e = MENU[i];
  const head = String(e.label || e.key).split(" — ")[0];
  const mech = String(e.label || "").split(" — ").slice(1).join(" — ") || head;
  const kind = isClass(e) ? classLabel(e) : "General";
  const descValue =
    `<p><em>${e.fiction || ""}</em></p>` +
    `<p>${mech}</p>` +
    `<p style="opacity:0.7"><strong>${e.cost}◆ Surge</strong> · ${BUCKET_LABEL[e.bucket] || e.bucket}` +
    `${e.tier > 1 ? ` · Tier ${e.tier}+` : ""} · ${kind}</p>`;

  const doc = {
    _id: idFor(i),
    name: head,
    type: "feature",
    img: BUCKET_IMG[e.bucket] || "icons/svg/dice-target.svg",
    system: {
      category: "principle",
      source: "Surge",
      tags: [e.bucket, isClass(e) ? "class" : "general"],
      description: { value: descValue, chat: "" },
    },
    effects: [],
    folder: null,
    sort: (i + 1) * 100,
    ownership: { default: 0 },
    flags: {
      fourththing: {
        surgeKey: e.key,
        surgeBucket: e.bucket,
        surgeCost: e.cost,
        surgeTier: e.tier,
        surgeClass: kind,
      },
    },
  };
  writeFileSync(resolve(OUT, `${e.key}.json`), JSON.stringify(doc, null, 2) + "\n");
  n++;
}
console.log(`Wrote ${n} surge-ability source items to ${OUT}`);
