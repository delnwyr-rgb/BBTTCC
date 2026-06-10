// Bad Eden — Wyrdlens Adept pilot rewrite (Manifestation Discipline budget v1.0)
// ─────────────────────────────────────────────────────────────────────────────
// Re-points the Wyrdlens Adept class stub at the v1.0 Manifestation Ruleset
// knobs — specifically as the **Misfire-band specialist**. Tier text reframes
// existing Tikkun-flavored bonuses (Arcana/History prof, +2 ID rolls, lore
// auto-succeed, no-corruption gather) as discipline applied to the universal
// manifestation system, *without* raising tier cap or Clarity scope (those
// remain universal / Steward-mythic).
//
// Pilot scope: class stub only. Feature items at the laddered levels are NOT
// rewritten yet — we want one playtest cycle on the budget intent before
// committing item authoring time. T3 description is therefore a Signature Mode
// pointer rather than a fixed mechanic.
//
// Idempotent. Run as a GM script macro. Match-by-name + type:"class" so we
// don't depend on document IDs (more robust across world/pack rebuilds).
// ─────────────────────────────────────────────────────────────────────────────

const PACK = "bbttcc-master-content.classes";
const CLASS_NAME = "Wyrdlens Adept";

const WYRDLENS_HTML = `
<p><strong>Primary Attribute:</strong> Intellect</p>
<p><em>You read the cracks in the world's algorithm. Where others manifest by force of will, you manifest by aligning the angle — and where others misread the angle, you see the seam they almost found.</em></p>
<p style="opacity:0.7;font-size:0.85em">Manifestation Discipline: <strong>Misfire-band specialist</strong> (5-pt budget — Misfire ●●●, Clarity ●, Reach ●, Upkeep —, Signature Mode: Refraction)</p>

<h3>Class Identity</h3>
<p>Manifestation tier, footprint, Clarity pool, and the Reach economy are the same universal system every character uses. What you have that they do not is <em>discipline at the failure edge</em>: misfires bend less harshly around you, your lowest dice know they are being watched, and what looks like a botched manifestation to anyone else looks like a usable seam to you.</p>
<p>Stewards still out-mythic you on scope. Cosmic Linguists still out-reach you on named targets. You out-survive every misfire in the room.</p>

<h3>Class Features</h3>
<ul>
  <li><strong>Tier 1 — Lens Read.</strong> Proficiency in Arcana and History. Your manifestation misfire band is lowered by 1 (a result that would misfire instead lands as the next-lower outcome). Once per scene, an adjacent ally borrows the reduction by spending 1 of your Clarity.</li>
  <li><strong>Tier 2 — Probability Overlay.</strong> Reroll the lowest die on any manifestation roll — yours, or an adjacent ally's — once per round. (This is the Tikkun Identification bonus refracted through the universal manifestation system: same arithmetic, same once-per-round cadence, applied wherever dice are read for manifestation.)</li>
  <li><strong>Tier 3 — Refraction (Signature Mode).</strong> While Refraction is held, you declare your manifestation last in the round, after seeing what allies and enemies commit to. Pays ongoing upkeep against your Clarity. <em>(Pilot: exact upkeep curve and break-condition to be locked after one playtest cycle. Until then, GM-set per scene; treat as a stance the Adept can drop freely on their turn.)</em></li>
  <li><strong>Tier 4 — Tikkun Sight.</strong> Once per long rest (Soma Break), treat one of your misfires as if it had landed at base tier, and convert the Surge it would have spent into Clarity instead. Where others see a shattered angle, you see the angle that <em>was</em> there.</li>
</ul>

<h3>Carryover Notes</h3>
<ul>
  <li>The original "halve Intrigue OP for Identification phase" benefit is folded into <strong>Lens Read</strong> at the strategic layer: scenes that resolve through your Refraction count as one tier of Identification already paid for the directing faction's next strategic action. (GM call.)</li>
  <li>The original "no-corruption Spark gather if resolved nonviolently" rider is preserved as a Tier 4 Tikkun Sight rider — a Tikkun Sight conversion in a nonviolent scene also wipes the Corruption tick the gather would have caused.</li>
  <li>Nothing here raises your manifestation tier cap, footprint scope, or Reach band relative to other paths. Discipline, not magnitude.</li>
</ul>

<h3>Subclass Pointer</h3>
<p>Subclass features (Refraction of Foresight / Refraction of Truth / Refraction of Mercy at L3, L6, L10, L14) remain in effect as written and stack with the Discipline budget — the subclass is *what kind of seam you read*; the class budget above is *how cleanly you read it*.</p>
`.trim();

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const pack = game.packs.get(PACK);
if (!pack) { ui.notifications.error(`Pack not found: ${PACK}`); return; }
if (pack.locked) {
  try { await pack.configure({ locked: false }); }
  catch (e) { console.warn(`[update-wyrdlens-pilot] could not unlock ${PACK}`, e); }
}

const index = await pack.getIndex({ fields: ["name", "type"] });
const entry = index.find(e => e.name === CLASS_NAME && e.type === "class");
if (!entry) {
  ui.notifications.error(`Could not find class "${CLASS_NAME}" in ${PACK}.`);
  return;
}

const item = await pack.getDocument(entry._id);
if (!item) { ui.notifications.error(`Document ${entry._id} not retrievable.`); return; }

await item.update({ "system.description.value": WYRDLENS_HTML });

ChatMessage.create({
  speaker: { alias: "Bad Eden Wyrdlens Pilot" },
  content: `<h4>Wyrdlens Adept — Manifestation Discipline rewrite</h4>
            <p>Class stub updated to <strong>Misfire-band specialist</strong> (5-pt budget).</p>
            <p>Document: <code>${item.name}</code> (<code>${entry._id}</code>)</p>
            <p>Feature items at laddered levels are <em>not</em> rewritten in this pilot — playtest the stub first, then commit item-level edits.</p>`
});

return `OK Wyrdlens Adept (${entry._id}) rewritten.`;
