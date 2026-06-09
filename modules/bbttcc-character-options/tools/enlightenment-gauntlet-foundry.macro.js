// enlightenment-gauntlet-foundry.macro.js — RUN IN-WORLD (GM). CREATES test docs (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
// ENLIGHTENMENT GAUNTLET · Phase 2 — THE FORGE. Sister to the raid/travel/tikkun forges.
// Stands up a disposable test subject the Phase-3 runner drives the Enlightenment engine on:
//   • One character actor "ENLIGHTGAUNTLET · Pilgrim" (type:character, GM-owned, clean of any
//     prior enlightenment items/effects) — the engine only reconciles type:"character".
//   • One faction actor "ENLIGHTGAUNTLET · Order" (isFaction, tier 4, darkness seeded per-region)
//     so the runner can later assert Fix-D faction sync (character level → faction darkness decay).
//   • A MANIFEST journal flag with both ladders' level keys so the runner is self-describing.
// Idempotent: tears down + rebuilds only its own "ENLIGHTGAUNTLET ·" docs. Touches nothing else.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const PREFIX = "ENLIGHTGAUNTLET ·";
  const MOD = "bbttcc-character-options", FCT = "bbttcc-factions";
  const log = (...a) => console.log("[enlight-forge]", ...a);
  const warn = (...a) => console.warn("[enlight-forge]", ...a);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ── 1. Teardown prior gauntlet docs ──
  for (const [coll, cls] of [[game.actors, Actor], [game.journal, JournalEntry]]) {
    const ids = coll.filter(d => d.name?.startsWith(PREFIX)).map(d => d.id);
    if (ids.length) { try { await cls.deleteDocuments(ids); log(`removed ${ids.length} ${cls.name}`); } catch (e) { warn("teardown failed", cls.name, e); } }
  }

  // ── 2. The Pilgrim (clean character) ──
  const pilgrim = await Actor.create({ name: `${PREFIX} Pilgrim`, type: "character", img: "icons/magic/holy/meditation-chi-focus-blue.webp" });
  // Strip anything the ready-hook may have stamped during create, so the runner starts from zero.
  const stale = pilgrim.effects?.filter(e => e.getFlag(MOD, "enlightenment") === true).map(e => e.id) ?? [];
  if (stale.length) await pilgrim.deleteEmbeddedDocuments("ActiveEffect", stale);
  try { await pilgrim.unsetFlag(MOD, "enlightenment"); } catch (_e) {}
  await sleep(100);
  log("pilgrim", pilgrim.id);

  // ── 3. The Order (faction, for Fix-D sync probe) ──
  const order = await Actor.create({
    name: `${PREFIX} Order`, type: "npc",
    img: "icons/magic/holy/barrier-shield-winged-gold.webp",
    flags: { [FCT]: { isFaction: true, tier: 4, darkness: { global: 0, north: 5, south: 5, east: 5 } } }
  });
  // Enrol the Pilgrim in the Order so the runner can assert Fix-D (character level → faction flag).
  await pilgrim.setFlag(FCT, "factionId", order.id);
  await sleep(100);
  log("order", order.id);

  // ── 4. Manifest ──
  const manifest = {
    pilgrimId: pilgrim.id,
    orderId: order.id,
    // The unified canonical ladder + the legacy AE-vocab aliases the engine still resolves.
    canonicalKeys: ["unawakened","awakening","seeking","wisdom","understanding","enlightened","qliphothic"],
    aliasMap: { awakened: "awakening", adept: "seeking", illuminated: "wisdom", transcendent: "enlightened", sleeper: "unawakened" },
    when: new Date().toISOString()
  };
  const journal = await JournalEntry.create({ name: `${PREFIX} Manifest`, flags: { [MOD]: { gauntletManifest: manifest } } });
  await journal.createEmbeddedDocuments("JournalEntryPage", [{
    name: "Manifest", type: "text",
    text: { content: `<pre>${JSON.stringify(manifest, null, 2)}</pre>` }
  }]);

  console.log(`%c=== ENLIGHTENMENT FORGE done (${Math.round(performance.now() - t0)}ms) ===`, "font-weight:bold;color:#6c6");
  console.table([{ pilgrim: pilgrim.id, order: order.id, journal: journal.id }]);
  ui.notifications.info("Enlightenment Forge ready — now run the Runner (Phase 3).");
})();
