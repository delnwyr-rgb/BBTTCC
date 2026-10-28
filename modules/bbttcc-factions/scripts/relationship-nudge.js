// modules/bbttcc-factions/scripts/relationship-nudge.js
// Bad Eden — Auto-Relationship-Nudge listener
//
// Listens on bbttcc:economy:exchange. When two factions trade ROUGHLY equal value
// (within tolerance), bumps mutual relationship one step toward Friendly. Caps at
// Friendly so Allied tier remains GM-curated. Per-pair cooldown prevents spam.
//
// Settings:
//   bbttcc-factions.autoRelationshipNudge   Boolean   default true
//   bbttcc-factions.fairTradeTolerance      Number    default 0.20  (0..1)
//   bbttcc-factions.nudgeCooldownHours      Number    default 24
//
// Runs on the GM client that settled the exchange (the hook is a local callAll there).

const MOD_ID = "bbttcc-factions";
const TAG    = "[bbttcc-rel-nudge]";

const SETTING_ENABLED   = "autoRelationshipNudge";
const SETTING_TOLERANCE = "fairTradeTolerance";
const SETTING_COOLDOWN  = "nudgeCooldownHours";

const TIER_KEYS = ["at_war", "hostile", "unfriendly", "neutral", "friendly", "allied"];
const FRIENDLY_IDX = TIER_KEYS.indexOf("friendly");

// 1 BU is treated as 10 marks-equivalent for fairness math (1 OP = 10 marks).
const BU_VALUE = 10;

function _registerSettings() {
  try {
    game.settings.register(MOD_ID, SETTING_ENABLED, {
      name: "Auto-nudge relationships on fair trade",
      hint: "When two factions trade roughly equal value, automatically bump mutual relationship one step toward Friendly. Caps at Friendly — Allied stays GM-curated.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });
    game.settings.register(MOD_ID, SETTING_TOLERANCE, {
      name: "Fair-trade tolerance",
      hint: "Maximum value asymmetry (0–1) that still counts as 'fair'. 0.20 means within 20% — a 100-mark offer for an 80-mark ask still nudges. Higher = more generous.",
      scope: "world",
      config: true,
      type: Number,
      default: 0.20,
      range: { min: 0, max: 0.5, step: 0.05 }
    });
    game.settings.register(MOD_ID, SETTING_COOLDOWN, {
      name: "Auto-nudge cooldown (hours)",
      hint: "Minimum hours between auto-nudges for the same faction pair. Prevents grinding the same trade for repeated tier bumps.",
      scope: "world",
      config: true,
      type: Number,
      default: 24,
      range: { min: 0, max: 168, step: 1 }
    });
  } catch (e) {
    console.warn(TAG, "settings register failed", e);
  }
}

function _safeNum(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

// Materials count too (2026-10-01): valued at the stockpile's retail unit price, read
// from the RECEIVING faction (it holds the units — and their last-seen tier — after the trade).
async function _resourceValue(r, receiver = null) {
  if (!r) return 0;
  let v = 0;
  for (const q of Object.values(r.marks || {})) v += _safeNum(q, 0);
  v += _safeNum(r.buildUnits, 0) * BU_VALUE;
  const stock = game.bbttcc?.api?.factions?.stockpile;
  for (const [key, q] of Object.entries(r.materials || {})) {
    const n = _safeNum(q, 0); if (n <= 0) continue;
    let unit = 0;
    try { unit = _safeNum((await stock?.unitPrice?.(receiver, key))?.retail, 0); } catch (_e) {}
    v += n * unit;
  }
  return v;
}

function _readNudgeStamps(actor) {
  return foundry.utils.deepClone(actor?.getFlag?.(MOD_ID, "lastNudgeTs") ?? {});
}

async function _stampNudge(actor, otherId, ts) {
  const cur = _readNudgeStamps(actor);
  cur[otherId] = ts;
  await actor.setFlag(MOD_ID, "lastNudgeTs", cur);
}

async function _onExchange(payload) {
  // review P3 (2026-10-28): bbttcc:economy:exchange is a LOCAL Hooks.callAll on the GM client that
  // ran trade() (gmExec primary or the GM who clicked Accept) — gating on activeGM dropped the
  // nudge whenever that was a different GM. The firing client is already unique.
  if (!game.user?.isGM) return;
  if (!game.settings.get(MOD_ID, SETTING_ENABLED)) return;

  const { fromId, toId, offer, ask } = payload || {};
  if (!fromId || !toId) return;

  const A = game.actors?.get(fromId);
  const B = game.actors?.get(toId);
  if (!A || !B) return;

  const aValue = await _resourceValue(offer, B);
  const bValue = await _resourceValue(ask, A);

  // One-way grant or empty — not a "trade" for fairness purposes.
  if (aValue <= 0 || bValue <= 0) return;

  const tolerance = Math.max(0, Math.min(1, _safeNum(game.settings.get(MOD_ID, SETTING_TOLERANCE), 0.20)));
  const denom = Math.max(aValue, bValue);
  const asymmetry = Math.abs(aValue - bValue) / denom;
  if (asymmetry > tolerance) return;

  // Per-pair cooldown
  const cooldownH = Math.max(0, _safeNum(game.settings.get(MOD_ID, SETTING_COOLDOWN), 24));
  const cooldownMs = cooldownH * 3600 * 1000;
  const now = Date.now();
  const stampsA = _readNudgeStamps(A);
  const lastA = _safeNum(stampsA[B.id], 0);
  if (cooldownMs > 0 && (now - lastA) < cooldownMs) return;

  const relApi = game?.bbttcc?.api?.factions?.relations;
  if (!relApi?.get || !relApi?.set) {
    console.warn(TAG, "relations API not loaded");
    return;
  }

  const beforeA = relApi.get(A, B);
  const beforeB = relApi.get(B, A);
  const idxA = TIER_KEYS.indexOf(beforeA);
  const idxB = TIER_KEYS.indexOf(beforeB);

  // Already at or above Friendly on both sides? Nothing to do (Allied stays manual).
  if (idxA >= FRIENDLY_IDX && idxB >= FRIENDLY_IDX) {
    // Stamp anyway so we don't re-evaluate on every trade
    await _stampNudge(A, B.id, now);
    await _stampNudge(B, A.id, now);
    return;
  }

  // Bump each side at most one step, capped at Friendly — and never LOWER a side.
  // review P2 (2026-10-28): a one-sided Allied (A→B allied, B→A neutral) was written down to Friendly.
  // An unknown tier string (idx −1) is left alone rather than mapped to index 0 (At War).
  const targetA = idxA < 0 ? beforeA : TIER_KEYS[Math.max(idxA, Math.min(FRIENDLY_IDX, idxA + 1))];
  const targetB = idxB < 0 ? beforeB : TIER_KEYS[Math.max(idxB, Math.min(FRIENDLY_IDX, idxB + 1))];

  let changed = false;
  if (targetA !== beforeA) {
    await relApi.set(A, B, targetA, { reason: "fair-trade auto-nudge" });
    changed = true;
  }
  if (targetB !== beforeB) {
    await relApi.set(B, A, targetB, { reason: "fair-trade auto-nudge" });
    changed = true;
  }

  await _stampNudge(A, B.id, now);
  await _stampNudge(B, A.id, now);

  if (changed) {
    try {
      const labels = relApi.TIER_LABELS || {};
      const lbl = (k) => labels[k] || k;
      const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));   // review P3 (2026-10-28): players name Domains
      const nA = esc(A.name), nB = esc(B.name);
      const lines = [];
      if (targetA !== beforeA) lines.push(`${nA} → ${nB}: ${esc(lbl(beforeA))} → ${esc(lbl(targetA))}`);
      if (targetB !== beforeB) lines.push(`${nB} → ${nA}: ${esc(lbl(beforeB))} → ${esc(lbl(targetB))}`);
      const content = `<div class="bbttcc-rel-nudge"><b>Relationship strengthened</b> — fair trade between <b>${nA}</b> and <b>${nB}</b>.<br>${lines.join("<br>")}</div>`;
      const gmIds = (game.users?.contents ?? []).filter(u => u.isGM).map(u => u.id);
      ChatMessage.create({
        content,
        whisper: gmIds,
        speaker: { alias: "Diplomacy" }
      });
    } catch (e) {
      console.warn(TAG, "chat broadcast failed", e);
    }
  }
}

Hooks.once("init", _registerSettings);
Hooks.once("ready", () => {
  Hooks.on("bbttcc:economy:exchange", _onExchange);
  console.log(TAG, "Auto-relationship-nudge listener armed.");
});
