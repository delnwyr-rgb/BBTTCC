// Bad Eden — Epic P4: THE GAZE (Descent Engine A1+A2) — 2026-09-03
// ─────────────────────────────────────────────────────────────────────────────
// Yaldabaoth wakes (DESCENT_ENGINE_SPEC Part II, owner-ruled 2026-09-02).
// A1 shipped the Boiling Point meter + escalation roll + omens. A2 gives the
// Gaze its hands — every event uses EXISTING machinery:
//
//   Stirring  → OMEN      public dread card
//   Watching  → HUNTER    marks the hunted() steward; the ambush springs on
//                         their next travel leg, matched to their heaviest
//                         un-faced fragment's qliphoth (bestiary seam)
//   Reaching  → CORRUPTION a dormant seated spark turns (temples immune;
//                         api.tikkun.hex.corrupt / repair)
//             → REPRISAL  an aligned hex is marked for attack: per-hex
//                         darkness +1 now, GM directive to run the defense
//                         (garrison / fortify play)
//   Boiling   → FRACTURE  a Purified hex loses Purified, per-hex darkness +2
//                         — worldHealth drops (the Malkuth re-arm seam's
//                         cause); Nadir+ stewards receive the Dragon-dream
//
//   BP = bandPoints(unmasked party Presence) + 3 × integrated spark temples
//        + worldHealth% / 10 + 5 × Lamps lit          (Ruling 6: as drafted)
//   Each Apply turn (single writer = active GM): recompute, then 1d100 ≤ BP
//   fires one event at the BP band's tier. Events fall back down the ladder
//   when they lack a valid target (no dormant spark → reprisal → omen…).
//
// Authority: world settings `bbttcc-epic.boilingPoint` + `.hunterPending`.
// Emits: bbttcc:adversary:boiled {bp, tier} · bbttcc:adversary:event
//        {type, tier, bp, …} · bbttcc:adversary:hunter {stewardId, qliphoth}
//        — consumers: this file's cards, fx (dread ramp), Turn Press,
//        campaign director (future).
// ─────────────────────────────────────────────────────────────────────────────

const MOD = "bbttcc-epic";
const TER = "bbttcc-territory";
const FCT = "bbttcc-factions";
const TAG = "[bbttcc-epic/adversary]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// ⚖ Owner-tunable weights (Ruling 6 blessed the draft).
const BAND_POINTS   = { low: 5, mid: 15, high: 30, apex: 45 };
const TEMPLE_WEIGHT = 3;
const LAMP_WEIGHT   = 5;

const TIERS = [
  { min: 76, key: "boiling",  label: "Boiling"  },
  { min: 51, key: "reaching", label: "Reaching" },
  { min: 26, key: "watching", label: "Watching" },
  { min: 1,  key: "stirring", label: "Stirring" }
];

// Omen lines — public dread, tier-agnostic (the Gaze does not explain itself).
const OMENS = [
  "The birds cross the sky in a straight line, all of them, at once.",
  "Somewhere a radio that has no batteries finishes a sentence.",
  "The shadows are a half-step late today. Nobody mentions it twice.",
  "A stranger asks after the brightest of you, by description, politely.",
  "The water in the low places holds its reflection a moment too long.",
  "Every dog in the settlement faces the same direction for one minute.",
  "Static on the leylines spells something that is almost a name.",
  "The night is exactly as dark as last night. That is what's wrong with it."
];

function isHexDoc(d) {
  const tf = d?.flags?.[TER];
  return tf?.isHex === true || tf?.kind === "territory-hex";
}
function hexName(d) {
  return String(d?.text || d?.flags?.[TER]?.name || "an unnamed hex")
    .replace(/ /g, " ").replace(/^[\s✦]+/, "").replace(/\s+/g, " ").trim();
}
function boardHexes() {
  const out = [];
  const all = game.scenes?.contents ?? [];
  const marked = all.filter(sc => sc.getFlag?.(MOD, "boardScene") === true);
  for (const sc of (marked.length ? marked : all)) {
    for (const d of sc.drawings ?? []) if (isHexDoc(d)) out.push(d);
  }
  return out;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Integrated spark census: temples + distinct-sephirah Lamp count (derived,
// never stored — spec §4).
function sparkCensus() {
  const seph = new Set();
  let temples = 0;
  for (const d of boardHexes()) {
    const s = d.flags?.[TER]?.spark;
    if (s?.state !== "integrated") continue;
    temples++;
    const m = /^spark_([a-z]+)_/.exec(String(s.key || ""));
    if (m) seph.add(m[1]);
  }
  return { temples, lamps: seph.size };
}

function computeBP() {
  let presencePts = 0;
  try {
    const band = game.fourththing?.epic?.presence?.band?.()?.key ?? "low";
    presencePts = BAND_POINTS[band] ?? BAND_POINTS.low;
  } catch (_e) {}
  let wh = 0;
  try { wh = Number(game.fourththing?.epic?.worldHealth?.()?.pct ?? 0) || 0; } catch (_e) {}
  const { temples, lamps } = sparkCensus();
  const bp = Math.max(0, Math.min(100, Math.round(
    presencePts + TEMPLE_WEIGHT * temples + wh / 10 + LAMP_WEIGHT * lamps
  )));
  return { bp, presencePts, temples, lamps, wh };
}

function tierFor(bp) {
  return TIERS.find(t => bp >= t.min) ?? null;
}

// ── Cards ───────────────────────────────────────────────────────────────────
async function dreadCard(title, body) {
  await ChatMessage.create({
    content: `<div class="bbttcc-epic-beat">
      <div class="bbttcc-epic-beat-title">👁 THE GAZE — ${title}</div>
      <div class="bbttcc-epic-beat-body">${body}</div>
    </div>`
  }).catch(() => {});
}
async function gmCard(html) {
  const gm = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
  await ChatMessage.create({ content: `<p style="font-size:0.78rem">${html}</p>`, whisper: gm }).catch(() => {});
}
function bpMath(detail) {
  return `Boiling Point <b>${detail.bp}</b> (presence ${detail.presencePts} + temples ${detail.temples}×${TEMPLE_WEIGHT} + wh ${Math.round(detail.wh / 10)} + lamps ${detail.lamps}×${LAMP_WEIGHT}) · roll ${detail.roll} ≤ ${detail.bp}`;
}

// ── Events (each falls back down the ladder when it lacks a target) ─────────
async function eventOmen(tier, detail) {
  await dreadCard(tier.label, `<em>${pick(OMENS)}</em>`);
  await gmCard(`👁 ${bpMath(detail)} → <b>${tier.label}</b> omen.`);
  Hooks.callAll("bbttcc:adversary:event", { type: "omen", tier: tier.key, bp: detail.bp });
}

async function eventHunter(tier, detail) {
  let steward = null;
  try { steward = game.fourththing?.epic?.presence?.hunted?.() ?? null; } catch (_e) {}
  if (!steward) return eventOmen(tier, detail);
  const frags = (() => { try { return game.fourththing?.darkness?.fragments?.(steward) ?? []; } catch (_e) { return []; } })();
  const open = frags.filter(f => !f?.faced);
  const qliphoth = open.length ? open[open.length - 1].qliphoth : null;
  await game.settings.set(MOD, "hunterPending", { stewardId: steward.id, qliphoth, at: Date.now() });
  await dreadCard(tier.label, `<em>Something has your scent. It is patient the way roads are patient.</em>`);
  await gmCard(`👁 ${bpMath(detail)} → <b>HUNTER</b> marked on <b>${steward.name}</b> (brightest unmasked). Qliphoth: <b>${qliphoth ?? "GM's choice — match their story"}</b>. The ambush springs on their next travel leg (bestiary: Lesser at Watching, Greater at Reaching+).`);
  Hooks.callAll("bbttcc:adversary:event", { type: "hunter", tier: tier.key, bp: detail.bp, stewardId: steward.id, qliphoth });
}

async function eventCorruption(tier, detail) {
  const cands = boardHexes().filter(d => d.flags?.[TER]?.spark?.state === "dormant");
  if (!cands.length) return eventReprisal(tier, detail);
  const d = pick(cands);
  const key = d.flags[TER].spark.key;
  const res = await game.bbttcc?.api?.tikkun?.hex?.corrupt?.(d.uuid).catch(() => null);
  if (!res?.ok) return eventOmen(tier, detail);
  await dreadCard(tier.label, `<em>At ${hexName(d)}, something holy turns its face to the wall.</em>`);
  await gmCard(`👁 ${bpMath(detail)} → <b>CORRUPTION</b>: dormant spark <b>${key}</b> at <b>${hexName(d)}</b> is corrupted. Integration is blocked until repaired (<code>game.bbttcc.api.tikkun.hex.repair</code> after an on-site rite — Spark Repair Ledger for the ritual shape).`);
  Hooks.callAll("bbttcc:adversary:event", { type: "corruption", tier: tier.key, bp: detail.bp, hexUuid: d.uuid, key });
}

async function eventReprisal(tier, detail) {
  const hexes = boardHexes().filter(d => {
    const tf = d.flags?.[TER] ?? {};
    if (tf.spark?.state === "integrated") return false; // temples hold
    const purified = Array.isArray(tf.conditions) && tf.conditions.includes("Purified");
    return purified || !!(tf.factionId || tf.ownerId);
  });
  if (!hexes.length) return eventOmen(tier, detail);
  const d = pick(hexes);
  const tf = d.flags[TER];
  const fid = tf.factionId || tf.ownerId || "";
  const faction = fid ? game.actors?.get(fid) : null;
  if (faction) {
    const cur = Number(faction.getFlag(FCT, "darkness")?.[d.id] ?? 0) || 0;
    await faction.update({ [`flags.${FCT}.darkness.${d.id}`]: cur + 1 }).catch(() => {});
  }
  await dreadCard(tier.label, `<em>The Gaze settles on <b>${hexName(d)}</b>. Hold it, or watch it learn a new name.</em>`);
  await gmCard(`👁 ${bpMath(detail)} → <b>REPRISAL</b> against <b>${hexName(d)}</b>${faction ? ` (${faction.name})` : ""}: per-hex darkness +1 applied. Direct an Adversary raid at it — defense plays through the existing garrison/fortify machinery.`);
  Hooks.callAll("bbttcc:adversary:event", { type: "reprisal", tier: tier.key, bp: detail.bp, hexUuid: d.uuid, factionId: fid || null });
}

async function eventFracture(tier, detail) {
  const cands = boardHexes().filter(d => {
    const tf = d.flags?.[TER] ?? {};
    if (tf.spark?.state === "integrated") return false; // temples hold
    return Array.isArray(tf.conditions) && tf.conditions.includes("Purified");
  });
  if (!cands.length) return eventCorruption(tier, detail);
  const d = pick(cands);
  const tf = d.flags[TER];
  const conditions = (tf.conditions ?? []).filter(c => c !== "Purified");
  await d.update({ [`flags.${TER}.conditions`]: conditions }).catch(() => {});
  const fid = tf.factionId || tf.ownerId || "";
  const faction = fid ? game.actors?.get(fid) : null;
  if (faction) {
    const cur = Number(faction.getFlag(FCT, "darkness")?.[d.id] ?? 0) || 0;
    await faction.update({ [`flags.${FCT}.darkness.${d.id}`]: cur + 2 }).catch(() => {});
  }
  await dreadCard(tier.label, `<em><b>${hexName(d)}</b> forgets it was ever healed. The map is a story, and something is editing it.</em>`);
  await gmCard(`👁 ${bpMath(detail)} → <b>FRACTURE</b>: <b>${hexName(d)}</b> loses Purified, per-hex darkness +2. World-Health drops (the Malkuth seam re-arms itself if it was latched).`);
  // The Dragon-dream: Nadir+ stewards feel the editor's attention.
  try {
    const dreamers = (game.actors?.contents ?? []).filter(a =>
      a.type === "character" && ["nadir", "threshold"].includes(game.fourththing?.darkness?.band?.(a)));
    if (dreamers.length) {
      const who = dreamers.map(a => a.name).join(", ");
      await gmCard(`🐉 <b>Dragon-dream</b>: ${who} dream${dreamers.length > 1 ? "" : "s"} of teeth made of their own worst sentences. Deliver privately — the deep is starting to answer back.`);
    }
  } catch (_e) {}
  Hooks.callAll("bbttcc:adversary:event", { type: "fracture", tier: tier.key, bp: detail.bp, hexUuid: d.uuid, factionId: fid || null });
}

async function fireEvent(tier, detail) {
  switch (tier.key) {
    case "stirring": return eventOmen(tier, detail);
    case "watching": return (Math.random() < 0.5) ? eventHunter(tier, detail) : eventOmen(tier, detail);
    case "reaching": {
      const r = Math.random();
      if (r < 0.40) return eventCorruption(tier, detail);
      if (r < 0.80) return eventReprisal(tier, detail);
      return eventHunter(tier, detail);
    }
    case "boiling": return eventFracture(tier, detail);
    default: return eventOmen(tier, detail);
  }
}

// ── The drumbeat: recompute + escalate on Apply turns ───────────────────────
// Single writer = active GM (same reconciler pattern as the Malkuth seam).
Hooks.on("bbttcc:advanceTurn:end", async (payload) => {
  try {
    if (!payload?.apply) return;
    if (!game.user?.isGM) return;
    const activeGM = game.users?.activeGM;
    if (activeGM && !activeGM.isSelf) return;
    if (game.system?.id !== "fourththing") return;

    const detail = computeBP();
    await game.settings.set(MOD, "boilingPoint", detail.bp);
    const tier = tierFor(detail.bp);
    Hooks.callAll("bbttcc:adversary:boiled", { bp: detail.bp, tier: tier?.key ?? "quiet" });
    if (!tier) return;

    const r = await (new Roll("1d100")).evaluate();
    detail.roll = r.total;
    if (r.total > detail.bp) { log(`BP ${detail.bp}, roll ${r.total} — the Gaze passes over.`); return; }

    await fireEvent(tier, detail);
    log(`escalation: BP ${detail.bp}, roll ${r.total} → ${tier.key}.`);
  } catch (e) { warn("escalation failed", e); }
});

// ── The hunter springs on the marked steward's next travel leg ──────────────
// Runs on the GM seat (travel legs execute on the GM console today; a
// player-seat leg springs on the next leg the GM client observes).
Hooks.on("bbttcc:afterTravel", async (ctx) => {
  try {
    if (!game.user?.isGM) return;
    const activeGM = game.users?.activeGM;
    if (activeGM && !activeGM.isSelf) return;
    const pending = game.settings.get(MOD, "hunterPending");
    if (!pending?.stewardId) return;
    if (ctx?.actor?.id !== pending.stewardId) return;
    await game.settings.set(MOD, "hunterPending", null);
    const steward = game.actors?.get(pending.stewardId);
    await dreadCard("The Hunter", `<em>The road was never empty. It was waiting for <b>${steward?.name ?? "the marked"}</b>.</em>`);
    await gmCard(`👁 <b>THE HUNTER SPRINGS</b> on ${steward?.name ?? pending.stewardId} — spawn the Qliphoth now (<b>${pending.qliphoth ?? "GM's choice"}</b>; Lesser for a warning, Greater if the table is ready). This interrupts the leg's arrival beat.`);
    Hooks.callAll("bbttcc:adversary:hunter", { stewardId: pending.stewardId, qliphoth: pending.qliphoth ?? null });
  } catch (e) { warn("hunter spring failed", e); }
});

Hooks.on("init", () => {
  if (game?.system?.id !== "fourththing") return;
  game.settings.register(MOD, "boilingPoint",  { scope: "world", config: false, type: Number, default: 0 });
  game.settings.register(MOD, "hunterPending", { scope: "world", config: false, type: Object, default: null });
});

Hooks.on("ready", () => {
  try {
    if (game.system?.id !== "fourththing") return;
    game.fourththing = game.fourththing || {};
    game.fourththing.epic = game.fourththing.epic || {};
    game.fourththing.epic.adversary = {
      boilingPoint: () => game.settings.get(MOD, "boilingPoint"),
      compute: computeBP,
      census: sparkCensus,
      // GM console: force one event of a tier for testing/drama —
      // game.fourththing.epic.adversary.force("reaching")
      force: async (tierKey = "stirring") => {
        const tier = TIERS.find(t => t.key === tierKey) ?? TIERS[3];
        const detail = computeBP(); detail.roll = 0;
        return fireEvent(tier, detail);
      }
    };
    log("The Gaze is open (A2: hunters, reprisals, corruption, fractures).");
  } catch (e) { warn("ready error", e); }
});
