// modules/bbttcc-epic/scripts/repair.js
// Bad Eden — Epic Play · P3: WORLD-HEALTH + ACTS OF REPAIR
// The phase where the engine turns over. World-Health = % of hexes reunified & aligned
// (the Act-I win-track). Acts of Repair (align-hex, integrate-spark) raise World-Health AND
// Presence in the same motion — heal the world, and the world notices you harder.
//
// THE COUPLING: every act of repair calls presence.adjust(steward, +N, reason). That one
// line is the whole thesis. presence.adjust no-ops on non-converged, so only ascended
// Stewards draw Weight from repair — self-correcting.
//
// DESIGN: EPIC_P3_SPEC.md (v1.0). RFI-only. Additive — writes territory/faction flags directly
// and fires the SAME hooks the system uses; touches no other module's code.

const MOD = "bbttcc-epic";
const TER = "bbttcc-territory";
const FCT = "bbttcc-factions";
const NS  = "[bbttcc-epic/repair]";
const warn = (...a) => console.warn(NS, ...a);
const log  = (...a) => console.log(NS, ...a);

// ── OWNER-TUNABLE ────────────────────────────────────────────────────────────────
const ALIGN_DARKNESS_MAX  = 3;  // a hex counts "healed" if per-hex darkness ≤ this (matches Great Work maxDarkness)
const ALIGN_DARK_DROP     = 2;  // darkness removed when a hex is aligned (matches "Cleansed corruption −2" precedent)
const REPAIR_PRESENCE_HEX  = 1; // Presence gained per hex aligned
const REPAIR_PRESENCE_SPARK = 2; // Presence gained per spark integrated
const REACH_BY_BAND = { low: 1, mid: 2, high: 3, apex: 5 }; // repairs/turn (informational in P3; enforced P4)

function ftActive() { return game?.system?.id === "fourththing"; }
function isHexDoc(d) {
  const tf = d?.flags?.[TER];
  return tf?.isHex === true || tf?.kind === "territory-hex";
}

// ── Hex iteration (canonical board scenes when marked; every scene otherwise) ──────
// P3.1 (2026-09-01, owner ruling): the FIVE region scenes are the canonical
// board (141 hexes). Counting every scene inflated worldHealth.total to 336
// (duplicate Starting-Map copies + GOTTGAIT/arena/onboarding maps), leaving
// the 100% Malkuth seam unreachable. Scenes are marked with
// flags.bbttcc-epic.boardScene = true by tools/mark-canonical-board.macro.js.
// Fallback: a world with no marked scene keeps the old count-everything
// behavior so nothing breaks before the marking macro runs.
function boardScenes() {
  const all = game.scenes?.contents ?? [];
  const marked = all.filter(sc => sc.getFlag?.(MOD, "boardScene") === true);
  return marked.length ? marked : all;
}
function iterHexes() {
  const out = [];
  for (const sc of boardScenes()) for (const d of sc.drawings ?? []) if (isHexDoc(d)) out.push(d);
  return out;
}

// ── Protagonist factions (whose banner counts as "reunified") ──────────────────────
function protagonistFactionIds() {
  try {
    const override = game.settings.get(MOD, "protagonistFactions");
    if (Array.isArray(override) && override.length) return new Set(override);
  } catch (_e) {}
  const ids = new Set();
  for (const a of game.actors?.contents ?? []) {
    if (a.type === "character" && a.getFlag(MOD, "converged")?.value) {
      const fid = a.getFlag(FCT, "factionId");
      if (fid) ids.add(fid);
    }
  }
  return ids;
}
function repProtagonistFaction() {
  for (const id of protagonistFactionIds()) { const f = game.actors?.get(id); if (f) return f; }
  return null;
}

// ── Tikkun Dividend (arc-1 legacy meter, bbttcc-campaign) ──────────────────────────
// Earned by landmark campaign closers; relaxes the healed threshold below.
// Guarded read — 0 when the campaign module is absent.
function tikkunBonus() {
  try { return Number(game.bbttcc?.api?.campaign?.tikkun?.get?.() ?? 0) || 0; } catch (_e) { return 0; }
}

// ── "Aligned" predicate (OWNER-TUNABLE core dial) ──────────────────────────────────
// reunified (under a protagonist banner) AND healed (Purified OR per-hex darkness ≤ max).
// The Tikkun Dividend raises the max — redemption earned in arc 1 keeps paying.
function isHexAligned(d, protagonists) {
  const tf = d?.flags?.[TER] ?? {};
  // A seated-and-INTEGRATED Spark of Light is a standing temple: the hex holds
  // itself aligned regardless of banner or darkness (owner ruling 2026-09-01;
  // seat/integrate via bbttcc-tikkun's game.bbttcc.api.tikkun.hex).
  if (tf.spark?.state === "integrated") return true;
  const fid = tf.factionId || tf.ownerId || "";
  if (!fid || !protagonists.has(fid)) return false;
  const purified = Array.isArray(tf.conditions) && tf.conditions.includes("Purified");
  if (purified) return true;
  const faction = game.actors?.get(fid);
  const dark = Number(faction?.getFlag(FCT, "darkness")?.[d.id] ?? 0) || 0;
  return dark <= ALIGN_DARKNESS_MAX + tikkunBonus();
}

// ── World-Health (derived, cached in-memory, invalidated on change) ────────────────
let _whCache = null;
function computeWorldHealth() {
  const hexes = iterHexes();
  const total = hexes.length;
  const protagonists = protagonistFactionIds();
  let aligned = 0;
  if (protagonists.size) for (const d of hexes) if (isHexAligned(d, protagonists)) aligned++;
  const pct = total ? Math.round((100 * aligned) / total) : 0;
  return { pct, aligned, total, protagonists: [...protagonists] };
}
export function worldHealth() {
  if (!_whCache) _whCache = computeWorldHealth();
  return _whCache;
}

let _refreshTimer = null;
function scheduleWorldHealthRefresh() {
  if (_refreshTimer) return;
  _refreshTimer = setTimeout(() => { _refreshTimer = null; onWorldHealthRecomputed(); }, 200);
}
async function onWorldHealthRecomputed() {
  _whCache = null;
  const wh = worldHealth();
  await checkMalkuthSeam(wh);
  refreshOpenReadouts();
}

// ── Act-I win seam: Malkuth aligned at 100% ────────────────────────────────────────
async function checkMalkuthSeam(wh) {
  try {
    if (!game.user?.isGM) return; // one writer for the world latch + the beat
    const already = game.settings.get(MOD, "malkuthAligned");
    if (wh.total > 0 && wh.pct >= 100 && !already) {
      await game.settings.set(MOD, "malkuthAligned", true);
      Hooks.callAll("bbttcc:epic:malkuthAligned", { pct: wh.pct, aligned: wh.aligned, total: wh.total });
      await postMalkuthBeat(wh);
      log("MALKUTH ALIGNED — Act I complete.");
    } else if (wh.pct < 100 && already) {
      await game.settings.set(MOD, "malkuthAligned", false); // re-arm (a P4 fracture can drop below 100)
    }
  } catch (e) { warn("malkuth seam check failed", e); }
}
async function postMalkuthBeat(wh) {
  const content = `
    <div class="bbttcc-epic-beat is-keter">
      <div class="bbttcc-epic-beat-title">✦ MALKUTH ALIGNED ✦</div>
      <div class="bbttcc-epic-beat-body">Every hex reunified and made whole — the material Kingdom holds its shape at last. The Tree has a stable root. <em>The ascent lies open.</em></div>
      <div class="bbttcc-epic-beat-foot">World-Health 100% · ${wh.aligned}/${wh.total} hexes · Act I complete · Bad Eden — Epic Play</div>
    </div>`;
  await ChatMessage.create({ content });
}

// ── Reach — computed & shown in P3, enforced in P4 ─────────────────────────────────
export function reach(ref) {
  let bandInfo = { key: "low", label: "Low" };
  try { bandInfo = game.fourththing?.epic?.presence?.band?.(ref ?? repProtagonistFaction()) ?? bandInfo; } catch (_e) {}
  return { band: bandInfo.key, label: bandInfo.label, perTurn: REACH_BY_BAND[bandInfo.key] ?? 1 };
}

// ── Reach — ENFORCED (Descent Engine A1, spec §2.1) ────────────────────────────────
// The "informational in P3" era ends here (owner rulings 2026-09-02). Budget =
// REACH_BY_BAND[presence band] Acts of Repair per faction per Apply turn;
// alignHex and tikkun-hex integrations share the same budget. Counter lives at
// faction flags[bbttcc-epic].reachSpent, reset by the turn driver on Apply.
export function reachBudget(factionId) {
  const f = game.actors?.get(factionId) ?? null;
  const r = reach(f ?? undefined);
  const spent = Number(f?.getFlag?.(MOD, "reachSpent") ?? 0) || 0;
  return { budget: r.perTurn, spent, band: r.band, bandLabel: r.label, ok: spent < r.perTurn };
}
export async function tryDebitReach(factionId) {
  const b = reachBudget(factionId);
  if (!b.ok) return b;
  const f = game.actors?.get(factionId);
  if (f) await f.setFlag(MOD, "reachSpent", b.spent + 1);
  return { ...b, ok: true, spent: b.spent + 1 };
}

// ── Presence economics (Descent Engine A1) ─────────────────────────────────────────
// Effective Presence from an Act of Repair:
//  · masked stewards earn HALF, round up (Ruling 5 — dodge the Gaze or feed
//    the Work at full strength, not both)
//  · Shadowed+ personal Darkness dims the gain (FT.DARKNESS_BITE
//    presenceGainPenalty, spec §1.2), floor 0
function effectiveRepairPresence(steward, base) {
  let gain = Number(base) || 0;
  try { if (game.fourththing?.epic?.presence?.isMasked?.(steward)) gain = Math.ceil(gain / 2); } catch (_e) {}
  try { gain -= Number(game.fourththing?.darknessBite?.(steward)?.presenceGainPenalty || 0); } catch (_e) {}
  return Math.max(0, gain);
}

// ── Act of Repair: align a hex ─────────────────────────────────────────────────────
export async function alignHex(steward, hexUuid, _opts = {}) {
  if (!ftActive()) return null;
  if (!game.user?.isGM) { warn("alignHex requires GM (drawings are GM-owned)"); return null; }
  const doc = await fromUuid(hexUuid);
  if (!doc || !isHexDoc(doc)) { warn(`not a hex: ${hexUuid}`); return null; }
  const fid = steward?.getFlag?.(FCT, "factionId");
  if (!fid) { warn(`${steward?.name ?? "actor"} has no faction — cannot align`); return null; }

  // Reach gate (Descent A1): out of budget → the world refuses more repair
  // this turn. The chip already shows the band; this makes it true.
  const rb = reachBudget(fid);
  if (!rb.ok) {
    ui.notifications?.warn(`Reach exhausted: ${rb.spent}/${rb.budget} Acts of Repair this turn (Presence band ${rb.bandLabel}).`);
    return null;
  }

  const tf = doc.flags?.[TER] ?? {};
  const conditions = Array.isArray(tf.conditions) ? [...tf.conditions] : [];
  if (!conditions.includes("Purified")) conditions.push("Purified");
  const progress = Math.min(6, (Number(tf.integration?.progress) || 0) + 1);

  try {
    await doc.update({
      [`flags.${TER}.factionId`]: fid,
      [`flags.${TER}.status`]: "claimed",
      [`flags.${TER}.conditions`]: conditions,
      [`flags.${TER}.integration.progress`]: progress,
    });
  } catch (e) { warn("hex update failed", e); return null; }

  // Decrement per-hex darkness (stored on the faction actor, keyed by drawing id). Only touch
  // the faction when there's real darkness to clear — the hex already counts as aligned via the
  // "Purified" condition, so a clean hex needs no faction write (avoids a needless re-render +
  // the factions module's pre-existing V1-ActorSheet deprecation warning on every faction update).
  try {
    const faction = game.actors?.get(fid);
    const dmap = foundry.utils.duplicate(faction?.getFlag(FCT, "darkness") ?? {});
    const cur = Number(dmap[doc.id]) || 0;
    if (faction?.isOwner && cur > 0) {
      dmap[doc.id] = Math.max(0, cur - ALIGN_DARK_DROP);
      await faction.setFlag(FCT, "darkness", dmap);
    }
  } catch (e) { warn("darkness decrement failed", e); }

  try { Hooks.callAll("bbttcc:territory:hexUpdated", { hexUuid }); } catch (_e) {}
  await onWorldHealthRecomputed();

  // THE COUPLING — repair raises Presence (no-op if steward isn't Converged).
  // A1: gain filtered through masking (half) + Shadowed dimming (−1).
  try { await game.fourththing?.epic?.presence?.adjust?.(steward, effectiveRepairPresence(steward, REPAIR_PRESENCE_HEX), "align-hex"); }
  catch (e) { warn("presence coupling failed", e); }
  try { await tryDebitReach(fid); } catch (e) { warn("reach debit failed", e); }

  return worldHealth();
}

// ── Act of Repair: integrate a spark (thin wrapper; coupling via the deposit hook) ─
export async function integrateSpark(steward, sparkKey, factionId = null) {
  const api = game.bbttcc?.api?.tikkun;
  if (!api?.depositSpark) { warn("tikkun depositSpark unavailable"); return null; }
  const fid = factionId ?? steward?.getFlag?.(FCT, "factionId");
  try { return await api.depositSpark({ actorId: steward?.id, sparkKey, factionId: fid }); }
  catch (e) { warn("integrateSpark failed", e); return null; }
}

// Spark coupling — listen to tikkun's own signals rather than reimplementing the lifecycle.
function creditSparkRepair(info, reason) {
  try {
    const actorId = info?.actorId ?? info?.actor?.id ?? info?.steward?.id ?? null;
    const steward = actorId ? game.actors?.get(actorId) : null;
    if (steward) game.fourththing?.epic?.presence?.adjust?.(steward, effectiveRepairPresence(steward, REPAIR_PRESENCE_SPARK), reason);
    scheduleWorldHealthRefresh();
  } catch (e) { warn("spark coupling failed", e); }
}

// ── GM readout — World-Health chip on the Campaign Overview App ─────────────────────
function refreshOpenReadouts() {
  try {
    const seen = new Set();
    const bag = [...Object.values(ui.windows ?? {})];
    try { if (foundry.applications?.instances?.values) bag.push(...foundry.applications.instances.values()); } catch (_e) {}
    for (const app of bag) {
      if (!app || seen.has(app)) continue; seen.add(app);
      if (app?.constructor?.name === "BBTTCC_CampaignOverview") app.render(false);
    }
  } catch (_e) {}
}
function injectOverviewChip(app, element) {
  try {
    if (!ftActive() || !game.user?.isGM) return;
    const root = element?.jquery ? element[0] : element;
    if (!root?.querySelector) return;
    root.querySelector("#bbttcc-epic-worldhealth")?.remove();
    const wh = worldHealth();
    const r = reach(repProtagonistFaction());
    const chip = document.createElement("div");
    chip.id = "bbttcc-epic-worldhealth";
    chip.className = "bbttcc-epic-worldhealth";
    const label = wh.total
      ? `World-Health <b>${wh.pct}%</b> · ${wh.aligned}/${wh.total} hexes aligned · Reach ${r.perTurn}/turn (${r.label})`
      : `World-Health — no hexes found`;
    chip.innerHTML = `<span class="be-wh-mark">☉</span> ${label}`;
    const anchor = root.querySelector(".window-content") ?? root;
    anchor.insertBefore(chip, anchor.firstChild);
  } catch (e) { warn("overview chip failed", e); }
}

// ── Settings + hooks + API ─────────────────────────────────────────────────────────
Hooks.on("init", () => {
  if (game?.system?.id !== "fourththing") return;
  game.settings.register(MOD, "protagonistFactions", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(MOD, "malkuthAligned",      { scope: "world", config: false, type: Boolean, default: false });
});

Hooks.on("bbttcc:territory:hexUpdated", () => scheduleWorldHealthRefresh());
Hooks.on("bbttcc:advanceTurn:end", async (payload) => {
  scheduleWorldHealthRefresh();
  // Reach budgets reset on Apply turns (Descent A1; gate BOTH apply and isGM
  // per the house turn-contract rule).
  try {
    if (!payload?.apply || !game.user?.isGM) return;
    for (const a of game.actors?.contents ?? []) {
      if (!a.getFlag?.(MOD, "reachSpent")) continue;
      await a.unsetFlag(MOD, "reachSpent");
    }
  } catch (e) { warn("reach reset failed", e); }
});
Hooks.on("updateDrawing", (doc) => { if (isHexDoc(doc)) scheduleWorldHealthRefresh(); });
Hooks.on("updateActor", (actor, changes) => {
  try {
    const u = foundry.utils;
    if (u.hasProperty(changes, `flags.${FCT}.darkness`) || u.hasProperty(changes, `flags.${MOD}.converged`))
      scheduleWorldHealthRefresh();
  } catch (_e) {}
});
Hooks.on("bbttcc:spark:deposited", (info) => creditSparkRepair(info, "integrate-spark"));
Hooks.on("bbttcc:spark:repaired",  (info) => creditSparkRepair(info, "repair-spark"));
// Spark integrated INTO a hex (tikkun-hex enhancer): the alignment predicate
// just changed under us — recompute world-health, and credit the same +2
// Presence an off-board spark integration earns.
Hooks.on("bbttcc:spark:hexIntegrated", (info) => {
  creditSparkRepair(info, "integrate-spark");
  scheduleWorldHealthRefresh();
});
Hooks.on("bbttcc:spark:hexSeated", () => scheduleWorldHealthRefresh());
Hooks.on("renderBBTTCC_CampaignOverview", (app, element) => injectOverviewChip(app, element));

Hooks.on("ready", async () => {
  try {
    if (!ftActive()) return;
    game.fourththing = game.fourththing || {};
    game.fourththing.epic = game.fourththing.epic || {};
    game.fourththing.epic.worldHealth = worldHealth;
    game.fourththing.epic.repair = Object.assign(game.fourththing.epic.repair || {}, {
      alignHex, integrateSpark, reach, worldHealth,
      reachBudget, tryDebitReach,
    });
    // Initial compute + seam check (single reconciler = active GM).
    const gm = game.users?.activeGM;
    if (gm && !gm.isSelf) { log("Repair ready (seam check deferred to active GM)."); return; }
    await onWorldHealthRecomputed();
    log("Repair ready.");
  } catch (e) { warn("ready error", e); }
});
