/* patch-kt-fiddle-loyalty-2026-10-27.macro.js — listening to the fiddle at the cookline earns Khezek-Tor's regard
 *  (Dave, 2026-10-27: "listening to the fiddle in KT should give a loyalty bonus, as people are impressed that we like that
 *  kind of thing, or at least can pretend to really well :)").
 *   NEW   kt_the_fiddle — "Khezek Tor — The Fiddle" (cloned from rc_bez_bench: KT quest + story, Act 1, once). Its text = the
 *         fiddle choice's old after-text + the bench deciding you're all right. factionEffects @coalition loyaltyDelta +1.
 *         "Back to the bench" → khezek_tor_town_walk.
 *   EDIT  khezek_tor_town_walk "Listen to the fiddle" → kt_the_fiddle (its after-text moves into the beat), hidden once heard.
 *  Idempotent; DRY_RUN default true; `campaigns` as a true JSON copy. GM only. Back up world settings first.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", ID = "kt_the_fiddle", WALK = "khezek_tor_town_walk";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const walk = byId.get(WALK), tpl = byId.get("rc_bez_bench");
  if (!walk || !tpl) return ui.notifications.error(`${WALK} or rc_bez_bench missing — nothing changed.`);
  const fiddle = (walk.choices || []).find(c => /listen to the fiddle/i.test(String(c?.label || "")));
  if (!fiddle) return ui.notifications.error(`${WALK}: no "Listen to the fiddle" choice — nothing changed.`);

  if (byId.has(ID)) report.push(`· ok ${ID} exists`);
  else {
    const heard = String(fiddle.description || "").trim() || "Three songs. All arguably the same song, and it's a very good argument.";
    const b = JSON.parse(JSON.stringify(tpl));
    Object.assign(b, {
      id: ID, label: "Khezek Tor — The Fiddle",
      description: `${heard}\n\nSomebody catches you tapping along, and by the second song the bench has noticed. By the third, the fiddler is playing at you. Nobody up here expected the coalition to like this kind of thing. Whether you actually do, or are just very good at pretending, turns out not to matter much at the mine's mouth. Either one counts.`,
      memoryText: "Sat through all three songs at the Khezek-Tor cookline. The bench decided we were all right.",
      inviteText: "", tags: "", timePoints: 0,
      choices: [{ label: "Back to the bench", description: "", next: WALK, failNext: "", checkStat: "", checkDC: 0 }],
      worldEffects: { factionEffects: [{ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 1, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false }],
                      questEffects: [], radiationDelta: 0, relationshipEffects: [], sparkKey: null, territoryOutcome: null, turnRequests: [], warLog: "", worldModifiers: [] },
      seed: { by: "patch-kt-fiddle-loyalty-2026-10-27" }
    });
    delete b.speakerActorId; delete b.audio;
    b.inject = { ...(b.inject || {}), repeatable: false, evergreen: true };
    camp.beats.splice(camp.beats.indexOf(tpl) + 1, 0, b); byId.set(ID, b); changes++;
    report.push(`✚ ${ID}: The Fiddle — coalition loyalty +1, once`);
  }

  if (fiddle.next === ID) report.push(`· ok ${WALK}: the fiddle leads to ${ID}`);
  else {
    fiddle.next = ID; fiddle.description = "";
    fiddle.requires = [...(Array.isArray(fiddle.requires) ? fiddle.requires : []), { beatMark: ID, not: true }];
    changes++; report.push(`✎ ${WALK}: "Listen to the fiddle" → ${ID} (hidden once heard)`);
  }

  console.log(`[kt fiddle 2026-10-27] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the fiddle earns the bench.`);
})();
