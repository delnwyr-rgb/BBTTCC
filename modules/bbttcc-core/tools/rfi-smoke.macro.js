/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-core · tools/rfi-smoke.macro.js — THE RFI SMOKE (fourththing regression harness)
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE
 *   Ember (the RFI world, system `fourththing`) runs an older copy of 40 shared
 *   module files. HEAD adds the rig port (game.bbttcc.rigs accessor + consumers
 *   migrated off raw actor.system rig reads + dnd5e-only rig runtime files), the
 *   D&D-parity pass (game.bbttcc.dice / types / aeKey / aeChanges, combat.heal,
 *   raid post-round ordering via the lifecycle contract, Mal agent registry) and
 *   66fb5eb (game.bbttcc.packs twins, tikkun spark resolution, beat editor,
 *   npc-dialogue). On fourththing all of that must be VALUE-IDENTICAL to the old
 *   behaviour. This harness walks every hunk of that gap after a deploy and says
 *   PASS / FAIL / WARN / SKIP per step, with the file(s) each step covers.
 *
 * HOW TO RUN
 *   GM seat, in the RFI world, AFTER `bin/ft-deploy … && pm2 restart` and a full
 *   client cache bust (core + factions module.json changed):
 *     1. paste this whole file into the browser console (F12), or make a Script
 *        Macro of it and execute it;
 *     2. read the GM-whispered chat card + console.table; the full result is on
 *        `window.__rfiSmoke` ({ rows, summary, errors, ... }).
 *   READ-ONLY by default: it inspects data, calls pure functions, compares the
 *   accessor against raw `actor.system`, renders a couple of sheets and closes
 *   them. It never advances the turn, never touches settings / scenes / campaign
 *   state, and never writes to an existing actor.
 *   Set RFI_SMOKE_WRITES = true (below) to ALSO run the write probes: they create
 *   throwaway actors named "RFI Smoke Probe *", exercise the write paths
 *   (rigs.create / setOwner / update, retypeFortification, siege capture patch,
 *   townbuilder binding, rig-builder mintFromChassis, radiation mutation AE) and
 *   delete every probe they made in a finally block. Owner ids used by the
 *   probes are fake strings, so no real faction is ever touched.
 *   RFI_SMOKE_RENDER = false skips the sheet render/close steps.
 *   The only document this creates in read-only mode is the summary ChatMessage
 *   (GM whisper) — set RFI_SMOKE_CHAT = false to suppress it.
 *
 * COVERAGE (46 files: 40 behind Ember + 6 new) → step ids
 *   file                                                         steps
 *   ───────────────────────────────────────────────────────────  ──────────────────────────
 *   auto-link/scripts/monster-builder.js                          S01 AL2
 *   auto-link/scripts/rig-builder.js                              S02 AL1 AL3 W7 W8
 *   banks/scripts/loot.js                                         S03 L1 L2
 *   campaign/apps/campaign-beat-editor.js                         S04 C3
 *   campaign/scripts/world-mutation-engine.js                     S05 C1 C2
 *   character-options/scripts/enlightenment.js                    S06 AE1 AE2
 *   core/module.json                                              S07 B2
 *   core/scripts/combat.dnd5e.js                                  S08 D4  (load-only: dormant on fourththing, gate checked by D4)
 *   core/scripts/dice.js                                          S09 B3 B4 B5 DC1 DC2 DC3 DC4
 *   core/scripts/module.js                                        S10 B6 B7
 *   factions/module.json                                          S11 B2
 *   factions/scripts/module.js                                    S12 F1 F2 F3
 *   factions/scripts/stockpile-api.js                             S13 F4
 *   mal-voice/scripts/module.js                                   S14 A2
 *   mal-voice/scripts/npc-dialogue.js                             S15 N1
 *   market/scripts/market.js                                      S16 M1 W10
 *   onboarding/scripts/tour-defs.js                               S17 OB1
 *   radiation/scripts/bbttcc-radiation-mutations.enhancer.js      S18 AE1 AE2 AE3 W9
 *   raid/scripts/agent-registry.js                                S19 A1 B7
 *   raid/scripts/orbital-strike.js                                S20 O1 W2
 *   raid/scripts/raid-morale.enhancer.js                          S21 P1 B7
 *   raid/scripts/raid-scene-intents.enhancer.js                   S22 P2
 *   raid/scripts/raid-victory.enhancer.js                         S23 P1 B7
 *   raid/scripts/siege-champions.js                               S24 SG1 SG2
 *   raid/scripts/siege-events.js                                  S25 SG3 SG4
 *   raid/scripts/siege-outcome-writeback.js                       S26 SG3 SG4 W5
 *   structures/scripts/api.structures.js                          S27 ST1 W4
 *   structures/scripts/bulwark-hookups.js                         S28 ST2
 *   structures/scripts/collapse.js                                S29 ST3
 *   structures/scripts/structure-sheet-panel.enhancer.js          S30 ST4
 *   territory/scripts/bbttcc-hex-sheet.enhancer.js                S31 H1 H2 H3 W2
 *   territory/scripts/hex-resource-nodes.enhancer.js              S32 RN1 RN2 RN3
 *   territory/scripts/townbuilder.js                              S33 TB1 W6
 *   territory/scripts/turn-driver.js                              S34 TD1 TD2
 *   tikkun/scripts/api.tikkun.js                                  S35 K1 K2 K3
 *   tikkun/scripts/tikkun-beat-listener.enhancer.js               S36 K2
 *   tikkun/scripts/tikkun-repair.enhancer.js                      S37 K4 K5 K7
 *   tikkun/scripts/tikkun-ritual.enhancer.js                      S38 K6
 *   travel/scripts/chase.js                                       S39 TR4
 *   travel/scripts/hex-travel.js                                  S40 TR1 TR2 TR3 W2
 *   NEW core/scripts/rigs.js                                      S41 B1 R1–R9 W1–W3
 *   NEW factions/scripts/rigs-dnd5e.runtime.js                    S42 D1  (load-only: gated off on fourththing)
 *   NEW factions/scripts/rigs-dnd5e.actions.js                    S43 D1  (load-only: gated off on fourththing)
 *   NEW factions/scripts/rigs-dnd5e.sheet.js                      S44 D3  (load-only: gated off on fourththing)
 *   NEW factions/scripts/rigs-dnd5e.gauntlet.js                   S45 D2  (load-only: gated off on fourththing)
 *   NEW factions/templates/rig-tab.hbs                            S46 D3  (load-only: only the dnd5e sheet loads it)
 *   (S01–S46 = "deployed source marker": the served file, fetched no-store,
 *    carries a HEAD-only string — proves the deploy landed on this server.)
 *   E1 = console.error / uncaught errors captured during the run.
 * ───────────────────────────────────────────────────────────────────────────── */
(async () => {
  const RFI_SMOKE_WRITES = false;   // true → also run the "RFI Smoke Probe *" write probes (created + deleted)
  const RFI_SMOKE_RENDER = true;    // false → skip the render-and-close sheet steps
  const RFI_SMOKE_CHAT   = true;    // false → no GM-whispered summary card

  const TAG = "[rfi-smoke]";
  if (game?.system?.id !== "fourththing") { ui.notifications?.error?.("RFI smoke: refuses to run — this world's system is not fourththing."); console.warn(TAG, "refused: system =", game?.system?.id); return null; }
  if (!game.user?.isGM) { ui.notifications?.error?.("RFI smoke: GM only."); console.warn(TAG, "refused: not GM"); return null; }

  const PROBE = "RFI Smoke Probe";
  const FAKE_FID = "rfiSmokeFactionA";
  const FAKE_FID2 = "rfiSmokeFactionB";
  const t0 = performance.now();

  /* ── error capture ─────────────────────────────────────────────────────── */
  const captured = [];
  const origError = console.error;
  console.error = function (...args) {
    try { captured.push({ kind: "console.error", text: args.map(a => (a instanceof Error ? `${a.name}: ${a.message}` : (typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()))).join(" ").slice(0, 400) }); } catch (_e) {}
    return origError.apply(this, args);
  };
  const onWinErr = (ev) => captured.push({ kind: "uncaught", text: String(ev?.error?.stack || ev?.message || ev).slice(0, 400) });
  const onRej = (ev) => captured.push({ kind: "unhandledrejection", text: String(ev?.reason?.stack || ev?.reason || ev).slice(0, 400) });
  window.addEventListener("error", onWinErr);
  window.addEventListener("unhandledrejection", onRej);

  /* ── report plumbing ───────────────────────────────────────────────────── */
  const rows = [];
  const PASS = (detail = "") => ({ status: "PASS", detail });
  const FAIL = (detail = "") => ({ status: "FAIL", detail });
  const WARN = (detail = "") => ({ status: "WARN", detail });
  const SKIP = (why = "")    => ({ status: "SKIP", detail: why });
  const short = (v, n = 300) => { const s = typeof v === "string" ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })(); return s.length > n ? s.slice(0, n) + "…" : s; };

  async function step(id, group, name, files, fn) {
    let res;
    try {
      res = await fn();
      if (res === true || res === undefined) res = PASS();
      else if (res === false) res = FAIL();
      else if (Array.isArray(res)) res = res[0] ? PASS(res[1] ?? "") : FAIL(res[1] ?? "");
    } catch (e) {
      res = FAIL(`threw: ${e?.message ?? e}`);
      console.warn(TAG, id, name, e);
    }
    const row = { id, group, step: name, files: [].concat(files).join(", "), status: res.status, ok: res.status === "SKIP" ? null : res.status !== "FAIL", detail: short(res.detail ?? "", 600) };
    rows.push(row);
    const fnLog = row.status === "FAIL" ? console.warn : console.log;
    fnLog(TAG, `${row.status.padEnd(4)} ${id} · ${group} · ${name}${row.detail ? ` — ${row.detail}` : ""}`);
    return row;
  }

  /* ── shared fixtures ───────────────────────────────────────────────────── */
  const gp = (o, p) => { try { return foundry.utils.getProperty(o, p); } catch { return undefined; } };
  const strip = (s) => String(s ?? "").replace(/^Actor\./, "");
  const rawSys = (a) => a?.system?.system ?? a?.system ?? {};
  const eq = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; } };
  const R = game.bbttcc?.rigs;
  const dice = game.bbttcc?.dice;
  const actors = game.actors?.contents ?? [];
  const rigsRaw = actors.filter(a => a.type === "rig");
  const factions = actors.filter(a => a.flags?.["bbttcc-factions"]?.isFaction === true);
  const characters = actors.filter(a => a.type === "character");
  const hexDocs = [];
  for (const sc of game.scenes ?? []) {
    for (const d of sc.drawings ?? []) if (d.flags?.["bbttcc-territory"]) hexDocs.push(d);
    for (const t of sc.tiles ?? []) if (t.flags?.["bbttcc-territory"]) hexDocs.push(t);
  }
  const noRigs = () => SKIP("no rig actors in this world");
  const noFactions = () => SKIP("no faction actors (flags.bbttcc-factions.isFaction) in this world");
  const noChars = () => SKIP("no character actors in this world");
  // Owner keys the OLD readers used (each consumer used its own chain).
  const sysOwner = (a) => String(gp(a, "system.identity.factionOwnerId") ?? gp(a, "system.system.identity.factionOwnerId") ?? "");
  const flagOwner = (a) => String(a?.flags?.["bbttcc-factions"]?.factionId ?? "");
  // Rigs whose two owner keys disagree — every "old vs new owner" divergence below traces to one of these.
  const ownerDrift = rigsRaw.filter(a => strip(sysOwner(a)) !== strip(flagOwner(a)) && (sysOwner(a) || flagOwner(a)));
  const driftNote = () => ownerDrift.length ? ` · owner-key drift on ${ownerDrift.length} rig(s): ${ownerDrift.slice(0, 6).map(a => `${a.name}[sys="${sysOwner(a)}" flag="${flagOwner(a)}"]`).join("; ")}` : "";

  async function fetchSrc(path) {
    const url = foundry.utils.getRoute(path);
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
    return r.text();
  }
  // Swap fn on obj for a recording spy for the duration of `run`.
  async function withSpy(obj, key, ret, run) {
    if (!obj || typeof obj[key] !== "function") return { skipped: true };
    const orig = obj[key]; const calls = [];
    const spy = function (...args) { calls.push(args); return Promise.resolve(ret); };
    try { obj[key] = spy; } catch (e) { return { skipped: true, why: e?.message }; }
    if (obj[key] !== spy) return { skipped: true, why: "not writable" };
    try { const out = await run(); return { calls, out }; }
    finally { obj[key] = orig; }
  }
  async function renderAndProbe(app, probe) {
    if (!app) return SKIP("no sheet");
    const wasOpen = !!app.rendered;
    const isV2 = app instanceof foundry.applications.api.ApplicationV2;
    if (!wasOpen) {
      if (isV2) await app.render({ force: true }); else app.render(true);
      for (let i = 0; i < 50 && !app.rendered; i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 300));   // let render hooks (injectors) finish
    }
    try {
      if (!app.rendered) return FAIL("sheet did not render within 5s");
      const el = app.element?.jquery ? app.element[0] : app.element;
      return await probe(el);
    } finally {
      if (!wasOpen) { try { await app.close(); } catch (_e) {} }
    }
  }

  const G = {
    boot: "01 Boot / APIs present", src: "02 Deployed source markers", gate: "03 dnd5e-only files gated off",
    rig: "04 Rig accessor parity", fac: "05 Factions + stockpile", st: "06 Structures", td: "07 Turn driver",
    sg: "08 Raid · siege", orb: "09 Raid · orbital", post: "10 Raid · post-round + scene intents",
    agent: "11 Agent registry + Mal voice", npc: "12 Mal · npc-dialogue", hex: "13 Territory · hex sheet holdings",
    tb: "14 Territory · townbuilder", rn: "15 Territory · resource nodes", tr: "16 Travel · hex-travel + chase",
    mk: "17 Market", al: "18 Auto-link builders", ob: "19 Onboarding tour-defs", camp: "20 Campaign · WME + beat editor",
    tik: "21 Tikkun", loot: "22 Banks loot", ae: "23 AE keys · enlightenment + radiation", dice: "24 Dice adapter (fourththing path)",
    w: "25 Write probes (RFI_SMOKE_WRITES)", err: "26 Console errors"
  };
  const F = {
    rigs: "core/scripts/rigs.js", dice: "core/scripts/dice.js", coreMod: "core/scripts/module.js", coreJson: "core/module.json",
    combat5e: "core/scripts/combat.dnd5e.js", facJson: "factions/module.json", facMod: "factions/scripts/module.js",
    stock: "factions/scripts/stockpile-api.js", rt: "factions/scripts/rigs-dnd5e.runtime.js", act: "factions/scripts/rigs-dnd5e.actions.js",
    sheet: "factions/scripts/rigs-dnd5e.sheet.js", gaunt: "factions/scripts/rigs-dnd5e.gauntlet.js", hbs: "factions/templates/rig-tab.hbs",
    mb: "auto-link/scripts/monster-builder.js", rb: "auto-link/scripts/rig-builder.js", loot: "banks/scripts/loot.js",
    be: "campaign/apps/campaign-beat-editor.js", wme: "campaign/scripts/world-mutation-engine.js", enl: "character-options/scripts/enlightenment.js",
    malMod: "mal-voice/scripts/module.js", npc: "mal-voice/scripts/npc-dialogue.js", market: "market/scripts/market.js",
    tour: "onboarding/scripts/tour-defs.js", rad: "radiation/scripts/bbttcc-radiation-mutations.enhancer.js",
    agent: "raid/scripts/agent-registry.js", orb: "raid/scripts/orbital-strike.js", morale: "raid/scripts/raid-morale.enhancer.js",
    intents: "raid/scripts/raid-scene-intents.enhancer.js", victory: "raid/scripts/raid-victory.enhancer.js",
    champ: "raid/scripts/siege-champions.js", sev: "raid/scripts/siege-events.js", sow: "raid/scripts/siege-outcome-writeback.js",
    stApi: "structures/scripts/api.structures.js", bulwark: "structures/scripts/bulwark-hookups.js", collapse: "structures/scripts/collapse.js",
    panel: "structures/scripts/structure-sheet-panel.enhancer.js", hexSheet: "territory/scripts/bbttcc-hex-sheet.enhancer.js",
    nodes: "territory/scripts/hex-resource-nodes.enhancer.js", town: "territory/scripts/townbuilder.js", turn: "territory/scripts/turn-driver.js",
    tApi: "tikkun/scripts/api.tikkun.js", tBeat: "tikkun/scripts/tikkun-beat-listener.enhancer.js", tRep: "tikkun/scripts/tikkun-repair.enhancer.js",
    tRit: "tikkun/scripts/tikkun-ritual.enhancer.js", chase: "travel/scripts/chase.js", travel: "travel/scripts/hex-travel.js"
  };

  console.log(TAG, `start · writes=${RFI_SMOKE_WRITES} render=${RFI_SMOKE_RENDER} · ${rigsRaw.length} rigs, ${factions.length} factions, ${characters.length} characters, ${hexDocs.length} hex docs`);

  /* ══ 01 BOOT ═══════════════════════════════════════════════════════════════ */
  await step("B1", G.boot, "game.bbttcc.rigs installed with the full surface", F.rigs, () => {
    if (!R) return FAIL("game.bbttcc.rigs missing — core module.json not reloaded? (pm2 restart + full cache bust)");
    const need = ["isRig", "data", "update", "toUpdate", "create", "list", "listByFaction", "ownerOf", "setOwner", "health", "gearOf", "isFrame", "frameOf", "boardedRigOf", "board", "disembark", "impl"];
    const miss = need.filter(k => R[k] === undefined);
    return miss.length ? FAIL(`missing: ${miss.join(", ")}`) : PASS(`${need.length} members · FLAG_SCOPE=${R.FLAG_SCOPE}`);
  });
  await step("B2", G.boot, "manifests: core lists scripts/rigs.js; factions lists the 4 rigs-dnd5e scripts", [F.coreJson, F.facJson], () => {
    const esm = (id) => Array.from(game.modules.get(id)?.esmodules ?? []).map(String);
    const core = esm("bbttcc-core"), fac = esm("bbttcc-factions");
    const coreOk = core.some(p => p.endsWith("scripts/rigs.js"));
    const want = ["runtime", "actions", "sheet", "gauntlet"].map(k => `scripts/rigs-dnd5e.${k}.js`);
    const facMiss = want.filter(w => !fac.some(p => p.endsWith(w)));
    if (!coreOk || facMiss.length) return FAIL(`core rigs.js listed=${coreOk}; factions missing: ${facMiss.join(", ") || "none"} (stale manifest cache?)`);
    return PASS(`core ${core.length} esmodules · factions ${fac.length} esmodules`);
  });
  await step("B3", G.boot, "game.bbttcc.dice installed; isRFI() true", F.dice, () => {
    if (!dice) return FAIL("game.bbttcc.dice missing");
    const need = ["isRFI", "checkFormula", "abilityKey", "abilityMod", "skillRef", "skillBonus", "skillCheck", "check", "flatCheck", "aeKey", "aeChanges", "ABILITY", "SKILLS", "AE_KEYS"];
    const miss = need.filter(k => dice[k] === undefined);
    if (miss.length) return FAIL(`missing: ${miss.join(", ")}`);
    return dice.isRFI() === true ? PASS() : FAIL("isRFI() returned false on fourththing");
  });
  await step("B4", G.boot, "game.bbttcc.types → RFI identity (rig/boss/gear/feature)", F.dice, () => {
    const T = game.bbttcc?.types;
    if (!T) return FAIL("game.bbttcc.types missing");
    const got = { rig: T.actor("rig"), boss: T.actor("boss"), gear: T.item("gear"), feature: T.item("feature"), weapon: T.item("weapon") };
    const want = { rig: "rig", boss: "boss", gear: "gear", feature: "feature", weapon: "weapon" };
    if (!eq(got, want)) return FAIL(`got ${short(got)}`);
    return T.hasActor("rig") ? PASS(`Actor.TYPES has rig`) : FAIL("types.hasActor('rig') false");
  });
  await step("B5", G.boot, "game.bbttcc.packs: id/get/is are identity on fourththing", F.dice, () => {
    const P = game.bbttcc?.packs;
    if (!P) return FAIL("game.bbttcc.packs missing (dice.js on Ember predates 66fb5eb)");
    const bad = [];
    for (const id of Object.keys(P.TWINS ?? {})) {
      if (P.id(id) !== id) bad.push(`id(${id})=${P.id(id)}`);
      if ((P.get(id) ?? null) !== (game.packs.get(id) ?? null)) bad.push(`get(${id}) ≠ game.packs.get`);
      if (!P.is(id, id)) bad.push(`is(${id},${id}) false`);
    }
    return bad.length ? FAIL(bad.join("; ")) : PASS(`${Object.keys(P.TWINS ?? {}).length} twin ids resolve to themselves`);
  });
  await step("B6", G.boot, "combat contract: heal slot present (null on RFI), getHealth is a function", [F.coreMod, F.combat5e], () => {
    const C = game.bbttcc?.combat;
    if (!C) return FAIL("game.bbttcc.combat missing");
    if (!("heal" in C)) return FAIL("combat.heal slot not created — core module.js is the old revision");
    if (C.heal != null) return FAIL(`combat.heal is set (${typeof C.heal}) on fourththing — something filled the dnd5e slot`);
    return typeof C.getHealth === "function" ? PASS("heal=null · getHealth=fn (system impl)") : FAIL("getHealth not a function");
  });
  await step("B7", G.boot, "lifecycle contract: raid.agent + raid.postRound provided", [F.coreMod, F.agent, F.morale, F.victory], () => {
    const L = game.bbttcc?.lifecycle;
    if (!L?.has) return FAIL("game.bbttcc.lifecycle missing");
    const caps = L.caps?.() ?? [];
    const miss = ["raid.agent", "raid.postRound"].filter(c => !L.has(c));
    if (miss.length) return FAIL(`not provided: ${miss.join(", ")} · provided: ${caps.join(", ")}`);
    return L.get("raid.agent") === game.bbttcc?.api?.agent ? PASS(`${caps.length} caps`) : WARN("raid.agent provided but ≠ game.bbttcc.api.agent (registry re-installed?)");
  });

  /* ══ 02 DEPLOYED SOURCE MARKERS ═════════════════════════════════════════════ */
  const MARKERS = [
    ["S01", "modules/bbttcc-auto-link/scripts/monster-builder.js", 'game.bbttcc?.types?.item?.("feature")'],
    ["S02", "modules/bbttcc-auto-link/scripts/rig-builder.js", "_createRigFromLegacyData"],
    ["S03", "modules/bbttcc-banks/scripts/loot.js", "game.bbttcc?.dice?.skillCheck ?? game.fourththing?.rolls?.skillCheck"],
    ["S04", "modules/bbttcc-campaign/apps/campaign-beat-editor.js", "flags.bbttcc-tikkun.spark.sephirah"],
    ["S05", "modules/bbttcc-campaign/scripts/world-mutation-engine.js", "RG.setOwner(rig, lead)"],
    ["S06", "modules/bbttcc-character-options/scripts/enlightenment.js", "game.bbttcc?.dice?.aeChanges?.(def.changes)"],
    ["S07", "modules/bbttcc-core/module.json", '"scripts/rigs.js"'],
    ["S08", "modules/bbttcc-core/scripts/combat.dnd5e.js", "async function heal(actor, amount)"],
    ["S09", "modules/bbttcc-core/scripts/dice.js", "const PACK_TWINS"],
    ["S10", "modules/bbttcc-core/scripts/module.js", "_combat.heal = null"],
    ["S11", "modules/bbttcc-factions/module.json", "scripts/rigs-dnd5e.runtime.js"],
    ["S12", "modules/bbttcc-factions/scripts/module.js", "game.bbttcc.rigs accessor not installed"],
    ["S13", "modules/bbttcc-factions/scripts/stockpile-api.js", 'const onDnd = game.system?.id === "dnd5e"'],
    ["S14", "modules/bbttcc-mal-voice/scripts/module.js", 'lifecycle.need("raid.agent")'],
    ["S15", "modules/bbttcc-mal-voice/scripts/npc-dialogue.js", "game.bbttcc?.packs?.get?.(SECRETS_PACK_ID)"],
    ["S16", "modules/bbttcc-market/scripts/market.js", "rigOwnerPending"],
    ["S17", "modules/bbttcc-onboarding/scripts/tour-defs.js", "R.listByFaction(fid)[0]"],
    ["S18", "modules/bbttcc-radiation/scripts/bbttcc-radiation-mutations.enhancer.js", "game.bbttcc?.dice?.aeKey?.(e.key)"],
    ["S19", "modules/bbttcc-raid/scripts/agent-registry.js", 'provide?.("raid.agent"'],
    ["S20", "modules/bbttcc-raid/scripts/orbital-strike.js", "const _rigData = (a)"],
    ["S21", "modules/bbttcc-raid/scripts/raid-morale.enhancer.js", 'lifecycle.need("raid.postRound")'],
    ["S22", "modules/bbttcc-raid/scripts/raid-scene-intents.enhancer.js", "const healFn = game.bbttcc?.combat?.heal"],
    ["S23", "modules/bbttcc-raid/scripts/raid-victory.enhancer.js", 'lifecycle.need("raid.postRound")'],
    ["S24", "modules/bbttcc-raid/scripts/siege-champions.js", "R.data(actor)?.integrity?.tier"],
    ["S25", "modules/bbttcc-raid/scripts/siege-events.js", 'R.toUpdate(actor, { "identity.factionOwnerId": next || "" })'],
    ["S26", "modules/bbttcc-raid/scripts/siege-outcome-writeback.js", 'R.toUpdate(actor, { "identity.factionOwnerId": attackerId })'],
    ["S27", "modules/bbttcc-structures/scripts/api.structures.js", "await R.update(actor, {"],
    ["S28", "modules/bbttcc-structures/scripts/bulwark-hookups.js", "(dice?.skillCheck ?? game.fourththing.rolls.skillCheck)"],
    ["S29", "modules/bbttcc-structures/scripts/collapse.js", "R?.data?.(actor)?.integrity?.value"],
    ["S30", "modules/bbttcc-structures/scripts/structure-sheet-panel.enhancer.js", 'Hooks.on("renderVehicleActorSheet", handler)'],
    ["S31", "modules/bbttcc-territory/scripts/bbttcc-hex-sheet.enhancer.js", "if (R?.isRig(actor)) return String(R.ownerOf(actor)"],
    ["S32", "modules/bbttcc-territory/scripts/hex-resource-nodes.enhancer.js", "const onRFI = dice ? dice.isRFI() : true"],
    ["S33", "modules/bbttcc-territory/scripts/townbuilder.js", 'R.toUpdate(built.actor, { "identity.binding.hexId"'],
    ["S34", "modules/bbttcc-territory/scripts/turn-driver.js", "if (!a || !R?.isRig(a)) continue;"],
    ["S35", "modules/bbttcc-tikkun/scripts/api.tikkun.js", "flags.bad-eden-5e.rfi.id"],
    ["S36", "modules/bbttcc-tikkun/scripts/tikkun-beat-listener.enhancer.js", "_sparkSys(sparkItem)?.sephirah"],
    ["S37", "modules/bbttcc-tikkun/scripts/tikkun-repair.enhancer.js", 'dice.skillBonus(contributor, "ritual", "soul")'],
    ["S38", "modules/bbttcc-tikkun/scripts/tikkun-ritual.enhancer.js", "game.bbttcc?.dice?.checkFormula?.() ?? game.fourththing"],
    ["S39", "modules/bbttcc-travel/scripts/chase.js", "game.bbttcc?.rigs?.ownerOf?.(rig)"],
    ["S40", "modules/bbttcc-travel/scripts/hex-travel.js", "ownerOf covers both owner keys"],
    ["S41", "modules/bbttcc-core/scripts/rigs.js", "game.bbttcc.rigs = {"],
    ["S42", "modules/bbttcc-factions/scripts/rigs-dnd5e.runtime.js", "the dnd5e RIG RUNTIME"],
    ["S43", "modules/bbttcc-factions/scripts/rigs-dnd5e.actions.js", "[bbttcc-factions/rigs-dnd5e-actions]"],
    ["S44", "modules/bbttcc-factions/scripts/rigs-dnd5e.sheet.js", "[bbttcc-factions/rigs-dnd5e-sheet]"],
    ["S45", "modules/bbttcc-factions/scripts/rigs-dnd5e.gauntlet.js", "THE RIG GAUNTLET"],
    ["S46", "modules/bbttcc-factions/templates/rig-tab.hbs", "bbttcc-rig-tab"]
  ];
  const srcCache = new Map();
  await Promise.all(MARKERS.map(async ([, path]) => { try { srcCache.set(path, await fetchSrc(path)); } catch (e) { srcCache.set(path, e); } }));
  for (const [id, path, marker] of MARKERS) {
    await step(id, G.src, `served file carries the HEAD marker`, path.replace(/^modules\/bbttcc-/, ""), () => {
      const src = srcCache.get(path);
      if (src instanceof Error) return FAIL(src.message);
      return src.includes(marker) ? PASS(`${(src.length / 1024).toFixed(1)} KB`) : FAIL(`marker not found: ${marker} — Ember still serves the old revision`);
    });
  }

  /* ══ 03 dnd5e-ONLY FILES GATED OFF ═════════════════════════════════════════ */
  await step("D1", G.gate, "rigs.impl is empty (runtime + actions DORMANT off dnd5e)", [F.rt, F.act], () => {
    if (!R) return SKIP("no accessor");
    const keys = Object.keys(R.impl ?? {});
    return keys.length ? FAIL(`impl has keys on fourththing: ${keys.join(", ")}`) : PASS("impl = {} · board/disembark route to game.fourththing.rig");
  });
  await step("D2", G.gate, "rig gauntlet not installed (rigs.gauntlet undefined)", F.gaunt, () =>
    R?.gauntlet === undefined ? PASS() : FAIL("game.bbttcc.rigs.gauntlet exists on fourththing"));
  await step("D3", G.gate, "no 'Bad Eden — Rig Sheet' registered; rig-tab.hbs not loaded", [F.sheet, F.hbs], () => {
    const cls = CONFIG.Actor?.sheetClasses ?? {};
    const hits = [];
    for (const [type, m] of Object.entries(cls)) for (const [k, v] of Object.entries(m ?? {})) if (/rig sheet/i.test(String(v?.label ?? "")) && /bad eden/i.test(String(v?.label ?? ""))) hits.push(`${type}:${k}`);
    const tplLoaded = !!(Handlebars?.partials?.["modules/bbttcc-factions/templates/rig-tab.hbs"]);
    if (hits.length || tplLoaded) return FAIL(`sheet regs: ${hits.join(", ") || "none"} · template partial loaded=${tplLoaded}`);
    return PASS(`Actor types with sheets: ${Object.keys(cls).join(", ")}`);
  });
  await step("D4", G.gate, "combat.dnd5e.js dormant: getHealth(rig) = system integrity, heal unset", F.combat5e, () => {
    const C = game.bbttcc?.combat;
    if (C?.heal != null) return FAIL("combat.heal set — the dnd5e impl ran");
    if (!rigsRaw.length) return PASS("heal unset (no rigs to probe getHealth)");
    const bad = rigsRaw.filter(a => { const h = C.getHealth(a); const t = rawSys(a).integrity ?? {}; return !(Number(h?.value) === Number(t.value) || (h?.value == null && !Number.isFinite(Number(t.value)))); });
    return bad.length ? FAIL(`getHealth ≠ integrity on: ${bad.map(a => a.name).join(", ")}`) : PASS(`${rigsRaw.length} rigs`);
  });

  /* ══ 04 RIG ACCESSOR PARITY ═════════════════════════════════════════════════ */
  if (!R) {
    for (const id of ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"]) await step(id, G.rig, "accessor parity", F.rigs, () => SKIP("game.bbttcc.rigs missing (see B1)"));
  } else {
    await step("R1", G.rig, "isRig(a) ≡ a.type === 'rig' on every actor", F.rigs, () => {
      const bad = actors.filter(a => !!R.isRig(a) !== (a.type === "rig"));
      return bad.length ? FAIL(bad.map(a => `${a.name}(${a.type})`).join(", ")) : PASS(`${actors.length} actors, ${rigsRaw.length} rigs`);
    });
    await step("R2", G.rig, "data(rig) is the live raw system object (=== actor.system)", F.rigs, () => {
      if (!rigsRaw.length) return noRigs();
      const notRaw = rigsRaw.filter(a => R.data(a) !== rawSys(a));
      if (notRaw.length) return FAIL(`data ≠ rawSys: ${notRaw.map(a => a.name).join(", ")}`);
      const nested = rigsRaw.filter(a => R.data(a) !== a.system);
      return nested.length ? WARN(`system.system nesting on ${nested.map(a => a.name).join(", ")} — old readers that used a.system directly (hex-sheet, turn-driver) saw different data`) : PASS(`${rigsRaw.length} rigs`);
    });
    await step("R3", G.rig, "list() = raw rig set; data(non-rig) = null", F.rigs, () => {
      const L = R.list().map(a => a.id), raw = rigsRaw.map(a => a.id);
      if (!eq(L, raw)) return FAIL(`list ${L.length} vs raw ${raw.length}`);
      const nonRig = actors.find(a => a.type !== "rig");
      if (nonRig && R.data(nonRig) !== null) return FAIL(`data(${nonRig.name}) not null`);
      if (nonRig && R.ownerOf(nonRig) !== "") return FAIL(`ownerOf(${nonRig.name}) not ""`);
      return PASS(`${L.length} rigs`);
    });
    await step("R4", G.rig, "ownerOf(rig) = system owner || flag owner", F.rigs, () => {
      if (!rigsRaw.length) return noRigs();
      const bad = rigsRaw.filter(a => R.ownerOf(a) !== (String(rawSys(a).identity?.factionOwnerId || "") || flagOwner(a)));
      if (bad.length) return FAIL(bad.map(a => a.name).join(", "));
      return ownerDrift.length ? WARN(`accessor OK${driftNote()} — consumers that read only ONE key before now read both`) : PASS(`${rigsRaw.length} rigs, owner keys in step`);
    });
    await step("R5", G.rig, "listByFaction(fid) vs old system-key filter, per faction", F.rigs, () => {
      if (!factions.length) return noFactions();
      const diffs = [];
      for (const f of factions) {
        const neu = R.listByFaction(f.id).map(a => a.id).sort();
        const old = rigsRaw.filter(a => strip(sysOwner(a)) === f.id).map(a => a.id).sort();
        if (!eq(neu, old)) diffs.push(`${f.name}: new ${neu.length} vs old ${old.length}`);
      }
      return diffs.length ? WARN(`${diffs.join("; ")}${driftNote()}`) : PASS(`${factions.length} factions`);
    });
    await step("R6", G.rig, "health(rig) = {integrity.value, max}", F.rigs, () => {
      if (!rigsRaw.length) return noRigs();
      const bad = rigsRaw.filter(a => { const h = R.health(a); const t = rawSys(a).integrity ?? {}; const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null); return h?.value !== n(t.value) || h?.max !== n(t.max); });
      return bad.length ? FAIL(bad.map(a => `${a.name}: ${short(R.health(a))} vs ${short(rawSys(a).integrity)}`).join("; ")) : PASS(`${rigsRaw.length} rigs`);
    });
    await step("R7", G.rig, "frameOf / gearOf / isFrame agree with the raw rigGear / rigFrame flags", F.rigs, () => {
      if (!rigsRaw.length) return noRigs();
      let items = 0; const bad = [];
      for (const a of rigsRaw) {
        const rawFrame = a.items.find(i => i.flags?.fourththing?.rigFrame || i.flags?.bbttcc?.rigFrame || (i.flags?.fourththing?.rigGear ?? i.flags?.bbttcc?.rigGear)?.subtype === "rig-frame") ?? null;
        if ((R.frameOf(a)?.id ?? null) !== (rawFrame?.id ?? null)) bad.push(`${a.name}: frameOf ${R.frameOf(a)?.name} vs ${rawFrame?.name}`);
        for (const i of a.items) {
          const g = i.flags?.fourththing?.rigGear ?? i.flags?.bbttcc?.rigGear ?? i.flags?.["bbttcc-factions"]?.rigGear ?? null;
          const fr = i.flags?.fourththing?.rigFrame ?? i.flags?.bbttcc?.rigFrame ?? i.flags?.["bbttcc-factions"]?.rigFrame ?? null;
          if (!g && !fr) { if (R.gearOf(i) !== null) bad.push(`${a.name}/${i.name}: gearOf non-null`); continue; }
          items++;
          const want = fr ? { subtype: "rig-frame", ...(g ?? {}), ...fr } : g;
          if (!eq(R.gearOf(i), want)) bad.push(`${a.name}/${i.name}: gearOf mismatch`);
        }
      }
      return bad.length ? FAIL(bad.slice(0, 8).join("; ")) : PASS(`${items} rig gear items on ${rigsRaw.length} rigs`);
    });
    await step("R8", G.rig, "toUpdate on RFI = system.<path> (+ owner flag mirror)", F.rigs, () => {
      const probe = rigsRaw[0] ?? null;   // toUpdate only reads isRFI(); actor arg unused on RFI
      const a = R.toUpdate(probe, { "identity.binding.hexId": "H", "integrity.value": 5, "crew.slots": [] });
      const wantA = { "system.identity.binding.hexId": "H", "system.integrity.value": 5, "system.crew.slots": [] };
      const b = R.toUpdate(probe, { "identity.factionOwnerId": "X" });
      const c = R.toUpdate(probe, { "identity.factionOwnerId": "" });
      if (!eq(a, wantA)) return FAIL(`plain paths: ${short(a)}`);
      if (b["system.identity.factionOwnerId"] !== "X" || b["flags.bbttcc-factions.factionId"] !== "X") return FAIL(`owner: ${short(b)}`);
      return WARN(`OK · NOTE value drift vs old writers: owner patch also writes flags.bbttcc-factions.factionId; clearing writes system owner "" (siege-events used null) → ${short(c)}`);
    });
    await step("R9", G.rig, "boarding routes to game.fourththing.rig; boardedRigOf mirrors flags.fourththing.boardedRig", F.rigs, () => {
      const sysRig = game.fourththing?.rig;
      const fnOk = typeof sysRig?.board === "function" && typeof sysRig?.disembark === "function";
      const boarded = characters.filter(c => c.flags?.fourththing?.boardedRig);
      const bad = boarded.filter(c => { const f = c.flags.fourththing.boardedRig; const want = typeof f === "string" ? f : (f.rigId ?? f.id ?? null); return R.boardedRigOf(c)?.rigId !== want; });
      const nonBoarded = characters.filter(c => !c.flags?.fourththing?.boardedRig && R.boardedRigOf(c) !== null);
      if (bad.length || nonBoarded.length) return FAIL(`mismatch: ${[...bad, ...nonBoarded].map(c => c.name).join(", ")}`);
      return fnOk ? PASS(`${boarded.length} boarded steward(s)`) : WARN(`game.fourththing.rig.board/disembark missing — rigs.board() would warn "isn't available"`);
    });
  }

  /* ══ 05 FACTIONS + STOCKPILE ════════════════════════════════════════════════ */
  await step("F1", G.fac, "faction sheet owned-rigs roster: new (ownerOf, Actor.-stripped) vs old (system owner)", F.facMod, () => {
    if (!R) return SKIP("no accessor");
    if (!factions.length) return noFactions();
    const diffs = [];
    for (const f of factions) {
      const old = rigsRaw.filter(a => sysOwner(a) === f.id).map(a => a.id).sort();
      const neu = rigsRaw.filter(a => R.isRig(a) && strip(R.ownerOf(a) ?? "") === f.id).map(a => a.id).sort();
      if (!eq(old, neu)) diffs.push(`${f.name}: old ${old.length} → new ${neu.length}`);
    }
    return diffs.length ? WARN(`${diffs.join("; ")}${driftNote()}`) : PASS(`${factions.length} factions`);
  });
  await step("F2", G.fac, "starter-rig grant takes the same branch as before (rig type + accessor + mintFromChassis)", F.facMod, () => {
    const typeOk = (Actor.TYPES ?? []).includes("rig");
    const accOk = !!game.bbttcc?.rigs;
    const mintOk = typeof game.bbttcc?.api?.rigBuilder?.mintFromChassis === "function";
    if (typeOk && accOk && mintOk) return PASS("old gate (Actor.TYPES has rig) and new gate (accessor) both open → mintFromChassis");
    return FAIL(`Actor.TYPES rig=${typeOk} accessor=${accOk} mintFromChassis=${mintOk} — old build granted, new build would skip`);
  });
  await step("F3", G.fac, "render + close a faction sheet (owned-rigs getData path)", F.facMod, async () => {
    if (!RFI_SMOKE_RENDER) return SKIP("RFI_SMOKE_RENDER=false");
    const f = factions.find(a => a.sheet?.constructor?.name === "BBTTCCFactionSheet");
    if (!f) return SKIP("no faction actor using BBTTCCFactionSheet");
    const before = captured.length;
    return renderAndProbe(f.sheet, () => captured.length > before ? FAIL(`render logged ${captured.length - before} error(s): ${captured.slice(before).map(c => c.text).join(" | ")}`) : PASS(`rendered ${f.name}`));
  });
  await step("F4", G.fac, "stockpile API present; withdraw stub type = gear on RFI", F.stock, () => {
    const sp = game.bbttcc?.api?.factions?.stockpile;
    if (!sp) return FAIL("game.bbttcc.api.factions.stockpile missing");
    const miss = ["get", "qty", "list", "adjust", "depositFromCharacter", "withdrawToCharacter"].filter(k => typeof sp[k] !== "function");
    if (miss.length) return FAIL(`missing: ${miss.join(", ")}`);
    const t = game.bbttcc?.types?.item?.("gear") ?? "gear";
    return t === "gear" && game.system.id !== "dnd5e" ? PASS("stub = {type:'gear', system:{slot:'material', tags}} as before") : FAIL(`stub type would be ${t}`);
  });

  /* ══ 06 STRUCTURES ══════════════════════════════════════════════════════════ */
  await step("ST1", G.st, "retypeFortification precondition: old !!system.crew vs new isRig && data.crew", F.stApi, () => {
    const S = game.bbttcc?.api?.structures;
    if (typeof S?.crew?.retypeFortification !== "function") return FAIL("api.structures.crew.retypeFortification missing");
    if (!R) return SKIP("no accessor");
    const withCrew = actors.filter(a => a.system?.crew);
    const diffs = withCrew.filter(a => !!a.system?.crew !== !!(R.isRig(a) && R.data(a)?.crew));
    return diffs.length ? WARN(`non-rig actors with system.crew no longer retypeable: ${diffs.map(a => `${a.name}(${a.type})`).join(", ")}`) : PASS(`${withCrew.length} crew-schema actors, all rigs`);
  });
  await step("ST2", G.st, "bulwark faction resolution: old system owner vs new ownerOf||system owner", F.bulwark, async () => {
    if (!R) return SKIP("no accessor");
    if (!rigsRaw.length) return noRigs();
    const diffs = rigsRaw.filter(a => (rawSys(a).identity?.factionOwnerId || "") !== ((R.ownerOf(a) || null) || rawSys(a).identity?.factionOwnerId || ""));
    const B = game.bbttcc?.api?.structures?.bulwark;
    const apiOk = typeof B?._onRenewal === "function";
    if (!apiOk) return FAIL("api.structures.bulwark._onRenewal missing");
    return diffs.length ? WARN(`renewal/catastrophe now finds a faction via the flag for: ${diffs.map(a => a.name).join(", ")} (system owner empty)`) : PASS(`${rigsRaw.length} rigs resolve identically`);
  });
  await step("ST3", G.st, "collapse HP read: combat.getHealth path taken on RFI (rig branch unreachable)", F.collapse, () => {
    const gh = game.bbttcc?.combat?.getHealth;
    if (typeof gh !== "function") return WARN("getHealth missing → collapse falls to the accessor branch");
    if (typeof game.bbttcc?.api?.structures?.triggerCollapse !== "function") return FAIL("api.structures.triggerCollapse missing");
    if (!rigsRaw.length) return PASS("getHealth registered (no rigs to compare)");
    const bad = rigsRaw.filter(a => { const v = gh(a)?.value; const raw = Number(rawSys(a).integrity?.value); return (Number.isFinite(raw) ? raw : null) !== v; });
    return bad.length ? FAIL(bad.map(a => a.name).join(", ")) : PASS(`${rigsRaw.length} rigs`);
  });
  await step("ST4", G.st, "structure panel injects into a rig sheet's identity tab (render + close)", F.panel, async () => {
    if (!RFI_SMOKE_RENDER) return SKIP("RFI_SMOKE_RENDER=false");
    const rig = rigsRaw.find(a => a.flags?.["bbttcc-structures"]?.hasStructure) ?? rigsRaw[0];
    if (!rig) return noRigs();
    return renderAndProbe(rig.sheet, (el) => {
      const panel = el?.querySelector?.("[data-bbttcc-structures-panel]");
      if (!panel) return FAIL(`no [data-bbttcc-structures-panel] on ${rig.name}'s sheet (${rig.sheet?.constructor?.name})`);
      const inIdentity = !!panel.closest?.(".tab[data-tab='identity']");
      const n = el.querySelectorAll("[data-bbttcc-structures-panel='wrap']").length;
      if (n > 1) return FAIL(`${n} panels injected (duplicate hook path)`);
      return inIdentity ? PASS(`${rig.name} · identity tab`) : WARN(`panel landed outside the identity tab (${panel.parentElement?.className}) — the new description/tab-body fallback won`);
    });
  });

  /* ══ 07 TURN DRIVER ═════════════════════════════════════════════════════════ */
  await step("TD1", G.td, "laneHexBonus facility detection: old (type rig + system mobility) vs new (accessor)", F.turn, () => {
    if (!R) return FAIL("accessor missing → laneHexBonus skips EVERY facility (no fallback in the new code)");
    const holdingHexes = hexDocs.filter(d => Array.isArray(d.flags["bbttcc-territory"]?.holdings?.rigIds) && d.flags["bbttcc-territory"].holdings.rigIds.length);
    if (!holdingHexes.length) return SKIP("no hex holds rigIds");
    const diffs = [];
    for (const d of holdingHexes) {
      const ids = d.flags["bbttcc-territory"].holdings.rigIds;
      const old = ids.map(id => game.actors.get(String(id))).filter(a => a && a.type === "rig" && String(a.system?.identity?.mobility || "mobile").toLowerCase() !== "mobile").map(a => a.name).sort();
      const neu = ids.map(id => game.actors.get(String(id))).filter(a => a && R.isRig(a) && String(R.data(a)?.identity?.mobility || "mobile").toLowerCase() !== "mobile").map(a => a.name).sort();
      if (!eq(old, neu)) diffs.push(`${d.flags["bbttcc-territory"].name ?? d.id}: ${old} → ${neu}`);
    }
    return diffs.length ? FAIL(diffs.join("; ")) : PASS(`${holdingHexes.length} hexes with holdings`);
  });
  await step("TD2", G.td, "turn API present; preview NOT run (advanceOPRegen apply:false still writes an empty stockpile)", F.turn, () => {
    const T = game.bbttcc?.api?.turn;
    const ok = typeof T?.advanceTurn === "function" && typeof T?.advanceOPRegen === "function";
    return ok ? PASS("advanceTurn/advanceOPRegen present · facility-lane parity checked offline in TD1") : FAIL("api.turn.advanceTurn / advanceOPRegen missing");
  });

  /* ══ 08 RAID · SIEGE ════════════════════════════════════════════════════════ */
  await step("SG1", G.sg, "championCandidates(fid): new vs old affiliation chain, per faction", F.champ, () => {
    const cand = game.bbttcc?.api?.siege?.championCandidates;
    if (typeof cand !== "function") return FAIL("api.siege.championCandidates missing");
    if (!factions.length) return noFactions();
    const kindOf = (a) => { const k = game.bbttcc?.api?.actorKind?.(a); if (k) return k; const ek = String(a?.flags?.["bbttcc-auto-link"]?.entityKind || "").toLowerCase(); if (a?.type === "character") return ek === "npc" ? "npc" : "steward"; return a?.type || ""; };
    const oldAff = (a, fid) => String(gp(a, "system.identity.factionOwnerId") ?? gp(a, "system.system.identity.factionOwnerId") ?? a.getFlag?.("bbttcc-factions", "factionId") ?? a.getFlag?.("bbttcc-auto-link", "factionId") ?? "") === String(fid);
    const diffs = [];
    for (const f of factions) {
      const neu = cand(f.id).map(c => c.actorId).sort();
      const old = actors.filter(a => kindOf(a) === "steward" && oldAff(a, f.id)).map(a => a.id).sort();
      if (!eq(neu, old)) diffs.push(`${f.name}: old ${old.length} → new ${neu.length}`);
    }
    return diffs.length ? WARN(`${diffs.join("; ")} (?? → || now skips an empty system owner and reads the faction flag)`) : PASS(`${factions.length} factions`);
  });
  await step("SG2", G.sg, "champion rank for rigs: tier×4 from accessor = tier×4 from raw system", F.champ, () => {
    if (!R) return SKIP("no accessor");
    if (!rigsRaw.length) return noRigs();
    const bad = rigsRaw.filter(a => (Number(R.data(a)?.integrity?.tier) || 1) * 4 !== (Number(rawSys(a).integrity?.tier) || 1) * 4);
    return bad.length ? FAIL(bad.map(a => a.name).join(", ")) : PASS(`${rigsRaw.length} rigs (only reachable for non-steward kinds)`);
  });
  await step("SG3", G.sg, "defection / capture owner patch on a rig = old system write (+ flag mirror)", [F.sev, F.sow], () => {
    if (!R?.toUpdate) return FAIL("rigs.toUpdate missing — siege writes would fall back to the raw path");
    const rig = rigsRaw[0];
    if (!rig) return noRigs();
    const cap = R.toUpdate(rig, { "identity.factionOwnerId": "ATTACKER" });
    const def = R.toUpdate(rig, { "identity.factionOwnerId": "" });
    const okCap = cap["system.identity.factionOwnerId"] === "ATTACKER";
    const okDef = def["system.identity.factionOwnerId"] === "";
    if (!okCap || !okDef) return FAIL(`capture ${short(cap)} · defect-to-none ${short(def)}`);
    return WARN(`system key identical; extra flags.bbttcc-factions.factionId mirror; defection to nobody now writes "" (was null)`);
  });
  await step("SG4", G.sg, "siege APIs present (events, outcome writeback, matrix)", [F.sev, F.sow], () => {
    const S = game.bbttcc?.api?.siege;
    const miss = [["events.drawAndApplyEvent", S?.events?.drawAndApplyEvent], ["applyOutcomeWriteback", S?.applyOutcomeWriteback], ["OUTCOME_MATRIX", S?.OUTCOME_MATRIX]].filter(([, v]) => !v).map(([k]) => k);
    return miss.length ? FAIL(`missing: ${miss.join(", ")}`) : PASS();
  });

  /* ══ 09 RAID · ORBITAL ══════════════════════════════════════════════════════ */
  await step("O1", G.orb, "findOrbitalBunker(fid) = old space-domain + owner search, per faction", F.orb, () => {
    const fob = game.bbttcc?.api?.raid?.findOrbitalBunker;
    if (typeof fob !== "function") return FAIL("api.raid.findOrbitalBunker missing");
    const dom = (a) => { const d = rawSys(a)?.travel?.domains; return Array.isArray(d) ? d.map(x => String(x).toLowerCase()) : ["land"]; };
    const oldFac = (a) => String(rawSys(a)?.identity?.factionOwnerId || a?.flags?.["bbttcc-factions"]?.factionId || "");
    const cands = rigsRaw.filter(a => dom(a).includes("space"));
    const diffs = [];
    if ((fob(null)?.id ?? null) !== (cands[0]?.id ?? null)) diffs.push(`any: ${fob(null)?.name} vs ${cands[0]?.name}`);
    for (const f of factions) {
      const old = cands.find(a => oldFac(a) === f.id)?.id ?? null;
      if ((fob(f.id)?.id ?? null) !== old) diffs.push(`${f.name}: ${fob(f.id)?.name} vs ${game.actors.get(old)?.name}`);
    }
    return diffs.length ? FAIL(diffs.join("; ")) : PASS(`${cands.length} space-domain rig(s), ${factions.length} factions`);
  });

  /* ══ 10 RAID · POST-ROUND + SCENE INTENTS ═══════════════════════════════════ */
  await step("P1", G.post, "applyPostRoundEffects wrapped by morale AND victory (lifecycle-ordered)", [F.morale, F.victory], () => {
    const raid = game.bbttcc?.api?.raid || game.modules.get("bbttcc-raid")?.api?.raid;
    if (typeof raid?.applyPostRoundEffects !== "function") return FAIL("raid.applyPostRoundEffects missing");
    const morale = !!(raid.__moraleWrapped || raid.applyPostRoundEffects.__bbttccMoraleWrapped);
    const victory = !!(raid.__victoryWrapped || raid.applyPostRoundEffects.__bbttccVictoryWrapped);
    return morale && victory ? PASS() : FAIL(`morale wrapped=${morale} · victory wrapped=${victory} — lifecycle need("raid.postRound") never resolved?`);
  });
  await step("P2", G.post, "healSceneTokens handler present; RFI integrity branch taken (combat.heal null)", F.intents, () => {
    const SI = game.bbttcc?.api?.raid?.sceneIntents;
    if (typeof SI?.HANDLERS?.healSceneTokens !== "function") return FAIL("sceneIntents.HANDLERS.healSceneTokens missing");
    const branchRFI = !(typeof game.bbttcc?.combat?.heal === "function" && game.system?.id !== "fourththing");
    return branchRFI ? PASS("heal writes system.integrity.value as before") : FAIL("dnd5e heal branch would be taken");
  });

  /* ══ 11 AGENT REGISTRY + MAL VOICE ══════════════════════════════════════════ */
  await step("A1", G.agent, "agent registry capabilities() reports version + verbs", F.agent, () => {
    const ag = game.bbttcc?.api?.agent;
    if (typeof ag?.capabilities !== "function") return FAIL("game.bbttcc.api.agent.capabilities missing");
    const caps = ag.capabilities();
    return caps?.version && Array.isArray(caps?.verbs) && caps.verbs.length ? PASS(`v${caps.version} · ${caps.verbs.length} verbs`) : FAIL(short(caps));
  });
  await step("A2", G.agent, "Mal voice installed (bootstrap waits on lifecycle raid.agent)", F.malMod, () => {
    const mal = game.bbttcc?.mal;
    if (!mal?.version) return FAIL("game.bbttcc.mal missing");
    return PASS(`mal v${mal.version}${game.bbttcc?.lifecycle?.has?.("raid.agent") ? " · raid.agent resolved" : " · raid.agent NOT provided (bootstrap still waiting)"}`);
  });

  /* ══ 12 MAL · NPC DIALOGUE ══════════════════════════════════════════════════ */
  await step("N1", G.npc, "secrets pack resolves to bbttcc-master-content.courtly-secrets; npc API present", F.npc, () => {
    const id = "bbttcc-master-content.courtly-secrets";
    const viaTwin = game.bbttcc?.packs?.get?.(id) ?? game.packs?.get(id);
    if ((viaTwin ?? null) !== (game.packs.get(id) ?? null)) return FAIL("packs.get(courtly-secrets) ≠ game.packs.get");
    if (typeof game.bbttcc?.mal?.npc?.talkTo !== "function") return FAIL("game.bbttcc.mal.npc.talkTo missing");
    return viaTwin ? PASS(`${viaTwin.collection} (${viaTwin.index?.size ?? "?"} entries)`) : WARN("courtly-secrets pack not registered in this world (grant would fail the same way before)");
  });

  /* ══ 13 TERRITORY · HEX SHEET HOLDINGS ══════════════════════════════════════ */
  const H = game.bbttcc?.api?.territory?.holdings;
  await step("H1", G.hex, "holdings.classify: old (type rig + system mobility) vs new, every actor", F.hexSheet, () => {
    if (typeof H?.classify !== "function") return FAIL("api.territory.holdings.classify missing");
    const oldCls = (a) => { if (a.type === "boss") return "boss"; if (a.type === "rig") return String(a.system?.identity?.mobility || "mobile").toLowerCase() === "stationary" ? "facility" : "rig"; return null; };
    const bad = actors.filter(a => H.classify(a) !== oldCls(a));
    return bad.length ? FAIL(bad.map(a => `${a.name}: ${H.classify(a)} vs ${oldCls(a)}`).join("; ")) : PASS(`${actors.length} actors`);
  });
  await step("H2", G.hex, "holdings.bonusForActor(rig) bracket bonus = old system bracket", F.hexSheet, () => {
    if (typeof H?.bonusForActor !== "function") return FAIL("holdings.bonusForActor missing");
    const mobile = rigsRaw.filter(a => H.classify(a) === "rig");
    if (!mobile.length) return SKIP("no mobile rigs");
    const bad = mobile.filter(a => { const b = H.bonusForActor(a); const br = String(a.system?.integrity?.bracket || "medium").toLowerCase(); return b?.bracket !== br || b?.bonus !== (H.RIG_BONUS?.[br] ?? 0); });
    return bad.length ? FAIL(bad.map(a => a.name).join(", ")) : PASS(`${mobile.length} rigs`);
  });
  await step("H3", G.hex, "readHoldings + computeBonuses on every hex doc (no throw, no missing rigs)", F.hexSheet, () => {
    if (typeof H?.readHoldings !== "function") return FAIL("holdings.readHoldings missing");
    if (!hexDocs.length) return SKIP("no hex docs");
    let rowsN = 0; const missing = [];
    for (const d of hexDocs) { const rs = H.readHoldings(d); rowsN += rs.length; for (const r of rs) if (r.kind === "missing") missing.push(r.id); if (typeof H.computeBonuses === "function") H.computeBonuses(d); }
    return missing.length ? WARN(`${rowsN} rows · dangling actor ids (pre-existing data): ${missing.slice(0, 8).join(", ")}`) : PASS(`${hexDocs.length} hexes · ${rowsN} holding rows`);
  });

  /* ══ 14 TERRITORY · TOWNBUILDER ═════════════════════════════════════════════ */
  await step("TB1", G.tb, "settlement binding patch on a rig = exactly {system.identity.binding.hexId}", F.town, () => {
    if (!game.bbttcc?.api?.territory?.townbuilder?.buildAsset) return FAIL("api.territory.townbuilder.buildAsset missing");
    if (!R?.toUpdate) return FAIL("accessor missing → townbuilder would call undefined R.isRig");
    const rig = rigsRaw[0];
    if (!rig) return PASS("API present (no rig to shape-check)");
    const upd = R.toUpdate(rig, { "identity.binding.hexId": "HEX123" });
    return eq(upd, { "system.identity.binding.hexId": "HEX123" }) ? PASS() : FAIL(short(upd));
  });

  /* ══ 15 TERRITORY · RESOURCE NODES ══════════════════════════════════════════ */
  const ATTRS = ["violence", "intrigue", "body", "mind", "soul", "presence"];
  await step("RN1", G.rn, "harvest attribute = raw attribute value (+ AEs) on RFI, per character", F.nodes, () => {
    if (!dice) return FAIL("dice missing");
    if (!characters.length) return noChars();
    const bad = [];
    for (const c of characters) for (const at of ATTRS) { const old = Number(rawSys(c)?.attributes?.[at]?.value ?? 0); const neu = dice.abilityMod(c, at); if (!(old === neu || (!Number.isFinite(old) && neu === 0))) bad.push(`${c.name}.${at}: ${old}→${neu}`); }
    return bad.length ? FAIL(bad.slice(0, 10).join("; ")) : PASS(`${characters.length} characters × ${ATTRS.length} attributes`);
  });
  await step("RN2", G.rn, "check die: dice.checkFormula() = game.fourththing.rolls.checkFormula()", [F.nodes, F.tRit, F.tRep], () => {
    const sys = game.fourththing?.rolls?.checkFormula;
    if (typeof sys !== "function") return WARN(`system checkFormula missing; adapter returns ${dice?.checkFormula?.()} (old fallback "2d10x10")`);
    const a = dice.checkFormula(), b = sys();
    return a === b ? PASS(a) : FAIL(`${a} vs ${b}`);
  });
  await step("RN3", G.rn, "harvest API + RFI items API (stub defaults) present", F.nodes, () => {
    const T = game.bbttcc?.api?.territory;
    if (typeof T?.harvestHexNode !== "function") return FAIL("api.territory.harvestHexNode missing");
    const items = game.fourththing?.items;
    return typeof items?.defaults === "function" ? PASS("game.fourththing.items.defaults present → RFI gear stub as before") : WARN("game.fourththing.items.defaults missing → stub now omits RfiItems defaults instead of throwing");
  });

  /* ══ 16 TRAVEL ══════════════════════════════════════════════════════════════ */
  const TD = game.bbttcc?.api?.travel?.domains;
  await step("TR1", G.tr, "travel.domains.rigDomains(rig) = old raw read", F.travel, () => {
    if (typeof TD?.rigDomains !== "function") return FAIL("api.travel.domains.rigDomains missing");
    if (!rigsRaw.length) return noRigs();
    const old = (a) => { const raw = rawSys(a)?.travel?.domains; const l = Array.isArray(raw) ? raw.map(d => String(d).toLowerCase()).filter(Boolean) : []; return l.length ? l : ["land"]; };
    const bad = rigsRaw.filter(a => !eq(TD.rigDomains(a), old(a)));
    return bad.length ? FAIL(bad.map(a => a.name).join(", ")) : PASS(`${rigsRaw.length} rigs`);
  });
  await step("TR2", G.tr, "travel.domains.factionRigs(fid) = old type/mobility/owner filter, per faction", F.travel, () => {
    if (typeof TD?.factionRigs !== "function") return FAIL("factionRigs missing");
    if (!factions.length) return noFactions();
    const old = (fid) => rigsRaw.filter(a => { const s = rawSys(a); if (String(s?.identity?.mobility || "mobile").toLowerCase() === "stationary") return false; return String(s?.identity?.factionOwnerId || "") === fid || flagOwner(a) === fid; }).map(a => a.id).sort();
    const diffs = factions.filter(f => !eq(TD.factionRigs(f.id).map(a => a.id).sort(), old(f.id)));
    return diffs.length ? FAIL(diffs.map(f => f.name).join(", ")) : PASS(`${factions.length} factions`);
  });
  await step("TR3", G.tr, "travel.domains.factionSubDepth(fid) = old max depthRating of owned water-sub rigs", F.travel, () => {
    if (typeof TD?.factionSubDepth !== "function") return FAIL("factionSubDepth missing");
    if (!factions.length) return noFactions();
    const diffs = [];
    for (const f of factions) {
      let best = -1;
      for (const a of TD.factionRigs(f.id)) { const d = rawSys(a)?.travel?.domains; if (!(Array.isArray(d) ? d.map(x => String(x).toLowerCase()) : ["land"]).includes("water-sub")) continue; best = Math.max(best, Number(rawSys(a)?.travel?.depthRating ?? 0) || 0); }
      if (TD.factionSubDepth(f.id) !== best) diffs.push(`${f.name}: ${TD.factionSubDepth(f.id)} vs ${best}`);
    }
    return diffs.length ? FAIL(diffs.join("; ")) : PASS(`${factions.length} factions`);
  });
  await step("TR4", G.tr, "chase: rigSys = raw, side.factionId resolution old vs new, piloting check delegates", F.chase, async () => {
    const CH = game.bbttcc?.api?.travel?.chase;
    if (typeof CH?.start !== "function" || typeof CH?.runLeg !== "function") return FAIL("api.travel.chase.start/runLeg missing");
    const notes = [];
    if (R && rigsRaw.some(a => R.data(a) !== rawSys(a))) return FAIL("rigSys ≠ raw on a rig");
    const diff = rigsRaw.filter(a => { const s = rawSys(a); const old = s?.identity?.factionOwnerId ?? a.flags?.["bbttcc-factions"]?.factionId ?? null; const neu = (R?.ownerOf?.(a) || null) ?? s?.identity?.factionOwnerId ?? a.flags?.["bbttcc-factions"]?.factionId ?? null; return String(old ?? "") !== String(neu ?? ""); });
    if (diff.length) notes.push(`side.factionId differs for ${diff.map(a => a.name).join(", ")} (empty system owner → flag)`);
    const pilot = characters[0];
    if (pilot) {
      const spy = await withSpy(game.fourththing?.rolls, "skillCheck", { total: 0, isFumble: false }, () => (game.bbttcc?.dice?.skillCheck ?? game.fourththing?.rolls?.skillCheck)(pilot, { skill: "piloting", label: "rfi-smoke" }));
      if (spy.skipped) notes.push(`skillCheck spy skipped (${spy.why ?? "no system skillCheck"})`);
      else if (spy.calls.length !== 1 || spy.calls[0][0] !== pilot || spy.calls[0][1]?.skill !== "piloting" || spy.calls[0][1]?.label !== "rfi-smoke") return FAIL(`dice.skillCheck did not delegate verbatim: ${short(spy.calls.map(c => c[1]))}`);
    }
    return notes.length ? WARN(notes.join(" · ")) : PASS(`${rigsRaw.length} rigs · piloting → game.fourththing.rolls.skillCheck`);
  });

  /* ══ 17 MARKET ══════════════════════════════════════════════════════════════ */
  await step("M1", G.mk, "market API present; rig deliveries own via rigs.setOwner (same system key)", F.market, () => {
    const M = game.bbttcc?.api?.market;
    if (typeof M?.purchase !== "function" || typeof M?.listCatalog !== "function") return FAIL("api.market.purchase/listCatalog missing");
    if (typeof R?.setOwner !== "function") return FAIL("rigs.setOwner missing — rig deliveries would be created UNOWNED (rigOwnerPending needs the accessor)");
    let rigEntries = 0;
    try { rigEntries = M.listCatalog().filter(e => /rig/i.test(String(e?.actorType ?? e?.type ?? e?.kind ?? ""))).length; } catch (_e) {}
    return WARN(`OK · NOTE rig deliveries now Actor.create UNOWNED then setOwner (2 writes; createActor listeners see no owner; flag mirror added) · ~${rigEntries} rig-ish catalog entries`);
  });

  /* ══ 18 AUTO-LINK BUILDERS ══════════════════════════════════════════════════ */
  await step("AL1", G.al, "rigBuilder.seedFromActor: non-null for every rig, null for non-rigs, reads raw system", F.rb, () => {
    const seed = game.bbttcc?.api?.rigBuilder?.seedFromActor;
    if (typeof seed !== "function") return FAIL("api.rigBuilder.seedFromActor missing");
    const nonRig = characters[0] ?? actors.find(a => a.type !== "rig");
    if (nonRig && seed(nonRig) !== null) return FAIL(`seedFromActor(${nonRig.name}) not null`);
    if (!rigsRaw.length) return PASS("non-rig → null (no rigs to seed)");
    const bad = rigsRaw.filter(a => { try { return !seed(a); } catch { return true; } });
    return bad.length ? FAIL(`null/throw for ${bad.map(a => a.name).join(", ")}`) : PASS(`${rigsRaw.length} rigs seed`);
  });
  await step("AL2", G.al, "monsterBuilder present; feature/gear item types unchanged on RFI", [F.mb, F.rb], () => {
    if (typeof game.bbttcc?.api?.monsterBuilder?.open !== "function") return FAIL("api.monsterBuilder.open missing");
    const T = game.bbttcc?.types;
    return T?.item("feature") === "feature" && T?.item("gear") === "gear" ? PASS() : FAIL(`feature→${T?.item("feature")} gear→${T?.item("gear")}`);
  });
  await step("AL3", G.al, "rig items flagged rig-weapon are type weapon (so _rigItemForSystem never retypes on RFI)", F.rb, () => {
    if (!R) return SKIP("no accessor");
    if (!rigsRaw.length) return noRigs();
    const bad = []; let n = 0;
    for (const a of rigsRaw) for (const i of a.items) if (R.gearOf(i)?.subtype === "rig-weapon") { n++; if (i.type !== "weapon") bad.push(`${a.name}/${i.name}(${i.type})`); }
    return bad.length ? WARN(`re-minting these would retype gear→weapon on RFI: ${bad.join(", ")}`) : PASS(`${n} rig-weapon items, all type weapon`);
  });

  /* ══ 19 ONBOARDING ══════════════════════════════════════════════════════════ */
  await step("OB1", G.ob, "tour rig resolution: listByFaction(fid)[0] vs old first system-owner match", F.tour, () => {
    if (!R) return SKIP("no accessor");
    if (!factions.length) return noFactions();
    const diffs = factions.filter(f => (R.listByFaction(f.id)[0]?.id ?? null) !== (rigsRaw.find(a => String(rawSys(a)?.identity?.factionOwnerId || "") === f.id)?.id ?? null));
    return diffs.length ? WARN(`${diffs.map(f => f.name).join(", ")}${driftNote()}`) : PASS(`${factions.length} factions`);
  });

  /* ══ 20 CAMPAIGN ════════════════════════════════════════════════════════════ */
  await step("C1", G.camp, "rigTransfer: RG.list() vs old (type rig || flags.fourththing.kind==='rig'); prev owner old flag vs ownerOf", F.wme, () => {
    if (!R) return SKIP("no accessor");
    const oldSet = actors.filter(a => a.type === "rig" || a.flags?.fourththing?.kind === "rig");
    const lost = oldSet.filter(a => !R.isRig(a));
    const prevDiff = rigsRaw.filter(a => strip(R.ownerOf(a) || flagOwner(a)) !== strip(flagOwner(a)));
    const notes = [];
    if (lost.length) notes.push(`by-name rigTransfer no longer finds non-rig actors cached as kind 'rig': ${lost.map(a => `${a.name}(${a.type})`).join(", ")}`);
    if (prevDiff.length) notes.push(`prev-owner read differs (system key now wins) for ${prevDiff.map(a => a.name).join(", ")}`);
    return notes.length ? WARN(notes.join(" · ")) : PASS(`${oldSet.length} rigs resolvable`);
  });
  await step("C2", G.camp, "courtly-secrets pack (WME secret grant) resolves identically", F.wme, () => {
    const id = "bbttcc-master-content.courtly-secrets";
    const neu = game.bbttcc?.packs?.get?.(id) ?? (game.packs ? game.packs.get(id) : null);
    return (neu ?? null) === (game.packs.get(id) ?? null) ? PASS(neu ? neu.collection : "pack absent (same as before)") : FAIL("different pack");
  });
  await step("C3", G.camp, "beat editor spark link options: new index query = old list", F.be, async () => {
    const id = "bbttcc-tikkun.sparks";
    const oldPack = game.packs.get(id);
    const neuPack = game.bbttcc?.packs?.get?.(id) ?? game.packs.get(id);
    if (!oldPack) return SKIP("bbttcc-tikkun.sparks not registered");
    if (neuPack !== oldPack) return FAIL("packs.get(sparks) ≠ game.packs.get");
    const oIdx = await oldPack.getIndex({ fields: ["name", "type", "system.sephirah", "system.kind", "flags.bbttcc-tikkun.identifier"] });
    const old = [...oIdx].filter(e => String(e.type || "").toLowerCase() === "spark").map(e => `Compendium.bbttcc-tikkun.sparks.Item.${e._id}`).sort();
    const nIdx = await neuPack.getIndex({ fields: ["name", "type", "system.sephirah", "system.kind", "flags.bbttcc-tikkun.identifier", "flags.bbttcc-tikkun.spark.sephirah"] });
    const neu = [...nIdx].filter(e => String(e.type || "").toLowerCase() === "spark" || !!e.flags?.["bbttcc-tikkun"]?.spark).map(e => `Compendium.${neuPack.collection}.Item.${e._id}`).sort();
    return eq(old, neu) ? PASS(`${neu.length} spark options`) : FAIL(`old ${old.length} vs new ${neu.length}`);
  });

  /* ══ 21 TIKKUN ══════════════════════════════════════════════════════════════ */
  const TK = game.bbttcc?.api?.tikkun;
  const sparkPack = game.packs.get("bbttcc-tikkun.sparks");
  let sparkDocs = [];
  try { if (sparkPack) sparkDocs = await sparkPack.getDocuments(); } catch (e) { console.warn(TAG, "spark docs load failed", e); }
  const sparkSys = (it) => (it?.system?.sephirah ? it.system : (it?.flags?.["bbttcc-tikkun"]?.spark ?? it?.system ?? {}));   // verbatim from the HEAD files
  await step("K1", G.tik, "resolveSparkItem: identifier, short id and full UUID → same doc; unknown UUID → null", F.tApi, async () => {
    if (typeof TK?.resolveSparkItem !== "function") return FAIL("api.tikkun.resolveSparkItem missing");
    if (!sparkDocs.length) return SKIP("no docs in bbttcc-tikkun.sparks");
    const d = sparkDocs.find(x => x.flags?.["bbttcc-tikkun"]?.identifier) ?? sparkDocs[0];
    const ident = d.flags?.["bbttcc-tikkun"]?.identifier;
    const out = [];
    if (ident) out.push(["identifier", (await TK.resolveSparkItem(ident))?.id]);
    out.push(["shortId", (await TK.resolveSparkItem(d.id))?.id]);
    out.push(["uuid", (await TK.resolveSparkItem(d.uuid))?.id]);
    const ghost = await TK.resolveSparkItem("Compendium.bbttcc-tikkun.sparks.Item.rfiSmokeNoSuchId");
    const bad = out.filter(([, id]) => id !== d.id);
    if (bad.length) return FAIL(`${bad.map(([k, id]) => `${k}→${id}`).join(", ")} (want ${d.id})`);
    return ghost === null ? PASS(`${d.name} via ${out.map(o => o[0]).join("/")}`) : FAIL(`unknown UUID resolved to ${ghost?.name} (twin fallback misfired on RFI)`);
  });
  await step("K2", G.tik, "_sparkSys(item) = item.system for every spark doc (sephirah/kind/repair)", [F.tApi, F.tBeat, F.tRep], () => {
    if (!sparkDocs.length) return SKIP("no spark docs");
    const bad = sparkDocs.filter(d => { const s = sparkSys(d); return s.sephirah !== d.system?.sephirah || s.kind !== d.system?.kind || !eq(s.repair, d.system?.repair); });
    return bad.length ? WARN(`flag block wins over system for: ${bad.map(d => d.name).join(", ")} (no system.sephirah)`) : PASS(`${sparkDocs.length} spark docs`);
  });
  await step("K3", G.tik, "checkMethodAlignment(tag, item) = old (item.system) for every tag × spark", F.tApi, () => {
    if (typeof TK?.checkMethodAlignment !== "function") return FAIL("api.tikkun.checkMethodAlignment missing");
    if (!sparkDocs.length) return SKIP("no spark docs");
    const tags = ["violence", "intrigue", "diplomacy", "softpower", "faith", "economy", "logistics", "nonlethal", "siege", "soul", "body"];
    const bad = [];
    for (const d of sparkDocs) for (const t of tags) { const neu = TK.checkMethodAlignment(t, d), old = TK.checkMethodAlignment(t, d.system ?? {}); if (neu !== old) bad.push(`${d.name}/${t}: ${neu} vs ${old}`); }
    return bad.length ? FAIL(bad.slice(0, 8).join("; ")) : PASS(`${sparkDocs.length} × ${tags.length}`);
  });
  await step("K4", G.tik, "repair ritual bonus: dice.skillBonus(c,'ritual','soul') = old ritual rank + soul (default 2)", F.tRep, () => {
    if (!dice) return FAIL("dice missing");
    if (!characters.length) return noChars();
    const bad = [], softened = [];
    for (const c of characters) {
      const s = rawSys(c);
      const old = Number(s.skills?.ritual?.value ?? 0) + Number(s.attributes?.soul?.value ?? 2);
      const neu = dice.skillBonus(c, "ritual", "soul");
      if (old !== neu) (s.attributes?.soul?.value == null ? softened : bad).push(`${c.name}: ${old}→${neu}`);
    }
    if (bad.length) return FAIL(bad.slice(0, 8).join("; "));
    return softened.length ? WARN(`soul missing → old defaulted 2, new 0: ${softened.join("; ")}`) : PASS(`${characters.length} characters`);
  });
  await step("K5", G.tik, "repair chat card references only declared identifiers (static scan of served file)", F.tRep, async () => {
    const src = srcCache.get("modules/bbttcc-tikkun/scripts/tikkun-repair.enhancer.js") ?? await fetchSrc("modules/bbttcc-tikkun/scripts/tikkun-repair.enhancer.js");
    if (src instanceof Error) return FAIL(src.message);
    const undeclared = ["ritRank", "soulAttr"].filter(v => new RegExp(`\\$\\{${v}\\}`).test(src) && !new RegExp(`\\b(const|let|var)\\s+${v}\\b`).test(src));
    return undeclared.length
      ? FAIL(`\${${undeclared.join("}, ${")}} used in the _executeRepairRoll chat card but no longer declared → ReferenceError AFTER materials/OP are debited and spark state is saved: no chat card, no bbttcc:spark:repaired hook (tikkun-repair.enhancer.js ~L410)`)
      : PASS();
  });
  await step("K6", G.tik, "ritual round roll uses the system check die", F.tRit, () => {
    const a = dice?.checkFormula?.() ?? game.fourththing?.rolls?.checkFormula?.() ?? "2d10x10";
    const b = game.fourththing?.rolls?.checkFormula?.() || "2d10x10";
    return a === b ? PASS(a) : FAIL(`${a} vs old ${b}`);
  });
  await step("K7", G.tik, "tikkun ledger / ritual entry points present", [F.tRep, F.tApi], () => {
    const miss = ["openRepairLedger", "openRepairRitual", "openDepositLedger", "gatherSpark", "markSparkPhase"].filter(k => typeof TK?.[k] !== "function");
    return miss.length ? FAIL(`missing: ${miss.join(", ")}`) : PASS();
  });

  /* ══ 22 BANKS LOOT ══════════════════════════════════════════════════════════ */
  await step("L1", G.loot, "crack-the-container check delegates to the system skillCheck (label passes through)", F.loot, async () => {
    if (!game.modules.get("bbttcc-banks")?.active) return SKIP("bbttcc-banks not active in this world");
    if (typeof game.bbttcc?.api?.banks?.openLoot !== "function") return FAIL("api.banks.openLoot missing");
    const who = characters[0];
    if (!who) return noChars();
    const fn = () => (game.bbttcc?.dice?.skillCheck ?? game.fourththing?.rolls?.skillCheck)(who, { skill: "tinkering", label: "Crack the crate — tinkering vs DC 12" });
    const spy = await withSpy(game.fourththing?.rolls, "skillCheck", { total: 13 }, fn);
    if (spy.skipped) return SKIP(`spy not installable (${spy.why ?? "no system skillCheck"})`);
    const c = spy.calls[0]?.[1] ?? {};
    return spy.calls.length === 1 && c.skill === "tinkering" && /Crack the crate/.test(c.label ?? "") && spy.out?.total === 13 ? PASS("→ game.fourththing.rolls.skillCheck") : FAIL(short(spy.calls.map(x => x[1])));
  });
  await step("L2", G.loot, "downed-NPC test keeps the RFI branch (dnd5e HP branch gated on system id)", F.loot, () =>
    game.system.id === "fourththing" ? PASS("system.derived integrity/stress path") : FAIL());

  /* ══ 23 AE KEYS ═════════════════════════════════════════════════════════════ */
  await step("AE1", G.ae, "aeKey / aeChanges are identity on RFI for every RFI channel", [F.enl, F.rad, F.dice], () => {
    if (!dice?.aeKey) return FAIL("dice.aeKey missing");
    const keys = [...Object.keys(dice.AE_KEYS ?? {}), ...Object.keys(dice.SKILLS ?? {}).map(s => `system.skills.${s}.value`), ...ATTRS.map(a => `system.attributes.${a}.value`), "flags.bbttcc.enlightenment.opRegenBonus"];
    const bad = keys.filter(k => dice.aeKey(k) !== k);
    const changes = keys.map((k, i) => ({ key: k, mode: 2, value: String(i), priority: 20 }));
    if (bad.length) return FAIL(`translated on RFI: ${bad.join(", ")}`);
    return eq(dice.aeChanges(changes), changes) ? PASS(`${keys.length} keys`) : FAIL("aeChanges altered a change row");
  });
  await step("AE2", G.ae, "no enlightenment / mutation AE in the world carries a dnd5e-twin key", [F.enl, F.rad], () => {
    const twin = new Set(Object.values(dice?.AE_KEYS ?? {}));
    const twinRx = /^system\.(skills|tools)\.[a-z]+\.bonuses\.check$|^system\.abilities\.(str|dex|con|int|wis|cha)\.(value|bonuses\.save)$/;
    const hits = []; let scanned = 0;
    for (const a of actors) for (const e of a.effects ?? []) {
      const enl = e.flags?.["bbttcc-character-options"]?.enlightenment, mut = e.flags?.["bbttcc-radiation"]?.mutation;
      if (!enl && !mut) continue;
      scanned++;
      for (const ch of e.changes ?? []) if (twin.has(ch.key) || twinRx.test(ch.key)) hits.push(`${a.name}/${e.name}: ${ch.key}`);
    }
    return hits.length ? FAIL(hits.slice(0, 8).join("; ")) : PASS(`${scanned} enlightenment/mutation effects scanned`);
  });
  await step("AE3", G.ae, "radiation mutations API present", F.rad, () => {
    const M = game.bbttcc?.api?.radiation?.mutations;
    const miss = ["list", "add", "remove", "clear"].filter(k => typeof M?.[k] !== "function");
    return miss.length ? FAIL(`missing: ${miss.join(", ")}`) : PASS();
  });

  /* ══ 24 DICE ADAPTER (fourththing path) ═════════════════════════════════════ */
  await step("DC1", G.dice, "checkFormula(normal/advantage/disadvantage) = system formula", F.dice, () => {
    const sys = game.fourththing?.rolls?.checkFormula;
    if (typeof sys !== "function") return WARN("system checkFormula missing (adapter falls back to 2d10x10)");
    const bad = ["normal", "advantage", "disadvantage"].filter(m => dice.checkFormula({ mode: m }) !== sys({ mode: m, explode: true }));
    return bad.length ? FAIL(`differs for ${bad.join(", ")}`) : PASS(["normal", "advantage", "disadvantage"].map(m => sys({ mode: m })).join(" | "));
  });
  await step("DC2", G.dice, "skillCheck forwards {skill, attribute, label} to game.fourththing.rolls.skillCheck", F.dice, async () => {
    const who = characters[0];
    if (!who) return noChars();
    const spy = await withSpy(game.fourththing?.rolls, "skillCheck", { total: 7, isFumble: false }, () => dice.skillCheck(who, { skill: "faith", attribute: "soul", label: "rfi-smoke" }));
    if (spy.skipped) return SKIP(`spy not installable (${spy.why ?? "no system skillCheck"})`);
    const c = spy.calls[0];
    return spy.calls.length === 1 && c[0] === who && eq(c[1], { skill: "faith", attribute: "soul", label: "rfi-smoke" }) && spy.out?.total === 7 ? PASS() : FAIL(short(spy.calls.map(x => x[1])));
  });
  await step("DC3", G.dice, "flatCheck forwards to game.fourththing.rolls.flatCheck", F.dice, async () => {
    const spy = await withSpy(game.fourththing?.rolls, "flatCheck", { total: 9, ok: true }, () => dice.flatCheck({ bonus: 2, dc: 10, label: "rfi-smoke" }));
    if (spy.skipped) return SKIP(`spy not installable (${spy.why ?? "no system flatCheck"})`);
    const c = spy.calls[0]?.[0] ?? {};
    return spy.calls.length === 1 && c.bonus === 2 && c.dc === 10 && c.label === "rfi-smoke" ? PASS() : FAIL(short(spy.calls));
  });
  await step("DC4", G.dice, "abilityKey identity; skillBonus = attribute + rank (RFI contract), per character", F.dice, () => {
    const badKey = ATTRS.filter(a => dice.abilityKey(a) !== a);
    if (badKey.length) return FAIL(`abilityKey translated: ${badKey.join(", ")}`);
    if (!characters.length) return noChars();
    const bad = [];
    for (const c of characters) for (const [sk, v] of Object.entries(rawSys(c).skills ?? {})) {
      const want = (Number(rawSys(c).attributes?.[v?.attribute || "violence"]?.value) || 0) + (Number(v?.value) || 0);
      if (dice.skillBonus(c, sk) !== want) bad.push(`${c.name}.${sk}: ${dice.skillBonus(c, sk)} vs ${want}`);
    }
    return bad.length ? FAIL(bad.slice(0, 8).join("; ")) : PASS(`${characters.length} characters`);
  });

  /* ══ 25 WRITE PROBES ════════════════════════════════════════════════════════ */
  const W_IDS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10"];
  if (!RFI_SMOKE_WRITES) {
    await step("W*", G.w, "write probes", [F.rigs, F.rb, F.stApi, F.sow, F.town, F.rad, F.market], () => SKIP("RFI_SMOKE_WRITES=false (read-only run)"));
  } else if (!R?.create) {
    for (const id of W_IDS) await step(id, G.w, "write probe", F.rigs, () => SKIP("accessor missing"));
  } else {
    const made = new Set();
    const track = (a) => { if (a?.id) made.add(a.id); return a; };
    try {
      let probe = null;
      await step("W1", G.w, "rigs.create → native fourththing rig with the spec'd fields", F.rigs, async () => {
        probe = track(await R.create({ name: `${PROBE} Rig`, identity: { mobility: "hybrid" }, integrity: { bracket: "medium", tier: 2 }, travel: { domains: ["land", "water-sub", "space"], depthRating: 2, speed: 3 }, tags: ["rfi-smoke"] }));
        if (!probe) return FAIL("create returned null");
        const d = R.data(probe);
        const ok = probe.type === "rig" && R.isRig(probe) && d.identity.mobility === "hybrid" && d.integrity.bracket === "medium" && Number(d.integrity.tier) === 2 && d.travel.domains.includes("space") && Number(d.travel.depthRating) === 2;
        return ok ? PASS(`${probe.id} · integrity ${d.integrity.value}/${d.integrity.max}`) : FAIL(short(d));
      });
      await step("W2", G.w, "setOwner(fake) → both owner keys; travel/orbital/holdings see it", [F.rigs, F.travel, F.orb, F.hexSheet], async () => {
        if (!probe) return SKIP("W1 failed");
        await R.setOwner(probe, `Actor.${FAKE_FID}`);
        const sysK = probe.system?.identity?.factionOwnerId, flagK = probe.flags?.["bbttcc-factions"]?.factionId;
        if (sysK !== FAKE_FID || flagK !== FAKE_FID) return FAIL(`system=${sysK} flag=${flagK}`);
        const notes = [];
        if (!R.listByFaction(FAKE_FID).some(a => a.id === probe.id)) notes.push("listByFaction miss");
        if (TD?.factionRigs && !TD.factionRigs(FAKE_FID).some(a => a.id === probe.id)) notes.push("factionRigs miss");
        if (TD?.factionSubDepth && TD.factionSubDepth(FAKE_FID) !== 2) notes.push(`subDepth ${TD.factionSubDepth(FAKE_FID)}`);
        const fob = game.bbttcc?.api?.raid?.findOrbitalBunker;
        if (fob && fob(FAKE_FID)?.id !== probe.id) notes.push("findOrbitalBunker miss");
        if (H?.classify && H.classify(probe) !== "rig") notes.push(`classify ${H.classify(probe)}`);
        if (H?.bonusForActor && H.bonusForActor(probe)?.bonus !== H.RIG_BONUS?.medium) notes.push("bonus");
        return notes.length ? FAIL(notes.join(", ")) : PASS();
      });
      await step("W3", G.w, "rigs.update integrity.value → system.integrity.value", F.rigs, async () => {
        if (!probe) return SKIP("W1 failed");
        await R.update(probe, { "integrity.value": 7 });
        return Number(probe.system?.integrity?.value) === 7 ? PASS() : FAIL(`integrity ${short(probe.system?.integrity)}`);
      });
      await step("W4", G.w, "structures.crew.retypeFortification(probe) zeroes the crew schema", F.stApi, async () => {
        const fn = game.bbttcc?.api?.structures?.crew?.retypeFortification;
        if (!probe || typeof fn !== "function") return SKIP("no probe / API");
        const r = await fn(probe);
        const c = probe.system?.crew ?? {};
        const zero = Object.values(c.capacity ?? {}).every(v => v?.min === 0 && v?.max === 0);
        return r?.ok && zero && Array.isArray(c.slots) && !c.slots.length && c.crewMin === 0 && c.crewMax === 0 ? PASS() : FAIL(`${short(r)} · ${short(c)}`);
      });
      await step("W5", G.w, "siege capture patch (toUpdate + siegeFate in one write)", [F.sow, F.sev], async () => {
        if (!probe) return SKIP("W1 failed");
        await probe.update({ ...R.toUpdate(probe, { "identity.factionOwnerId": FAKE_FID2 }), "flags.bbttcc-raid.siegeFate": { fate: "captured", by: FAKE_FID2, siegeId: "rfi-smoke", turn: 0 } });
        return probe.system?.identity?.factionOwnerId === FAKE_FID2 && probe.flags?.["bbttcc-factions"]?.factionId === FAKE_FID2 && probe.flags?.["bbttcc-raid"]?.siegeFate?.fate === "captured" ? PASS() : FAIL(short({ s: probe.system?.identity, f: probe.flags?.["bbttcc-factions"] }));
      });
      await step("W6", G.w, "townbuilder binding patch writes system.identity.binding.hexId", F.town, async () => {
        if (!probe) return SKIP("W1 failed");
        await probe.update(R.toUpdate(probe, { "identity.binding.hexId": "rfiSmokeHex" }));
        return probe.system?.identity?.binding?.hexId === "rfiSmokeHex" ? PASS() : FAIL(short(probe.system?.identity?.binding));
      });
      await step("W7", G.w, "rigBuilder.seedFromActor(probe) reflects the probe", F.rb, () => {
        const seed = game.bbttcc?.api?.rigBuilder?.seedFromActor;
        if (!probe || typeof seed !== "function") return SKIP("no probe / API");
        const s = seed(probe);
        return s ? PASS(short(s, 160)) : FAIL("null seed");
      });
      await step("W8", G.w, "rigBuilder.mintFromChassis('hexmobile', free, unowned) → RFI rig + flags + loadout", F.rb, async () => {
        const mint = game.bbttcc?.api?.rigBuilder?.mintFromChassis;
        if (typeof mint !== "function") return SKIP("mintFromChassis missing");
        const a = track(await mint("hexmobile", { factionOwnerId: "", free: true, overrides: { name: `${PROBE} Hexmobile` } }));
        if (!a) return FAIL("mint returned null");
        const notes = [];
        if (a.type !== "rig") notes.push(`type ${a.type}`);
        if (!a.flags?.["bbttcc-auto-link"]?.createdViaRigBuilder) notes.push("auto-link flags missing (follow-up update)");
        if (a.flags?.fourththing?.kind && a.flags.fourththing.kind !== (game.bbttcc?.api?.actorKind?.(a) ?? a.flags.fourththing.kind)) notes.push(`kind cache stale: ${a.flags.fourththing.kind}`);
        const weaponsRetyped = a.items.filter(i => R.gearOf(i)?.subtype === "rig-weapon" && i.type !== "weapon");
        if (weaponsRetyped.length) notes.push(`rig-weapon not weapon: ${weaponsRetyped.map(i => i.name)}`);
        const badTypes = a.items.filter(i => !(Item.TYPES ?? []).includes(i.type));
        if (badTypes.length) notes.push(`invalid item types: ${badTypes.map(i => i.type)}`);
        return notes.length ? FAIL(notes.join("; ")) : PASS(`${a.items.size} items · frame=${R.frameOf(a)?.name ?? "none"} · img=${a.img}`);
      });
      await step("W9", G.w, "radiation mutation AE keeps the RFI key", F.rad, async () => {
        const M = game.bbttcc?.api?.radiation?.mutations;
        if (typeof M?.add !== "function") return SKIP("mutations API missing");
        // the onboarding Steward Forge treats ANY new character created while its wizard is open as the forged steward
        if (document.querySelector('[class*="bbttcc-twv2"]')) return SKIP("onboarding Steward Forge wizard is open — a probe character would be adopted as the steward");
        const c = track(await Actor.create({ name: `${PROBE} Steward`, type: "character" }));
        await M.add(c, { name: "RFI Smoke Mutation", effects: [{ key: "system.derived.guard.aeBonus", value: 1 }] });
        const e = c.effects.find(x => x.flags?.["bbttcc-radiation"]?.mutation);
        if (!e) return FAIL("no mutation AE created");
        return e.changes?.[0]?.key === "system.derived.guard.aeBonus" ? PASS() : FAIL(`key ${e.changes?.[0]?.key}`);
      });
      await step("W10", G.w, "market-style delivery: create unowned rig then setOwner → same final owner", F.market, async () => {
        const a = track(await Actor.create({ name: `${PROBE} Market Rig`, type: "rig" }));
        if (!R.isRig(a)) return FAIL("not a rig");
        await R.setOwner(a, FAKE_FID);
        return a.system?.identity?.factionOwnerId === FAKE_FID ? PASS() : FAIL(short(a.system?.identity));
      });
    } finally {
      const ids = [...made].filter(id => String(game.actors.get(id)?.name ?? "").startsWith(PROBE));
      try { if (ids.length) await Actor.deleteDocuments(ids); console.log(TAG, `deleted ${ids.length} probe actor(s)`); }
      catch (e) { console.warn(TAG, "probe teardown failed — delete actors named 'RFI Smoke Probe *' by hand", e); }
      const strays = [...made].filter(id => game.actors.get(id) && !ids.includes(id));
      if (strays.length) console.warn(TAG, "probe actors NOT deleted (name changed?):", strays);
    }
  }

  /* ══ 26 CONSOLE ERRORS ══════════════════════════════════════════════════════ */
  console.error = origError;
  window.removeEventListener("error", onWinErr);
  window.removeEventListener("unhandledrejection", onRej);
  await step("E1", G.err, "console.error / uncaught errors during the run", "all", () =>
    captured.length ? FAIL(`${captured.length}: ${captured.slice(0, 6).map(c => `[${c.kind}] ${c.text}`).join(" | ")}`) : PASS("none"));

  /* ── summary ─────────────────────────────────────────────────────────────── */
  const count = (s) => rows.filter(r => r.status === s).length;
  const summary = { pass: count("PASS"), fail: count("FAIL"), warn: count("WARN"), skip: count("SKIP"), total: rows.length, groups: new Set(rows.map(r => r.group)).size, ms: Math.round(performance.now() - t0), writes: RFI_SMOKE_WRITES };
  const result = { summary, rows, errors: captured, ranAt: new Date().toISOString(), world: game.world?.id, system: `${game.system.id} ${game.system.version}` };
  window.__rfiSmoke = result;
  console.table(rows.map(r => ({ id: r.id, status: r.status, group: r.group, step: r.step, files: r.files, detail: r.detail })));
  console.log(TAG, `DONE · ${summary.pass} pass · ${summary.fail} FAIL · ${summary.warn} warn · ${summary.skip} skip · ${summary.groups} groups · ${summary.ms} ms → window.__rfiSmoke`);

  if (RFI_SMOKE_CHAT) {
    const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
    const color = { PASS: "#4caf50", FAIL: "#ff5252", WARN: "#e0b000", SKIP: "#9e9e9e" };
    const shown = rows.filter(r => !(r.group === G.src && r.status === "PASS"));   // collapse the 46 green source markers
    const srcPass = rows.filter(r => r.group === G.src && r.status === "PASS").length;
    let html = `<div class="bbttcc-rfi-smoke"><h3>RFI Smoke</h3><p><b>${summary.pass} pass · ${summary.fail} fail · ${summary.warn} warn · ${summary.skip} skip</b> (${summary.total} steps, ${summary.groups} groups, ${summary.ms} ms${RFI_SMOKE_WRITES ? ", writes ON" : ""})</p><p><small>${srcPass}/${MARKERS.length} deployed source markers green</small></p>`;
    let grp = null;
    for (const r of shown) {
      if (r.group !== grp) { if (grp) html += `</ol>`; grp = r.group; html += `<h4 style="margin:.4em 0 .1em">${esc(grp)}</h4><ol style="padding-left:1.2em;margin:0">`; }
      html += `<li style="color:${color[r.status]}"><b>${r.status}</b> ${esc(r.id)} ${esc(r.step)}${r.detail ? `<br><small>${esc(r.detail)}</small>` : ""}</li>`;
    }
    if (grp) html += `</ol>`;
    html += `</div>`;
    try { await ChatMessage.create({ content: html, whisper: [game.user.id], speaker: { alias: "RFI Smoke" } }); } catch (e) { console.warn(TAG, "chat card failed", e); }
  }
  ui.notifications?.[summary.fail ? "warn" : "info"]?.(`RFI smoke: ${summary.pass} pass · ${summary.fail} FAIL · ${summary.warn} warn · ${summary.skip} skip (window.__rfiSmoke)`);
  return result;
})();
