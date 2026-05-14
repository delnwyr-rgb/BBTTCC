// BBTTCC — Sig Mode discipline-grant verifier + DW Walking Lane patch
// (Phase D — 2026-05-08)
// ─────────────────────────────────────────────────────────────────────────────
// Verifies that the four Sig Mode feat items carry the expected
// `flags.fourththing.discipline.mode.{key, grants}` payload so the engine
// shifts the discipline budget when the stance is held. Three of the four
// were authored with grants already; this macro is the safety net + fills
// in DW Walking Lane (which shipped with empty grants).
//
// Idempotent. Match-by-name + type:"feat". Run as a GM script macro.
// ─────────────────────────────────────────────────────────────────────────────

const PACK = "bbttcc-master-content.classes";

const TAGS = [
  {
    name: "Cosmic Linguist: Initiation 11 — The Sentence (Signature Mode)",
    expectedKey: "clSentence",
    expectedGrants: { reachDiscount: 1 }
  },
  {
    name: "Wyrdlens Adept: Tier 3 — Refraction (Signature Mode)",
    expectedKey: "wlRefraction",
    expectedGrants: { misfireBandShift: -2 }
  },
  {
    name: "Dreamwalker: Tier 3 — The Walking Lane (Signature Mode)",
    expectedKey: "dwWalkingLane",
    // Class text: "ignore one band of cover or distance for any one effect per
    // round." Maps to a Reach discount — sustained manifestations reach across
    // realms while held. Tunable.
    expectedGrants: { reachDiscount: 1 }
  },
  {
    name: "Pactkeeper: Initiation 11 — Sealed Pact (Signature Mode)",
    expectedKey: "pkSealedPact",
    expectedGrants: { upkeepScale: 0.5, concurrencyBonus: 2 }
  }
];

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const pack = game.packs.get(PACK);
if (!pack) { ui.notifications.error(`Pack not found: ${PACK}`); return; }
if (pack.locked) {
  try { await pack.configure({ locked: false }); }
  catch (e) { console.warn(`[tag-sig-mode-grants] could not unlock ${PACK}`, e); }
}

const index = await pack.getIndex({ fields: ["name", "type"] });
const results = [];

for (const cfg of TAGS) {
  const entry = index.find(e => e.name === cfg.name && e.type === "feat");
  if (!entry) { results.push(`MISS ${cfg.name} not found in ${PACK}`); continue; }

  let doc;
  try { doc = await pack.getDocument(entry._id); }
  catch (e) { results.push(`ERR  ${cfg.name}: fetch — ${e.message}`); continue; }

  const existing = doc.flags?.fourththing?.discipline?.mode ?? null;
  const sameKey  = existing?.key === cfg.expectedKey;
  const sameGrants = existing?.grants
    && Object.entries(cfg.expectedGrants).every(([k, v]) => existing.grants[k] === v);

  if (sameKey && sameGrants) {
    results.push(`OK-NOOP  ${doc.name} → key=${cfg.expectedKey} grants=${JSON.stringify(cfg.expectedGrants)}`);
    continue;
  }

  // Merge over existing — preserve any extra grants, override only the
  // expected keys. Key always overwritten when stale.
  const mergedGrants = { ...(existing?.grants ?? {}), ...cfg.expectedGrants };
  const payload = { key: cfg.expectedKey, grants: mergedGrants };

  try {
    await doc.update({ "flags.fourththing.discipline.mode": payload });
    results.push(`OK       ${doc.name} ← key=${cfg.expectedKey} grants=${JSON.stringify(mergedGrants)}`);
  } catch (e) {
    results.push(`ERR  ${doc.name}: update — ${e.message}`);
    console.error(`[tag-sig-mode-grants] ${doc.name}`, e);
  }
}

ChatMessage.create({
  speaker: { alias: "BBTTCC Sig Mode Tagging" },
  content: `<h4>Sig Mode discipline-grant verification — Phase D</h4>
            <pre style="font-size:0.78em;white-space:pre-wrap;">${foundry.utils.escapeHTML(results.join("\n"))}</pre>
            <p style="opacity:0.8;font-size:0.85em">Three of the four were pre-tagged by content authoring; this macro is the safety net + DW Walking Lane fill.</p>`
});

return results;
