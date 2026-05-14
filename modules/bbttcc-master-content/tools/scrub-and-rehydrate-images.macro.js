/**
 * scrub-and-rehydrate-images.macro.js  (v2 — aggressive)
 *
 * v1 left 549 items unmatched because the threshold was too strict and the
 * bucket-first short-circuit bailed before considering global candidates.
 * v2: lower threshold, partial-token matching, stop-word stripping, and a
 * "rotate-from-bucket" fallback so anything that didn't match still gets a
 * stylistically-correct image (per user: anything > nothing).
 *
 * Idempotent — already-curated items skip themselves. Saves rollback JSON to
 * /Data/backups/ before any write. Set APPLY=false for dry run.
 */

(async () => {
  const APPLY      = true;
  const ART_ROOT   = "art/bbttcc/GOTTGAIT";
  const BACKUP_DIR = "backups";
  const SCORE_MIN  = 0.18;     // was 0.32 — looser
  const ROTATE_FALLBACK = true; // pick a bucket-appropriate image when no name match

  const BUCKETS_FOR = {
    Item: [
      "Items and Gear",
      "BBTTCC_Character_Options",
      "BBTTCC Button Icons",
      "ArtForBBTTCCModule",
    ],
    Actor: [
      "GOTTGAIT Token",
      "GOTTGAIT Local Factions",
      "BBTTCC Faction Tokens",
      "BBTTCC_Character_Options",
    ],
  };

  // ---------- helpers ----------
  const IMG_RE = /\.(png|jpe?g|webp|svg|gif)$/i;
  const STOP = new Set([
    "the","of","a","an","and","or","to","from","with","for","into","onto",
    "your","you","at","in","on","by","is","be","as","this","that","these","those",
    "path","paths","feat","feats","trait","traits","feature","features",
    "doctrine","doctrines","ability","abilities","power","powers",
    "rfi","bbttcc","ft","fourththing","badeden","bad","eden",
    "lvl","level","tier","mark","mk","item","items","gear","button","icon",
  ]);

  async function walkImages(root) {
    const out = [];
    const queue = [root];
    while (queue.length) {
      const dir = queue.shift();
      let res;
      try { res = await FilePicker.browse("data", dir); }
      catch (e) { console.warn(`[rehydrate] browse failed: ${dir}`, e); continue; }
      for (const sub of res.dirs) queue.push(sub);
      for (const f of res.files) if (IMG_RE.test(f)) out.push(f);
    }
    return out;
  }

  function bucketOf(path) {
    const rest = path.slice(ART_ROOT.length + 1);
    return rest.split("/")[0];
  }

  function tokens(s) {
    if (!s) return [];
    return decodeURIComponent(s)
      .toLowerCase()
      .replace(/^.*\//, "")
      .replace(/\.[^.]+$/, "")
      .replace(/^bbttcc[_\-\s]*/g, "")
      .replace(/^button[_\-\s]*icon[_\-\s]*/g, "")
      .replace(/^items?[_\-\s]*/g, "")
      .replace(/[_\-\s().,:;'"\[\]\/]+/g, " ")
      .replace(/\b\d+\b/g, " ")
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP.has(t));
  }

  // partial-token similarity: any token in A whose 4+ char prefix matches a token in B
  function partialMatches(aTokens, bSet) {
    let m = 0;
    for (const t of aTokens) {
      if (bSet.has(t)) { m++; continue; }
      // prefix / substring crossover (len >= 4 to avoid noise)
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

    // partial-match coverage of the item tokens
    const partial = partialMatches(itemTokens, b) / itemTokens.length;

    const itemFull = itemTokens.join("");
    const artFull  = artTokens.join("");
    let bonus = 0;
    if (itemFull.length >= 4 && artFull.includes(itemFull)) bonus = 0.40;
    else if (artFull.length >= 4 && itemFull.includes(artFull)) bonus = 0.25;
    if (itemTokens[0] && b.has(itemTokens[0])) bonus += 0.08;
    if (itemTokens[itemTokens.length - 1] && b.has(itemTokens[itemTokens.length - 1])) bonus += 0.05;

    return Math.min(1, 0.55 * jaccard + 0.35 * partial + bonus);
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
    } catch { /* ignore */ }
    _dirCache.set(dir, files);
    return files;
  }

  async function fileExists(path) {
    if (!path) return false;
    if (/^https?:/i.test(path)) return true;
    const decoded = decodeURIComponent(path);
    const slash = decoded.lastIndexOf("/");
    if (slash < 0) return false;
    const dir  = decoded.slice(0, slash);
    const files = await listDir(dir);
    if (files.has(decoded)) return true;
    // browse may return non-decoded entries; double-check raw
    const rawFiles = _dirCache.get(dir);
    return rawFiles?.has(path) ?? false;
  }

  // ---------- 1. Index art ----------
  ui.notifications.info(`Indexing curated art under ${ART_ROOT} …`);
  const art = await walkImages(ART_ROOT);
  if (!art.length) { ui.notifications.error(`No images under ${ART_ROOT} — abort.`); return; }
  const ART_INDEX = art.map(p => ({ path: p, bucket: bucketOf(p), tokens: tokens(p) }));
  ui.notifications.info(`Indexed ${ART_INDEX.length} curated images.`);

  // Bucket → array, for fallback rotation
  const BY_BUCKET = {};
  for (const a of ART_INDEX) (BY_BUCKET[a.bucket] ??= []).push(a);
  const rotateCursor = {}; // bucket → next-index for rotation

  // ---------- 2. Pick best art ----------
  function bestNameMatch(doc) {
    const docType  = doc.documentName;
    const buckets  = BUCKETS_FOR[docType] ?? [];
    const bucketSet = new Set(buckets);
    const itemTokens = tokens(doc.name);
    if (!itemTokens.length) return null;

    let best = { score: 0, path: null, bucket: null };
    for (const a of ART_INDEX) {
      let s = score(itemTokens, a.tokens);
      if (bucketSet.has(a.bucket)) s += 0.04;       // small same-type bias
      if (s > best.score) best = { score: s, path: a.path, bucket: a.bucket };
    }
    return best.score >= SCORE_MIN ? best : null;
  }

  function rotateFallback(doc) {
    const docType = doc.documentName;
    const buckets = BUCKETS_FOR[docType] ?? Object.keys(BY_BUCKET);
    for (const bucket of buckets) {
      const pool = BY_BUCKET[bucket];
      if (!pool || !pool.length) continue;
      const i = (rotateCursor[bucket] ?? 0) % pool.length;
      rotateCursor[bucket] = i + 1;
      return { score: 0, path: pool[i].path, bucket, fallback: true };
    }
    return null;
  }

  // ---------- 3. Walk packs ----------
  const TARGET_RE = /^(?:bbttcc|fourththing|bad-eden)/i;
  const packs = game.packs.filter(p => TARGET_RE.test(p.collection));
  ui.notifications.info(`Scanning ${packs.length} packs …`);

  const report = {
    indexedArt: ART_INDEX.length, packs: packs.length,
    scanned: 0, skippedAlreadyGood: 0,
    replacedGenericNamed: 0, replacedGenericFallback: 0,
    replacedBrokenNamed: 0, replacedBrokenFallback: 0,
    noMatch: 0, errors: 0,
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
      console.warn(`[rehydrate] could not load ${id}`, e);
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
      else if (img) {
        // Check existence for ANY local path, not just art/. Catches broken
        // links under worlds/, modules/, systems/, anywhere under Data/.
        const looksLocal = !/^https?:/i.test(img);
        if (looksLocal) {
          const ok = await fileExists(img);
          if (!ok) reason = "broken";
        }
      } else { reason = "generic"; }
      if (!reason) { report.skippedAlreadyGood++; continue; }

      let match = bestNameMatch(doc);
      let fallback = false;
      if (!match && ROTATE_FALLBACK) { match = rotateFallback(doc); fallback = !!match; }
      if (!match) { report.noMatch++; pr.noMatch++; continue; }

      backup.push({
        uuid: doc.uuid, name: doc.name, type: doc.documentName,
        oldImg: img, newImg: match.path,
        score: Number((match.score ?? 0).toFixed(3)),
        bucket: match.bucket, reason, fallback,
      });

      if (APPLY) {
        try { await doc.update({ img: match.path }); }
        catch (e) {
          console.warn(`[rehydrate] update failed for ${doc.uuid}`, e);
          report.errors++; continue;
        }
      }
      if (fallback) pr.fallback++; else pr.named++;
      if (reason === "generic") {
        if (fallback) report.replacedGenericFallback++; else report.replacedGenericNamed++;
      } else {
        if (fallback) report.replacedBrokenFallback++; else report.replacedBrokenNamed++;
      }
    }

    if (wasLocked) { try { await pack.configure({ locked: true }); } catch {} }
    report.byPack[id] = pr;
  }

  // ---------- 4. Backup + chat ----------
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fname = `image-rehydrate-${ts}.json`;
  const payload = { generatedAt: ts, apply: APPLY, scoreMin: SCORE_MIN, rotateFallback: ROTATE_FALLBACK, report, replacements: backup };

  try {
    try { await FilePicker.browse("data", BACKUP_DIR); }
    catch { await FilePicker.createDirectory("data", BACKUP_DIR); }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const file = new File([blob], fname, { type: "application/json" });
    await FilePicker.upload("data", BACKUP_DIR, file, {}, { notify: false });
  } catch (e) {
    console.error("[rehydrate] backup write failed — payload below", e);
    console.log(payload);
  }

  console.log("[rehydrate] report", report);
  console.log("[rehydrate] backup", backup);

  const totalReplaced = report.replacedGenericNamed + report.replacedGenericFallback
                      + report.replacedBrokenNamed + report.replacedBrokenFallback;
  const summary = `
    <h3>${APPLY ? "Image Rehydrate v2" : "Image Rehydrate v2 (DRY RUN)"}</h3>
    <ul>
      <li>Curated art indexed: <b>${report.indexedArt}</b></li>
      <li>Packs scanned: <b>${report.packs}</b></li>
      <li>Items/Actors scanned: <b>${report.scanned}</b></li>
      <li>Already-good (skipped): <b>${report.skippedAlreadyGood}</b></li>
      <li>Generic → named match: <b>${report.replacedGenericNamed}</b></li>
      <li>Generic → bucket fallback: <b>${report.replacedGenericFallback}</b></li>
      <li>Broken → named match: <b>${report.replacedBrokenNamed}</b></li>
      <li>Broken → bucket fallback: <b>${report.replacedBrokenFallback}</b></li>
      <li>Total replaced: <b>${totalReplaced}</b></li>
      <li>No match (no fallback bucket either): <b>${report.noMatch}</b></li>
      <li>Errors: <b>${report.errors}</b></li>
    </ul>
    <p>Backup: <code>${BACKUP_DIR}/${fname}</code></p>
    <p>Per-pack table in F12 console.</p>`;

  ChatMessage.create({ whisper: [game.user.id], content: summary });
  ui.notifications.info(`Rehydrate v2 done — replaced ${totalReplaced}, no-match ${report.noMatch}.`);
})();
