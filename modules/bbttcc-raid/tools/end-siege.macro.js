// end-siege.macro.js — RUN IN-WORLD (GM). The "End Siege" button the siege engine never shipped.
// ─────────────────────────────────────────────────────────────────────────────
// Tears down ACTIVE siege(s) without resolving campaign consequences — for killing a
// siege that was stood up artificially (stress testing) when the defender is already
// swept but the interface lingers. This is a TEARDOWN, not a resolution: it does NOT
// write back morale / holdings / outcome (use the in-HUD Accept/Yield buttons for a
// "real" ending). It only clears the live state + UI so you can start fresh.
//
// What it removes, per siege:
//   • the hex's active siege state      (game.bbttcc.api.siege.clearState → flags.bbttcc-territory.-=siege)
//   • all muster/garrison unit tokens   (recallMuster → deleteToken hook refunds the pool)
//   • the tableau diorama staging        (tableau.disable → resets token depth/positions)
//   • the scene↔hex binding flag         (flags.bbttcc-raid.siegeHexUuid — so the scene re-reads as the hex map)
//   • the Siege HUD                       (forced re-render → _teardown once no siege is active)
//
// Shows a confirm dialog listing exactly what it found before touching anything.
// Idempotent + safe to re-run. Also catches ORPHANED dioramas (muster tokens / tableau /
// siegeHexUuid left behind even when no siege state is active).
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("End Siege: GM only.");

  const RAID_ID = "bbttcc-raid";
  const siege   = game.bbttcc?.api?.siege;
  const tableau = game.bbttcc?.api?.raid?.tableau;
  if (!siege?.list) return ui.notifications.error("game.bbttcc.api.siege not found — is bbttcc-raid active?");

  const esc = (s) => foundry.utils.escapeHTML?.(String(s ?? "")) ?? String(s ?? "");
  const factionName = (id) => (id && game.actors.get(id)?.name) || (id ? `(${id})` : "—");

  // ── 1. Survey ────────────────────────────────────────────────────────────────
  let sieges = [];
  try { sieges = siege.list() || []; } catch (e) { console.warn("[end-siege] list() failed", e); }

  // Scenes carrying siege debris (muster tokens / tableau enabled / scene↔hex binding),
  // even if no active siege state remains — orphan cleanup.
  const debrisScenes = [];
  for (const scene of game.scenes ?? []) {
    const musterTokens = (scene.tokens?.contents || []).filter(t => t?.flags?.[RAID_ID]?.musterDeployment);
    const tableauOn    = scene.flags?.[RAID_ID]?.tableau?.enabled === true;
    const boundHex     = scene.flags?.[RAID_ID]?.siegeHexUuid || null;
    if (musterTokens.length || tableauOn || boundHex) {
      debrisScenes.push({ scene, musterCount: musterTokens.length, tableauOn, boundHex });
    }
  }

  if (!sieges.length && !debrisScenes.length) {
    return ui.notifications.info("End Siege: no active sieges or leftover siege staging found. Nothing to do.");
  }

  // ── 2. Confirm dialog ─────────────────────────────────────────────────────────
  const siegeRows = sieges.map(s => {
    return `<li><b>${esc(s.hexName)}</b> — attacker <b>${esc(factionName(s.siege?.attackerFactionId))}</b>
      · status <code>${esc(s.siege?.status)}</code> · scene <i>${esc(game.scenes.get(s.sceneId)?.name || s.sceneId)}</i></li>`;
  }).join("");

  const debrisRows = debrisScenes.map(d => {
    const bits = [];
    if (d.musterCount) bits.push(`${d.musterCount} muster token(s)`);
    if (d.tableauOn)   bits.push("tableau diorama ON");
    if (d.boundHex)    bits.push("scene↔hex binding");
    return `<li><i>${esc(d.scene.name)}</i> — ${esc(bits.join(", "))}</li>`;
  }).join("");

  const content = `
    <div style="font-size:0.9rem;line-height:1.4;">
      <p>This <b>tears down</b> the following — it does <u>not</u> write back morale/holdings/outcome
      (artificial-test teardown). Use the HUD's Accept/Yield buttons for a real ending.</p>
      ${sieges.length ? `<p style="margin:.4em 0 .1em;"><b>Active siege(s):</b></p><ul style="margin:.1em 0 .4em 1.1em;">${siegeRows}</ul>` : ""}
      ${debrisScenes.length ? `<p style="margin:.4em 0 .1em;"><b>Leftover staging:</b></p><ul style="margin:.1em 0 .4em 1.1em;">${debrisRows}</ul>` : ""}
      <p style="color:#b06;">Proceed?</p>
    </div>`;

  const DV2 = foundry.applications?.api?.DialogV2;
  const ok = DV2
    ? await DV2.confirm({ window: { title: "⚔ End Siege — Teardown" }, content, rejectClose: false, modal: true })
    : await Dialog.confirm({ title: "⚔ End Siege — Teardown", content });
  if (!ok) return ui.notifications.info("End Siege: cancelled.");

  // ── 3. Teardown ────────────────────────────────────────────────────────────────
  const report = [];
  let mustersRemoved = 0;

  // 3a. Recall every muster/garrison token on every staging scene (deleteToken hook refunds pools).
  for (const d of debrisScenes) {
    if (!d.musterCount) continue;
    try {
      const r = await siege.recallMuster({ sceneId: d.scene.id });
      mustersRemoved += Number(r?.removed || 0);
    } catch (e) { console.warn("[end-siege] recallMuster failed on", d.scene.name, e); report.push(`⚠ muster recall failed on ${d.scene.name}`); }
  }

  // 3b. Clear each active siege's hex state.
  for (const s of sieges) {
    try { await siege.clearState(s.hexUuid); report.push(`✓ cleared siege at ${s.hexName}`); }
    catch (e) { console.warn("[end-siege] clearState failed", s.hexUuid, e); report.push(`⚠ clearState failed at ${s.hexName}`); }
  }

  // 3c. Disable tableau diorama + drop the scene↔hex binding on every staging scene.
  for (const d of debrisScenes) {
    try { if (d.tableauOn && tableau?.disable) await tableau.disable(d.scene); } catch (e) { console.warn("[end-siege] tableau.disable failed", e); }
    try { if (d.boundHex) await d.scene.unsetFlag(RAID_ID, "siegeHexUuid"); } catch (e) { console.warn("[end-siege] unset siegeHexUuid failed", e); }
  }

  // 3d. Force the Siege HUD to re-render → it tears itself down when no siege is active.
  try { Hooks.callAll("bbttcc:siege:ticked", {}); } catch (_e) {}

  // ── 4. Report ───────────────────────────────────────────────────────────────────
  const summary = [
    `Ended ${sieges.length} siege(s).`,
    mustersRemoved ? `Recalled ${mustersRemoved} muster unit(s).` : null,
    debrisScenes.length ? `Cleaned staging on ${debrisScenes.length} scene(s).` : null
  ].filter(Boolean).join(" ");

  ui.notifications.info(`⚔ ${summary}`);
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<div><b>⚔ Siege teardown complete</b><br>${esc(summary)}${report.length ? `<br><small>${report.map(esc).join("<br>")}</small>` : ""}</div>`
  });
  console.log("[end-siege]", summary, report);
})();
