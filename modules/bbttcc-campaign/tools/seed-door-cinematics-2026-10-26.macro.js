/* seed-door-cinematics-2026-10-26.macro.js — every town-hub door opens on a short filmed cinematic (Dave, 2026-10-26).
 *  Why: "ensure that all doors start with short cinematic beats. They all have them filmed." 24 doors opened straight
 *   into a dialog / narration / skill scene (or had no beat at all); every one's target scene already has its filmed
 *   HexChrome POV video as the background.
 *  For each hub door (not the ⇦⇧⇨⇩ town-to-town arrows, keys "to_*") whose locationLink.beatId is not a cinematic:
 *   NEW BEAT  <town>_<doorkey>_door_exterior — type cinematic, cinematic.startSceneId = the door's target scene (its
 *             filmed POV), durationMs = the film's length capped at 24 s (the existing exteriors' length), description
 *             EMPTY (the film speaks; the opener's text follows on "Go in" — copying it read twice; Dave can write an
 *             exterior line in the Beat Polish doc), questId = the opener's, inject.requires = the opener's (the film plays
 *             only when what's behind it could), tags "town-door exterior", playerFacing.
 *             Choices: "Go in" → the old opener (the North Gate pattern); a door with nothing behind it gets "Look around".
 *   EDIT DOOR locationLink.beatId → the new cinematic; the old opener is kept as locationLink.openerBeatId.
 *  Idempotent (a door already on a cinematic is skipped); DRY_RUN default true; `campaigns` written as a true JSON copy.
 *  GM only. Back up first: world settings + scenes (the door links live on the hub scenes' Drawings).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", TS = "bbttcc-travel";
  const MAX_MS = 24000, MIN_MS = 6000;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : JSON.parse(JSON.stringify(campsRaw));
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const report = []; const doorUpdates = []; let created = 0;

  const slug = (s) => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const filmMs = (src) => new Promise((res) => {
    if (!src) return res(MAX_MS);
    const v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
    const done = (ms) => { try { v.removeAttribute("src"); v.load(); } catch (_e) {} res(ms); };
    const t = setTimeout(() => done(MAX_MS), 8000);
    v.onloadedmetadata = () => { clearTimeout(t); const d = Number(v.duration); done(Number.isFinite(d) && d > 0 ? Math.max(MIN_MS, Math.min(MAX_MS, Math.round(d * 1000))) : MAX_MS); };
    v.onerror = () => { clearTimeout(t); done(MAX_MS); };
    v.src = src;
  });

  for (const hub of game.scenes.filter(s => s.flags?.[TS]?.isTownHub)) {
    const town = String(hub.flags[TS].townLabel || hub.name).split("·")[0].trim();
    for (const doc of hub.drawings.filter(d => d.flags?.[TS]?.locationLink)) {
      const link = doc.flags[TS].locationLink;
      const key = String(link.key || doc.id);
      if (key.startsWith("to_")) continue;                                    // town-to-town arrows stay plain
      const opener = link.beatId ? byId.get(String(link.beatId)) : null;
      if (opener?.type === "cinematic") continue;                             // already opens on a film
      const where = `${hub.flags[TS].townLabel} › ${link.label}`;
      const tgt = await fromUuid(link.targetSceneUuid).catch(() => null);
      if (!tgt) { report.push(`⚠ ${where}: target scene missing — skipped`); continue; }
      const film = String(tgt.background?.src || "");
      if (!/\.(webm|mp4|m4v)$/i.test(film)) { report.push(`⚠ ${where}: target scene "${tgt.name}" has no filmed background — skipped`); continue; }
      const id = `${slug(town)}_${slug(key)}_door_exterior`;
      if (byId.has(id)) { report.push(`· ${where}: ${id} exists — door re-pointed only`); }
      else {
        const ms = await filmMs(film);
        const req = opener ? JSON.parse(JSON.stringify(opener.inject?.requires || [])) : [{ flag: "storyPhase", gte: 1 }];
        const beat = {
          id, label: `${town} - ${link.label} Exterior`, type: "cinematic",
          description: "",
          sceneId: tgt.id, cinematic: { enabled: true, durationMs: ms, startSceneId: tgt.uuid, nextSceneId: null },
          playerFacing: true, questId: opener?.questId || null, questRole: null, questStep: null,
          tags: "town-door exterior", timeScale: "scene", timePoints: 0, actors: [],
          inject: { allowMulti: "inherit", cooldownTurns: 0, evergreen: true, fallbackOnDecline: "inherit", oncePerHex: false,
                    oncePerHexGlobal: "inherit", promptGM: "inherit", repeatable: true, requires: req },
          choices: [opener
            ? { label: "Go in", description: "", next: opener.id, failNext: "", checkStat: "", checkDC: 0 }
            : { label: "Look around", description: "", next: "", failNext: "", checkStat: "", checkDC: 0 }],
          outcomes: { success: null, failure: null }, refs: {}, unlocks: { maneuvers: [], strategics: [] },
          worldEffects: { factionEffects: [], questEffects: [], radiationDelta: 0, relationshipEffects: [], sparkKey: null, territoryOutcome: null, turnRequests: [], warLog: "", worldModifiers: [] },
          seed: { by: "seed-door-cinematics-2026-10-26", door: `${hub.id}/${doc.id}`, film: film.split("/").pop() }
        };
        camp.beats.push(beat); byId.set(id, beat); created++;
        report.push(`✚ ${where}: ${id} (${(ms / 1000).toFixed(1)} s of ${film.split("/").pop()}) → ${opener ? `Go in → ${opener.id}` : "Look around (nothing behind it)"}`);
      }
      doorUpdates.push({ hub, doc, patch: { [`flags.${TS}.locationLink.beatId`]: id, ...(link.beatId ? { [`flags.${TS}.locationLink.openerBeatId`]: link.beatId } : {}) } });
    }
  }

  console.log(`[door cinematics 2026-10-26] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${created} new beat(s), ${doorUpdates.length} door(s) re-pointed\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${created} beat(s), ${doorUpdates.length} door(s); see console.`);
  if (!created && !doorUpdates.length) return ui.notifications.info("Nothing to change — every door already opens on a cinematic.");
  if (created) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  for (const u of doorUpdates) await u.hub.updateEmbeddedDocuments("Drawing", [{ _id: u.doc.id, ...u.patch }]);
  ui.notifications.info(`Applied — ${created} door cinematic(s) created, ${doorUpdates.length} door(s) now open on film.`);
})();
