// Bad Eden — hook → MOMENT bridge (2026-10-05)
//
// Systems fire hooks; this file decides which ones become on-screen moments
// (core/fx-moments.js). Hooks.callAll is LOCAL to the client that fired it, so
// whichever seat hears the hook is the one that broadcasts — exactly once.
// Never bridge a hook that is socket re-fired on every client (bbttcc:siege:*),
// or every seat would broadcast its own copy.

const TAG = "[bbttcc-fx/moment-bridge]";
const NBSP = / /g;

const cap1 = (s) => String(s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

function hexLabel(uuid) {
  try {
    const d = uuid ? fromUuidSync(uuid) : null;
    const raw = d?.text || d?.flags?.["bbttcc-territory"]?.name || "";
    return String(raw).replace(NBSP, " ").replace(/^[\s✦]+/, "").replace(/\s+/g, " ").trim() || "an unnamed hex";
  } catch (_e) { return "a hex"; }
}

function tokenIdFor(actor) {
  try { return actor?.getActiveTokens?.(true, false)?.[0]?.id ?? null; } catch (_e) { return null; }
}

export function installMomentBridge(api) {
  const fire = (key, ctx, opts) => {
    try { return api.moment?.(key, ctx, opts); }
    catch (e) { console.warn(TAG, key, e); }
  };

  // ── Surge banked ─────────────────────────────────────────────────────────
  // One roll can bank several times in a burst (each exploding die, Harmony
  // harvests). Coalesce per actor for a beat, then send ONE "+N SURGE"; if that
  // burst filled the pool, follow with the bigger SURGE FULL card.
  const surgeBurst = new Map();
  Hooks.on("fourththing.surgeBanked", (p = {}) => {
    const id = p.actorUuid || p.actorId;
    if (!id || !(p.amount > 0)) return;
    const b = surgeBurst.get(id) ?? { amount: 0, timer: null };
    b.amount += Number(p.amount) || 0;
    b.last = p;
    clearTimeout(b.timer);
    b.timer = setTimeout(() => {
      surgeBurst.delete(id);
      const q = b.last;
      const ctx = { actor: q.actorName, actorUuid: q.actorUuid, tokenId: q.tokenId, amount: b.amount, value: q.value, cap: q.cap };
      fire("surge_banked", ctx);
      if (Number(q.cap) > 0 && Number(q.value) >= Number(q.cap)) fire("surge_full", ctx);
    }, 450);
    surgeBurst.set(id, b);
  });

  // ── Receipts — only the gaining faction's seats (and GMs) see it ─────────
  Hooks.on("bbttcc:receipt:gained", (p = {}) => {
    if (!p.factionId) return;
    fire(p.acquisition === "stolen" ? "receipt_stolen" : "receipt_gained",
      { faction: p.factionName, factionId: p.factionId, label: p.label });
  });

  // ── The Adversary ────────────────────────────────────────────────────────
  // Overshoot into rupture/sundering: fired by bbttcc-campaign on the primary GM
  // BEFORE it draws the adversary beat (which then pulls the table to its scene
  // under the dimmed screen — see moments.lead()).
  Hooks.on("bbttcc:adversary:overshoot", (p = {}) => {
    const band = String(p.band || "");
    if (band !== "rupture" && band !== "sundering") return;
    fire(`adversary_${band}`, { actor: p.actorName || "Someone", over: p.over });
  });
  // The Epic Gaze drumbeat (active GM only, on Apply turns).
  Hooks.on("bbttcc:adversary:event", (p = {}) => {
    const key = `gaze_${p.type}`;
    if (!api.moments?.get?.(key)) return;
    fire(key, { tier: cap1(p.tier).toUpperCase(), hex: p.hexUuid ? hexLabel(p.hexUuid) : "" });
  });
  Hooks.on("bbttcc:adversary:hunter", (p = {}) => {
    const a = p.stewardId ? game.actors?.get(p.stewardId) : null;
    fire("gaze_hunter_springs", { actor: a?.name || "the marked" });
  });

  // ── Sparks + Enlightenment ───────────────────────────────────────────────
  Hooks.on("bbttcc:spark:integrated", (p = {}) => {
    const a = p.actor;
    fire("spark_integrated", {
      actor: a?.name, actorUuid: a?.uuid,
      spark: [p.spark?.name || cap1(p.sparkKey), p.sephirah ? cap1(p.sephirah) : ""].filter(Boolean).join(" · ")
    });
  });
  Hooks.on("fourththing.enlightenmentStepped", (p = {}) => {
    const a = game.actors?.get(p.actorId);
    fire("enlightenment_stepped", { actor: a?.name, actorUuid: a?.uuid, level: cap1(p.to) });
  });

  // ── Level / Tier up ──────────────────────────────────────────────────────
  // A tier crossing gets the big card INSTEAD of the level card (one moment, not two).
  Hooks.on("fourththing.leveledUp", (p = {}) => {
    const ctx = { actor: p.actorName, actorUuid: p.actorUuid, level: p.to, tier: p.tier };
    fire(p.tierUp ? "tier_up" : "level_up", ctx);
  });
  Hooks.on("bbttcc:faction:tierUp", (p = {}) => {
    fire("faction_tier_up", { faction: p.factionName, factionId: p.factionId, from: p.from, to: p.to });
  });

  // ── Last Stand ───────────────────────────────────────────────────────────
  Hooks.on("fourththing.enteredLastStand", (actor) => {
    if (!actor) return;
    fire("last_stand", { actor: actor.name, actorUuid: actor.uuid, tokenId: tokenIdFor(actor) });
  });

  // ── Story: quest closed / chapter ended (GM-only emitter) ────────────────
  // Skip "(recorded)" reconcile rows (backfill, not something that just happened),
  // and a chapter end that rides in with its own quest's closure.
  Hooks.on("bbttcc:story:changed", (p = {}) => {
    const changes = Array.isArray(p.changes) ? p.changes : [];
    const name = typeof p.labelFor === "function" ? p.labelFor : (q, c) => cap1(c ?? q);
    const endingOf = (c) => String(c?.ending?.name ?? c?.ending ?? "").trim();
    const closedQuests = new Set(changes.filter(c => c?.kind === "quest-closed").map(c => c.quest));
    for (const c of changes) {
      const ending = endingOf(c);
      if (ending === "(recorded)") continue;
      if (c.kind === "quest-closed") fire("quest_closed", { quest: name(c.quest), ending });
      else if (c.kind === "chapter-ended" && !closedQuests.has(c.quest)) fire("chapter_ended", { quest: name(c.quest), chapter: name(c.quest, c.chapter), ending });
    }
  });

  console.log(TAG, "installed.");
}
