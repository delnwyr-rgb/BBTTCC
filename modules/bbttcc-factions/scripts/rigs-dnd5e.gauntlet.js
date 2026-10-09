/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-factions · rigs-dnd5e.gauntlet.js — THE RIG GAUNTLET (dnd5e, GM only)
 * ─────────────────────────────────────────────────────────────────────────────
 *   game.bbttcc.rigs.gauntlet.run()        build the probes, walk every check, chat card + console.table
 *   game.bbttcc.rigs.gauntlet.teardown()   delete the probes (run() tears down at the end anyway)
 *
 * Probes: a scratch faction ("Rig Probe Faction", bank at 0 so turn-output deltas are exact), a
 * scratch steward, a medium hybrid rig made through the accessor, a hexmobile from the rig-builder,
 * and a watchtower from the structures recipes. Mirrors the Crashtest Redshirts harness (bad-eden-5e).
 * ───────────────────────────────────────────────────────────────────────────── */
(() => {
  if (game?.system?.id && game.system.id !== "dnd5e") return;
  const TAG = "[bbttcc-factions/rig-gauntlet]";
  const F = "bbttcc-factions";
  const PFX = "Rig Probe";
  const log = (...a) => console.log(TAG, ...a);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const race = (p, ms = 8000) => Promise.race([p, new Promise(r => setTimeout(() => r("TIMEOUT"), ms))]);

  class Report {
    constructor() { this.rows = []; }
    add(step, ok, detail = "") { this.rows.push({ step, ok: !!ok, detail: String(detail) }); log(`${ok ? "PASS" : "FAIL"} · ${step}${detail ? ` — ${detail}` : ""}`); }
    async step(name, fn) {
      try { const r = await fn(); if (Array.isArray(r)) this.add(name, r[0], r[1]); else this.add(name, r !== false, ""); }
      catch (e) { this.add(name, false, e?.message ?? e); console.error(TAG, name, e); }
    }
    get summary() { const f = this.rows.filter(r => !r.ok).length; return `${this.rows.length - f}/${this.rows.length} passed${f ? `, ${f} FAILED` : ""}`; }
    html() {
      return `<div class="bbttcc-rig-gauntlet"><h3>The Rig Gauntlet</h3><p><b>${this.summary}</b></p><ol style="padding-left:1.2em">${this.rows.map(r =>
        `<li style="color:${r.ok ? "#4caf50" : "#ff5252"}"><b>${r.ok ? "PASS" : "FAIL"}</b> ${foundry.utils.escapeHTML(r.step)}${r.detail ? `<br><small>${foundry.utils.escapeHTML(r.detail)}</small>` : ""}</li>`).join("")}</ol></div>`;
    }
  }

  const probes = () => game.actors.filter(a => a.name.startsWith(PFX) || a.flags?.[F]?.rigProbe);
  async function teardown() {
    const ids = probes().map(a => a.id);
    if (ids.length) await Actor.deleteDocuments(ids);
    log(`torn down ${ids.length} probe actor(s)`);
    return ids.length;
  }

  async function run() {
    if (!game.user?.isGM) return ui.notifications?.warn?.("Rig gauntlet: GM only.");
    const R = game.bbttcc?.rigs;
    if (!R) return ui.notifications?.error?.("Rig gauntlet: game.bbttcc.rigs is missing.");
    await teardown();
    const Rp = new Report();
    const stamp = { [F]: { rigProbe: true } };

    // ── probes ──
    let faction, steward, rig, hexmobile, tower;
    await Rp.step("probe faction + steward exist", async () => {
      faction = await Actor.create({ name: `${PFX} Faction`, type: "character", img: "icons/svg/castle.svg", flags: { [F]: { isFaction: true, rigProbe: true, opBank: {} } } });
      steward = game.actors.find(a => a.name === "Redshirt Fighter") ?? await Actor.create({ name: `${PFX} Steward`, type: "character", flags: stamp });
      return [!!faction && !!steward, `${faction?.name} · steward ${steward?.name}`];
    });

    // ── accessor + runtime wiring ──
    await Rp.step("accessor + dnd5e runtime registered, rig sheet is the vehicle default", () => {
      const impl = Object.keys(R.impl).filter(k => typeof R.impl[k] === "function");
      const def = Object.values(CONFIG.Actor.sheetClasses.vehicle ?? {}).find(s => s.default)?.id;
      return [impl.includes("board") && impl.includes("applyTurnOutput") && def === "bbttcc-factions.BBTTCCRigSheet", `${impl.length} impl fns, default sheet ${def}`];
    });

    // ── create through the accessor ──
    await Rp.step("rigs.create: a medium hybrid rig = vehicle, 60/60 HP, dt 10, owned", async () => {
      rig = await R.create({ name: `${PFX} Barge`, identity: { mobility: "hybrid", archetype: "probe-barge", factionOwnerId: faction.id }, integrity: { bracket: "medium" }, travel: { domains: ["land", "water"] } });
      await rig.update({ flags: stamp });
      const d = R.data(rig);
      return [rig.type === "vehicle" && R.isRig(rig) && d.integrity.max === 60 && d.integrity.value === 60 && rig.system.attributes.hp.dt === 10 && R.ownerOf(rig) === faction.id,
        `${rig.type}, ${d.integrity.value}/${d.integrity.max} dt ${rig.system.attributes.hp.dt}, domains ${d.travel.domains.join("+")}`];
    });
    await Rp.step("rigs.listByFaction finds it; ownerOf honours both owner keys", () => {
      const names = R.listByFaction(faction.id).map(a => a.name);
      return [names.includes(rig.name) && rig.flags?.[F]?.factionId === faction.id, names.join(", ")];
    });

    // ── state machine ──
    await Rp.step("deploy → state deployed; park → parked", async () => {
      await race(R.deploy(rig)); await sleep(200); const s1 = R.data(rig).identity.state;
      await race(R.park(rig)); await sleep(200); const s2 = R.data(rig).identity.state;
      return [s1 === "deployed" && s2 === "parked", `${s1} → ${s2}`];
    });

    // ── integrity ↔ HP, damage hooks ──
    await Rp.step("integrity.value write lands on HP; health() reads it back", async () => {
      await R.update(rig, { "integrity.value": 45 }); await sleep(150);
      return [rig.system.attributes.hp.value === 45 && R.health(rig).value === 45, `hp ${rig.system.attributes.hp.value}, health ${R.health(rig).value}`];
    });
    await Rp.step("combat.applyDamage fires bbttcc:rig:damaged with before/after", async () => {
      let got = null; const id = Hooks.on("bbttcc:rig:damaged", (p) => { if (p?.rig?.id === rig.id) got = p; });
      await race(game.bbttcc.combat.applyDamage(rig, 5, { ignoreResists: true })); await sleep(400); Hooks.off("bbttcc:rig:damaged", id);
      return [!!got && got.after < got.before, got ? `${got.before} → ${got.after}` : "no hook"];
    });
    await Rp.step("HP to 0 fires bbttcc:rig:destroyed; state stays GM-controlled", async () => {
      let got = false; const id = Hooks.on("bbttcc:rig:destroyed", (p) => { if (p?.rig?.id === rig.id) got = true; });
      await R.update(rig, { "integrity.value": 0 }); await sleep(400); Hooks.off("bbttcc:rig:destroyed", id);
      const st = R.data(rig).identity.state;
      await R.update(rig, { "integrity.value": 60 });
      return [got && st !== "destroyed", `destroyed hook ${got}, state ${st}`];
    });

    // ── output per turn through the OP engine ──
    await Rp.step("output + order: outputFor reports the parked rate", async () => {
      await R.update(rig, { "output.basePerTurn": { economy: 2, logistics: 1 }, order: "harvest" }); await sleep(150);
      const o = await R.outputFor(rig);
      return [o?.economy === 2 && o?.logistics === 1, JSON.stringify(o)];
    });
    await Rp.step("applyTurnOutput credits the faction bank in marks (2 econ + 1 log + harvest 1 log = 20/20)", async () => {
      const bank = () => faction.flags?.[F]?.opBank ?? {};
      const b0 = { e: Number(bank().economy) || 0, l: Number(bank().logistics) || 0 };
      const since = game.messages.size;
      await race(R.applyTurnOutput({ quiet: false }), 12000); await sleep(600);
      const b1 = { e: Number(bank().economy) || 0, l: Number(bank().logistics) || 0 };
      const mpo = Number(game.bbttcc?.api?.op?.marksPerOp?.()) || 10;
      const card = game.messages.contents.slice(since).some(m => /Rig output/.test(m.content));
      return [b1.e - b0.e === 2 * mpo && b1.l - b0.l === 2 * mpo && card, `economy +${b1.e - b0.e}, logistics +${b1.l - b0.l} marks; card ${card}`];
    });
    await Rp.step("deployed rig produces half; destroyed produces none", async () => {
      await race(R.deploy(rig)); await sleep(150); const half = await R.outputFor(rig);
      await race(R.park(rig)); await R.update(rig, { "identity.state": "destroyed" }); await sleep(150); const none = await R.outputFor(rig);
      await R.update(rig, { "identity.state": "parked" });
      return [Number(half?.economy) === 1 && !(Number(none?.economy) > 0), `deployed ${JSON.stringify(half)}, destroyed ${JSON.stringify(none)}`];
    });

    // ── boarding ──
    await Rp.step("board the steward as pilot; disembark clears slot + flag", async () => {
      const b = await race(R.board(steward, rig, { role: "pilot" })); await sleep(300);
      const on = R.boardedRigOf(steward)?.rigId === rig.id && R.data(rig).crew.slots.some(s => s.actorId === steward.id);
      const d = await race(R.disembark(steward)); await sleep(300);
      const off = !R.boardedRigOf(steward) && !R.data(rig).crew.slots.some(s => s.actorId === steward.id);
      return [b === true && on && d === true && off, `boarded ${on}, cleared ${off}`];
    });

    // ── the rig-builder starter ──
    await Rp.step("mintFromChassis('hexmobile'): vehicle rig, frame item, 14/14 from the frame, BOM", async () => {
      const RB = game.bbttcc?.api?.rigBuilder; if (!RB?.mintFromChassis) return [false, "no rig builder"];
      const res = await race(RB.mintFromChassis("hexmobile", { factionOwnerId: faction.id, free: true, overrides: { name: `${PFX} Hexmobile` } }), 15000);
      hexmobile = res instanceof Actor ? res : (res?.actor ?? game.actors.getName(`${PFX} Hexmobile`));
      if (!hexmobile) return [false, `mint returned ${typeof res}`];
      await sleep(800); await hexmobile.update({ flags: stamp });
      const d = R.data(hexmobile); const frame = R.frameOf(hexmobile);
      return [hexmobile.type === "vehicle" && !!frame && d.integrity.max === 14 && d.integrity.value === 14 && !!hexmobile.flags?.["bbttcc-structures"]?.materialBOM,
        `${hexmobile.type}, frame ${frame?.name ?? "none"}, ${d.integrity.value}/${d.integrity.max}, BOM ${!!hexmobile.flags?.["bbttcc-structures"]?.materialBOM}`];
    });

    // ── structures ──
    await Rp.step("structures.recipes.build('watchtower'): stationary vehicle rig, dt 15, BOM + plates", async () => {
      const api = game.bbttcc?.api?.structures?.recipes; if (!api?.build) return [false, "no recipes api"];
      const res = await race(api.build("watchtower", faction, { actorName: `${PFX} Watchtower`, skipCostCheck: true, skipToken: true }), 12000);
      tower = res?.actor ?? game.actors.getName(`${PFX} Watchtower`);
      if (!tower) return [false, `build ${res?.ok} ${res?.error ?? ""}`];
      await tower.update({ flags: stamp });
      const d = R.data(tower); const st = tower.flags?.["bbttcc-structures"] ?? {};
      return [tower.type === "vehicle" && d.identity.mobility === "stationary" && tower.system.attributes.hp.dt === 15 && !!st.materialBOM && Number(st.plates?.max) > 0 && R.ownerOf(tower) === faction.id,
        `${d.identity.archetype}, ${d.integrity.value}/${d.integrity.max} dt ${tower.system.attributes.hp.dt}, plates ${st.plates?.current}/${st.plates?.max}`];
    });
    await Rp.step("retypeFortification clears the crew slots on the tower", async () => {
      const fn = game.bbttcc?.api?.structures?.crew?.retypeFortification; if (!fn) return [false, "no retypeFortification"];
      await race(fn(tower)); await sleep(150);
      const c = R.data(tower).crew;
      return [Array.isArray(c.slots) && c.slots.length === 0 && Number(c.crewMax) === 0, `slots ${c.slots.length}, crewMax ${c.crewMax}`];
    });

    // ── sheets ──
    await Rp.step("the rig sheet renders a Rig tab; the structures panel injects on the tower", async () => {
      const app = tower.sheet; await app.render(true); await sleep(2200);
      const el = app.element instanceof HTMLElement ? app.element : app.element?.[0];
      const tab = !!el?.querySelector(".bbttcc-rig-tab"); const panel = !!el?.querySelector(".bbttcc-structures-panel");
      await app.close();
      return [app.constructor.name === "BBTTCCRigSheet" && tab && panel, `${app.constructor.name}: rig tab ${tab}, structures panel ${panel}`];
    });

    // ── done ──
    await teardown();
    const html = Rp.html();
    await ChatMessage.create({ content: html, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Rig Gauntlet" } });
    console.table(Rp.rows);
    log(Rp.summary);
    return Rp;
  }

  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e" || !game.bbttcc?.rigs) return;
    game.bbttcc.rigs.gauntlet = { run, teardown };
    console.log(TAG, "ready — game.bbttcc.rigs.gauntlet.run()");
  });
})();
