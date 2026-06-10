// Bad Eden — Wyrdlens subclasses: Lens Charge → Clarity + per-use callout refresh
// ─────────────────────────────────────────────────────────────────────────────
// For each of the three Refraction subclass docs in the live
// `bbttcc-master-content.classes` pack (Foresight, Mercy, Truth):
//
//   (a) Replaces `<n> Lens Charge[s]` → `<n> Clarity` in the description.
//       The Lens Charges resource was never implemented in code; the class's
//       actual resource is Clarity.
//
//   (b) Rebuilds the trailing `<div data-ft-per-use="1" data-ft-per-use-key=...>`
//       aggregate callout block with the full ability roster (L1 / L3 / L5 / L9
//       / L13 / L14 where applicable). The L1 / L5 / L9 / L13 ladder is
//       newly-active per-use abilities, registered in CHAR_OPT_ABILITIES with
//       `clarityCost` so the dispatcher deducts Clarity on use.
//
// Idempotent: re-running re-rewrites Lens→Clarity (no-op once already done)
// and re-writes the aggregate block (overwrites with the same canonical HTML).
//
// Match-by-name. Source-of-truth JSON snapshots are in
//   modules/bbttcc-master-content/tools/snapshots/wyrdlens-refraction-*.json
//
// Run as a GM script macro. Sync to Lightsail via the usual rsync workflow.
// ─────────────────────────────────────────────────────────────────────────────

const PACK = "bbttcc-master-content.classes";

// Aggregate-callout content for each subclass. Mirrors the existing visual
// vocabulary used in other subclass docs (border #b08acc, etc.).
const CALLOUTS = {
  "Refraction of Foresight (Bad Eden)": {
    aggregateKey: "wyrdlensForesight",
    title: "Refraction of Foresight",
    rows: [
      { label: "The Anticipation (L1)",      recovery: "1/Soma Break", action: "Start of combat / significant scene",          cost: "1 Clarity",
        summary: "Narrate a specific event about to occur (Foreseen Action). Advantage / +5 on your first reaction to it. May grant it to an ally instead." },
      { label: "Force Enemy Reroll (L3)",    recovery: "1/Strategic Turn", action: "Strategic",                                 cost: "1 Intrigue OP",
        summary: "Force an enemy strategic reroll." },
      { label: "The Slowed Instant (L5)",    recovery: "Clarity-gated (intent: 1/round)", action: "Reaction (on ally targeted)", cost: "1 Clarity",
        summary: "Ally within 30 ft may take a bonus reaction (dodge, parry, counter, reposition) before the action resolves." },
      { label: "Read The Field (L9)",        recovery: "Clarity-gated", action: "Start of round",                                cost: "2 Clarity",
        summary: "GM reveals, broadly, the intended actions of all hostile creatures in the scene this round." },
      { label: "The Stopped Strike (L13)",   recovery: "1/scene", action: "Reaction (on creature action)",                       cost: "3 Clarity",
        summary: "Undo the action before it resolves; target may attempt a Soul save to retain (success acts at keep-lowest)." }
    ]
  },
  "Refraction of Mercy (Bad Eden)": {
    aggregateKey: "wyrdlensMercy",
    title: "Refraction of Mercy",
    rows: [
      { label: "The Soft Reading (L1)",      recovery: "Clarity-gated", action: "Trigger (on perceiving hostile intent)",       cost: "1 Clarity",
        summary: "Learn what the hostile creature wants (motive). Use the insight for diplomacy / de-escalation [TBD:balance]." },
      { label: "Mercy Refraction (L3)",      recovery: "1/scene", action: "Reaction (on witnessed lethal hit)",
        summary: "Convert a lethal hit you witness into non-lethal. If it forces surrender, +1 Diplomacy OP." },
      { label: "The Prevented Blow (L5)",    recovery: "Clarity-gated", action: "Reaction (on ally taking damage)",             cost: "2 Clarity",
        summary: "Insert a preemptive action (shove, distraction). Attack damage halved/reduced; attacker suffers no retaliation penalty." },
      { label: "The Redirected Harm (L9)",   recovery: "Clarity-gated", action: "Reaction (on perceived harm)",                 cost: "3 Clarity",
        summary: "Redirect a harmful effect (trap, curse, manifestation) to a non-living target. Works on enemies too." },
      { label: "The Open Hand (L13)",        recovery: "1/scene", action: "Free (at lethal turning point)",                     cost: "5 Clarity",
        summary: "Offer all creatures in scene a genuine disengage chance without cost. Acceptors lose no resources/face/progress." },
      { label: "Sephirothic Bloom (L14)",    recovery: "1/Soma Break", action: "Free (after non-lethal victory)",
        summary: "Darkness −1 and shift Hex one step toward a beneficial Sephirah." }
    ]
  },
  "Refraction of Truth (Bad Eden)": {
    aggregateKey: "wyrdlensTruth",
    title: "Refraction of Truth",
    rows: [
      { label: "The Reading Eye (L1)",       recovery: "Clarity-gated", action: "Focus 1 minute",                                cost: "1 Clarity",
        summary: "Perceive one concealed truth (recent lie, hidden motive, secret identity, disguise, false document, active Stealth)." },
      { label: "Truth Refraction (L3)",      recovery: "OP-cost", action: "Free (during Spark Identification)",                  cost: "1 Intrigue OP",
        summary: "Treat one Spark Identification roll ≤9 as a 10 this Turn. No daily cap; OP-cost only." },
      { label: "The Unconcealed Word (L5)",  recovery: "Clarity-gated", action: "Reaction (on lie spoken in your presence)",     cost: "1 Clarity",
        summary: "Perceive the truth the creature is lying about. You know it; you do not automatically speak it. Other creatures don't perceive your use." },
      { label: "The Forced Clarity (L9)",    recovery: "1/scene", action: "Action",                                              cost: "3 Clarity",
        summary: "Zone of Clarity: 30-ft radius for 1 minute. No creature in the zone can successfully lie / conceal / obscure through speech." },
      { label: "The Exposure (L13)",         recovery: "1/scene", action: "Action",                                              cost: "5 Clarity",
        summary: "Publicly reveal one concealed truth about a creature/faction/institution in the scene. Cannot be unspoken; carries mechanical consequences." },
      { label: "Unshatter (L14)",            recovery: "1/Soma Break", action: "Action (short penance)",
        summary: "Purify a Corrupted Spark step. Darkness −1." }
    ]
  }
};

function _rowHtml(r) {
  const cost = r.cost ? ` &nbsp;·&nbsp; <strong>Cost:</strong> ${r.cost}` : "";
  return `
    <div style="margin-top:0.35rem;padding:0.4rem 0.55rem;background:rgba(60,40,75,0.32);border-radius:0.25rem">
      <div style="font-size:0.82rem"><strong>${r.label}</strong></div>
      <div style="font-size:0.78rem;opacity:0.86;margin-top:0.15rem"><strong>Recovery:</strong> ${r.recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${r.action}${cost}</div>
      <div style="font-size:0.78rem;opacity:0.85;margin-top:0.15rem">${r.summary}</div>
    </div>`;
}

function _calloutHtml(spec) {
  return `<div data-ft-per-use="1" data-ft-per-use-key="${spec.aggregateKey}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Abilities — <strong>${spec.title}</strong></div>
  <div style="font-size:0.84rem;opacity:0.9">Click this subclass on your sheet to invoke. Each ability tracks its own cadence; Clarity-gated abilities deduct automatically.</div>${spec.rows.map(_rowHtml).join("")}
</div>`;
}

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const pack = game.packs.get(PACK);
if (!pack) { ui.notifications.error(`Pack not found: ${PACK}`); return; }
if (pack.locked) {
  try { await pack.configure({ locked: false }); }
  catch (e) { console.warn(`[wyrdlens-clarity-rewrite] could not unlock ${PACK}`, e); }
}

const index = await pack.getIndex({ fields: ["name", "type"] });
const report = [];

for (const [name, spec] of Object.entries(CALLOUTS)) {
  const entry = index.find(e => e.name === name && e.type === "subclass");
  if (!entry) { report.push({ name, status: "NOT FOUND" }); continue; }

  const doc = await pack.getDocument(entry._id);
  const before = doc.system?.description?.value ?? "";

  // (a) Lens Charge[s] → Clarity. Plural first so "Charges" doesn't leave "s".
  let after = before
    .replace(/Lens Charges/g, "Clarity")
    .replace(/Lens Charge/g, "Clarity");

  // (b) Strip any existing aggregate per-use block keyed for this subclass and
  // replace with a fresh one. The aggregate block sits at the end of the
  // description in the live pack; matching by data attribute is unambiguous.
  const stripRe = new RegExp(`<div\\s+data-ft-per-use="1"[^>]*data-ft-per-use-key="${spec.aggregateKey}"[\\s\\S]*?<\\/div>\\s*<\\/div>`, "g");
  // The aggregate block has 2 nested <div>s before mini-cards begin; mini-cards
  // are themselves <div>...</div>. Walk manually instead of regex to be safe.
  const aggOpenRe = new RegExp(`<div\\s+data-ft-per-use="1"[^>]*data-ft-per-use-key="${spec.aggregateKey}"`);
  const m = after.match(aggOpenRe);
  if (m && typeof m.index === "number") {
    let depth = 0, i = m.index;
    while (i < after.length) {
      if (after.startsWith("<div", i)) { depth++; i += 4; continue; }
      if (after.startsWith("</div>", i)) { depth--; i += 6; if (depth === 0) break; continue; }
      i++;
    }
    after = after.slice(0, m.index).replace(/\s+$/, "") + "\n" + _calloutHtml(spec);
  } else {
    after = after.replace(/\s+$/, "") + "\n" + _calloutHtml(spec);
  }

  if (after === before) {
    report.push({ name, status: "NO CHANGE" });
    continue;
  }

  await doc.update({ "system.description.value": after });
  const plural = (before.match(/Lens Charges/g) || []).length;
  const single = (before.match(/Lens Charge(?!s)/g) || []).length;
  report.push({ name, status: `REWROTE (Lens→Clarity ${plural}+${single}; callout refreshed)` });
}

console.table(report);
const summary = report.map(r => `${r.name}: ${r.status}`).join("\n");
ui.notifications.info(`Wyrdlens subclass rewrite complete. See console for details.`);
ChatMessage.create({
  user: game.user.id,
  whisper: [game.user.id],
  content: `<h3>Wyrdlens subclass rewrite</h3><pre style="white-space:pre-wrap;font-size:0.85em">${summary}</pre><p style="font-size:0.78rem;opacity:0.8;margin-top:0.4rem">Snapshots: <code>bbttcc-master-content/tools/snapshots/wyrdlens-refraction-*.snapshot.json</code></p>`
});
