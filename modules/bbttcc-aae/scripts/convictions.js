// modules/bbttcc-aae/scripts/convictions.js
// CONVICTIONS — the Alignment monitor (Alpha Cut ruling 17, Dave 2026-10-18: "I want the world to measure how closely
// the steward hews to their convictions. It basically becomes an old school Alignment monitor.")
//
// The yardstick already exists: flags["bbttcc-aae"].politicalPhilosophy on the steward (eight choices, picked on the
// sheet) and the AAE drift score on the Domain (0..100, moved by every beat choice that carries political tags:
// affirmation −5, minor break +5, major +12, critical +25). What was missing was a READER. This file adds:
//
//   1. Alpha centre rule — on an Alpha world the Domain's centre is its steward(s), not the whole roster:
//      applyPoliticalImpact is wrapped so `actorIds` defaults to banks.stewardsOf(faction). One steward = no plurality,
//      no minority pressure. (The steward and the Domain are one being — ruling 16.)
//   2. Teeth, once per turn (bbttcc:advanceTurn:end, GM, apply≠false), by band of |drift|:
//        Steadfast  0–15   nothing
//        Strained  16–35   a Day's End card, no numbers
//        Fractured 36–65   Loyalty −1
//        Rupturing 66–100  Loyalty −2, Darkness +1
//      then drift walks back toward 0 by RECOVER_PER_TURN (2) — a quiet turn heals a little; an affirming choice heals more.
//   3. The immediate rows for the choice itself live in bbttcc-campaign (module.js _consequenceRowForSeverity):
//      affirmation Loyalty +1 · minor nothing · major Loyalty −1 · critical Loyalty −2, Darkness +1.
//
// ⚠ All numbers = my defaults, Dave to bless (doc "Bad Eden Alpha Cut", Rulings 17 and 18).
// API: game.bbttcc.api.convictions = { BANDS, RECOVER_PER_TURN, bandFor(drift), centerFor(faction), stateFor(faction), sweep({apply}) }
// Hooks: "bbttcc:convictions:turn" ({ factionId, drift, band, applied }) per faction touched by the sweep.
// Imported from module.js (same module scope) — no module.json edit.

const AAE = "bbttcc-aae";
const TAG = "[bbttcc-aae/convictions]";
const BANDS = Object.freeze([
  { key: "stable",    label: "Steadfast", max: 15,  loyalty:  0, darkness: 0, css: "best",  hint: "You are who you said you were." },
  { key: "strained",  label: "Strained",  max: 35,  loyalty:  0, darkness: 0, css: "warn",  hint: "Your people have noticed the gap between what you say and what you do." },
  { key: "fractured", label: "Fractured", max: 65,  loyalty: -1, darkness: 0, css: "bad",   hint: "Loyalty bleeds 1 a turn until you act like yourself again." },
  { key: "rupturing", label: "Rupturing", max: 100, loyalty: -2, darkness: 1, css: "worst", hint: "The Domain no longer believes you. Loyalty −2 and Darkness +1 every turn." },
]);
const RECOVER_PER_TURN = 2;
// An affirming choice can push the AAE score below 0 — a credit that softens the next break. One band of slack is the
// cap (CREDIT_FLOOR); the meter itself never shows below 0. ⚠ default, Dave to bless.
const CREDIT_FLOOR = -15;

const _alpha = () => { try { return game.bbttcc?.alpha?.enabled?.() === true; } catch (_e) { return false; } };
const _isFaction = (a) => { try { return a?.getFlag?.("bbttcc-factions", "isFaction") === true; } catch (_e) { return false; } };
const _esc = (s) => { try { return foundry.utils.escapeHTML(String(s ?? "")); } catch (_e) { return String(s ?? ""); } };
const _label = (key) => { try { return game.bbttcc?.api?.aae?.POLITICAL_PHILOSOPHIES?.[key]?.label || game.bbttcc?.api?.aae?.listPoliticalPhilosophies?.()?.find?.(p => p.key === key)?.label || String(key || ""); } catch (_e) { return String(key || ""); } };

function bandFor(drift) {
  const a = Math.max(0, Number(drift) || 0);   // a credit (negative score) reads as Steadfast, never as drift
  return BANDS.find(b => a <= b.max) || BANDS[BANDS.length - 1];
}
function _stewards(faction) {
  try { return (game.bbttcc?.api?.banks?.stewardsOf?.(faction) || []).filter(a => a?.type === "character"); } catch (_e) { return []; }
}
/** The Domain's centre on an Alpha world: its steward's philosophy (plurality when several stewards are linked). */
function centerFor(faction) {
  const f = (faction instanceof Actor) ? faction : game.actors?.get(String(faction || ""));
  if (!f) return { key: null, label: "", source: "none" };
  const override = String(f.getFlag?.(AAE, "politicalPhilosophyOverride") || "").trim();
  if (override) return { key: override, label: _label(override), source: "override" };
  const counts = new Map();
  for (const s of _stewards(f)) { const k = String(s.getFlag?.(AAE, "politicalPhilosophy") || "").trim(); if (k) counts.set(k, (counts.get(k) || 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top ? { key: top[0], label: _label(top[0]), source: counts.size === 1 ? "steward" : "plurality" } : { key: null, label: "", source: "none" };
}
/** Read-only snapshot for sheets. */
function stateFor(faction) {
  const f = (faction instanceof Actor) ? faction : game.actors?.get(String(faction || ""));
  if (!f) return null;
  const raw = Number(f.getFlag?.(AAE, "driftScore") ?? 0) || 0;
  const drift = Math.max(0, raw); const band = bandFor(drift);
  const impacts = f.getFlag?.(AAE, "lastPoliticalImpacts"); 
  return { drift, credit: Math.max(0, -raw), band: band.key, bandLabel: band.label, css: band.css, hint: band.hint, center: centerFor(f), impacts: Array.isArray(impacts) ? impacts.slice(0, 3) : [] };
}

/** Once per turn: the band's teeth, then recovery toward 0. */
async function sweep({ apply = true } = {}) {
  if (!game.user?.isGM || apply === false) return { touched: 0 };
  const aae = game.bbttcc?.api?.aae; const wm = game.bbttcc?.api?.worldMutation;
  if (!aae?.writeFactionDriftState) return { touched: 0 };
  let touched = 0;
  for (const f of (game.actors?.contents ?? [])) {
    if (!_isFaction(f)) continue;
    const raw = Number(f.getFlag?.(AAE, "driftScore") ?? 0) || 0;
    if (!raw) continue;
    const drift = Math.max(0, raw); const band = bandFor(drift);
    const applied = { loyaltyDelta: band.loyalty, darknessDelta: band.darkness };
    try {
      if ((band.loyalty || band.darkness) && wm?.applyWorldEffects) {
        await wm.applyWorldEffects({ factionEffects: [{ factionId: f.id, ...applied }], warLog: `Convictions: ${band.label} (${drift}) — ${[band.loyalty ? `Loyalty ${band.loyalty}` : "", band.darkness ? `Darkness +${band.darkness}` : ""].filter(Boolean).join(", ")}` },   // 10-29: zero terms left out (Fractured printed "Darkness +0"), like _card
          { source: AAE, factionId: f.id, logType: "convictions" });
      }
    } catch (e) { console.warn(TAG, "teeth failed", f.name, e); }
    // recovery toward 0 (sign preserved for any legacy negative score)
    const next = Math.sign(raw) * Math.max(0, Math.abs(raw) - RECOVER_PER_TURN);   // drift AND credit both walk toward 0
    try { await aae.writeFactionDriftState(f, { driftScore: next }); } catch (e) { console.warn(TAG, "recovery write failed", f.name, e); }
    if (band.key !== "stable") _card(f, band, drift);
    try { Hooks.callAll("bbttcc:convictions:turn", { factionId: f.id, drift, band: band.key, applied }); } catch (_e) {}
    touched++;
  }
  return { touched };
}

function _card(f, band, drift) {
  try {
    const pub = (() => { try { return game.settings.get("bbttcc-core", "tableAnnouncements") !== "gm"; } catch (_e) { return true; } })();
    const whisper = pub ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id);
    const teeth = band.loyalty || band.darkness ? `<p style="margin:.2rem 0;font-size:.82rem;opacity:.85">${band.loyalty ? `Loyalty ${band.loyalty}` : ""}${band.loyalty && band.darkness ? " · " : ""}${band.darkness ? `Darkness +${band.darkness}` : ""} this turn.</p>` : "";
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: f }), whisper,
      content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">🧭 Convictions — ${_esc(f.name)}: ${_esc(band.label)}</span></div><p style="margin:.2rem 0;font-size:.82rem;opacity:.85">${_esc(band.hint)}</p>${teeth}</div>` });
  } catch (_e) {}
}

Hooks.on("bbttcc:advanceTurn:end", (ctx) => { sweep({ apply: ctx?.apply !== false }).catch(e => console.warn(TAG, "sweep failed", e)); });

function _install() {
  try {
    game.bbttcc ??= {}; game.bbttcc.api ??= {};
    game.bbttcc.api.convictions = { BANDS, RECOVER_PER_TURN, CREDIT_FLOOR, bandFor, centerFor, stateFor, sweep };
    const aae = game.bbttcc.api.aae;
    if (aae?.applyPoliticalImpact && !aae.applyPoliticalImpact.__convictions) {
      const orig = aae.applyPoliticalImpact;
      const wrapped = async function (opts = {}) {
        if (_alpha() && !(Array.isArray(opts.actorIds) && opts.actorIds.length)) {
          const ids = _stewards(opts.factionId).map(a => a.id);
          if (ids.length) opts = { ...opts, actorIds: ids };
        }
        const res = await orig(opts);
        try {   // cap the credit at one band of slack
          if (res?.ok && Number(res.driftScoreAfter) < CREDIT_FLOOR) {
            const f = game.actors?.get(String(res.factionId || opts.factionId || ""));
            if (f) { await aae.writeFactionDriftState(f, { driftScore: CREDIT_FLOOR }); res.driftScoreAfter = CREDIT_FLOOR; }
          }
        } catch (_e) {}
        return res;
      };
      wrapped.__convictions = true;
      aae.applyPoliticalImpact = wrapped;
    }
  } catch (e) { console.warn(TAG, "install failed", e); }
}
// AAE's own ready handler (module.js) attaches game.bbttcc.api.aae; a microtask runs after every synchronous ready handler.
Hooks.once("ready", () => { Promise.resolve().then(_install); });
try { if (game?.ready) _install(); } catch (_e) {}

export { BANDS, RECOVER_PER_TURN, CREDIT_FLOOR, bandFor, centerFor, stateFor, sweep };
