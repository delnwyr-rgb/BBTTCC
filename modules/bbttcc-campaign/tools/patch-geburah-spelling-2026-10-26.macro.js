/* patch-geburah-spelling-2026-10-26.macro.js — one spelling per sephira: GEBURAH (Dave, 2026-10-26).
 *  Why: the system key was "gevurah" while the campaign, the beats and the alignment items said "geburah". The ruling makes
 *   geburah canonical everywhere (keter vs kether is NOT touched — keter stays). The engine now folds "gevurah" on input
 *   (system 2026-10-26 + tikkun / territory / factions / raid / epic), so this macro is the data half: it rewrites every
 *   stored legacy value in the LIVE WORLD so nothing depends on the fold.
 *  What it rewrites (in this world only — compendium packs go through the geburah manifests):
 *   • string VALUES:  "gevurah"/"gevura" → "geburah", "Gevurah" → "Geburah", "GEVURAH" → "GEBURAH" (exact values),
 *                     "spark_gevurah_<kind>" → "spark_geburah_<kind>" (hex spark keys, actor spark records),
 *                     whole-word Gevurah/gevurah inside prose ("Wardstone of Gevurah", "Hull of Gevurah", journal pages).
 *                     File paths / uuids / URLs are never touched (the Wardstone art file keeps its name).
 *   • object KEYS:    "gevurah"/"gevura" → "geburah", "gevurah_signal" → "geburah_signal" (sorting-engine traitMap),
 *                     "spark_gevurah_*" → "spark_geburah_*" (tikkun spark maps, ritual instruments). A key whose new
 *                     name already exists is reported and left alone.
 *   • where:  actors (name/system/flags, embedded items + their effects, actor effects), unlinked token deltas, scenes
 *            (scene flags + drawings/tiles/tokens/notes flags & text), world items, journal entries + pages, and every
 *            world setting whose stored JSON mentions gevurah — EXCEPT bbttcc-world.worldSnapshots (historical restore
 *            points; a restored snapshot is folded by the engine on read).
 *  Idempotent (rerun → 0); DRY_RUN default true (prints every path); settings copied with JSON.parse(JSON.stringify())
 *  (deepClone once made a write silently no-op); backs up the touched settings to a download before writing (take a
 *  world save / golden before applying — actor and scene writes are not backed up here). GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const TAG = "[geburah spelling 2026-10-26]";
  const SKIP_SETTINGS = new Set(["bbttcc-world.worldSnapshots"]);
  const SKIP_KEYS = new Set(["_id", "_stats", "img", "src", "texture", "thumb", "ownership", "sort", "folder", "_key"]);
  const HIT = /gevura/i;
  const report = []; const conflicts = [];
  let docsTouched = 0, fieldChanges = 0, settingsTouched = 0;
  const ctr = { actors: 0, actorItems: 0, effects: 0, tokens: 0, scenes: 0, sceneEmbedded: 0, items: 0, journal: 0, pages: 0, settings: 0 };

  // ── the rewrite rules ────────────────────────────────────────────────────
  const EXACT = { gevurah: "geburah", gevura: "geburah", Gevurah: "Geburah", Gevura: "Geburah", GEVURAH: "GEBURAH" };
  const PATHLIKE = /(\.(webp|png|jpe?g|gif|svg|webm|mp4|m4a|mp3|ogg|wav|json|js|pdf)(\?|#|$))|^Compendium\.|:\/\//i;
  function fixStr(s) {
    if (typeof s !== "string" || !HIT.test(s)) return s;
    if (EXACT[s]) return EXACT[s];
    if (/^spark_gevurah?_[a-z]+$/i.test(s)) return s.replace(/^spark_gevurah?_/i, "spark_geburah_");
    if (PATHLIKE.test(s)) return s;
    return s.replace(/\bGevurah\b/g, "Geburah").replace(/\bgevurah\b/g, "geburah").replace(/\bGEVURAH\b/g, "GEBURAH")
            .replace(/spark_gevurah?_/g, "spark_geburah_");
  }
  function fixKey(k) {
    if (k === "gevurah" || k === "gevura") return "geburah";
    if (k === "gevurah_signal") return "geburah_signal";
    if (/^spark_gevurah?_/.test(k)) return k.replace(/^spark_gevurah?_/, "spark_geburah_");
    return k;
  }
  // Deep-fixed copy of any JSON value (keys + values).
  function fixDeep(v) {
    if (typeof v === "string") return fixStr(v);
    if (Array.isArray(v)) return v.map(fixDeep);
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, x] of Object.entries(v)) {
        const nk = fixKey(k);
        if (nk !== k && Object.prototype.hasOwnProperty.call(v, nk)) { conflicts.push(`key ${k} → ${nk} exists`); out[k] = fixDeep(x); continue; }
        out[nk] = fixDeep(x);
      }
      return out;
    }
    return v;
  }
  // Walk `src` under dotted `base` and emit a flat Document#update diff: leaf string sets, whole-array sets,
  // and key renames as "<parent>.<new>" = fixed value + "<parent>.-=<old>" = null.
  function diff(src, base, out, label) {
    if (src === null || src === undefined) return;
    if (typeof src === "string") { const n = fixStr(src); if (n !== src) { out[base] = n; report.push(`  ${label} ${base}: ${JSON.stringify(src).slice(0, 90)} → ${JSON.stringify(n).slice(0, 90)}`); } return; }
    if (Array.isArray(src)) { if (!HIT.test(JSON.stringify(src))) return; const n = fixDeep(src);
      if (JSON.stringify(n) !== JSON.stringify(src)) { out[base] = n; report.push(`  ${label} ${base}: [array] rewritten`); } return; }
    if (typeof src !== "object") return;
    if (!HIT.test(JSON.stringify(src))) return;
    for (const [k, x] of Object.entries(src)) {
      if (SKIP_KEYS.has(k)) continue;
      const nk = fixKey(k);
      if (nk !== k) {
        if (Object.prototype.hasOwnProperty.call(src, nk)) { conflicts.push(`${label} ${base}.${k}: target key ${nk} exists — left alone`); continue; }
        if (k.includes(".")) { conflicts.push(`${label} ${base}.${k}: dotted key — left alone`); continue; }
        out[`${base}.${nk}`] = fixDeep(x); out[`${base}.-=${k}`] = null;
        report.push(`  ${label} ${base}: key ${k} → ${nk}`);
        continue;
      }
      if (k.includes(".")) { if (HIT.test(JSON.stringify(x))) conflicts.push(`${label} ${base}.${k}: dotted key with gevurah inside — left alone`); continue; }
      diff(x, `${base}.${k}`, out, label);
    }
  }
  // One document → its update object (name + the given top-level fields).
  function docDiff(doc, fields, label) {
    const src = doc.toObject(false); const out = {};
    for (const f of fields) {
      if (!(f in src)) continue;
      if (typeof src[f] === "string") { const n = fixStr(src[f]); if (n !== src[f]) { out[f] = n; report.push(`  ${label} ${f}: ${JSON.stringify(src[f]).slice(0, 90)} → ${JSON.stringify(n).slice(0, 90)}`); } }
      else diff(src[f], f, out, label);
    }
    return out;
  }
  const count = (u) => Object.keys(u).filter(k => !k.includes(".-=")).length;
  async function apply(doc, upd, kind) {
    if (!Object.keys(upd).length) return false;
    docsTouched++; fieldChanges += count(upd); ctr[kind]++;
    if (!DRY_RUN) await doc.update(upd, { diff: false, recursive: true, render: false });
    return true;
  }

  // ── actors (world + synthetic token actors share this) ───────────────────
  async function doActor(actor, label, isToken = false) {
    const raw = JSON.stringify(actor.toObject(false));
    if (!HIT.test(raw)) return;
    await apply(actor, docDiff(actor, ["name", "system", "flags"], label), isToken ? "tokens" : "actors");
    for (const it of actor.items ?? []) {
      if (!HIT.test(JSON.stringify(it.toObject(false)))) continue;
      const u = docDiff(it, ["name", "system", "flags"], `${label} › item ${it.name}`);
      if (Object.keys(u).length) { if (!DRY_RUN) await it.update(u, { diff: false, recursive: true, render: false }); docsTouched++; fieldChanges += count(u); ctr.actorItems++; }
      for (const ef of it.effects ?? []) {
        const e = docDiff(ef, ["name", "description", "changes", "flags"], `${label} › item ${it.name} › effect ${ef.name}`);
        if (Object.keys(e).length) { if (!DRY_RUN) await ef.update(e, { diff: false, recursive: true, render: false }); docsTouched++; fieldChanges += count(e); ctr.effects++; }
      }
    }
    for (const ef of actor.effects ?? []) {
      const e = docDiff(ef, ["name", "description", "changes", "flags"], `${label} › effect ${ef.name}`);
      if (Object.keys(e).length) { if (!DRY_RUN) await ef.update(e, { diff: false, recursive: true, render: false }); docsTouched++; fieldChanges += count(e); ctr.effects++; }
    }
  }
  for (const a of game.actors ?? []) await doActor(a, `actor ${a.name} [${a.id}]`);

  // ── scenes: scene flags + embedded drawings / tiles / notes / tokens ─────
  for (const sc of game.scenes ?? []) {
    if (!HIT.test(JSON.stringify(sc.toObject(false)))) continue;
    await apply(sc, docDiff(sc, ["flags"], `scene ${sc.name}`), "scenes");
    for (const coll of ["drawings", "tiles", "notes", "regions", "templates", "sounds", "lights"]) {
      for (const d of sc[coll] ?? []) {
        if (!HIT.test(JSON.stringify(d.toObject(false)))) continue;
        await apply(d, docDiff(d, ["flags", "text", "name"], `scene ${sc.name} › ${coll} ${d.id}`), "sceneEmbedded");
      }
    }
    for (const t of sc.tokens ?? []) {
      const obj = t.toObject(false);
      if (!HIT.test(JSON.stringify(obj))) continue;
      await apply(t, docDiff(t, ["flags", "name"], `scene ${sc.name} › token ${t.name}`), "sceneEmbedded");
      if (!t.actorLink && t.actor && HIT.test(JSON.stringify(obj.delta ?? {}))) await doActor(t.actor, `scene ${sc.name} › token ${t.name} (delta)`, true);
    }
  }

  // ── world items + journal ────────────────────────────────────────────────
  for (const it of game.items ?? []) {
    if (!HIT.test(JSON.stringify(it.toObject(false)))) continue;
    await apply(it, docDiff(it, ["name", "system", "flags"], `item ${it.name}`), "items");
    for (const ef of it.effects ?? []) {
      const e = docDiff(ef, ["name", "description", "changes", "flags"], `item ${it.name} › effect ${ef.name}`);
      if (Object.keys(e).length) { if (!DRY_RUN) await ef.update(e, { diff: false, recursive: true, render: false }); docsTouched++; fieldChanges += count(e); ctr.effects++; }
    }
  }
  for (const j of game.journal ?? []) {
    if (!HIT.test(JSON.stringify(j.toObject(false)))) continue;
    await apply(j, docDiff(j, ["name", "flags"], `journal ${j.name}`), "journal");
    for (const p of j.pages ?? []) {
      if (!HIT.test(JSON.stringify(p.toObject(false)))) continue;
      await apply(p, docDiff(p, ["name", "text", "flags", "system"], `journal ${j.name} › page ${p.name}`), "pages");
    }
  }

  // ── world settings (true copies; registered → settings.set, unregistered → the Setting document) ──
  const backups = {}; const pendingSettings = [];
  for (const s of game.settings.storage.get("world") ?? []) {
    const key = s.key; if (SKIP_SETTINGS.has(key)) continue;
    const rawStr = typeof s._source?.value === "string" ? s._source.value : JSON.stringify(s._source?.value ?? null);
    if (!HIT.test(rawStr)) continue;
    let val; try { val = JSON.parse(rawStr); } catch { val = rawStr; }
    const before = JSON.parse(JSON.stringify(val));
    const after = fixDeep(JSON.parse(JSON.stringify(val)));
    if (JSON.stringify(after) === JSON.stringify(before)) continue;
    const n = (JSON.stringify(before).match(/gevura/gi) || []).length - (JSON.stringify(after).match(/gevura/gi) || []).length;
    report.push(`  setting ${key}: ${n} occurrence(s) rewritten`);
    settingsTouched++; fieldChanges += n; ctr.settings++; backups[key] = before;
    pendingSettings.push({ s, key, after });
  }
  // Back up the touched settings BEFORE writing them.
  if (!DRY_RUN && pendingSettings.length) {
    try { saveDataToFile(JSON.stringify(backups, null, 2), "application/json", `settings-backup-pre-geburah-${game.world.id}-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  }
  for (const { s, key, after } of DRY_RUN ? [] : pendingSettings) {
    const [ns, ...rest] = key.split("."); const k = rest.join(".");
    if (game.settings.settings.has(key)) {
      const cur = game.settings.get(ns, k);
      await game.settings.set(ns, k, typeof cur === "string" && typeof after !== "string" ? JSON.stringify(after) : after);
    } else {
      await s.update({ value: JSON.stringify(after) });   // JSONField source is the JSON text
    }
  }

  const total = docsTouched + settingsTouched;
  console.log(`${TAG} ${DRY_RUN ? "DRY RUN" : "APPLY"} — world ${game.world.id}: ${total} document(s)/setting(s), ${fieldChanges} field change(s)\n`
    + `  by kind: ${JSON.stringify(ctr)}\n` + report.join("\n")
    + (conflicts.length ? `\n⚠ left alone (${conflicts.length}):\n  ` + conflicts.join("\n  ") : ""));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${total} doc(s)/setting(s), ${fieldChanges} change(s); see console.`);
  if (!total) return ui.notifications.info("Nothing to change — already applied.");
  ui.notifications.info(`Applied: ${total} doc(s)/setting(s), ${fieldChanges} change(s) — Geburah is the one spelling. Rerun should read 0.`);
})();
