/*
 * patch-auto-power-saves-2026-11-08.macro.js — Dave (2026-11-08): "Let's add a save, definitely."
 * Steward powers whose conditions land with no roll at all (shape Auto, harmful, at least one authored condition, no
 * save) score +1 under Rubric v1.2 and full condition weight — 1d6 + Shaken read T2. Per Dave's R05 example
 * ("1d6 damage + blindness with a save to resist the effect would be tier 1") they get a save against the conditions:
 *   resolution.hitSave = true, resolution.saveAttribute + appliedStates.saveAttribute = the condition's faculty
 *   (Body: prone/staggered/restrained/burning/blinded · Soul: shaken/calmed/scarred · Mind: charmed/compelled/imposed/surprise),
 *   then the tier is re-scored (game.fourththing.manifestation.magnitudeTier with the owner).
 * The damage still lands; a passed save stops the conditions. Starter FORMS (weapons) are NOT touched (Dave: keep as is).
 * Foe-owned items are NOT touched. Covers character/NPC actors (non-foe), world items, and Item / Actor compendiums.
 * Dry run unless globalThis.__autoPowerSavesWrite = true. Idempotent.
 */
(async () => {
  const WRITE = globalThis.__autoPowerSavesWrite === true;
  const F = game.fourththing;
  if (!F?.manifestation?.magnitudeTier) throw new Error("game.fourththing.manifestation.magnitudeTier missing — deploy the system first");
  const report = { WRITE, changed: [], skipped: [], errors: [] };
  const FAC = { prone: "body", staggered: "body", restrained: "body", burning: "body", blinded: "body",
                shaken: "soul", calmed: "soul", scarred: "soul",
                charmed: "mind", compelled: "mind", imposed: "mind", surprise: "mind" };
  const statesOf = (ap) => Array.isArray(ap?.states) ? ap.states.filter(Boolean)
    : Object.entries(ap?.states ?? {}).filter(([, v]) => v === true).map(([k]) => k);

  function plan(it, owner) {
    if (it.type !== "power") return null;
    if (owner && F.isFoeActor?.(owner)) return null;
    const mf = it.system?.manifestation ?? {};
    const res = mf.resolution ?? {};
    const shape = String(res.shape ?? "auto") || "auto";
    if (shape !== "auto") return null;
    if (res.hitSave === true) return null;
    const states = statesOf(mf.appliedStates).filter(k => FAC[k]);
    if (!states.length) return null;
    if (F.isBeneficialManifestation?.(it)) return null;
    const fac = FAC[states[0]];
    const u = {
      "system.manifestation.resolution.hitSave": true,
      "system.manifestation.resolution.saveAttribute": fac,
      "system.manifestation.appliedStates.saveAttribute": fac
    };
    const preview = foundry.utils.mergeObject(it.toObject(), foundry.utils.expandObject(u), { inplace: false });
    const t = F.manifestation.magnitudeTier(preview, "power", owner ?? null);
    if (t != null) u["system.manifestation.tier"] = t;
    return { u, states, fac, from: Number(mf.tier) || 1, to: t };
  }
  async function fix(it, owner, where) {
    try {
      const p = plan(it, owner); if (!p) return;
      report.changed.push(`${where} · ${it.name}: save (${p.fac}) vs ${p.states.join("/")} · T${p.from}→T${p.to ?? "?"}`);
      if (WRITE) await it.update(p.u);
    } catch (e) { report.errors.push(`${where} · ${it.name}: ${e.message}`); }
  }

  for (const a of game.actors.contents) for (const it of a.items.contents) await fix(it, a, a.name);
  for (const tok of canvas?.scene?.tokens?.contents ?? []) if (!tok.actorLink && tok.actor) for (const it of tok.actor.items.contents) await fix(it, tok.actor, `token ${tok.name}`);
  for (const it of game.items.contents) await fix(it, null, "world");
  for (const pack of game.packs.filter(p => p.documentName === "Item" || p.documentName === "Actor")) {
    const docs = await pack.getDocuments();
    const todo = pack.documentName === "Item"
      ? docs.map(d => [d, null]).filter(([d]) => plan(d, null))
      : docs.flatMap(a => a.items.contents.map(i => [i, a])).filter(([d, a]) => plan(d, a));
    if (!todo.length) continue;
    const wasLocked = pack.locked;
    if (WRITE && wasLocked) await pack.configure({ locked: false });
    try { for (const [d, a] of todo) await fix(d, a, a ? `${pack.collection}/${a.name}` : pack.collection); }
    finally { if (WRITE && wasLocked) await pack.configure({ locked: true }); }
  }
  console.log("auto-power saves", report);
  ui.notifications?.info(`Auto-power saves: ${report.changed.length} ${WRITE ? "changed" : "would change"}${report.errors.length ? `, ${report.errors.length} errors` : ""}.`);
  return report;
})();
