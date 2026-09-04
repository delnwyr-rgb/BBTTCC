// Bad Eden — Epic P4: THE GAZE (Descent Engine A1) — 2026-09-02
// ─────────────────────────────────────────────────────────────────────────────
// Yaldabaoth wakes (DESCENT_ENGINE_SPEC Part II, owner-ruled 2026-09-02).
// A1 ships the Boiling Point meter + the escalation roll + the Stirring tier
// (omens). Watching/Reaching/Boiling EVENTS (hunters, reprisals, spark
// corruption, fractures) land in A2 — until then a higher-tier hit still
// delivers an omen, and the GM whisper names the event that WOULD have fired.
//
//   BP = bandPoints(unmasked party Presence) + 3 × integrated spark temples
//        + worldHealth% / 10 + 5 × Lamps lit          (Ruling 6: as drafted)
//   Each Apply turn (single writer = active GM): recompute, then 1d100 ≤ BP
//   fires an escalation event at the BP band's tier.
//
// Authority: world setting `bbttcc-epic.boilingPoint` (spec §4).
// Emits: bbttcc:adversary:boiled {bp, tier} · bbttcc:adversary:event
//        {type, tier, bp} — consumers: fx (dread ramp), Turn Press, campaign
//        director (A2), this file's own chat cards.
// ─────────────────────────────────────────────────────────────────────────────

const MOD = "bbttcc-epic";
const TER = "bbttcc-territory";
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

// Integrated spark census: temples + distinct-sephirah Lamp count (derived,
// never stored — spec §4).
function sparkCensus() {
  const seph = new Set();
  let temples = 0;
  for (const sc of game.scenes?.contents ?? []) {
    for (const d of sc.drawings ?? []) {
      if (!isHexDoc(d)) continue;
      const s = d.flags?.[TER]?.spark;
      if (s?.state !== "integrated") continue;
      temples++;
      const m = /^spark_([a-z]+)_/.exec(String(s.key || ""));
      if (m) seph.add(m[1]);
    }
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

async function postOmen(tier, detail) {
  const line = OMENS[Math.floor(Math.random() * OMENS.length)];
  await ChatMessage.create({
    content: `<div class="bbttcc-epic-beat">
      <div class="bbttcc-epic-beat-title">👁 THE GAZE — ${tier.label}</div>
      <div class="bbttcc-epic-beat-body"><em>${line}</em></div>
    </div>`
  }).catch(() => {});
  const gm = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
  await ChatMessage.create({
    content: `<p style="font-size:0.78rem">👁 <b>Boiling Point ${detail.bp}</b> (presence ${detail.presencePts} + temples ${detail.temples}×${TEMPLE_WEIGHT} + wh ${Math.round(detail.wh / 10)} + lamps ${detail.lamps}×${LAMP_WEIGHT}) · roll ${detail.roll} ≤ ${detail.bp} → <b>${tier.label}</b>.${tier.key !== "stirring" ? ` Full ${tier.label} events (hunter/reprisal/fracture) land in A2 — run one manually if the table is ready.` : ""}</p>`,
    whisper: gm
  }).catch(() => {});
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

    await postOmen(tier, detail);
    Hooks.callAll("bbttcc:adversary:event", { type: "omen", tier: tier.key, bp: detail.bp });
    log(`escalation: BP ${detail.bp}, roll ${r.total} → ${tier.key} omen.`);
  } catch (e) { warn("escalation failed", e); }
});

Hooks.on("init", () => {
  if (game?.system?.id !== "fourththing") return;
  game.settings.register(MOD, "boilingPoint", { scope: "world", config: false, type: Number, default: 0 });
});

Hooks.on("ready", () => {
  try {
    if (game.system?.id !== "fourththing") return;
    game.fourththing = game.fourththing || {};
    game.fourththing.epic = game.fourththing.epic || {};
    game.fourththing.epic.adversary = {
      boilingPoint: () => game.settings.get(MOD, "boilingPoint"),
      compute: computeBP,
      census: sparkCensus
    };
    log("The Gaze is open (A1: meter + omens; events arrive with A2).");
  } catch (e) { warn("ready error", e); }
});
