/**
 * fix-broken-with-buttons.macro.js
 *
 * Targeted broken-link sweeper. Scans Item + Actor docs in bbttcc / fourththing
 * packs across THREE surfaces (the prior macro only touched #1):
 *   1) doc.img
 *   2) doc.prototypeToken.texture.src   (Actors only)
 *   3) doc.effects[].img
 *
 * For every broken or generic ref, picks the best-fitting Bad Eden Button Icon
 * using:
 *   - item name tokens
 *   - first 240 chars of description.value (HTML stripped)
 *   - a hand-curated synonym table for Bad Eden archetypes
 *     (menhirkin→stone/crack, igneous→lava/fire, cryptidkin→eye/beast, etc.)
 *
 * Wild guesses fine — rotate-fallback guarantees every broken ref gets filled.
 * Saves rollback JSON to /Data/backups/. APPLY=false for dry run.
 */

(async () => {
  const APPLY      = true;
  const ART_DIR    = "art/bbttcc/GOTTGAIT/Bad Eden Button Icons";
  const BACKUP_DIR = "backups";
  const SCORE_MIN  = 0.16;

  // ---------- synonym hints (Bad Eden archetypes → icon vocabulary) ----------
  const SYNONYMS = {
    menhirkin:    ["stone", "rock", "crack", "cracked", "earth", "sphere", "mountain"],
    igneous:      ["fire", "flame", "lava", "stone", "shockwave", "earthquake"],
    earthen:      ["earth", "stone", "rock", "tree", "root"],
    sediment:     ["earth", "stone", "wave"],
    crystalline:  ["star", "shooting", "moon", "sphere"],
    cryptidkin:   ["eye", "skull", "claw", "wolf", "mask", "beast", "bear"],
    cryptid:      ["eye", "skull", "mask", "shadow"],
    furrykin:     ["wolf", "bear", "fox", "claw", "fang", "tail"],
    leporid:      ["wolf", "bear"],
    ursid:        ["bear", "claw"],
    mustelid:     ["wolf", "claw"],
    vulpin:       ["fox", "wolf"],
    feline:       ["wolf", "claw"],
    avian:        ["wings", "wing", "bird", "fly"],
    serpentine:   ["wave", "skull", "fang"],
    aquatic:      ["fish", "wave", "ocean"],
    insectoid:    ["claw", "wings"],
    cosmic:       ["star", "moon", "sun", "sunrise", "shooting"],
    linguist:     ["scroll", "book", "rune", "word", "eye"],
    semantic:     ["scroll", "book", "rune", "word"],
    resonance:    ["wave", "magic", "shockwave", "sound"],
    strain:       ["heart", "skull", "wave"],
    archetype:    ["mask", "crown", "eye"],
    judgment:     ["sword", "shield", "eye", "skull"],
    reckoner:     ["sword", "skull", "shield"],
    folklore:     ["scroll", "book", "tree", "moon"],
    frame:        ["shield", "mask", "stone"],
    wildframe:    ["tree", "wolf", "wings", "beast"],
    instinct:     ["claw", "fang", "eye", "wolf"],
    aurablade:    ["aurablade", "sword", "blade", "shield"],
    bulwark:      ["shield", "stone", "wall"],
    courier:      ["map", "wings", "scroll"],
    shadow:       ["mask", "skull", "moon", "eye"],
    salvager:     ["map", "scroll", "shield"],
    forge:        ["fire", "hammer", "earth"],
    raid:         ["sword", "shield", "shockwave"],
    quest:        ["scroll", "map", "star"],
    healer:       ["heart", "stillheart", "hand"],
    blood:        ["blood", "skull", "heart", "tree"],
    hymn:         ["blood", "tree", "scroll"],
    death:        ["skull", "blood", "moon"],
    dream:        ["moon", "dream", "star"],
    moon:         ["moon", "dream", "star"],
    sun:          ["sun", "sunrise", "sunset"],
    void:         ["moon", "shadow", "skull"],
    quantum:      ["quantum", "map", "star"],
    map:          ["map", "quantum", "scroll"],
    scroll:       ["scroll", "book", "rune"],
    book:         ["book", "scroll"],
    flame:        ["fire", "flame", "shooting"],
    flood:        ["wave", "ocean", "fish"],
    storm:        ["shockwave", "wave", "magic"],
    earth:        ["earth", "stone", "rock", "earthquake"],
    radiation:    ["radiation", "shockwave", "earthquake"],
    rad:          ["radiation", "shockwave"],
    talanu:       ["scroll", "moon", "star"],
    tikkun:       ["star", "stillheart", "tree"],
    sephirot:     ["star", "tree", "moon", "sun"],
  };

  const STOP = new Set([
    "the","of","a","an","and","or","to","from","with","for","into","onto",
    "your","you","at","in","on","by","is","be","as","this","that","these","those",
    "path","paths","feat","feats","trait","traits","feature","features",
    "doctrine","doctrines","ability","abilities","power","powers",
    "rfi","bbttcc","ft","fourththing","badeden","bad","eden",
    "lvl","level","tier","mark","mk","item","items","gear","button","icon",
    "core","initiation","resonance","strain","channel","pool",
    "use","uses","action","reaction","bonus","passive",
  ]);

  const IMG_RE = /\.(png|jpe?g|webp|svg|gif)$/i;

  function stripHtml(s) {
    if (!s) return "";
    return s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  }

  function rawTokens(s) {
    if (!s) return [];
    return s.toLowerCase()
      .replace(/[_\-\s().,:;'"\[\]\/!?]+/g, " ")
      .replace(/\b\d+\b/g, " ")
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP.has(t));
  }

  function fileTokens(path) {
    if (!path) return [];
    return rawTokens(
      decodeURIComponent(path)
        .replace(/^.*\//, "")
        .replace(/\.[^.]+$/, "")
        .replace(/^bbttcc[_\-\s]*/g, "")
        .replace(/^button[_\-\s]*icon[_\-\s]*/g, "")
    );
  }

  function expandSynonyms(toks) {
    const out = new Set(toks);
    for (const t of toks) {
      const syns = SYNONYMS[t];
      if (syns) for (const s of syns) out.add(s);
    }
    return [...out];
  }

  function corpusTokens(doc) {
    const desc = stripHtml(doc.system?.description?.value ?? "").slice(0, 240);
    const base = [...rawTokens(doc.name), ...rawTokens(desc)];
    return expandSynonyms(base);
  }

  function partialMatches(aTokens, bSet) {
    let m = 0;
    for (const t of aTokens) {
      if (bSet.has(t)) { m++; continue; }
      for (const u of bSet) {
        if (t.length >= 4 && u.length >= 4 && (u.includes(t) || t.includes(u))) { m++; break; }
      }
    }
    return m;
  }

  function score(itemTokens, artTokens) {
    if (!itemTokens.length || !artTokens.length) return 0;
    const a = new Set(itemTokens);
    const b = new Set(artTokens);
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    const jaccard = inter / new Set([...a, ...b]).size;
    const partial = partialMatches(itemTokens, b) / itemTokens.length;
    let bonus = 0;
    if (itemTokens[0] && b.has(itemTokens[0])) bonus += 0.1;
    return Math.min(1, 0.5 * jaccard + 0.4 * partial + bonus);
  }

  function isGenericIcon(img) {
    if (!img) return true;
    if (img.startsWith("icons/svg/")) return true;
    if (img.startsWith("icons/")) return true;
    return false;
  }

  // ---------- file existence ----------
  const _dirCache = new Map();
  async function listDir(dir) {
    if (_dirCache.has(dir)) return _dirCache.get(dir);
    let files = new Set(), raw = new Set();
    try {
      const res = await FilePicker.browse("data", dir);
      for (const f of res.files) { raw.add(f); files.add(decodeURIComponent(f)); }
    } catch {}
    const both = { decoded: files, raw };
    _dirCache.set(dir, both);
    return both;
  }
  async function fileExists(path) {
    if (!path) return false;
    if (/^https?:/i.test(path)) return true;
    const decoded = decodeURIComponent(path);
    const slash = decoded.lastIndexOf("/");
    if (slash < 0) return false;
    const dir  = decoded.slice(0, slash);
    const { decoded: dec, raw } = await listDir(dir);
    return dec.has(decoded) || raw.has(path);
  }

  // ---------- 1. Index Button Icons ----------
  ui.notifications.info(`Indexing Button Icons …`);
  let res;
  try { res = await FilePicker.browse("data", ART_DIR); }
  catch (e) { ui.notifications.error(`Cannot browse ${ART_DIR}`); console.error(e); return; }
  const ART_INDEX = res.files
    .filter(f => IMG_RE.test(f))
    .map(p => ({ path: p, tokens: fileTokens(p) }));
  if (!ART_INDEX.length) { ui.notifications.error(`No images in ${ART_DIR}.`); return; }
  ui.notifications.info(`Indexed ${ART_INDEX.length} button icons.`);

  let rotateCursor = 0;
  function rotateFallback() {
    const a = ART_INDEX[rotateCursor % ART_INDEX.length];
    rotateCursor++;
    return { score: 0, path: a.path, fallback: true };
  }
  function bestMatch(itemTokens) {
    if (!itemTokens.length) return null;
    let best = { score: 0, path: null };
    for (const a of ART_INDEX) {
      const s = score(itemTokens, a.tokens);
      if (s > best.score) best = { score: s, path: a.path };
    }
    return best.score >= SCORE_MIN ? best : null;
  }

  // ---------- 2. Walk packs ----------
  const TARGET_RE = /^(?:bbttcc|fourththing|bad-eden)/i;
  const packs = game.packs.filter(p => TARGET_RE.test(p.collection));
  // fourththing system Item types — anything else triggers schema-validation spam
  const VALID_ITEM_TYPES = new Set([
    "weapon","armor","power","gear","feature","feat","class","subclass","race","species","base",
  ]);
  // Silence the per-doc validation warnings while we iterate (restored in finally).
  const _origWarn = console.warn, _origError = console.error;
  const _filter = (orig) => (...args) => {
    const s = String(args[0] ?? "");
    if (/validation errors|is not a valid type for the Item Document class/.test(s)) return;
    return orig.apply(console, args);
  };
  console.warn  = _filter(_origWarn);
  console.error = _filter(_origError);
  try {
  ui.notifications.info(`Scanning ${packs.length} packs (img + prototypeToken + effects) …`);

  const report = {
    indexedArt: ART_INDEX.length, packs: packs.length,
    scanned: 0,
    fixedDocImg: 0, fixedToken: 0, fixedEffect: 0,
    namedMatch: 0, fallback: 0,
    skippedAlreadyGood: 0, errors: 0,
    byPack: {},
  };
  const backup = [];

  for (const pack of packs) {
    const id = pack.collection;
    const wasLocked = pack.locked;
    if (wasLocked) { try { await pack.configure({ locked: false }); } catch {} }

    // Use index + per-doc lookup so broken-typed items never get loaded.
    let index;
    try { index = await pack.getIndex({ fields: ["type", "img"] }); }
    catch (e) {
      _origWarn(`[fix-buttons] could not index ${id}`, e);
      report.errors++;
      if (wasLocked) await pack.configure({ locked: true }).catch(()=>{});
      continue;
    }
    const isItemPack = pack.documentName === "Item";
    const ids = [];
    for (const entry of index) {
      if (isItemPack && entry.type && !VALID_ITEM_TYPES.has(entry.type)) continue;
      ids.push(entry._id);
    }
    const pr = { type: pack.documentName, scanned: 0, fixed: 0, skippedInvalidType: index.size - ids.length };

    for (const docId of ids) {
      let doc;
      try { doc = await pack.getDocument(docId); }
      catch { continue; }
      if (!doc) continue;
      if (!["Item", "Actor"].includes(doc.documentName)) continue;
      report.scanned++; pr.scanned++;
      const tokensForDoc = corpusTokens(doc);
      const updates = {};
      let docFixed = false;

      // --- (1) doc.img ---
      const img = doc.img;
      let needsImg = false;
      if (isGenericIcon(img)) needsImg = true;
      else if (img && !/^https?:/i.test(img)) {
        if (!(await fileExists(img))) needsImg = true;
      }
      if (needsImg) {
        let m = bestMatch(tokensForDoc);
        let fb = false;
        if (!m) { m = rotateFallback(); fb = true; }
        updates.img = m.path;
        backup.push({
          uuid: doc.uuid, name: doc.name, surface: "img",
          oldImg: img, newImg: m.path, score: Number((m.score ?? 0).toFixed(3)),
          fallback: fb,
        });
        if (fb) report.fallback++; else report.namedMatch++;
        report.fixedDocImg++; docFixed = true;
        console.log(`[fix-buttons] ${id} :: ${doc.name} :: img → ${m.path}${fb ? " (fallback)" : ""}`);
      }

      // --- (2) prototypeToken.texture.src (Actors) ---
      if (doc.documentName === "Actor") {
        const src = doc.prototypeToken?.texture?.src;
        let needsTok = false;
        if (isGenericIcon(src)) needsTok = true;
        else if (src && !/^https?:/i.test(src)) {
          if (!(await fileExists(src))) needsTok = true;
        }
        if (needsTok) {
          let m = bestMatch(tokensForDoc);
          let fb = false;
          if (!m) { m = rotateFallback(); fb = true; }
          updates["prototypeToken.texture.src"] = m.path;
          backup.push({
            uuid: doc.uuid, name: doc.name, surface: "prototypeToken",
            oldImg: src, newImg: m.path, score: Number((m.score ?? 0).toFixed(3)),
            fallback: fb,
          });
          if (fb) report.fallback++; else report.namedMatch++;
          report.fixedToken++; docFixed = true;
          console.log(`[fix-buttons] ${id} :: ${doc.name} :: prototypeToken → ${m.path}${fb ? " (fallback)" : ""}`);
        }
      }

      // --- (3) effects[].img ---
      const effectUpdates = [];
      for (const eff of doc.effects ?? []) {
        const eImg = eff.img ?? eff.icon;          // v11+ uses img, v10 used icon
        let needsEff = false;
        if (isGenericIcon(eImg)) needsEff = true;
        else if (eImg && !/^https?:/i.test(eImg)) {
          if (!(await fileExists(eImg))) needsEff = true;
        }
        if (!needsEff) continue;
        let m = bestMatch([...tokensForDoc, ...rawTokens(eff.name ?? "")]);
        let fb = false;
        if (!m) { m = rotateFallback(); fb = true; }
        effectUpdates.push({ _id: eff.id, img: m.path });
        backup.push({
          uuid: doc.uuid, name: `${doc.name} → effect:${eff.name}`, surface: "effect",
          oldImg: eImg, newImg: m.path, score: Number((m.score ?? 0).toFixed(3)),
          fallback: fb,
        });
        if (fb) report.fallback++; else report.namedMatch++;
        report.fixedEffect++; docFixed = true;
      }

      if (!docFixed) { report.skippedAlreadyGood++; continue; }

      if (APPLY) {
        try {
          if (Object.keys(updates).length) await doc.update(updates);
          if (effectUpdates.length) await doc.updateEmbeddedDocuments("ActiveEffect", effectUpdates);
          pr.fixed++;
        } catch (e) {
          console.warn(`[fix-buttons] update failed for ${doc.uuid}`, e);
          report.errors++;
        }
      } else { pr.fixed++; }
    }

    if (wasLocked) { try { await pack.configure({ locked: true }); } catch {} }
    report.byPack[id] = pr;
  }
  } finally { console.warn = _origWarn; console.error = _origError; }

  // ---------- 3. Backup + chat ----------
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fname = `image-fix-buttons-${ts}.json`;
  const payload = { generatedAt: ts, apply: APPLY, scoreMin: SCORE_MIN, report, replacements: backup };

  try {
    try { await FilePicker.browse("data", BACKUP_DIR); }
    catch { await FilePicker.createDirectory("data", BACKUP_DIR); }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const file = new File([blob], fname, { type: "application/json" });
    await FilePicker.upload("data", BACKUP_DIR, file, {}, { notify: false });
  } catch (e) {
    console.error("[fix-buttons] backup write failed — payload below", e);
    console.log(payload);
  }

  console.log("[fix-buttons] report", report);
  console.log("[fix-buttons] backup", backup);

  const total = report.fixedDocImg + report.fixedToken + report.fixedEffect;
  ChatMessage.create({ whisper: [game.user.id], content: `
    <h3>${APPLY ? "Fix-Broken with Buttons" : "Fix-Broken with Buttons (DRY RUN)"}</h3>
    <ul>
      <li>Button icons indexed: <b>${report.indexedArt}</b></li>
      <li>Packs scanned: <b>${report.packs}</b></li>
      <li>Items/Actors scanned: <b>${report.scanned}</b></li>
      <li>Already-good (skipped): <b>${report.skippedAlreadyGood}</b></li>
      <li>Fixed <code>doc.img</code>: <b>${report.fixedDocImg}</b></li>
      <li>Fixed <code>prototypeToken.texture.src</code>: <b>${report.fixedToken}</b></li>
      <li>Fixed <code>effects[].img</code>: <b>${report.fixedEffect}</b></li>
      <li>Named match: <b>${report.namedMatch}</b> · Rotated fallback: <b>${report.fallback}</b></li>
      <li>Total fixes: <b>${total}</b></li>
      <li>Errors: <b>${report.errors}</b></li>
    </ul>
    <p>Backup: <code>${BACKUP_DIR}/${fname}</code> · per-fix log in F12 console.</p>` });
  ui.notifications.info(`Fix-buttons done — ${total} fixes, ${report.errors} errors.`);
})();
