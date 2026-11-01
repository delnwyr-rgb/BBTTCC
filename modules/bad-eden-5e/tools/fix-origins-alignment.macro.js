// Bad Eden 5E · live-data pass for review C7 / C8 / C9 (2026-10-31). Paste into a GM script macro on the D&D world.
// Idempotent — rerun reads 0 changes.
//  • C9  Alignment: a character whose sheet Alignment is blank but whose Tree pick (identity.sephirothicAlignment /
//        the sephirot flag) is known gets the Sephira written there (the wizard now does this at creation).
//  • C7  Stacked origins: REPORTS characters carrying an SRD background (no flags.bad-eden-5e.archetype) — their ASI,
//        skills and Origin feat landed before the guard; undoing that needs dnd5e's own "remove advancements" delete
//        on the sheet (GM call per character), so nothing is deleted here.
//  • C8  Bare classes: REPORTS characters with a class but 0 max HP and no HitPoints advancement value (a dismissed
//        manager on the old wizard path) — fix from the sheet: class item → Modify choices.
(async () => {
  if (game.system?.id !== "dnd5e") return ui.notifications.warn("This macro is for the D&D world.");
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const CO = "bbttcc-character-options", BE = "bad-eden-5e";
  const fixed = [], srd = [], bare = [];
  for (const a of game.actors.filter(x => x.type === "character")) {
    const cur = String(a.system?.details?.alignment ?? "").trim();
    const seph = String(a.getFlag(CO, "identity")?.sephirothicAlignment?.name || a.getFlag(CO, "sephirot")?.name || "").replace(/^Alignment:\s*/i, "").trim();
    if (!cur && seph) { await a.update({ "system.details.alignment": seph }); fixed.push(`${a.name} → ${seph}`); }
    const bgs = a.items.filter(i => i.type === "background");
    for (const b of bgs) if (!b.getFlag(BE, "archetype")) srd.push(`${a.name}: ${b.name}${bgs.length > 1 ? ` (+${bgs.length - 1} more origin item)` : ""}`);
    const cls = a.items.filter(i => i.type === "class");
    if (cls.length && !(Number(a.system?.attributes?.hp?.max) > 0)) {
      const noHp = cls.filter(c => !Object.keys(c.advancement?.byType?.HitPoints?.[0]?.value ?? {}).length);
      if (noHp.length) bare.push(`${a.name}: ${noHp.map(c => c.name).join(", ")}`);
    }
  }
  const li = arr => arr.length ? `<ul>${arr.map(x => `<li>${foundry.utils.escapeHTML(x)}</li>`).join("")}</ul>` : "<p>— none —</p>";
  const content = `<div class="bbttcc card"><h3>Bad Eden 5E · origins & alignment</h3>
    <p><b>Alignment written (${fixed.length})</b></p>${li(fixed)}
    <p><b>SRD background on a steward (${srd.length})</b> — delete it from the sheet and choose <i>remove advancements</i>, then add the Archetype</p>${li(srd)}
    <p><b>Class with no hit points (${bare.length})</b> — sheet → class item → Modify choices</p>${li(bare)}</div>`;
  await ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id) });
  console.log("[bad-eden-5e] fix-origins-alignment", { fixed, srd, bare });
  ui.notifications.info(`Origins pass: ${fixed.length} alignment(s) written, ${srd.length} SRD background(s), ${bare.length} bare class(es) — see the GM whisper.`);
})();
