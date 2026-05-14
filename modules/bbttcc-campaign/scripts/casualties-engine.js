//
// BBTTCC Casualty Engine v1.0 (Alpha) — Beat-driven
// --------------------------------------------------
// Invoked from bbttcc-campaign executeBeat() via:
//   game.bbttcc.api.casualties.applyFromBeat(beat, ctx, beatCtx)
//
// Stores:
//   Hex:    flags.bbttcc-territory.casualties { total, recent, last }
//   Faction:flags.bbttcc-factions.casualties  { total, recent, last }
//
// Applies (canon mapping v1):
//   Hex: Integration-first; Development drops at Moderate if fragile, always at Major+
//   Faction (attacker): Morale-first; Loyalty at Major+; VP at Catastrophic
//   Darkness: only for extreme circumstances (major+atrocity OR catastrophic)
//
(() => {
  const TAG = "[bbttcc-casualties]";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";

  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  function clone(x) {
    try { return foundry.utils.deepClone(x || {}); } catch { return JSON.parse(JSON.stringify(x || {})); }
  }
  function num(v, d=0) {
    const n = Number(String(v ?? "").replace(/\u2212/g, "-").trim());
    return Number.isFinite(n) ? n : d;
  }
  function clamp(v, a, b) {
    v = num(v, a);
    return Math.max(a, Math.min(b, v));
  }

  function ensureNS() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.casualties ??= {};
  }

  // --- doc resolver (Drawing/Tile UUID) — copied pattern from WME for consistency
  async function resolveHexDoc(uuid) {
    if (!uuid) return null;
    const raw = String(uuid);
    const parts = raw.split(".");
    try {
      if (parts[0] === "Scene" && parts.length >= 4) {
        const sc = (game.scenes && game.scenes.get) ? (game.scenes.get(parts[1]) || null) : null;
        if (sc) {
          if (parts[2] === "Drawing") return (sc.drawings && sc.drawings.get) ? (sc.drawings.get(parts[3]) || null) : null;
          if (parts[2] === "Tile")    return (sc.tiles && sc.tiles.get) ? (sc.tiles.get(parts[3]) || null) : null;
        }
      }
    } catch (_e1) {}
    try {
      if (typeof fromUuid === "function") {
        const doc = await fromUuid(raw);
        if (doc) return doc;
      }
    } catch (_e2) {}
    return null;
  }

  function _splitTags(tagStrOrArr) {
    if (Array.isArray(tagStrOrArr)) {
      return tagStrOrArr.map(s => String(s || "").trim()).filter(Boolean);
    }
    return String(tagStrOrArr || "").split(/\s+/g).map(s => s.trim()).filter(Boolean);
  }

  function _sevToN(v) {
    const s = String(v || "").trim().toLowerCase();
    if (!s) return 0;
    if (s === "minor") return 1;
    if (s === "moderate") return 2;
    if (s === "major") return 3;
    if (s === "catastrophic") return 4;
    // numeric +n / n
    if (s[0] === "+") return clamp(num(s.slice(1), 0), 0, 4);
    return clamp(num(s, 0), 0, 4);
  }

  function _parseCasualtyTags(tags) {
    // Returns { hexN, attN, defN, atrocity }
    const out = { hexN: 0, attN: 0, defN: 0, atrocity: false };
    const list = _splitTags(tags);
    for (let i=0; i<list.length; i++) {
      const t = String(list[i] || "").trim();
      if (!t) continue;
      if (t === "casualties.atrocity" || t === "atrocity") { out.atrocity = true; continue; }

      // casualties.hex:major
      if (t.indexOf("casualties.hex:") === 0) {
        out.hexN = Math.max(out.hexN, _sevToN(t.split(":")[1]));
        continue;
      }
      if (t.indexOf("casualties.attacker:") === 0) {
        out.attN = Math.max(out.attN, _sevToN(t.split(":")[1]));
        continue;
      }
      if (t.indexOf("casualties.defender:") === 0) {
        out.defN = Math.max(out.defN, _sevToN(t.split(":")[1]));
        continue;
      }

      // numeric shorthand
      if (t.indexOf("casualties.hex+") === 0) {
        out.hexN = Math.max(out.hexN, clamp(num(t.slice("casualties.hex+".length), 0), 0, 4));
        continue;
      }
      if (t.indexOf("casualties.attacker+") === 0) {
        out.attN = Math.max(out.attN, clamp(num(t.slice("casualties.attacker+".length), 0), 0, 4));
        continue;
      }
      if (t.indexOf("casualties.defender+") === 0) {
        out.defN = Math.max(out.defN, clamp(num(t.slice("casualties.defender+".length), 0), 0, 4));
        continue;
      }
    }
    return out;
  }

  function _readDevTier(tf) {
    // Support numeric dev tier OR object with tier/value
    const d = tf ? tf.development : null;
    if (typeof d === "number") return { n: clamp(d, 0, 10), shape: "number" };
    if (d && typeof d === "object") {
      const n = (d.tier != null) ? num(d.tier, 0) : (d.value != null) ? num(d.value, 0) : num(d.level, 0);
      return { n: clamp(n, 0, 10), shape: "object", raw: d };
    }
    return { n: 0, shape: "none" };
  }

  function _writeDevTier(tf, nextTier, devMeta) {
    nextTier = clamp(nextTier, 0, 10);
    if (!devMeta || devMeta.shape === "none") {
      tf.development = nextTier;
      return;
    }
    if (devMeta.shape === "number") {
      tf.development = nextTier;
      return;
    }
    const raw = clone(devMeta.raw || {});
    if (raw.tier != null) raw.tier = nextTier;
    else if (raw.value != null) raw.value = nextTier;
    else raw.tier = nextTier;
    tf.development = raw;
  }

  function _readIntegration(tf) {
    // Integration is often numeric; if missing, treat as 0..4 scale (alpha-safe)
    const v = tf ? tf.integration : null;
    if (typeof v === "number") return clamp(v, 0, 10);
    if (v && typeof v === "object") {
      const n = (v.value != null) ? num(v.value, 0) : (v.tier != null) ? num(v.tier, 0) : num(v.level, 0);
      return clamp(n, 0, 10);
    }
    return 0;
  }

  function _writeIntegration(tf, next) {
    // Preserve common shapes when possible
    const cur = tf ? tf.integration : null;
    next = clamp(next, 0, 10);
    if (typeof cur === "number" || cur == null) { tf.integration = next; return; }
    if (cur && typeof cur === "object") {
      const raw = clone(cur);
      if (raw.value != null) raw.value = next;
      else if (raw.tier != null) raw.tier = next;
      else raw.value = next;
      tf.integration = raw;
    } else {
      tf.integration = next;
    }
  }

  function _ownerFactionIdFromHex(doc) {
    try {
      const tf = (doc && doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : null;
      const id = tf ? String(tf.factionId || "").trim() : "";
      return id || null;
    } catch (_e) { return null; }
  }

  function _resolveHexUuidFromCtx(beat, ctx) {
    const a =
      (ctx && (ctx.hexUuid || ctx.hexId || ctx.toHexUuid || ctx.destinationHexUuid || ctx.locationHexUuid)) ||
      (beat && (beat.targetHexUuid || beat.hexUuid || beat.hexId)) ||
      null;
    return a ? String(a).trim() : null;
  }

  function _resolveAttackerFactionId(beat, ctx, beatCtx) {
    return (
      String((ctx && ctx.factionId) || "").trim() ||
      String((beat && beat.factionId) || "").trim() ||
      String((beatCtx && beatCtx.factionId) || "").trim() ||
      null
    );
  }

  // -------------------------
  // Mapping tables (v1 canon)
  // -------------------------
  function _hexDeltasForN(n, integrationBefore, devBefore) {
    // Returns { integDelta, devDrop, noteKey }
    // Canon:
    // - Minor: integ -1
    // - Moderate: integ -1, dev -1 if integ already fragile (<=1)
    // - Major: integ -2, dev -1
    // - Catastrophic: integ -3, dev -2
    if (n <= 0) return null;

    if (n === 1) return { integDelta: -1, devDrop: 0, noteKey: "hex_minor" };
    if (n === 2) return { integDelta: -1, devDrop: (integrationBefore <= 1 ? 1 : 0), noteKey: "hex_moderate" };
    if (n === 3) return { integDelta: -2, devDrop: 1, noteKey: "hex_major" };
    return { integDelta: -3, devDrop: 2, noteKey: "hex_catastrophic" };
  }

  function _factionDeltasForN(n) {
    // Returns { moraleDelta, loyaltyDelta, vpDelta, noteKey }
    if (n <= 0) return null;
    if (n === 1) return { moraleDelta: 0,  loyaltyDelta: 0,  vpDelta: 0,  noteKey: "fac_minor" };
    if (n === 2) return { moraleDelta: -1, loyaltyDelta: 0,  vpDelta: 0,  noteKey: "fac_moderate" };
    if (n === 3) return { moraleDelta: -2, loyaltyDelta: -1, vpDelta: 0,  noteKey: "fac_major" };
    return { moraleDelta: -3, loyaltyDelta: -2, vpDelta: -1, noteKey: "fac_catastrophic" };
  }

  function _darknessDeltaForHex(n, atrocity) {
    // Canon:
    // - Major: +1 only if atrocity tag
    // - Catastrophic: +2 always (and +2 even if not atrocity)
    if (n >= 4) return 2;
    if (n >= 3 && atrocity) return 1;
    return 0;
  }

  // -------------------------
  // Mal receipts
  // -------------------------
  function _malReceipt(kind, n, atrocity) {
    // kind: "hex" | "att" | "def" | "dark"
    const sev = (n === 1) ? "minor" : (n === 2) ? "moderate" : (n === 3) ? "major" : "catastrophic";

    if (kind === "hex") {
      if (sev === "minor") return "The hex bleeds a little. Names disappear from ledgers. Trust drops by a notch.";
      if (sev === "moderate") return "This wasn’t clean. Shops close early. People stop answering doors. Integration buckles.";
      if (sev === "major") return atrocity
        ? "You didn’t just win — you taught them. The hex learns fear as law."
        : "They’ll rebuild, sure. But not the same. The hex takes real damage — and everyone remembers who brought it.";
      return atrocity
        ? "This is not war. This is consumption. The world marks it."
        : "This is how places become warnings. The map still shows a name, but the name lies.";
    }

    if (kind === "att" || kind === "def") {
      if (sev === "minor") return "You paid a little blood for a little ground. Nobody calls it victory yet.";
      if (sev === "moderate") return "The cost shows in the eyes. Morale sags. Command starts lying about numbers.";
      if (sev === "major") return "You can win the hex and still lose the people. Morale cracks. Loyalty follows.";
      return "A generation of losses, spent in a night. The faction survives — but it doesn’t feel immortal anymore.";
    }

    if (kind === "dark") {
      if (n >= 2) return "This is the kind of violence that doesn’t fade. Darkness rises, and it sticks.";
      return "The world flinches. Darkness inches higher.";
    }

    return "";
  }

  function _prettyN(n) {
    if (n === 1) return "Minor";
    if (n === 2) return "Moderate";
    if (n === 3) return "Major";
    if (n >= 4) return "Catastrophic";
    return "None";
  }

  // -------------------------
  // Application
  // -------------------------
  async function applyToHex(opts) {
    opts = opts || {};
    const hexUuid = String(opts.hexUuid || "").trim();
    if (!hexUuid) return { ok: false, reason: "no_hex" };

    const doc = await resolveHexDoc(hexUuid);
    if (!doc || !doc.update) return { ok: false, reason: "hex_not_found" };

    const n = clamp(num(opts.amount, 0), 0, 4);
    if (!n) return { ok: true, applied: false };

    const tf0 = (doc.flags && doc.flags[MOD_T]) ? clone(doc.flags[MOD_T]) : {};
    const tf = clone(tf0);

    // read current
    const integ0 = _readIntegration(tf);
    const devMeta = _readDevTier(tf);
    const dev0 = devMeta.n;

    const del = _hexDeltasForN(n, integ0, dev0);
    if (!del) return { ok: true, applied: false };

    const integ1 = clamp(integ0 + del.integDelta, 0, 10);
    _writeIntegration(tf, integ1);

    const dev1 = clamp(dev0 - Math.max(0, del.devDrop), 0, 10);
    _writeDevTier(tf, dev1, devMeta);

    // casualty bookkeeping
    const c0 = (tf.casualties && typeof tf.casualties === "object") ? clone(tf.casualties) : {};
    const total0 = num(c0.total, 0);
    const recent0 = num(c0.recent, 0);

    const now = Date.now();
    tf.casualties = {
      total: total0 + n,
      recent: recent0 + n,
      last: {
        amount: n,
        ts: now,
        source: String(opts.source || "beat"),
        note: String(opts.note || ""),
        attackerFactionId: opts.attackerFactionId || null,
        defenderFactionId: opts.defenderFactionId || null
      }
    };

    await doc.update({ ["flags."+MOD_T]: tf }, { parent: doc.parent });

    return {
      ok: true,
      applied: true,
      hexUuid,
      integ: { before: integ0, after: integ1, delta: (integ1 - integ0) },
      dev:   { before: dev0,   after: dev1,   delta: (dev1 - dev0) },
      casualties: { amount: n }
    };
  }

  async function applyToFaction(opts) {
    opts = opts || {};
    const factionId = String(opts.factionId || "").trim();
    if (!factionId) return { ok: false, reason: "no_faction" };

    const n = clamp(num(opts.amount, 0), 0, 4);
    if (!n) return { ok: true, applied: false };

    // Track bookkeeping on actor flags (independent of WME).
    // Apply track deltas via WME (canonical).
    const F = game.actors?.get?.(String(factionId).replace(/^Actor\./, "")) || null;
    if (F && F.getFlag && F.setFlag) {
      try {
        const cur = clone(F.getFlag(MOD_F, "casualties") || {});
        const now = Date.now();
        const next = {
          total: num(cur.total, 0) + n,
          recent: num(cur.recent, 0) + n,
          last: {
            amount: n,
            ts: now,
            source: String(opts.source || "beat"),
            note: String(opts.note || ""),
            targetHexUuid: opts.targetHexUuid || null
          }
        };
        await F.setFlag(MOD_F, "casualties", next);
      } catch (_eB) {}
    }

    return { ok: true, applied: true, factionId, casualties: { amount: n } };
  }

  async function _applyFactionTrackDeltasViaWME(factionId, deltas, warLog, beatCtxExtra) {
    try {
      const wm = game.bbttcc?.api?.worldMutation;
      if (!wm || typeof wm.applyWorldEffects !== "function") return false;

      // We use a "synthetic" worldEffects input (supported by WME).
      const input = {
        factionEffects: [
          Object.assign({ factionId: factionId }, deltas || {})
        ],
        warLog: warLog || ""
      };

      const ctx = Object.assign({}, beatCtxExtra || {}, {
        source: (beatCtxExtra && beatCtxExtra.source) ? beatCtxExtra.source : "bbttcc-campaign",
        factionId: factionId,
        logType: "casualties"
      });

      await wm.applyWorldEffects(input, ctx);
      return true;
    } catch (e) {
      warn("applyFactionTrackDeltasViaWME failed", factionId, e);
      return false;
    }
  }

  async function applyFromBeat(beat, ctx, beatCtx) {
    try {
      const tags = _splitTags(beat?.tags);
      if (!tags.length) return { ok: true, applied: false, reason: "no_tags" };

      const parsed = _parseCasualtyTags(tags);
      if (!parsed.hexN && !parsed.attN && !parsed.defN && !parsed.atrocity) {
        return { ok: true, applied: false, reason: "no_casualty_tags" };
      }

      const hexUuid = _resolveHexUuidFromCtx(beat, ctx);
      const attackerFactionId = _resolveAttackerFactionId(beat, ctx, beatCtx);

      let hexDoc = null;
      let defenderFactionId = null;

      if (hexUuid) {
        hexDoc = await resolveHexDoc(hexUuid);
        defenderFactionId = hexDoc ? _ownerFactionIdFromHex(hexDoc) : null;
      }

      // --- HEX APPLY
      let hexRes = null;
      if (parsed.hexN && hexUuid) {
        hexRes = await applyToHex({
          hexUuid,
          amount: parsed.hexN,
          source: (beatCtx && beatCtx.source) ? beatCtx.source : "beat",
          note: (beatCtx && beatCtx.beatLabel) ? beatCtx.beatLabel : (beat?.label || beat?.id || ""),
          attackerFactionId,
          defenderFactionId
        });
      }

      // --- FACTION BOOKKEEPING
      // Attacker casualties: always apply to attacker (if present)
      let attRes = null;
      if (parsed.attN && attackerFactionId) {
        attRes = await applyToFaction({
          factionId: attackerFactionId,
          amount: parsed.attN,
          source: (beatCtx && beatCtx.source) ? beatCtx.source : "beat",
          note: (beatCtx && beatCtx.beatLabel) ? beatCtx.beatLabel : (beat?.label || beat?.id || ""),
          targetHexUuid: hexUuid || null
        });
      }

      // Defender casualties (optional): apply to defender if present, else skip
      let defRes = null;
      if (parsed.defN && defenderFactionId) {
        defRes = await applyToFaction({
          factionId: defenderFactionId,
          amount: parsed.defN,
          source: (beatCtx && beatCtx.source) ? beatCtx.source : "beat",
          note: (beatCtx && beatCtx.beatLabel) ? beatCtx.beatLabel : (beat?.label || beat?.id || ""),
          targetHexUuid: hexUuid || null
        });
      }

      // --- TRACK DELTAS (via WME)
      // Attacker deltas
      if (parsed.attN && attackerFactionId) {
        const d = _factionDeltasForN(parsed.attN);
        if (d) {
          const line =
            "Casualties (Aggressor): " + _prettyN(parsed.attN) +
            (hexUuid ? (" • Hex " + String(hexUuid)) : "") +
            " — " + _malReceipt("att", parsed.attN, false);

          await _applyFactionTrackDeltasViaWME(attackerFactionId, {
            moraleDelta: d.moraleDelta,
            loyaltyDelta: d.loyaltyDelta,
            vpDelta: d.vpDelta,
            darknessDelta: 0
          }, line, beatCtx);
        }
      }

      // Defender deltas (if authored)
      if (parsed.defN && defenderFactionId) {
        const d2 = _factionDeltasForN(parsed.defN);
        if (d2) {
          const line2 =
            "Casualties (Defender): " + _prettyN(parsed.defN) +
            (hexUuid ? (" • Hex " + String(hexUuid)) : "") +
            " — " + _malReceipt("def", parsed.defN, false);

          await _applyFactionTrackDeltasViaWME(defenderFactionId, {
            moraleDelta: d2.moraleDelta,
            loyaltyDelta: d2.loyaltyDelta,
            vpDelta: d2.vpDelta,
            darknessDelta: 0
          }, line2, beatCtx);
        }
      }

      // Hex receipt: log to defender (owner) if present; else to attacker; else nowhere.
      if (parsed.hexN && hexRes && (defenderFactionId || attackerFactionId)) {
        const target = defenderFactionId || attackerFactionId;
        const receipt =
          "Hex Casualties: " + _prettyN(parsed.hexN) +
          " — " + _malReceipt("hex", parsed.hexN, parsed.atrocity) +
          " (Integration " + num(hexRes.integ.before, 0) + "→" + num(hexRes.integ.after, 0) +
          ", Dev " + num(hexRes.dev.before, 0) + "→" + num(hexRes.dev.after, 0) + ").";

        await _applyFactionTrackDeltasViaWME(target, {
          moraleDelta: 0, loyaltyDelta: 0, vpDelta: 0, darknessDelta: 0
        }, receipt, beatCtx);
      }

      // Darkness for extreme circumstances (major+atrocity OR catastrophic)
      const dk = _darknessDeltaForHex(parsed.hexN, parsed.atrocity);
      if (dk && (defenderFactionId || attackerFactionId)) {
        const targetD = defenderFactionId || attackerFactionId;
        const dline =
          "Darkness: +" + String(dk) + " — " + _malReceipt("dark", dk, false) +
          (parsed.atrocity ? " (Atrocity)" : " (Catastrophe)");

        await _applyFactionTrackDeltasViaWME(targetD, {
          moraleDelta: 0, loyaltyDelta: 0, vpDelta: 0, darknessDelta: dk
        }, dline, beatCtx);
      }

      return {
        ok: true,
        applied: true,
        parsed,
        hexUuid: hexUuid || null,
        attackerFactionId: attackerFactionId || null,
        defenderFactionId: defenderFactionId || null
      };
    } catch (e) {
      warn("applyFromBeat failed", e);
      return { ok: false, error: true };
    }
  }

  function installAPI() {
    ensureNS();
    game.bbttcc.api.casualties = {
      applyFromBeat,
      applyToHex,
      applyToFaction,
      parseTags: _parseCasualtyTags
    };
    log("Casualty API installed:", Object.keys(game.bbttcc.api.casualties || {}));
  }

  Hooks.once("ready", installAPI);
  try { if (game && game.ready) installAPI(); } catch (_e) {}
})();
