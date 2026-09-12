/**
 * audit-hex-resources.macro.js — GM console/macro. DRY_RUN=true by default.
 *
 * Sweeps every territory hex on every scene and recomputes what its resources
 * SHOULD be from its own Type × Size ladder, sephirot bonus and modifiers —
 * through the engine's own api.territory.recomputeHexResources (dryRun), so the
 * audit can never disagree with the Hex Config save or the income pass.
 *
 * Why: a hex can carry a stale ladder under a fresh label — Bedlam Thirdword
 * (2026-09-12) read "town" but its stored resources were farm × outpost, because
 * the size was still Outpost when its type was flipped and re-saved. The income
 * engine reads flags.resources, so a quiet mismatch is a quiet income leak.
 *
 * Reports, per hex: stored vs expected resources, type/size, owner, manual flag.
 *   • MISMATCH  — non-manual hex whose stored resources ≠ its own ladder → fixed when DRY_RUN=false
 *   • CALC-STALE — resources already match, only the stored calc block is missing/old → backfilled
 *   • MANUAL    — manualOverride on with hand-set values: reported, never touched
 *   • MIS-SIZED — owned/occupied hex at size "none" (the "new outposts read None" trap)
 * Usage: paste in the GM console, read the table, set DRY_RUN=false, run again.
 */
(async () => {
  const DRY_RUN = true;                          // ← flip to false to write the fixes
  const ONLY_OWNED = false;                      // true = only hexes with a faction owner
  const MODT = "bbttcc-territory";

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.territory;
  if (typeof api?.recomputeHexResources !== "function") return ui.notifications.error("territory.recomputeHexResources missing — deploy territory main.js (2026-09-10+).");

  const fmt = (r) => ["food","materials","trade","military","knowledge"].map(k => Number(r?.[k] || 0)).join("/");
  const rows = []; let fixed = 0;
  for (const sc of game.scenes) {
    for (const d of sc.drawings) {
      const tf = d.flags?.[MODT]; if (!tf || !(tf.isHex === true || tf.kind === "territory-hex")) continue;
      const owner = tf.factionId || tf.ownerId || "";
      if (ONLY_OWNED && !owner) continue;
      const name = String(tf.name || d.text || d.id).replace(/\s+/g, " ").trim();
      const ownerName = owner ? (game.actors.get(owner)?.name || owner) : "—";
      let rep = null; try { rep = await api.recomputeHexResources(d, { source: "audit", dryRun: true }); } catch (e) { rows.push({ scene: sc.name, hex: name, owner: ownerName, status: "ERROR", note: String(e?.message || e) }); continue; }
      if (!rep?.ok) { rows.push({ scene: sc.name, hex: name, owner: ownerName, status: "ERROR", note: rep?.error || "?" }); continue; }
      const size = String(tf.size || "none").toLowerCase(), status = String(tf.status || "").toLowerCase();
      const misSized = size === "none" && (owner || status === "occupied" || status === "claimed");
      if (rep.manual) rows.push({ scene: sc.name, hex: name, owner: ownerName, type: rep.type, size, status: "MANUAL", stored: fmt(rep.before), ladder: fmt(rep.base), note: misSized ? "size none" : "" });
      else if (rep.changed) {
        // Resources equal but no/stale calc block → the recompute only backfills calc; not a yield problem.
        const calcOnly = fmt(rep.before) === fmt(rep.resources);
        rows.push({ scene: sc.name, hex: name, owner: ownerName, type: rep.type, size, status: DRY_RUN ? (calcOnly ? "CALC-STALE" : "MISMATCH") : (calcOnly ? "CALC-FIXED" : "FIXED"), stored: fmt(rep.before), expected: fmt(rep.resources), note: (misSized ? "size none" : "") + (calcOnly ? (misSized ? "; " : "") + "resources already match — calc block backfilled" : "") });
        if (!DRY_RUN) { try { await api.recomputeHexResources(d, { source: "audit-hex-resources" }); fixed++; } catch (e) { rows[rows.length - 1].status = "ERROR"; rows[rows.length - 1].note = String(e?.message || e); } }
      }
      else if (misSized) rows.push({ scene: sc.name, hex: name, owner: ownerName, type: rep.type, size, status: "MIS-SIZED", stored: fmt(rep.before), expected: fmt(rep.resources), note: "owned/occupied at size none — set a size in Hex Config" });
    }
  }
  const counts = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
  console.group(`[audit-hex-resources] ${DRY_RUN ? "DRY RUN — " : ""}${rows.length} finding(s) ${JSON.stringify(counts)}`);
  if (rows.length) console.table(rows); else console.log("every non-manual hex matches its ladder ✓");
  console.groupEnd();
  ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}hex resources audit: ${rows.length} finding(s) ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ") || "— all clean"}${DRY_RUN ? " (nothing written; see console)" : ` — ${fixed} fixed`}.`);
})();
