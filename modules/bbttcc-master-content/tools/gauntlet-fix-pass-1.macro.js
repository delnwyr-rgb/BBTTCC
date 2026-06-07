// gauntlet-fix-pass-1.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds.
// ─────────────────────────────────────────────────────────────────────────────
// STEWARD GAUNTLET · fix-pass 1 — the in-world half of the first static audit
// (71 actors / 1427 items / 144 findings, 2026-06-07). The code half shipped
// in the system (generic per-use handler + 18 router entries). This macro:
//
//   1. DERIVED-STOMP AE KEYS  — rewrites AE changes targeting
//      system.derived.{guard,evasion,resolve}.value → .aeBonus (the CLOWNS!!!!!
//      trio — those buffs currently do nothing).
//   2. 5e-ABBREV SKILL AEs    — translates dnd5e skill keys (arc/his/sur/med/
//      rel/ste/itm/inv/prc) in AE changes to RFI aptitudes (occult/lore/
//      perception/empathy/faith/stealth/intimidation/investigation/perception).
//   3. RETIRED-VOCAB BANNERS  — prepends the ⚙ ENGINE NOTE to Frame/Ruin
//      (Bulwark), Pace (Shadow Courier), and Resonance Pool (Cosmic Linguist)
//      prose. SUPERSEDES bulwark-prose-surge-note-and-clamp.macro.js — skip
//      that one, this covers everything it did.
//   4. NPC FEATURE→WEAPON     — converts the curated save/damage NPC abilities
//      (Moment Shear, Wrong-Wave, Phase Drain, Ruin-Spore, Gilbert's trio,
//      Frag Grenade) that are still narrative features on LIVE actors into
//      Strike-able weapons with manifestation.area (the repo pack conversion
//      never reached the rebuilt live actors).
//   5. AOE/DAMAGE SMELLS      — gives Hollow Hunger / Frame Drift / Spark Vow
//      their damageRoll + area, and The Whole Restaurant Heard That its area
//      (TUNABLE table; DRY RUN prints current prose for verification).
//   6. HYGIENE                — deletes empty "New Effect" AEs, strips fossil
//      attribute keys (hp/movement/init), clamps skill ranks > 5.
//
// DRY_RUN=true first (prints everything incl. prose for the TUNABLE items).
// Set DRY_RUN=false to apply. F5 afterwards.
(async () => {
  const DRY_RUN = true;                              // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const strip = (h) => String(h ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const tally = { stomp: 0, skillAE: 0, banners: 0, conv: 0, smells: 0, emptyAE: 0, fossils: 0, clamps: 0 };

  // ── 2. 5e skill-abbrev → RFI aptitude key map ──
  const SKILL_XLATE = {
    arc: "occult", his: "lore", sur: "perception", med: "empathy", rel: "faith",
    ste: "stealth", itm: "intimidation", inv: "investigation", prc: "perception"
  };

  // ── 3. Retired-vocab banners ──
  const BANNER_BULWARK = `<div class="ft-engine-note" style="border:1px solid #e8c84a;border-left:4px solid #e8c84a;border-radius:6px;padding:0.45rem 0.6rem;margin:0 0 0.5rem;background:rgba(232,200,74,0.07);font-size:0.84rem"><b style="color:#b8962a">⚙ ENGINE NOTE — Frame &amp; Ruin are now ◆ Surge.</b> Read <b>Frame Die</b> as banked Surge spent defensively, <b>Ruin Charge</b> as Surge spent offensively. Bulwarks bank +1 Surge when they take Integrity damage (max +2/round; +3 w/ Polarity Mastery on Mountain). Path kits live in the ◆ Surge menu. Automated: Polarity Mastery (melee strike, base die ≥ 8 → +1 Surge 1/round), Anchor or Advance + The Breach (clickable, 1/scene).</div>`;
  const BANNER_COURIER = `<div class="ft-engine-note" style="border:1px solid #a0b8e8;border-left:4px solid #a0b8e8;border-radius:6px;padding:0.45rem 0.6rem;margin:0 0 0.5rem;background:rgba(160,184,232,0.07);font-size:0.84rem"><b style="color:#6a86c8">⚙ ENGINE NOTE — Pace is now ◆ Surge.</b> Movement banks Surge (capped per round); your courier moves are the ◆ Surge menu's courier kit (Courier's Step / Ghoststep / Flank &amp; Strike / No Such Door + your route's kit). Read <b>Pace</b> as Surge wherever it appears below.</div>`;
  const BANNER_CL = `<div class="ft-engine-note" style="border:1px solid #c8a8e8;border-left:4px solid #c8a8e8;border-radius:6px;padding:0.45rem 0.6rem;margin:0 0 0.5rem;background:rgba(200,168,232,0.07);font-size:0.84rem"><b style="color:#9a6ac8">⚙ ENGINE NOTE — the Resonance Pool is now Resonance Channel dice, spent INSIDE the Cast dialog</b> (the ✦ Resonance Channels row: +save DC / +damage die / +duration / defense impose / stabilize). Editorial Authority's Edits live in the ◆ Surge menu.</div>`;
  // id-keyed and name-keyed (NPC/armor items rarely carry identifiers)
  const BANNER_BY_ID = {
    bulwark: BANNER_BULWARK, bulwark_tier1_founding_stance: BANNER_BULWARK,
    bulwark_avalanche_l1_kinetic_inversion: BANNER_BULWARK, bulwark_avalanche_l5_shockwave_arrival: BANNER_BULWARK,
    bulwark_tier3_polarity_mastery: BANNER_BULWARK, bulwark_tier4_architect_of_certainty: BANNER_BULWARK,
    bulwark_avalanche_l17_running_theology: BANNER_BULWARK
  };
  const BANNER_BY_NAME = {
    "Bulwark Hauberk": BANNER_BULWARK, "Mountain L1: Inverted Foundation": BANNER_BULWARK,
    "Cataclyst L1: The Exchange": BANNER_BULWARK, "Adrenal Burn": BANNER_BULWARK,
    "Shadow Courier": BANNER_COURIER, "Shadow Courier — Tier 1: Liminal Operator": BANNER_COURIER,
    "Wayfarer Tongue L1: The Tongue That Does Not Lie": BANNER_COURIER,
    "Cosmic Linguist: Initiation 1 — True-Name Touch": BANNER_CL,
    "Cosmic Linguist: Resonance & Strain": BANNER_CL, "Cosmic Linguist: Resonance Channel": BANNER_CL
  };

  // ── 4. NPC feature→weapon conversion (mirror of build-npc-actions.mjs CONV,
  //       keyed by NAME — live actors were rebuilt and ids drifted) ──
  const SAVE_TO_DEFENSE = { con:"Resolve", dex:"Evasion", wis:"Resolve", str:"Guard", int:"Resolve", cha:"Resolve", body:"Resolve", presence:"Resolve", mind:"Resolve", soul:"Resolve", violence:"Guard", intrigue:"Evasion" };
  const CONV = {
    "Phase Drain":                            { shape:"single", range:30, dice:"4d8", dmgType:"qliphothic", saveAttr:"body", dc:15, intent:"intrigue", skill:"weave", attribute:"soul" },
    "Moment Shear (Recharge 5–6)":            { shape:"sphere", size:20, range:20, dice:"4d6", dmgType:"psychic",    saveAttr:"soul", dc:15, intent:"intrigue", skill:"weave", attribute:"soul" },
    "Ruin-Spore Exhalation (Recharge 5–6)":   { shape:"cone",   size:15, range:15, dice:"4d8", dmgType:"qliphothic", saveAttr:"body", dc:14, intent:"violence", skill:"warding", attribute:"body" },
    "Wrong-Wave":                             { shape:"sphere", size:10, range:10, dice:"1d6", dmgType:"qliphothic", saveAttr:"soul", dc:13, intent:"soul",     skill:"warding", attribute:"soul" },
    "Concession Catastrophe (Recharge 5-6)":  { shape:"sphere", size:20, range:60, dice:"6d8", dmgType:"energy",     saveAttr:"intrigue", dc:16, intent:"presence", skill:"performance", attribute:"presence" },
    "Not Ready For Guests!":                  { shape:"sphere", size:20, range:20, dice:"3d6", dmgType:"energy",     saveAttr:"presence", dc:16, intent:"presence", skill:"performance", attribute:"presence" },
    "Weaponized Shame":                       { shape:"single", range:60, dice:"4d8", dmgType:"psychic",    saveAttr:"soul", dc:16, intent:"presence", skill:"performance", attribute:"presence" },
    "Fragmentation Grenade (1/Day)":          { shape:"sphere", size:10, range:60, dice:"4d6", dmgType:"kinetic",    saveAttr:"dex",  dc:13, intent:"violence", skill:"firearms", attribute:"violence" }
  };
  const convSystem = (c, oldSys) => {
    const targetDefense = SAVE_TO_DEFENSE[c.saveAttr] ?? "Resolve";
    const track = (c.dmgType === "psychic" || c.dmgType === "qliphothic") ? "stress" : "integrity";
    const sq = Math.max(1, Math.round((c.range ?? c.size ?? 5) / 5));
    const single = c.shape === "single";
    return {
      category: "ranged", intent: c.intent, skill: c.skill,
      damage: { formula: c.dice, attribute: c.attribute, type: c.dmgType, damageFlavor: "", track },
      range: { short: sq, long: sq },
      tags: ["npc-action-wired-live", single ? "single" : "aoe"],
      effect: `${single ? "One target" : "Each creature in the area"} rolls vs ${targetDefense} (DC ${c.dc}).${single ? "" : " Half damage on success."}`,
      flavor: strip(oldSys?.flavor) || "",
      description: oldSys?.description ?? { value: "", chat: "" },
      manifestation: single ? undefined : { area: { shape: c.shape, size: c.size } }
    };
  };

  // ── 5. AoE/damage smell fixes — TUNABLE. DRY RUN prints current prose. ──
  const SMELL_FIXES = {
    "Hollow Hunger":                    { damageRoll: { op:"damage", number:2, die:"d6", attribute:"", type:"qliphothic", flavor:"", track:"stress" }, area: { shape:"sphere", size:10 } },
    "Frame Drift":                      { damageRoll: { op:"damage", number:1, die:"d6", attribute:"", type:"qliphothic", flavor:"", track:"stress" } },
    "Spark Vow":                        { damageRoll: { op:"damage", number:2, die:"d8", attribute:"", type:"sephirotic", flavor:"", track:"integrity" } },
    "The Whole Restaurant Heard That":  { area: { shape:"sphere", size:15 } }
  };

  for (const actor of game.actors ?? []) {
    if (!["character", "npc", "boss"].includes(actor.type)) continue;
    const itemUps = [];
    for (const it of actor.items) {
      const u = {};
      const sys = it.system ?? {};

      // 1+2. AE change-key rewrites + 6. empty "New Effect" deletion
      const aeUps = [];
      const aeDels = [];
      for (const e of (it.effects?.contents ?? [])) {
        if (e.name === "New Effect" && (!e.changes || !e.changes.length)) { aeDels.push(e.id); continue; }
        let changed = false;
        const changes = (e.changes ?? []).map(ch => {
          let k = String(ch.key ?? "");
          const m1 = k.match(/^system\.derived\.(guard|evasion|resolve)\.value$/);
          if (m1) { k = `system.derived.${m1[1]}.aeBonus`; changed = true; tally.stomp++; }
          const m2 = k.match(/^system\.skills\.([a-z]{3})\.value$/);
          if (m2 && SKILL_XLATE[m2[1]]) { k = `system.skills.${SKILL_XLATE[m2[1]]}.value`; changed = true; tally.skillAE++; }
          return { ...ch, key: k };
        });
        if (changed) aeUps.push({ _id: e.id, changes });
      }
      if (aeUps.length && !DRY_RUN) await it.updateEmbeddedDocuments("ActiveEffect", aeUps);
      if (aeUps.length) console.log(`[ae-keys] ${actor.name} · ${it.name}: ${aeUps.length} effect(s) re-keyed`);
      if (aeDels.length) { tally.emptyAE += aeDels.length; console.log(`[empty-ae] ${actor.name} · ${it.name}: deleting ${aeDels.length}`); if (!DRY_RUN) await it.deleteEmbeddedDocuments("ActiveEffect", aeDels); }

      // 3. banners (idempotent)
      const banner = BANNER_BY_ID[String(sys.identifier ?? "")] ?? BANNER_BY_NAME[it.name];
      if (banner) {
        const cur = String(sys.description?.value ?? "");
        if (!cur.includes("ft-engine-note")) { u["system.description.value"] = banner + cur; tally.banners++; }
      }

      // 4. feature→weapon conversion
      const c = CONV[it.name];
      if (c && (it.type === "feat" || it.type === "feature")) {
        const ns = convSystem(c, sys);
        u["type"] = "weapon";
        u["system"] = ns;
        tally.conv++;
        console.log(`[conv] ${actor.name} · ${it.name}: feature → weapon (${c.dice} ${c.dmgType}${c.shape !== "single" ? `, ${c.size}ft ${c.shape}` : ""})`);
      }

      // 5. smell fixes (powers/weapons — skip if conversion already handled it)
      const sf = SMELL_FIXES[it.name];
      if (sf && !c) {
        console.log(`[smell] ${actor.name} · ${it.name} — CURRENT PROSE:\n  ${strip(sys.description?.value).slice(0, 300)}`);
        if (sf.damageRoll && (sys.damageRoll?.op ?? "none") === "none") u["system.damageRoll"] = sf.damageRoll;
        if (sf.area) u["system.manifestation.area"] = sf.area;
        if (Object.keys(u).length) tally.smells++;
      }

      if (Object.keys(u).length) { u._id = it.id; itemUps.push(u); }
    }
    if (itemUps.length && !DRY_RUN) await actor.updateEmbeddedDocuments("Item", itemUps);
    if (itemUps.length) console.log(`[items] ${actor.name}: ${itemUps.length} item update(s)`);

    // 6. fossils + clamps (characters)
    const au = {};
    const src = actor._source?.system?.system ?? actor._source?.system ?? {};
    for (const k of Object.keys(src.attributes ?? {})) {
      if (!["violence","intrigue","presence","body","mind","soul"].includes(k)) {
        au[`system.attributes.-=${k}`] = null; tally.fossils++;
        console.log(`[fossil] ${actor.name}: attributes.${k} stripped`);
      }
    }
    if (actor.type === "character") {
      for (const [k, v] of Object.entries(src.skills ?? {})) {
        const cur = Number(v?.value ?? 0);
        if (Number.isFinite(cur) && cur > 5) {
          au[`system.skills.${k}.value`] = 5; tally.clamps++;
          console.log(`[clamp] ${actor.name}: ${k} ${cur} → 5`);
        }
      }
    }
    if (Object.keys(au).length && !DRY_RUN) await actor.update(au);
  }

  console.log(`=== gauntlet-fix-pass-1 ${DRY_RUN ? "(DRY RUN)" : "(APPLIED)"} ===`);
  console.log(tally);
  ui.notifications.info(`${DRY_RUN ? "[DRY RUN] " : ""}Fix-pass 1: ${tally.stomp} AE stomps re-keyed · ${tally.skillAE} skill AEs translated · ${tally.banners} banners · ${tally.conv} NPC conversions · ${tally.smells} smell fixes · ${tally.emptyAE} empty AEs · ${tally.fossils} fossils · ${tally.clamps} clamps.${DRY_RUN ? " Check console, set DRY_RUN=false." : " F5 to load."}`);
})();
