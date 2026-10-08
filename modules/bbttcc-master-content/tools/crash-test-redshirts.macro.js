/* crash-test-redshirts.macro.js — CRASH TEST REDSHIRTS (2026-10-07): a disposable, re-runnable test crew for live engine checks.
 * GM macro on EMBER (Mags runs it from her GM tab). RESET = true deletes the previous crew + range first, so every run starts clean.
 * Stewards are CLONES of real world characters (donors stay untouched) with the engine-path items added from the compendia and
 * ownership handed to the "Mags" player seat; foes are IMPORTED from bbttcc-master-content.npcs and their embedded abilities are
 * re-synced from bbttcc-master-content.npc-abilities (the pack actors' embedded copies predate pass 7). Everyone lands on the
 * "Crash Test Range" scene: stewards on the top row, foes on the bottom row, 1 square apart. All tokens are LINKED so a probe on
 * the base actor reads what happened to the placed token.
 * What each redshirt is FOR is in its About panel (biography.concept) so the crew explains itself on the sheet.
 */
const RESET = true;
const FOLDER = "Crash Test Redshirts", SCENE = "Crash Test Range";
const MAGS = "rzJQNVz5H3SHfP2i";   // user "Mags" (Trusted Player)
const P = { anc: "bbttcc-master-content.ancestries", cls: "bbttcc-master-content.classes", items: "bbttcc-master-content.items", npcab: "bbttcc-master-content.npc-abilities",
            call: "bbttcc-character-options.npc-callings", sig: "fourththing.starter-manifestations", npcs: "bbttcc-master-content.npcs" };
const RECORD_SIGILS = ["Canonize the Outcome", "Contain the Breach", "Edit the Record", "Erase Concept", "File the Incident", "Invoke Civic Authority", "Precedent Lock", "Reassign Authority", "Redact Entity", "Restore the Quiet", "Rewrite the Draft", "Semantic Cut", "Stabilize Narrative"];
const STEWARDS = [
  { name: "Redshirt Adaptive", donor: "Evan", concept: "Human (Cro-Magnon) Pactkeeper. Tests: Adaptive Offer on a failed check (reroll-failed-check), Tenacious at 1 Integrity, Coalition Calm aura on an adjacent ally, on-help-action (Aid), Combat Intuition reaction Strike on a miss, Last Exit vs Restrained/Prone, Buc-ee's +1 Diplomacy, the 13 Record sigils.",
    add: [[P.anc, "Human (Cro-Magnon): Ritual Memory"], [P.items, "Combat Intuition"], [P.items, "Last Exit"], [P.items, "Buc-ee's Beaver Talisman (Tarnished Gold)"], ...RECORD_SIGILS.map(n => [P.sig, n])], weapon: "Maul" },
  { name: "Redshirt Stormborn", donor: "Lady Ralph Maccio", concept: "Oldenborn (Stormborn Nomad) Keeper. Tests: Wind-Read and Ward of the Gale Offers on incoming damage (accept = half refunded), Reactor Shield Cape 3/session, Keeper Apprentice Trick (▶ Use: bank a reroll + shake fear on an ally).",
    add: [[P.anc, "Oldenborn (Stormborn Nomad): Weatherwise"], [P.anc, "Oldenborn (Stormborn Nomad): Ward of the Gale"], [P.items, "Reactor Shield Cape"], [P.call, "Keeper — Apprentice (Tier I)"]], weapon: "Maul" },
  { name: "Redshirt Igneous", donor: "Sir Smackalot", concept: "Menhirkin (Igneous) Bulwark. Tests: Magma Memory heat counter (bank on thermal damage → Offer to spend on a hit for +2d10 thermal), Heat Memory on the heritage card, Bulwark Frame Dice / Kinetic Inversion grant-resource cap.",
    swap: { drop: /^(Circuitborn|Firmware|Exo-Knight)/, add: [[P.anc, "Menhirkin"], [P.anc, "Menhirkin Heritage: Igneous"], [P.anc, "Menhirkin (Igneous): Magma Memory"]] }, add: [] },
  { name: "Redshirt Marshal", donor: "Toblerone", concept: "Oldenborn (Lumenwrought) Aurablade carrying the Harmony Marshal kit. Tests: auras on allies within 2 squares (Hold the Line forced-move shrug-off, Marchwork +2 squares walk, Centered Breath defense reroll), Wardstone +1 Guard, Lantern defense reroll, Neon Afterimage reroll in dim light, ▶ Use tricks (Signal Boost, Mask of Accord, Hex-Tuner Side A), Moonlit Ward prompt on would-gain Charmed/Shaken.",
    add: [[P.cls, "Hold the Line"], [P.cls, "Marchwork"], [P.cls, "Signal Boost"], [P.cls, "Mask of Accord"], [P.cls, "Stillheart: Centered Breath"], [P.items, "Hex-Tuner Cassette Player"], [P.items, "Wardstone of Gevurah"], [P.items, "Lantern of Unforgotten Light"], [P.items, "Neon Spirit Armor"]] },
  { name: "Redshirt Scion", donor: "Corvin Ashtabel", concept: "Sephirotic Scion (Seraphic) Stalwart. Tests: on-agreement temp Integrity (self + target) after a passed Diplomacy check, Light of Harmony aura (allies within 2 squares reroll defense), Savant Apprentice Trick (+2 banked bonus).",
    add: [[P.npcab, "Scion: Light of Harmony"], [P.call, "Savant — Apprentice (Tier I)"]], weapon: "Maul" },
  { name: "Redshirt Cryptid", donor: "Dougan Marsh", concept: "Cryptidkin (Chupacabra) Operator. Tests: Survivor's Instinct (would drop to 0 → held at 1, +1 Stress), Reverse-Anvil (▶ Use: Body save → Imposed on fail), Compliance Action (▶ Use: Impose, 1/scene).",
    add: [[P.anc, "Cryptidkin: Folklore & Frame"], [P.cls, "Reverse-Anvil"], [P.cls, "Auditor: Compliance Action"]], weapon: "Maul" },
];
const FOES = [["Ash Wolf", 2], ["Raider Marauder", 2], ["Bog-Skitter Swarm", 1], ["Slippage Wraith", 1], ["Apex Predator", 1], ["Sept Acolyte", 1], ["Hex-Touched Stray", 1], ["Pre-Fall Apex Construct", 1], ["Crystal Lurker", 1], ["Witness Initiate", 1], ["Witness-Warden Lieutenant", 1], ["Hex-Touched Champion", 1], ["Cinder-Hawk Mother", 1]];

(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const log = [], warn = [];
  const GM = game.users.activeGM?.id ?? game.user.id;
  const packDoc = async (pid, name) => { const pack = game.packs.get(pid); if (!pack) { warn.push(`no pack ${pid}`); return null; }
    const idx = (await pack.getIndex()).find(e => e.name === name); if (!idx) { warn.push(`${pid}: "${name}" not found`); return null; } return pack.getDocument(idx._id); };
  // ── reset ──────────────────────────────────────────────────────────────────────────────────────────
  let folder = game.folders.find(f => f.type === "Actor" && f.name === FOLDER);
  if (RESET) {
    const old = game.actors.filter(a => a.folder?.id === folder?.id);
    if (old.length) { await Actor.deleteDocuments(old.map(a => a.id)); log.push(`reset: deleted ${old.length} previous redshirt(s)`); }
    const oldScene = game.scenes.getName(SCENE); if (oldScene) { await oldScene.delete(); log.push("reset: deleted the previous range"); }
  }
  folder ??= await Folder.create({ name: FOLDER, type: "Actor", color: "#b02a2a" });
  const ownership = { default: 0, [GM]: 3, [MAGS]: 3 };
  // ── stewards ───────────────────────────────────────────────────────────────────────────────────────
  const stewards = [];
  for (const s of STEWARDS) {
    const donor = game.actors.getName(s.donor);
    if (!donor) { warn.push(`donor "${s.donor}" missing — ${s.name} skipped`); continue; }
    const a = await donor.clone({ name: s.name, folder: folder.id, ownership, "prototypeToken.name": s.name, "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY, "prototypeToken.actorLink": true,
      "system.biography.concept": `CRASH TEST REDSHIRT — ${s.concept}`, "system.biography.notes": `Clone of ${s.donor}. Disposable: the crash-test macro rebuilds the whole crew.` }, { save: true });
    if (s.swap) {
      const drop = a.items.filter(i => ["species", "feat"].includes(i.type) && s.swap.drop.test(i.name)).map(i => i.id);
      if (drop.length) await a.deleteEmbeddedDocuments("Item", drop);
      for (const [pid, name] of s.swap.add) { const d = await packDoc(pid, name); if (d) await a.createEmbeddedDocuments("Item", [d.toObject()]); }
    }
    const adds = [];
    for (const [pid, name] of s.add) { if (a.items.getName(name)) continue; const d = await packDoc(pid, name); if (d) adds.push(d.toObject()); }
    if (adds.length) await a.createEmbeddedDocuments("Item", adds);
    if (s.weapon) {
      let w = a.items.find(i => i.type === "weapon" && i.name === s.weapon) ?? a.items.find(i => i.type === "weapon" && String(i.system?.category).toLowerCase() === "melee");
      if (!w) { const d = await packDoc(P.items, s.weapon); if (d) [w] = await a.createEmbeddedDocuments("Item", [d.toObject()]); }
      if (w && !w.getFlag("fourththing", "equipped")) await w.setFlag("fourththing", "equipped", true);
    }
    // full pools so the first hits are readable
    const sys = a.system; const up = {};
    if (sys.derived?.integrity?.max) up["system.derived.integrity.value"] = sys.derived.integrity.max;
    if (sys.derived?.stress) up["system.derived.stress.value"] = 0;
    if (Object.keys(up).length) await a.update(up);
    stewards.push(a); log.push(`steward ${a.name} ← ${s.donor} (+${adds.length} items${s.swap ? ", lineage swapped" : ""})`);
  }
  // ── foes (imported, embedded abilities re-synced from the npc-abilities pack) ──────────────────────
  const npcs = game.packs.get(P.npcs), abil = game.packs.get(P.npcab); const abilIdx = abil ? await abil.getIndex() : [];
  const foes = []; let synced = 0;
  for (const [name, n] of FOES) {
    const src = await packDoc(P.npcs, name); if (!src) continue;
    for (let k = 1; k <= n; k++) {
      const data = src.toObject(); delete data._id;
      data.name = n > 1 ? `${name} ${k}` : name; data.folder = folder.id; data.ownership = { default: 0, [GM]: 3 };
      foundry.utils.setProperty(data, "prototypeToken.disposition", CONST.TOKEN_DISPOSITIONS.HOSTILE); foundry.utils.setProperty(data, "prototypeToken.name", data.name);
      foundry.utils.setProperty(data, "prototypeToken.actorLink", true);   // linked: probes on the base actor read what the placed token did (2026-10-07 lesson)
      const a = await Actor.create(data);
      for (const it of a.items) {
        const e = abilIdx.find(x => x.name === it.name); if (!e) continue;
        const d = await abil.getDocument(e._id); const ff = d.flags?.fourththing ?? {}; const upd = {};
        for (const key of ["rerolls", "triggers", "passives", "npcAuto"]) if (ff[key] !== undefined && JSON.stringify(ff[key]) !== JSON.stringify(it.flags?.fourththing?.[key])) upd[`flags.fourththing.${key}`] = ff[key];
        if (Object.keys(upd).length) { await it.update(upd); synced++; }
      }
      foes.push(a);
    }
    log.push(`foe ${name} ×${n}`);
  }
  log.push(`re-synced ${synced} embedded abilit${synced === 1 ? "y" : "ies"} from the npc-abilities pack`);
  // ── the range ──────────────────────────────────────────────────────────────────────────────────────
  const scene = await Scene.create({ name: SCENE, width: 3000, height: 1800, grid: { type: 1, size: 100, distance: 5, units: "ft" }, backgroundColor: "#1a1f2e", padding: 0.1, tokenVision: false, fog: { exploration: false }, globalLight: true, navigation: true,
    environment: { darknessLevel: 0 }, folder: null });
  const tokens = [];
  for (const [i, a] of stewards.entries()) tokens.push((await a.getTokenDocument({ x: 300 + i * 200, y: 500 })).toObject());
  for (const [i, a] of foes.entries()) tokens.push((await a.getTokenDocument({ x: 200 + (i % 8) * 200, y: 1100 + Math.floor(i / 8) * 200 })).toObject());
  await scene.createEmbeddedDocuments("Token", tokens);
  log.push(`range "${SCENE}": ${stewards.length} stewards (top row) + ${foes.length} foes (bottom rows)`);
  const body = `<div class="fourththing-roll"><b>Crash Test Redshirts</b> rebuilt.<ul style="font-size:.78rem">${log.map(l => `<li>${l}</li>`).join("")}</ul>${warn.length ? `<p style="color:#dc8050;font-size:.78rem">⚠ ${warn.join(" · ")}</p>` : ""}</div>`;
  ChatMessage.create({ content: body, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  console.log("[crash-test-redshirts]\n" + log.join("\n") + (warn.length ? "\nWARN: " + warn.join("\n  ") : ""));
  ui.notifications.info(`Crash Test Redshirts: ${stewards.length} stewards + ${foes.length} foes on "${SCENE}"${warn.length ? ` — ${warn.length} warning(s), see console` : ""}.`);
})();
