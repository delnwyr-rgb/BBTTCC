/* ─────────────────────────────────────────────────────────────────────────────
 * Surge Powers · surge-powers.js — the universal Surge spend menu
 * ─────────────────────────────────────────────────────────────────────────────
 * The shared table of Surge spends available to every character — the
 * standalone cut of Bad Eden's Surge Unification menu (class/doctrine kits
 * removed).
 *
 *  SPEND   hard-gated: an entry you can't afford (or aren't proficient enough
 *          for) renders disabled with the reason. Spending decrements the pool
 *          via game.surgePowers.spend.
 *  EFFECTS each entry carries a compact `fx` descriptor; one applier
 *          interprets it. Wired where dnd5e natively supports it (heals,
 *          temp HP, Active Effects, initiative); the rest arm a ONE-SHOT flag
 *          (flags.surge-powers.oneShot.<key>) + post a chat card the GM
 *          applies — flag-and-narrate.
 *  PROF    scaling effects use the character's Proficiency Bonus (+2…+6):
 *          heals add Prof, DR equals Prof, auras reach Prof×5 ft, damage
 *          riders add Prof d6. High entries gate on a minimum Prof.
 *
 *  MIDI/DAE (optional): advantage entries carry both the dnd5e flag and its
 *  midi-qol twin, and a DAE 1Attack specialDuration — real automation when
 *  those modules are present, inert-but-labeled markers when they aren't.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(() => {
  const MOD = "surge-powers";
  const TAG = "[surge-powers/menu]";
  if (game?.system?.id && game.system.id !== "dnd5e") return;

  const get = (o, p, d) => { try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; } };

  function profOf(actor) {
    return Number(get(actor, "system.attributes.prof", 2)) || 2;
  }

  // ── Shared appliers ────────────────────────────────────────────────────────
  async function cue(actor, title, lines) {
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="surge-powers-cue" style="border:1px solid #b9882e;border-radius:6px;padding:.4rem .6rem">
          <p style="margin:.1rem 0;font-weight:700">⚡ ${title}</p>
          ${(lines || []).map(l => `<p style="margin:.1rem 0;font-size:.82rem">${l}</p>`).join("")}
        </div>`
      });
    } catch (e) { /* best-effort */ }
  }
  function firstTarget() { return [...(game.user?.targets ?? [])][0]?.actor ?? null; }
  function casterToken(actor) {
    return actor.getActiveTokens?.(true)?.[0]?.object ?? actor.getActiveTokens?.()?.[0] ?? canvas?.tokens?.controlled?.[0] ?? null;
  }
  function alliesInRange(token, radiusFt) {
    const out = [];
    const grid = (token?.scene ?? canvas?.scene)?.grid;
    if (!token || !grid?.size || !grid?.distance) return out;
    const pxPerFt = grid.size / grid.distance;
    const cx = token.center?.x ?? token.x, cy = token.center?.y ?? token.y;
    for (const t of (canvas?.tokens?.placeables ?? [])) {
      if (!t?.actor || t === token) continue;
      if (Math.hypot(t.center.x - cx, t.center.y - cy) / pxPerFt > radiusFt) continue;
      if ((t.document?.disposition ?? 0) >= 0) out.push(t);
    }
    return out;
  }
  async function addAE(targetActor, ae) {
    try { await targetActor.createEmbeddedDocuments("ActiveEffect", [ae]); }
    catch (e) { console.warn(TAG, "AE apply failed", targetActor?.name, e); }
  }
  const drAE = (n, origin) => ({
    name: `DR ${n} (Surge)`, img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", origin,
    duration: { rounds: 1, seconds: 6 }, changes: [],
    flags: { [MOD]: { surgeDR: n, cue: `reduce each incoming hit by ${n} this round (GM applies; temp HP granted as the floor)` } }
  });
  async function grantTempHP(targetActor, n) {
    try {
      const cur = Number(get(targetActor, "system.attributes.hp.temp", 0)) || 0;
      if (n > cur) await targetActor.update({ "system.attributes.hp.temp": n });
    } catch (e) { /* best-effort */ }
  }
  async function healActor(targetActor, formula, flavor) {
    try {
      const r = await new Roll(String(formula)).evaluate();
      const amount = Math.max(1, Math.round(r.total));
      await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: targetActor }), flavor });
      const hp = Number(get(targetActor, "system.attributes.hp.value", 0)) || 0;
      const max = Number(get(targetActor, "system.attributes.hp.max", 0)) || 0;
      await targetActor.update({ "system.attributes.hp.value": Math.min(max, hp + amount) });
      return amount;
    } catch (e) { console.warn(TAG, "heal failed", e); return 0; }
  }
  async function oneShot(actor, key) {
    try { await actor.update({ [`flags.${MOD}.oneShot.${key}`]: true }); } catch (e) { /* best-effort */ }
  }

  // ── The table ──────────────────────────────────────────────────────────────
  // fx fields: tgt self|ally|allyOrSelf|alliesProfSq · heal · dr ("prof"
  //   scales) · acBonus · advAttack1 · oneShot(key) · note (GM line) · init
  //   (reposition) · phoenix. Gate: minProf (minimum Proficiency Bonus).
  const MENU = [
    // ── cost 1 ──
    { cost: 1, key: "bonus-die", bucket: "narr", label: "Bonus Die — your next roll rolls one extra die (keep best)",
      fiction: "Press the moment. The dice remember what they were doing.", fx: { tgt: "self", oneShot: "bonusDie", note: "Next d20 roll: roll one extra d20 and keep the best (GM applies)." } },
    { cost: 1, key: "snap-strike", bucket: "off", label: "Snap Strike — advantage on your next attack",
      fiction: "An opening narrows. You take it.", fx: { tgt: "self", advAttack1: true } },
    { cost: 1, key: "brace", bucket: "def", label: "Brace — +1 AC till your next turn",
      fiction: "Weight settles. Stance hardens.", fx: { tgt: "self", acBonus: 1 } },
    // ── cost 2 ──
    { cost: 2, key: "reaction-miss", bucket: "def", label: "Reaction Miss — turn one incoming attack into a miss",
      fiction: "You slide sideways through the moment.", fx: { tgt: "self", oneShot: "reactionMiss", note: "One incoming attack this round becomes a miss (declare before damage; GM applies)." } },
    { cost: 2, key: "sundering-blow", bucket: "off", label: "Sundering Blow — next attack ignores resistances",
      fiction: "Whatever they call armor, it stops mattering for one breath.", fx: { tgt: "self", oneShot: "ignoreResists", note: "Next hit ignores damage resistances (GM applies)." } },
    { cost: 2, key: "stitch", bucket: "heal", label: "Stitch — heal self 2d6 + Prof",
      fiction: "Flesh re-knits along the seams you remember.", fx: { tgt: "self", heal: "2d6+@prof" } },
    // ── cost 3 ──
    { cost: 3, key: "reposition-init", bucket: "narr", label: "Reposition — new spot in initiative",
      fiction: "Step out of the moment. Re-enter where you choose.", fx: { tgt: "self", init: true } },
    { cost: 3, key: "refund", bucket: "narr", label: "Refund — one expended feature use",
      fiction: "The effort didn't cost you. Something else paid.", fx: { tgt: "self", note: "Refund one expended class-feature use (GM restores the use)." } },
    { cost: 3, key: "echo-strike", bucket: "off", label: "Echo Strike — extra attack at −2",
      fiction: "A second blow that was already there.", fx: { tgt: "self", oneShot: "echoStrike", note: "Make one extra attack this turn at −2 (GM adjudicates)." } },
    { cost: 3, key: "aegis", bucket: "def", label: "Aegis — ally gains DR equal to Prof this round",
      fiction: "Your stance covers theirs.", fx: { tgt: "ally", dr: "prof" } },
    // ── cost 4 ──
    { cost: 4, key: "surging-cast", bucket: "off", label: "Surging Cast — maximize one damage die of your next spell/feature",
      fiction: "The current runs hotter. Anything could come through.", fx: { tgt: "self", oneShot: "surgingCast", note: "Next spell/feature damage: maximize one die (GM applies)." } },
    { cost: 4, key: "iron-word", bucket: "def", label: "Iron Word — auto-succeed one save",
      fiction: "You name what is happening. It listens.", fx: { tgt: "self", oneShot: "autoSaveOnce", note: "Automatically succeed one saving throw this round (declare before rolling)." } },
    { cost: 4, key: "field-patch", bucket: "heal", label: "Field Patch — heal ally 2d6 + Prof (in reach)",
      fiction: "Hands move faster than the wound can close.", fx: { tgt: "ally", heal: "2d6+@prof" } },
    // ── cost 5+ ──
    { cost: 5, key: "reshape-fiction", bucket: "narr", label: "Reshape Fiction — one beat (GM-gated, 1/scene)",
      fiction: "A small miracle. A door that wasn't there. A body that didn't quite fall.", fx: { tgt: "self", note: "One narrative beat reshaped (GM-gated, once per scene)." } },
    { cost: 5, key: "doomstrike", bucket: "off", label: "Doomstrike — next attack +Prof d6 damage",
      fiction: "You bring more than you swung.", fx: { tgt: "self", oneShot: "doomstrike", note: "Next hit deals +Prof d6 extra damage (GM applies)." } },
    { cost: 5, key: "steel-veil", minProf: 3, bucket: "def", label: "Steel Veil — resistance to one damage type this round",
      fiction: "Something between you and the world refuses the harm.", fx: { tgt: "self", oneShot: "resistTypePending", note: "Choose a damage type — resistance this round (GM applies)." } },
    { cost: 6, key: "wrath-cascade", minProf: 3, bucket: "off", label: "Wrath Cascade — reroll all 1s and 2s on your next damage roll",
      fiction: "The dice all remember at once.", fx: { tgt: "self", oneShot: "wrathCascade", note: "Next damage roll: reroll all 1s and 2s, keep the new results (GM applies)." } },
    { cost: 7, key: "crowning-blow", minProf: 4, bucket: "off", label: "Crowning Blow — next hit is a max-die critical",
      fiction: "Inevitable. The kind of strike fables remember.", fx: { tgt: "self", oneShot: "crowningBlow", note: "Next hit is a critical with maximized dice (GM applies)." } },
    { cost: 7, key: "rallying-cry", bucket: "heal", label: "Rallying Cry — heal allies within Prof×5 ft for 1d6 + Prof",
      fiction: "Your voice carries the life back into them.", fx: { tgt: "alliesProfSq", heal: "1d6+@prof" } },
    { cost: 8, key: "power-surge", minProf: 4, bucket: "off", label: "Power Surge — next attack or feature adds your Prof again",
      fiction: "You reach above your weight class for one moment.", fx: { tgt: "self", oneShot: "powerSurge", note: "Next attack/feature: add your Proficiency Bonus to the roll a second time (GM applies)." } },
    { cost: 9, key: "cinderwake", minProf: 6, bucket: "off", label: "Cinderwake — next damage roll: maximize all dice",
      fiction: "The dice run hot enough to leave scars.", fx: { tgt: "self", oneShot: "cinderwake", note: "Next damage roll is maximized (GM applies)." } },
    { cost: 10, key: "final-argument", minProf: 6, bucket: "off", label: "Final Argument — next attack auto-hits, max damage, +Prof to damage",
      fiction: "There will be no negotiation.", fx: { tgt: "self", oneShot: "finalArgument", note: "Next attack auto-hits with maximized damage, plus your Proficiency Bonus (GM applies)." } },
    { cost: 10, key: "phoenix", bucket: "heal", label: "Phoenix — restore self/ally from 0 HP to half (1/encounter)",
      fiction: "Remember what you were before the wound. Be that now.", fx: { tgt: "allyOrSelf", phoenix: true } },
  ];

  // ── Effect application ─────────────────────────────────────────────────────
  async function applyEntry(actor, entry) {
    const prof = profOf(actor);
    const fx = entry.fx ?? {};
    const lines = [];
    const origin = actor.uuid;
    const resolveN = (v) => v === "prof" ? prof : Number(v) || 0;
    const formula = (f) => String(f).replace("@prof", String(prof));

    // Resolve targets.
    let targets = [];
    const token = casterToken(actor);
    const tgt = fx.tgt ?? "self";
    let picked = ["ally", "allyOrSelf"].includes(tgt) ? firstTarget() : null;
    if (tgt === "ally" && !picked) {
      ui.notifications?.warn?.(`${entry.label}: target a token first.`);
      return false;
    }
    if (tgt === "self") targets = [actor];
    else if (tgt === "ally") targets = [picked];
    else if (tgt === "allyOrSelf") targets = [picked ?? actor];
    else if (tgt === "alliesProfSq") {
      targets = (token ? alliesInRange(token, prof * 5) : []).map(t => t.actor);
      if (!targets.length) targets = [actor];
    }

    for (const t of targets) {
      if (!t) continue;
      if (fx.heal) {
        const healed = await healActor(t, formula(fx.heal), `⚡ ${entry.label}`);
        lines.push(`${t.name} heals ${healed}.`);
      }
      if (fx.phoenix) {
        const max = Number(get(t, "system.attributes.hp.max", 0)) || 0;
        const hp = Number(get(t, "system.attributes.hp.value", 0)) || 0;
        const half = Math.floor(max / 2);
        if (hp < half) await t.update({ "system.attributes.hp.value": half, "system.attributes.death.failure": 0, "system.attributes.death.success": 0 });
        lines.push(`${t.name} is restored to ${half} HP.`);
      }
      if (fx.dr) { const n = resolveN(fx.dr); await addAE(t, drAE(n, origin)); await grantTempHP(t, n); lines.push(`${t.name}: DR ${n} this round (temp HP floor granted).`); }
      if (fx.acBonus) {
        const n = resolveN(fx.acBonus);
        await addAE(t, { name: `${entry.label.split("—")[0].trim()} (+${n} AC)`, img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", origin,
          duration: { rounds: 1, seconds: 6 }, changes: [{ key: "system.attributes.ac.bonus", mode: 2, value: String(n), priority: 20 }],
          flags: { [MOD]: { surgeMarker: true } } });
        lines.push(`${t.name}: +${n} AC till next turn.`);
      }
      if (fx.advAttack1) {
        // Real next-attack advantage: midi-qol honors the flag, DAE expires the
        // AE after one attack (1Attack specialDuration). 10-round failsafe.
        await addAE(t, {
          name: `${entry.label.split("—")[0].trim()} (advantage, next attack)`,
          img: "icons/skills/melee/strike-dagger-arcane-pink.webp", origin,
          duration: { rounds: 10, seconds: 60 },
          changes: [
            { key: "flags.midi-qol.advantage.attack.all", mode: 5, value: "1", priority: 20 },
            { key: "flags.dnd5e.advantage.attack.all", mode: 5, value: "1", priority: 20 },
          ],
          flags: { [MOD]: { surgeMarker: true }, dae: { specialDuration: ["1Attack"] } }
        });
        lines.push(`${t.name}: next attack has advantage (auto with midi; expires after the attack).`);
      }
    }

    if (fx.oneShot) { await oneShot(actor, fx.oneShot); }
    if (fx.init) {
      const c = game.combat?.combatants?.find?.(c => c.actor === actor || c.actor?.id === actor.id);
      if (c) {
        const v = await foundry.applications.api.DialogV2.prompt({
          window: { title: "Reposition — new initiative" },
          content: `<input type="number" name="init" value="${c.initiative ?? 0}" style="width:100%"/>`,
          ok: { label: "Set", callback: (_ev, b) => Number(b.form.elements.init?.value) },
          rejectClose: false,
        }).catch(() => null);
        if (Number.isFinite(v)) { await game.combat.setInitiative(c.id, v); lines.push(`Initiative set to ${v}.`); }
      } else lines.push("Not in combat — initiative unchanged.");
    }
    if (fx.note) lines.push(`<em>${fx.note}</em>`);

    await cue(actor, `${entry.label} (${entry.cost} Surge)`, [entry.fiction ? `<em>${entry.fiction}</em>` : "", ...lines].filter(Boolean));
    return true;
  }

  // ── Spend dialog ───────────────────────────────────────────────────────────
  const BUCKETS = [["off", "⚔ Offense"], ["def", "🛡 Defense"], ["heal", "✚ Restoration"], ["narr", "✦ Narrative"]];

  async function openMenu(actor) {
    if (!actor) actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
    if (!actor) return ui.notifications?.warn?.("Select a token or assign a character first.");
    const surge = game.surgePowers;
    if (!surge?.spend) return;
    const cur = surge.get(actor), max = surge.max(actor), prof = profOf(actor);

    const entryHtml = (e) => {
      const profLocked = (e.minProf ?? 0) > prof;
      const broke = e.cost > cur;
      const disabled = profLocked || broke;
      const why = profLocked ? `Prof +${e.minProf} required (you have +${prof})` : broke ? `Costs ${e.cost} Surge (you have ${cur})` : "";
      return `<button type="button" data-surge-key="${e.key}" ${disabled ? "disabled" : ""}
        title="${(e.fiction || "").replace(/"/g, "&quot;")}${why ? " — " + why : ""}"
        style="display:block;width:100%;text-align:left;margin:.15rem 0;padding:.3rem .45rem;border-radius:5px;
        border:1px solid ${disabled ? "rgba(255,255,255,.08)" : "#b9882e66"};
        background:${disabled ? "rgba(255,255,255,.02)" : "rgba(185,136,46,.08)"};
        opacity:${disabled ? ".45" : "1"};cursor:${disabled ? "not-allowed" : "pointer"}">
        <b style="color:#e8c84a">${e.cost}⚡</b> <b>${e.label.split("—")[0].trim()}</b>
        <span style="font-size:.72rem;opacity:.75;display:block">${e.label.includes("—") ? e.label.split("—").slice(1).join("—").trim() : ""}</span>
      </button>`;
    };
    const cols = BUCKETS.map(([b, title]) => {
      const list = MENU.filter(e => e.bucket === b).sort((a, z) => a.cost - z.cost);
      return `<div style="flex:1;min-width:200px"><p style="margin:.2rem 0;font-weight:700;border-bottom:1px solid #b9882e44">${title}</p>
        ${list.map(entryHtml).join("") || "<p style='font-size:.72rem;opacity:.5'>—</p>"}</div>`;
    }).join("");

    const dlg = await new foundry.applications.api.DialogV2({
      window: { title: `⚡ Surge Powers — ${actor.name} (${cur}/${max})`, resizable: true },
      position: { width: 900 },
      content: `<div style="display:flex;gap:.8rem;max-height:60vh;overflow:auto">${cols}</div>
        <p style="font-size:.7rem;opacity:.55;margin:.5rem 0 0">Spends are hard-gated by your pool. Mechanical effects apply now; <em>italic</em> lines are GM-applied riders.</p>`,
      buttons: [{ action: "close", label: "Close", default: true }],
      rejectClose: false,
    }).render(true);

    dlg.element.querySelectorAll("[data-surge-key]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const entry = MENU.find(e => e.key === btn.dataset.surgeKey);
        if (!entry) return;
        const ok = await surge.spend(actor, entry.cost);
        if (!ok) return ui.notifications?.warn?.(`Not enough Surge (${surge.get(actor)}/${entry.cost}).`);
        try { await applyEntry(actor, entry); }
        catch (e) { console.error(TAG, "apply failed", entry.key, e); }
        dlg.close();
      });
    });
    return dlg;
  }

  // ── API ────────────────────────────────────────────────────────────────────
  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e") return;
    game.surgePowers = Object.assign(game.surgePowers || {}, { openMenu, menu: MENU, applyEntry, profOf });
    console.log(TAG, `Surge Powers table ready (${MENU.length} universal entries)`);
  });
})();
