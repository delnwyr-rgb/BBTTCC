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
 *     1d6+PB hull), brace (+1 AC, 1 rd), hold-on (temp HP), ram (bracket dice).
 *   CUE — swerve, suppression, opportunity-fire, boost-system,
 *     counter-sabotage, signal (GM-adjudicated; clean chat card).
 * Frames narrow each role's list (frame.actions.<role>); frame-only entries
 * (sail variants) appear only when a frame lists them.
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

  const RAM_DICE = { personal: "1d6", light: "2d6", medium: "4d6", heavy: "6d6", siege: "8d6" };

  // ── Appliers ───────────────────────────────────────────────────────────────
  async function cue(rig, steward, title, lines) {
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: rig }),
        content: `<div class="bbttcc-class-cue" style="border:1px solid #b9882e;border-radius:6px;padding:.4rem .6rem">
          <p style="margin:.1rem 0;font-weight:700">🎛 ${title}</p>
          <p style="margin:.1rem 0;font-size:.74rem;opacity:.7">${steward?.name ?? "Crew"} aboard ${rig.name}</p>
          ${(lines || []).map(l => `<p style="margin:.1rem 0;font-size:.82rem">${l}</p>`).join("")}
        </div>`
      });
    } catch (e) { /* best-effort */ }
  }
  async function rigAE(rig, name, changes, note, extraFlags = {}) {
    try {
      await rig.createEmbeddedDocuments("ActiveEffect", [{
        name, img: "icons/vehicles/wheels/wheel-spokes-six-brown.webp", origin: rig.uuid,
        duration: { rounds: 1, seconds: 6 }, changes,
        flags: foundry.utils.mergeObject({ bbttcc: { rigAction: true, cue: note || "" } }, extraFlags),
      }]);
    } catch (e) { console.warn(TAG, "rig AE failed", e); }
  }
  async function pickOne(title, options) {
    if (!options.length) return null;
    if (options.length === 1) return options[0].id;
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: options.map((o, i) => `
        <label style="display:flex;align-items:flex-start;gap:.4rem;padding:.25rem .35rem;cursor:pointer">
          <input type="radio" name="pick" value="${o.id}" ${i === 0 ? "checked" : ""}/>
          <span><b>${o.label}</b>${o.desc ? `<br/><span style="font-size:.72rem;opacity:.6">${o.desc}</span>` : ""}</span>
        </label>`).join(""),
      ok: { label: "Choose", callback: (_ev, b) => b.form.elements.pick?.value ?? null },
      rejectClose: false,
    }).catch(() => null);
  }
  function weaponsOf(rig) {
    return (rig.items ?? []).filter(i => i.type === "weapon"
      || (Object.keys(i.system?.activities ?? {}).length && subtypeOf(i) === "rig-weapon")
      || (i.type === "feat" && Object.keys(i.system?.activities ?? {}).length));
  }
  function systemsOf(rig) {
    return (rig.items ?? []).filter(i => ["rig-system", "output-module"].includes(subtypeOf(i)) || i.type === "equipment");
  }

  // ── The registry (canon §3.6) — handler(rig, steward); falsy = pure cue ────
  const ACTIONS = {
    pilot: [
      { id: "steer", type: "action", label: "Steer", desc: "Move the rig up to its speed (drag the token; travel speed on the sheet sidebar).",
        handler: async (rig, st) => cue(rig, st, "Steer", [`Move up to the rig's speed. <em>In combat: drag the token; overland: ${data(rig)?.travel?.speed ?? 1} hex/turn.</em>`]) },
      { id: "ram", type: "action", label: "Ram", desc: "Charge into a target — collision damage scales with the rig's bracket.",
        handler: async (rig, st) => {
          const bracket = data(rig)?.integrity?.bracket ?? "light";
          const dice = RAM_DICE[bracket] ?? "2d6";
          const r = await new Roll(dice).evaluate();
          await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: rig }), flavor: `Ram — ${bracket} bracket collision` });
          await cue(rig, st, "Ram", [`Collision: <b>${r.total}</b> bludgeoning to the rammed target (GM applies; structures/objects take full).`,
            `<em>The rig takes half (${Math.floor(r.total / 2)}) on a solid impact — GM's call by target.</em>`]);
        } },
      { id: "hold-position", type: "action", label: "Hold Position", desc: "Steady the rig — gunners gain advantage on attacks until your next turn.",
        handler: async (rig, st) => {
          await rigAE(rig, "Hold Position (gunner advantage)", [
            { key: "flags.midi-qol.advantage.attack.all", mode: 5, value: "1", priority: 20 },
            { key: "flags.dnd5e.advantage.attack.all", mode: 5, value: "1", priority: 20 },
          ], "rig weapon attacks have advantage until the pilot's next turn");
          await cue(rig, st, "Hold Position", ["The rig steadies — weapon attacks from it have <b>advantage</b> until the pilot's next turn (auto with midi)."]);
        } },
      { id: "evasive", type: "bonus", label: "Evasive Maneuvers", desc: "Attacks against the rig have disadvantage until your next turn.",
        handler: async (rig, st) => {
          await rigAE(rig, "Evasive (attackers disadvantaged)", [
            { key: "flags.midi-qol.grants.disadvantage.attack.all", mode: 5, value: "1", priority: 20 },
          ], "attacks against the rig are at disadvantage until the pilot's next turn");
          await cue(rig, st, "Evasive Maneuvers", ["Attacks <b>against</b> the rig are at disadvantage until the pilot's next turn (auto with midi)."]);
        } },
      { id: "swerve", type: "reaction", label: "Swerve", desc: "React to an incoming attack — pilot's check vs the attack roll to slip it (GM adjudicates)." },
      // Sail variants — only surfaced when an equipped frame lists them.
      { id: "tack-against-wind", type: "action", frameOnly: true, label: "Tack Against the Wind", desc: "Move + the rig gains reach advantage against downwind targets (GM adjudicates the wind)." },
      { id: "raise-sail", type: "bonus", frameOnly: true, label: "Raise Sail", desc: "Shift to speed mode — faster, harder to turn (GM applies the trade).",
        handler: async (rig, st) => { await rigAE(rig, "Sails Raised", [], "speed mode: faster, harder to turn"); await cue(rig, st, "Raise Sail", ["Sails up — speed mode until lowered."]); } },
      { id: "lower-sail", type: "bonus", frameOnly: true, label: "Lower Sail", desc: "Shift to maneuver mode.",
        handler: async (rig, st) => {
          const aes = (rig.effects ?? []).filter(e => e.name === "Sails Raised");
          if (aes.length) await rig.deleteEmbeddedDocuments("ActiveEffect", aes.map(e => e.id));
          await cue(rig, st, "Lower Sail", ["Sails down — maneuver mode."]);
        } },
    ],
    gunner: [
      { id: "fire-weapon", type: "action", label: "Fire Weapon", desc: "Activate one of the rig's mounted weapons.",
        handler: async (rig, st) => {
          const ws = weaponsOf(rig);
          if (!ws.length) return cue(rig, st, "Fire Weapon", ["No mounted weapons on this rig."]);
          const id = await pickOne("Fire which weapon?", ws.map(w => ({ id: w.id, label: w.name })));
          const w = ws.find(x => x.id === id);
          if (w) { try { await w.use(); } catch (e) { await cue(rig, st, "Fire Weapon", [`${w.name}: use failed — fire it from the rig sheet.`]); } }
        } },
      { id: "aimed-shot", type: "action+bonus", label: "Aimed Shot", desc: "Spend action AND bonus action: the rig's next weapon attack has advantage.",
        handler: async (rig, st) => {
          await rigAE(rig, "Aimed Shot (advantage, next attack)", [
            { key: "flags.midi-qol.advantage.attack.all", mode: 5, value: "1", priority: 20 },
            { key: "flags.dnd5e.advantage.attack.all", mode: 5, value: "1", priority: 20 },
          ], "next rig weapon attack has advantage", { dae: { specialDuration: ["1Attack"] } });
          await cue(rig, st, "Aimed Shot", ["Next rig weapon attack: <b>advantage</b> (auto with midi; expires after the attack). Costs action + bonus action."]);
        } },
      { id: "suppression", type: "action", label: "Suppression", desc: "Use a weapon to impose its condition rider instead of damage (per the weapon's text — GM adjudicates)." },
      { id: "reload", type: "bonus", label: "Reload", desc: "Refresh a weapon's ammunition or cooldown.",
        handler: async (rig, st) => {
          const ws = weaponsOf(rig).filter(w => Number(get(w, "system.uses.spent", 0)) > 0);
          if (!ws.length) return cue(rig, st, "Reload", ["Nothing needs reloading."]);
          const id = await pickOne("Reload which weapon?", ws.map(w => ({ id: w.id, label: w.name })));
          const w = ws.find(x => x.id === id);
          if (w) { await w.update({ "system.uses.spent": 0 }); await cue(rig, st, "Reload", [`${w.name} reloaded — uses restored.`]); }
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
            const hp = Number(get(rig, "system.attributes.hp.value", 0)) || 0;
            const max = Number(get(rig, "system.attributes.hp.max", 0)) || 0;
            await R().update(rig, { "integrity.value": Math.min(max, hp + heal.total) });
            await cue(rig, st, "Emergency Repair", [`Success (${check.total} vs 15) — hull restored <b>${heal.total}</b> (${Math.min(max, hp + heal.total)}/${max}).`]);
          } else {
            await cue(rig, st, "Emergency Repair", [`Failed (${check.total} vs 15) — the seam doesn't hold this round.`]);
          }
        } },
      { id: "boost-system", type: "bonus", label: "Boost System", desc: "Overdrive one rig system until end of round.",
        handler: async (rig, st) => {
          await rigAE(rig, "System Boosted", [], "one rig system performs at +1 effect step until end of round (GM applies)");
          await cue(rig, st, "Boost System", ["One system runs hot until end of round — +1 effect step (GM applies)."]);
        } },
      { id: "vent-heat", type: "bonus", label: "Vent Heat / Cycle Power", desc: "Reset a weapon or system's cooldown/uses.",
        handler: async (rig, st) => {
          const its = [...weaponsOf(rig), ...systemsOf(rig)].filter(i => Number(get(i, "system.uses.spent", 0)) > 0);
          if (!its.length) return cue(rig, st, "Vent Heat", ["Nothing is overheated or spent."]);
          const id = await pickOne("Cycle which system?", its.map(i => ({ id: i.id, label: i.name })));
          const it = its.find(x => x.id === id);
          if (it) { await it.update({ "system.uses.spent": 0 }); await cue(rig, st, "Vent Heat", [`${it.name} cycled — uses restored.`]); }
        } },
      { id: "counter-sabotage", type: "reaction", label: "Counter-Sabotage", desc: "Cancel a hostile boarding or sabotage attempt (contested check — GM adjudicates)." },
    ],
    crew: [
      { id: "operate-module", type: "action", label: "Operate Module", desc: "Activate a rig system or output module.",
        handler: async (rig, st) => {
          const its = systemsOf(rig).filter(i => Object.keys(i.system?.activities ?? {}).length);
          if (!its.length) return cue(rig, st, "Operate Module", ["No operable modules aboard."]);
          const id = await pickOne("Operate which module?", its.map(i => ({ id: i.id, label: i.name })));
          const it = its.find(x => x.id === id);
          if (it) { try { await it.use(); } catch (e) { await cue(rig, st, "Operate Module", [`${it.name}: use it from the rig sheet.`]); } }
        } },
      { id: "reload-assist", type: "bonus", label: "Assist Reload", desc: "Help a gunner — their next Reload is free (GM adjudicates)." },
      { id: "brace", type: "bonus", label: "Brace", desc: "+1 AC to the rig until end of round.",
        handler: async (rig, st) => {
          await rigAE(rig, "Braced (+1 AC)", [{ key: "system.attributes.ac.bonus", mode: 2, value: "1", priority: 20 }], "+1 AC until end of round");
          await cue(rig, st, "Brace", ["The crew braces — rig +1 AC until end of round."]);
        } },
      { id: "signal", type: "bonus", label: "Signal", desc: "Coordinate — one crewmate gains +1 on their next rig action check (GM applies)." },
      { id: "hold-on", type: "reaction", label: "Hold On!", desc: "When the rig is hit: brace yourself — gain temp HP equal to your PB.",
        handler: async (rig, st) => {
          if (st) {
            const pb = Number(get(st, "system.attributes.prof", 2)) || 2;
            const cur = Number(get(st, "system.attributes.hp.temp", 0)) || 0;
            if (pb > cur) await st.update({ "system.attributes.hp.temp": pb });
            await cue(rig, st, "Hold On!", [`${st.name} braces: ${pb} temp HP against the impact.`]);
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
    if (Array.isArray(frameList) && frameList.length) return all.filter(a => frameList.includes(a.id));
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
      window: { title: `🎛 ${rig.name} — ${steward?.name ?? slot.label} (${role})` },
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
          ${slots.map((s, i) => `<option value="${i}" ${s === slot ? "selected" : ""}>${(s.actorId ? game.actors?.get?.(s.actorId)?.name : null) ?? s.label} · ${s.role}</option>`).join("")}
        </select>`
      : `<span style="font-size:.62rem;opacity:.7;color:#bcd3ff;text-transform:capitalize;white-space:nowrap">${steward?.name ?? slot.label} · ${role}</span>`;

    const bar = document.createElement("div");
    bar.id = "bbttcc-rig-bar";
    bar.style.cssText = `position:fixed;left:50%;transform:translateX(-50%);bottom:88px;z-index:99999;
      display:flex;align-items:center;gap:.35rem;padding:.3rem .6rem;border:1px solid #b9882e;border-radius:8px;
      background:rgba(10,16,32,.92);box-shadow:0 2px 12px rgba(0,0,0,.5);backdrop-filter:blur(3px);
      flex-wrap:wrap;max-width:80vw`;
    bar.innerHTML = `
      <span style="font-size:.72rem;font-weight:700;color:#e8c84a;white-space:nowrap">🛻 ${rig.name}</span>
      ${crewPicker}
      ${bandButtonsHtml(rig, role)}
      <button type="button" data-rig-bar-leave title="Disembark ${steward?.name ?? slot.label}"
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
      strip.innerHTML = `<span style="font-size:.72rem;font-weight:700;color:#e8c84a">🛻 Aboard ${rig.name} · <span style="text-transform:capitalize">${role}</span></span>
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
