// BBTTCC — Caster Discipline feat tagging (Phase A foundation, 2026-05-07)
// ─────────────────────────────────────────────────────────────────────────────
// Companion to update-caster-discipline-pilot.macro.js. The pilot rewrote the
// four caster CLASS STUBS to advertise a 5-pt Manifestation Discipline budget
// (Misfire/Clarity/Reach/Upkeep/Concurrency), but explicitly deferred feat-
// item tagging — leaving the entire budget engine-wired (see
// systems/fourththing/manifestation-discipline.js) but content-untagged.
//
// This macro stamps the L1/Init-1 discipline knob on each TCC's first L1
// feat grant, matching the budget the pilot text already advertises.
//
// Per-class T1/Init-1 stamps (read from class stub mechanical hooks):
//   • Cosmic Linguist  Init 1 → reachDiscount:    1   (True-Name Touch — Reach -1 Surge on named target)
//   • Wyrdlens Adept   T1     → misfireBandShift: -1  (Lens Read — misfire band lowered by 1)
//   • Dreamwalker      T1     → clarityMaxBonus:  2   (Oneiric Reservoir — Clarity max +2)
//   • Pactkeeper       Init 1 → concurrencyBonus: 1   (The Bargain — +1 sustained at no extra upkeep, permissive)
//
// Higher-tier features (T2/T3/T4 and Init 6/11/16) are mostly Sig Mode stances
// (deferred per pilot text) or per-Soma-Break consumables — they don't carry
// passive discipline knobs and stay un-tagged for now.
//
// Idempotent. Match-by-name + class-doc ItemGrant ladder walk.
// Run as a GM script macro.
// ─────────────────────────────────────────────────────────────────────────────

const PACK = "bbttcc-master-content.classes";

const TAGS = [
  { className: "Cosmic Linguist", knob: { reachDiscount:    1 }, label: "True-Name Touch (Init 1)" },
  { className: "Wyrdlens Adept",  knob: { misfireBandShift: -1 }, label: "Lens Read (T1)" },
  { className: "Dreamwalker",     knob: { clarityMaxBonus:  2 }, label: "Oneiric Reservoir (T1)" },
  { className: "Pactkeeper",      knob: { concurrencyBonus: 1 }, label: "The Bargain (Init 1)" }
];

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const pack = game.packs.get(PACK);
if (!pack) { ui.notifications.error(`Pack not found: ${PACK}`); return; }
if (pack.locked) {
  try { await pack.configure({ locked: false }); }
  catch (e) { console.warn(`[tag-caster-discipline-feats] could not unlock ${PACK}`, e); }
}

const classIndex = await pack.getIndex({ fields: ["name", "type"] });
const results = [];

// Walk a class doc's advancement array, return the FIRST ItemGrant at level 1.
// Returns the granted feat UUID array, or [] if no L1 grant exists.
function _findL1Grants(classDoc) {
  const advs = Array.isArray(classDoc.system?.advancement) ? classDoc.system.advancement : [];
  for (const adv of advs) {
    if (adv?.type !== "ItemGrant") continue;
    if (Number(adv?.level) !== 1) continue;
    const items = Array.isArray(adv.configuration?.items) ? adv.configuration.items : [];
    return items.map(e => e?.uuid).filter(Boolean);
  }
  return [];
}

// Resolve a UUID to a live document. fromUuid handles cross-pack refs.
async function _resolve(uuid) {
  try { return await fromUuid(uuid); }
  catch (e) { return null; }
}

for (const cfg of TAGS) {
  const entry = classIndex.find(e => e.name === cfg.className && e.type === "class");
  if (!entry) { results.push(`MISS class "${cfg.className}" not found in ${PACK}`); continue; }

  let classDoc;
  try { classDoc = await pack.getDocument(entry._id); }
  catch (e) { results.push(`ERR  ${cfg.className}: class doc fetch — ${e.message}`); continue; }

  const grantUuids = _findL1Grants(classDoc);
  if (!grantUuids.length) {
    results.push(`SKIP ${cfg.className}: no L1 ItemGrant in class advancement (manual tagging required)`);
    continue;
  }

  // Tag the FIRST L1 grant. Multiple grants at L1 are rare for these classes;
  // if it happens we want a deterministic single-target so the budget doesn't
  // double-stamp.
  const targetUuid = grantUuids[0];
  const targetDoc  = await _resolve(targetUuid);
  if (!targetDoc) {
    results.push(`MISS ${cfg.className}: L1 grant uuid ${targetUuid} could not be resolved`);
    continue;
  }

  // Idempotency check — if the same knob+value is already stamped, no-op.
  const existing = targetDoc.flags?.fourththing?.discipline?.passive ?? {};
  const same = Object.entries(cfg.knob).every(([k, v]) => existing[k] === v);
  if (same) {
    results.push(`OK-NOOP ${cfg.className}: ${cfg.label} [${targetDoc.name}] already tagged`);
    continue;
  }

  // Merge — preserve any existing discipline.passive keys (e.g. if a future
  // sprint adds a second knob to the same feat).
  const merged = foundry.utils.mergeObject({ ...existing }, cfg.knob);

  try {
    // If the doc lives in a locked pack, briefly unlock it.
    const ownerPack = targetDoc.pack ? game.packs.get(targetDoc.pack) : null;
    if (ownerPack && ownerPack.locked) {
      try { await ownerPack.configure({ locked: false }); }
      catch (_) { /* best effort */ }
    }
    await targetDoc.update({ "flags.fourththing.discipline.passive": merged });
    results.push(`OK   ${cfg.className}: ${cfg.label} [${targetDoc.name}] ← ${JSON.stringify(cfg.knob)}`);
  } catch (e) {
    results.push(`ERR  ${cfg.className}: ${cfg.label} update failed — ${e.message}`);
    console.error(`[tag-caster-discipline-feats] ${cfg.className}`, e);
  }
}

ChatMessage.create({
  speaker: { alias: "BBTTCC Caster Discipline Tagging" },
  content: `<h4>Caster Discipline feat tagging — Phase A</h4>
            <pre style="font-size:0.78em;white-space:pre-wrap;">${foundry.utils.escapeHTML(results.join("\n"))}</pre>
            <p style="opacity:0.8;font-size:0.85em">Tier-1 budget knobs only. Higher tiers + Sig Modes deferred until playtest signal.</p>`
});

return results;
