/**
 * patch-opening-quest-offer.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Owner spec 2026-08-24: when the Thatwards Ho OPENING beat resolves, offer
 * Allesh-Gilliam as the first active quest — a public assignment card whose
 * Accept button runs the Allesh-Gilliam Welcome beat and (via that beat's
 * questEffects `accept` row, added here if missing) begins tracking the
 * quest. When the Opening is later split into multiple scenes, move the
 * offerQuest field to whichever beat ends the sequence.
 *
 * Patches: thatwards_ho_opening_scene.offerQuest = { questId, acceptBeatId,
 * label, text } (quest resolved BY NAME against the live campaign), and
 * ensures allesh_gilliam_opening_scene carries the accept questEffect.
 */
(async () => {
  const DRY_RUN = false;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw)
    : foundry.utils.deepClone(campsRaw); // clone: object-typed settings return the LIVE cache — a dry run must never mutate it
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;

  // Resolve the Allesh-Gilliam quest by name against the live quest registry.
  const qapi = game.bbttcc?.api?.campaign?.quests;
  const quests = qapi?.listQuests ? (qapi.listQuests({ campaignId, status: "all", search: "" }) || []) : [];
  const quest = quests.find(q => /^allesh[- ]gilliam$/i.test(String(q?.name || "").trim()))
    || quests.find(q => /allesh/i.test(String(q?.name || "")));
  if (!quest) return ui.notifications.error("No quest named Allesh-Gilliam found in the live campaign.");
  report.push(`· quest resolved: "${quest.name}" (${quest.id})`);

  const opening = byId.get("thatwards_ho_opening_scene");
  const welcome = byId.get("allesh_gilliam_opening_scene");
  if (!opening || !welcome) return ui.notifications.error("Opening or Welcome beat missing.");

  const offer = {
    questId: String(quest.id),
    acceptBeatId: "allesh_gilliam_opening_scene",
    label: "Allesh-Gilliam",
    text: "Your coalition's holdings sit Thatwards, and the townstead of <b>Allesh-Gilliam</b> is where the road delivers you — walls to inspect, neighbors to meet, a bunker rumor to chase. First stop of the real map."
  };
  if (JSON.stringify(opening.offerQuest || null) !== JSON.stringify(offer)) {
    opening.offerQuest = offer; changes++;
    report.push("· Opening beat: offerQuest SET → accept runs the Welcome");
  } else report.push("· ok Opening (offerQuest already)");

  welcome.worldEffects = welcome.worldEffects || {};
  const qfx = Array.isArray(welcome.worldEffects.questEffects) ? welcome.worldEffects.questEffects : [];
  const hasAccept = qfx.some(r => String(r?.questId) === String(quest.id) && String(r?.action || "accept").toLowerCase() === "accept");
  if (!hasAccept) {
    qfx.push({ action: "accept", questId: String(quest.id), text: "The coalition takes the Allesh-Gilliam assignment. Go be met." });
    welcome.worldEffects.questEffects = qfx; changes++;
    report.push("· Welcome beat: questEffects accept row ADDED");
  } else report.push("· ok Welcome (accept row already)");

  console.log(`[patch-opening-quest-offer] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Quest-offer DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-quest-offer-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Quest-offer wiring APPLIED: ${changes} change(s). Backup downloaded. Re-run the Opening (or click Accept when it posts).`);
})();
