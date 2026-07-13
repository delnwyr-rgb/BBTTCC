/* patch-patter-pronouns.macro.js — Patter is a girl (owner canon 2026-07-11)
 *
 * The VS-POLISH persona/pages shipped with he/him for Patter. This corrects,
 * in place: Patter's persona block, the "lets him" line in Pip's persona,
 * the "Patter — The Tally" dossier page, and the pre-existing authored
 * "beside himself" in vs_bridge_corroboration (campaign setting).
 *
 * Idempotent (string-match guarded). DRY_RUN default true. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MV = "bbttcc-mal-voice";
  const NS = "bbttcc-campaign";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const report = [];

  // ── persona fixes ──────────────────────────────────────────────────────────
  const PERSONA_FIXES = [
    { actor: findActor(["Patter"]), who: "Patter", repl: [
      ["Pip is his partner", "Pip is her partner"],
      ["He has been wearing a groove", "She has been wearing a groove"],
      ["he notices the green pulse", "she notices the green pulse"],
      ["he goes out to the Vault on rest days", "she goes out to the Vault on rest days"],
      ["He keeps Pip's route open", "She keeps Pip's route open"],
      ["he will not say the word 'dead.'", "she will not say the word 'dead.'"],
      ["the dossier will say which world he's in", "the dossier will say which world she's in"]
    ]},
    { actor: findActor(["Pip"]), who: "Pip", repl: [
      ["Patter counts his hesitations, and lets him, because", "Patter counts his hesitations, and lets her, because"]
    ]}
  ];
  for (const f of PERSONA_FIXES) {
    if (!f.actor) { report.push(`⚠ ${f.who} not found — skipped`); continue; }
    const cur = f.actor.getFlag(MV, "persona") || {};
    let notes = String(cur.notes || "");
    let hits = 0;
    for (const [from, to] of f.repl) if (notes.includes(from)) { notes = notes.split(from).join(to); hits++; }
    if (hits) { report.push(`✎ ${f.who} persona: ${hits} pronoun fix(es)`); if (!DRY_RUN) await f.actor.setFlag(MV, "persona", { ...cur, notes }); }
    else report.push(`· ok ${f.who} persona (already correct)`);
  }

  // ── dossier page fixes ─────────────────────────────────────────────────────
  const journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  const PAGE_FIXES = {
    "Patter — The Tally": [
      ["He's keeping a private tally", "She's keeping a private tally"],
      ["he hasn't told Mara because telling Mara makes things REAL and he is not ready", "she hasn't told Mara because telling Mara makes things REAL and she is not ready"]
    ]
  };
  for (const [name, repl] of Object.entries(PAGE_FIXES)) {
    const pg = journal?.pages?.contents?.find(p => p.name === name);
    if (!pg) { report.push(`⚠ page "${name}" not found — skipped`); continue; }
    let content = String(pg.text?.content || "");
    let hits = 0;
    for (const [from, to] of repl) if (content.includes(from)) { content = content.split(from).join(to); hits++; }
    if (hits) { report.push(`✎ page "${name}": ${hits} fix(es)`); if (!DRY_RUN) await pg.update({ "text.content": content }); }
    else report.push(`· ok page "${name}"`);
  }

  // ── campaign beat fix (pre-existing authored text) ─────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  let beatDirty = false;
  for (const camp of Object.values(camps || {})) {
    for (const b of (camp?.beats || [])) {
      const d = String(b?.description || "");
      if (/Patter[^.]{0,80}\bbeside himself\b/.test(d) || (b?.id === "vs_bridge_corroboration" && d.includes("beside himself"))) {
        b.description = d.split("beside himself").join("beside herself");
        beatDirty = true;
        report.push(`✎ beat ${b.id}: "beside himself" → "beside herself"`);
      }
    }
  }
  if (!beatDirty) report.push("· ok beats (no 'beside himself' found)");

  console.log(`[patch-patter-pronouns] ${DRY_RUN ? "DRY RUN" : "APPLY"}\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info("Patter pronoun patch DRY RUN (see console).");
  if (beatDirty) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info("Patter pronoun patch APPLIED. She keeps the route open.");
})();
