/**
 * patch-kt-seal-before-etta-2026-10-28.macro.js — Dave, 10-28: "We haven't talked to Etta Bloom yet. We don't know about the
 * Valhaulan Seal. We know that there are 'fresh carvings in someone else's handwriting' … Having already found and dealt
 * with the Valhaulan Seal before talking to her will also require some changes to her conversation depending on the order."
 * Needs bbttcc-campaign module.js with `{{#played a|b|c}}` (any-of, 2026-10-28) deployed FIRST.
 *
 * RULE: the word "Valhaulan" reaches the table only after Etta says it (allesh_gilliam_etta_bloom_conversation, or the
 * retail version ag_etta_bought_in). Before that it is a seal with fresh sigils in a hand nobody at Khezek Tor writes.
 *   · Beat LABELS (window titles — not token-expanded) → neutral: "The Sealed Shaft" / "The Old Seal".
 *   · KT text (cinematic, the seal, the flare, the Restore subtitle, the switchback's Lift Hall line, the settle) →
 *     {{#played ETTA}}Valhaulan…{{else}}neutral…{{/played}}. The settle also loses "a sympathizer cell got collared"
 *     (the cult line Dave cut from the Restore outcome).
 *   · Quest Log: the KT script's seal step is "The Sealed Shaft"; the registry quest is "Khezek Tor - The Sealed Shaft"
 *     with a neutral description. (The Seal's own script + That One Night's line are code — story-scripts.js.)
 * ETTA, SEAL ALREADY DECIDED (any of restore / redirect / break): she knows you've been down there — the sigil is no longer
 *   news, "go check it out" becomes "you already know how bad", the three-column math ends on the column you chose, and
 *   her parting line speaks to what you did instead of what you'll do. New prose = Claude's drafts for Dave to wordsmith.
 * Idempotent (rerun = 0). DRY_RUN first. Backup of `campaigns` + `quests` → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = JSON.parse(questsWasStr ? questsRaw : JSON.stringify(questsRaw || {}));
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const report = []; const conflicts = []; let changes = 0, questChanges = 0;
  const ETTA = "allesh_gilliam_etta_bloom_conversation|ag_etta_bought_in";
  const DONE = "khezek_tor_the_vaulhaulan_seal_restore|khezek_tor_the_vaulhaulan_seal_redirect|khezek_tor_the_vaulhaulan_seal_break";
  const K = (s) => `{{#played ${ETTA}}}${s}`;   // helper only for readability below

  // text edit: replace `from` with `to` once; skip if `done` marker already present
  const edit = (id, field, from, to, doneMarker, note) => {
    const b = byId(id); if (!b) return conflicts.push(`${id}: not found`);
    const obj = field.startsWith("choice:") ? (b.choices || []).find(c => c?.label === field.slice(7)) : b;
    const key = field.startsWith("choice:") ? "description" : field;
    if (!obj) return conflicts.push(`${id}: ${field} not found`);
    const cur = String(obj[key] || "");
    if (cur.includes(doneMarker)) return;
    if (!cur.includes(from)) return conflicts.push(`${id} ${field}: anchor not found — "${from.slice(0, 50)}…"`);
    obj[key] = cur.replace(from, to); changes++; report.push(`✎ ${id} ${field}: ${note}`);
  };
  const label = (id, to) => { const b = byId(id); if (!b) return conflicts.push(`${id}: not found`); if (b.label === to) return; report.push(`✎ ${id} label: "${b.label}" → "${to}"`); b.label = to; changes++; };

  // ── labels ──
  label("khezek_tor_valhaulan_seal_quest_acceptance", "Khezek-Tor - The Sealed Shaft, Quest Acceptance");
  label("khezek_tor_valhaulan_seal_cinematic", "Khezek-Tor - The Sealed Shaft");
  label("khezek_tor_the_vaulhaulan_seal", "Khezek-Tor - The Old Seal");
  label("khezek_tor_the_vaulhaulan_seal_restore", "Khezek-Tor - The Old Seal, restore");
  label("khezek_tor_the_vaulhaulan_seal_redirect", "Khezek-Tor - The Old Seal, redirect");
  label("khezek_tor_the_vaulhaulan_seal_break", "Khezek-Tor - The Old Seal, break");

  // ── KT text ──
  edit("khezek_tor_valhaulan_seal_cinematic", "description", "The sealed shaft wears Valhaulan sigils,",
    `The sealed shaft wears ${K("Valhaulan sigils")}{{else}}sigils in a hand nobody at Khezek Tor writes{{/played}},`, `{{#played ${ETTA}}}`, "Valhaulan only after Etta");
  edit("khezek_tor_the_vaulhaulan_seal", "description", "The shaft face, up close: Valhaulan sigils laid over older work",
    `The shaft face, up close: ${K("Valhaulan sigils")}{{else}}fresh sigils{{/played}} laid over older work`, `{{#played ${ETTA}}}`, "Valhaulan only after Etta");
  edit("khezek_tor_seal_fail", "description", "The Valhaulan seal answers your touch",
    `The ${K("Valhaulan ")}{{/played}}seal answers your touch`, `{{#played ${ETTA}}}`, "Valhaulan only after Etta");
  edit("khezek_tor_the_vaulhaulan_seal", "choice:Restore the seal", "As best you can figure, the Valhaulans have weaponized",
    `As best you can figure, ${K("the Valhaulans have")}{{else}}whoever carved this has{{/played}} weaponized`, `{{#played ${ETTA}}}`, "Restore subtitle: Valhaulans only after Etta");
  edit("khezek_tor_the_vaulhaulan_seal", "choice:Restore the seal", "And then have a long talk with some Valhaulans.",
    `${K("And then have a long talk with some Valhaulans.")}{{else}}And then find out whose handwriting this is.{{/played}}`, "find out whose handwriting", "Restore subtitle: the closing line");
  edit("khezek_tor_quest_scene", "choice:The Lift Hall", "This is how to access the Valhaulan Seal.",
    "This is how to reach the sealed gallery Calder's crews won't work.", "the sealed gallery Calder's crews", "switchback: no Valhaulan Seal");
  for (const k of ["restore", "redirect", "break"])
    edit("khezek_hex_settles", "description", `{{#played khezek_tor_the_vaulhaulan_seal_${k}}} The Valhaulan seal`,
      `{{#played khezek_tor_the_vaulhaulan_seal_${k}}} The {{#mark ${ETTA}}}Valhaulan {{/mark}}seal`, `{{#played khezek_tor_the_vaulhaulan_seal_${k}}} The {{#mark`, `settle (${k}): Valhaulan only after Etta`);
  edit("khezek_hex_settles", "description", ", the mountain ran hot for a turn taking its own burden back, and a sympathizer cell got collared for saying so.",
    " and the mountain ran hot for a turn taking its own burden back.", "taking its own burden back.{{/played}}", "settle (restore): the cult line removed");

  // ── Quest Log (live KT script) + the registry quest ──
  const ks = camp.story?.scripts?.khezek_tor?.steps?.find(s => s?.id === "seal");
  if (ks && ks.label !== "The Sealed Shaft") { ks.label = "The Sealed Shaft"; changes++; report.push("✎ KT script step: \"The Sealed Shaft\""); }
  const rq = quests?.quest_AL1aIXiljxPUBH2e;
  const RQ_NAME = "Khezek Tor - The Sealed Shaft";
  const RQ_DESC = "<p>A sealed shaft bears fresh sigils in a hand nobody at Khezek Tor writes. Recent. Precise. Directional. The seal doesn&#x27;t bind inward. It points outward, like a pipe, like a siphon. Three tools are on the table: mend it, aim it, or open it, and the mountain is listening to the discussion.</p>";
  if (!rq) conflicts.push("registry quest quest_AL1aIXiljxPUBH2e not found");
  else {
    if (rq.name !== RQ_NAME) { rq.name = RQ_NAME; questChanges++; report.push(`✎ registry quest name → "${RQ_NAME}"`); }
    if (rq.description !== RQ_DESC) { rq.description = RQ_DESC; questChanges++; report.push("✎ registry quest description: no Valhaulan"); }
  }

  // ── Etta, when the Seal is already decided ──
  const MAIN = "allesh_gilliam_etta_bloom_conversation";
  {
    const b = byId(MAIN); const cur = String(b?.description || "");
    const at = cur.indexOf("She leans in. “You want proof?”");
    if (!b) conflicts.push(`${MAIN}: not found`);
    else if (cur.includes(`{{#played ${DONE}}}`)) { /* done */ }
    else if (at < 0) conflicts.push(`${MAIN}: "She leans in" anchor not found`);
    else {
      const orig = cur.slice(at);
      const after = "She leans in. “Calder sends word with the ore tallies, same as anyone. He says you've already been down to that shaft.” She pulls a scrap of waxed fiber from her sleeve anyway and lays it on the table between you: the sigil you stood in front of, sketched in clean, fresh lines. “That’s a Valhaulan seal. Nine sent me this sketch before you ever got there.” She taps the edge. “Directional. Facing outward. And you’ve already had your hands on it.”\n\nA silence hangs there. “So you know what it means better than I do.”";
      b.description = cur.slice(0, at) + `{{#played ${DONE}}}${after}{{else}}${orig}{{/played}}`;
      changes++; report.push(`✎ ${MAIN}: the sigil isn't news if the Seal is decided`);
    }
  }
  edit("allesh_gilliam_etta_bloom_conversation_what_doing", "description", "That is bad. You probably want to Steward it up and go check it out.",
    `That is bad. {{#played ${DONE}}}And you have already been down there, so you know how bad.{{else}}You probably want to Steward it up and go check it out.{{/played}}`,
    "so you know how bad", "\"go check it out\" → \"you already know how bad\" once decided");
  edit("allesh_gilliam_etta_bloom_conversation_protecting", "description",
    "“I was a treasurer, my loves. I can move a debt. I cannot make one disappear. Neither can they, whatever they are singing down there.”",
    "“I was a treasurer, my loves. I can move a debt. I cannot make one disappear. Neither can they, whatever they are singing down there.”" +
    "{{#played khezek_tor_the_vaulhaulan_seal_restore}}\n\nShe opens the book again and taps the first column, twice. “That one’s yours. Khezek Tor keeps paying, and now it knows who signed for the bill.”{{/played}}" +
    "{{#played khezek_tor_the_vaulhaulan_seal_redirect}}\n\nShe opens the book again and taps the second column, twice. “That one’s yours. Somebody else is paying now. Sooner or later they’ll find out who chose the address.”{{/played}}" +
    "{{#played khezek_tor_the_vaulhaulan_seal_break}}\n\nShe opens the book again and looks at the third column for a long time. She does not tap it. “That one’s yours,” she says, and for once she has nothing to add.{{/played}}",
    "That one’s yours", "the math ends on the column you chose");
  edit("allesh_gilliam_etta_bloom_convo_exit", "description",
    "\"If you've already stood at that shaft,\" she says, \"then you already know which of those you are. The mountain does too.\"",
    `{{#played ${DONE}}}"You've already stood at that shaft," she says, "so you already know which of those you are. The mountain does too."{{else}}"Go and stand at that shaft," she says. "Then you'll know which of those you are. The mountain will too."{{/played}}`,
    "Go and stand at that shaft", "parting line by order");

  console.log(`[kt seal before etta 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} campaign + ${questChanges} registry change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktSealEtta = { dry: DRY_RUN, changes: changes + questChanges, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes + questChanges} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes && !questChanges) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    const ts = Date.now();
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-seal-etta-${ts}.json`, { type: "application/json" }), {}, { notify: false });
    await FP.upload("data", "bbttcc-exports", new File([questsWasStr ? questsRaw : JSON.stringify(questsRaw || {})], `backup-quests-pre-kt-seal-etta-${ts}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (changes) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (questChanges) await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Applied ${changes + questChanges} change(s) — no Valhaulans before Etta; Etta knows the order.`);
})();
