/**
 * patch-hidden-vault-found-2026-11-02.macro.js — click-through (2026-11-02, Dave: "We also never hit Gilbert. That wasn't retired was
 * it?"): The Hidden Vault (Gilbert, the Popcorn Council, the Matter Replicator) opens only on arriving at PolygonWood.a, and nothing in
 * the story ever pointed the table there; by Act 6 the act seal had closed it ("never started and Act 3 is over"). Its pointer exists —
 * polygonal_grove_breadcrumb ("the real thing … is north, in the Marches, in a wood that spells its name with a capital W") — but had no
 * trigger, no reveal and no choice. Now:
 *   • the breadcrumb is The Polygonal Grove's first-visit arrival (hexOverrides onEnterBeatIds, oncePerHex), reveals PolygonWood.a,
 *     and ends on "Noted.";
 *   • The Hidden Vault is a permanent place (QUEST_MAP evergreen in code; this stamps the DATA-layer quest def too).
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", ID = "polygonal_grove_breadcrumb", GROVE = "The Polygonal Grove", WOOD = "PolygonWood.a";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw)); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const report = []; let changes = 0;
  const b = camp.beats.find(x => x && x.id === ID); if (!b) return ui.notifications.error(`${ID} not found`);
  const grove = game.scenes.contents.flatMap(sc => [...sc.drawings]).find(d => d.flags?.["bbttcc-territory"]?.name === GROVE);
  if (!grove) return ui.notifications.error(`${GROVE} hex not found`);
  camp.hexOverrides = camp.hexOverrides || {}; const ov = camp.hexOverrides[grove.uuid] = camp.hexOverrides[grove.uuid] || {};
  const list = Array.isArray(ov.onEnterBeatIds) ? ov.onEnterBeatIds : [];
  if (!list.includes(ID)) { ov.onEnterBeatIds = [...list, ID]; changes++; report.push(`✚ ${GROVE}: arrival → ${ID}`); } else report.push(`· ok arrival`);
  b.inject = b.inject || {}; if (b.inject.oncePerHex !== true) { b.inject.oncePerHex = true; changes++; report.push(`✚ ${ID}: first visit only`); }
  b.worldEffects = b.worldEffects || {}; const rv = Array.isArray(b.worldEffects.revealHexes) ? b.worldEffects.revealHexes : [];
  if (!rv.includes(WOOD)) { b.worldEffects.revealHexes = [...rv, WOOD]; changes++; report.push(`✚ ${ID}: reveals ${WOOD}`); }
  b.choices = Array.isArray(b.choices) ? b.choices : []; if (!b.choices.length) { b.choices.push({ label: "Noted.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }); changes++; report.push(`✚ ${ID}: "Noted."`); }
  const data = api?.story?.data; const st = data?.get?.(cid); const q = st?.quests?.hidden_vault; let dataNeeded = false;
  if (q && q.evergreen !== true) { dataNeeded = true; changes++; report.push(`✚ hidden_vault: evergreen (data layer)`); } else report.push(`· ok hidden_vault evergreen (${q ? "data" : "code QUEST_MAP"})`);
  console.log(`[hidden vault found 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__hv = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-hidden-vault-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (dataNeeded) await data.saveQuest(cid, "hidden_vault", { quest: { ...q, evergreen: true } });
  ui.notifications.info(`Applied ${changes} change(s) — the Grove points at the Wood; the Vault stays open.`);
})();
