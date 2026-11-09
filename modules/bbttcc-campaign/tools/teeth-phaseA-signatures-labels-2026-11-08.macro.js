/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * teeth-phaseA-signatures-labels-2026-11-08.macro.js — Manifestation Engine teeth, Phase A, cluster C8
 * (Signatures rise by cap, not by an unearned tier bump — P29; honest labels — P36; Stewards never carry a fixed DC — P02 data).
 * Dave's ruling (2026-11-08, P29): "The Sig should be Extra … without raising the Tier like a regular manifestation. Any
 * manifestation someone has right now can be reworked when they hit the right level to add features and bump the tier."
 *
 * Until 11-08 every tier-up wrote each Signature's manifestation.tier up to the steward's new tier (ft-progression
 * levelSignatureManifestations) without changing anything the item did — an unearned bump (higher DC, higher Clarity,
 * higher misfire column). The level ledger recorded each bump as flags.fourththing.levelGrants.<L>.signatureBumps =
 * [{ id, from }]. The bump is gone from the code; this macro finds the Signatures it already raised.
 *
 * Covers every world actor's items (ledgers live on actors). World items and unlinked tokens are scanned for the DC and
 * flavor sections. Compendium packs are NOT touched.
 *
 *   DRY RUN by default (report only).
 *   globalThis.__teethPhaseASignaturesLabelsWrite = true →
 *     · sigRestore: a ledgered Signature whose tier is above the LOWEST "from" its ledger recorded goes back to that tier
 *       (the tier it had before the first unearned bump). This is the ONE write that changes a tier.
 *     · stewardDc: an item owned by a non-foe actor with resolution.saveDcMode or appliedStates.saveDcMode "fixed" →
 *       "cast-dc" (ftSaveDCFor already ignored the fixed DC for them; the data now says so). Tier pinned.
 *     · flavor: a thermal / chemical damageRoll.flavor or damagePart flavor stored as a non-key ("fire", "ice",
 *       "caustic"…) → its key (hot / cold / base); an unknown flavor on those types → "" (type-only). Tier pinned.
 *       (The game already reads them through the same alias, so this is cosmetic.)
 *
 * Report sections (always filled):
 *   sigRestore      — Signatures a ledger shows were bumped, current tier → restore tier
 *   sigReview       — of those, items whose magnitude now scores ABOVE the restore tier (the player may have grown it
 *                     since; restored anyway — check by hand, the Engine re-scores it on its next save)
 *   sigUnledgered   — Signatures whose tier is above what their magnitude scores and no ledger covers them (bumps from
 *                     before the 2026-09-08 ledger). Report only — fix by hand or open in the Engine and save.
 *   sigOverCap      — actors with more Signatures than slots (the sheet now shows "+N over cap")
 *   stewardDc       — non-foe-owned items storing a fixed save DC
 *   flavor          — stored flavors that alias
 *   healParts       — powers whose heal roll now includes their extra dice (Additional healing dice)
 *   reactionTrigger — Reaction manifestations with a Trigger (now shown on the cast card)
 *   fallout         — manifestations with Fallout text (now printed in the misfire box)
 * Idempotent.
 */
(async () => {
  const WRITE = globalThis.__teethPhaseASignaturesLabelsWrite === true;
  const report = { WRITE, world: game.world?.id, sigRestore: [], sigReview: [], sigUnledgered: [], sigOverCap: [],
    stewardDc: [], flavor: [], healParts: [], reactionTrigger: [], fallout: [], errors: [], scanned: 0 };
  const isFoe = game.fourththing?.isFoeActor ?? ((a) => a?.type === "npc");
  const score = game.fourththing?.manifestation?.magnitudeTier ?? null;
  const tierOf = (it) => Math.max(1, Math.min(4, Number(it._source?.system?.manifestation?.tier ?? it.system?.manifestation?.tier) || 1));
  const FLAVORS = {
    thermal:  { hot: "hot", fire: "hot", flame: "hot", flames: "hot", heat: "hot", burn: "hot", burning: "hot", scald: "hot",
                cold: "cold", ice: "cold", frost: "cold", freeze: "cold", freezing: "cold", chill: "cold" },
    chemical: { acid: "acid", acidic: "acid", corrosive: "acid", base: "base", alkaline: "base", caustic: "base", lye: "base" }
  };
  const aliasFlavor = (type, flavor) => {
    const t = String(type ?? "").toLowerCase(), raw = String(flavor ?? "").trim();
    if (!raw || !FLAVORS[t]) return raw;
    return FLAVORS[t][raw.toLowerCase()] ?? "";
  };
  const scored = (it) => {
    if (!score) return null;
    // The owning actor rides as the 3rd arg (fix round 2026-11-08, S6): toObject() has no parent, so a fixed DC would
    // score as unowned. A null score (scoring error) is skipped by every reader below.
    try { return score(it.toObject(), it.type === "weapon" ? "weapon" : "power", it.parent ?? null); } catch (_e) { return null; }
  };
  const stewardTier = (a) => {
    const lvl = Number(a.system?.details?.level ?? 1) || 1;
    return lvl >= 16 ? 4 : lvl >= 11 ? 3 : lvl >= 6 ? 2 : 1;
  };

  // ── Signatures (actors only) ───────────────────────────────────────────────
  for (const a of game.actors.contents) {
    const sigs = a.items.contents.filter(i => i.system?.manifestation?.isSignature === true);
    if (!sigs.length) continue;
    const cap = stewardTier(a);
    if (sigs.length > cap) report.sigOverCap.push(`${a.name}: ${sigs.length} Signatures, ${cap} slot(s) — ${sigs.map(i => i.name).join(", ")}`);
    const grants = a.flags?.fourththing?.levelGrants ?? {};
    const lowestFrom = new Map();
    for (const g of Object.values(grants)) {
      for (const b of (Array.isArray(g?.signatureBumps) ? g.signatureBumps : [])) {
        const from = Math.max(1, Math.min(4, Number(b?.from) || 1));
        if (!b?.id) continue;
        lowestFrom.set(b.id, Math.min(lowestFrom.get(b.id) ?? 4, from));
      }
    }
    for (const it of sigs) {
      const cur = tierOf(it);
      const label = `${a.name}: ${it.name} [${it.type}] (${it.uuid})`;
      const sc = scored(it);
      if (lowestFrom.has(it.id)) {
        const to = lowestFrom.get(it.id);
        if (cur <= to) continue;
        report.sigRestore.push(`${label} — T${cur} → T${to}`);
        if (sc != null && sc > to) report.sigReview.push(`${label} — scores T${sc} now, restoring to T${to}`);
        if (WRITE) {
          try { await it.update({ "system.manifestation.tier": to }); }
          catch (e) { report.errors.push(`${label}: ${e.message}`); }
        }
      } else if (sc != null && cur > sc) {
        report.sigUnledgered.push(`${label} — stored T${cur}, scores T${sc} (no ledger entry)`);
      }
    }
  }

  // ── DC / flavor / label reports (world items, actor items, unlinked token items) ─────────────────────────────
  async function checkItem(it, where, owner) {
    if (it.type !== "power" && it.type !== "weapon") return;
    const src = it._source?.system ?? {};
    const mf = src.manifestation;
    if (!mf || typeof mf !== "object") return;
    report.scanned++;
    const label = `${where}: ${it.name} [${it.type}] (${it.uuid})`;
    const u = {};
    // P02 — a Steward never carries a fixed DC.
    if (owner && !isFoe(owner)) {
      const fixed = [];
      if (mf.resolution?.saveDcMode && mf.resolution.saveDcMode !== "cast-dc") { fixed.push(`resolution ${mf.resolution.saveDcMode}${mf.resolution.saveDcFixed ? ` ${mf.resolution.saveDcFixed}` : ""}`); u["system.manifestation.resolution.saveDcMode"] = "cast-dc"; }
      if (mf.appliedStates?.saveDcMode && mf.appliedStates.saveDcMode !== "cast-dc") { fixed.push(`appliedStates ${mf.appliedStates.saveDcMode}${mf.appliedStates.saveDcFixed ? ` ${mf.appliedStates.saveDcFixed}` : ""}`); u["system.manifestation.appliedStates.saveDcMode"] = "cast-dc"; }
      if (fixed.length) report.stewardDc.push(`${label} — ${fixed.join(" · ")}`);
    }
    // P36 — flavors on constrained types.
    const dr = src.damageRoll;
    if (dr && typeof dr === "object" && dr.flavor) {
      const t = String(dr.type ?? "").toLowerCase() === "energy" ? "" : dr.type;
      const al = aliasFlavor(t, dr.flavor);
      if (t && al !== String(dr.flavor)) { report.flavor.push(`${label} — damageRoll ${dr.type}:${dr.flavor} → ${al || "(type only)"}`); u["system.damageRoll.flavor"] = al; }
    }
    const partsRaw = src.damageParts;
    const parts = Array.isArray(partsRaw) ? partsRaw : (partsRaw && typeof partsRaw === "object" ? Object.values(partsRaw) : []);
    let partsChanged = false;
    const newParts = parts.map((p, i) => {
      if (!p || typeof p !== "object" || !p.flavor) return p;
      const al = aliasFlavor(p.type, p.flavor);
      if (al === String(p.flavor)) return p;
      partsChanged = true;
      report.flavor.push(`${label} — part ${i + 1} ${p.type}:${p.flavor} → ${al || "(type only)"}`);
      return { ...p, flavor: al };
    });
    if (partsChanged) u["system.damageParts"] = newParts;
    // Report-only label changes.
    if (dr?.op === "heal" && parts.some(p => String(p?.formula ?? "").trim())) report.healParts.push(`${label} — heal ${dr.number ?? "?"}${dr.die ?? ""} + ${parts.map(p => p?.formula).filter(Boolean).join(" + ")}`);
    if (mf.activation?.type === "reaction" && String(mf.triggerText ?? "").trim()) report.reactionTrigger.push(`${label} — "${String(mf.triggerText).trim().slice(0, 80)}"`);
    if (String(mf.riskText ?? "").trim()) report.fallout.push(`${label} — "${String(mf.riskText).trim().slice(0, 80)}"`);
    if (!WRITE || !Object.keys(u).length) return;
    u["system.manifestation.tier"] = tierOf(it);   // pin: resolution / damage are magnitude paths — no re-score here
    try { await it.update(u); } catch (e) { report.errors.push(`${label}: ${e.message}`); }
  }

  for (const it of game.items.contents) await checkItem(it, "world", null);
  for (const a of game.actors.contents) for (const it of a.items.contents) await checkItem(it, a.name, a);
  for (const sc of game.scenes.contents) {
    for (const tok of sc.tokens.contents) {
      if (tok.actorLink || !tok.actor) continue;
      for (const it of tok.actor.items.contents) {
        if (!tok.delta?.items?.get?.(it.id)) continue;   // base items were scanned on the world actor
        await checkItem(it, `${sc.name} / ${tok.name}`, tok.actor);
      }
    }
  }

  const summary = `teeth Phase A signatures + labels — ${WRITE ? "WRITTEN" : "DRY RUN"}: Signatures to restore ${report.sigRestore.length}`
    + ` (review ${report.sigReview.length}, unledgered ${report.sigUnledgered.length}, over cap ${report.sigOverCap.length}); `
    + `Steward fixed DCs ${report.stewardDc.length}; flavors ${report.flavor.length}; scanned ${report.scanned}; errors ${report.errors.length}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
