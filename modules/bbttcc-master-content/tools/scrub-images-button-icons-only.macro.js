/**
 * scrub-images-button-icons-only.macro.js
 *
 * Bad Eden-branded full pass: re-scrubs every Item/Actor in bbttcc/fourththing
 * packs and assigns ONLY images from /Data/art/bbttcc/GOTTGAIT/Bad Eden Button Icons/.
 *
 * Three modes (set MODE below):
 *   "broken-only"  — only touch items currently generic/broken (safe top-up)
 *   "all"          — re-skin EVERYTHING under bbttcc/fourththing packs (destructive
 *                    to existing curated art; full Bad Eden uniformity)
 *
 * Wild guesses fine — when no name match clears threshold, rotates through the
 * Button Icons pool so every item ends up with a branded image.
 *
 * Saves rollback JSON to /Data/backups/. Re-run safe.
 */

(async () => {
  const APPLY      = true;
  const MODE       = "broken-only";  // "broken-only" | "all"
  const ART_DIR    = "art/bbttcc/GOTTGAIT/Bad Eden Button Icons";
  const BACKUP_DIR = "backups";
  const SCORE_MIN  = 0.15;            // very loose — Button Icons names are abstract

  const STOP = new Set([
    "the","of","a","an","and","or","to","from","with","for","into","onto",
    "your","you","at","in","on","by","is","be","as","this","that","these","those",
    "path","paths","feat","feats","trait","traits","feature","features",
    "doctrine","doctrines","ability","abilities","power","powers",
    "rfi","bbttcc","ft","fourththing","badeden","bad","eden",
    "lvl","level","tier","mark","mk","item","items","gear","button","icon",
    "core","initiation","resonance","strain","channel","pool","semantic",
  ]);

  const IMG_RE = /\.(png|jpe?g|webp|svg|gif)$/i;

  function tokens(s) {
    if (!s) return [];
    return decodeURIComponent(s)
      .toLowerCase()
      .replace(/^.*\//, "")
      .replace(/\.[^.]+$/, "")
      .replace(/^bbttcc[_\-\s]*/g, "")
      .replace(/^button[_\-\s]*icon[_\-\s]*/g, "")
      .replace(/[_\-\s().,:;'"\[\]\/]+/g, " ")
      .replace(/\b\d+\b/g, " ")
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP.has(t));
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
    if (itemTokens[0] && b.has(itemTokens[0])) bonus += 0.08;
    return Math.min(1, 0.5 * jaccard + 0.4 * partial + bonus);
  }

  function isGenericIcon(img) {
    if (!img) return true;
    if (img.startsWith("icons/svg/")) return true;
    if (img.startsWith("icons/")) return true;
    return false;
  }

  const _dirCache = new Map();
  async function listDir(dir) {
    if (_dirCache.has(dir)) return _dirCache.get(dir);
    let files = new Set();
    try {
      const res = await FilePicker.browse("data", dir);
      files = new Set(res.files.map(decodeURIComponent));
    } catch {}
    _dirCache.set(dir, files);
    return files;
  }
  async function fileExists(path) {
    if (!path) return false;
    if (/^https?:/i.test(path)) return true;
    const decoded = decodeURIComponent(path);
    const slash = decoded.lastIndexOf("/");
    if (slash < 0) return false;
    const dir = decoded.slice(0, slash);
    return (await listDir(dir)).has(decoded);
  }

  // ---------- 1. Index Button Icons only ----------
  ui.notifications.info(`Indexing Button Icons under ${ART_DIR} …`);
  let res;
  try { res = await FilePicker.browse("data", ART_DIR); }
  catch (e) { ui.notifications.error(`Cannot browse ${ART_DIR}`); console.error(e); return; }
  const ART_INDEX = res.files
    .filter(f => IMG_RE.test(f))
    .map(p => ({ path: p, tokens: tokens(p) }));
  if (!ART_INDEX.length) { ui.notifications.error(`No images in ${ART_DIR}.`); return; }
  ui.notifications.info(`Indexed ${ART_INDEX.length} button icons.`);

  let rotateCursor = 0;
  function rotateFallback() {
    const a = ART_INDEX[rotateCursor % ART_INDEX.length];
    rotateCursor++;
    return { score: 0, path: a.path, fallback: true };
  }

  function bestNameMatch(doc) {
    const itemTokens = tokens(doc.name);
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
  ui.notifications.info(`Mode=${MODE}. Scanning ${packs.length} packs …`);

  const report = {
    indexedArt: ART_INDEX.length, packs: packs.length, mode: MODE,
    scanned: 0, skippedAlreadyGood: 0,
    namedMatch: 0, fallback: 0, noMatch: 0, errors: 0,
    byPack: {},
  };
  const backup = [];

  for (const pack of packs) {
    const id = pack.collection;
    const wasLocked = pack.locked;
    if (wasLocked) { try { await pack.configure({ locked: false }); } catch {} }

    let docs;
    try { docs = await pack.getDocuments(); }
    catch (e) {
      console.warn(`[btnscrub] could not load ${id}`, e);
      report.errors++;
      if (wasLocked) await pack.configure({ locked: true }).catch(()=>{});
      continue;
    }

    const pr = { type: docs[0]?.documentName ?? "?", scanned: 0, named: 0, fallback: 0, noMatch: 0 };

    for (const doc of docs) {
      if (!["Item", "Actor"].includes(doc.documentName)) continue;
      report.scanned++; pr.scanned++;
      const img = doc.img;

      let reason = null;
      if (isGenericIcon(img)) reason = "generic";
      else if (img && !/^https?:/i.test(img)) {
        const ok = await fileExists(img);
        if (!ok) reason = "broken";
      }
      // mode gate
      if (MODE === "broken-only") {
        if (!reason) { report.skippedAlreadyGood++; continue; }
      } else { // "all"
        if (!reason) reason = "reskin";
      }

      let match = bestNameMatch(doc);
      let fb = false;
      if (!match) { match = rotateFallback(); fb = true; }

      backup.push({
        uuid: doc.uuid, name: doc.name, type: doc.documentName,
        oldImg: img, newImg: match.path,
        score: Number((match.score ?? 0).toFixed(3)),
        reason, fallback: fb,
      });

      if (APPLY) {
        try { await doc.update({ img: match.path }); }
        catch (e) {
          console.warn(`[btnscrub] update failed for ${doc.uuid}`, e);
          report.errors++; continue;
        }
      }
      if (fb) { report.fallback++; pr.fallback++; }
      else    { report.namedMatch++; pr.named++;  }
    }

    if (wasLocked) { try { await pack.configure({ locked: true }); } catch {} }
    report.byPack[id] = pr;
  }

  // ---------- 3. Backup + chat ----------
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fname = `image-rehydrate-buttons-${MODE}-${ts}.json`;
  const payload = { generatedAt: ts, apply: APPLY, mode: MODE, scoreMin: SCORE_MIN, report, replacements: backup };

  try {
    try { await FilePicker.browse("data", BACKUP_DIR); }
    catch { await FilePicker.createDirectory("data", BACKUP_DIR); }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const file = new File([blob], fname, { type: "application/json" });
    await FilePicker.upload("data", BACKUP_DIR, file, {}, { notify: false });
  } catch (e) {
    console.error("[btnscrub] backup write failed — payload below", e);
    console.log(payload);
  }

  console.log("[btnscrub] report", report);
  console.log("[btnscrub] backup", backup);

  const total = report.namedMatch + report.fallback;
  ChatMessage.create({ whisper: [game.user.id], content: `
    <h3>Button-Icons-Only Scrub (${MODE})</h3>
    <ul>
      <li>Button icons indexed: <b>${report.indexedArt}</b></li>
      <li>Packs scanned: <b>${report.packs}</b></li>
      <li>Items/Actors scanned: <b>${report.scanned}</b></li>
      <li>Already-good (skipped): <b>${report.skippedAlreadyGood}</b></li>
      <li>Named matches: <b>${report.namedMatch}</b></li>
      <li>Rotated fallback: <b>${report.fallback}</b></li>
      <li>Total replaced: <b>${total}</b></li>
      <li>No match: <b>${report.noMatch}</b></li>
      <li>Errors: <b>${report.errors}</b></li>
    </ul>
    <p>Backup: <code>${BACKUP_DIR}/${fname}</code></p>` });
  ui.notifications.info(`Button-icons scrub done — ${total} replaced.`);
})();
