// Bad Eden — Epic G2: THE FINAL RITUAL (Descent Engine) — 2026-09-03
// ─────────────────────────────────────────────────────────────────────────────
// The confrontation at Daath, run as STATIONS, not rounds (DESCENT_ENGINE_SPEC
// §3.2, owner rulings 2026-09-02). The engine is the table's spine, not its
// replacement: it snapshots the campaign's true state (fragments, Lamps,
// World-Health, the mercy ledger), posts each station with its computed
// stakes, tracks the ten spark instruments, and adjudicates the Answer —
// the rolls themselves happen at the table with the game's own tools.
//
//   0 THE CHAIN    — each steward's heaviest UN-FACED fragment is the attack,
//                    verbatim; a steward with open fragments cannot channel
//                    an instrument during this station. All-faced = untouched.
//   1 THE VEIL     — what the party has SEEN converts to dice: worldHealth%,
//                    the mercy record, lamp coverage.
//   2 THE CROSSING — one instrument per lit Lamp, once each, keyed to its
//                    sephirah (protect / reveal / attack).
//   3 THE ANSWER   — PARLEY (the crown: every present steward's fragments
//                    faced · mercy ≥ threshold · ≥7 instruments unspent or
//                    spent on non-attack) · SUNDER (taint +2 all, one Lamp
//                    dark forever, Aegis loot, reduced Reformation) ·
//                    ROUT (Darkness +3 all, BP→100, the Dragon withdraws;
//                    retry = face what broke you + the pilgrimage, Ruling 8).
//
// Authority: world setting `bbttcc-epic.ritual`; endings write
// `bbttcc-epic.daath.outcome` + faction `flags.bbttcc-factions.tikkun.
// greatWorkComplete/greatWorkResult` (G3's Reformation listens for these).
// Emits: bbttcc:ritual:{begun, station, instrument, answered} ·
//        bbttcc:dragon:{parley, sundered, routed}.
// GM verbs: game.fourththing.epic.ritual.{begin, status, next, instrument,
//           answer, abort}. Single writer = the GM running it.
// ─────────────────────────────────────────────────────────────────────────────

const MOD = "bbttcc-epic";
const FCT = "bbttcc-factions";
const TAG = "[bbttcc-epic/ritual]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// ⚖ Owner-tunable: live talk-downs (bbttcc-campaign.banditMercy) needed for
// the PARLEY's mercy clause, and how many non-attack instruments it demands.
const MERCY_THRESHOLD       = 3;
const PARLEY_NONATTACK_MIN  = 7;

const STATIONS = ["THE CHAIN", "THE VEIL", "THE CROSSING", "THE ANSWER"];

// The ten instruments — one per lit Lamp, once per ritual.
const INSTRUMENTS = {
  keter:   { name: "The Crown Intercedes",       kind: "protect", text: "Negate one of the Dragon's actions entirely — the source outranks the guardian." },
  chokmah: { name: "Lightning of First Thought", kind: "reveal",  text: "Reroll any one test with the clarity of the very first idea." },
  binah:   { name: "The Mother's Structure",     kind: "protect", text: "The party ignores all stress from one station — form holds." },
  chesed:  { name: "Mercy Absolute",             kind: "protect", text: "Shield one steward from a Chain attack completely." },
  gevurah: { name: "The Severity",               kind: "attack",  text: "A decisive blow — Severity answers force with force. (Spends toward SUNDER.)" },
  tiferet: { name: "The Reconciler",             kind: "protect", text: "Re-open a locked station, or unlock a fragment-bound steward's channel." },
  netzach: { name: "Endurance Eternal",          kind: "protect", text: "A broken steward stands back up, immediately." },
  hod:     { name: "The Codebook",               kind: "reveal",  text: "The Dragon's next attack is read aloud before it lands." },
  yesod:   { name: "The Foundation Holds",       kind: "protect", text: "Cancel one environmental or fracture effect — the ground remembers being whole." },
  malkuth: { name: "The Kingdom Speaks",         kind: "protect", text: "The land testifies: add the World-Health tens digit to one test." }
};

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

function ritualState() {
  const s = game.settings.get(MOD, "ritual");
  return (s && typeof s === "object" && s.active) ? s : null;
}
function daathState() {
  const s = game.settings.get(MOD, "daath");
  return (s && typeof s === "object") ? s : {};
}
function openFragments(actor) {
  try { return (game.fourththing?.darkness?.fragments?.(actor) ?? []).filter(f => !f?.faced); }
  catch (_e) { return []; }
}
function mercyRecord() {
  try { return Number(game.settings.get("bbttcc-campaign", "banditMercy")) || 0; }
  catch (_e) { return 0; }
}
function worldHealthPct() {
  try { return Number(game.fourththing?.epic?.worldHealth?.()?.pct ?? 0) || 0; }
  catch (_e) { return 0; }
}

async function beatCard(title, body, foot) {
  await ChatMessage.create({
    content: `<div class="bbttcc-epic-beat is-keter">
      <div class="bbttcc-epic-beat-title">${title}</div>
      <div class="bbttcc-epic-beat-body">${body}</div>
      ${foot ? `<div class="bbttcc-epic-beat-foot">${foot}</div>` : ""}
    </div>`
  }).catch(() => {});
}
async function gmCard(html) {
  const gm = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
  await ChatMessage.create({ content: `<p style="font-size:0.78rem">${html}</p>`, whisper: gm }).catch(() => {});
}

// ── Parley eligibility (live-computed, never stored) ────────────────────────
function parleyCheck(st) {
  const blockers = [];
  const roster = (st.roster ?? []).map(id => game.actors?.get(id)).filter(Boolean);
  const unfaced = roster.filter(a => openFragments(a).length);
  if (unfaced.length) blockers.push(`fragments un-faced: ${unfaced.map(a => `${a.name} (${openFragments(a).length})`).join(", ")}`);
  if ((st.mercy ?? 0) < MERCY_THRESHOLD) blockers.push(`mercy record ${st.mercy ?? 0}/${MERCY_THRESHOLD} — the Dragon has read the ledger`);
  const attackSpent = Object.values(st.instruments ?? {}).filter(i => i.spent && i.use === "attack").length;
  const nonAttack = (st.lamps?.length ?? 0) - attackSpent;
  if (nonAttack < PARLEY_NONATTACK_MIN) blockers.push(`only ${nonAttack}/${PARLEY_NONATTACK_MIN} lamps unspent-or-gentle (attack spends: ${attackSpent})`);
  return { ok: !blockers.length, blockers, attackSpent, nonAttack };
}

// ── Station cards ───────────────────────────────────────────────────────────
async function postStation(st) {
  const idx = st.stationIndex;
  const name = STATIONS[idx];
  if (idx === 0) {
    const roster = (st.roster ?? []).map(id => game.actors?.get(id)).filter(Boolean);
    const rows = roster.map(a => {
      const open = openFragments(a);
      if (!open.length) return `<b>${a.name}</b> — nothing binds them. The Chain passes over.`;
      const heaviest = open[open.length - 1];
      return `<b>${a.name}</b> — the Dragon speaks: <em>"${heaviest.text || heaviest.qliphoth}"</em> (${open.length} open; Soul save vs DC 15; on fail, stress — and their channel is LOCKED this station).`;
    }).join("<br/>");
    await beatCard(`🐉 STATION I — ${name}`,
      `Seven shackles' worth of memory, worn as teeth. Each steward is bound with their own heaviest un-faced fragment, verbatim:<br/><br/>${rows}`,
      `A party with everything faced walks through untouched · ${st.darkDoor ? "DARK DOOR — harsher terms" : "the open gate"}`);
  } else if (idx === 1) {
    const wh = st.worldHealth, mercy = st.mercy;
    const dice = Math.floor(wh / 20) + (mercy >= MERCY_THRESHOLD ? 2 : 0) + Math.floor((st.lamps?.length ?? 0) / 2);
    await beatCard(`🐉 STATION II — ${name}`,
      `The Dragon asks what the party has <b>seen</b>. The world answers for them: World-Health <b>${wh}%</b>, mercy record <b>${mercy}</b> talk-downs, <b>${st.lamps?.length ?? 0}</b> lamps lit.<br/><em>The Veil rating is <b>+${dice}</b> — add it to every test made behind the veil.</em>`,
      `wh/20 + mercy bonus + lamps/2 · what you healed testifies for you`);
  } else if (idx === 2) {
    const rows = (st.lamps ?? []).map(s => {
      const inst = INSTRUMENTS[s]; const state = st.instruments?.[s];
      return `${state?.spent ? "✗" : "✦"} <b>${cap(s)} — ${inst.name}</b> <span style="opacity:0.7">(${inst.kind})</span>: ${inst.text}${state?.spent ? ` <em>(spent: ${state.use})</em>` : ""}`;
    }).join("<br/>");
    await beatCard(`🐉 STATION III — ${name}`,
      `Every lamp the campaign lit now offers its hand — once:<br/><br/>${rows}`,
      `game.fourththing.epic.ritual.instrument("<sephirah>", "protect|reveal|attack") · attack spends count against the PARLEY`);
  } else {
    const pc = parleyCheck(st);
    await beatCard(`🐉 STATION IV — ${name}`,
      pc.ok
        ? `The Dragon waits. Every fragment faced, the ledger merciful, the lamps ungentle with no one. <b>The PARLEY is open.</b> It is also not the only answer — it is merely the true one.`
        : `The Dragon waits. The PARLEY is <b>not yet open</b>:<br/>· ${pc.blockers.join("<br/>· ")}<br/><em>SUNDER and ROUT are always available. So is walking back down to finish what's unfinished.</em>`,
      `answer("parley" | "sunder" | "rout")`);
    await gmCard(`🐉 Answer state: parley ${pc.ok ? "OPEN" : "closed"} · non-attack lamps ${pc.nonAttack}/${PARLEY_NONATTACK_MIN} · mercy ${st.mercy}/${MERCY_THRESHOLD}.`);
  }
  Hooks.callAll("bbttcc:ritual:station", { index: idx, name });
}

// ── Verbs ───────────────────────────────────────────────────────────────────
async function begin({ actorIds = null, mercy = null } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("The ritual is the GM's to open."); return null; }
  const daath = daathState();
  if (!daath.risen) { ui.notifications?.warn("The Dragon has not risen — knock first (epic.daath.knock)."); return null; }
  if (ritualState()) { ui.notifications?.warn("The ritual is already underway."); return null; }

  const roster = (actorIds ?? (game.actors?.contents ?? [])
    .filter(a => a.type === "character" && a.hasPlayerOwner).map(a => a.id));
  if (!roster.length) { ui.notifications?.warn("No stewards for the crossing — pass begin({actorIds:[…]})."); return null; }

  const lamps = [...(daath.lampsLit ?? [])].filter(s => s !== daath.deadLamp);
  const st = {
    active: true, begunAt: Date.now(), darkDoor: !!daath.darkDoor,
    stationIndex: 0, roster,
    lamps, instruments: Object.fromEntries(lamps.map(s => [s, { spent: false, use: null }])),
    mercy: Number.isFinite(Number(mercy)) ? Number(mercy) : mercyRecord(),
    worldHealth: worldHealthPct(),
    log: []
  };
  await game.settings.set(MOD, "ritual", st);
  await beatCard("🐉 THE FINAL RITUAL BEGINS",
    `${st.roster.length} steward${st.roster.length > 1 ? "s" : ""} stand at the aperture. ${st.lamps.length} lamp${st.lamps.length === 1 ? "" : "s"} burn behind them. World-Health ${st.worldHealth}%. <em>The last enemy was always traveling with you.</em>`,
    `Stations: Chain → Veil → Crossing → Answer · advance with epic.ritual.next()`);
  Hooks.callAll("bbttcc:ritual:begun", { roster: st.roster, lamps: st.lamps, darkDoor: st.darkDoor });
  await postStation(st);
  return st;
}

async function next() {
  if (!game.user?.isGM) return null;
  const st = ritualState();
  if (!st) { ui.notifications?.warn("No ritual underway."); return null; }
  if (st.stationIndex >= 3) { ui.notifications?.info("The Answer is the last station — answer(...)."); return st; }
  st.stationIndex += 1;
  await game.settings.set(MOD, "ritual", st);
  await postStation(st);
  return st;
}

async function instrument(sephirah, use = "protect", { actorId = null } = {}) {
  if (!game.user?.isGM) return null;
  const st = ritualState();
  if (!st) { ui.notifications?.warn("No ritual underway."); return null; }
  const s = String(sephirah).toLowerCase();
  const inst = INSTRUMENTS[s];
  const slot = st.instruments?.[s];
  if (!inst || !slot) { ui.notifications?.warn(`No lit lamp for "${sephirah}".`); return null; }
  if (slot.spent) { ui.notifications?.warn(`${inst.name} is already spent (${slot.use}).`); return null; }
  const u = ["protect", "reveal", "attack"].includes(use) ? use : inst.kind;
  if (st.stationIndex === 0 && actorId) {
    const a = game.actors?.get(actorId);
    if (a && openFragments(a).length) {
      ui.notifications?.warn(`${a.name}'s channel is locked by un-faced fragments during the Chain (tiferet can unlock).`);
      return null;
    }
  }
  slot.spent = true; slot.use = u;
  st.log.push({ t: Date.now(), instrument: s, use: u, station: st.stationIndex });
  await game.settings.set(MOD, "ritual", st);
  await beatCard(`✦ ${cap(s)} — ${inst.name}`, `<em>${inst.text}</em>`, `spent as ${u} · station ${st.stationIndex + 1}`);
  Hooks.callAll("bbttcc:ritual:instrument", { sephirah: s, use: u, station: st.stationIndex });
  return st;
}

async function answer(choice) {
  if (!game.user?.isGM) return null;
  const st = ritualState();
  if (!st) { ui.notifications?.warn("No ritual underway."); return null; }
  const c = String(choice).toLowerCase();
  const daath = daathState();
  const roster = (st.roster ?? []).map(id => game.actors?.get(id)).filter(Boolean);
  const factionIds = [...new Set(roster.map(a => a.getFlag?.(FCT, "factionId")).filter(Boolean))];

  if (c === "parley") {
    const pc = parleyCheck(st);
    if (!pc.ok) {
      ui.notifications?.warn("The PARLEY is not open:\n· " + pc.blockers.join("\n· "));
      return null;
    }
    for (const fid of factionIds) {
      const f = game.actors?.get(fid); if (!f) continue;
      await f.update({
        [`flags.${FCT}.tikkun.greatWorkComplete`]: true,
        [`flags.${FCT}.tikkun.greatWorkResult`]: { success: true, mode: "parley", at: Date.now(), lamps: st.lamps.length }
      }).catch(() => {});
    }
    // Apokatostasis — the Dragon's strength joins the world: global Darkness −3.
    for (const f of (game.actors?.contents ?? []).filter(a => a.getFlag?.(FCT, "isFaction") === true)) {
      const box = foundry.utils.deepClone(f.getFlag(FCT, "darkness") || {});
      box.global = Math.max(0, (Number(box.global) || 0) - 3);
      await f.update({ [`flags.${FCT}.darkness`]: box }).catch(() => {});
    }
    await game.settings.set(MOD, "daath", { ...daath, outcome: "parley" });
    await game.settings.set(MOD, "ritual", { active: false });
    await beatCard("👑 THE PARLEY — APOKATOSTASIS",
      `The party does not raise a hand. They say the true names of everything they failed, and the Dragon — who IS those failures — listens to itself be forgiven. It does not die. <b>It comes home.</b> Global Darkness recedes everywhere; the lower self, transformed, girds the world for the journey hereafter.`,
      `The Great Work is COMPLETE · the crown ending · Reformation follows (G3)`);
    Hooks.callAll("bbttcc:dragon:parley", { factionIds, lamps: st.lamps });
    Hooks.callAll("bbttcc:ritual:answered", { outcome: "parley" });
    return { outcome: "parley" };
  }

  if (c === "sunder") {
    for (const a of roster) {
      try { const b = game.fourththing.darkness.bite(a); await game.fourththing.darkness.setTaint(a, b.taint + 2, "sunder"); } catch (_e) {}
    }
    const deadLamp = st.lamps.length ? st.lamps[Math.floor(Math.random() * st.lamps.length)] : null;
    for (const fid of factionIds) {
      const f = game.actors?.get(fid); if (!f) continue;
      await f.update({
        [`flags.${FCT}.tikkun.greatWorkComplete`]: true,
        [`flags.${FCT}.tikkun.greatWorkResult`]: { success: true, mode: "sunder", reduced: true, at: Date.now(), deadLamp }
      }).catch(() => {});
    }
    await game.settings.set(MOD, "daath", { ...daath, outcome: "sunder", deadLamp });
    await game.settings.set(MOD, "ritual", { active: false });
    await beatCard("⚔ THE SUNDER",
      `Force answers force, and force wins the way force always wins: completely, and at cost. The Dragon is broken${deadLamp ? `, and as it falls, the lamp of <b>${cap(deadLamp)}</b> goes out — forever; its temples keep their peace but pay no more` : ""}. Every steward carries the scar (taint +2, permanent until faced… and there is now more to face).`,
      `The Great Work completes — LESSER · Ego-Dragon Scale Aegis enters the loot · Reformation follows, dimmer`);
    await gmCard(`⚔ SUNDER applied: taint +2 on ${roster.map(a => a.name).join(", ")}${deadLamp ? ` · dead lamp: ${deadLamp} (its spark hexes stop yielding)` : ""} · award the Ego-Dragon Scale Aegis (master-content items).`);
    Hooks.callAll("bbttcc:dragon:sundered", { factionIds, deadLamp });
    Hooks.callAll("bbttcc:ritual:answered", { outcome: "sunder" });
    return { outcome: "sunder", deadLamp };
  }

  if (c === "rout") {
    const routFragments = {};
    for (const a of roster) {
      try { await game.fourththing.darkness.gain(a, 3, "rout"); } catch (_e) {}
      const open = openFragments(a).map(f => f.id);
      if (open.length) routFragments[a.id] = open;
    }
    await game.settings.set(MOD, "boilingPoint", 100);
    await game.settings.set(MOD, "daath", { ...daath, risen: false, darkDoor: false, outcome: null, routPending: { at: Date.now(), fragments: routFragments } });
    await game.settings.set(MOD, "ritual", { active: false });
    await beatCard("💔 THE ROUT",
      `The party breaks. The Dragon does not pursue — it never needed to. It settles back beneath the aperture with everything it learned about them. The Gaze boils. The dark keeps the receipts.`,
      `Darkness +3 all · Boiling Point 100 · the road back: face every fragment the rout logged, then make the pilgrimage and knock again (Ruling 8)`);
    Hooks.callAll("bbttcc:dragon:routed", { routFragments });
    Hooks.callAll("bbttcc:ritual:answered", { outcome: "rout" });
    return { outcome: "rout" };
  }

  ui.notifications?.warn(`Unknown answer "${choice}" — parley | sunder | rout.`);
  return null;
}

async function abort() {
  if (!game.user?.isGM) return null;
  await game.settings.set(MOD, "ritual", { active: false });
  ui.notifications?.info("Ritual state cleared (no outcome recorded).");
  return true;
}

function status() {
  const st = ritualState();
  if (!st) return { active: false };
  return { ...st, station: STATIONS[st.stationIndex], parley: parleyCheck(st) };
}

// ── Wiring ──────────────────────────────────────────────────────────────────
Hooks.on("init", () => {
  if (game?.system?.id !== "fourththing") return;
  game.settings.register(MOD, "ritual", { scope: "world", config: false, type: Object, default: { active: false } });
});

Hooks.on("ready", () => {
  try {
    if (game.system?.id !== "fourththing") return;
    game.fourththing = game.fourththing || {};
    game.fourththing.epic = game.fourththing.epic || {};
    game.fourththing.epic.ritual = { begin, status, next, instrument, answer, abort, INSTRUMENTS, MERCY_THRESHOLD, PARLEY_NONATTACK_MIN };
    log("The Final Ritual is wired (G2: stations, instruments, the three answers).");
  } catch (e) { warn("ready error", e); }
});
