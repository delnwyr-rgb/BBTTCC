/**
 * patch-gloomgill-gate-2026-11-02.macro.js — GLOOMGILL'S GATE (Dave 2026-11-02: "after the Bunker is done, Gloomgill issues his summons,
 * but won't talk to them until all 10 sephira are lit, the bandit suffering has been ended, and when the wendigo have been dealt with.
 * Until then there is still unfinished business."). The summons is the Act Six card ("Gloomgill is waiting in Lake Suspicious").
 *   gloomgill_intro_scene "Talk" requires: every sephirah lit (sparkLit ×10) + the Bandit Accord ended (accord / absorption /
 *   humiliation) + the Long Table decided (wendigo_confluence_repair / redirect / break).
 *   "He won't begin." (shown while any is missing) → gloomgill_unfinished — one reminder line per missing thing (route-less asks).
 * Also: The Forgotten Cause (the Wendigo) is a permanent place — evergreen (code + data); its act seal had closed it.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const GG_PATCH = (() => {
  const SEPH = ["keter", "chokmah", "binah", "chesed", "geburah", "tiferet", "netzach", "hod", "yesod", "malkuth"];
  const LAMPS = SEPH.map(x => ({ sparkLit: x }));
  const ACCORD = { anyOf: [{ beatMark: "bandit_summit_accord" }, { beatMark: "bandit_summit_absorption" }, { beatMark: "bandit_summit_humiliation" }] };
  const WENDIGO = { anyOf: [{ beatMark: "wendigo_confluence_repair" }, { beatMark: "wendigo_confluence_redirect" }, { beatMark: "wendigo_confluence_break" }] };
  const notAccord = [{ beatMark: "bandit_summit_accord", not: true }, { beatMark: "bandit_summit_absorption", not: true }, { beatMark: "bandit_summit_humiliation", not: true }];
  const notWendigo = [{ beatMark: "wendigo_confluence_repair", not: true }, { beatMark: "wendigo_confluence_redirect", not: true }, { beatMark: "wendigo_confluence_break", not: true }];
  const anyDark = { anyOf: SEPH.map(x => ({ sparkLit: x, not: true })) };
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const UNFINISHED = {
    id: "gloomgill_unfinished", label: "Gloomgill — Unfinished Business", type: "dialog", timeScale: "scene", timePoints: 0, questId: "quest_gloomgill",
    tags: "quest.gloomgill", politicalTags: "",
    description: "He lets the microphone droop. \"No. Not yet. I don't examine people in the middle of a sentence.\" He counts on webbed fingers, not unkindly. \"You've left things open. The exam is about what you did with what you were given, and you haven't finished doing it. Come back when you have. I'll be here. I'm always here.\"",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [{ flag: "storyPhase", gte: 6 }], evergreen: true },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, storyChain: "", priority: "background",
    story: { quest: "gloomgill" }, worldEffects: {}, sceneId: "", where: "Lake Suspicious",
    choices: [
      ch("\"The lamps.\"", "", "Not every sephira burns yet: the Tree has dark places still.", { requires: [anyDark] }),
      ch("\"The Drowned South.\"", "", "The bandits' suffering hasn't been ended: no accord, no absorption, no surrender.", { requires: notAccord }),
      ch("\"The Wendigo.\"", "", "The Long Table is still waiting for its decision.", { requires: notWendigo }),
      ch("Leave the lake for now.", "")
    ]
  };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    if (!beats.some(b => b && b.id === UNFINISHED.id)) { beats.push(UNFINISHED); changes++; report.push("✚ gloomgill_unfinished"); } else report.push("· ok gloomgill_unfinished");
    const iscene = beats.find(b => b && b.id === "gloomgill_intro_scene"); if (!iscene) { conflicts.push("gloomgill_intro_scene not found"); return { changes, report, conflicts }; }
    const talk = (iscene.choices || []).find(c => c && /^talk$/i.test(String(c.label || "").trim()));
    if (!talk) conflicts.push("intro scene: no Talk");
    else if (!JSON.stringify(talk.requires || []).includes("sparkLit")) { talk.requires = [...(Array.isArray(talk.requires) ? talk.requires : []), ...LAMPS, ACCORD, WENDIGO]; changes++; report.push("✚ Talk: ten lamps + the Accord + the Long Table"); }
    else report.push("· ok Talk gate");
    if (!(iscene.choices || []).some(c => c && c.next === "gloomgill_unfinished")) {
      // shown while ANY condition is missing: any lamp dark, or no Accord ending at all, or no Long Table decision at all
      iscene.choices.unshift(ch("He won't begin.", "gloomgill_unfinished", "Unfinished business.", { requires: [{ anyOf: [...SEPH.map(x => ({ sparkLit: x, not: true })), { allOf: notAccord }, { allOf: notWendigo }] }] }));
      changes++; report.push("✚ intro scene: \"He won't begin.\" while anything is unfinished");
    } else report.push("· ok won't-begin choice");
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = GG_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw)); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = GG_PATCH.apply(camp); let extra = 0;
  const st = api.story.data.get(cid); const fq = st?.quests?.forgotten_cause; const needFC = !!(fq && fq.evergreen !== true); if (needFC) { extra++; report.push("✚ forgotten_cause: evergreen (data layer)"); }
  const total = changes + extra;
  console.log(`[gloomgill gate 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${total} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__gg = { dry: DRY_RUN, changes: total, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${total} change(s); see console.`);
  if (!total) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-gloomgill-gate-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (changes) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (needFC) await api.story.data.saveQuest(cid, "forgotten_cause", { quest: { ...fq, evergreen: true } });
  ui.notifications.info(`Applied ${total} change(s) — Gloomgill waits for the unfinished business.`);
})();
