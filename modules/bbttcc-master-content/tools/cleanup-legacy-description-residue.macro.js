// Bad Eden — Clean dnd5e residue out of recovered item descriptions (pack + world)
// ─────────────────────────────────────────────────────────────────────────────
// The backfill recovered descriptions from the dnd5e-port legacy field. That text
// carries artifacts: authoring stubs ([TODO(...)]), old units (gp, hit points),
// dnd recharge/rest phrasing, and a few grammar bobbles. This normalizes them into
// Bad Eden terms across system.description.value, in BOTH the compendium pack and
// the world Items directory.
//
// HIGH-CONFIDENCE textual swaps only (logged old→new per item). Distances ("30 ft")
// are LEFT ALONE by default — set FT_PER_HEX to a real ratio to convert them to
// hexes (I don't know your canonical scale, so I won't guess). Idempotent: a second
// run finds nothing to change. DRY_RUN previews without writing.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;            // <-- true to preview only
const INCLUDE_WORLD_ITEMS = true;
const FT_PER_HEX = 0;             // 0 = leave distances as-is. e.g. 5 → "30 ft" becomes "6 hexes".

// Order matters. Each is [regex, replacement].
const SWAPS = [
  [/\s*\[TODO[^\]]*\]/gi, ""],                          // strip authoring stubs
  [/\bonce\s+per\s+a\s+Soma\s+Break\b/gi, "once per Soma Break"],
  [/\bper\s+a\s+Soma\s+Break\b/gi, "per Soma Break"],
  [/\bhit\s+points?\b/gi, "Integrity"],
  [/\bHP\b/g, "Integrity"],
  [/\bgp\b/gi, "marks"],
  [/\b(?:long|short)\s+rests?\b/gi, "Soma Break"],
  [/\bper\s+rest\b/gi, "per Soma Break"],
  [/\bonce\s*\/\s*day\b/gi, "once per Soma Break"],
  [/\b1\s*\/\s*day\b/gi, "1 per Soma Break"],
  [/\bonce\s+per\s+day\b/gi, "once per Soma Break"],
  [/\bper\s+day\b/gi, "per Soma Break"],
  [/\brecharge\s*\d\s*[-–—]\s*\d\b/gi, "recharges on a Soma Break"],
  [/\bhave\s+reroll\b/gi, "reroll"],
];

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);

  const clean = (html) => {
    let out = String(html ?? "");
    for (const [re, rep] of SWAPS) out = out.replace(re, rep);
    if (FT_PER_HEX > 0) {
      out = out.replace(/(\d+)\s*(?:ft|feet|foot)\b/gi, (_, n) => {
        const hexes = Math.max(1, Math.round(Number(n) / FT_PER_HEX));
        return `${hexes} hex${hexes === 1 ? "" : "es"}`;
      });
    }
    return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:])/g, "$1");
  };
  const strip = (h) => String(h ?? "").replace(/<[^>]+>/g, "").trim();

  async function handle(label, docs, applyFn) {
    const updates = [];
    for (const item of docs) {
      const cur = item.system?.description?.value;
      if (!strip(cur)) continue;
      const next = clean(cur);
      if (next !== String(cur ?? "")) {
        updates.push({ _id: item.id, "system.description.value": next });
        console.log(`• ${item.name}\n   – ${strip(cur).slice(0, 160)}\n   + ${strip(next).slice(0, 160)}`);
      }
    }
    console.log(`%c[${label}] ${updates.length} description(s) cleaned`, "color:#ffb000;font-weight:bold");
    if (!DRY_RUN && updates.length) await applyFn(updates);
    return updates.length;
  }

  let total = 0;
  console.group("%ccleanup-legacy-description-residue", "color:#ffb000;font-weight:bold");
  total += await handle(`pack:${PACK_ID}`, await pack.getDocuments(), async (u) => {
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try { await Item.updateDocuments(u, { pack: PACK_ID }); }
    finally { if (wasLocked) await pack.configure({ locked: true }); }
  });
  if (INCLUDE_WORLD_ITEMS) total += await handle("world-items", Array.from(game.items), async (u) => { await Item.updateDocuments(u); });
  console.groupEnd();

  ui.notifications.info(`Residue cleanup: ${total} description(s) ${DRY_RUN ? "WOULD be" : "were"} cleaned (pack + world)` + (DRY_RUN ? " (DRY RUN)." : "."));
})();
