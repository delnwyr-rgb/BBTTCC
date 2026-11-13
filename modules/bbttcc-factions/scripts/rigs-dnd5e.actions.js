/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-factions · rigs-dnd5e.actions.js — crew role actions on dnd5e (2026-10-08)
 * ─────────────────────────────────────────────────────────────────────────────
 * Port of the June-2026 rig-actions.js (RFI canon RIG_BOSS_SCHEMA.md §3.6)
 * onto the accessor `game.bbttcc.rigs` + its dnd5e runtime (`rigs.impl`).
 * DORMANT off-dnd5e — fourththing's system owns the Crew HUD there.
 *
 * Each crew role gets a band of actions, surfaced through a role menu opened
 * from the rig token HUD (🎛) or the sheet's crew roster. Boarded stewards
 * spend their OWN action economy (the cost type is shown on every entry;
 * enforcement is the table's).
 *
 * Wiring band (honest-D2):
 *   WIRED — fire-weapon (the rig's real mounted weapon items), hold-position
 *     (gunner advantage AE on the rig), evasive (attacks AGAINST the rig at
 *     disadvantage via midi `grants`), aimed-shot (advantage AE + DAE 1Attack),
 *     reload / vent-heat (reset an item's uses), repair (tool check DC 15 →
 *     1d6+PB hull), brace (+1 AC, 1 rd), hold-on (temp HP), ram ((tier × bracket
 *     weight + Piloting)d6 in contact, target damaged, recoil to the rig — RFI's),
 *     stomp (mech: (tier × weight)d6, prone, +1 Heat), hit-and-run (small rigs,
 *     after a shot this round: +(2 + Piloting) AC), vent-heat (pilot −1 / engineer −2).
 *   CUE — swerve, suppression, opportunity-fire, boost-system,
 *     counter-sabotage, signal (GM-adjudicated; clean chat card).
 * Frames narrow each role's list (frame.actions.<role>); frame-only entries
 * (sail variants) appear only when a frame lists them.
 *
 * WRITES + SECURITY (D&D port review C15/C26/C51, 2026-10-31): every write a seat
 * can't make itself goes through gmExec "rigs.action"; the GM seat checks the
 * socket sender owns a steward boarded on that rig, then DERIVES the numbers
 * itself — heat from an action id (stomp +1 · vent-pilot −1 · vent-engineer −2,
 * role-checked), the Hit-and-Run AC bonus from the steward's Piloting, a hit on a
 * TARGET token ("hitTarget") capped by the rig's most recent damage/stomp/ram roll
 * card, repair healing by 1d6 + PB. A player's rig hit therefore lands on tokens
 * they don't own (it used to fail silently inside a try/catch).
 * Heat lives at flags.bbttcc-factions.combat.heat (max 2 + tier × 2, RFI's);
 * combat.fired = "<combat>:<round>" is stamped by the runtime on every rig attack
 * card (the hit-and-run gate); both clear at deleteCombat.
 *
 *   REGISTERS  game.bbttcc.rigs.impl.{ openRigActions, renderRigBar,
 *              registerAction, ACTIONS }
 * ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const TAG = "[bbttcc-factions/rigs-dnd5e-actions]";
  if (game?.system?.id && game.system.id !== "dnd5e") return;   // DORMANT off-dnd5e

  const get = (o, p, d) => { try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; } };
  const R = () => game.bbttcc?.rigs;
  const I = () => game.bbttcc?.rigs?.impl ?? {};
  const data = (rig) => R()?.data?.(rig) ?? null;
  const baseActor = (a) => I().baseActor?.(a) ?? a;
  const subtypeOf = (item) => R()?.gearOf?.(item)?.subtype ?? "";

  const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));   // review P3 (2026-10-28): names are player-editable

  // review P2 (2026-10-28): a GM can board a player's steward onto a rig the
  // player does not own, so every rig write goes through rigWrite(): local when
  // this seat can modify the rig, else gmExec "rigs.action" (the GM checks the
  // sender owns a steward boarded on that rig). AEs are built from this table
  // on the writing seat — the relay carries a key, never raw changes.
  const ADV = [
    { key: "flags.midi-qol.advantage.attack.all", mode: 5, value: "1", priority: 20 },
    { key: "flags.dnd5e.advantage.attack.all", mode: 5, value: "1", priority: 20 },
  ];
  const AE_SPECS = {
    "hold-position": { name: "Hold Position (gunner advantage)", changes: ADV, note: "rig weapon attacks have advantage until the pilot's next turn" },
    // the table kit (our midi replacement) reads flags.dnd5e-table-kit.grants.disadvantage.attack; midi's key kept for midi tables
    "evasive": { name: "Evasive (attackers disadvantaged)", changes: [{ key: "flags.midi-qol.grants.disadvantage.attack.all", mode: 5, value: "1", priority: 20 }, { key: "flags.dnd5e-table-kit.grants.disadvantage.attack", mode: 5, value: "all", priority: 20 }], note: "attacks against the rig are at disadvantage until the pilot's next turn" },
    "raise-sail": { name: "Sails Raised", changes: [], note: "speed mode: faster, harder to turn" },
    "aimed-shot": { name: "Aimed Shot (advantage, next attack)", changes: ADV, note: "next rig weapon attack has advantage", extraFlags: { dae: { specialDuration: ["1Attack"] } } },
    "boost-system": { name: "System Boosted", changes: [], note: "one rig system performs at +1 effect step until end of round (GM applies)" },
    "brace": { name: "Braced (+1 AC)", changes: [{ key: "system.attributes.ac.flat", mode: 2, value: "1", priority: 20 }], note: "+1 AC until end of round" },
    // RFI hit-and-run (owner ruling 2026-10-21, ported 2026-10-31): small rigs peel away after a shot — +(2 + Piloting)
    // Evasion → here +(2 + Piloting) AC until the pilot's next turn. `value` is filled per pilot at write time.
    // a D&D rig's AC is flat (bbttcc-core rigs.js AC_BY_BRACKET), so AC effects ADD to ac.flat — ac.bonus is ignored there
    "hit-and-run": { name: "Hit and Run (evading)", changes: [{ key: "system.attributes.ac.flat", mode: 2, value: "2", priority: 20 }], note: "the rig peels away — AC bonus until the pilot's next turn" },
  };
  // RFI mech stomp / ram: (tier × bracket weight)d6; RIG BALANCE 2026-10-21 → mecha weight 2 (FT_RIG_BRACKET_WEIGHT)
  const BRACKET_WEIGHT = { personal: 1, light: 2, medium: 3, heavy: 4, siege: 5, mecha: 2 };
  // review C16: tier lives at integrity.tier in the normalised view (data(rig).tier never existed → every rig read T1)
  const tierOf = (rig) => Math.max(1, Math.min(4, Number(data(rig)?.integrity?.tier) || 1));   // RFI _ftRigHeatMax clamps 1..4
  const heatMax = (rig) => 2 + tierOf(rig) * 2;   // RFI: T1 4 · T2 6 · T3 8 · T4 10
  const heatOf = (rig) => Math.max(0, Number(get(rig, "flags.bbttcc-factions.combat.heat", 0)) || 0);
  // review C17/C26: heat moves by ACTION ID, never a raw delta — the GM side derives the number and checks the role
  const HEAT_ACTIONS = { stomp: { delta: +1, roles: ["pilot"] }, "vent-pilot": { delta: -1, roles: ["pilot"] }, "vent-engineer": { delta: -2, roles: ["engineer"] } };
  const roleOf = (rig, st) => (data(rig)?.crew?.slots ?? []).find(s => s.actorId === st?.id)?.role ?? null;
  // weapons fired this round: a local note for this seat's own Fire Weapon, plus the rig flag the runtime stamps on EVERY
  // rig attack card (sheet / item card / dock / bar, any seat — review C24; RFI keeps rigWeaponsFiredThisRound)
  const _fired = new Map();
  const roundKey = () => `${game.combat?.id ?? "-"}:${game.combat?.round ?? 0}`;
  const firedThisRound = (rig) => !!_fired.get(`${rig.id}:${roundKey()}`) || get(rig, "flags.bbttcc-factions.combat.fired", null) === roundKey();
  // The write itself (runs on a seat that can modify the rig).
  async function doRigWrite(rig, op, args = {}) {
    if (op === "ae") {
      const spec = AE_SPECS[args.key];
      if (!spec) throw new Error(`unknown rig effect "${args.key}"`);
      const changes = foundry.utils.deepClone(spec.changes);
      if (args.key === "hit-and-run" && args.bonus != null) changes[0].value = String(args.bonus);
      await rig.createEmbeddedDocuments("ActiveEffect", [{
        name: args.key === "hit-and-run" ? `Hit and Run (+${args.bonus ?? 2} AC)` : spec.name, img: "icons/vehicles/wheels/wheel-spokes-six-brown.webp", origin: rig.uuid,
        duration: { rounds: 1, seconds: 6 }, changes,
        flags: foundry.utils.mergeObject({ bbttcc: { rigAction: true, cue: spec.note || "" } }, foundry.utils.deepClone(spec.extraFlags ?? {})),
      }]);
      return { ok: true };
    }
    if (op === "lowerSail") {
      const aes = (rig.effects ?? []).filter(e => e.name === AE_SPECS["raise-sail"].name);
      if (aes.length) await rig.deleteEmbeddedDocuments("ActiveEffect", aes.map(e => e.id));
      return { ok: true };
    }
    if (op === "heal") {
      const amount = Math.max(0, Math.floor(Number(args.amount) || 0));
      const hp = Number(get(rig, "system.attributes.hp.value", 0)) || 0;
      const max = Number(get(rig, "system.attributes.hp.max", 0)) || 0;
      const value = Math.min(max, hp + amount);
      await R().update(rig, { "integrity.value": value });
      return { ok: true, value, max };
    }
    if (op === "heat") {
      const spec = HEAT_ACTIONS[args.action];
      if (!spec) throw new Error(`unknown heat action "${args.action}"`);
      const before = heatOf(rig);
      const next = Math.max(0, Math.min(heatMax(rig), before + spec.delta));
      await rig.update({ "flags.bbttcc-factions.combat.heat": next });
      return { ok: true, before, heat: next, max: heatMax(rig) };
    }
    if (op === "damage") {   // recoil to the rig itself (ram) — dnd5e applyDamage honours the hull's damage threshold
      const amount = Math.max(0, Math.floor(Number(args.amount) || 0));
      if (amount) await rig.applyDamage([{ value: amount, type: String(args.type || "bludgeoning") }]);
      return { ok: true, applied: amount };
    }
    if (op === "hitTarget") {   // review C51: the rig's hit lands on a token the firing seat doesn't own
      const doc = await fromUuid(String(args.targetUuid ?? ""));
      const actor = doc?.actor ?? (doc instanceof Actor ? doc : null);
      if (!actor) throw new Error("target not found");
      const amount = Math.max(0, Math.floor(Number(args.amount) || 0));
      if (amount) await actor.applyDamage([{ value: amount, type: String(args.type || "bludgeoning") }]);
      return { ok: true, applied: amount, target: actor.name };
    }
    if (op === "resetUses") {
      const it = rig.items?.get?.(args.itemId);
      if (!it) throw new Error("no such rig item");
      await it.update({ "system.uses.spent": 0 });
      return { ok: true };
    }
    throw new Error(`unknown rig op "${op}"`);
  }
  async function rigWrite(rig, steward, op, args = {}) {
    try {
      if (rig.canUserModify?.(game.user, "update")) return await doRigWrite(rig, op, args);
      const gx = game.bbttcc?.api?.gmExec;
      if (!gx?.call) throw new Error("no GM relay available");
      const res = await gx.call("rigs.action", { rigId: rig.id, stewardId: steward?.id ?? null, op, args });
      if (res?.ok === false) throw new Error(res.error || "refused");
      return res;
    } catch (e) {
      console.warn(TAG, `rig write "${op}" failed`, e);
      ui.notifications?.warn?.(`${rig.name}: the rig action didn't land — ${e?.message ?? e}`);
      return { ok: false, error: String(e?.message ?? e) };
    }
  }
  // The ceiling a player-side damage claim may reach: the rig's most recent damage / stomp / ram roll card (30 s).
  function recentRigRollCap(rig) {
    const since = Date.now() - 30000;
    let cap = 0;
    for (const m of (game.messages?.contents ?? []).slice(-60)) {
      if (m.timestamp < since || String(m.speaker?.actor ?? "") !== rig.id || !m.rolls?.length) continue;
      const isDamage = m.type === "damage" || m.flags?.dnd5e?.roll?.type === "damage" || !!m.flags?.bbttcc?.rigRoll;
      if (!isDamage) continue;
      cap = Math.max(cap, ...m.rolls.map(r => Number(r.total) || 0));
    }
    return cap;
  }
  // GM side: the sender must own a steward that is boarded on this rig; the numbers are derived HERE (review C26/C51).
  async function rigsActionHandler(payload = {}, meta = {}) {
    const user = game.users?.get?.(meta.fromUserId);
    const rig = game.actors?.get?.(String(payload.rigId ?? ""));
    const st = game.actors?.get?.(String(payload.stewardId ?? ""));
    if (!user || !rig || !data(rig)) return { ok: false, error: "unknown rig" };
    const op = String(payload.op ?? "");
    let args = foundry.utils.deepClone(payload.args ?? {});
    if (!user.isGM) {
      if (!st || !st.testUserPermission?.(user, "OWNER")) return { ok: false, error: "you don't own that steward" };
      if (R()?.boardedRigOf?.(st)?.rigId !== rig.id || !(data(rig)?.crew?.slots ?? []).some(s => s.actorId === st.id)) return { ok: false, error: `${st.name} is not aboard ${rig.name}` };
      const role = roleOf(rig, st);
      if (op === "heal") {   // clamp to the action's own ceiling (1d6 + PB)
        const pb = Number(get(st, "system.attributes.prof", 2)) || 2;
        args = { amount: Math.min(Number(args.amount) || 0, 6 + pb) };
      } else if (op === "heat") {   // the delta comes from the action id and the steward's seat, never the payload
        const spec = HEAT_ACTIONS[args.action];
        if (!spec) return { ok: false, error: "unknown heat action" };
        if (!spec.roles.includes(role)) return { ok: false, error: `${st.name} is ${role ?? "unseated"} — ${args.action} needs the ${spec.roles.join("/")}` };
        args = { action: args.action };
      } else if (op === "ae" && args.key === "hit-and-run") {   // the AC bonus is recomputed from the steward's Piloting
        if (role !== "pilot") return { ok: false, error: `${st.name} isn't the pilot` };
        args = { key: "hit-and-run", bonus: 2 + Math.max(0, Number(get(st, "system.skills.pil.total", 0)) || 0) };
      } else if (op === "hitTarget" || op === "damage") {   // capped by the rig's own most recent damage/stomp/ram card
        const cap = recentRigRollCap(rig);
        if (!cap) return { ok: false, error: "no recent rig damage roll to apply" };
        args = { ...args, amount: Math.min(Math.max(0, Math.floor(Number(args.amount) || 0)), cap) };
      }
    }
    try { return await doRigWrite(rig, op, args); }
    catch (e) { return { ok: false, error: String(e?.message ?? e) }; }
  }
  // A hit on a TARGET token: local when this seat can modify it, else through the relay (review C51 — the player gunner's
  // applyDamage on a hostile token was refused and swallowed; the cue still said "hit for N"). Returns {ok}.
  async function applyHit(rig, st, tgt, amount, type = "bludgeoning") {
    const actor = tgt?.actor;
    amount = Math.max(0, Math.floor(Number(amount) || 0));
    if (!actor || !amount) return { ok: false, error: "nothing to apply" };
    try {
      if (actor.canUserModify?.(game.user, "update")) { await actor.applyDamage([{ value: amount, type }]); return { ok: true, applied: amount, local: true }; }
      const gx = game.bbttcc?.api?.gmExec;
      if (!gx?.call) throw new Error("no GM relay available");
      const res = await gx.call("rigs.action", { rigId: rig.id, stewardId: st?.id ?? null, op: "hitTarget", args: { targetUuid: tgt.document?.uuid ?? tgt.uuid, amount, type } });
      if (res?.ok === false) throw new Error(res.error || "refused");
      return res;
    } catch (e) {
      console.warn(TAG, "rig hit didn't land", e);
      ui.notifications?.warn?.(`${tgt.name}: the ${amount} damage didn't land — ${e?.message ?? e}. GM: apply it by hand.`);
      return { ok: false, error: String(e?.message ?? e) };
    }
  }
  // Contact gate shared by Ram and Stomp (RFI: edge-to-edge, one square; the GM may proceed with a warning).
  function inContact(rig, tgt, what) {
    const rt = rig.getActiveTokens()[0];
    if (!rt || !tgt?.document) return true;
    const gap = Math.hypot(rt.center.x - tgt.center.x, rt.center.y - tgt.center.y) / canvas.grid.size - (rt.document.width + tgt.document.width) / 2;
    if (gap <= 1.01) return true;
    const msg = `${tgt.name} isn't in contact — a ${what} needs the target within a square.`;
    if (!game.user.isGM) { ui.notifications?.warn?.(msg); return false; }
    ui.notifications?.warn?.(`${msg} Proceeding (GM's call).`);
    return true;
  }

  // ── Appliers ───────────────────────────────────────────────────────────────
  async function cue(rig, steward, title, lines) {
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: rig }),
        content: `<div class="bbttcc-class-cue" style="border:1px solid #b9882e;border-radius:6px;padding:.4rem .6rem">
          <p style="margin:.1rem 0;font-weight:700">🎛 ${title}</p>
          <p style="margin:.1rem 0;font-size:.74rem;opacity:.7">${esc(steward?.name ?? "Crew")} aboard ${esc(rig.name)}</p>
          ${(lines || []).map(l => `<p style="margin:.1rem 0;font-size:.82rem">${l}</p>`).join("")}
        </div>`
      });
    } catch (e) { /* best-effort */ }
  }
  // Returns true when the effect landed — callers post their cue only on success.
  async function rigAE(rig, steward, key) {
    const res = await rigWrite(rig, steward, "ae", { key });
    return res?.ok !== false;
  }
  async function pickOne(title, options) {
    if (!options.length) return null;
    if (options.length === 1) return options[0].id;
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: options.map((o, i) => `
        <label style="display:flex;align-items:flex-start;gap:.4rem;padding:.25rem .35rem;cursor:pointer">
          <input type="radio" name="pick" value="${o.id}" ${i === 0 ? "checked" : ""}/>
          <span><b>${esc(o.label)}</b>${o.desc ? `<br/><span style="font-size:.72rem;opacity:.6">${o.desc}</span>` : ""}</span>
        </label>`).join(""),
      ok: { label: "Choose", callback: (_ev, b) => b.form.elements.pick?.value ?? null },
      rejectClose: false,
    }).catch(() => null);
  }
  // 11-12: dnd5e 6 keeps activities in a Map-like collection — Object.keys() on it is always [], so feat-based weapons
  // (WORLDBREAKER's stations) and rig-weapon gear were never counted. Count with .size.
  const actCount = (i) => Number(i?.system?.activities?.size ?? Object.keys(i?.system?.activities ?? {}).length) || 0;
  function weaponsOf(rig) {
    return (rig.items ?? []).filter(i => i.type === "weapon"
      || (actCount(i) && subtypeOf(i) === "rig-weapon")
      || (i.type === "feat" && actCount(i)));
  }
  function systemsOf(rig) {
    return (rig.items ?? []).filter(i => ["rig-system", "output-module"].includes(subtypeOf(i)) || i.type === "equipment");
  }

  async function fireWeapon(rig, st) {
    const ws = weaponsOf(rig);
    if (!ws.length) return cue(rig, st, "Fire Weapon", ["No mounted weapons on this rig."]);
    const id = ws.length === 1 ? ws[0].id : await pickOne("Fire which weapon?", ws.map(w => ({ id: w.id, label: w.name })));
    const w = ws.find(x => x.id === id);
    if (!w) return;
    _fired.set(`${rig.id}:${roundKey()}`, true);   // the hit-and-run gate (local note; the runtime also stamps the rig flag)
    // RFI parity (2026-10-31): the GUNNER aims the gun. A dnd5e vehicle has no proficiency and Dex 10, so the roll
    // carries the firing steward's ranged attack bonus (Dex mod + proficiency with Firearms) instead of the rig's.
    const act = w.system.activities?.find?.(a => a.type === "attack") ?? w.system.activities?.contents?.[0];
    if (!act) { try { await w.use(); } catch (_e) {} return; }
    const tgt = [...(game.user.targets ?? [])][0];
    if (!tgt?.actor) return ui.notifications?.warn?.(`${esc(w.name)}: target a token first.`);
    // The steward's bonus rides in through the runtime's crew-roll hook (preRollD20TestV2 swaps the vehicle's
    // mod/prof for the roller's on EVERY rig d20 test — sheet, card or dock); setRollAs names the roller so a GM
    // firing for a steward who isn't in the roster yet still gets their numbers. Read back for the receipt.
    const dex = Number(get(st, "system.abilities.dex.mod", 0)) || 0;
    const profKey = CONFIG.DND5E?.weaponProficienciesMap?.[w.system?.type?.value];
    const wp = get(st, "system.traits.weaponProf.value", new Set());
    const prof = (wp?.has?.(profKey) || wp?.has?.(w.system?.type?.value)) ? (Number(get(st, "system.attributes.prof", 0)) || 0) : 0;
    const bonus = dex + prof;
    I().setRollAs?.(st);
    let atk;
    try { atk = (await act.rollAttack({ attackMode: "ranged", event: { shiftKey: true } }, { configure: false }, {}))?.[0]; }
    finally { I().setRollAs?.(null); }
    if (!atk) return;
    const ac = Number(tgt.actor.system?.attributes?.ac?.value) || 10;
    const hit = atk.isCritical || (!atk.isFumble && atk.total >= ac);
    try { const rt = rig.getActiveTokens()[0]; if (rt) await new Sequence().effect().file("jb2a.bullet").atLocation(rt).stretchTo(tgt, { randomOffset: 0.4 }).missed(!hit).play(); } catch (_e) {}
    if (!hit) return cue(rig, st, `🔫 ${esc(w.name)}`, [`${esc(st?.name ?? "Gunner")} fires at ${esc(tgt.name)}: <b>${atk.total}</b> vs AC ${ac} — <b>miss</b>.`]);
    const dmg = (await act.rollDamage({ isCritical: atk.isCritical }, { configure: false }, {}))?.[0];
    const total = dmg?.total ?? 0;
    const landed = await applyHit(rig, st, tgt, total, dmg?.options?.type ?? "piercing");   // C51: through the GM relay when needed
    try { await new Sequence().effect().file("jb2a.impact").atLocation(tgt).scale(0.6).play(); } catch (_e) {}
    await cue(rig, st, `🔫 ${esc(w.name)}`, [`${esc(st?.name ?? "Gunner")} fires at ${esc(tgt.name)}: <b>${atk.total}</b> vs AC ${ac} — <b>hit</b> for <b>${total}</b>${atk.isCritical ? " (critical!)" : ""}${landed?.ok === false ? " <b>(not applied — see the warning)</b>" : ""}.${bonus ? ` <span style="opacity:.7">(+${bonus} = Dex ${dex >= 0 ? "+" : ""}${dex}${prof ? ` + prof ${prof}` : ""})</span>` : ""}`]);
  }

  // RFI vent-heat (review C17): the dnd5e vent only reset an item's uses and never touched the heat flag, so a mech that
  // stomped to its cap was overheated for good. Engineer −2 / pilot −1, weapons re-arm when it drops below the cap; the
  // uses reset stays as the second half of the action.
  async function ventHeat(rig, st) {
    const role = roleOf(rig, st);
    const lines = [];
    const h = heatOf(rig), hm = heatMax(rig);
    if (h > 0 && (role === "engineer" || role === "pilot")) {
      const res = await rigWrite(rig, st, "heat", { action: role === "engineer" ? "vent-engineer" : "vent-pilot" });
      if (res?.ok !== false) {
        const next = Number(res?.heat ?? Math.max(0, h + HEAT_ACTIONS[role === "engineer" ? "vent-engineer" : "vent-pilot"].delta));
        lines.push(`Heat <b>${h} → ${next}</b> / ${hm} <span style="opacity:.7">(${role === "engineer" ? "Engineer −2" : "Pilot −1"})</span>.${next >= hm ? " Still overheated." : (h >= hm ? " <b>Weapons re-armed</b>." : "")}`);
        try { await new Sequence().effect().file("jb2a.smoke.puff.side.02.white").atLocation(rig.getActiveTokens()[0]).scaleToObject(1.4).play(); } catch (_e) {}
      }
    } else if (h > 0) lines.push(`Only the pilot or engineer can vent heat (${esc(st?.name ?? "this crew member")} is ${esc(role ?? "unseated")}). Heat ${h}/${hm}.`);
    const its = [...weaponsOf(rig), ...systemsOf(rig)].filter(i => Number(get(i, "system.uses.spent", 0)) > 0);
    if (its.length) {
      const id = await pickOne("Cycle which system?", its.map(i => ({ id: i.id, label: i.name })));
      const it = its.find(x => x.id === id);
      if (it && (await rigWrite(rig, st, "resetUses", { itemId: it.id }))?.ok !== false) lines.push(`${esc(it.name)} cycled — uses restored.`);
    }
    if (!lines.length) lines.push("Nothing is overheated or spent.");
    await cue(rig, st, "🌬 Vent Heat", lines);
  }

  // ── The registry (canon §3.6) — handler(rig, steward); falsy = pure cue ────
  const ACTIONS = {
    pilot: [
      { id: "steer", type: "action", label: "Steer", desc: "Move the rig up to its speed (drag the token; travel speed on the sheet sidebar).",
        handler: async (rig, st) => cue(rig, st, "Steer", [`Move up to the rig's speed. <em>In combat: drag the token; overland: ${data(rig)?.travel?.speed ?? 1} hex/turn.</em>`]) },
      // RFI ram (review C19): (tier × bracket weight + Piloting)d6 on a target in contact, applied; the rig takes half back —
      // or 3 × Threshold when it rams a structure (a flimsy shack scuffs the paint, a stone wall bites).
      { id: "ram", type: "action", label: "Ram", desc: "Charge into a target in contact: (tier × bracket weight + Piloting)d6 bludgeoning; the rig takes half back (3 × Threshold against a structure).",
        handler: async (rig, st) => {
          const tgt = [...(game.user.targets ?? [])][0];
          if (!tgt?.actor) return ui.notifications?.warn?.("Target a token first (the ram needs an objective).");
          if (!inContact(rig, tgt, "ram")) return;
          const bracket = data(rig)?.integrity?.bracket ?? "light";
          const tier = tierOf(rig), weight = BRACKET_WEIGHT[bracket] ?? 3;
          const pil = Math.max(0, Number(get(st, "system.skills.pil.total", 0)) || 0);
          const dice = Math.max(1, tier * weight) + pil;
          const r = await new Roll(`${dice}d6`).evaluate();
          await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: rig }), flavor: `💥 Ram — ${esc(tgt.name)} · ${dice}d6 (${esc(bracket)} ×${weight} × T${tier}${pil ? ` + Piloting ${pil}` : ""})`, flags: { bbttcc: { rigRoll: "ram" } } });
          const dmg = Math.max(1, Number(r.total) || 1);
          const isStruct = !!tgt.actor.flags?.["bbttcc-structures"]?.hasStructure;
          const threshold = isStruct ? (Number(tgt.actor.getFlag?.("bbttcc-structures", "threshold")) || 0) : 0;
          const self = isStruct ? Math.max(0, Math.round(threshold * 3)) : Math.max(1, Math.floor(dmg / 2));
          const landed = await applyHit(rig, st, tgt, dmg, "bludgeoning");
          if (self > 0) await rigWrite(rig, st, "damage", { amount: self, type: "bludgeoning" });
          try { const rt = rig.getActiveTokens()[0]; if (rt) await new Sequence().effect().file("jb2a.impact.ground_crack.orange.01").atLocation(tgt).scaleToObject(1.6).belowTokens().play(); } catch (_e) {}
          await cue(rig, st, "💥 Ram", [`<b>${dmg}</b> bludgeoning to ${esc(tgt.name)}${landed?.ok === false ? " <b>(not applied — see the warning)</b>" : ""}.`,
            isStruct ? (self > 0 ? `Recoil <b>${self}</b> to ${esc(rig.name)} (Threshold ${threshold}).` : "No recoil — a flimsy structure.") : `Feedback <b>${self}</b> to ${esc(rig.name)} (half).`]);
        } },
      { id: "hold-position", type: "action", label: "Hold Position", desc: "Steady the rig — gunners gain advantage on attacks until your next turn.",
        handler: async (rig, st) => {
          if (!(await rigAE(rig, st, "hold-position"))) return;
          await cue(rig, st, "Hold Position", ["The rig steadies — weapon attacks from it have <b>advantage</b> until the pilot's next turn (auto with midi)."]);
        } },
      { id: "evasive", type: "bonus", label: "Evasive Maneuvers", desc: "Attacks against the rig have disadvantage until your next turn.",
        handler: async (rig, st) => {
          if (!(await rigAE(rig, st, "evasive"))) return;
          await cue(rig, st, "Evasive Maneuvers", ["Attacks <b>against</b> the rig are at disadvantage until the pilot's next turn (auto with midi)."]);
        } },
      { id: "swerve", type: "reaction", label: "Swerve", desc: "React to an incoming attack — pilot's check vs the attack roll to slip it (GM adjudicates)." },
      // RFI parity (2026-10-31): a pilot-mount frame (Hexmobile, Power-Armor) lists fire-weapon for the pilot — the
      // same control as the gunner's, so the ONE rider fires the rig's gun.
      { id: "fire-weapon", type: "action", frameOnly: true, label: "Fire Weapon", desc: "Fire the rig's mounted weapon (pilot-mount frame).",
        handler: async (rig, st) => fireWeapon(rig, st) },
      { id: "hit-and-run", type: "bonus", label: "Hit and Run", desc: "Small rigs only — bonus action after you fire this round: peel away for +(2 + Piloting) AC until your next turn.",
        handler: async (rig, st) => {
          const bracket = data(rig)?.integrity?.bracket ?? "light";
          if (!["personal", "light"].includes(bracket)) return ui.notifications?.warn?.(`${rig.name} is too big to hit and run — that's for personal and light rigs.`);
          if (game.combat?.started && !firedThisRound(rig)) return ui.notifications?.warn?.(`${st?.name ?? "Pilot"}: fire a weapon first — hit and run peels away AFTER the shot.`);
          if ((rig.effects ?? []).some(e => /Hit and Run|Evasive/.test(e.name))) return ui.notifications?.warn?.(`${rig.name} is already evading — peeling away would add nothing.`);
          const pil = Number(get(st, "system.skills.pil.total", 0)) || 0;
          const bonus = 2 + Math.max(0, pil);
          if ((await rigWrite(rig, st, "ae", { key: "hit-and-run", bonus }))?.ok === false) return;
          try { await new Sequence().effect().file("jb2a.smoke.puff.side.02.white").atLocation(rig.getActiveTokens()[0]).scaleToObject(1.6).play(); } catch (_e) {}
          await cue(rig, st, "🏍 Hit and Run", [`Shot fired, wheels spinning: <b>+${bonus} AC</b> until the next pilot turn${pil ? ` (2 + Piloting ${pil >= 0 ? "+" : ""}${pil})` : ""}.`]);
        } },
      { id: "stomp", type: "action", frameOnly: true, label: "Stomp", desc: "Mech only — bring a foot down on a target in contact: (tier × bracket)d6 bludgeoning, knocked prone. Costs 1 Heat.",
        handler: async (rig, st) => {
          const h = heatOf(rig), hm = heatMax(rig);
          if (h >= hm) return ui.notifications?.warn?.(`${rig.name} is overheated (${h}/${hm}) — vent heat before stomping.`);
          const tgt = [...(game.user.targets ?? [])][0];
          if (!tgt?.actor) return ui.notifications?.warn?.("Target a token first — a stomp needs something underfoot.");
          if (!inContact(rig, tgt, "stomp")) return;
          const tier = tierOf(rig), weight = BRACKET_WEIGHT[data(rig)?.integrity?.bracket] ?? 3;   // C16: integrity.tier (a T4 Titan stomped 2d6)
          const r = await new Roll(`${Math.max(1, tier * weight)}d6`).evaluate();
          await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: rig }), flavor: `🦶 Stomp — ${esc(tgt.name)} · ${Math.max(1, tier * weight)}d6`, flags: { bbttcc: { rigRoll: "stomp" } } });
          const landed = await applyHit(rig, st, tgt, r.total, "bludgeoning");   // C51
          if (!["vehicle"].includes(tgt.actor.type) && !tgt.actor.statuses?.has?.("prone")) { try { await tgt.actor.toggleStatusEffect("prone", { active: true }); } catch (_e) {} }
          try { await new Sequence().effect().file("jb2a.impact.ground_crack.orange.01").atLocation(tgt).scaleToObject(2.2).belowTokens().play(); } catch (_e) {}
          const heat = await rigWrite(rig, st, "heat", { action: "stomp" });
          await cue(rig, st, "🦶 Stomp", [`<b>${r.total}</b> bludgeoning to ${esc(tgt.name)}${landed?.ok === false ? " <b>(not applied — see the warning)</b>" : ""} — knocked <b>prone</b>. Heat ${heat?.heat ?? heatOf(rig)}/${hm}.`]);
        } },
      // RFI vent-heat: the pilot can vent too (−1, emergency cooling) — mech frames list it for the pilot (review C17).
      { id: "vent-heat", type: "bonus", frameOnly: true, label: "Vent Heat", desc: "Emergency cooling — lower the rig's heat by 1 (the engineer vents 2).",
        handler: async (rig, st) => ventHeat(rig, st) },
      // Sail variants — only surfaced when an equipped frame lists them.
      { id: "tack-against-wind", type: "action", frameOnly: true, label: "Tack Against the Wind", desc: "Move + the rig gains reach advantage against downwind targets (GM adjudicates the wind)." },
      { id: "raise-sail", type: "bonus", frameOnly: true, label: "Raise Sail", desc: "Shift to speed mode — faster, harder to turn (GM applies the trade).",
        handler: async (rig, st) => { if (!(await rigAE(rig, st, "raise-sail"))) return; await cue(rig, st, "Raise Sail", ["Sails up — speed mode until lowered."]); } },
      { id: "lower-sail", type: "bonus", frameOnly: true, label: "Lower Sail", desc: "Shift to maneuver mode.",
        handler: async (rig, st) => {
          if ((await rigWrite(rig, st, "lowerSail"))?.ok === false) return;
          await cue(rig, st, "Lower Sail", ["Sails down — maneuver mode."]);
        } },
    ],
    gunner: [
      { id: "fire-weapon", type: "action", label: "Fire Weapon", desc: "Activate one of the rig's mounted weapons.",
        handler: async (rig, st) => fireWeapon(rig, st) },
      { id: "aimed-shot", type: "action+bonus", label: "Aimed Shot", desc: "Spend action AND bonus action: the rig's next weapon attack has advantage.",
        handler: async (rig, st) => {
          if (!(await rigAE(rig, st, "aimed-shot"))) return;
          await cue(rig, st, "Aimed Shot", ["Next rig weapon attack: <b>advantage</b> (auto with midi; expires after the attack). Costs action + bonus action."]);
        } },
      { id: "suppression", type: "action", label: "Suppression", desc: "Use a weapon to impose its condition rider instead of damage (per the weapon's text — GM adjudicates)." },
      { id: "reload", type: "bonus", label: "Reload", desc: "Refresh a weapon's ammunition or cooldown.",
        handler: async (rig, st) => {
          const ws = weaponsOf(rig).filter(w => Number(get(w, "system.uses.spent", 0)) > 0);
          if (!ws.length) return cue(rig, st, "Reload", ["Nothing needs reloading."]);
          const id = await pickOne("Reload which weapon?", ws.map(w => ({ id: w.id, label: w.name })));
          const w = ws.find(x => x.id === id);
          if (w && (await rigWrite(rig, st, "resetUses", { itemId: w.id }))?.ok !== false) await cue(rig, st, "Reload", [`${esc(w.name)} reloaded — uses restored.`]);
        } },
      { id: "opportunity-fire", type: "reaction", label: "Opportunity Fire", desc: "Fire at an enemy entering the weapon's reach (GM adjudicates the trigger)." },
    ],
    engineer: [
      { id: "repair", type: "action", label: "Emergency Repair", desc: "Tool check DC 15 — on a success restore 1d6 + PB hull HP.",
        handler: async (rig, st) => {
          const intMod = Number(get(st, "system.abilities.int.mod", 0)) || 0;
          const pb = Number(get(st, "system.attributes.prof", 2)) || 2;
          const check = await new Roll(`1d20 + ${intMod} + ${pb}`).evaluate();
          await check.toMessage({ speaker: ChatMessage.getSpeaker({ actor: st ?? rig }), flavor: "Emergency Repair — tool check (DC 15)" });
          if (check.total >= 15) {
            const heal = await new Roll(`1d6 + ${pb}`).evaluate();
            const res = await rigWrite(rig, st, "heal", { amount: heal.total });
            if (res?.ok === false) return;
            await cue(rig, st, "Emergency Repair", [`Success (${check.total} vs 15) — hull restored <b>${heal.total}</b> (${res.value}/${res.max}).`]);
          } else {
            await cue(rig, st, "Emergency Repair", [`Failed (${check.total} vs 15) — the seam doesn't hold this round.`]);
          }
        } },
      { id: "boost-system", type: "bonus", label: "Boost System", desc: "Overdrive one rig system until end of round.",
        handler: async (rig, st) => {
          if (!(await rigAE(rig, st, "boost-system"))) return;
          await cue(rig, st, "Boost System", ["One system runs hot until end of round — +1 effect step (GM applies)."]);
        } },
      { id: "vent-heat", type: "bonus", label: "Vent Heat / Cycle Power", desc: "Lower the rig's heat (engineer −2, pilot −1) and reset a spent weapon or system's uses.",
        handler: async (rig, st) => ventHeat(rig, st) },
      { id: "counter-sabotage", type: "reaction", label: "Counter-Sabotage", desc: "Cancel a hostile boarding or sabotage attempt (contested check — GM adjudicates)." },
    ],
    crew: [
      { id: "operate-module", type: "action", label: "Operate Module", desc: "Activate a rig system or output module.",
        handler: async (rig, st) => {
          const its = systemsOf(rig).filter(i => actCount(i));
          if (!its.length) return cue(rig, st, "Operate Module", ["No operable modules aboard."]);
          const id = await pickOne("Operate which module?", its.map(i => ({ id: i.id, label: i.name })));
          const it = its.find(x => x.id === id);
          if (it) { try { await it.use(); } catch (e) { await cue(rig, st, "Operate Module", [`${esc(it.name)}: use it from the rig sheet.`]); } }
        } },
      { id: "reload-assist", type: "bonus", label: "Assist Reload", desc: "Help a gunner — their next Reload is free (GM adjudicates)." },
      { id: "brace", type: "bonus", label: "Brace", desc: "+1 AC to the rig until end of round.",
        handler: async (rig, st) => {
          if (!(await rigAE(rig, st, "brace"))) return;
          await cue(rig, st, "Brace", ["The crew braces — rig +1 AC until end of round."]);
        } },
      { id: "signal", type: "bonus", label: "Signal", desc: "Coordinate — one crewmate gains +1 on their next rig action check (GM applies)." },
      { id: "hold-on", type: "reaction", label: "Hold On!", desc: "When the rig is hit: brace yourself — gain temp HP equal to your PB.",
        handler: async (rig, st) => {
          if (st) {
            const pb = Number(get(st, "system.attributes.prof", 2)) || 2;
            const cur = Number(get(st, "system.attributes.hp.temp", 0)) || 0;
            if (pb > cur) await st.update({ "system.attributes.hp.temp": pb });
            await cue(rig, st, "Hold On!", [`${esc(st.name)} braces: ${pb} temp HP against the impact.`]);
          }
        } },
    ],
  };
  const EXT = [];   // module-extension registry

  // Frame narrowing: frame.actions.<role> selects the band; frame-only entries
  // appear ONLY when a frame lists them. No frame → full band minus frame-only.
  function bandFor(rig, role) {
    const all = [...(ACTIONS[role] ?? []), ...EXT.filter(a => a.role === role)];
    const frameList = data(rig)?.frame?.actions?.[role];
    const small = role === "pilot" && ["personal", "light"].includes(data(rig)?.integrity?.bracket);
    if (Array.isArray(frameList) && frameList.length) return all.filter(a => frameList.includes(a.id) || (small && a.id === "hit-and-run"));
    return all.filter(a => !a.frameOnly);
  }

  // ── The role menu ──────────────────────────────────────────────────────────
  const TYPE_CHIP = { action: "ACTION", bonus: "BONUS", reaction: "REACTION", "action+bonus": "ACTION+BONUS" };
  async function openRigActions(rig, steward = null) {
    rig = baseActor(rig);
    const d = data(rig);
    if (!d) return ui.notifications?.warn?.(`${rig?.name} is not a rig.`);
    if (d.identity.state === "destroyed") return ui.notifications?.warn?.(`${rig.name} is destroyed.`);
    const slots = d.crew?.slots ?? [];
    if (!slots.length) return ui.notifications?.warn?.(`${rig.name} has no crew aboard.`);

    let slot = steward ? slots.find(s => s.actorId === steward.id) : null;
    if (!slot) {
      const id = await pickOne("Who acts?", slots.map((s, i) => ({ id: String(i), label: `${game.actors?.get?.(s.actorId)?.name ?? s.label} — ${s.role}` })));
      if (id == null) return;
      slot = slots[Number(id)];
      steward = game.actors?.get?.(slot.actorId) ?? null;
    }
    const role = slot.role ?? "crew";
    const band = bandFor(rig, role);

    const picked = await foundry.applications.api.DialogV2.prompt({
      window: { title: `🎛 ${rig.name} — ${steward?.name ?? slot.label} (${role})` },   // window titles are text, not HTML
      content: band.map((a, i) => `
        <label style="display:flex;align-items:flex-start;gap:.4rem;padding:.3rem .4rem;cursor:pointer">
          <input type="radio" name="act" value="${a.id}" ${i === 0 ? "checked" : ""}/>
          <span><b>${a.label}</b> <span style="font-size:.62rem;border:1px solid #b9882e88;border-radius:3px;padding:0 .25rem;color:#e8c84a">${TYPE_CHIP[a.type] ?? a.type}</span>
          <br/><span style="font-size:.72rem;opacity:.6">${a.desc}</span></span>
        </label>`).join("") +
        `<p style="font-size:.7rem;opacity:.55;margin:.4rem 0 0">The cost chip is the steward's OWN action economy — a 4-crew rig does up to 4 things a round.</p>`,
      ok: { label: "Do it", callback: (_ev, b) => b.form.elements.act?.value },
      rejectClose: false,
    }).catch(() => null);
    const action = band.find(a => a.id === picked);
    if (!action) return;
    if (action.handler) await action.handler(rig, steward);
    else await cue(rig, steward, action.label, [action.desc, "<em>(GM adjudicates.)</em>"]);
  }

  function registerAction(spec) {
    if (!spec?.id || !spec?.role || !spec?.label) throw new Error(`${TAG} registerAction needs {id, role, label}`);
    EXT.push(spec);
  }

  // ── Floating maneuver bar (RFI parity) ─────────────────────────────────────
  // When an actor you own is boarded, a bar appears above the macro bar with
  // that crew member's role actions. A matching banner strip is injected at
  // the top of the boarded steward's sheet.
  function boardedRigIdOf(actor) { return R()?.boardedRigOf?.(actor)?.rigId ?? null; }
  function myBoardedSteward() {
    const c = game.user?.character;
    if (c && boardedRigIdOf(c)) return c;
    return (game.actors?.contents ?? []).find(a => a.type === "character" && a.isOwner && boardedRigIdOf(a)) ?? null;
  }
  function bandButtonsHtml(rig, role) {
    return bandFor(rig, role).map(a => `
      <button type="button" data-rig-bar-act="${a.id}" title="${(a.desc || "").replace(/"/g, "&quot;")} — costs your ${a.type}"
        style="width:auto;padding:.15rem .5rem;font-size:.72rem;border:1px solid #b9882e66;border-radius:4px;
        background:rgba(20,28,48,.92);color:#e8e8f0;cursor:pointer;line-height:1.4">
        ${a.label} <span style="font-size:.58rem;color:#e8c84a">${TYPE_CHIP[a.type] ?? a.type}</span>
      </button>`).join("");
  }
  function wireBandButtons(rootEl, rig, steward, role) {
    const band = bandFor(rig, role);
    for (const btn of rootEl.querySelectorAll("[data-rig-bar-act]")) {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const a = band.find(x => x.id === btn.dataset.rigBarAct);
        if (!a) return;
        Promise.resolve(a.handler ? a.handler(rig, steward) : cue(rig, steward, a.label, [a.desc, "<em>(GM adjudicates.)</em>"]))
          .catch(e => ui.notifications.warn(String(e?.message ?? e)));
      });
    }
  }
  // Selection-aware: the bar follows the CONTROLLED token — a rig token shows
  // that rig (crew picker when several are aboard), a boarded steward shows
  // their cockpit; otherwise your own boarded character (the player default).
  const _barCrewChoice = new Map();   // rigId -> chosen slot index (GM picker)
  function barContext() {
    const controlled = canvas?.tokens?.controlled ?? [];
    for (let i = controlled.length - 1; i >= 0; i--) {
      const a = baseActor(controlled[i]?.actor);
      if (!a) continue;
      const d = data(a);
      if (d && d.identity.state !== "destroyed" && (d.crew?.slots ?? []).length) return { rig: a, steward: null };
      if (a.type === "character") {
        const rig = I().rigOf?.(a);
        if (rig) return { rig, steward: a };
      }
    }
    const st = myBoardedSteward();
    if (st) return { rig: game.actors?.get?.(boardedRigIdOf(st)), steward: st };
    return null;
  }
  function renderRigBar() {
    document.getElementById("bbttcc-rig-bar")?.remove();
    const ctx = barContext();
    const rig = ctx?.rig;
    const d = rig ? data(rig) : null;
    if (!rig || !d || d.identity.state === "destroyed") return;
    const all = d.crew?.slots ?? [];
    const slots = game.user?.isGM ? all : all.filter(s => { const a = s.actorId ? game.actors?.get?.(s.actorId) : null; return !a || a.isOwner; });
    if (!slots.length) return;
    let slot = ctx.steward ? slots.find(s => s.actorId === ctx.steward.id) : null;
    let steward = ctx.steward ?? null;
    if (!slot) {
      const idx = Math.min(_barCrewChoice.get(rig.id) ?? 0, slots.length - 1);
      slot = slots[idx];
      steward = slot.actorId ? game.actors?.get?.(slot.actorId) : null;
    }
    const role = slot?.role ?? "crew";
    const crewPicker = (!ctx.steward && slots.length > 1)
      ? `<select data-rig-bar-crew style="width:auto;font-size:.68rem;padding:0 .2rem;background:rgba(20,28,48,.92);color:#bcd3ff;border:1px solid #b9882e44;border-radius:4px">
          ${slots.map((s, i) => `<option value="${i}" ${s === slot ? "selected" : ""}>${esc((s.actorId ? game.actors?.get?.(s.actorId)?.name : null) ?? s.label)} · ${esc(s.role)}</option>`).join("")}
        </select>`
      : `<span style="font-size:.62rem;opacity:.7;color:#bcd3ff;text-transform:capitalize;white-space:nowrap">${esc(steward?.name ?? slot.label)} · ${esc(role)}</span>`;

    const bar = document.createElement("div");
    bar.id = "bbttcc-rig-bar";
    bar.style.cssText = `position:fixed;left:50%;transform:translateX(-50%);bottom:88px;z-index:99999;
      display:flex;align-items:center;gap:.35rem;padding:.3rem .6rem;border:1px solid #b9882e;border-radius:8px;
      background:rgba(10,16,32,.92);box-shadow:0 2px 12px rgba(0,0,0,.5);backdrop-filter:blur(3px);
      flex-wrap:wrap;max-width:80vw`;
    bar.innerHTML = `
      <span style="font-size:.72rem;font-weight:700;color:#e8c84a;white-space:nowrap">🛻 ${esc(rig.name)}</span>
      ${crewPicker}
      ${bandButtonsHtml(rig, role)}
      <button type="button" data-rig-bar-leave title="Disembark ${esc(steward?.name ?? slot.label)}"
        style="width:auto;padding:.15rem .45rem;font-size:.72rem;border:1px solid #c0303066;border-radius:4px;
        background:rgba(48,16,16,.9);color:#f0c0c0;cursor:pointer">🪂</button>`;
    document.body.appendChild(bar);
    wireBandButtons(bar, rig, steward, role);
    bar.querySelector("[data-rig-bar-crew]")?.addEventListener("change", (ev) => {
      _barCrewChoice.set(rig.id, Number(ev.target.value) || 0);
      renderRigBar();
    });
    bar.querySelector("[data-rig-bar-leave]")?.addEventListener("click", () => {
      if (steward) R()?.disembark?.(steward).catch(e => ui.notifications.warn(String(e?.message ?? e)));
      else ui.notifications.warn("This crew row has no linked steward — remove it from the rig sheet.");
    });
  }

  // Steward-sheet banner: same buttons, on top of the sheet while boarded.
  function injectSheetBanner(app, element) {
    try {
      const a = app?.actor;
      if (!a || a.type !== "character") return;
      const root = element instanceof HTMLElement ? element : (element?.[0] ?? app.element);
      if (!(root instanceof HTMLElement)) return;
      root.querySelector(".bbttcc-rig-banner")?.remove();
      const rigId = boardedRigIdOf(a);
      if (!rigId) return;
      const rig = game.actors?.get?.(rigId);
      const d = rig ? data(rig) : null;
      if (!rig || !d) return;
      const slot = (d.crew?.slots ?? []).find(s => s.actorId === a.id);
      const role = slot?.role ?? "crew";
      const strip = document.createElement("div");
      strip.className = "bbttcc-rig-banner";
      strip.style.cssText = `display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;padding:.25rem .5rem;
        border-bottom:1px solid #b9882e88;background:rgba(20,28,48,.55)`;
      strip.innerHTML = `<span style="font-size:.72rem;font-weight:700;color:#e8c84a">🛻 Aboard ${esc(rig.name)} · <span style="text-transform:capitalize">${esc(role)}</span></span>
        ${bandButtonsHtml(rig, role)}`;
      const anchor = root.querySelector(".window-content") ?? root;
      anchor.prepend(strip);
      wireBandButtons(strip, rig, a, role);
    } catch (e) { /* best-effort */ }
  }

  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e") return;
    const impl = game.bbttcc?.rigs?.impl;
    if (!impl) { console.warn(TAG, "game.bbttcc.rigs accessor missing — rig role actions NOT installed"); return; }
    Object.assign(impl, { openRigActions, registerAction, ACTIONS, renderRigBar });
    game.bbttcc?.api?.gmExec?.register?.("rigs.action", rigsActionHandler);   // player-seat rig writes (review P2 2026-10-28)
    renderRigBar();
    // Re-render the bar whenever boarding state / crew roster changes, plus
    // canvas swaps (scene loads rebuild the DOM around the hotbar).
    Hooks.on("updateActor", (_doc, changes) => {
      const f = changes?.flags?.["bbttcc-factions"];
      if (f && ("boardedRig" in f || "-=boardedRig" in f || f.rig !== undefined)) renderRigBar();
    });
    Hooks.on("canvasReady", () => renderRigBar());
    let _ctlTimer = null;   // control fires per token during multi-select — debounce
    Hooks.on("controlToken", () => { clearTimeout(_ctlTimer); _ctlTimer = setTimeout(() => renderRigBar(), 50); });
    for (const h of ["renderBBTTCCCharacterSheet", "renderCharacterActorSheet"]) Hooks.on(h, (app, element) => injectSheetBanner(app, element));
    console.log(TAG, "rig role actions registered on game.bbttcc.rigs.impl (role bands + floating bar + sheet banner)");
  });
})();
