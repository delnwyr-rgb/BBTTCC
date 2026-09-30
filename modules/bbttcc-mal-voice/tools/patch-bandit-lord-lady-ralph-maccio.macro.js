/* patch-bandit-lord-lady-ralph-maccio.macro.js — rename the live Bandit Lord actor (2026-09-27 ruling). RUN IN-WORLD (GM). DRY_RUN default true.
 * Ruling (Dave): the Bandit Lord is LADY RALPH MACCIO, a woman (Stormborn Nomad by Mags' pick), named after the greatest pre-Shattering
 * warrior. The live world has "Bandit Lord Osmund Cree" (created by seed-bandit-accord-dossier 2026-07-13); beats already say Ralph Maccio.
 * Does: renames the actor + prototype token, rewrites the mal-voice persona notes (she/her), sweeps campaign beat text for the old name.
 * Keeps the actor id (speakerActorId links survive). Ancestry item stays as-is (Human / Cro-Magnon) — swap it by hand on the sheet if wanted.
 * Idempotent. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const OLD_NAME = "Bandit Lord Osmund Cree", NEW_NAME = "Lady Ralph Maccio";
  const NEW_NOTES = "[BANDIT-ACCORD-2026-07-13 · renamed 2026-09-27] PRIVATE TRUTH — Lady Ralph Maccio, Bandit Lord of the Drowned South; a Stormborn Nomad woman in her sixties who named herself after the greatest pre-Shattering warrior and will explain the film if asked. Voice: unhurried bookkeeper's calm with swamp-dry humor; talks about banditry exclusively in the vocabulary of management (crews are 'staff', ambushes are 'collections', casualties are 'the bad column'). NOT evil — OVER-EXTENDED: inherited three crews, married into two more, and has been paying survivor pensions from a shrinking toll base for years; the books are real, meticulous, and slowly drowning her. HER ECHO (tells if asked plainly, once): the night she understood the profession was finished wasn't a battle — it was a payroll. She sat in the stilt-hall with the pension ledger and realized the Drowned South's future was a program some out-of-towners were running out of a fire station, and what she felt wasn't anger. It was RELIEF, and the relief frightened her more than any raid ever had. ON THE PROGRAM: she tracks the Stewards' mercy count more accurately than they do — every spared crew, every bowl of soup, every reformed hire is a line in HER books too, in a column she titled, privately, THE EXIT. GUARDS: never discusses camp positions or whistle-codes while the profession is live; won't badmouth her own people, even the splinter-minded ones ('every ledger has a bad column; you don't read it aloud'). TELLS: squares stacked items to true edges when the pension math comes up; says 'four hundred souls' never 'four hundred fighters'; laughs exactly once, quietly, when someone calls her a warlord; the faded cloth headband is the one vanity.";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const actor = game.actors.get("3EWTXjRqh06dmD0x") || game.actors.getName(OLD_NAME) || game.actors.getName(NEW_NAME);
  if (!actor) return ui.notifications.error("Bandit Lord actor not found (id 3EWTXjRqh06dmD0x / name).");
  const upd = {};
  if (actor.name !== NEW_NAME) { upd.name = NEW_NAME; say(`✎ name: ${actor.name} → ${NEW_NAME}`); }
  if (actor.prototypeToken?.name !== NEW_NAME) { upd["prototypeToken.name"] = NEW_NAME; say("✎ prototype token name"); }
  const notes = actor.getFlag("bbttcc-mal-voice", "persona")?.notes || "";
  if (notes !== NEW_NOTES) { upd["flags.bbttcc-mal-voice.persona.notes"] = NEW_NOTES; say("✎ persona notes (she/her, Stormborn Nomad, the headband)"); }
  if (Object.keys(upd).length) changes++;
  // campaign beats: sweep the old name out of any text field
  const NS = "bbttcc-campaign"; let campsRaw = game.settings.get(NS, "campaigns"); const wasStr = typeof campsRaw === "string";
  const camps = wasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw); let beatHits = 0;
  for (const camp of Object.values(camps || {})) for (const b of (camp?.beats || [])) for (const k of ["label", "description", "memoryText", "nextLine"]) {
    if (typeof b[k] === "string" && b[k].includes(OLD_NAME)) { b[k] = b[k].split(OLD_NAME).join(NEW_NAME); beatHits++; }
    if (typeof b[k] === "string" && /\bOsmund Cree\b/.test(b[k])) { b[k] = b[k].replace(/\bOsmund Cree\b/g, "Ralph Maccio"); beatHits++; }
  }
  if (beatHits) { changes++; say(`✎ campaign beats: ${beatHits} text field(s) renamed`); } else say("· campaign beats: no old-name text");
  console.log(`[patch-bandit-lord-lady-ralph-maccio] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change group(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Lady Ralph Maccio DRY RUN: ${changes} change group(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Lady Ralph Maccio: nothing to do.");
  if (Object.keys(upd).length) await actor.update(upd);
  if (beatHits) await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Lady Ralph Maccio APPLIED: ${changes} change group(s). F5.`);
})();
