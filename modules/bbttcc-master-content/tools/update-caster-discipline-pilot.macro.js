// BBTTCC — Caster Discipline pilot rewrite (Manifestation Ruleset v1.0)
// ─────────────────────────────────────────────────────────────────────────────
// Re-points the four caster paths at the universal Manifestation knobs as
// distinct *disciplines*, without touching tier cap, footprint scope, or the
// Steward's mythic-scope lane:
//
//   • Cosmic Linguist  (doctrine-heavy) — REACH economy specialist
//   • Wyrdlens Adept   (class-feat-heavy) — MISFIRE-band specialist
//   • Dreamwalker      (class-feat-heavy) — CLARITY pool specialist
//   • Pactkeeper       (doctrine-heavy) — UPKEEP / CONCURRENCY specialist
//
// CL and PK use the Initiation 1/6/11/16 milestone structure (consistent with
// Bulwark / Shadow Courier — depth lives in doctrines). Wyrdlens and
// Dreamwalker use Tier 1–4 (laddered class features). Tier-3 / Initiation-11
// "Signature Mode" entries are intentionally placeholders for one playtest
// cycle before locking exact upkeep / break conditions.
//
// Idempotent. Match-by-name + type:"class" (no doc-ID dependency).
// ─────────────────────────────────────────────────────────────────────────────

const PACK = "bbttcc-master-content.classes";

// ── Cosmic Linguist — Reach specialist (doctrine-heavy) ─────────────────────
const COSMIC_LINGUIST_HTML = `
<p><strong>Primary Attribute:</strong> Intellect</p>
<p><em>You speak the names a thing has when nobody is listening, and the world rearranges itself to be addressed. Manifestation is not a bigger spell when you do it — it is a more accurate sentence.</em></p>
<p style="opacity:0.7;font-size:0.85em">Manifestation Discipline: <strong>Reach-economy specialist</strong> (5-pt budget — Reach ●●●, Clarity ●, Misfire ●, Upkeep —, Signature Mode: The Sentence)</p>

<h3>Class Identity</h3>
<p>Tier, footprint, and Clarity pool stay universal. What you have is <em>line</em>: when a manifestation has been named correctly, your Surge / Blood-Debt cost to extend its Reach to that named target collapses. Steward still out-mythics you on scope. Wyrdlens still out-survives you on misfire. You out-reach every named thing.</p>

<h3>Class Features</h3>
<ul>
  <li><strong>Initiation 1 — True-Name Touch.</strong> The Resonance Pool comes online (existing class resource — see your Doctrine for generation rule). When you spend Clarity to manifest, you may <em>name</em> the target as part of the action. For the rest of the scene, extending that manifestation's Reach to the named target costs 1 less Surge (minimum 0). Skill rank +1 in two of: Arcana, History, Insight, Lore.</li>
  <li><strong>Initiation 6 — Translation.</strong> 1/scene signature move: as a reaction to an ally completing a manifestation within Reach, transcribe it into your idiom. Until the end of the next round, you carry their effect at your tier cap (clamped to Manifestation Ruleset v1.0 footprint), paying its upkeep from your Clarity. Your translation, your bill.</li>
  <li><strong>Initiation 11 — The Sentence (Signature Mode).</strong> Stance. While The Sentence is held, every manifestation you sustain treats its primary target as <em>bound by name</em> — mechanical hook for holds, binds, and compelled-truth at the GM's table. Pays ongoing upkeep against your Clarity. <em>(Pilot: lock exact upkeep curve and break condition after one playtest cycle. Until then, treat as a stance the Linguist can drop freely on their turn.)</em></li>
  <li><strong>Initiation 16 — Word That Was.</strong> 1/long rest (Soma Break), retroactively re-narrate one of your misfires as if the manifestation had succeeded at one tier lower than the one you spent for. Pay the lower tier's base upkeep. Where others spent the syllables and lost the meaning, you spent the meaning and chose the syllables.</li>
</ul>

<h3>Doctrines</h3>
<p>See your Doctrine document for L1 Resonance Pool generation rule and the rest of the doctrine ladder. Doctrines remain the depth lane — the Discipline budget above is what you bring to <em>any</em> doctrine.</p>

<h3>Carryover Notes</h3>
<ul>
  <li>Existing Resonance Pool mechanics are preserved; Reach-discount above is on top of pool spend, not a replacement.</li>
  <li>Tier cap, footprint, Clarity max are universal. Reach economy is the only knob you bend.</li>
</ul>
`.trim();

// ── Wyrdlens Adept — Misfire specialist (class-feat-heavy) ──────────────────
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

// ── Dreamwalker — Clarity specialist (class-feat-heavy) ─────────────────────
const DREAMWALKER_HTML = `
<p><strong>Primary Attribute:</strong> Soul</p>
<p><em>You walk where the world goes when it isn't looking. Manifestation, for you, is just bringing something back from a place that already had it.</em></p>
<p style="opacity:0.7;font-size:0.85em">Manifestation Discipline: <strong>Clarity-pool specialist</strong> (5-pt budget — Clarity ●●●, Upkeep ●, Reach ●, Misfire —, Signature Mode: The Walking Lane)</p>

<h3>Class Identity</h3>
<p>Tier cap and footprint stay universal. What you have is <em>reservoir</em>: more Clarity to start with, a deeper recovery curve on Soma Break, and a between-scenes lane no other path can use. Steward still out-mythics you on scope. Wyrdlens still out-survives you on misfire. You out-last every long scene.</p>

<h3>Class Features</h3>
<ul>
  <li><strong>Tier 1 — Oneiric Reservoir.</strong> Proficiency in Perception and Religion. Your Clarity maximum is +2. On Soma Break you recover Clarity equal to your tier instead of the flat default. Detect Spark resonance in adjacent hexes (carryover).</li>
  <li><strong>Tier 2 — Dream-Cache.</strong> Between scenes, you may bank one manifestation in a dream slot. The next scene, deploy it without paying Clarity — you still pay upkeep from your live pool. Carryover: the original "advantage on saves vs. illusion / fear / corruption" rider is preserved while you carry an active Dream-Cache (the cached manifestation is itself a hedge against unreality).</li>
  <li><strong>Tier 3 — The Walking Lane (Signature Mode).</strong> Stance. While the Lane is open, your sustained manifestations reach into adjacent realms (astral / dream / memory) — ignore one band of cover or distance for any one effect per round, and the GM is invited to attach a narrative hook (someone notices you went somewhere). Pays ongoing upkeep. <em>(Pilot: lock exact upkeep curve and break condition after one playtest cycle.)</em></li>
  <li><strong>Tier 4 — Shared Dream.</strong> Allies who Soma Break in your presence regain Clarity equal to half your tier (round up). Carryover: the original "+2 saves on Spark quests for you and allies" rider is preserved as a side effect of the Shared Dream — a party that breaks together reads the world more clearly together.</li>
</ul>

<h3>Carryover Notes</h3>
<ul>
  <li>The "commune with the Great Work for insight (GM hint)" rider is preserved as a Tier 3 Walking Lane side effect — opening the Lane in a contemplative scene gives the GM a free hint to spend.</li>
  <li>Nothing here raises tier cap or footprint. Reservoir, not magnitude.</li>
</ul>
`.trim();

// ── Pactkeeper — Upkeep / Concurrency specialist (doctrine-heavy) ───────────
const PACTKEEPER_HTML = `
<p><strong>Primary Attribute:</strong> Presence</p>
<p><em>Every manifestation is an agreement with something. Most casters don't read what they signed. You did, you do, and you keep what you signed for.</em></p>
<p style="opacity:0.7;font-size:0.85em">Manifestation Discipline: <strong>Upkeep / concurrency specialist</strong> (5-pt budget — Upkeep ●●●, Misfire ●●, Clarity ●, Reach ●, Signature Mode: Sealed Pact)</p>

<h3>Class Identity</h3>
<p>Tier cap and footprint stay universal. What you have is <em>holding</em>: more concurrent manifestations sustained at once, lower upkeep on bargained subjects, and the right to renegotiate a misfire instead of eating it. Steward still out-mythics you on scope. Pactkeepers don't manifest bigger — they manifest more, longer, and in writing.</p>

<h3>Class Features</h3>
<ul>
  <li><strong>Initiation 1 — The Bargain.</strong> The Pact slot comes online (existing class resource — see your Doctrine for the generation / tier rule). While a creature, object, or place is bargained-with as your Pact subject, you may sustain one additional manifestation on or near them at no extra upkeep against your Clarity. Skill rank +1 in two of: Diplomacy, Insight, Intimidation, Lore.</li>
  <li><strong>Initiation 6 — Renegotiate.</strong> When one of your manifestations would misfire, you may instead accept a GM-set narrative debt (a future scene, a future cost, a future favor owed) and treat the manifestation as having succeeded at base tier. The debt is real; the GM's table runs the bill.</li>
  <li><strong>Initiation 11 — Sealed Pact (Signature Mode).</strong> Stance. While the Seal holds, your concurrent-manifestation cap is +2, and you cannot voluntarily drop a manifestation sustained on a pact-bound subject (the seal carries the upkeep, not your moment-to-moment will). Pays ongoing upkeep against your Clarity. <em>(Pilot: lock exact upkeep curve and break condition after one playtest cycle.)</em></li>
  <li><strong>Initiation 16 — Ledger Day.</strong> 1/long rest (Soma Break), transfer one of your sustained manifestations to a willing ally — they pick up upkeep from their Clarity from that point on. The pact moves with the paper, not the person who originally signed.</li>
</ul>

<h3>Doctrines</h3>
<p>See your Doctrine document for the L1 Pact slot generation rule and the rest of the doctrine ladder. Doctrines remain the depth lane — the Discipline budget above is what you bring to <em>any</em> Pact-shape.</p>

<h3>Carryover Notes</h3>
<ul>
  <li>Existing Pact / pool mechanics are preserved; concurrency-bonus above stacks with pool spend, not a replacement.</li>
  <li>Tier cap, footprint, Clarity max are universal. Holding power is the only knob you bend.</li>
</ul>
`.trim();

const PATCHES = [
  { name: "Cosmic Linguist", html: COSMIC_LINGUIST_HTML },
  { name: "Wyrdlens Adept",  html: WYRDLENS_HTML       },
  { name: "Dreamwalker",     html: DREAMWALKER_HTML    },
  { name: "Pactkeeper",      html: PACTKEEPER_HTML     }
];

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const pack = game.packs.get(PACK);
if (!pack) { ui.notifications.error(`Pack not found: ${PACK}`); return; }
if (pack.locked) {
  try { await pack.configure({ locked: false }); }
  catch (e) { console.warn(`[update-caster-discipline-pilot] could not unlock ${PACK}`, e); }
}

const index = await pack.getIndex({ fields: ["name", "type"] });
const results = [];

for (const patch of PATCHES) {
  const entry = index.find(e => e.name === patch.name && e.type === "class");
  if (!entry) { results.push(`MISS ${patch.name} (no class doc found in ${PACK})`); continue; }
  try {
    const item = await pack.getDocument(entry._id);
    if (!item) { results.push(`MISS ${patch.name} (${entry._id} not retrievable)`); continue; }
    await item.update({ "system.description.value": patch.html });
    results.push(`OK   ${item.name} (${entry._id})`);
  } catch (e) {
    results.push(`ERR  ${patch.name}: ${e.message}`);
    console.error(`[update-caster-discipline-pilot] ${patch.name}`, e);
  }
}

ChatMessage.create({
  speaker: { alias: "BBTTCC Caster Discipline Pilot" },
  content: `<h4>Caster Discipline rewrite — Manifestation Ruleset v1.0</h4>
            <pre style="font-size:0.78em;white-space:pre-wrap;">${foundry.utils.escapeHTML(results.join("\n"))}</pre>
            <p style="opacity:0.8;font-size:0.85em">No feature items, doctrines, or subclasses were modified. Class stubs only — playtest the budget intent first, commit item-level edits in the next sprint.</p>`
});

return results;
