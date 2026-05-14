// modules/bbttcc-factions/scripts/relationship-nudge.js
// BBTTCC — Auto-Relationship-Nudge listener
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
// Only the active GM applies the nudge (avoids multi-client write storms).

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

function _resourceValue(r) {
  if (!r) return 0;
  let v = 0;
  for (const q of Object.values(r.marks || {})) v += _safeNum(q, 0);
  v += _safeNum(r.buildUnits, 0) * BU_VALUE;
  return v;
}

function _isActiveGM() {
  // Pick exactly one client to apply: prefer game.users.activeGM if available,
  // otherwise fall back to "the lowest-id active GM" (deterministic).
  if (!game.user?.isGM) return false;
  try {
    const active = game.users?.activeGM;
    if (active) return active.id === game.user.id;
  } catch (_e) {}
  const gms = (game.users?.contents ?? []).filter(u => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id));
  return gms[0]?.id === game.user.id;
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
  if (!_isActiveGM()) return;
  if (!game.settings.get(MOD_ID, SETTING_ENABLED)) return;

  const { fromId, toId, offer, ask } = payload || {};
  if (!fromId || !toId) return;

  const A = game.actors?.get(fromId);
  const B = game.actors?.get(toId);
  if (!A || !B) return;

  const aValue = _resourceValue(offer);
  const bValue = _resourceValue(ask);

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

  // Bump each side at most one step, capped at Friendly.
  const targetA = TIER_KEYS[Math.min(FRIENDLY_IDX, idxA + 1)];
  const targetB = TIER_KEYS[Math.min(FRIENDLY_IDX, idxB + 1)];

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
      const lines = [];
      if (targetA !== beforeA) lines.push(`${A.name} → ${B.name}: ${lbl(beforeA)} → ${lbl(targetA)}`);
      if (targetB !== beforeB) lines.push(`${B.name} → ${A.name}: ${lbl(beforeB)} → ${lbl(targetB)}`);
      const content = `<div class="bbttcc-rel-nudge"><b>Relationship strengthened</b> — fair trade between <b>${A.name}</b> and <b>${B.name}</b>.<br>${lines.join("<br>")}</div>`;
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
