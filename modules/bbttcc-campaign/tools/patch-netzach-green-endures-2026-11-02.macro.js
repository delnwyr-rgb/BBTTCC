/**
 * patch-netzach-green-endures-2026-11-02.macro.js — THE GREEN THAT ENDURES: Netzach's second lighter (Dave 2026-11-02: "Kudzu Reach
 * please" — for tables that skipped the Widening Trail's Port Kudzu testimony, the only beat that lit Netzach; Gloomgill waits for all ten).
 * At Drowned Kudzu Reach f, where the Conceptual Netzach spark is already seated (dormant). No anywhere beats:
 *   start   netzach_word — autoFire once the Bandit Accord has ended and NO Netzach spark is lit (requires sparkLit — whatever left the lamp
 *           dark: the Port Kudzu branch skipped, or its spark corrupted when the testimony tried to light it):
 *           Maccio's lieutenant (the eel-jerky envoy) brings word from the Evil Good Faction; reveals the hex, accepts the quest
 *   arrival netzach_reach — the hex's arrival: a drowned town under kudzu, the lamp in an overgrown bandstand. Netzach = victory through
 *           endurance and feeling: wait it out (Mind DC 14) · sing to it (Presence DC 14) · cut a way in (Violence OP DC 13 — it lights,
 *           but the hex darkens for the forcing) · a miss closes the green again (netzach_tangle → retry)
 *   closer  netzach_lamp — integrates Netzach at the hex; +15 Culture/Faith; quest complete
 * + story data + script, hex arrival, registry row quest_green_endures. Idempotent (rerun = 0). DRY_RUN first. Backups. GM only.
 */
const NETZACH_PATCH = (() => {
  const Q = "green_endures", QREG = "quest_green_endures", HEX = "Drowned Kudzu Reach f";
  const mark = (id) => ({ beatMark: id }), not = (id) => ({ beatMark: id, not: true });
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const chk = (label, stat, dc, next, failNext, extra = {}) => ch(label, next, "", { checkStat: stat, checkDC: dc, failNext, ...extra });
  const fe = (o) => ({ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false, ...o });
  const beat = (id, label, description, choices, o = {}) => ({
    id, label, type: o.type || "dialog", timeScale: "scene", timePoints: 0, questId: QREG, tags: "quest.green_endures,spark.netzach", politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: o.repeatable === true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: o.requires || [mark("netzach_word")], evergreen: true, ...(o.autoFire ? { autoFire: true } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: "", priority: "background", story: { quest: Q, ...(o.role ? { role: o.role } : {}) }, choices, worldEffects: o.worldEffects || {}, sceneId: "",
    where: o.where || HEX
  });
  const BEATS = [
    beat("netzach_word", "Word From the Evil Good Faction",
      "The punt comes up the channel under a white rag again, out of habit more than need: the same lieutenant, the same courteous terror, {{#played bandit_summit_accord}}now flying the Evil Good Faction's banner{{else}}in a Muster jacket that doesn't fit yet{{/played}} and visibly unsure what to do with his hands now that nobody is being robbed. He has brought eel jerky. He has also brought word.\n\n\"The patrols go out past the Reach now,\" he says. \"Drowned Kudzu, out where the old town went under. There's a light in the green. Not fire. It sings, a bit, at night. The crews won't cut toward it. Nobody told them not to. They just won't.\"",
      [ch("Noted. And thank you for the jerky.", "")],
      { autoFire: true, role: "start", where: "anywhere",
        requires: [{ anyOf: [mark("bandit_summit_accord"), mark("bandit_summit_absorption"), mark("bandit_summit_humiliation")] }, { sparkLit: "netzach", not: true }],
        worldEffects: { revealHexes: [HEX], questEffects: [{ action: "accept", questId: QREG, beatId: "", state: "active", text: "The Green That Endures." }] } }),
    beat("netzach_reach", "Drowned Kudzu Reach — The Green That Endures",
      "{{#played netzach_lamp}}The green has let the bandstand breathe. The lamp inside burns steady, and the kudzu leans toward it the way people lean toward a fire.{{else}}A town went under here and the kudzu came after it, the way kudzu comes after everything: patiently, completely, without any malice at all. Roofs are green hills. A church is a green cliff. In the middle of the square, a bandstand has become a green bell, and from inside it, very faintly, something hums a tune nobody taught it.\n\nThe vines don't block the way so much as stand in it. They are waiting to see what you do.{{/played}}",
      [chk("Wait it out — let it open for you", "mind", 14, "netzach_waited", "netzach_tangle", { requires: [not("netzach_lamp")] }),
       chk("Sing back to it", "presence", 14, "netzach_sung", "netzach_tangle", { requires: [not("netzach_lamp")] }),
       chk("Cut a way in", "op.violence", 13, "netzach_cut", "netzach_tangle", { requires: [not("netzach_lamp")] }),
       ch("Leave it be.", "")],
      { repeatable: true, type: "exploration" }),
    beat("netzach_tangle", "The Green Closes Again", "Whatever you did, the green has an answer to it, and the answer is more green. The way you were making closes over, softly, the way water closes over a dropped stone. It isn't angry. It's simply still here, and so is the hum, and so is the light. It will be here next time too.",
      [ch("Back to the square.", "netzach_reach")], { repeatable: true }),
    beat("netzach_waited", "Waited", "You sit down in the square and don't do anything, which is the hardest thing a party of Stewards has done all year. An hour. Most of a day. Somewhere in the second hour the vines in front of the bandstand begin, very slowly, to lean apart, the way a crowd makes room for someone it has decided to like.",
      [ch("Go in.", "netzach_lamp")]),
    beat("netzach_sung", "Sung", "Somebody starts humming the tune back. Badly, then less badly. The green listens to the whole thing, and when it's over the bandstand's vines draw back like a curtain, which is exactly what they had been waiting for: not permission. Applause.",
      [ch("Go in.", "netzach_lamp")]),
    beat("netzach_cut", "Cut", "Blades and a good deal of effort, and the bandstand is open. The green doesn't fight. It just stops humming. Inside, the lamp is there, and it will still light for you, but the square is very quiet as you walk in, and it stays quiet after.\n\n⚙ GM: the forcing costs the hex: Darkness +1.",
      [ch("Go in.", "netzach_lamp")], { worldEffects: { hexDarkness: { delta: 1, hexName: HEX } } }),
    beat("netzach_lamp", "The Lamp in the Bandstand", "Under the green, the bandstand's floor is still painted for a summer concert nobody was left to play. The lamp sits where the conductor would have stood. It lights as you reach it, the green of new leaves with the sun behind them: Netzach. Victory that is mostly not stopping. Outside, the hum picks up again, a little louder, as if the whole drowned town had remembered the next verse.",
      [ch("Leave the green to it.", "")],
      { role: "closer", worldEffects: { hexSpark: [{ action: "integrate", hexName: HEX }], factionEffects: [fe({ opDeltas: { culture: 15, faith: 15 } })], questEffects: [{ action: "complete", questId: QREG, state: "completed", text: "The Green That Endures: Netzach lit at Drowned Kudzu Reach." }] } })
  ];
  const QUEST = { name: "The Green That Endures", act: 3, keystone: false, hex: HEX, registryId: QREG, chapters: {}, evergreen: true };
  const SCRIPT = { giver: "Ralph Maccio's lieutenant, with eel jerky", description: "Out past the Drowned South, a light hums inside the kudzu that swallowed a town, and the Evil Good Faction's crews won't cut toward it.",
    steps: [
      { id: "word", label: "Word From the Reach", line: "Ride out to Drowned Kudzu Reach and find the light in the green.", beats: ["netzach_word", "netzach_reach"], milestone: true, logged: "Maccio's lieutenant brought word of a singing light in the drowned kudzu.", done: { mark: "netzach_reach" } },
      { id: "green", label: "The Green", line: "Get into the bandstand without breaking what's growing there, if you can.", beats: ["netzach_tangle", "netzach_waited", "netzach_sung", "netzach_cut"], logged: "The green let you in, one way or another.", done: { anyOf: ["netzach_waited", "netzach_sung", "netzach_cut"] } },
      { id: "lamp", label: "The Lamp", line: "Light the lamp in the bandstand.", beats: ["netzach_lamp"], milestone: true, logged: "Netzach is lit at Drowned Kudzu Reach.", done: { mark: "netzach_lamp" } }
    ] };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
    const report = [], conflicts = []; let changes = 0;
    for (const nb of BEATS) {
      const cur = beats.find(b => b && b.id === nb.id);
      if (!cur) { beats.push(nb); changes++; report.push(`✚ ${nb.id}: ${nb.label}`); continue; }
      // 2026-11-02 upgrade: netzach_word first shipped gated on questBucket quest_bandit_accord "completed" — the registry row stays
      // "active" after the story closes the Accord, so the engine never saw it met; it now gates on the Accord's ending marks
      if (nb.id === "netzach_word" && !JSON.stringify(cur.inject?.requires || []).includes("sparkLit")) { cur.inject.requires = nb.inject.requires; cur.description = nb.description; changes++; report.push(`✚ netzach_word: gated on the Accord's endings + Netzach NOT lit (sparkLit)`); continue; }
      // labels: the engine appends the check suffix itself ("· Mind DC 14"); a typed one doubled it
      if (nb.id === "netzach_reach") { for (const c of (cur.choices || [])) { const nl = String(c.label || "").replace(/\s*·\s*(Mind|Presence) DC \d+\s*$/i, ""); if (nl !== c.label) { c.label = nl; changes++; report.push(`✚ netzach_reach: label "${nl}"`); } } }
      report.push(`· ok ${nb.id}`);
    }
    return { changes, report, conflicts };
  }
  return { apply, QUEST, SCRIPT, Q, QREG, HEX, BEATS };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = NETZACH_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw)); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const P = NETZACH_PATCH; const { changes, report, conflicts } = P.apply(camp); let extra = 0;
  const hex = game.scenes.contents.flatMap(s => [...s.drawings]).find(d => d.flags?.["bbttcc-territory"]?.name === P.HEX);
  if (!hex) conflicts.push(`${P.HEX} hex not found`);
  else { camp.hexOverrides = camp.hexOverrides || {}; const ov = camp.hexOverrides[hex.uuid] = camp.hexOverrides[hex.uuid] || {}; const l = Array.isArray(ov.onEnterBeatIds) ? ov.onEnterBeatIds : []; if (!l.includes("netzach_reach")) { ov.onEnterBeatIds = [...l, "netzach_reach"]; extra++; report.push(`✚ ${P.HEX}: arrival → netzach_reach`); } }
  const st = api.story.data.get(cid); const needQuest = !st?.quests?.[P.Q]; if (needQuest) { extra++; report.push(`✚ story data: quest + script "${P.QUEST.name}"`); }
  const qRaw = game.settings.get(NS, "quests"); const qWasStr = typeof qRaw === "string"; const QR = JSON.parse(qWasStr ? qRaw : JSON.stringify(qRaw || {}));
  const needReg = !QR[P.QREG]; if (needReg) { extra++; report.push(`✚ registry: ${P.QREG}`); }
  const total = changes + extra;
  console.log(`[netzach green endures 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${total} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__netzach = { dry: DRY_RUN, changes: total, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${total} change(s); see console.`);
  if (!total) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-netzach-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (changes || hex) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (needQuest) await api.story.data.saveQuest(cid, P.Q, { quest: P.QUEST, script: P.SCRIPT });
  if (needReg) { const now = Date.now(); QR[P.QREG] = { id: P.QREG, v: 1, name: P.QUEST.name, description: `<p>${P.SCRIPT.description}</p>`, tags: [], createdTs: now, updatedTs: now, status: "active", giver: P.SCRIPT.giver, nextLine: P.SCRIPT.steps[0].line }; await game.settings.set(NS, "quests", qWasStr ? JSON.stringify(QR) : QR); }
  ui.notifications.info(`Applied ${total} change(s) — the green is waiting.`);
})();
