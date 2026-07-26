/* =========================================================================
 * Bad Eden — Rig Chase Primitive (bbttcc-travel/scripts/chase.js)
 * =========================================================================
 * A contested pursuit across 3-5 "legs" of shifting terrain, run by the GM
 * from a Chase Console. Reuses the travel stack end-to-end:
 *   - terrain identity/bias   → game.bbttcc.api._hexTravel.TERRAIN_TABLE
 *   - movement-domain gating  → game.bbttcc.api.travel.domains.*
 *   - rig pace                → rig system.travel.speed (hexes) + hazardResist
 *   - pilot handling          → steward `piloting` via game.fourththing.rolls.skillCheck
 *   - gambit costs            → game.bbttcc.api.op.commit (1 OP = 10 marks)
 *   - damage                  → game.bbttcc.combat.applyDamage (integrity)
 *
 * MODEL — the Lead meter is the quarry's gap:
 *   lead <= 0        → CAUGHT
 *   lead >= escapeAt → ESCAPED
 *   route exhausted  → ESCAPED (the quarry outran the pursuit's window)
 * Each leg both sides roll Pace; the margin shifts Lead by 0/1/2 (+1 on
 * shortcut terrain). Terrain bias flavors the leg:
 *   hazard    → −2 Pace to any rig without hazardResist; loser scrapes 1d4
 *   combat    → ambush lane; loser's rig takes 1d6+tier integrity
 *   discovery → shortcut; a decisive winner shifts Lead +1 extra
 *   extreme   → hazard + combat effects, and decisive threshold drops to 3
 *   mix       → rolls one of hazard/combat/discovery per leg
 * Domain gates are chase tactics: if the pursuer can't enter a leg's medium
 * the quarry escapes outright; if the quarry can't, it's cornered (−2 Lead).
 *
 * API (GM-only mutations): game.bbttcc.api.travel.chase
 *   .start({quarry, pursuer, route, lead, escapeAt, label, playerSide, open})
 *       side spec: {factionId} | {rigId} | {name, speed, bonus, tier, domains}
 *       route entries: "terrainKey" | hex uuid/Drawing | {terrainKey}|{hexUuid}
 *   .runLeg({quarryGambits:[], pursuerGambits:[]})   .end(outcome, note)
 *   .state()   .open()
 *
 * BEAT SEAM (same contract style as bbttcc-gate-beat-listener):
 *   beat.chase = { quarry:{factionId:"..."}, pursuer:{name:"Raider Buggies",
 *     speed:3, bonus:2}, route:["badlands","badlands","river"], lead:3 }
 *   → fired on Hooks "bbttcc:beat:resolved", GM client only.
 * Emits Hooks.callAll("bbttcc:chase:resolved", {state, outcome}) when done.
 * ========================================================================= */
(() => {
  const MOD = "bbttcc-travel";
  const FCT = "bbttcc-factions";
  const SETTING = "activeChase";
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

  const TERRAIN_LABELS = {
    plains: "Plains", grasslands: "Grasslands", forest: "Forest", jungle: "Jungle",
    mountains: "Mountains", highlands: "Highlands", canyons: "Canyons", badlands: "Badlands",
    swamp: "Swamp", mire: "Mire", desert: "Desert", ashWastes: "Ash Wastes",
    river: "River", lake: "Lake", sea: "Sea", ocean: "Ocean",
    reef: "Reef", depths: "Depths", abyss: "Abyss",
    sky: "Open Sky", stratosphere: "Stratosphere", orbit: "Orbit",
    ruins: "Ruins", urbanWreckage: "Urban Wreckage", wasteland: "Wasteland", radiation: "Radiation Zone"
  };
  const BIAS_LABELS = {
    balanced: "open running", hazard: "hazard run", combat: "ambush lane",
    discovery: "shortcut country", mix: "broken ground", extreme: "death run"
  };
  const GAMBITS = {
    redline: { label: "🔥 Redline",  bucket: "economy",  hint: "+2 Pace this leg; your rig takes 1d4 strain after." },
    potshot: { label: "🧨 Potshot",  bucket: "violence", hint: "Win the leg → the loser's rig takes an extra 1d6+tier." },
    feint:   { label: "🕳️ Feint",    bucket: "intrigue", hint: "Opponent −2 Pace this leg." }
  };
  const GAMBIT_COST_MARKS = 10; // 1 OP

  /* ---------------------------------------------------------------- utils */
  const api = () => game.bbttcc?.api;
  const domainsApi = () => api()?.travel?.domains;
  const hexApi = () => api()?._hexTravel;
  const isGM = () => !!game.user?.isGM;
  const gmIds = () => game.users.filter(u => u.isGM).map(u => u.id);
  const rigSys = (rig) => rig?.system?.system ?? rig?.system ?? {};

  function normKey(k) {
    const raw = String(k ?? "").trim();
    if (!raw) return null;
    const table = hexApi()?.TERRAIN_TABLE ?? {};
    if (table[raw]) return raw;
    const squash = raw.toLowerCase().replace(/[\s_-]+/g, "");
    for (const key of Object.keys(table)) if (key.toLowerCase() === squash) return key;
    const alias = { canyon: "canyons", badland: "badlands", marsh: "swamp", ashwastes: "ashWastes",
      urbanwreckage: "urbanWreckage", city: "urbanWreckage", deep: "depths", space: "orbit" };
    return alias[squash] ?? null;
  }

  function requiredDomainsForLeg(leg) {
    // Mirrors hex-travel requiredDomainsForTerrain, driven off leg.medium/depthBand.
    const medium = (leg.medium ?? "land").toLowerCase();
    if (medium === "water") {
      return (leg.depthBand && leg.depthBand !== "surface")
        ? ["water-sub"]
        : ["water-surface", "water-sub", "air", "space"];
    }
    if (medium === "air") return ["air", "space"];
    if (medium === "space") return ["space"];
    return null; // land — everyone qualifies
  }

  function sideCanEnter(side, leg) {
    const req = requiredDomainsForLeg(leg);
    if (!req) return true;
    return (side.domains ?? ["land"]).some(d => req.includes(d));
  }

  async function quietRoll(formula) {
    const r = await new Roll(formula).evaluate();
    return r;
  }

  /* ------------------------------------------------------ side resolution */
  async function normalizeSide(spec = {}, fallbackName) {
    const side = {
      name: spec.name ?? fallbackName, factionId: spec.factionId ?? null,
      rigId: null, rigName: null, speed: Number(spec.speed ?? 2),
      tier: Number(spec.tier ?? 1), bonus: Number(spec.bonus ?? 0),
      hazardResist: Number(spec.hazardResist ?? 0),
      pilotId: null, pilotName: null,
      domains: Array.isArray(spec.domains) && spec.domains.length ? spec.domains : ["land"],
      gambitsUsed: {}
    };

    let rig = null;
    if (spec.rigId) {
      rig = game.actors.get(spec.rigId) ?? (spec.rigId.includes(".") ? fromUuidSync(spec.rigId) : null);
      if (rig?.documentName === "Token") rig = rig.actor;
    } else if (spec.factionId) {
      const rigs = domainsApi()?.factionRigs?.(spec.factionId) ?? [];
      // fastest mobile rig carries the chase
      rig = rigs.slice().sort((a, b) =>
        Number(rigSys(b)?.travel?.speed ?? 0) - Number(rigSys(a)?.travel?.speed ?? 0))[0] ?? null;
    }

    if (rig) {
      const sys = rigSys(rig);
      side.rigId = rig.id;
      side.rigName = rig.name;
      side.factionId = side.factionId ?? sys?.identity?.factionOwnerId ?? rig.flags?.[FCT]?.factionId ?? null;
      side.speed = Number(spec.speed ?? sys?.travel?.speed ?? 2);
      side.tier = Number(spec.tier ?? sys?.integrity?.tier ?? 1);
      side.hazardResist = Number(spec.hazardResist ?? sys?.travel?.hazardResist ?? 0);
      side.domains = Array.isArray(spec.domains) && spec.domains.length
        ? spec.domains
        : (domainsApi()?.rigDomains?.(rig) ?? ["land"]);
      const pilotSlot = (sys?.crew?.slots ?? []).find(s => s?.role === "pilot" && s?.actorId);
      const pilot = pilotSlot ? game.actors.get(pilotSlot.actorId) : null;
      if (pilot) { side.pilotId = pilot.id; side.pilotName = pilot.name; }
    }

    if (!side.name) {
      const faction = side.factionId ? game.actors.get(side.factionId) : null;
      side.name = faction?.name ?? side.rigName ?? fallbackName;
    }
    return side;
  }

  /* ----------------------------------------------------- route resolution */
  async function normalizeRoute(route = []) {
    const table = hexApi()?.TERRAIN_TABLE ?? {};
    const legs = [];
    for (const entry of route) {
      let terrainKey = null, hexUuid = null, hexLabel = null;

      if (typeof entry === "string" && (entry.startsWith("Scene.") || entry.startsWith("Drawing."))) {
        hexUuid = entry;
      } else if (typeof entry === "string") {
        terrainKey = normKey(entry);
      } else if (entry && typeof entry === "object") {
        hexUuid = entry.hexUuid ?? entry.uuid ?? null;
        terrainKey = entry.terrainKey ? normKey(entry.terrainKey) : null;
        hexLabel = entry.label ?? null;
      }

      if (hexUuid && !terrainKey) {
        try {
          const doc = fromUuidSync(hexUuid);
          const spec = hexApi()?.getHexTerrainSpec?.(doc);
          terrainKey = spec?.key ?? null;
          hexLabel = hexLabel ?? (doc?.text ?? doc?.name ?? null);
          if (hexLabel) hexLabel = String(hexLabel).replace(/[\s ]+/g, " ").trim();
        } catch (e) { console.warn(`[${MOD}] chase: could not resolve hex`, hexUuid, e); }
      }

      if (!terrainKey || !table[terrainKey]) {
        console.warn(`[${MOD}] chase: skipping unresolvable route entry`, entry);
        continue;
      }
      const spec = table[terrainKey];
      legs.push({
        terrainKey, hexUuid, hexLabel,
        tier: Number(spec.tier ?? 1),
        bias: String(spec.bias ?? "balanced"),
        medium: spec.medium ?? "land",
        depthBand: spec.depthBand ?? null,
        label: TERRAIN_LABELS[terrainKey] ?? terrainKey
      });
    }
    return legs;
  }

  /* ------------------------------------------------------------- persist */
  function saveState(state) {
    return game.settings.set(MOD, SETTING, state ?? null);
  }
  function loadState() {
    const s = game.settings.get(MOD, SETTING);
    return (s && s.status === "active") ? s : null;
  }
  let CHASE = null; // in-memory working copy (GM client)

  /* ------------------------------------------------------------ chat cards */
  function leadPips(state) {
    const filled = Math.max(0, Math.min(state.lead, state.escapeAt));
    return "●".repeat(filled) + "○".repeat(Math.max(0, state.escapeAt - filled));
  }
  function publicCard(html) {
    return ChatMessage.create({ content: `<div class="fourththing-roll">${html}</div>` });
  }
  function gmCard(title, bodyHtml) {
    return ChatMessage.create({
      speaker: { alias: "Bad Eden Travel" },
      whisper: gmIds(),
      flavor: `<section class="bbttcc-chase"><h3>${esc(title)}</h3>${bodyHtml}</section>`
    });
  }

  async function warLog(factionId, summary) {
    try {
      const f = factionId ? game.actors.get(factionId) : null;
      if (!f) return;
      const logs = foundry.utils.duplicate(f.getFlag(FCT, "warLogs") ?? []);
      logs.push({ type: "chase", date: new Date().toLocaleString(), summary });
      await f.setFlag(FCT, "warLogs", logs);
    } catch (e) { console.warn(`[${MOD}] chase warLog failed`, e); }
  }

  /* -------------------------------------------------------------- pacing */
  async function rollPace(side, leg, mods, state) {
    const parts = [];
    let rollTotal = 0;
    const pilot = side.pilotId ? game.actors.get(side.pilotId) : null;

    if (pilot && game.fourththing?.rolls?.skillCheck) {
      const res = await game.fourththing.rolls.skillCheck(pilot, {
        skill: "piloting",
        label: `Piloting — ${state.label ?? "Chase"} · ${leg.label}`
      });
      if (res?.total != null) {
        rollTotal = Number(res.total);
        parts.push(`piloting ${rollTotal}${res.isFumble ? " (FUMBLE)" : ""}`);
        if (res.isFumble) { mods -= 2; parts.push("fumble −2"); }
      }
    }
    if (!parts.length) {
      const r = await quietRoll(`2d10 + ${side.tier}`);
      rollTotal = r.total;
      parts.push(`2d10+tier ${rollTotal}`);
    }

    const speedBonus = side.speed * 2;
    parts.push(`speed +${speedBonus}`);
    if (side.bonus) parts.push(`mod ${side.bonus >= 0 ? "+" : ""}${side.bonus}`);
    if (mods) parts.push(`leg ${mods >= 0 ? "+" : ""}${mods}`);

    return { total: rollTotal + speedBonus + side.bonus + mods, breakdown: parts.join(" · ") };
  }

  async function chargeGambit(side, key) {
    const g = GAMBITS[key];
    if (!g || side.gambitsUsed[key]) return { ok: false, reason: "used" };
    if (side.factionId && api()?.op?.commit) {
      const res = await api().op.commit(side.factionId, { [g.bucket]: -GAMBIT_COST_MARKS },
        { context: "chase-gambit", gambit: key });
      if (!res?.ok) return { ok: false, reason: "op-refused" };
    }
    side.gambitsUsed[key] = true;
    return { ok: true };
  }

  async function applyRigDamage(side, formula, flavor, lines) {
    try {
      const rig = side.rigId ? game.actors.get(side.rigId) : null;
      const r = await quietRoll(formula);
      if (!rig) { lines.push(`${side.name} is rattled (${flavor}, ${r.total} shaken off — no rig actor).`); return; }
      const msg = await game.bbttcc.combat.applyDamage(rig, r.total,
        { track: "integrity", damageType: "kinetic", damageFlavor: flavor });
      lines.push(typeof msg === "string" ? msg : `${rig.name}: −${r.total} integrity (${flavor})`);
    } catch (e) {
      console.warn(`[${MOD}] chase damage failed`, e);
      lines.push(`${side.name}: damage (${flavor}) could not be applied — see console.`);
    }
  }

  /* --------------------------------------------------------------- runLeg */
  async function runLeg({ quarryGambits = [], pursuerGambits = [] } = {}) {
    if (!isGM()) return void ui.notifications?.warn("Chase: GM only.");
    const state = CHASE ?? loadState();
    if (!state) return void ui.notifications?.warn("No active chase.");
    CHASE = state;
    const leg = state.legs[state.legIndex];
    if (!leg) return endChase("escaped", "Route exhausted.");

    const lines = [];
    const Q = state.quarry, P = state.pursuer;

    // --- resolve "mix" bias into a concrete flavor for this leg
    let bias = leg.bias;
    if (bias === "mix") {
      const pick = (await quietRoll("1d3")).total;
      bias = ["hazard", "combat", "discovery"][pick - 1];
      lines.push(`Broken ground breaks ${BIAS_LABELS[bias]} this leg.`);
    }
    const decisiveAt = bias === "extreme" ? 3 : 5;

    // --- domain gates: the chase-breaking move
    const qOk = sideCanEnter(Q, leg), pOk = sideCanEnter(P, leg);
    if (!pOk && qOk) {
      lines.push(`${P.name} cannot follow into ${leg.label} — the pursuit breaks off at the edge.`);
      state.log.unshift({ leg: state.legIndex + 1, text: lines.map(esc).join(" ") });
      return endChase("escaped", `${Q.name} escaped into ${leg.label} — ${P.name} lacked the domain to follow.`);
    }
    if (!qOk) {
      state.lead = Math.max(0, state.lead - 2);
      lines.push(`${Q.name} is walled off by ${leg.label} and loses ground scrambling along the edge (Lead −2).`);
      state.legIndex++;
      return finishLeg(state, leg, bias, lines, null);
    }

    // --- gambits (charge first; refused OP = fizzle)
    const armed = { quarry: [], pursuer: [] };
    for (const [sideKey, side, list] of [["quarry", Q, quarryGambits], ["pursuer", P, pursuerGambits]]) {
      for (const key of list) {
        const res = await chargeGambit(side, key);
        if (res.ok) armed[sideKey].push(key);
        else lines.push(`${side.name}'s ${GAMBITS[key]?.label ?? key} fizzles (${res.reason === "op-refused" ? "OP refused" : "already spent"}).`);
      }
    }
    const has = (sideKey, key) => armed[sideKey].includes(key);

    // --- per-side leg modifiers
    const hazardLeg = bias === "hazard" || bias === "extreme";
    const modsFor = (sideKey, side, other) => {
      let m = 0;
      if (hazardLeg && side.hazardResist < 1) m -= 2;
      if (has(sideKey, "redline")) m += 2;
      const otherKey = sideKey === "quarry" ? "pursuer" : "quarry";
      if (has(otherKey, "feint")) m -= 2;
      return m;
    };

    const qPace = await rollPace(Q, leg, modsFor("quarry", Q, P), state);
    const pPace = await rollPace(P, leg, modsFor("pursuer", P, Q), state);
    const margin = qPace.total - pPace.total;

    let shift = 0;
    if (margin !== 0) shift = Math.abs(margin) >= decisiveAt ? 2 : 1;
    if (bias === "discovery" && Math.abs(margin) >= decisiveAt && shift) shift += 1; // shortcut country
    const quarryWon = margin > 0;
    if (shift) state.lead = quarryWon ? state.lead + shift : Math.max(0, state.lead - shift);

    lines.push(`${Q.name} pace ${qPace.total} (${qPace.breakdown}) vs ${P.name} pace ${pPace.total} (${pPace.breakdown}).`);
    lines.push(margin === 0
      ? "Dead heat — the gap holds."
      : `${quarryWon ? Q.name : P.name} takes the leg by ${Math.abs(margin)} → Lead ${quarryWon ? "+" : "−"}${shift}.`);

    // --- consequences
    const loserKey = margin === 0 ? null : (quarryWon ? "pursuer" : "quarry");
    const loser = loserKey === "quarry" ? Q : loserKey === "pursuer" ? P : null;
    const winnerKey = loserKey === "quarry" ? "pursuer" : "quarry";
    const winner = loser === Q ? P : Q;
    if (loser) {
      if ((bias === "combat" || bias === "extreme")) await applyRigDamage(loser, `1d6 + ${winner.tier}`, "chase — ambush lane", lines);
      if (hazardLeg && loser.hazardResist < 1) await applyRigDamage(loser, "1d4", "chase — terrain hazard", lines);
      if (has(winnerKey, "potshot")) await applyRigDamage(loser, `1d6 + ${winner.tier}`, "chase — potshot", lines);
    }
    for (const [sideKey, side] of [["quarry", Q], ["pursuer", P]]) {
      if (has(sideKey, "redline")) await applyRigDamage(side, "1d4", "chase — redlined engine", lines);
    }

    state.legIndex++;
    return finishLeg(state, leg, bias, lines, { qPace, pPace, margin });
  }

  async function finishLeg(state, leg, bias, lines, detail) {
    const safeLines = lines.map(esc);
    state.log.unshift({ leg: state.legIndex, terrain: leg.label, bias, text: safeLines.join("<br>") });

    // public beat-by-beat card
    await publicCard(
      `<b style="color:#ffd24a;">🏁 ${esc(state.label ?? "Chase")} — Leg ${state.legIndex}/${state.legs.length}: ${esc(leg.label)}</b> ` +
      `<i>(${esc(BIAS_LABELS[bias] ?? bias)})</i><br>` +
      `${safeLines.join("<br>")}<br>` +
      `<b>Lead:</b> <span style="letter-spacing:2px;color:#4cf5ff">${leadPips(state)}</span> (${state.lead}/${state.escapeAt})`
    );

    if (state.lead <= 0) return endChase("caught", `${state.pursuer.name} runs ${state.quarry.name} to ground.`);
    if (state.lead >= state.escapeAt) return endChase("escaped", `${state.quarry.name} breaks clean away.`);
    if (state.legIndex >= state.legs.length) return endChase("escaped", `${state.quarry.name} outlasts the pursuit — route exhausted.`);

    await saveState(state);
    redrawConsole();
    return state;
  }

  /* ------------------------------------------------------------------ end */
  async function endChase(outcome, note = "") {
    if (!isGM()) return void ui.notifications?.warn("Chase: GM only.");
    const state = CHASE ?? loadState();
    if (!state) return;
    state.status = "done";
    state.outcome = outcome;

    const flavor = outcome === "caught" ? "🪤 CAUGHT" : outcome === "escaped" ? "💨 ESCAPED" : "🏳️ CHASE ENDS";
    const color = outcome === "caught" ? "#ff7b7b" : "#4cf5ff";
    await publicCard(`<b style="color:${color};">${flavor}</b> — ${esc(note || state.label || "The chase is over.")}`);
    await gmCard(`Chase resolved — ${outcome}`,
      `<p>${esc(note)}</p><p>${esc(state.quarry.name)} vs ${esc(state.pursuer.name)} · ` +
      `${state.legIndex}/${state.legs.length} legs · final Lead ${state.lead}/${state.escapeAt}</p>` +
      (state.log.length ? `<hr>${state.log.map(l => `<p><b>Leg ${l.leg}${l.terrain ? ` — ${esc(l.terrain)}` : ""}:</b> ${l.text}</p>`).join("")}` : ""));

    const summary = `Chase (${state.label ?? "unnamed"}): ${state.quarry.name} vs ${state.pursuer.name} — ${outcome}. ${note}`;
    await warLog(state.quarry.factionId, summary);
    if (state.pursuer.factionId !== state.quarry.factionId) await warLog(state.pursuer.factionId, summary);

    await saveState(null);
    CHASE = null;
    redrawConsole();
    Hooks.callAll("bbttcc:chase:resolved", { state, outcome, note });
    return state;
  }

  /* ---------------------------------------------------------------- start */
  async function startChase(config = {}) {
    if (!isGM()) return void ui.notifications?.warn("Chase: GM only.");
    if (loadState()) {
      ui.notifications?.warn("A chase is already active — end it first (Chase Console).");
      openConsole();
      return null;
    }
    const legs = await normalizeRoute(config.route ?? []);
    if (!legs.length) return void ui.notifications?.error("Chase: route resolved to zero legs.");

    const quarry = await normalizeSide(config.quarry ?? {}, "The Quarry");
    const pursuer = await normalizeSide(config.pursuer ?? {}, "The Pursuit");
    const escapeAt = Math.max(2, Number(config.escapeAt ?? 6));
    const lead = Math.min(escapeAt - 1, Math.max(1, Number(config.lead ?? 3)));

    const state = {
      id: foundry.utils.randomID(), status: "active",
      label: config.label ?? `${quarry.name} vs ${pursuer.name}`,
      playerSide: config.playerSide ?? "quarry",
      quarry, pursuer, lead, escapeAt, legIndex: 0, legs, log: []
    };
    CHASE = state;
    await saveState(state);

    await publicCard(
      `<b style="color:#ffd24a;">🏁 CHASE ON — ${esc(state.label)}</b><br>` +
      `${esc(quarry.name)}${quarry.rigName ? ` (${esc(quarry.rigName)})` : ""} runs; ` +
      `${esc(pursuer.name)}${pursuer.rigName ? ` (${esc(pursuer.rigName)})` : ""} hunts.<br>` +
      `Route: ${legs.map(l => esc(l.label)).join(" → ")}<br>` +
      `<b>Lead:</b> <span style="letter-spacing:2px;color:#4cf5ff">${leadPips(state)}</span> (${lead}/${escapeAt})`
    );
    if (config.open !== false) openConsole();
    return state;
  }

  /* -------------------------------------------------------- Chase Console */
  let UI = null; // { dialog, root }

  function gambitBoxes(sideKey, side) {
    return Object.entries(GAMBITS).map(([key, g]) => {
      const used = !!side.gambitsUsed[key];
      const funded = side.factionId ? ` (1 OP ${g.bucket})` : "";
      return `<label style="display:block;font-size:0.8rem;${used ? "opacity:0.4;" : ""}" title="${esc(g.hint)}">
        <input type="checkbox" data-gambit="${sideKey}:${key}" ${used ? "disabled" : ""}/> ${g.label}${funded}
      </label>`;
    }).join("");
  }

  function renderBody() {
    const state = CHASE ?? loadState();
    if (!state) return `<p style="opacity:0.7">No active chase. Start one via <code>game.bbttcc.api.travel.chase.start(...)</code>, the Start Chase macro, or a beat's <code>chase</code> payload.</p>`;
    const leg = state.legs[state.legIndex];
    const sideRow = (side, tag) =>
      `<div style="flex:1;min-width:220px;">
        <div style="color:#ffd24a;font-weight:700">${esc(tag)} — ${esc(side.name)}</div>
        <div style="font-size:0.82rem;color:#bcd3ff">
          ${side.rigName ? `🛻 ${esc(side.rigName)} · ` : ""}spd ${side.speed} · T${side.tier}` +
          `${side.hazardResist ? ` · hazresist ${side.hazardResist}` : ""}` +
          `${side.pilotName ? ` · 🧑‍✈️ ${esc(side.pilotName)}` : " · <i>no pilot</i>"}
        </div>
        <div style="margin-top:4px">${gambitBoxes(tag === "QUARRY" ? "quarry" : "pursuer", side)}</div>
      </div>`;

    return `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
        ${sideRow(state.quarry, "QUARRY")}${sideRow(state.pursuer, "PURSUIT")}
      </div>
      <div style="text-align:center;margin:6px 0 10px">
        <span style="font-size:1.4rem;letter-spacing:4px;color:#4cf5ff">${leadPips(state)}</span>
        <div style="font-size:0.78rem;color:#9fb3d9">Lead ${state.lead} / escape at ${state.escapeAt} · caught at 0</div>
      </div>
      <div style="border:1px solid rgba(115,179,255,0.35);border-radius:8px;padding:6px 10px;margin-bottom:8px">
        ${leg
          ? `<b style="color:#ffd24a">Leg ${state.legIndex + 1}/${state.legs.length} — ${esc(leg.label)}</b>
             <i style="color:#9fb3d9">(${esc(BIAS_LABELS[leg.bias] ?? leg.bias)}${leg.hexLabel ? ` · ${esc(leg.hexLabel)}` : ""})</i>
             <div style="font-size:0.78rem;color:#9fb3d9;margin-top:2px">
               Ahead: ${state.legs.slice(state.legIndex).map(l => esc(l.label)).join(" → ") || "—"}
             </div>`
          : `<i>Route exhausted.</i>`}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" data-action="chase-run" style="flex:2">▶ Run Leg</button>
        <button type="button" data-action="chase-caught" title="End now: quarry caught">🪤 Caught</button>
        <button type="button" data-action="chase-escaped" title="End now: quarry escapes">💨 Escaped</button>
        <button type="button" data-action="chase-abort" title="End with no outcome">🏳️ Abort</button>
      </div>
      <div class="chase-log" style="max-height:180px;overflow-y:auto;font-size:0.8rem;border-top:1px solid rgba(115,179,255,0.25);padding-top:6px">
        ${state.log.map(l => `<p style="margin:0 0 6px"><b style="color:#ffd24a">Leg ${l.leg}${l.terrain ? ` — ${esc(l.terrain)}` : ""}:</b><br>${l.text}</p>`).join("") || "<i style='opacity:0.6'>No legs run yet.</i>"}
      </div>`;
  }

  function bindConsole(root) {
    const body = root.querySelector(".bbttcc-chase-body");
    if (!body) return;
    const readGambits = (sideKey) =>
      [...body.querySelectorAll(`[data-gambit^="${sideKey}:"]`)]
        .filter(cb => cb.checked && !cb.disabled)
        .map(cb => cb.dataset.gambit.split(":")[1]);
    const wire = (action, fn) => {
      const btn = body.querySelector(`[data-action="${action}"]`);
      if (!btn) return;
      btn.onclick = async () => {
        btn.disabled = true;
        try { await fn(); } catch (e) { console.error(`[${MOD}] chase console`, e); ui.notifications?.error(`Chase: ${e?.message ?? e}`); }
        btn.disabled = false;
      };
    };
    wire("chase-run", () => runLeg({ quarryGambits: readGambits("quarry"), pursuerGambits: readGambits("pursuer") }));
    wire("chase-caught", () => endChase("caught", "GM ruling."));
    wire("chase-escaped", () => endChase("escaped", "GM ruling."));
    wire("chase-abort", () => endChase("aborted", "Chase called off."));
  }

  function redrawConsole() {
    if (!UI?.root?.isConnected) return;
    const body = UI.root.querySelector(".bbttcc-chase-body");
    if (!body) return;
    body.innerHTML = renderBody();
    bindConsole(UI.root);
  }

  function openConsole() {
    if (!isGM()) return void ui.notifications?.warn("Chase Console is GM-only.");
    if (UI?.root?.isConnected) { redrawConsole(); UI.dialog.bringToTop?.(); return UI.dialog; }
    const dlg = new Dialog({
      title: "🏁 Bad Eden: Chase Console",
      content: `<div class="bbttcc-chase-body">${renderBody()}</div>`,
      buttons: { close: { label: "Close" } },
      render: (html) => {
        const root = html[0] ?? html;
        UI = { dialog: dlg, root };
        bindConsole(root);
      },
      close: () => { UI = null; }
    }, { width: 640, resizable: true });
    dlg.render(true);
    return dlg;
  }

  /* --------------------------------------------------------- registration */
  function register() {
    try {
      game.settings.register(MOD, SETTING, { scope: "world", config: false, type: Object, default: null });
    } catch (e) { /* already registered */ }

    game.bbttcc = game.bbttcc ?? {};
    game.bbttcc.api = game.bbttcc.api ?? {};
    game.bbttcc.api.travel = game.bbttcc.api.travel ?? {};
    game.bbttcc.api.travel.chase = {
      start: startChase, runLeg, end: endChase, open: openConsole,
      state: () => CHASE ?? loadState(),
      _consts: { GAMBITS, TERRAIN_LABELS, BIAS_LABELS }
    };

    // Beat seam — same contract style as bbttcc-gate-beat-listener:
    // author `beat.chase = {quarry, pursuer, route, lead, escapeAt, label}` on any beat.
    Hooks.on("bbttcc:beat:resolved", ({ beat } = {}) => {
      try {
        if (!beat?.chase || !game.user?.isGM) return;
        startChase(beat.chase);
      } catch (e) { console.error(`[${MOD}] chase beat listener`, e); }
    });

    // Reload resilience: nudge the GM if a chase was mid-flight.
    if (isGM() && loadState()) {
      ui.notifications?.info("🏁 A chase is still in progress — Chase Console reopened.");
      openConsole();
    }
    console.log(`[${MOD}] chase primitive ready (api.travel.chase)`);
  }

  if (game?.ready) register();
  else Hooks.once("ready", register);
})();
