/* ============================================================================
 * Bad Eden — Repair siege flags + stuck raid boons  (GM macro, one-time repair)
 * ----------------------------------------------------------------------------
 * Until 2026-10-01 three things were left behind on live documents:
 *
 *  (1) RESOLVED SIEGES NEVER CLEARED. The outcome write-back called a clear that
 *      used the "-=siege" deletion syntax v14 dropped, so a won/lost siege kept its
 *      flags["bbttcc-territory"].siege (status won_* / lost_*) on the hex forever.
 *      → unsetFlag("bbttcc-territory","siege"). The outcome write-back is NOT re-run
 *        (it already ran once when the siege resolved).
 *      Also prunes faction back-refs (flags["bbttcc-factions"].activeSieges /
 *      defendingSieges) that point at a hex with no ACTIVE siege.
 *
 *  (2) SCALAR SIEGE BUFFERS. A class boon (Rally the Standard etc.) wrote
 *      siege.buffer = <number> instead of the per-channel object, so every later
 *      buffer read saw 0 and every shave was lost. → game.bbttcc.api.siege
 *      .topUpBuffer(hexUuid, { set: N }) with N = that number: the same 50/33/rest
 *      violence/logistics/economy split Begin Siege uses. The pre-bug buffer is NOT
 *      recoverable (the bug replaced it with the boon delta); top it up by hand if
 *      the siege should have more.
 *
 *  (3) STUCK ONE-SHOT RAID BOONS. Consuming flags["bbttcc-factions"].bonuses
 *      .nextTurn.initiativeAdv / .freeManeuver merge-wrote the parent, which removes
 *      nothing — so the boon applied to every raid forever. → unsetFlag per key, ONLY
 *      on factions with NO raid in progress (attacker or supporter of a non-empty,
 *      non-practice raidSession — the console's own "active raid" rule). A boon whose
 *      grant (Mass Mobilization / Force Projection / Operational Cohesion war-log line)
 *      is NEWER than the faction's last raid war-log line looks freshly earned and is
 *      KEPT unless REMOVE_FRESH_BOONS = true.
 *
 * DRY_RUN = true  -> report only (no writes). Set false to apply.
 * Idempotent: a second run finds nothing to do. Run in EACH live world (foundry + ember).
 * ==========================================================================*/
(async () => {
  const DRY_RUN = true;               // <-- set to false to actually write
  const REMOVE_FRESH_BOONS = false;   // <-- true also removes boons that look freshly earned (see header)
  const MODT = "bbttcc-territory";
  const MODF = "bbttcc-factions";
  const MODR = "bbttcc-raid";
  const TAG = "[repair-siege-and-boons]";

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const siegeApi = game.bbttcc?.api?.siege;
  const isFaction = (a) => a?.getFlag?.(MODF, "isFaction") === true || String(a?.system?.details?.type?.value || "").toLowerCase() === "faction";
  const factions = (game.actors?.contents || []).filter(isFaction);
  const hexName = (doc) => String(doc?.flags?.[MODT]?.name || doc?.name || doc?.text || doc?.id || "?").replace(/\s+/g, " ").trim();

  // Every document that can carry a hex's territory flags (listActiveSieges scans these same collections).
  const hexDocs = [];
  for (const sc of game.scenes ?? []) {
    for (const coll of [sc.drawings, sc.notes, sc.tokens, sc.tiles]) {
      for (const d of (coll ?? [])) if (d?.flags?.[MODT]) hexDocs.push({ d, scene: sc.name });
    }
  }
  for (const a of game.actors ?? []) if (a?.flags?.[MODT]?.siege) hexDocs.push({ d: a, scene: "(actor)" });

  const lines = [];   // chat card rows
  let cleared = 0, buffersFixed = 0, refsPruned = 0, boonsRemoved = 0, reportOnly = 0;
  console.group(`%c${TAG}${DRY_RUN ? " DRY RUN" : ""}`, "font-weight:bold");

  // ── (1) resolved siege flags + (2) scalar buffers ───────────────────────────
  const activeHexUuids = new Set();
  for (const { d, scene } of hexDocs) {
    const st = d.flags?.[MODT]?.siege;
    if (!st || typeof st !== "object") continue;
    const nm = `${hexName(d)} [${scene}]`;
    if (st.status !== "active") {
      console.log(`(1) ${nm}: siege ${st.siegeId || "?"} status=${st.status ?? "∅"} — resolved flag ${DRY_RUN ? "WOULD BE" : ""} cleared`);
      lines.push(`Cleared resolved siege on <b>${esc(nm)}</b> (status <code>${esc(st.status ?? "none")}</code>)`);
      if (!DRY_RUN) { try { await d.unsetFlag(MODT, "siege"); cleared++; } catch (e) { console.warn(TAG, "unset failed", nm, e); } }
      else cleared++;
      continue;
    }
    activeHexUuids.add(d.uuid);
    if (typeof st.buffer === "number" || (st.buffer != null && typeof st.buffer !== "object")) {
      const n = Math.max(0, Math.round(Number(st.buffer) || 0));
      if (typeof siegeApi?.topUpBuffer !== "function") {
        console.warn(`(2) ${nm}: buffer is a scalar (${st.buffer}) but api.siege.topUpBuffer is unavailable — REPORT ONLY`);
        lines.push(`⚠ <b>${esc(nm)}</b>: scalar buffer ${esc(st.buffer)} — siege API missing, not repaired`);
        reportOnly++;
        continue;
      }
      console.log(`(2) ${nm}: buffer is a scalar (${st.buffer}) — ${DRY_RUN ? "WOULD convert" : "converting"} to channels, total ${n} marks`);
      lines.push(`Buffer on <b>${esc(nm)}</b>: scalar ${esc(st.buffer)} → per-channel object (${n} marks)`);
      if (!DRY_RUN) {
        try { const r = await siegeApi.topUpBuffer(d.uuid, { set: n }); if (r?.ok) buffersFixed++; else { console.warn(TAG, "topUpBuffer refused", nm, r); reportOnly++; } }
        catch (e) { console.warn(TAG, "topUpBuffer failed", nm, e); reportOnly++; }
      } else buffersFixed++;
    }
  }

  // ── (1b) dangling faction back-refs ─────────────────────────────────────────
  for (const F of factions) {
    for (const key of ["activeSieges", "defendingSieges"]) {
      const list = F.getFlag(MODF, key);
      if (!Array.isArray(list) || !list.length) continue;
      const keep = list.filter(u => activeHexUuids.has(u));
      if (keep.length === list.length) continue;
      console.log(`(1b) ${F.name}: ${key} ${list.length} → ${keep.length} (pruned refs to hexes with no active siege)`);
      lines.push(`${esc(F.name)}: pruned ${list.length - keep.length} stale <code>${key}</code> ref(s)`);
      if (!DRY_RUN) { try { await F.update({ [`flags.${MODF}.${key}`]: keep }); } catch (e) { console.warn(TAG, "back-ref prune failed", F.name, e); } }
      refsPruned += list.length - keep.length;
    }
  }

  // ── (3) stuck one-shot raid boons ───────────────────────────────────────────
  // "Raid in progress" = the console's rule (_findActiveRaidForFaction): the faction is the
  // attacker or a supporter of a raidSession that has a target, rounds or supporters.
  // Onboarding practice sessions (raidSession.practice / tourStaged) are NOT live raids.
  const inRaid = new Set();
  for (const a of factions) {
    const s = a.getFlag(MODR, "raidSession");
    if (!s || typeof s !== "object") continue;
    if (s.practice === true || s.tourStaged) continue;
    const supports = Array.isArray(s.supportFactionIds) ? s.supportFactionIds.map(String) : [];
    const live = !!String(s.targetUuid || "").trim() || (Array.isArray(s.rounds) && s.rounds.length > 0) || supports.length > 0;
    if (!live) continue;
    inRaid.add(String(s.attackerId || a.id));
    for (const id of supports) inRaid.add(id);
  }
  const GRANT_RX = /^(Mass Mobilization: next raid|Doctrine: Force Projection|Operational Cohesion)/i;
  for (const F of factions) {
    const nt = F.getFlag(MODF, "bonuses")?.nextTurn || {};
    const keys = ["initiativeAdv", "freeManeuver"].filter(k => nt[k] !== undefined);
    if (!keys.length) continue;
    if (inRaid.has(F.id)) {
      console.log(`(3) ${F.name}: ${keys.join(", ")} — LEFT (a raid is in progress; the console consumes it)`);
      lines.push(`${esc(F.name)}: kept ${keys.join(", ")} (raid in progress)`);
      continue;
    }
    const logs = Array.isArray(F.getFlag(MODF, "warLogs")) ? F.getFlag(MODF, "warLogs") : [];
    const lastGrant = Math.max(0, ...logs.filter(l => GRANT_RX.test(String(l?.summary || ""))).map(l => Number(l?.ts) || 0));
    const lastRaid = Math.max(0, ...logs.filter(l => String(l?.type || "") === "raid").map(l => Number(l?.ts) || 0));
    const fresh = lastGrant > 0 && lastGrant > lastRaid;
    if (fresh && !REMOVE_FRESH_BOONS) {
      console.log(`(3) ${F.name}: ${keys.join(", ")} — KEPT (granted ${new Date(lastGrant).toLocaleString()}, no raid since; set REMOVE_FRESH_BOONS=true to remove)`);
      lines.push(`${esc(F.name)}: kept ${keys.join(", ")} (earned since its last raid)`);
      continue;
    }
    console.log(`(3) ${F.name}: ${keys.join(", ")} — ${DRY_RUN ? "WOULD BE" : ""} removed (no raid in progress${lastGrant ? `; granted ${new Date(lastGrant).toLocaleString()}, raided since` : "; no grant on record"})`);
    lines.push(`${esc(F.name)}: removed stuck ${keys.join(", ")}`);
    if (!DRY_RUN) {
      for (const k of keys) { try { await F.unsetFlag(MODF, `bonuses.nextTurn.${k}`); boonsRemoved++; } catch (e) { console.warn(TAG, "boon unset failed", F.name, k, e); } }
    } else boonsRemoved += keys.length;
  }

  const summary = `${DRY_RUN ? "DRY RUN — would fix" : "Fixed"}: ${cleared} resolved siege flag(s), ${buffersFixed} scalar buffer(s), ${refsPruned} stale back-ref(s), ${boonsRemoved} stuck boon key(s)` + (reportOnly ? ` · ${reportOnly} need a hand check` : "");
  console.log(summary);
  console.groupEnd();

  try {
    await ChatMessage.create({
      speaker: { alias: "Siege & Boons Repair" },
      whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
      content: `<div><h3 style="margin:0 0 .3rem;">Siege &amp; Boons Repair${DRY_RUN ? " (dry run)" : ""}</h3>
        <p style="margin:.2rem 0;">${esc(summary)}</p>
        ${lines.length ? `<ul style="margin:.2rem 0 0 1rem;padding:0;">${lines.map(l => `<li>${l}</li>`).join("")}</ul>` : "<p><i>Nothing to repair.</i></p>"}
        ${DRY_RUN ? `<p style="opacity:.75;margin-top:.3rem;">Set <code>DRY_RUN = false</code> to apply.</p>` : ""}</div>`
    });
  } catch (e) { console.warn(TAG, "chat card failed", e); }
  ui.notifications.info(summary);
})();
