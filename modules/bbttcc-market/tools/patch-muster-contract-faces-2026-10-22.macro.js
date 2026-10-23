/* patch-muster-contract-faces-2026-10-22.macro.js — the Muster's crews and associations get FACES (Dave 2026-10-22:
 * "Give the crews faces… TOTALLY use Asli's stuff… let the players choose the portrait").
 * Each crew / association contract in the bbttcc-market catalog gets an Asli lineage token as its default image (was a
 * Foundry stock icon). The player still picks the face at hire (api.contracts.choosePortrait → Asli art picker); this
 * default is what the Hire tab shows and what a contract carries until they choose.
 * Idempotent; DRY_RUN default true; returns the before-images (the backup). GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MOD = "bbttcc-market";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const BASE = "art/bbttcc/asli-trailer/tokens/";
  const FACES = {
    "Storm Wardens":          "stormborn-nomad-1.webp",
    "Ashbound Survivors":     "rustland-scavernger-1.webp",
    "Verdant Stalkers":       "cryptidkin-furrykin-2.webp",
    "Cultural Ambassadors":   "oldenborn-lumenwrought-1.webp",
    "Peacekeeper Corps":      "human-erectus-2.webp",
    "Mercenary Band":         "human-erectus-1.webp",
    "Diplomatic Envoys":      "sephirotic-scion-1.webp",
    "Abyssal Cartographers":  "oldborn-tideborn.webp",
    "Covert Ops Cell":        "circuitborn-synapse-1.webp",
    "Ironbound Ascendants":   "menhirkin-1.webp",
    "Gridbreakers":           "circuitborn-salvage-2.webp",
    "Survivors / Militia":    "stormborn-nomad-3.webp",
    "Biomancer / Fleshcrafter": "qliph-scarred-1.webp",
    "Kabbalist":              "sephirotic-scion-2.webp",
    "Prophet / Oracle":       "oldborne-sky.webp",
    "Alchemist":              "circuitborn-salvage-3.webp",
    "Gnostic":                "sephirotic-scion-3.webp",
    "Shaman":                 "cryptidkin-furrykin-3.webp",
    "Tarot Mage":             "oldenborn-lumenwrought-2.webp",
    "Rosicrucian":            "sephirotic-scion-4.webp",
    "Goetic Summoner":        "qliph-scarred-3.webp",
    "Exorcist / Purifier":    "oldenborn-earthbound.webp"
  };

  // every face must exist on this server before anything is written
  const missing = [];
  for (const f of new Set(Object.values(FACES))) {
    try { const r = await fetch(BASE + f, { method: "HEAD", cache: "no-store" }); if (!r.ok) missing.push(f); } catch (_e) { missing.push(f); }
  }
  if (missing.length) { ui.notifications.error(`Muster faces: ${missing.length} token(s) missing — nothing written.`); return { missing }; }

  const raw = game.settings.get(MOD, "catalog") || [];
  const catalog = JSON.parse(JSON.stringify(raw));   // a TRUE copy — deepClone can share the settings cache
  const arr = Array.isArray(catalog) ? catalog : Object.values(catalog);
  const report = [], backup = {}; let changes = 0;
  for (const e of arr) {
    if (e?.kind !== "contract") continue;
    const short = String(e.name || "").replace(/\s+—.*$/, "").trim();
    const file = FACES[short];
    if (!file) { report.push(`? ${short}: no face mapped — left as is`); continue; }
    const want = BASE + file;
    if (e.img === want) { report.push(`· ok ${short}`); continue; }
    backup[e.id] = e.img ?? null;
    e.img = want; changes++;
    report.push(`✚ ${short}: ${String(backup[e.id] || "").split("/").pop()} → ${file}`);
  }
  const summary = `Muster faces — ${changes} contract(s)${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`;
  console.log(summary + "\n" + report.join("\n"));
  ui.notifications.info(summary);
  if (!DRY_RUN && changes) await game.settings.set(MOD, "catalog", Array.isArray(catalog) ? arr : catalog);
  return { dryRun: DRY_RUN, changes, report, backup };
})();
