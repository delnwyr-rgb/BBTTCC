/* convert-npcs-to-callings.macro.js — Steward classes → NPC Callings, in place
 * (2026-07-13, follow-up to the npc-callings pack + NPC Builder integration)
 *
 * Sweeps every actor in the world folder "Game Content › Bad Eden NPCs"
 * (subfolders included), strips its Steward class (class + subclass items,
 * lineage-stamped grants, nativeLinks flags — the same cleanup the Steward
 * sheet's class-change runs), and grants the right Calling from
 * bbttcc-character-options.npc-callings at the actor's tier: class item +
 * every tier feature ≤ tier + aptitude kit (signature = tier, secondary =
 * tier − 1, never lowering an existing rank). Actors and their ids are
 * UNTOUCHED — this converts in place, no re-minting.
 *
 * Calling pick, per actor:
 *   1. OVERRIDES[name] if set (the escape hatch — edit below)
 *   2. highest faculty (violence/intrigue/presence/body/mind/soul → the
 *      1:1 Calling); faculty TIES break toward the old class's hint
 *   3. no faculty spread at all → old-class hint → 'bravo' last resort
 *
 * SKIPPED automatically: the Tier-3 construct (Maneuver Vault — matched by
 * flags.fourththing.creatureType 'construct' + tier 3, plus anything in
 * SKIP_NAMES), rigs/factions, and actors that ALREADY have a Calling
 * (idempotent — safe to re-run).
 *
 * DRY_RUN default true: prints the full plan (console.table + GM whisper),
 * changes nothing. Flip to false and re-run to apply. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply

  const FOLDER_NAME   = "Bad Eden NPCs";     // under "Game Content"
  const PARENT_HINT   = "Game Content";
  const CALLINGS_PACK = "bbttcc-character-options.npc-callings";

  // Escape hatches — edit before the live run if the plan table looks off.
  const OVERRIDES  = {};                     // { "Actor Name": "keeper", ... }
  const SKIP_NAMES = [];                     // exact actor names to leave alone
  const SKIP_CONSTRUCT_TIER = 3;             // the Maneuver Vault construct

  // 1:1 faculty → Calling (insertion order = tie-break priority).
  const FACULTY_TO_CALLING = {
    violence: "bravo",   body: "stalwart", intrigue: "operator",
    presence: "broker",  mind: "savant",   soul: "keeper"
  };
  // Old Steward class → thematic hint (tie-breaker only, faculties lead).
  const CLASS_HINTS = {
    "titanbound": "stalwart", "aurablade": "bravo",    "breaker": "bravo",
    "shadowjack": "operator", "phantom courier": "operator",
    "harmony marshal": "broker", "wyrdlens": "savant",
    "dreamwalker": "keeper",  "soul-smith": "keeper",  "soul smith": "keeper"
  };

  if (!game.user.isGM) return ui.notifications.error("GM only.");

  // ── Resolve the folder tree ────────────────────────────────────────────────
  const candidates = game.folders.filter(f =>
    f.type === "Actor" && f.name.toLowerCase() === FOLDER_NAME.toLowerCase());
  const underHint = candidates.filter(f => {
    for (let p = f.folder; p; p = p.folder)
      if (p.name.toLowerCase().includes(PARENT_HINT.toLowerCase())) return true;
    return false;
  });
  const root = underHint[0] ?? candidates[0];
  if (!root) return ui.notifications.error(`Actor folder "${FOLDER_NAME}" not found.`);
  const folderIds = new Set([root.id, ...root.getSubfolders(true).map(f => f.id)]);
  const actors = game.actors.filter(a => a.folder && folderIds.has(a.folder.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!actors.length) return ui.notifications.warn(`"${root.name}" holds no actors.`);

  // ── Load the Callings pack once ────────────────────────────────────────────
  const pack = game.packs.get(CALLINGS_PACK);
  if (!pack) return ui.notifications.error(`Missing pack: ${CALLINGS_PACK}`);
  const packDocs = await pack.getDocuments();
  const callingClasses = new Map();          // key → class doc
  for (const d of packDocs) {
    const c = d.flags?.fourththing?.calling;
    if (d.type === "class" && c?.key) callingClasses.set(c.key, d);
  }
  if (!callingClasses.size) return ui.notifications.error("No Calling classes in pack.");

  // ── The canonical class-strip (bridge) with a manual fallback ─────────────
  let bridge = null;
  try { bridge = await import(foundry.utils.getRoute("systems/fourththing/bbttcc-bridge.js")); }
  catch (e) { console.warn("[callings-convert] bridge import failed — manual strip", e); }

  async function stripStewardClass(actor, oldNames) {
    if (bridge?.applyActorClassChange) {
      await bridge.applyActorClassChange(actor, "");   // clears subclass too
    } else {
      const dead = new Set();
      for (const it of actor.items) {
        if (it.type === "class" || it.type === "subclass") { dead.add(it.id); continue; }
        const f = it.flags?.fourththing ?? {};
        if (f.grantedByClass || f.grantedBySubclass) dead.add(it.id);
      }
      if (dead.size) await actor.deleteEmbeddedDocuments("Item", [...dead]);
      await actor.setFlag("bbttcc-character-options", "nativeLinks", {
        className: "", classUuid: "", classApplied: false,
        subclassName: "", subclassUuid: "", subclassApplied: false
      });
      const fired = actor.getFlag("fourththing", "startingGrantsFiredItems") ?? {};
      const clean = Object.fromEntries(Object.entries(fired).filter(([id]) => !dead.has(id)));
      if (Object.keys(clean).length !== Object.keys(fired).length)
        await actor.setFlag("fourththing", "startingGrantsFiredItems", clean);
    }
    // Supplemental sweep: legacy prefix-named features the clear path misses
    // ("<Old Class> — Tier N: ..." / "<Old Subclass> L3: ...").
    const prefixes = oldNames.filter(Boolean).map(n => n.toLowerCase());
    if (prefixes.length) {
      const stale = actor.items.filter(it => {
        const m = String(it.name ?? "").match(/^([A-Z][a-zA-Z'\- ]+?)\s+(?:—\s+Tier|L\d+:)/);
        return m && prefixes.includes(m[1].trim().toLowerCase());
      }).map(it => it.id);
      if (stale.length) await actor.deleteEmbeddedDocuments("Item", stale);
    }
  }

  // ── Grant a Calling (NPC-Builder logic, conversion-safe on skills) ────────
  async function grantCalling(actor, key, tier) {
    const classDoc = callingClasses.get(key);
    const calling  = classDoc.flags.fourththing.calling;
    const feats = packDocs
      .filter(d => d.type === "feature"
        && d.flags?.fourththing?.calling?.key === key
        && Number(d.flags.fourththing.calling.tier ?? 99) <= tier)
      .sort((a, b) => Number(a.flags.fourththing.calling.tier) - Number(b.flags.fourththing.calling.tier));
    await actor.createEmbeddedDocuments("Item", [classDoc, ...feats].map(d => d.toObject()));
    const kit = {};
    const cur = s => Number(actor.system?.skills?.[s]?.value ?? 0);
    if (calling.signature && cur(calling.signature) < tier)
      kit[`system.skills.${calling.signature}.value`] = tier;
    if (calling.secondary && cur(calling.secondary) < tier - 1)
      kit[`system.skills.${calling.secondary}.value`] = Math.max(0, tier - 1);
    if (Object.keys(kit).length) await actor.update(kit);
    return feats.length;
  }

  // ── Plan every actor ───────────────────────────────────────────────────────
  const hintFor = name => {
    const n = String(name ?? "").toLowerCase();
    for (const [frag, key] of Object.entries(CLASS_HINTS)) if (n.includes(frag)) return key;
    return null;
  };
  const creatureTypes = a => {
    const raw = a.flags?.fourththing?.creatureType ?? a.flags?.fourththing?.creatureTypes;
    return (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(t => String(t).toLowerCase());
  };

  const plan = [];
  for (const a of actors) {
    const row = { actor: a.name, id: a.id, tier: 0, oldClass: "—", calling: "", why: "", skip: "" };
    plan.push(row);
    if (!["character", "npc"].includes(a.type)) { row.skip = `type ${a.type}`; continue; }
    if (SKIP_NAMES.includes(a.name))            { row.skip = "SKIP_NAMES"; continue; }

    const tier = Math.min(4, Math.max(1, Number(a.system?.details?.tier ?? 1) || 1));
    row.tier = tier;
    if (creatureTypes(a).includes("construct") && tier === SKIP_CONSTRUCT_TIER) {
      row.skip = "T3 construct (Maneuver Vault)"; continue;
    }

    const classItems = a.items.filter(i => i.type === "class");
    const subItems   = a.items.filter(i => i.type === "subclass");
    row.oldClass = classItems.map(i => i.name).join(" + ") || "(none)";
    if (classItems.some(i => i.flags?.fourththing?.calling?.key)) {
      row.skip = "already a Calling"; continue;
    }

    const oldNames = [...classItems, ...subItems].map(i => i.name);
    let pick;
    if (OVERRIDES[a.name] && callingClasses.has(OVERRIDES[a.name])) {
      pick = { key: OVERRIDES[a.name], why: "override" };
    } else {
      const hint = oldNames.map(hintFor).find(Boolean);
      const scores = Object.entries(FACULTY_TO_CALLING)
        .map(([fac, key]) => ({ fac, key, v: Number(a.system?.attributes?.[fac]?.value ?? 0) }));
      const max = Math.max(...scores.map(s => s.v));
      if (max > 0) {
        const top = scores.filter(s => s.v === max);
        pick = (top.length > 1 && hint && top.some(s => s.key === hint))
          ? { key: hint, why: `faculty tie @${max} → class hint` }
          : { key: top[0].key, why: `top faculty ${top[0].fac} ${max}${top.length > 1 ? " (tie)" : ""}` };
      } else pick = hint
        ? { key: hint, why: "class hint (flat faculties)" }
        : { key: "bravo", why: "⚠ fallback — no signal, consider OVERRIDES" };
    }
    row.calling = `${callingClasses.get(pick.key).name} (T${tier})`;
    row.why = pick.why;
    row._exec = { actor: a, key: pick.key, tier, oldNames };
  }

  const todo = plan.filter(r => r._exec);
  console.table(plan.map(({ _exec, ...r }) => r));

  const esc = s => foundry.utils.escapeHTML(String(s));
  const tableHtml = `
    <p><b>${DRY_RUN ? "🧪 DRY RUN" : "✅ CONVERTED"}</b> — "${esc(root.name)}":
       ${todo.length} to convert, ${plan.length - todo.length} skipped.</p>
    <table style="font-size:0.72rem;border-collapse:collapse">
      <tr><th style="text-align:left">Actor</th><th style="text-align:left">Old class</th>
          <th style="text-align:left">→ Calling</th><th style="text-align:left">Why / skip</th></tr>
      ${plan.map(r => `<tr>
        <td style="padding:1px 6px 1px 0">${esc(r.actor)}</td>
        <td style="padding:1px 6px 1px 0">${esc(r.oldClass)}</td>
        <td style="padding:1px 6px 1px 0">${r.skip ? "—" : esc(r.calling)}</td>
        <td style="padding:1px 0;opacity:0.75">${esc(r.skip || r.why)}</td></tr>`).join("")}
    </table>
    ${DRY_RUN ? "<p style='opacity:0.7'>Nothing changed. Flip <code>DRY_RUN = false</code> to apply.</p>" : ""}`;

  if (DRY_RUN) {
    await ChatMessage.create({ user: game.user.id, whisper: [game.user.id], content: tableHtml });
    return ui.notifications.info(`Dry run: ${todo.length} conversions planned (see whisper/console).`);
  }

  // ── Apply ──────────────────────────────────────────────────────────────────
  const ok = await Dialog.confirm({
    title: "Convert NPCs to Callings",
    content: `<p>Strip Steward classes and grant Callings on <b>${todo.length}</b> actors in
      "<b>${esc(root.name)}</b>"? (${plan.length - todo.length} skipped — see console table.)</p>`,
    defaultYes: false
  });
  if (!ok) return ui.notifications.warn("Cancelled — nothing changed.");

  let done = 0; const errors = [];
  for (const r of plan) {
    if (!r._exec) continue;
    const { actor, key, tier, oldNames } = r._exec;
    try {
      await stripStewardClass(actor, oldNames);
      const nFeats = await grantCalling(actor, key, tier);
      done++;
      console.log(`[callings-convert] ${actor.name}: ${r.oldClass} → ${r.calling} (+${nFeats} feats)`);
    } catch (e) {
      errors.push(`${actor.name}: ${e.message}`);
      console.error(`[callings-convert] FAILED on ${actor.name}`, e);
    }
  }
  await ChatMessage.create({ user: game.user.id, whisper: [game.user.id], content: tableHtml +
    (errors.length ? `<p><b>⚠ ${errors.length} failed:</b> ${errors.map(esc).join("; ")}</p>` : "") });
  ui.notifications[errors.length ? "warn" : "info"](
    `Callings conversion: ${done} converted, ${errors.length} failed, ${plan.length - todo.length} skipped.`);
})();
