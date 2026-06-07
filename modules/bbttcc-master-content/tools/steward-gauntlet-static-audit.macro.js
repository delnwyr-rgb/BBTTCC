// steward-gauntlet-static-audit.macro.js — RUN IN-WORLD (GM). READ-ONLY (never writes).
// ─────────────────────────────────────────────────────────────────────────────
// STEWARD GAUNTLET · Phase 1 — the static auditor.
// SIM-BADEDEN for the character layer: scans every world actor (+ optionally
// key packs) for the bug CLASSES the Brexit audit surfaced, without firing a
// single ability. Catches:
//   A. EMPTY-MARKER AEs — transfer effects with changes:[] (the Grim
//      Persistence / Fluid Footwork disease: prose promises, engine silence).
//   B. ACTIVE-PROSE, NO AUTOMATION — feats whose text smells active ("action",
//      "reaction", "1/scene", "Recharge 5–6"...) but that route to no handler,
//      carry no grants/rerolls/passives flags, and roll no dice.
//   C. RETIRED VOCABULARY — descriptions still narrating Frame Dice / Ruin
//      Charges / Access Dice / Pace pool / Authority pool / Resonance pool
//      (all folded into Surge 2026-05-28).
//   D. DERIVED-VALUE AE STOMPS — AE changes targeting system.derived.*.value
//      (recomputed every prepare; must target .aeBonus — the Brace bug).
//   E. OVER-CAP DATA — skill ranks > 5, attributes > 10, fossil attribute
//      keys (hp/movement), AE skill keys that don't exist.
//   F. BROKEN DICE — weapon damage formulas / damageParts that don't parse.
//   G. AOE SMELLS — "each creature within…" prose with area.shape:"none"
//      (the Screams of Terror class), and damage-dice prose with op:"none".
//
// Output: grouped console report + JSON blob (copy for the fix sprint) + chat
// summary card. Tune SCAN_PACKS to also sweep compendium source items.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const SCAN_PACKS = [];   // e.g. ["bbttcc-master-content.items", "fourththing.starter-manifestations"]
  const t0 = performance.now();

  const CA = game.fourththing?._classAutomation ?? {};
  const isActionable = (it) => { try { return CA.isActionableFeature?.(it) === true; } catch (_e) { return false; } };
  const isRetired    = (it) => { try { return CA.isRetiredFoldedFeature?.(it) === true; } catch (_e) { return false; } };

  const stripHtml = (h) => String(h ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const FACULTIES = new Set(["violence", "intrigue", "presence", "body", "mind", "soul"]);
  const ACTIVE_RX  = /\b(bonus action|reaction|1\/(scene|day|round|soma)|once per (scene|day|round|turn|sanctuary|soma)|recharge \d|you may spend|as an action)\b/i;
  const RETIRED_RX = /\b(frame die|frame dice|ruin charge|access die|access dice|pace pool|authority pool|editorial authority pool|resonance pool|strain pool)\b/i;
  const DICE_RX    = /\b\d+d\d+\b/;
  const AOE_RX     = /\b(each|every|all) (creature|enem|foe|all[iy])\w*[^.]{0,40}\bwithin\b/i;

  const out = { emptyAEs: [], unautomated: [], retiredVocab: [], derivedStomp: [], overCap: [], badDice: [], aoeSmell: [], fossils: [], badSkillAE: [] };
  const where = (actorName, itemName) => `${actorName} · ${itemName}`;

  function auditItem(ownerName, it, ownerSkills) {
    const sys  = it.system ?? {};
    const desc = stripHtml(typeof sys.description === "object" ? sys.description?.value : sys.description) + " " + stripHtml(sys.effect) + " " + stripHtml(sys.body);
    const flags = it.flags?.fourththing ?? {};
    const loc = where(ownerName, it.name);

    // A. empty-marker AEs
    for (const e of (it.effects?.contents ?? it.effects ?? [])) {
      const transfer = e.transfer !== false;
      if (transfer && !e.disabled && (!e.changes || e.changes.length === 0) && !e.flags?.fourththing?.aptitudeStamp) {
        out.emptyAEs.push({ where: loc, ae: e.name });
      }
      // D. derived .value stomps + E. dead skill keys
      for (const ch of (e.changes ?? [])) {
        const k = String(ch.key ?? "");
        if (/^system\.derived\.(guard|evasion|resolve)\.value$/.test(k)) {
          out.derivedStomp.push({ where: loc, ae: e.name, key: k, fix: k.replace(".value", ".aeBonus") });
        }
        const m = k.match(/^system\.skills\.([a-zA-Z0-9_]+)\.value$/);
        if (m && ownerSkills && !(m[1] in ownerSkills)) {
          out.badSkillAE.push({ where: loc, ae: e.name, skill: m[1] });
        }
      }
    }

    // B. active prose, no automation (feats/features only)
    if ((it.type === "feat" || it.type === "feature") && ACTIVE_RX.test(desc)) {
      const hasFlagWiring = Array.isArray(flags.rerolls) || flags.grants || flags.passives || flags.actionCost;
      const hasDice = (sys.damage?.formula) || (sys.damageRoll?.op && sys.damageRoll.op !== "none" && Number(sys.damageRoll.number) > 0);
      if (!isActionable(it) && !isRetired(it) && !hasFlagWiring && !hasDice) {
        out.unautomated.push({ where: loc, id: sys.identifier ?? "—", smell: (desc.match(ACTIVE_RX) ?? [""])[0] });
      }
    }

    // C. retired vocabulary
    const rv = desc.match(RETIRED_RX);
    if (rv) out.retiredVocab.push({ where: loc, term: rv[0] });

    // F. broken dice
    const tryRoll = (f, label) => {
      const s = String(f ?? "").trim();
      if (!s) return;
      try { if (!Roll.validate(s)) out.badDice.push({ where: loc, formula: s, slot: label }); }
      catch (_e) { out.badDice.push({ where: loc, formula: s, slot: label }); }
    };
    tryRoll(sys.damage?.formula, "damage.formula");
    for (const p of (Array.isArray(sys.damageParts) ? sys.damageParts : [])) tryRoll(p?.formula, "damagePart");

    // G. AoE smells (powers + weapons with manifestation blocks)
    const mf = sys.manifestation;
    if (mf) {
      const areaNone = !mf.area?.shape || mf.area.shape === "none";
      const aoeProse = AOE_RX.test(desc) || AOE_RX.test(String(mf.targetText ?? "")) || /\b\d+\s*(ft|foot|feet)\.?\s*(cone|radius|burst|sphere|line)\b/i.test(String(mf.rangeAreaText ?? "") + " " + desc);
      if (areaNone && aoeProse) out.aoeSmell.push({ where: loc, hint: String(mf.rangeAreaText || mf.targetText || "prose").slice(0, 60) });
      const op = sys.damageRoll?.op ?? "none";
      if (op === "none" && DICE_RX.test(desc) && (it.type === "power")) {
        out.aoeSmell.push({ where: loc, hint: `dice in prose (${(desc.match(DICE_RX) ?? [""])[0]}) but damageRoll.op=none` });
      }
    }
  }

  function auditActorData(actor) {
    const src = actor._source?.system?.system ?? actor._source?.system ?? {};
    // E. over-cap + fossils
    for (const [k, v] of Object.entries(src.skills ?? {})) {
      const val = Number(v?.value ?? 0);
      if (val > 5) out.overCap.push({ where: actor.name, what: `skill ${k}`, value: val });
    }
    for (const [k, v] of Object.entries(src.attributes ?? {})) {
      if (!FACULTIES.has(k)) { out.fossils.push({ where: actor.name, key: `attributes.${k}` }); continue; }
      const val = Number(v?.value ?? 0);
      if (val > 10) out.overCap.push({ where: actor.name, what: `attribute ${k}`, value: val });
    }
    return src.skills ?? {};
  }

  let actors = 0, items = 0;
  for (const actor of game.actors ?? []) {
    if (actor.type !== "character" && actor.type !== "npc" && actor.type !== "boss") continue;
    actors++;
    const skills = auditActorData(actor);
    for (const it of actor.items) { items++; auditItem(actor.name, it, skills); }
  }
  for (const packId of SCAN_PACKS) {
    const pack = game.packs.get(packId);
    if (!pack) { console.warn(`[gauntlet] pack not found: ${packId}`); continue; }
    for (const doc of await pack.getDocuments()) {
      if (doc.documentName === "Item") { items++; auditItem(`[${packId}]`, doc, null); }
      else if (doc.documentName === "Actor") { actors++; const sk = auditActorData(doc); for (const it of doc.items) { items++; auditItem(`[${packId}] ${doc.name}`, it, sk); } }
    }
  }

  // ── Report ──
  const SECTIONS = [
    ["A · EMPTY-MARKER AEs (prose promises, engine silence)", out.emptyAEs],
    ["B · ACTIVE PROSE, NO AUTOMATION", out.unautomated],
    ["C · RETIRED VOCABULARY (Frame/Ruin/Access/Pace/Authority/Resonance)", out.retiredVocab],
    ["D · DERIVED-VALUE AE STOMPS (target .aeBonus instead)", out.derivedStomp],
    ["E · OVER-CAP DATA", out.overCap],
    ["E2 · FOSSIL ATTRIBUTE KEYS", out.fossils],
    ["E3 · AE SKILL KEYS THAT DON'T EXIST", out.badSkillAE],
    ["F · BROKEN DICE FORMULAS", out.badDice],
    ["G · AOE / DAMAGE SMELLS", out.aoeSmell]
  ];
  console.log(`\n══════ STEWARD GAUNTLET · STATIC AUDIT ══════`);
  console.log(`scanned ${actors} actors / ${items} items in ${Math.round(performance.now() - t0)}ms\n`);
  for (const [title, rows] of SECTIONS) {
    console.log(`── ${title} — ${rows.length}`);
    if (rows.length) console.table(rows);
  }
  console.log("JSON (copy for the fix sprint):");
  console.log(JSON.stringify(out));

  const counts = SECTIONS.map(([t, r]) => `<li>${t.split("·")[1].trim().split("(")[0].trim()}: <b>${r.length}</b></li>`).join("");
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#e8c84a">
      <div class="ft-roll-header"><span class="ft-roll-name">🧪 Steward Gauntlet — Static Audit</span></div>
      <p style="margin:0.2rem 0;font-size:0.78rem">${actors} actors · ${items} items scanned. Findings:</p>
      <ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.78rem">${counts}</ul>
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Full tables + JSON in the console (F12). Read-only — nothing was changed.</p>
    </div>`
  });
})();
