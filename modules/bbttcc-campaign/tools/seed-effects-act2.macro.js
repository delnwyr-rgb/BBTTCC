/**
 * seed-effects-act2.macro.js — GM macro/console. Dry run first, then ASKS to apply.
 *
 * EFFECTS WORKSHEET · ACT 2 (owner approved 2026-09-20, ~/EFFECTS_WORKSHEET_ACT2_2026_09_20.md). The beats now DO what they say:
 *  E1  units — KT's rows that said "OP" are ×10 marks (ruling U)
 *  E2  relationships — the Circuit Riders' alliance / flagged; the Seal's redirect steps −1 with every known faction;
 *      the Bandit accord and the grief quartet's costs wire when their faction actors exist (re-run after minting)
 *  E3  timed states — Irradiated (Khezek-Tor, 1 turn), the Cadence stain (3 turns), the soil's books (3 turns)
 *  E4  grief states — Noncanon / Cushioned / Stasis removed or kept per ending, with the morale/loyalty rows
 *  E5  prose-only endings get their rows (Lyrenn's gentle endings, Fixit trade, Pike's closure, the Confessor exposed,
 *      Tifaret lite, KT's after-beats, the Cadence's culture bump, the Forgotten Cause's carried ledger)
 *  E6  Receipts — Distilled Guilt
 *  E7  fixes — Lyrenn's settle REMOVES Fallout Bloom; the Forgotten Cause redirect's keyless row
 *  E8  creature awards — pool encounter outcomes carry `award: { method, creature, creatureId }` for the bestiary bounty
 *
 * Idempotent; backup download before write; GM only.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  async function run(apply) {
    let campsRaw = game.settings.get(NS, "campaigns");
    const campsWasStr = typeof campsRaw === "string";
    const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
    const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
    const camp = camps?.[campaignId];
    if (!camp) { ui.notifications.error(`Active campaign '${campaignId}' not found.`); return null; }
    const byId = new Map((camp.beats || []).map(b => [b.id, b]));
    const report = []; let changes = 0; const say = (s) => report.push(s);
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const get = (id) => { const b = byId.get(id); if (!b) say(`✗ MISSING beat ${id}`); return b || null; };
    const we = (b) => (b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : {});
    // the coalition: every faction on the campaign roster (faction rows are written per faction, like the existing beats)
    const coalition = [...new Set([...(Array.isArray(camp.factionIds) ? camp.factionIds : []), camp.factionId].filter(Boolean).map(x => String(x).replace(/^Actor\./, "")))];
    if (!coalition.length) say("⚠ campaign has no faction roster — faction rows will target the running faction only");
    const norm = (x) => String(x || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
    const isFaction = (a) => a && (a.type === "faction" || !!a.getFlag?.("bbttcc-factions", "isFaction") || /faction/i.test(String(a.type || "")));
    const factionByName = (re) => (game.actors?.contents || []).find(a => isFaction(a) && re.test(String(a.name || ""))) || null;   // FACTION actors only — never a creature that happens to share the word

    // ── primitives ──
    const setFaction = (id, { m = 0, l = 0, u = 0, d = 0, op = {} }) => { const b = get(id); if (!b) return; const w = we(b); const rows = coalition.length ? coalition : [""]; const want = rows.map(fid => ({ factionId: fid, moraleDelta: m, loyaltyDelta: l, unityDelta: u, darknessDelta: d, opDeltas: op, allowOvercap: false })); if (eq(w.factionEffects, want)) return say(`· ok ${id} factionEffects`); w.factionEffects = want; changes++; say(`⚙ ${id}: factionEffects m${m} l${l} u${u} d${d} ${Object.keys(op).length ? JSON.stringify(op) : ""}`); };
    const hexMods = (id, rows) => { const b = get(id); if (!b) return; const w = we(b); if (eq(w.hexModifiers, rows)) return say(`· ok ${id} hexModifiers`); w.hexModifiers = rows; changes++; say(`⚙ ${id}: hexModifiers ${JSON.stringify(rows)}`); };
    const timed = (id, rows) => { const b = get(id); if (!b) return; const w = we(b); if (eq(w.worldModifiers, rows)) return say(`· ok ${id} worldModifiers`); w.worldModifiers = rows; changes++; say(`⚙ ${id}: worldModifiers ${rows.map(r => `${r.label}${r.durationTurns ? " ×" + r.durationTurns + "t" : ""}`).join(", ")}`); };
    const relations = (id, rows) => { const b = get(id); if (!b) return; const w = we(b); if (eq(w.relationshipEffects, rows)) return say(`· ok ${id} relationshipEffects`); w.relationshipEffects = rows; changes++; say(`⚙ ${id}: relationships ${rows.map(r => `${r.targetFactionId}${r.setStatus ? "=" + r.setStatus : " step " + r.step}`).join(", ")}`); };
    const receipts = (id, rows) => { const b = get(id); if (!b) return; const w = we(b); if (eq(w.receipts, rows)) return say(`· ok ${id} receipts`); w.receipts = rows; changes++; say(`🧾 ${id}: ${rows.map(r => r.label).join(" · ")}`); };
    const award = (id, method, creatureRe, creatureKey) => { const b = get(id); if (!b) return; const actor = (game.actors?.contents || []).find(a => creatureRe.test(String(a.name || "")) && (game.bbttcc?.api?.bestiary?.isBestiary?.(a) ?? true)) || null; const want = { method, creature: actor?.name || creatureKey, creatureId: actor?.id || null }; if (eq(b.award, want)) return say(`· ok ${id} award`); b.award = want; changes++; say(`🏆 ${id}: award ${method} — ${want.creature}${actor ? "" : " (no bestiary actor found — stamp a price or mint it, then re-run)"}`); };

    // ── E1 · units (KT said OP; the banks are marks) ──
    setFaction("khezek_tor_mine_that_answered_back_seal", { m: 1, d: -1, op: { economy: -10 } });
    setFaction("khezek_tor_mine_that_answered_back_exploit", { d: 3, op: { economy: 20 } });
    setFaction("khezek_tor_darkness_shipment_standardize", { m: 2, op: { economy: -30 } });
    setFaction("khezek_tor_darkness_shipment_rite", { m: 2, l: 2, d: -1, op: { nonlethal: 20, softpower: 20, culture: 20, faith: 20 } });
    setFaction("khezek_tor_darkness_shipment_ignore", { m: -1, d: 1, op: { economy: 20 } });

    // ── E2 · relationships ──
    const riders = factionByName(/^circuit riders$/i); const drowned = factionByName(/drowned south|ralph maccio|evil bad faction/i); /* owner 2026-09-21: the Evil Bad Faction actor IS Ralph's Drowned South (reset its tier by hand) */ const tanneritos = factionByName(/tanneritos/i);
    if (riders) { relations("enc_circuit_riders_parley_alliance", [{ sourceFactionId: "@coalition", targetFactionId: riders.id, setStatus: "allied" }]); relations("enc_circuit_riders_parley_flagged", [{ sourceFactionId: "@coalition", targetFactionId: riders.id, setStatus: "unfriendly" }]); }
    else say("⚠ no 'Circuit Riders' faction actor — the alliance/flagged relationship rows wait for it (re-run after minting)");
    if (drowned) relations("bandit_summit_accord", [{ sourceFactionId: "@coalition", targetFactionId: drowned.id, setStatus: "allied" }]); else say("⚠ no Drowned South / Ralph Maccio / Evil Bad Faction actor — the Bandit Accord's ALLIED row waits for it (re-run after minting)");
    { const known = (game.actors?.contents || []).filter(a => (a.type === "faction" || a.getFlag?.("bbttcc-factions", "isFaction")) && !coalition.includes(a.id) && !/evil bad faction|prefected/i.test(String(a.name || ""))); if (known.length) relations("khezek_tor_the_vaulhaulan_seal_redirect", known.map(a => ({ sourceFactionId: "@coalition", targetFactionId: a.id, step: -1 }))); else say("⚠ no faction actors found for the Seal redirect's −1 step (offline?)"); }
    if (tanneritos) relations("chuckle_cancelled", [{ sourceFactionId: "@coalition", targetFactionId: tanneritos.id, step: -1 }]); else say("⚠ no Tanneritos faction actor — Chuckle Creek's cancellation cost waits for it");

    // ── E3 · timed states ──
    { const b = get("khezek_tor_the_vaulhaulan_seal_restore"); if (b) { setFaction("khezek_tor_the_vaulhaulan_seal_restore", { m: -1, d: -2 }); timed("khezek_tor_the_vaulhaulan_seal_restore", [{ key: "irradiated", label: "Irradiated", op: "add", enabled: true, hexName: "Khezek-Tor", durationTurns: 1, modifiers: ["Irradiated"] }]); } }
    { const b = get("cadence_win_ugly"); if (b) { const w = we(b); const adj = ["Allesh-Gilliam", "Lyrenn", "Khezek-Tor", "Furrier's Fixit-Farm"]; timed("cadence_win_ugly", adj.map(h => ({ key: "they_shot_the_dancers", label: "They Shot the Dancers", op: "add", enabled: true, hexName: h, durationTurns: 3, modifiers: ["They Shot the Dancers"] }))); setFaction("cadence_win_ugly", { m: -2, u: -2 }); } }
    timed("lyrenn_soil_keeps_books", [{ key: "soil_keeps_books", label: "The Soil Keeps Books", op: "add", enabled: true, hexName: "Lyrenn", durationTurns: 3, modifiers: ["The Soil Keeps Books"] }]);
    setFaction("lyrenn_soil_keeps_books", { l: -2 });

    // ── E4 · the grief quartet ──
    hexMods("chuckle_finale", [{ remove: ["Noncanon"], hexName: "Odaroloc River.e" }]); setFaction("chuckle_finale", { m: -2, l: 2 });
    hexMods("chuckle_new_episode", [{ remove: ["Noncanon"], add: ["Managed Fiction"], hexName: "Odaroloc River.e" }]); setFaction("chuckle_new_episode", { m: 1 });
    hexMods("chuckle_cancelled", [{ remove: ["Noncanon"], hexName: "Odaroloc River.e" }]); setFaction("chuckle_cancelled", { m: -3, l: -2 });
    hexMods("soft_landing_go_first", [{ remove: ["Cushioned"], hexName: "Saltwake Reach a" }]); setFaction("soft_landing_go_first", { m: -1, u: 2 });
    timed("soft_landing_practice", [{ key: "cushioned_decay", label: "Cushioned (decaying)", op: "add", enabled: true, hexName: "Saltwake Reach a", durationTurns: 4, modifiers: ["Cushioned (decaying)"] }]); setFaction("soft_landing_practice", { m: 1 });
    hexMods("soft_landing_harden", [{ remove: ["Cushioned"], hexName: "Saltwake Reach a" }]); setFaction("soft_landing_harden", { m: -3, l: -2 });
    hexMods("stillwater_ring_the_bell", [{ remove: ["Stasis"], hexName: "Odaroloc River.d" }]); setFaction("stillwater_ring_the_bell", { m: -1, u: 1, l: 2 });
    hexMods("stillwater_covenant", [{ add: ["Managed Yesod"], hexName: "Odaroloc River.d" }]); setFaction("stillwater_covenant", { op: { economy: 10 } });
    hexMods("stillwater_harvest", [{ remove: ["Stasis"], add: ["Harvested Yesod"], hexName: "Odaroloc River.d" }]); setFaction("stillwater_harvest", { d: 2, op: { economy: 40, faith: -10 } });
    { const known = (game.actors?.contents || []).filter(a => (a.type === "faction" || a.getFlag?.("bbttcc-factions", "isFaction")) && !coalition.includes(a.id) && !/evil bad faction|prefected/i.test(String(a.name || ""))); if (known.length) { relations("stillwater_harvest", known.map(a => ({ sourceFactionId: "@coalition", targetFactionId: a.id, step: -1 }))); relations("soft_landing_harden", known.map(a => ({ sourceFactionId: "@coalition", targetFactionId: a.id, step: -1 }))); } }

    // ── E5 · prose-only endings get their rows ──
    setFaction("allesh_gilliam_pike_closure", { m: 1, l: 1 });
    setFaction("ag_confessor_exposed", { m: -2, l: 1 });
    { const b = get("ag_confessor_redeemed"); if (b) setFaction("ag_confessor_redeemed", { d: -1 }); }
    { const b = get("ag_confessor_pike"); if (b) setFaction("ag_confessor_pike", { l: 1 }); }
    { const b = get("ag_confessor_counterfeit"); if (b) setFaction("ag_confessor_counterfeit", { u: -1 }); }
    setFaction("lyrenn_the_gentle_pest_kindness", { m: 1, l: 1 });
    setFaction("lyrenn_the_gentle_pest_teach", { m: 1, op: { culture: 10 } });
    setFaction("lyrenn_the_field_that_remembers_you_burn_the_field", { d: 1, l: -1 });
    setFaction("lyrenn_the_field_that_remembers_you_plant_speak", { m: 1, u: 1, op: { softpower: 10 } });
    setFaction("lyrenn_the_field_that_remembers_you_harvest_the_plants", { l: -1 });
    setFaction("lyrenn_forest_will_not_be_fought_negotiate", { m: 1, op: { culture: 10, faith: 10 } });
    setFaction("lyrenn_forest_will_not_be_fought_redirect", { m: 1 });
    setFaction("fixit_leyline_stabilizer_trade_success", { m: 1 });
    setFaction("fixit_leyline_stabilizer_hard_ask", { m: -1, l: -1 });
    setFaction("forest_of_tifaret_harmonious_lite", { m: 1, u: 1 });
    setFaction("khezek_sink_widens", { d: 1 });
    { setFaction("khezek_compound_cough", { m: -1 }); hexMods("khezek_compound_cough", [{ add: ["Compound Cough"], hexName: "Khezek-Tor" }]); }
    hexMods("khezek_brace_groans", [{ add: ["Brace Strain"], hexName: "Khezek-Tor" }]);
    { const b = get("cadence_win_style"); if (b) { setFaction("cadence_win_style", { op: { culture: 20 } }); } }
    setFaction("bandit_summit_humiliation", { u: -1 });

    // ── E6 · Receipts ──
    receipts("lyrenn_the_field_that_remembers_you_harvest_the_plants", [{ label: "Distilled Guilt", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the low field at Lyrenn" }, truth: "The sap tastes like memory — bitter, familiar. Bottled, it is exactly the thing to hand across a table when someone needs reminding of what they owe." }]);

    // ── E7 · fixes ──
    { const b = get("lyrenn_hex_settles"); if (b) { const w = we(b); const rows = Array.isArray(w.worldModifiers) ? w.worldModifiers : []; let touched = false; for (const r of rows) if (r && /fallout bloom/i.test(String(r.label || r.key || "")) && String(r.op || "add") !== "remove") { r.op = "remove"; touched = true; } if (touched) { changes++; say("⚙ lyrenn_hex_settles: Fallout Bloom row → op remove"); } else say("· ok lyrenn_hex_settles Fallout Bloom row"); hexMods("lyrenn_hex_settles", [{ remove: ["Fallout Bloom"], hexName: "Lyrenn" }]); } }
    { const b = get("wendigo_confluence_redirect"); if (b) { const w = we(b); const rows = Array.isArray(w.worldModifiers) ? w.worldModifiers : []; const want = [{ key: "carried_ledger", label: "The Carried Ledger", op: "add", enabled: true, hexName: "Furrier's Fixit-Farm", durationTurns: 0, modifiers: ["The Carried Ledger"] }]; if (!eq(rows, want)) { w.worldModifiers = want; changes++; say("⚙ wendigo_confluence_redirect: keyless row → The Carried Ledger"); } else say("· ok wendigo_confluence_redirect row"); setFaction("wendigo_confluence_redirect", { u: 1, d: 1 }); } }

    // ── E8 · creature awards (the bestiary bounty, by method) ──
    award("enc_geometry_serpent_outcomes_win", "kill", /geometry serpent/i, "geometry_serpent");
    award("enc_geometry_serpent_outcomes_run", "talkdown", /geometry serpent/i, "geometry_serpent");
    award("enc_geometry_serpent_parley_success", "parley", /geometry serpent/i, "geometry_serpent");
    award("enc_mutant_wildlife_t2_outcomes_win", "kill", /mutant wildlife|mutant|wildlife/i, "mutant_wildlife_t2");
    award("enc_mutant_wildlife_t2_outcomes_run", "talkdown", /mutant wildlife|mutant|wildlife/i, "mutant_wildlife_t2");
    award("enc_mutant_wildlife_t3_outcomes_win", "kill", /mutant wildlife|mutant|wildlife/i, "mutant_wildlife_t3");
    award("enc_mutant_wildlife_t3_outcomes_run", "talkdown", /mutant wildlife|mutant|wildlife/i, "mutant_wildlife_t3");
    award("enc_apex_predator_win", "kill", /apex predator|apex/i, "apex_predator");
    award("enc_apex_predator_run", "talkdown", /apex predator|apex/i, "apex_predator");
    award("enc_bandit_ambush_win_kill", "kill", /bandit/i, "bandit_ambush");
    award("enc_bandit_ambush_win_jail", "capture", /bandit/i, "bandit_ambush");
    award("enc_bandit_ambush_win_free", "talkdown", /bandit/i, "bandit_ambush");
    award("enc_bandit_ambush_bandits_run", "talkdown", /bandit/i, "bandit_ambush");
    award("bandit_arms_down_accept", "parley", /bandit/i, "bandit_ambush");
    award("forest_of_tifaret_obstructor", "cleanse", /obstructor/i, "obstructor_demon");

    // E9 ── THE AUTHORING WORLD'S PLAYER FACTIONS (2026-09-21): 34 factionEffects rows on 30 beats name three actor ids
    // from the April cross-world export (qrhl…, Gq3Y…, 6Dqh…) — no such faction exists here, so the rows never landed.
    // They meant "the players' faction": retarget to "@coalition" (the WME fans that out to the roster).
    const STALE = new Set(["qrhlINxQaEDwCcbn", "Gq3YWAEYOlrLrLQx", "6DqhVXCpDyXA7HeM"]);
    for (const b of (camp.beats || [])) { const rows = Array.isArray(b?.worldEffects?.factionEffects) ? b.worldEffects.factionEffects : []; let n = 0; for (const r of rows) if (r && STALE.has(String(r.factionId))) { r.factionId = "@coalition"; n++; } if (n) { changes += n; say(`🎯 ${b.id}: ${n} factionEffects row(s) → @coalition`); } }

    console.log(`[seed-effects-act2] ${apply ? "APPLY" : "DRY RUN"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
    if (!apply) { ui.notifications.info(`Effects seeder DRY RUN: ${changes} change(s) (console).`); return changes; }
    const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-effects-act2-${Date.now()}.json`);
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
    ui.notifications.info(`Effects seeder APPLIED: ${changes} change(s). Backup downloaded.`);
    return changes;
  }

  const n = await run(!DRY_RUN);
  if (DRY_RUN && n > 0 && typeof Dialog !== "undefined" && Dialog.confirm) {
    const yes = await Dialog.confirm({ title: "Effects seeder — Act 2", content: `<p>The dry run found <b>${n}</b> change(s) (details in the console).</p><p>Apply them now? A backup of the campaigns setting downloads first.</p>` });
    if (yes) await run(true);
  }
})();
