// Bad Eden — Khezek-Tor timeline prose patch (2026-09-13) — DRY_RUN
// ─────────────────────────────────────────────────────────────────────────────
// Owner ruling 2026-09-13 (the untangling):
//   • Khezek-Tor was reopened RECENTLY by the Avuncular Order's advance crew (the team that
//     stood up the six-tier hexes before the players). They found Yesodium. That drew the
//     Valhaulans / their paymaster, who found the darkness and weaponized it via the seal.
//   • The mine's first life was the bunker years, between the Shattering and the wars:
//     Father Tamsin's family — in a PRIOR INCARNATION — ran it for one client, served only
//     themselves and that client, denied relief when there was plenty, and never delved or
//     developed it because the demand was small. Yesodium is PROUD. It judged its owners
//     unworthy and dangerous and felt taken for granted while the valley suffered.
//   • So the mine closed its own mouth: collapsed and sealed itself to take its riches out of
//     the wrong hands — after warning the locals in dreams. The collapse would have loosed
//     energy far past the mine. A hundred people agreed to catch the fallout. That is the
//     Founders' Garden. Now the mine is open again, and the statues are moving.
//   • Two resentments, two eras: THEN ignored and hoarded ("left untapped and in potentia" —
//     the Seal line stands); NOW hollowed out (Calder). "Mountains remember how they're treated."
//   • Brennig is the Father's brother in THIS life; a third brother may die, macabrely, and
//     not in the darkness event (drafted below — reword freely).
//   • Still owner slots: WHO the Missing One is; whether the rite can be performed again.
//
// What this does (idempotent; every patch skips itself if its new text is already present):
//   1. Beat prose: quest acceptance, intro scene, the Maw, the Brace, the Lift Hall, the
//      Shipment, the Seal (typo + one clause), St Gilliam's, the Father's Echo.
//   2. Quest registry: the Khezek Tor description (keeps the joke).
//   3. Personas (marker-guarded append): Father Tamsin, Brennig, Drax Calder.
//   4. Dossier page "Khezek Word — Before" (knownBy all) in the World Dossier journal.
//   5. The Khezek-Tor hex `notes` (board scene drawing).
// Backs up `campaigns` + `quests` to a download before writing. GM only.

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  const MV = "bbttcc-mal-voice";
  const TER = "bbttcc-territory";
  const MARKER = "[KT-TIMELINE-2026-09-13]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const report = [];

  // ── load ──────────────────────────────────────────────────────────────────
  const loadJson = (k) => { let v = game.settings.get(NS, k); if (typeof v === "string") { try { v = JSON.parse(v); } catch (_e) {} } return foundry.utils.deepClone(v); };
  const campaigns = loadJson("campaigns");
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = cid && campaigns?.[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  let quests = loadJson("quests");
  const questList = Array.isArray(quests) ? quests : Object.values(quests || {});
  let campChanged = 0, questChanged = 0;

  // ── 1. beat prose ─────────────────────────────────────────────────────────
  // Each patch: {beat, field?, choice?, find, replace} — `find` is a literal substring of the
  // current text (a guard against patching prose that has drifted); `sentinel` is a phrase of
  // the new text used for idempotence.
  const PATCHES = [
    {
      beat: "khezek_tor_quest_acceptance",
      find: "If Lyrenn teaches patience, Khezek Tor teaches limits.",
      replace: "If Lyrenn teaches patience, Khezek Tor teaches limits. Nobody standing here dug it open: the Avuncular Order's advance crew did, while they were standing up the six-tier hexes, and they hit Yesodium in the first week. Everyone who has walked up this road since walked up because of that.",
      sentinel: "advance crew did"
    },
    {
      beat: "khezek_tor_main_scene",
      find: "Cranes frozen mid‑lift like skeletons of failed gods.",
      replace: "Cranes frozen mid‑lift like skeletons of failed gods. Some of the iron is new. Some of it is very old, and was welded to the mountain by people who did not expect it to be seen again.",
      sentinel: "did not expect it to be seen again"
    },
    {
      beat: "khezek_tor_the_maw",
      find: "Level Four is scratched over twice.\n\nBelow that, no official numbering exists.",
      replace: "Level Four is scratched over twice. The first scratch is old — the survey that stopped counting the night the mountain closed itself, back in the bunker years, when it decided the family running it was not worth the trouble of staying open. The second scratch is Calder's.\n\nBelow that, no official numbering exists.",
      sentinel: "the night the mountain closed itself"
    },
    {
      beat: "khezek_tor_the_brace",
      find: "The Brace holds back a section that already fell once.",
      replace: "The Brace holds back a section that already fell once — on purpose, if you believe the oldest chalk. The mountain shut its own mouth on the people who owned it, centuries back, and the Brace is where the advance crew wedged that mouth open again.",
      sentinel: "shut its own mouth"
    },
    {
      beat: "khezek_tor_the_brace",
      find: "Warning sigils overlap older warnings.",
      replace: "Warning sigils overlap older warnings, in a hand nobody living writes.",
      sentinel: "in a hand nobody living writes"
    },
    {
      beat: "khezek_tor_the_lift_hall",
      find: "Brennig Tamsin — yes, THAT Tamsin's brother, the one who lived — runs the crates,",
      replace: "Brennig Tamsin — yes, THAT Tamsin's brother; there were three, and the middle one leaned into the cage shaft after a dropped manifest and is, technically, still on the manifest — runs the crates,",
      sentinel: "still on the manifest"
    },
    {
      beat: "khezek_tor_darkness_shipment",
      find: "The ore isn’t cursed.\n\nIt’s improperly framed.",
      replace: "The ore isn’t cursed.\n\nIt’s improperly framed.\n\nBrennig has a theory he shares only after the second crate: Yesodium is proud. In the bunker years it sat under one family who sold it to one client and let the rest of it idle while the valley went hungry, and it has not forgotten being taken for granted. “You don’t have to like the stone,” he says. “You have to notice it.”",
      sentinel: "Yesodium is proud"
    },
    {
      beat: "khezek_tor_the_vaulhaulan_seal", choice: 0,
      find: "As best you can figure, the Valhaulans have weaponized the Yeodium's resentment. Then, it was resentment about being left untapped and in potentia.",
      replace: "As best you can figure, the Valhaulans have weaponized the Yesodium's resentment. Then, it was resentment about being left untapped and in potentia — a proud ore, left idle by owners who fed one client while the valley went hungry.",
      sentinel: "a proud ore, left idle"
    },
    {
      beat: "allesh_gilliam_st_gilliams_intro",
      find: "“Mountains remember how they’re treated.”",
      replace: "“Mountains remember how they’re treated.” A longer pause. “Being ignored is a way of being treated.”",
      sentinel: "Being ignored is a way of being treated"
    },
    {
      beat: "allesh_gilliam_father_tamsin_conversation",
      find: "A pause.\n\n“There was.”\n\nHe meets your eyes kindly.",
      replace: "A pause.\n\n“There was.”\n\nA longer one. “That was another life. The gate had my family’s name over it then, and the valley went hungry under it, and we called that stewardship.” He does not say the name.\n\nHe meets your eyes kindly.",
      sentinel: "The gate had my family’s name over it"
    }
  ];

  for (const p of PATCHES) {
    const b = byId.get(p.beat);
    if (!b) { report.push(`⚠ beat missing: ${p.beat}`); continue; }
    const target = (p.choice != null) ? (b.choices || [])[p.choice] : b;
    const field = (p.choice != null) ? ((target && "description" in target) ? "description" : "text") : "description";
    if (!target) { report.push(`⚠ ${p.beat} choice[${p.choice}] missing`); continue; }
    const cur = String(target[field] || "");
    if (cur.includes(p.sentinel)) { report.push(`· ok (already) ${p.beat}${p.choice != null ? `[${p.choice}]` : ""}`); continue; }
    if (!cur.includes(p.find)) { report.push(`⚠ ${p.beat}${p.choice != null ? `[${p.choice}]` : ""}: anchor text not found — prose drifted, patch by hand: "${p.find.slice(0, 60)}…"`); continue; }
    target[field] = cur.replace(p.find, p.replace);
    campChanged++;
    report.push(`✚ ${p.beat}${p.choice != null ? `[${p.choice}]` : ""}: "${p.sentinel}"`);
  }

  // ── 2. quest registry ─────────────────────────────────────────────────────
  const KT_QUEST = "quest_LJAmlim7oUtlMPiC";
  const q = questList.find(x => x.id === KT_QUEST);
  const QUEST_DESC = "A recently restarted mining operation. The Avuncular Order's advance crew cracked it back open while standing up the six-tier hexes and found Yesodium — one of the most valuable materials left in the world — which is why everyone else found Khezek Tor shortly after. Because mining operations that shut themselves down hurriedly, mysteriously, and (the oldest survey notes insist) from the INSIDE, a few centuries back, are the kinds of things that need to be started back up again. If nothing else just to see what the fuck happens! I'LL SHOW YOU DELVED TOO DEEP OR WHATEVER!";
  if (!q) report.push(`⚠ quest ${KT_QUEST} not in registry`);
  else if (String(q.description || "").includes("from the INSIDE")) report.push("· ok (already) Khezek Tor quest description");
  else { q.description = QUEST_DESC; questChanged++; report.push("✚ Khezek Tor quest description (reopened by the advance crew; closed itself from the inside)"); }

  // ── 3. personas ───────────────────────────────────────────────────────────
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => { const want = cands.map(norm); return game.actors.find(a => want.includes(norm(a.name))) || null; };
  const PERSONAS = [
    { who: "Father Tamsin", actor: game.actors.get("I0Gieq4FAol5mklQ") || findActor(["Father Tamsin", "Tamsin"]),
      topics: "the bunker years, the family that ran the mine, the night the mountain closed itself, being ignored",
      notes: `${MARKER} PRIVATE TRUTH — THE OLDER DEBT. The night he chose who to save was in ANOTHER LIFE: he was the healer of the family that ran Khezek Tor in the bunker years, when the gate carried the family's name. They sold Yesodium to one client, kept the rest idle, and turned the valley's petitioners away when there was plenty; he told a stranger there wasn't enough, and there was. The mountain closed its own mouth on that family — dream-warnings first, then the collapse — and a hundred strangers agreed to catch what it let go. He does not remember the collapse itself; he remembers the dreams, and the name over the gate, and that he did nothing with the warning. THIS is why the deep dark knew his debt by name: the debt is older than this body. He believes the mountain is TIRED, not angry, because it was ignored for a century before it was ever hollowed out. He never says the family name. If asked directly whether the gate had his name on it, he says "mountains remember how they're treated" and changes the kettle. He has NO idea the statues have started walking; if he ever learns the hundred caught his family's fallout, he will need to sit down, and then he will walk to the Garden.` },
    { who: "Brennig Tamsin", actor: game.actors.get("4Ie9Tl4NGBWwO5aj") || findActor(["Brennig Tamsin", "Brennig", "Quartermaster Brennig"]),
      topics: "the bunker years, the old iron below Four, proud ore, the middle brother",
      notes: `${MARKER} PRIVATE TRUTH — PROUD ORE. Brennig's theory (shared after the second crate, never the first): Yesodium is proud; it sat a hundred years under owners who sold it to one client and let it idle while the valley starved, and it has not forgotten being taken for granted — so it hums, and dreams sour, when it is handled like inventory. He has no idea the owners were his brother's family in another life; he thinks the Father's "mountain can forgive" line is a priest's habit. THE MIDDLE BROTHER (draft — owner may reword): there were three Tamsin boys this life; the middle one leaned into the cage shaft after a dropped manifest, on a perfectly ordinary shift, and is technically still on that manifest; Brennig tells it as a joke, once, and then does not tell it again. It had nothing to do with the dark; it is the reason he counts crates aloud. THE OLD IRON: some of the shoring below Four was welded by hands that did not expect it to be seen again; he inventories it and does not ask.` },
    { who: "Drax Calder", actor: findActor(["Drax Calder", "Drax Caulder", "Foreman Calder"]),
      topics: "the oldest chalk, the bunker years, the advance crew, why the mountain closed",
      notes: `${MARKER} PRIVATE TRUTH — THE OLDEST CHALK. Calder has read the marks nobody living wrote: the section the Brace holds fell ON PURPOSE. The mountain shut its own mouth on the family that ran it in the bunker years — one client, idle veins, a hungry valley — and the Avuncular Order's advance crew wedged that mouth open again a season before the Stewards arrived, found Yesodium in the first week, and left Calder the Brace. His doctrine ("tired of being hollowed out") is about NOW; he knows the older grievance was the opposite — being ignored — and he keeps both in chalk because the mountain keeps both. He will not say "the family's name" because he does not know it; he suspects Father Tamsin does, from the way the man looks at the Brace.` }
  ];
  for (const p of PERSONAS) {
    if (!p.actor) { report.push(`⚠ persona skipped — ${p.who} not found`); continue; }
    const cur = p.actor.getFlag(MV, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { report.push(`· ok (already) truth on ${p.actor.name}`); continue; }
    const topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    const notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    report.push(`✚ PRIVATE TRUTH → ${p.actor.name}`);
    if (!DRY_RUN) await p.actor.setFlag(MV, "persona", { topics, notes });
  }

  // ── 4. dossier page ───────────────────────────────────────────────────────
  const PAGES = [
    { name: "Khezek Word — Before", knownBy: "all", body:
      `Ask three miners what happened to the old mine and you get three names for the night, none printable. What they agree on: the mountain was worked once before, in the bunker years, by one family for one client, and the rest of it sat idle while the valley went hungry. Then the mountain closed itself — dreams first, up and down the valley, then the whole deep going shut in a night — and stayed shut for centuries until Joan's advance crew wedged it open standing up the six-tier hexes and hit Yesodium in the first week. Everything since — the Valhaulans, the seal, the humming crates, the Stewards — walked up the road because of that week. Old-timers' rule, told to every new hire: don't take it for granted, and don't hollow it out. It remembers both.` }
  ];
  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  if (!journal) { report.push(`journal "${JOURNAL_NAME}": CREATE`); if (!DRY_RUN) journal = await JournalEntry.create({ name: JOURNAL_NAME }); }
  for (const p of PAGES) {
    const existing = journal?.pages?.contents?.find(pg => pg.name === p.name);
    const content = `<p>@knownBy: ${p.knownBy}</p>\n<p>${p.body}</p>`;
    if (existing) { report.push(`page "${p.name}": exists — SKIPPED`); continue; }
    report.push(`page "${p.name}": CREATE`);
    if (!DRY_RUN && journal) await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: p.name, type: "text", text: { content, format: 1 } }]);
  }

  // ── 5. hex notes ──────────────────────────────────────────────────────────
  const nn = (s) => String(s || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
  let ktHex = null;
  for (const sc of (game.scenes?.contents ?? []).filter(sc => sc.getFlag("bbttcc-epic", "boardScene") === true)) {
    for (const d of (sc.drawings ?? [])) { const tf = d.flags?.[TER]; if (tf && (tf.isHex === true || tf.kind === "territory-hex") && nn(tf.name || tf.hexName || d.text) === "khezek-tor") { ktHex = d; break; } }
    if (ktHex) break;
  }
  const HEX_NOTE = "History: worked once in the bunker years by one family for one client; closed itself (dream-warnings, then collapse) to take its riches out of the wrong hands — the Founders' Garden caught the fallout. Reopened by the Avuncular Order's advance crew; Yesodium found in the first week; Valhaulans followed. Two grievances: ignored then, hollowed now.";
  if (!ktHex) report.push("⚠ Khezek-Tor hex not found on a board scene");
  else if (String(ktHex.flags?.[TER]?.notes || "").includes("bunker years")) report.push("· ok (already) hex notes");
  else { report.push("✚ Khezek-Tor hex notes"); if (!DRY_RUN) await ktHex.update({ [`flags.${TER}.notes`]: [String(ktHex.flags?.[TER]?.notes || "").trim(), HEX_NOTE].filter(Boolean).join("\n") }); }

  // ── write ─────────────────────────────────────────────────────────────────
  if (!DRY_RUN && (campChanged || questChanged)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const save = foundry.utils.saveDataToFile || saveDataToFile;
    const rawC = game.settings.get(NS, "campaigns"); save(typeof rawC === "string" ? rawC : JSON.stringify(rawC), "application/json", `backup-campaigns-before-kt-timeline-${stamp}.json`);
    const rawQ = game.settings.get(NS, "quests"); save(typeof rawQ === "string" ? rawQ : JSON.stringify(rawQ), "application/json", `backup-quests-before-kt-timeline-${stamp}.json`);
    if (campChanged) await game.settings.set(NS, "campaigns", campaigns);
    if (questChanged) await game.settings.set(NS, "quests", quests);
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[patch-khezek-timeline] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  await ChatMessage.create({ content: `<div style="font-size:12px"><b>patch-khezek-timeline — ${banner}</b><br>${report.map(r => "&nbsp;" + r.replace(/</g, "&lt;")).join("<br>")}</div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Khezek timeline: ${banner}`);
})();
