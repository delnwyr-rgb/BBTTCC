/*
 * migrate-evasion-retired-2026-11-11.macro.js — Dave (2026-11-11), binary defenses phase 2 (data half; the engine half is in
 * systems/fourththing/module.js + ft-progression.js):
 *   • a POSITIVE item Evasion bonus folds into Guard: Guard = max(Guard, Evasion) + floor(min(Guard, Evasion) / 2); evasionBonus = 0
 *   • a NEGATIVE one (heavy pieces) becomes −1 on Intrigue checks while worn:
 *       flags.fourththing.passives.checkBonus += { context:"check", attribute:"intrigue", bonus:-1, note, worn:true }; evasionBonus = 0
 *   • the item's ⚙️ "Defense:" line and the ⟡ ladder line ("→ …") are re-written from the new numbers.
 * Scope: world Items, every world Actor's items (+ unlinked scene tokens), and the Item/Actor compendiums
 *   bbttcc-master-content.items / .npcs / .playtest-actors (unlocked for the write, re-locked after).
 * globalThis.__evaDry = false applies; anything else is a dry run. Idempotent (an item with evasionBonus 0 is left alone).
 */
(async () => {
  const DRY_RUN = globalThis.__evaDry !== false;
  const report = { DRY_RUN, folded: 0, heavy: 0, text: 0, where: {}, samples: [] };
  const NOTE = "Heavy — hard to be subtle in this";
  const list = (g, r) => [g ? `Guard ${g > 0 ? "+" : ""}${g}` : null, r ? `Resolve ${r > 0 ? "+" : ""}${r}` : null].filter(Boolean).join(", ") || "—";

  function plan(item) {
    const e = Number(item.system?.evasionBonus) || 0;
    if (!e) return null;
    const g0 = Number(item.system?.guardBonus) || 0, r = Number(item.system?.resolveBonus) || 0;
    const upd = { "system.evasionBonus": 0 };
    let g = g0, heavy = false;
    // Dave 2026-11-11: "Take the higher plus half of the second, rounded down" — Guard 4/Evasion 4 → 6, Guard 0/Evasion 3 → 3.
    if (e > 0) { g = Math.max(g0, e) + Math.floor(Math.max(0, Math.min(g0, e)) / 2); upd["system.guardBonus"] = g; }
    else {
      heavy = true;
      const cb = foundry.utils.deepClone(item.flags?.fourththing?.passives?.checkBonus ?? []);
      if (!cb.some(x => x?.worn && x?.attribute === "intrigue" && Number(x.bonus) < 0)) cb.push({ context: "check", attribute: "intrigue", bonus: -1, note: NOTE, worn: true });
      upd["flags.fourththing.passives.checkBonus"] = cb;
    }
    let html = String(item.system?.description?.value ?? "");
    const before = html;
    const defLine = list(g, r) + (heavy ? " · −1 on Intrigue checks while worn" : "");
    html = html.replace(/(<strong>Defense:<\/strong>\s*)[^<]+/g, `$1${defLine}`);
    html = html.replace(/(defense bonuses<\/strong>\s*→\s*)[^(<]+/g, `$1${list(g, r)} `);
    if (html !== before) upd["system.description.value"] = html;
    return { upd, heavy, text: html !== before, e, g0, g };
  }

  async function doItems(items, where, parent = null) {
    const updates = [];
    for (const it of items) {
      const p = plan(it); if (!p) continue;
      p.heavy ? report.heavy++ : report.folded++; if (p.text) report.text++;
      report.where[where] = (report.where[where] || 0) + 1;
      if (report.samples.length < 8) report.samples.push(`${where} · ${it.name}: E${p.e} → ${p.heavy ? "−1 Intrigue (worn)" : `Guard ${p.g0}→${p.g}`}`);
      updates.push({ _id: it.id, ...p.upd });
    }
    if (DRY_RUN || !updates.length) return;
    if (parent) await parent.updateEmbeddedDocuments("Item", updates);
    else await Item.updateDocuments(updates, where.startsWith("pack:") ? { pack: where.slice(5) } : {});
  }

  await doItems(game.items.contents, "world items");
  for (const a of game.actors.contents) await doItems(a.items.contents, "actors", a);
  for (const s of game.scenes.contents) for (const t of s.tokens.contents) if (!t.actorLink && t.actor) await doItems(t.actor.items.contents, "unlinked tokens", t.actor);

  // Radiation mutations already on actors (Dave 2026-11-11: "make them debuff intrigue"): the stored mutation list
  // (flags.bbttcc-radiation.mutations[].effects) and its live AE. +Evasion → Guard; −Evasion → −N on Intrigue checks
  // (flags.fourththing.checkBonus on the AE). Matches the new tables in bbttcc-radiation-mutations.enhancer.js.
  const EVK = "system.derived.evasion.aeBonus", GK = "system.derived.guard.aeBonus", IK = "check:intrigue";
  report.mutations = 0;
  const mutActors = [...game.actors.contents];
  for (const s of game.scenes.contents) for (const t of s.tokens.contents) if (!t.actorLink && t.actor) mutActors.push(t.actor);
  for (const a of mutActors) {
    const list = a.flags?.["bbttcc-radiation"]?.mutations;
    if (Array.isArray(list) && list.some(m => (m.effects || []).some(e => e.key === EVK))) {
      const next = foundry.utils.deepClone(list).map(m => ({ ...m, effects: (m.effects || []).map(e => e.key !== EVK ? e : (Number(e.value) > 0 ? { key: GK, value: Number(e.value) } : { key: IK, value: Number(e.value) })) }));
      report.mutations++; if (report.samples.length < 12) report.samples.push(`mutation list · ${a.name}`);
      if (!DRY_RUN) await a.setFlag("bbttcc-radiation", "mutations", next);
    }
    for (const ef of a.effects.contents) {
      if (!ef.flags?.["bbttcc-radiation"]?.mutation) continue;
      const ch = ef.changes || [];
      if (!ch.some(c => String(c.key).includes("derived.evasion"))) continue;
      const keep = [], rows = foundry.utils.deepClone(ef.flags?.fourththing?.checkBonus ?? []);
      for (const c of ch) {
        if (!String(c.key).includes("derived.evasion")) { keep.push(c); continue; }
        const v = Number(c.value) || 0;
        if (v > 0) keep.push({ ...c, key: GK });
        else if (v < 0) rows.push({ context: "check", attribute: "intrigue", bonus: v, note: ef.name });
      }
      report.mutations++; if (report.samples.length < 12) report.samples.push(`mutation AE · ${a.name} · ${ef.name}`);
      if (!DRY_RUN) await ef.update({ changes: keep, "flags.fourththing.checkBonus": rows });
    }
  }

  for (const pid of ["bbttcc-master-content.items", "bbttcc-master-content.npcs", "bbttcc-master-content.playtest-actors"]) {
    const pack = game.packs.get(pid); if (!pack) continue;
    const wasLocked = pack.locked;
    try {
      if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
      const docs = await pack.getDocuments();
      if (pack.documentName === "Item") await doItems(docs, "pack:" + pid);
      else for (const a of docs) await doItems(a.items.contents, "pack:" + pid, a);
    } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  }
  console.log("EVASION " + JSON.stringify(report));
  return report;
})();
