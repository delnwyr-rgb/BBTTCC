// Bad Eden — Backfill empty item descriptions from stranded sources (READ→WRITE)
// ─────────────────────────────────────────────────────────────────────────────
// Many items show a BLANK description in-world even though authored, practical
// text exists — it's just stranded in a flag Foundry doesn't display. Two homes:
//   1. flags.fourththing.rfi.item.lore — rich HTML from RFI seeders
//      (e.g. Confession Crystal, Sephirotic Lens, Threshold Bell).
//   2. flags.fourththing.rfi.item.legacySystem.description.value — the original
//      description carried over from the dnd5e port (e.g. Ego-Dragon Scale Aegis,
//      Unicorn Ramming Module, Abacus Gauntlet). These read as "empty stubs" but
//      hold the real practical write-up ("resistance to psychic; once/day…").
//
// Copies the best available source → system.description.value ONLY when the
// description is empty (ignoring any surface-mechanics marker block + whitespace).
// Preference: lore (HTML) → legacySystem description → signature (italic line).
// Never overwrites a description that already has prose. Idempotent + DRY_RUN.
//
// Run BEFORE surface-mechanics so the recovered prose is what gets the ⚙️ block.
// NOTE: legacy text may carry dnd5e residue (gp prices, "recharge 5-6") worth a
// later cleanup pass — but it's accurate about what the item DOES, which is the goal.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;            // <-- true to preview only
const INCLUDE_WORLD_ITEMS = true; // also fix copies in the world Items sidebar (separate docs!)

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);

  const MARK = /<!-- BBTTCC:MECHANICS:START -->[\s\S]*?<!-- BBTTCC:MECHANICS:END -->/g;
  const isEmptyDesc = (html) => String(html ?? "").replace(MARK, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() === "";
  const nonEmpty = (html) => String(html ?? "").replace(/<[^>]+>/g, "").trim() !== "";
  const wrap = (s) => /^\s*</.test(String(s)) ? String(s) : `<p>${String(s)}</p>`;

  // Returns the recovered description html for an item, or a reason it was skipped.
  function recover(item) {
    const sys = item.system ?? {};
    if (!isEmptyDesc(sys.description?.value)) return { skip: "hasProse" };
    const rfi = item.flags?.fourththing?.rfi?.item ?? {};
    const legacyDesc = rfi.legacySystem?.description?.value;
    const html = nonEmpty(rfi.lore) ? String(rfi.lore)
      : nonEmpty(legacyDesc) ? wrap(legacyDesc)
      : (rfi.signature && String(rfi.signature).trim() ? `<p><em>${String(rfi.signature).trim()}</em></p>` : "");
    if (!html) return { skip: "noSource" };
    const block = (String(sys.description?.value ?? "").match(MARK) || [])[0] || "";
    return { html: html + (block ? "\n" + block : "") };
  }

  async function handle(label, docs, applyFn) {
    const updates = [], names = [], noSource = []; let hasProse = 0;
    for (const item of docs) {
      const r = recover(item);
      if (r.skip === "hasProse") { hasProse++; continue; }
      if (r.skip === "noSource") { noSource.push(item.name); continue; }
      updates.push({ _id: item.id, "system.description.value": r.html });
      names.push(item.name);
    }
    console.group(`%c[${label}] recovered ${updates.length}`, "color:#ffb000;font-weight:bold");
    names.forEach(n => console.log("• " + n));
    console.log(`already-has-prose: ${hasProse}; empty + no source: ${noSource.length}`);
    if (noSource.length) console.log("no source (truly blank):", noSource.join(", "));
    console.groupEnd();
    if (!DRY_RUN && updates.length) await applyFn(updates);
    return { recovered: updates.length, noSource: noSource.length };
  }

  let total = { recovered: 0, noSource: 0 };
  const add = (r) => { total.recovered += r.recovered; total.noSource += r.noSource; };

  // 1) Compendium pack (unlock → write → relock).
  add(await handle(`pack:${PACK_ID}`, await pack.getDocuments(), async (updates) => {
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try { await Item.updateDocuments(updates, { pack: PACK_ID }); }
    finally { if (wasLocked) await pack.configure({ locked: true }); }
  }));

  // 2) World Items directory (separate documents — surface-mechanics scans these too).
  if (INCLUDE_WORLD_ITEMS) {
    add(await handle("world-items", Array.from(game.items), async (updates) => {
      await Item.updateDocuments(updates);
    }));
  }

  ui.notifications.info(
    `Lore backfill: ${total.recovered} description(s) ${DRY_RUN ? "WOULD be" : "were"} recovered ` +
    `(pack + world); ${total.noSource} have no source` + (DRY_RUN ? " (DRY RUN)." : ".")
  );
})();
