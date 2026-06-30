/* Bad Eden — Raid Test Scenario setup (3 raid types)
 * ===================================================================
 * One-shot, idempotent, in-world Script Macro. Paste into a Script
 * Macro on the instance you want to test, and execute.
 *
 * SCENARIO ROLES (2026-06-21):
 *   TARGET / DEFENDER ........ Evil Bad Faction
 *   PC ATTACKERS:
 *     ⚔ Violence Raid ........ Circuitous Roots    (+ vilanis oscaris support)
 *     🥷 Intrigue Raid ....... Shadow Rats (Mūs Umbral)   → Alarm engine
 *     ♕ Presence Raid ........ The Yips                   → Influence/Courtly engine
 *
 * WHY THIS GRANTS MANEUVERS (corrected 2026-06-21):
 * The Raid Console's player-side maneuver gate (_canFactionUseManeuver,
 * module.raid-console.js:7322) applies, in order:
 *   0. TIER SCALE  — T1 man→faction T1, T2→T2, T3/T4→T3 (hard ceiling; crew
 *                    grants arm access, NOT scale).  ← all 5 factions are T1.
 *   1. CREW/OCCULT/CLASS grant (bypasses 2–4 but not tier)
 *   2. DOCTRINE OWNERSHIP — if the faction owns ANY maneuver items, only owned
 *                    keys pass (fail-open only at zero items). ← each faction
 *                    owns 7, so that's their entire player-side menu.
 *   3. LEARNED-UNLOCK — availability:"learned" (auto on all T2+, plus T1
 *                    suppressive_fire/patch_the_breach/flash_interdict/
 *                    last_stand_banner) also needs
 *                    flags.bbttcc-factions.unlocks.maneuvers[key].unlocked===true
 *   4. OP affordability + roster-option gates
 *
 * A Campaign-Engine BEAT grants by doing BOTH doctrine.grant() (creates the
 * item) AND writing the unlocks flag (world-mutation-engine.js:709 +
 * campaign-beat-editor.js:4242). This macro replicates exactly that, and bumps
 * the factions to Tier 3 so the full T1–T3 spread clears the tier gate.
 * (GM view bypasses ALL gates — so to test gating you must drive the console
 *  as a player, not the GM.)
 * ===================================================================*/
(async () => {
  const TAG = "[raid-test-setup]";
  const MOD_R = "bbttcc-raid";
  const MOD_F = "bbttcc-factions";
  const PACK_ID = "bbttcc-master-content.courtly-secrets";
  const STAMP = Date.now();

  // ── Flags ──────────────────────────────────────────────────────────
  const BUMP_TIER        = true;
  const TIER_TARGET      = 3;     // T3 clears the tier gate for all T1–T4 maneuvers
  const BUMP_DEFENDER    = true;  // also raise Evil Bad so it can field its T3 defensive kit
  const SET_OWNERSHIP    = true;  // assign each player Owner on their faction (table seating)
  const GRANT_MANEUVERS  = true;  // doctrine.grant items + set unlocks flags (the Beat replica)
  const FUND_OPS         = true;  // raise-to-floor OP so granted maneuvers are affordable at T3
  const SEED_SECRETS     = true;
  const GRANT_SECRETS    = true;
  const RESET_HANDS      = true;  // clear existing secrets on the 2 Presence factions first
  const TEST_CAP         = false; // over-grant Evil Bad to 6 to prove the 5-secret cap eviction
  const MAKE_JOURNAL     = true;

  const log = [];
  const note = (m) => { log.push(m); console.log(TAG, m); };

  // ── Resolve the five faction actors (resilient to import id/name drift) ──
  const resolve = (frags) => {
    for (const f of frags) { const a = game.actors.getName(f); if (a) return a; }
    const needle = frags[0].toLowerCase();
    return game.actors.find(a => (a.name || "").toLowerCase().includes(needle)) || null;
  };
  const F = {
    evilBad: resolve(["Evil Bad Faction"]),
    roots:   resolve(["Circuitous Roots"]),
    rats:    resolve(["Shadow Rats, (The Mūs Umbral)", "Shadow Rats", "Mūs Umbral", "Mus Umbral"]),
    vilanis: resolve(["vilanis oscaris", "Vilanis"]),
    yips:    resolve(["The Yips"]),
  };
  const missing = Object.entries(F).filter(([, a]) => !a).map(([k]) => k);
  if (missing.length) {
    ui.notifications?.error?.(`${TAG} Missing actors: ${missing.join(", ")}. Import them first.`);
    return console.warn(TAG, "missing", missing, "found", Object.fromEntries(Object.entries(F).map(([k, a]) => [k, a?.name || null])));
  }
  note(`Resolved: ${Object.values(F).map(a => a.name).join(" | ")}`);

  // ── Per-faction plan: role, granted maneuver keys, OP floors ───────
  // Keys are validated against the live EFFECTS registry before granting, so a
  // generous list is safe — anything not present (typo / not loaded) is skipped
  // and reported rather than creating a phantom doctrine item.
  const PLAN = {
    evilBad: {
      actor: F.evilBad, role: "DEFENDER · target (all 3 raids)", bumpTier: BUMP_DEFENDER,
      mans: ["patch_the_breach", "defensive_entrenchment", "last_stand_banner", "quantum_shield",
             "defender_s_reversal", "smoke_and_mirrors", "courtly_stage_distraction",
             "courtly_quote_old_law", "suppressive_fire", "rally_the_line"],
      ops: { violence: 90, nonlethal: 90, intrigue: 90, economy: 90, softpower: 90, diplomacy: 90, faith: 90, logistics: 60 },
    },
    roots: {
      actor: F.roots, role: "⚔ Violence attacker", bumpTier: true,
      mans: ["flank_attack", "suppressive_fire", "rally_the_line", "supply_overrun", "command_overdrive",
             "logistical_surge", "tactical_overwatch", "echo_strike_protocol", "siege_breaker_volley", "bless_the_fallen"],
      ops: { violence: 90, logistics: 60, softpower: 50, economy: 40 },
    },
    vilanis: {
      actor: F.vilanis, role: "⚔ Violence support", bumpTier: true,
      mans: ["flank_attack", "suppressive_fire", "supply_overrun", "command_overdrive", "tactical_overwatch"],
      ops: { violence: 90, economy: 70, softpower: 30 },
    },
    rats: {
      actor: F.rats, role: "🥷 Intrigue attacker (Alarm engine)", bumpTier: true,
      mans: ["smoke_and_mirrors", "flash_bargain", "flash_interdict", "psychic_disruption", "saboteur_s_edge",
             "signal_hijack", "chrono_loop_command", "hide_in_shadow", "take_cover", "distract",
             "disable_alarm", "pick_lock", "bypass_obstacle", "subdue_nonlethal", "conceal_body", "tailgate", "impersonate"],
      ops: { intrigue: 90, diplomacy: 60, softpower: 40, violence: 30 },
    },
    yips: {
      actor: F.yips, role: "♕ Presence attacker (Courtly engine)", bumpTier: true,
      mans: ["courtly_whispered_aside", "courtly_public_toast", "courtly_sidle_closer", "courtly_read_the_room",
             "courtly_eavesdrop", "courtly_plant_a_doubt", "courtly_quote_old_law", "courtly_stage_distraction",
             "courtly_forged_letter", "courtly_the_last_word", "courtly_call_question", "courtly_patrons_word", "opt_infernal_bargain"],
      ops: { softpower: 90, diplomacy: 90, intrigue: 90, faith: 30 },
    },
  };

  const EFFECTS = game.bbttcc?.api?.raid?.EFFECTS || {};
  const doctrine = game.bbttcc?.api?.factions?.doctrine;
  if (GRANT_MANEUVERS && !doctrine?.grant) note("⚠ factions.doctrine API missing — maneuver grants will be skipped.");
  if (GRANT_MANEUVERS && !Object.keys(EFFECTS).length) note("⚠ raid.EFFECTS empty — registry not loaded yet? Grants may all skip.");

  // ── Per-faction: grant maneuvers (item + unlock flag), tier, OP ────
  for (const [tagKey, p] of Object.entries(PLAN)) {
    const a = p.actor;
    const granted = [], skipped = [], already = [];
    const unlockAdds = {};

    if (GRANT_MANEUVERS && doctrine?.grant) {
      for (const key of p.mans) {
        const spec = EFFECTS[key];
        if (!spec || spec.kind !== "maneuver") { skipped.push(key); continue; }
        let res;
        try { res = await doctrine.grant(a, { kind: "maneuver", key, silent: true }); }
        catch (e) { skipped.push(`${key}(err)`); console.warn(TAG, "grant failed", key, e); continue; }
        if (res?.already) already.push(key); else granted.push(key);
        // Learned-unlock flag (mirror a Beat): set under the key AND its unlockKey if different.
        unlockAdds[key] = { unlocked: true, via: ["raid-test"], ts: STAMP };
        const uk = String(spec.unlockKey || spec.meta?.unlockKey || "").toLowerCase();
        if (uk && uk !== key) unlockAdds[uk] = { unlocked: true, via: ["raid-test"], ts: STAMP };
      }
    }

    // Build a single actor.update for tier + OP + unlocks.
    const update = {};

    if (BUMP_TIER && p.bumpTier) {
      update[`flags.${MOD_F}.tier`] = TIER_TARGET;          // ← the gate (_factionTierForActor)
      update[`flags.${MOD_F}.factionLevel`] = TIER_TARGET;  // sheet consistency
      update["system.tier"] = TIER_TARGET;
      update["system.details.tier"] = TIER_TARGET;
    }

    if (FUND_OPS && p.ops) {
      const ff = a.flags?.[MOD_F] || {};
      const bank = foundry.utils.deepClone(ff.opBank || {});
      const caps = foundry.utils.deepClone(ff.opCaps || {});
      const ch = [];
      for (const [pool, floor] of Object.entries(p.ops)) {
        if (Number(bank[pool] || 0) < floor) { ch.push(`${pool} ${Number(bank[pool] || 0)}→${floor}`); bank[pool] = floor; }
        if (Number(caps[pool] || 0) < floor) caps[pool] = floor;
      }
      if (ch.length) { update[`flags.${MOD_F}.opBank`] = bank; update[`flags.${MOD_F}.opCaps`] = caps; p._opChanges = ch; }
    }

    if (Object.keys(unlockAdds).length) {
      const cur = foundry.utils.deepClone(a.flags?.[MOD_F]?.unlocks || {});
      cur.maneuvers = (cur.maneuvers && typeof cur.maneuvers === "object") ? cur.maneuvers : {};
      for (const [k, v] of Object.entries(unlockAdds)) cur.maneuvers[k] = v;
      update[`flags.${MOD_F}.unlocks`] = cur;
    }

    if (Object.keys(update).length) await a.update(update);

    note(`${a.name} [${p.role}]`);
    if (BUMP_TIER && p.bumpTier) note(`    tier → ${TIER_TARGET}`);
    if (GRANT_MANEUVERS) note(`    maneuvers: +${granted.length} granted, ${already.length} already, ${skipped.length} skipped${skipped.length ? " (" + skipped.join(",") + ")" : ""}`);
    if (p._opChanges) note(`    OP: ${p._opChanges.join(", ")}`);
  }

  // ── Player → faction ownership (table seating) ─────────────────────
  // The console keys off actor.isOwner — without this a player can't drive
  // their faction. Evil Bad Faction stays GM-owned (it's the target). Each
  // assigned player is set to OWNER; `default` stays 0 so factions don't leak.
  if (SET_OWNERSHIP) {
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER; // 3
    const OWNERS = [
      { player: "Amy",               faction: F.yips },
      { player: "Katie",             faction: F.rats },
      { player: "Sylvio",            faction: F.vilanis },
      { player: "Aster", faction: F.roots },
    ];
    for (const { player, faction } of OWNERS) {
      let u = game.users.getName(player);
      if (!u) { const needle = player.toLowerCase(); u = game.users.find(x => (x.name || "").toLowerCase().includes(needle)); }
      if (!u) { note(`⚠ ownership: user "${player}" not found — ${faction.name} left as-is.`); continue; }
      const own = foundry.utils.deepClone(faction.ownership || {});
      if (own[u.id] === OWNER) { note(`Ownership ${faction.name} → ${u.name}: already Owner.`); continue; }
      own[u.id] = OWNER;
      await faction.update({ ownership: own });
      note(`Ownership ${faction.name} → ${u.name}: Owner.`);
    }
  }

  // ── Courtly-Secret templates (all 11 effectKeys) ───────────────────
  const SECRET_DEFS = [
    { effectKey: "rollPlus2",     name: "Cabinet Whisper",     img: "icons/skills/social/diplomacy-handshake.webp",          desc: "Choice intel from a sympathetic minister. <em>Play:</em> queue +2 to your next courtly exchange roll." },
    { effectKey: "influenceDmg2", name: "Compromising Letter", img: "icons/sundries/scrolls/scroll-bound-blue.webp",          desc: "A private correspondence, leaked. <em>Play:</em> deal 2 Influence damage outside an exchange." },
    { effectKey: "clearScandal",  name: "Royal Pardon",        img: "icons/skills/trades/academics-merchant-scribe.webp",     desc: "A signed favor from a higher patron. <em>Play:</em> clear your own Scandal flag." },
    { effectKey: "forceReroll",   name: "Marked Card",         img: "icons/sundries/gaming/playing-cards-brown.webp",         desc: "You stacked the deck. <em>Play:</em> force your opponent to reroll their next exchange." },
    { effectKey: "favorPlus1",    name: "Quiet Endorsement",   img: "icons/sundries/documents/document-sealed-brown-red.webp",desc: "A nod from the right box. <em>Play:</em> +1 Favor with a chosen courtier toward your side." },
    { effectKey: "favorShift",    name: "Wedge of Doubt",      img: "icons/skills/social/intimidation-impressing.webp",       desc: "Sow distrust in the gallery. <em>Play:</em> −1 Favor with two courtiers toward your opponent." },
    { effectKey: "rollPlus3",     name: "Crown Confidant",     img: "icons/equipment/head/crown-gold-laurel.webp",            desc: "The sovereign's own ear. <em>Play:</em> queue +3 to your next courtly exchange roll." },
    { effectKey: "influenceDmg3", name: "Sealed Indictment",   img: "icons/sundries/documents/document-official-capital.webp",desc: "Charges nobody can quash. <em>Play:</em> deal 3 Influence damage outside an exchange." },
    { effectKey: "coverTracks",   name: "Burned Ledger",       img: "icons/sundries/books/book-burning-orange.webp",          desc: "The evidence is ash. <em>Play:</em> −2 Suspicion." },
    { effectKey: "favorPlus2",    name: "Blood Oath",          img: "icons/skills/wounds/blood-drip-droplet-red.webp",        desc: "A binding promise in red. <em>Play:</em> +2 Favor with a chosen courtier toward your side." },
    { effectKey: "doubleAgent",   name: "Turned Courtier",     img: "icons/skills/social/theft-pickpocket-bribery-brown.webp",desc: "Their friend is your friend now. <em>Play:</em> flip a courtier — −1 to the opponent, +1 to you." },
  ];
  const secretItemData = (d) => ({
    name: d.name, type: "feat", img: d.img,
    system: { description: { value: `<p><strong>${d.name}.</strong> ${d.desc}</p>`, chat: "", unidentified: "" } },
    flags: { [MOD_R]: { secret: { effectKey: d.effectKey, acquisition: "template", acquiredAt: 0, raidId: "" } } },
  });

  async function ensureTemplates() {
    const byKey = new Map();
    const pack = game.packs.get(PACK_ID);
    let usePack = false;
    if (pack) {
      if (pack.locked) { try { await pack.configure({ locked: false }); usePack = !pack.locked; } catch (_e) { usePack = false; } }
      else usePack = true;
    }
    if (usePack) {
      const have = new Set((await pack.getDocuments()).map(d => d.name));
      const toCreate = SECRET_DEFS.filter(d => !have.has(d.name)).map(secretItemData);
      if (toCreate.length) await Item.createDocuments(toCreate, { pack: PACK_ID });
      for (const d of await pack.getDocuments()) { const ek = d.flags?.[MOD_R]?.secret?.effectKey; if (ek) byKey.set(ek, d); }
      note(`Secret templates in PACK: ${byKey.size}/11 (created ${toCreate.length}).`);
      return byKey;
    }
    const FOLDER = "Courtly Secret Templates";
    const folder = game.folders.find(f => f.type === "Item" && f.name === FOLDER) || await Folder.create({ name: FOLDER, type: "Item" });
    const have = new Map(game.items.filter(i => i.folder?.id === folder.id && i.flags?.[MOD_R]?.secret).map(i => [i.flags[MOD_R].secret.effectKey, i]));
    const toCreate = SECRET_DEFS.filter(d => !have.has(d.effectKey)).map(d => Object.assign(secretItemData(d), { folder: folder.id }));
    if (toCreate.length) for (const it of await Item.createDocuments(toCreate)) have.set(it.flags[MOD_R].secret.effectKey, it);
    for (const [k, v] of have) byKey.set(k, v);
    note(`PACK not writable → templates as WORLD items in "${FOLDER}": ${byKey.size}/11 (created ${toCreate.length}).`);
    return byKey;
  }

  let templates = new Map();
  if (SEED_SECRETS) templates = await ensureTemplates();

  // ── Grant curated secret hands (Presence combatants) ───────────────
  const HANDS = {
    [F.evilBad.id]: [ // DEFENDER: clear heat, deny, buy favor
      { effectKey: "clearScandal", acquisition: "earned" },
      { effectKey: "coverTracks",  acquisition: "earned" },
      { effectKey: "forceReroll",  acquisition: "earned" },
      { effectKey: "favorPlus2",   acquisition: "stolen" }, // stolen → +2 Suspicion on play
    ],
    [F.yips.id]: [    // PRESENCE ATTACKER: push, damage, flip
      { effectKey: "rollPlus2",    acquisition: "earned" },
      { effectKey: "influenceDmg3",acquisition: "earned" },
      { effectKey: "doubleAgent",  acquisition: "stolen" },
      { effectKey: "favorShift",   acquisition: "earned" },
    ],
  };
  if (TEST_CAP) HANDS[F.evilBad.id].push({ effectKey: "rollPlus3", acquisition: "earned" }, { effectKey: "influenceDmg2", acquisition: "earned" });

  if (GRANT_SECRETS) {
    const api = game.bbttcc?.api?.raid?.courtlySecrets;
    if (!api?.addSecret) note("⚠ courtlySecrets API not ready — skipping secret grants.");
    else if (!templates.size) note("⚠ No secret templates — run with SEED_SECRETS=true.");
    else for (const [actorId, hand] of Object.entries(HANDS)) {
      const actor = game.actors.get(actorId);
      if (RESET_HANDS) {
        const old = api.getSecrets(actorId) || [];
        if (old.length) { await actor.deleteEmbeddedDocuments("Item", old.map(i => i.id)); note(`Cleared ${old.length} secret(s) on ${actor.name}.`); }
      }
      let g = 0;
      for (const want of hand) {                 // sequential → monotonic acquiredAt for cap eviction
        const src = templates.get(want.effectKey);
        if (!src) { note(`  ✗ no template for ${want.effectKey}`); continue; }
        if (await api.addSecret(actorId, src.uuid, { acquisition: want.acquisition })) g++;
      }
      note(`Secrets → ${actor.name}: granted ${g}, holds ${(api.getSecrets(actorId) || []).length} (cap 5).`);
    }
  }

  // ── Fire-checklist journal ─────────────────────────────────────────
  if (MAKE_JOURNAL) {
    const row = (man, who, cost, mode, fx) => `<tr><td><code>${man}</code></td><td>${who}</td><td>${cost}</td><td>${mode}</td><td>${fx}</td></tr>`;
    const tbl = (rows) => `<table style="width:100%;font-size:.85rem;"><thead><tr><th>Maneuver</th><th>Who</th><th>OP cost</th><th>Fire</th><th>Effect</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
    const page = (name, html) => ({ name, type: "text", title: { show: true, level: 1 }, text: { format: 1, content: html } });
    const banner = `<p style="opacity:.8;"><em>All factions bumped to Tier ${TIER_TARGET}; granted maneuvers added as doctrine items + unlock flags (Beat replica). Drive the console as a <strong>player</strong> — GM view bypasses every gate.</em></p>`;

    const violence = banner + `<p><strong>Target:</strong> Evil Bad Faction (def) — <strong>Attacker:</strong> Circuitous Roots (+ vilanis oscaris). Battle-scene engine.</p>` + tbl([
      row("flank_attack",        "Roots / vilanis", "violence 10",               "pre-roll",    "+1 attacker roll; momentum"),
      row("suppressive_fire",    "Roots / vilanis", "violence 20",               "anytime",     "enemy reroll-lowest / dmg"),
      row("command_overdrive",   "Roots / vilanis", "violence 30",               "anytime",     "T2 push"),
      row("tactical_overwatch",  "Roots / vilanis", "violence 20 + intrigue 10", "anytime",     "T2 overwatch"),
      row("siege_breaker_volley","Roots",           "violence 40 + logistics 10","anytime",     "T3 siege break"),
      row("echo_strike_protocol","Roots",           "violence 40 + intrigue 10", "anytime",     "T3 strike"),
      row("patch_the_breach",    "Evil Bad (def)",   "nonLethal 10 + economy 10", "anytime",     "restore Structure Point"),
      row("defensive_entrenchment","Evil Bad (def)", "nonLethal 10",              "pre-roll",    "defender DC +3"),
      row("quantum_shield",      "Evil Bad (def)",   "economy 30 + faith 20",     "anytime",     "T3 defensive ward"),
      row("defender_s_reversal", "Evil Bad (def)",   "intrigue 30 + nonLethal 20","anytime",     "T3 reversal"),
    ]);

    const intrigue = banner + `<p><strong>Target:</strong> Evil Bad Faction (def) — <strong>Attacker:</strong> Shadow Rats. <strong>Alarm engine</strong> (some step-maneuvers surface via the scenario HUD, not the console list).</p>` + tbl([
      row("pick_lock",        "Shadow Rats", "intrigue 10",               "anytime", "+1 progress"),
      row("hide_in_shadow",   "Shadow Rats", "intrigue 10",               "anytime", "−1 alarm"),
      row("bypass_obstacle",  "Shadow Rats", "intrigue 20",               "anytime", "+2 progress"),
      row("distract",         "Shadow Rats", "intrigue 20",               "anytime", "−2 alarm"),
      row("subdue_nonlethal", "Shadow Rats", "intrigue 10 + violence 10", "anytime", "KO guard; alarm spikes later"),
      row("disable_alarm",    "Shadow Rats", "intrigue 30",               "anytime", "−3 alarm (T3)"),
      row("impersonate",      "Shadow Rats", "diplomacy 20 + intrigue 10", "anytime","+2 progress, −1 alarm (T3)"),
      row("smoke_and_mirrors","Evil Bad (def)","intrigue 10 + softpower 10","anytime","−1 alarm (Conditional defender — verify)"),
    ]);

    const presence = banner + `<p><strong>Target:</strong> Evil Bad Faction (def) — <strong>Attacker:</strong> The Yips. <strong>Courtly Influence engine</strong> + Secrets.</p>` + tbl([
      row("courtly_whispered_aside","The Yips",   "diplomacy 10",          "anytime", "+1 Favor your side"),
      row("courtly_read_the_room",  "The Yips",   "intrigue 10",           "anytime", "draw 1 Earned Secret"),
      row("courtly_plant_a_doubt",  "The Yips",   "intrigue 10",           "anytime", "−1 Favor opp; +1 Suspicion"),
      row("courtly_quote_old_law",  "The Yips / Evil Bad","diplomacy 20",  "anytime", "−2 Suspicion; clear Scandal"),
      row("courtly_forged_letter",  "The Yips",   "intrigue 20",           "anytime", "acquire Stolen Secret; +2 Susp (T3)"),
      row("courtly_the_last_word",  "The Yips",   "softpower 20",          "anytime", "next Expose/Intimidate: no Suspicion (T3)"),
      row("courtly_call_question",  "The Yips",   "softpower 20",          "anytime", "next exchange: 0 OP cap (T3)"),
      row("opt_infernal_bargain",   "The Yips",   "diplomacy 10 + faith 10","anytime","accept/refuse branch"),
      row("courtly_stage_distraction","Evil Bad (def)","softpower 10",      "anytime", "−1 Suspicion; opp discards Stolen"),
    ]) + `<h3>Granted Courtly Secrets</h3><ul>
      <li><strong>The Yips (atk):</strong> Cabinet Whisper (rollPlus2·earned), Sealed Indictment (influenceDmg3·earned), Turned Courtier (doubleAgent·<em>stolen</em>), Wedge of Doubt (favorShift·earned)</li>
      <li><strong>Evil Bad (def):</strong> Royal Pardon (clearScandal·earned), Burned Ledger (coverTracks·earned), Marked Card (forceReroll·earned), Blood Oath (favorPlus2·<em>stolen</em>)</li>
    </ul><p><em>Play during an active Courtly scenario:</em> <code>game.bbttcc.api.raid.courtlySecrets.playSecret(actorId, itemId)</code>. Stolen secrets add +2 Suspicion on play.</p>`;

    const jname = "⚔🥷♕ Raid Test — Fire Checklist";
    const existing = game.journal.getName(jname);
    if (existing) await existing.delete();
    await JournalEntry.create({ name: jname, pages: [page("⚔ Violence Raid", violence), page("🥷 Intrigue Raid", intrigue), page("♕ Presence Raid", presence)] });
    note(`Journal "${jname}" created (3 pages).`);
  }

  ui.notifications?.info?.(`${TAG} done — see console for the full log (${log.length} steps).`);
  console.log(TAG, "SUMMARY\n" + log.map(m => " • " + m).join("\n"));
})();
