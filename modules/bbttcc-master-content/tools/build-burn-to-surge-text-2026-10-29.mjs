#!/usr/bin/env node
// bbttcc-master-content/tools/build-burn-to-surge-text-2026-10-29.mjs
// Burn folded into Surge (owner ruling "C", 2026-10-29; defaults blessed same day).
// Rewrites the Aurablade / Soul-Smith family + Coolant Glycerol text: Burn → Surge
// heat, numeric Burn thresholds → bands (Cool / Stoked / Overheated, scaled to the
// Surge cap). Every edit is an exact old→new pair; a pair that no longer matches
// aborts the build (nothing half-written).
//
//   node modules/bbttcc-master-content/tools/build-burn-to-surge-text-2026-10-29.mjs [--write]
//
// Without --write: report only. With --write: updates packs/_source/<pack>/*.json and
// writes burn-to-surge-text-2026-10-29.json (old/new per item) for the live macro
// refresh-burn-to-surge-text-2026-10-29.macro.js.
// Threshold map: Burn 1+ → any Surge banked · Burn 2+ / 2–3 / 3+ → Stoked or hotter ·
// Burn 4+ → Overheated · Burn 1–3 → banked but not Overheated.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.join(HERE, "..", "packs", "_source");
const OUT  = path.join(HERE, "burn-to-surge-text-2026-10-29.json");
const WRITE = process.argv.includes("--write");

const ST = "<strong>Stoked</strong> or hotter";
const OH = "<strong>Overheated</strong>";

// file → { name?: new item name, activity?: new primary activity name, pairs: [[old, new], …] }
const EDITS = {
  "classes/Aurablade_Action_wgygFL4kFQvY7Y7R.json": { pairs: [
    ["<strong>Burn</strong> band.", "<strong>Surge</strong> band (Cool / Stoked / Overheated). Each action raises your Surge."],
  ]},

  "classes/Aurablade_V7fpwepCDoqUdT1O.json": { pairs: [
    [`<h2>🔥 Burn — What It Is (Plainly)</h2><p><strong>Burn</strong> represents emotional overextension:</p>`,
     `<h2>🔥 Heat — What It Is (Plainly)</h2><p>Your heat is your <strong>Surge</strong> — the same bank every steward fills by rolling 10s. How full it is represents emotional overextension:</p>`],
    [`<p>Burn is <strong>not a die pool</strong>.<br />Burn is a <strong>state track</strong> that unlocks power <strong>and</strong> risk.</p><p>You do not “spend” Burn.<br />You <strong>enter Burn states</strong>, and the game responds.</p>`,
     `<p>Every class runs hot; the Aurablade is <strong>built to live there</strong>.<br />The fuller your Surge, the more your Aura unlocks — <strong>and</strong> the closer you are to the edge.</p><p>Spending Surge cools you.<br />Holding it lets you <strong>ride the band</strong>, and the game responds.</p>`],
    [`<h2>🔥 How You Gain Burn (Concrete Triggers)</h2><p>You gain <strong>1 Burn</strong> when <strong>any one</strong> of the following occurs:</p><h3>Universal Burn Triggers</h3>`,
     `<h2>🔥 How You Heat Up (Concrete Triggers)</h2><p>Besides rolling 10s, you gain <strong>1 Surge</strong> when <strong>any one</strong> of the following occurs:</p><h3>Aurablade Heat Triggers</h3>`],
    [`<li><p>You force a defense check using an Aura feature</p></li><li><p>You escalate without pause (GM-flagged high-risk continuation)</p></li><li><p>You remain in the same Aura for too long without stabilizing</p></li></ul>`,
     `<li><p>You use an Aura action</p></li><li><p>You switch your Aura</p></li></ul>`],
    [`You bank <strong>at most 2 Burn a round from landed hits</strong>; each Aura action adds 1, and a subclass may say otherwise.</p><p>Burn rewards <strong>commitment</strong>, not spam.</p>`,
     `You bank <strong>at most 2 Surge a round from landed hits</strong>; each Aura action adds 1, and a subclass may say otherwise.</p><p>Heat rewards <strong>commitment</strong>, not spam.</p>`],
    [`<h2>🔥 Burn States (Explicit Bands)</h2><p>Burn is divided into <strong>three states</strong>.</p><h3>🔹 Burn 0–1 — <strong>Controlled</strong></h3>`,
     `<h2>🔥 Heat Bands (Explicit)</h2><p>Your Surge reads as <strong>three bands</strong>, scaled to your Surge cap (Tier 1: 4 · Tier 2: 6 · Tier 3: 8 · Tier 4: 10).</p><h3>🔹 Below half your cap — <strong>Cool</strong></h3>`],
    [`<h3>🔸 Burn 2–3 — <strong>Engaged</strong></h3>`, `<h3>🔸 Half your cap or more — <strong>Stoked</strong></h3>`],
    [`<h3>🔥 Burn 4+ — <strong>Overheated</strong></h3><p>You are exceeding safe emotional limits.</p><p>At this state:</p><ul><li><p>Aura effects <strong>intensify</strong></p></li>`,
     `<h3>🔥 Full — <strong>Overheated</strong></h3><p>You are exceeding safe emotional limits.</p><p>At this state:</p><ul><li><p>Aura effects <strong>intensify</strong></p></li><li><p>Every surge you can't hold costs you <strong>1 Stress</strong> — spend or vent</p></li>`],
    [`<li><p>Your Aura collapses (you drop to Burn 0)</p></li>`, `<li><p>Your Aura collapses (your Surge drops to 0)</p></li>`],
    [`<li><p><strong>Engaged Burn effects</strong></p></li><li><p><strong>Overheated Burn effects</strong></p></li>`,
     `<li><p><strong>Stoked effects</strong></p></li><li><p><strong>Overheated effects</strong></p></li>`],
    // the four Aura blocks share these two headings (4× each)
    [`<h3>Burn 2–3 (Engaged)</h3>`, `<h3>Stoked (or hotter)</h3>`, 4],
    [`<h3>Burn 4+ (Overheated)</h3>`, `<h3>Overheated</h3>`, 4],
    [`<li><p>Costs <strong>1 Burn</strong></p></li><li><p>Does not clear Burn; Stabilize or Meditate for that</p></li>`,
     `<li><p>Raises your Surge by <strong>1</strong></p></li><li><p>Does not cool you; spend or Vent for that</p></li>`],
    [`<li><p>“Can I afford another Burn?”</p></li>`, `<li><p>“Spend it now — or ride it hotter?”</p></li>`],
  ]},

  "classes/Aurablade__Burn_State_BhlrJv0osQl3kJId.json": { name: "Aurablade: Surge & Aura", pairs: [
    [`<p><strong>Burn</strong> is a state track, not a die pool. This is your display item for current Burn, current Aura, and current band on the Features tab.</p><p><strong>Bands:</strong> 0–1 Controlled, 2–3 Engaged, 4+ Overheated.</p>`,
     `<p>Your heat is your <strong>Surge</strong>. This opens the raw Surge &amp; Aura dialog — current Surge, current Aura and current band.</p><p><strong>Bands</strong> (scaled to your Surge cap): Cool below half · Stoked at half or more · Overheated when full.</p>`],
  ]},

  "classes/Aurablade__Core_Features_SnNMVlFK9hAUbO5U.json": { pairs: [
    [`Spending power builds <strong>Burn</strong>; at high Burn you gain potency and risk backlash.`,
     `Committing to it builds <strong>Surge</strong>; the hotter you run, the more you unlock — and the closer the backlash.`],
  ]},

  "classes/Aurablade__Stabilize_Burn_0HJDPkWxEvKLPZQG.json": { name: "Aurablade: Vent Surge", activity: "Aurablade: Vent Surge", pairs: [
    [`<p>Open the <strong>Stabilize Burn</strong> dialog and reduce, clear, or safely manage Burn according to class/subclass rules.</p>`,
     `<p><strong>Vent</strong> — let Surge go without spending it: Meditate (action, −2) or catch your breath out of the fight (clear it all). The way out of Overheated when nothing on the menu fits.</p>`],
  ]},

  "classes/Blood_Hymn__Bad_Eden__83oSoFDlBbIXnCn8.json": { pairs: [
    [`Where the base class governs Burn and Aura,`, `Where the base class governs heat and Aura,`],
    [`Your Burn feeds itself. While at Burn 2–3 (Engaged), weapon attacks deal +tier damage and grant +1 Burn (once per turn). At Burn 4+ (Overheated), the bonus scales further.`,
     `Your heat feeds itself. While Stoked, weapon attacks deal +tier damage and grant +1 Surge (once per turn). While Overheated, the bonus scales further.`],
    [`take self-damage equal to your tier to gain +1 Burn (no action)`, `take self-damage equal to your tier to gain +1 Surge (no action)`],
    [`when you hit at Burn 2+, choose another creature`, `when you hit while Stoked or hotter, choose another creature`],
    [`At Burn 4+ the secondary target takes full damage`, `While Overheated the secondary target takes full damage`],
    [`While at Burn 3+, creatures you hit`, `While Stoked or hotter, creatures you hit`],
    [`At Burn 4+ nearby allies of your target are also affected.`, `While Overheated, nearby allies of your target are also affected.`],
    [`as a bonus action: enter Burn 4 immediately.`, `as a bonus action: your Surge fills to its cap (Overheated).`],
    [`Aftermath: your Burn drops to 0 and you suffer severe backlash.`, `Aftermath: your Surge drops to 0 and you suffer severe backlash.`],
  ]},

  "classes/Blood_Hymn__Crimson_Arc_WNGcvk5N3qMbBtKG.json": { pairs: [
    [`when you hit a creature while at <strong>Burn 2+</strong>:`, `when you hit a creature while ${ST}:`],
    [`<p>At <strong>Burn 4+</strong>:</p>`, `<p>While ${OH}:</p>`],
  ]},

  "classes/Blood_Hymn__Escalation_efPyWiwjZhMPlPs2.json": { pairs: [
    [`<p>Your Burn feeds itself.</p>`, `<p>Your heat feeds itself.</p>`],
    [`<p>While you are at <strong>Burn 2–3 (Engaged)</strong>:</p>`, `<p>While you are <strong>Stoked</strong>:</p>`],
    [`<strong>adds +1 Burn</strong> (once per turn)`, `<strong>adds +1 Surge</strong> (once per turn)`],
    [`<p>While you are at <strong>Burn 4+ (Overheated)</strong>:</p>`, `<p>While you are ${OH}:</p>`],
    [`<li><p>Each missed attack at Burn 4+ allows the GM to trigger <strong>backlash</strong></p></li>`,
     `<li><p>Each missed attack while Overheated allows the GM to trigger <strong>backlash</strong></p></li>`],
  ]},

  "classes/Blood_Hymn__Final_Crescendo_HtnaUa8VLw5ggAMH.json": { pairs: [
    [`<li><p>You immediately enter <strong>Burn 4</strong></p></li>`, `<li><p>Your Surge fills to its cap — ${OH}</p></li>`],
    [`<li><p>Your Burn drops to <strong>0</strong></p></li>`, `<li><p>Your Surge drops to <strong>0</strong></p></li>`],
  ]},

  "classes/Blood_Hymn__Lifetithe_yYaCK97AAqxze241.json": { pairs: [
    [`<li><p>Add <strong>+1 Burn</strong> without using an action</p></li>`, `<li><p>Add <strong>+1 Surge</strong> without using an action</p></li>`],
  ]},

  "classes/Blood_Hymn__Terror_Charge_Rdl0kPNXBLoCAkFJ.json": { pairs: [
    [`<p>While at <strong>Burn 3+</strong>:</p>`, `<p>While ${ST}:</p>`],
    [`<p>At <strong>Burn 4+</strong>:</p>`, `<p>While ${OH}:</p>`],
  ]},

  "classes/Soul_Smith_DkuvglxCjNy2tmnL.json": { pairs: [
    [`Mechanically you ride <strong>Burn</strong> — a 0→8 heat track that climbs when you or a nearby ally takes a hit (the forge stokes itself on other people's bad days) and banks <strong>Surge</strong> right alongside it. You spend that Surge on four forge-works, and the hotter you run, the harder they land — right up until the furnace bites back.`,
     `Mechanically your forge heat <em>is</em> your <strong>Surge</strong> — it climbs when you or a nearby ally takes a hit (the forge stokes itself on other people's bad days). You spend it on four forge-works, and the hotter you were when you reached for one, the harder it lands — right up until the furnace bites back.`],
    [`<em>Stoked</em> (Burn 2–3) ×1.5; <em>Overheated</em> (Burn 4+) ×2,`, `<em>Stoked</em> (half your Surge cap or more) ×1.5; <em>Overheated</em> (full) ×2,`],
    [`allies within 6 squares heal (Burn-scaled)`, `allies within 6 squares heal (heat-scaled)`],
    [`<strong>Vent</strong> to cool Burn.`, `<strong>Vent</strong> to cool the forge (let Surge go).`],
  ]},

  "classes/Stillheart__Bad_Eden__G8w6bdMHO6lOUeiH.json": { pairs: [
    [`Burn arrives by stillness rather than damage;`, `Heat arrives by stillness rather than damage;`],
    [`<strong>Level 3 — Centered Breath.</strong> Reduce Burn gained by 1 per encounter (minimum 0). Once per round when you would gain Burn you may decline.`,
     `<strong>Level 3 — Centered Breath.</strong> Once per encounter, the overheat cannot bite you. Once per round when you would gain Surge you may let it go instead.`],
    [`While at Burn 1–3, allies within 2 squares`, `While you hold Surge but aren't Overheated, allies within 2 squares`],
    [`At Burn 3+ you may spend your reaction to cancel`, `While Stoked or hotter you may spend your reaction to cancel`],
    [`As a bonus action, freeze your current Burn level — it cannot increase or decrease until the start of your next turn. At Burn 3+ you may ignore one backlash trigger entirely.`,
     `As a bonus action, until the start of your next turn the overheat can't touch you (no Stress from a full Surge bank). While Stoked or hotter you may also ignore one backlash trigger entirely.`],
    [`Burn does not increase for you or allies;`, `Surge does not rise for you or allies;`],
    [`After it ends, you gain 1 Burn.`, `After it ends, you gain 1 Surge.`],
  ]},

  "classes/Stillheart__Centered_Breath_ZqVbVGaQyFUkAufx.json": { pairs: [
    [`<p>You regulate your Burn.</p>`, `<p>You regulate your heat.</p>`],
    [`<li><p>Reduce Burn gained by <strong>1 per encounter</strong> (minimum 0)</p></li><li><p>Once per round, when you would gain Burn:</p><ul><li><p>You may choose <strong>not to</strong></p></li></ul></li>`,
     `<li><p>Once per encounter, the overheat <strong>cannot bite you</strong> (no Stress from a full Surge bank)</p></li><li><p>Once per round, when you would gain Surge:</p><ul><li><p>You may <strong>let it go</strong> instead</p></li></ul></li>`],
  ]},

  "classes/Stillheart__Emotional_Lock_gIpTl51C1T79Odhf.json": { pairs: [
    [`<li><p>As a bonus action, you may <strong>freeze your current Burn level</strong></p><ul><li><p>It cannot increase or decrease until the start of your next turn</p></li></ul></li>`,
     `<li><p>As a bonus action, you may <strong>hold off the overheat</strong></p><ul><li><p>Until the start of your next turn, a full Surge bank costs you no Stress</p></li></ul></li>`],
    [`<p>At <strong>Burn 3+</strong>:</p>`, `<p>While ${ST}:</p>`],
  ]},

  "classes/Stillheart__Eye_of_the_Storm_zohMsk1ss09jILLk.json": { pairs: [
    [`<li><p>Burn does not increase for you or allies</p></li>`, `<li><p>Surge does not rise for you or allies</p></li>`],
    [`<li><p>You gain <strong>1 Burn</strong></p></li>`, `<li><p>You gain <strong>1 Surge</strong></p></li>`],
  ]},

  "classes/Stillheart__Quiet_Mind_ettvYjEjOvDkst0T.json": { pairs: [
    [`<p>At <strong>Burn 3+</strong>:</p>`, `<p>While ${ST}:</p>`],
  ]},

  "classes/Stillheart__Shared_Aura_rEyUo9QndXV2tmbW.json": { pairs: [
    [`<p>While at <strong>Burn 1–3</strong>:</p>`, `<p>While you hold <strong>Surge</strong> but aren't Overheated:</p>`],
    [`<p>This does <strong>not</strong> increase their Burn.</p>`, `<p>This does <strong>not</strong> raise their Surge.</p>`],
  ]},

  "classes/Void_Edge__Bad_Eden__xg0RIGmaeS99TPNx.json": { pairs: [
    [`When you hit at Burn 1+, suppress one`, `When you hit while holding any Surge, suppress one`],
    [`At Burn 3+ the target also loses one reaction.`, `While Stoked or hotter the target also loses one reaction.`],
    [`At Burn 3+, failing a Clarity hold also causes Burn-like fatigue (GM narrative).`, `While Stoked or hotter, failing a Clarity hold also causes heat-sick fatigue (GM narrative).`],
    [`When you hit at Burn 2+, the target saves`, `When you hit while Stoked or hotter, the target saves`],
    [`At Burn 4+ fear spreads automatically`, `While Overheated, fear spreads automatically`],
    [`At Burn 4+ the effect cannot be reapplied for 1 round.`, `While Overheated the effect cannot be reapplied for 1 round.`],
    [`Afterward your Burn drops to 0.`, `Afterward your Surge drops to 0.`],
  ]},

  "classes/Void_Edge__Dread_Cut_TsdmFKV16UcsQhkY.json": { pairs: [
    [`<p>When you hit at <strong>Burn 2+</strong>:</p>`, `<p>When you hit while ${ST}:</p>`],
    [`<p>At <strong>Burn 4+</strong>:</p>`, `<p>While ${OH}:</p>`],
  ]},

  "classes/Void_Edge__Emotional_Erasure_nUJlD7LiFYw6QMpI.json": { pairs: [
    [`<p>At <strong>Burn 4+</strong>:</p>`, `<p>While ${OH}:</p>`],
  ]},

  "classes/Void_Edge__Final_Quiet_XkBwgbFUFp4RgCU7.json": { pairs: [
    // the old delayed backlash (+2 Burn) would now be free fuel — it becomes a lockout instead
    [`<li><p>Your Burn drops to <strong>0</strong></p></li><li><p>You gain <strong>2 Burn at the end of the next round</strong> (delayed backlash)</p></li>`,
     `<li><p>Your Surge drops to <strong>0</strong></p></li><li><p>You <strong>can't bank Surge until the end of the next round</strong> (delayed backlash)</p></li>`],
  ]},

  "classes/Void_Edge__Null_Field_JApf1VTCVsYh01CB.json": { pairs: [
    [`<p>When you hit a creature while at <strong>Burn 1+</strong>:</p>`, `<p>When you hit a creature while holding any <strong>Surge</strong>:</p>`],
    [`<p>At <strong>Burn 3+</strong>:</p>`, `<p>While ${ST}:</p>`],
  ]},

  "classes/Void_Edge__Silence_of_Will_1AIGgkb9HQ4ZY9iY.json": { pairs: [
    [`<p>At <strong>Burn 3+</strong>:</p>`, `<p>While ${ST}:</p>`],
    [`<strong>Burn-like fatigue</strong>`, `<strong>heat-sick fatigue</strong>`],
  ]},

  "items/Coolant_Glycerol_XijBL5fp1csEiC95.json": { pairs: [
    [`<strong>On use:</strong> Lose <strong>2</strong> Burn</li>`, `<strong>On use:</strong> Lose <strong>2</strong> Surge (cools you a step)</li>`],
  ]},
};

const rows = [];
let bad = 0;
for (const [rel, spec] of Object.entries(EDITS)) {
  const file = path.join(SRC, rel);
  const doc  = JSON.parse(fs.readFileSync(file, "utf8"));
  const old  = doc.system?.description?.value ?? "";
  let next = old;
  for (const [a, b, times = 1] of spec.pairs) {
    const n = next.split(a).length - 1;
    if (n !== times) { console.error(`✗ ${rel}: expected ${times}× of ${JSON.stringify(a.slice(0, 70))}, found ${n}`); bad++; continue; }
    next = next.split(a).join(b);
  }
  const left = (next.replace(/<[^>]+>/g, " ").match(/\bburn\b[^.]{0,40}/gi) ?? []);
  rows.push({
    pack: rel.startsWith("items/") ? "bbttcc-master-content.items" : "bbttcc-master-content.classes",
    _id: doc._id, identifier: doc.system?.identifier ?? doc.flags?.bbttcc?.identifier ?? "",
    oldName: doc.name, name: spec.name ?? doc.name,
    oldActivity: spec.activity ? (doc.system?.activities?.primary?.name ?? null) : null, activity: spec.activity ?? null,
    old, new: next
  });
  console.log(`${rel}: ${spec.pairs.length} edit(s)${spec.name ? ` · renamed → ${spec.name}` : ""}${left.length ? ` · remaining "burn": ${left.map(s => JSON.stringify(s.trim())).join(", ")}` : ""}`);
  if (WRITE && !bad) {
    doc.system.description.value = next;
    if (spec.name) doc.name = spec.name;
    if (spec.activity && doc.system?.activities?.primary) doc.system.activities.primary.name = spec.activity;
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  }
}
if (bad) { console.error(`\n${bad} pair(s) did not match — nothing written.`); process.exit(1); }
if (WRITE) {
  fs.writeFileSync(OUT, JSON.stringify({
    about: "Burn folded into Surge — class/feature text (owner ruling C, defaults blessed 2026-10-29). Built by build-burn-to-surge-text-2026-10-29.mjs.",
    rows
  }, null, 2) + "\n");
  console.log(`\nwrote ${rows.length} _source files + ${path.relative(process.cwd(), OUT)}`);
} else console.log(`\n${rows.length} items OK (report only — pass --write).`);
