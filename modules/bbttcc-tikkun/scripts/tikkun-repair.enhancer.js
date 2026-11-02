/* bbttcc-tikkun/scripts/tikkun-repair.enhancer.js
 *
 * Phase D of B3 (project_tikkun_revisit_plan_2026_05_09.md).
 *
 * Spark Repair workflow. Corrupted sparks (Phase C flips them) need to be
 * cleansed before they're eligible for re-deposit (Phase E). Repair is a
 * faction-level activity that combines:
 *   • Materials gathered from hex resource nodes (Phase A authored the
 *     repair recipe per spark — single-mat v1; B10 multi-mat later).
 *   • OP cost from the faction's bank (per recipe pool + amount).
 *   • A contributor character rolling a 2d10 + skill ritual.
 *
 * Outcomes:
 *   • Full success (roll ≥ DC): spark uncorrupts; eligible for re-deposit.
 *   • Partial (roll == DC-1 to DC-3): mats + marks spent, DC drops 2 for
 *     the next attempt (tracked on spark.repair.attempts).
 *   • Failure (roll ≤ DC-4): mats + marks spent; "ritual debt" entry
 *     stamped on faction warLogs as a narrative hook.
 *
 * Two surfaces:
 *   • openRepairLedger(factionId) — list of all corrupted sparks across
 *     faction members, "Begin Repair" buttons per row.
 *   • openRepairRitual({ ownerActor, sparkKey, factionId }) — dialog
 *     with materials + OP check, contributor picker, ritual roll.
 *
 * Hook fired on success: bbttcc:spark:repaired { actor, sparkKey, sparkItem,
 *   factionId, roll, dc }
 */
// Spark data on either system (2026-10-08): RFI keeps it on item.system; dnd5e (bad-eden-5e.sparks, loot items)
// carries the same block at flags.bbttcc-tikkun.spark because dnd5e's data model strips unknown system keys.
const _sparkSys = (it) => (it?.system?.sephirah ? it.system : (it?.flags?.["bbttcc-tikkun"]?.spark ?? it?.system ?? {}));


console.log("[bbttcc-tikkun/repair] LOADED");

(() => {
  const TAG = "[bbttcc-tikkun/repair]";
  const _esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));   // 10-29: player-chosen names into GM cards/dialogs

  // ── Faction OP channels ────────────────────────────────────────────────
  // The NINE channels a faction opBank actually holds (op-engine OP_KEYS).
  // 🪤 The six faculties share some names with these (violence / intrigue), but
  // `soul` and `body` are faculties ONLY, and `siege` is a method tag — no engine
  // path ever credits them to an opBank, so a recipe priced in one of them can
  // never be paid. Guarded below so that reads as a recipe fault, not "have 0".
  const OP_CHANNELS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  function _isOpChannel(pool) {
    const keys = game.bbttcc?.api?.op?.KEYS;
    return (Array.isArray(keys) && keys.length ? keys : OP_CHANNELS).includes(String(pool || ""));
  }
  const _badPoolMsg = (pool, sparkName) =>
    `"${pool}" is not a faction OP channel — the repair recipe on ${sparkName} cannot be paid. Fix the spark's repair.opCost.pool (owner ruling), then reload the sparks pack.`;

  // ── Faction-member scanning ────────────────────────────────────────────
  function _getFactionMembers(factionId) {
    if (!factionId) return [];
    const out = [];
    for (const a of game.actors ?? []) {
      if (a.type !== "character") continue;
      const fid = a.getFlag?.("bbttcc-factions", "factionId");
      if (fid === factionId) out.push(a);
    }
    return out;
  }

  function _factionFromActor(actor) {
    const id = actor?.getFlag?.("bbttcc-factions", "factionId");
    return id ? game.actors?.get(id) ?? null : null;
  }

  // Resolve a spark item from either its stamped UUID OR its key (which
  // matches the pack item's `flags.bbttcc-tikkun.identifier`). Older
  // gathered sparks may not have sparkUuid stamped — falling back on key
  // means the ledger and ritual dialog still find the recipe.
  async function _resolveSparkSafely(spark, sparkKey) {
    const api = game.bbttcc?.api?.tikkun;
    if (typeof api?.resolveSparkItem !== "function") return null;
    if (spark?.sparkUuid) {
      const byUuid = await api.resolveSparkItem(spark.sparkUuid).catch(() => null);
      if (byUuid) return byUuid;
    }
    const keyCandidate = spark?.key || sparkKey;
    if (keyCandidate) {
      const byKey = await api.resolveSparkItem(keyCandidate).catch(() => null);
      if (byKey) return byKey;
    }
    return null;
  }

  // Scan all faction-affiliated character actors for corrupted sparks.
  // Returns array of { actor, sparkKey, spark, item }.
  async function _scanCorruptedSparks(factionId) {
    const members = _getFactionMembers(factionId);
    const out = [];
    for (const a of members) {
      const map = a.getFlag?.("bbttcc-tikkun", "sparks") || {};
      for (const [k, s] of Object.entries(map)) {
        if (!s?.corrupted) continue;
        const item = await _resolveSparkSafely(s, k);
        out.push({ actor: a, sparkKey: k, spark: s, item });
      }
    }
    return out;
  }

  // ── Material inventory scan ────────────────────────────────────────────
  // Returns { available: number, stockpile: number, holders: [{ actor, item, charges }] }.
  // Charges represent stack size on individual items (per RFI item schema).
  // The faction material STOCKPILE counts too — harvest delivers there by
  // default since 2026-09-21, so scanning only member pockets read "have 0".
  function _stockApi() { return game.bbttcc?.api?.factions?.stockpile ?? null; }
  function _scanMaterialAcrossFaction(factionId, materialKey) {
    const out = { available: 0, stockpile: 0, holders: [] };
    if (!materialKey) return out;
    try {
      const st = _stockApi();
      const F = factionId ? game.actors?.get(factionId) : null;
      if (st?.qty && F) out.stockpile = Math.max(0, Number(st.qty(F, materialKey)) || 0);
    } catch (_e) { out.stockpile = 0; }
    out.available += out.stockpile;
    for (const a of _getFactionMembers(factionId)) {
      for (const it of a.items ?? []) {
        const mk = it.flags?.fourththing?.rfi?.item?.materialKey;
        if (String(mk).toLowerCase() !== String(materialKey).toLowerCase()) continue;
        const charges = Number(it.flags?.fourththing?.rfi?.item?.charges ?? 1) || 1;
        out.available += charges;
        out.holders.push({ actor: a, item: it, charges });
      }
    }
    return out;
  }

  // Consume `amount` of material across faction holders. Greedy from largest
  // stack down. Decrements `flags.fourththing.rfi.item.charges`; deletes
  // items that hit zero. Returns { consumed: number, drained: [...] }.
  async function _consumeMaterial(factionId, materialKey, amount) {
    const scan = _scanMaterialAcrossFaction(factionId, materialKey);
    if (scan.available < amount) {
      throw new Error(`Insufficient ${materialKey}: have ${scan.available}, need ${amount}.`);
    }
    let remaining = amount;
    const drained = [];
    // Faction stockpile first (where harvest delivers), then member pockets.
    if (scan.stockpile > 0) {
      const take = Math.min(scan.stockpile, remaining);
      const F = game.actors?.get(factionId);
      const r = await _stockApi()?.adjust?.(F, materialKey, -take);
      if (r?.ok === false) throw new Error(`stockpile withdraw failed: ${r.error ?? "unknown"}`);
      drained.push({ actor: F?.name ?? "faction stockpile", item: materialKey, took: take, stockpile: true });
      remaining -= take;
    }
    // Largest stacks first to minimize item deletions
    scan.holders.sort((a, b) => b.charges - a.charges);
    for (const h of scan.holders) {
      if (remaining <= 0) break;
      const take = Math.min(h.charges, remaining);
      const left = h.charges - take;
      if (left <= 0) {
        await h.actor.deleteEmbeddedDocuments("Item", [h.item.id]);
        drained.push({ actor: h.actor.name, item: h.item.name, took: take, deleted: true });
      } else {
        await h.item.update({ "flags.fourththing.rfi.item.charges": left });
        drained.push({ actor: h.actor.name, item: h.item.name, took: take, deleted: false, remaining: left });
      }
      remaining -= take;
    }
    return { consumed: amount, drained };
  }

  // ── Faction OP balance ─────────────────────────────────────────────────
  // Canon OP↔marks ratio from the op engine (never a literal). 0 = unavailable.
  function _marksPerOp() {
    const v = Number(game.bbttcc?.api?.op?.marksPerOp?.() ?? game.bbttcc?.api?.op?.OP_TO_MARKS ?? game.fourththing?.constants?.MARKS_PER_OP);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  function _opBank(factionActor) {
    return foundry.utils.duplicate(factionActor?.flags?.["bbttcc-factions"]?.opBank ?? {});
  }

  function _factionOpAvailable(factionActor, pool) {
    if (!factionActor || !pool) return 0;
    return Number(_opBank(factionActor)[pool]) || 0;
  }

  // 10-29: pays through the op engine (serialized, live-bank check) and returns the
  // marks actually debited, so a later failure can refund exactly that.
  async function _debitOp(factionActor, pool, amount) {
    if (!factionActor || !pool || !amount) return 0;
    if (!_isOpChannel(pool)) throw new Error(`"${pool}" is not a faction OP channel — repair recipe cannot be paid.`);
    const op = game.bbttcc?.api?.op;
    if (typeof op?.commit === "function") {
      const res = await op.commit(factionActor.id, { [pool]: -amount }, { source: "tikkun-repair", reason: "spark repair ritual" });
      if (!res || res.committed === false || res.ok === false) {
        throw new Error(res?.error && !Object.keys(res?.underflow || {}).length ?String(res.error) : `Insufficient ${pool} marks: have ${_factionOpAvailable(factionActor, pool)}, need ${amount}.`);
      }
      return Math.abs(Number(res.finalCost ? (res.finalCost[pool] || 0) : -amount) || 0);
    }
    const bank = _opBank(factionActor);
    const cur = Number(bank[pool]) || 0;
    if (cur < amount) throw new Error(`Insufficient ${pool} marks: have ${cur}, need ${amount}.`);
    bank[pool] = cur - amount;
    await factionActor.update({ "flags.bbttcc-factions.opBank": bank });
    return amount;
  }
  async function _refundOp(factionActor, pool, paid) {
    if (!factionActor || !pool || !(paid > 0)) return;
    const op = game.bbttcc?.api?.op;
    if (typeof op?.commit === "function") {
      await op.commit(factionActor.id, { [pool]: paid }, { source: "tikkun-repair", reason: "spark repair refund", noDiscount: true, allowOvercap: true });
      return;
    }
    const bank = _opBank(factionActor);
    bank[pool] = (Number(bank[pool]) || 0) + paid;
    await factionActor.update({ "flags.bbttcc-factions.opBank": bank });
  }

  // ── Repair ritual dialog ───────────────────────────────────────────────
  async function openRepairRitual({ ownerActor, sparkKey, factionId } = {}) {
    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Spark repair is GM-only for v1.");
      return;
    }
    if (!ownerActor || !sparkKey) {
      ui.notifications?.error?.(`${TAG} openRepairRitual: ownerActor + sparkKey required`);
      return;
    }
    const factionActor = factionId ? game.actors?.get(factionId) : _factionFromActor(ownerActor);
    if (!factionActor) {
      ui.notifications?.error?.(`No faction found for ${ownerActor.name}.`);
      return;
    }

    const sparkMap = ownerActor.getFlag?.("bbttcc-tikkun", "sparks") || {};
    const spark = sparkMap[sparkKey] || Object.values(sparkMap).find(s => s.key === sparkKey);
    if (!spark || !spark.corrupted) {
      ui.notifications?.warn?.("Spark not found or not corrupted.");
      return;
    }

    const sparkItem = await _resolveSparkSafely(spark, sparkKey);
    if (!sparkItem) {
      ui.notifications?.error?.(`Spark item "${spark?.name ?? sparkKey}" not resolvable in the bbttcc-tikkun.sparks pack. Did the load-sparks-pack macro run?`);
      return;
    }

    const recipe = _sparkSys(sparkItem)?.repair ?? {};
    const matKey   = String(recipe.materialKey ?? "").trim();
    const matNeed  = Number(recipe.materialAmount) || 0;
    const opPool   = String(recipe.opCost?.pool ?? "").trim();
    const opNeed   = Number(recipe.opCost?.amount) || 0;   // authored in OP (roll bonus scale)
    // The opBank is denominated in MARKS — convert the authored OP cost at the
    // canon ratio before comparing / debiting (was debiting raw OP as marks).
    const mpo = _marksPerOp();
    if (!mpo) { ui.notifications?.error?.("Repair: OP↔marks ratio unavailable (bbttcc-factions op engine not ready)."); return; }
    const opNeedMarks = opNeed * mpo;
    const baseDC   = Number(recipe.ritualDC) || 15;
    const attempts = Number(spark.repair?.attempts) || 0;
    const dc       = Math.max(8, baseDC - 2 * attempts);

    const matScan = _scanMaterialAcrossFaction(factionActor.id, matKey);
    const opAvail = _factionOpAvailable(factionActor, opPool);
    const matOK   = !matKey  || matScan.available >= matNeed;
    const opPoolBad = !!opPool && opNeed > 0 && !_isOpChannel(opPool);
    const opOK    = !opPool || (!opPoolBad && opAvail >= opNeedMarks);

    // Contributor picker — any faction member.
    const members = _getFactionMembers(factionActor.id);
    const memberOpts = members.map(m => `<option value="${m.id}" ${m.id === ownerActor.id ? "selected" : ""}>${_esc(m.name)}</option>`).join("");

    const sephLabel = _sparkSys(sparkItem)?.sephirah
      ? (game.fourththing?.constants?.SEPHIROTH?.[_sparkSys(sparkItem)?.sephirah]?.label ?? _sparkSys(sparkItem)?.sephirah)
      : "";

    const matLine = matKey
      ? `<li>Material: <b>${matNeed}× ${matKey}</b> &nbsp; <span style="color:${matOK ? "#6fcf97" : "#c03030"}">${matOK ? "✓ available" : `✗ have ${matScan.available}`}</span>${matScan.stockpile ? ` <span style="opacity:0.6">(${matScan.stockpile} in faction stockpile)</span>` : ""}</li>`
      : `<li>Material: <i>(none required)</i></li>`;
    const opLine = opPool
      ? `<li>Cost: <b>${opNeedMarks} ${opPool} marks</b> &nbsp; <span style="color:${opOK ? "#6fcf97" : "#c03030"}">${opOK ? `✓ have ${opAvail}` : (opPoolBad ? `✗ "${opPool}" is not a faction OP channel — recipe cannot be paid` : `✗ have ${opAvail}`)}</span></li>`
      : `<li>Cost: <i>(no marks required)</i></li>`;

    const content = `<div style="font-size:0.86rem">
      <h3 style="margin:0.2rem 0 0.4rem">⚒ Repair: ${_esc(sparkItem.name)}${sephLabel ? ` <span style="opacity:0.6">(${_esc(sephLabel)})</span>` : ""}</h3>
      <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.8">Owner: <b>${_esc(ownerActor.name)}</b> · Faction: <b>${_esc(factionActor.name)}</b> · Attempts so far: <b>${attempts}</b> · DC: <b>${dc}</b>${attempts ? ` <span style="opacity:0.6">(base ${baseDC} − ${2*attempts})</span>` : ""}</p>
      <ul style="margin:0.4rem 0;padding-left:1.2rem">${matLine}${opLine}</ul>
      <hr/>
      <div class="form-group" style="margin:0.4rem 0">
        <label>Ritual contributor</label>
        <select name="contributor">${memberOpts || `<option value="">— no faction members —</option>`}</select>
      </div>
      <div class="form-group" style="margin:0.4rem 0">
        <label>Extra ${opPool ? `${opPool} ` : ""}spend — steps of ${mpo} marks, +1 to roll each (0–3)</label>
        <input type="number" name="extraOp" value="0" min="0" max="3" />
      </div>
      <p style="margin:0.4rem 0 0;font-size:0.74rem;opacity:0.7">Roll: <code>check die + ritual skill + cost steps + extra steps</code> vs DC ${dc}. Margin ≥0 → success; -1 to -3 → partial (DC drops 2 next try); -4 or worse → failure (ritual debt).</p>
    </div>`;

    new Dialog({
      title: `Repair Ritual: ${sparkItem.name}`,
      content,
      buttons: {
        roll: {
          label: "Roll Ritual",
          callback: async (html) => {
            if (opPoolBad) {
              ui.notifications?.error?.(_badPoolMsg(opPool, sparkItem.name));
              return;
            }
            if (!matOK || !opOK) {
              const missing = [];
              if (!matOK) missing.push(`materials: need ${matNeed}× ${matKey}, have ${matScan.available}`);
              if (!opOK)  missing.push(`marks: need ${opNeedMarks} ${opPool}, have ${opAvail}`);
              ui.notifications?.warn?.(`Cannot proceed — ${missing.join(" · ")}.`);
              return;
            }
            const contribId = html.find("[name='contributor']").val();
            let extraOp   = Math.max(0, Math.min(3, Math.floor(Number(html.find("[name='extraOp']").val()) || 0)));
            // Extra steps are SPENT from the recipe pool (they were free before).
            if (extraOp && (!opPool || opPoolBad)) extraOp = 0;
            if (extraOp && opAvail < (opNeed + extraOp) * mpo) {
              ui.notifications?.warn?.(`Cannot proceed — extra spend needs ${(opNeed + extraOp) * mpo} ${opPool} marks in total, have ${opAvail}.`);
              return;
            }
            const contributor = game.actors?.get(contribId);
            if (!contributor) {
              ui.notifications?.warn?.("No contributor selected.");
              return;
            }
            await _executeRepairRoll({
              ownerActor, contributor, sparkKey, spark, sparkItem,
              factionActor, matKey, matNeed, opPool, opNeed, extraOp, dc, baseDC, mpo
            });
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "roll"
    }, { width: 460 }).render(true);
  }

  // ── Ritual roll engine ─────────────────────────────────────────────────
  async function _executeRepairRoll({
    ownerActor, contributor, sparkKey, spark, sparkItem,
    factionActor, matKey, matNeed, opPool, opNeed, extraOp, dc, baseDC, mpo
  }) {
    // Skill bonus: ritual rank + soul attribute. Both pulled from contributor's
    // system.skills/system.attributes (post-AE applied by Foundry prepareData).
    // A CHARACTER check (dice split, 2026-10-08): the system's own die + the ritual skill —
    // RFI = canon 2d10 + ritual rank + soul; dnd5e = d20 + the Religion skill total.
    const dice = game.bbttcc?.dice;
    const sys      = contributor.system?.system ?? contributor.system ?? {};
    const ritSkill = dice ? dice.skillBonus(contributor, "ritual", "soul")
      : Number(sys.skills?.ritual?.value ?? 0) + Number(sys.attributes?.soul?.value ?? 2);
    // The card's breakdown — RFI = the canon pair (ritual rank + soul), dnd5e = the one skill total. (The 2026-10-08
    // dice split dropped ritRank/soulAttr but the card kept reading them → ReferenceError AFTER the spend; 2026-10-11.)
    const breakdown = dice?.isRFI?.() === false ? [["ritual skill", ritSkill]]
      : [["ritual", Number(sys.skills?.ritual?.value ?? 0)], ["soul", Number(sys.attributes?.soul?.value ?? 2)]];
    const totalBonus = ritSkill + extraOp + opNeed; // OP cost itself contributes too

    // 10-29: PAY FIRST, against the live stock and bank (the dialog's matOK/opOK were a
    // snapshot from when it opened). Marks first (op engine, atomic), then material; a
    // material failure refunds the marks. Any failure aborts before the roll — the spark
    // is untouched and nothing is half-charged.
    const liveMap = ownerActor.getFlag("bbttcc-tikkun", "sparks") || {};
    const liveS = liveMap[sparkKey] || Object.values(liveMap).find(x => x.key === sparkKey);
    if (!liveS?.corrupted) { ui.notifications?.warn?.("Repair: the spark is no longer corrupted — nothing paid, nothing rolled."); return; }
    let paidMarks = 0;
    try {
      if (opPool && (opNeed || extraOp)) paidMarks = await _debitOp(factionActor, opPool, (opNeed + extraOp) * mpo);
    } catch (e) {
      ui.notifications?.error?.(`Repair not performed — marks: ${e.message}`);
      return;
    }
    try {
      if (matKey && matNeed) await _consumeMaterial(factionActor.id, matKey, matNeed);
    } catch (e) {
      try { await _refundOp(factionActor, opPool, paidMarks); } catch (eR) { console.warn(TAG, "marks refund failed:", eR); }
      ui.notifications?.error?.(`Repair not performed — material: ${e.message}${paidMarks ? ` (${paidMarks} ${opPool} marks refunded)` : ""}`);
      return;
    }

    const formula  = `${dice?.checkFormula?.() ?? (game.fourththing?.rolls?.checkFormula?.() || "2d10x10")} + ${totalBonus}`;   // the check die
    const roll = await new Roll(formula).roll();
    const total = roll.total;
    const margin = total - dc;
    const outcome = margin >= 0 ? "success" : (margin >= -3 ? "partial" : "failure");

    // Apply outcome to spark state.
    const map = ownerActor.getFlag("bbttcc-tikkun", "sparks") || {};
    const s = map[sparkKey] || Object.values(map).find(x => x.key === sparkKey);
    if (s) {
      s.repair ??= {};
      s.repair.attempts = Number(s.repair.attempts ?? 0) + 1;
      s.history ??= [];
      const note = `Repair ritual: roll ${total} vs DC ${dc} → ${outcome}`;
      s.history.push({ ts: Date.now(), phase: `repair:${outcome}`, note });
      if (s.history.length > 30) s.history = s.history.slice(-30);
      if (outcome === "success") {
        s.corrupted = false;
        s.repair.attempts = 0; // reset for any future re-corruption
      }
      // Also bump the audit counter (Phase D.4 — kept as metric).
      try {
        const sysOwner = ownerActor.system?.system ?? ownerActor.system ?? {};
        const cur = Number(sysOwner.resources?.forgeCharge?.sparksRepaired ?? 0);
        if (outcome === "success") {
          await ownerActor.update({ "system.resources.forgeCharge.sparksRepaired": cur + 1 });
        }
      } catch (_e) { /* schema may not have forgeCharge on all sheets */ }
      await ownerActor.setFlag("bbttcc-tikkun", "sparks", map);
    }

    // Failure → ritual debt entry on faction warLogs.
    if (outcome === "failure") {
      try {
        const logs = factionActor.getFlag("bbttcc-factions", "warLogs") || [];
        logs.push({
          ts: Date.now(),
          type: "ritual-debt",
          source: "tikkun-repair",
          msg: `Failed repair of ${sparkItem.name} (${ownerActor.name}). Roll ${total} vs DC ${dc}. Materials and marks spent; spark remains corrupted; narrative debt incurred.`
        });
        await factionActor.setFlag("bbttcc-factions", "warLogs", logs);
      } catch (e) { console.warn(TAG, "warLog stamp failed:", e); }
    }

    // Chat narration.
    const sephLabel = _sparkSys(sparkItem)?.sephirah
      ? (game.fourththing?.constants?.SEPHIROTH?.[_sparkSys(sparkItem)?.sephirah]?.label ?? _sparkSys(sparkItem)?.sephirah)
      : "";
    const headerColor = outcome === "success" ? "#6fcf97" : (outcome === "partial" ? "#e8c84a" : "#c03030");
    const headerIcon  = outcome === "success" ? "✦" : (outcome === "partial" ? "⊘" : "⚠");
    const headerText  = outcome === "success" ? "Spark Repaired" : (outcome === "partial" ? "Repair Stalled" : "Repair Failed");
    const outcomeLine = outcome === "success"
      ? `<p style="margin:0.3rem 0">The ${_esc(sparkItem.name)} sheds its corruption. Eligible for re-deposit.</p>`
      : outcome === "partial"
      ? `<p style="margin:0.3rem 0">The work bites but does not bind. Materials and marks spent. The ritual scars the spark just enough that the next attempt's DC drops by 2 (now ${Math.max(8, dc - 2)}).</p>`
      : `<p style="margin:0.3rem 0">The ritual breaks against the corruption. Materials and marks spent; the spark remains tainted; <b>${_esc(factionActor.name)}</b> incurs ritual debt — a narrative thread for the GM to weave back.</p>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker?.({ actor: contributor }) ?? {},
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:${headerColor}">${headerIcon} ${headerText}: ${_esc(sparkItem.name)}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem">${_esc(contributor.name)} performs the repair ritual on <b>${_esc(ownerActor.name)}</b>'s ${sephLabel ? `<i>${_esc(sephLabel)}</i> ` : ""}spark.</p>
        <div class="ft-roll-formula">
          <span class="ft-fp" title="check die">${(roll.terms[0]?.results ?? []).map(r => r.result).join(" + ")}</span>
          ${breakdown.map(([t, v]) => `<span class="ft-fp" title="${t}">+${v}</span>`).join("\n          ")}
          ${extraOp ? `<span class="ft-fp" title="extra ${opPool} spend (${extraOp * mpo} marks)">+${extraOp}</span>` : ""}
          <span class="ft-fp" title="${opPool} cost (${opNeed * mpo} marks)">+${opNeed}</span>
        </div>
        <div class="ft-roll-result"><span class="ft-total">${total}</span> <span style="opacity:0.7;font-size:0.78rem">vs DC ${dc}</span></div>
        ${outcomeLine}
      </div>`
    });

    // Hook for downstream listeners on success.
    if (outcome === "success") {
      try {
        Hooks.callAll("bbttcc:spark:repaired", {
          actor: ownerActor, sparkKey, sparkItem, factionId: factionActor.id, roll: total, dc
        });
      } catch (e) { console.warn(TAG, "bbttcc:spark:repaired listeners failed:", e); }
    }
  }

  // ── Repair Ledger app ──────────────────────────────────────────────────
  async function openRepairLedger(factionId) {
    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Repair Ledger is GM-only for v1.");
      return;
    }
    const faction = game.actors?.get(factionId);
    if (!faction) {
      ui.notifications?.error?.(`Faction ${factionId} not found.`);
      return;
    }
    const corrupted = await _scanCorruptedSparks(factionId);
    // 2026-11-02: corrupted HEX sparks (seated in the land) ride alongside the carried ones.
    const hexSparks = await listCorruptedHexSparks({ factionId }).catch(() => []);
    if (!corrupted.length && !hexSparks.length) {
      new Dialog({
        title: `Spark Repair Ledger — ${faction.name}`,
        content: `<p style="margin:0.6rem 0">No corrupted sparks across <b>${_esc(faction.name)}</b>'s members, and none seated in the land. The Great Work is unstained — for now.</p>`,
        buttons: { ok: { label: "Close" } }
      }).render(true);
      return;
    }

    const rows = corrupted.map(({ actor, sparkKey, spark, item }) => {
      const sephLabel = _sparkSys(item)?.sephirah
        ? (game.fourththing?.constants?.SEPHIROTH?.[_sparkSys(item)?.sephirah]?.label ?? _sparkSys(item)?.sephirah)
        : "";
      const recipe = _sparkSys(item)?.repair ?? {};
      const attempts = Number(spark.repair?.attempts) || 0;
      const baseDC   = Number(recipe.ritualDC) || 15;
      const dc       = Math.max(8, baseDC - 2 * attempts);
      const matKey   = recipe.materialKey ?? "—";
      const matNeed  = Number(recipe.materialAmount) || 0;
      const opPool   = recipe.opCost?.pool ?? "—";
      const opNeed   = Number(recipe.opCost?.amount) || 0;
      const matAvail = matKey && matKey !== "—"
        ? _scanMaterialAcrossFaction(factionId, matKey).available
        : Infinity;
      const opAvail  = opPool && opPool !== "—"
        ? _factionOpAvailable(faction, opPool)
        : Infinity;
      const opPoolBad = opPool !== "—" && opNeed > 0 && !_isOpChannel(opPool);
      const opNeedMarks = opNeed * (_marksPerOp() || 0);
      const ready = matAvail >= matNeed && opAvail >= opNeedMarks && !opPoolBad && (!opNeed || opNeedMarks > 0);
      return `
        <tr>
          <td>${_esc(item?.name ?? sparkKey)} ${sephLabel ? `<span style="opacity:0.6;font-size:0.74rem">(${_esc(sephLabel)})</span>` : ""}</td>
          <td>${_esc(actor.name)}</td>
          <td style="text-align:center">${matNeed ? `${matNeed}× ${matKey} <span style="opacity:0.7">(have ${matAvail === Infinity ? "—" : matAvail})</span>` : "—"}</td>
          <td style="text-align:center">${opNeed ? `${opNeedMarks} ${opPool} marks <span style="opacity:0.7">(${opPoolBad ? "⚠ not an OP channel — unpayable" : `have ${opAvail === Infinity ? "—" : opAvail}`})</span>` : "—"}</td>
          <td style="text-align:center">${dc}${attempts ? ` <span style="opacity:0.6">(-${2*attempts})</span>` : ""}</td>
          <td style="text-align:right"><button type="button" class="bbttcc-tk-repair-begin" data-actor-id="${actor.id}" data-spark-key="${sparkKey}" ${ready ? "" : "disabled style=\"opacity:0.5\""}>Begin Repair</button></td>
        </tr>`;
    }).join("");

    const hexRows = (await Promise.all(hexSparks.map(async (h) => {
      const info = await _hexRiteInfo(h.hexUuid, factionId).catch(() => null);
      if (!info?.ok) return "";
      const can = info.ready && info.party.here;
      const label = info.party.here ? "⚒ Repair" : `Ride to ${_esc(info.hexName)}`;
      return `
        <tr>
          <td>${_esc(info.sparkName)} ${info.sephLabel ? `<span style="opacity:0.6;font-size:0.74rem">(${_esc(info.sephLabel)})</span>` : ""}</td>
          <td>⬡ ${_esc(info.hexName)} <span style="opacity:0.6;font-size:0.74rem">(seated)</span></td>
          <td style="text-align:center">${info.matNeed ? `${info.matNeed}× ${_esc(info.matKey)} <span style="opacity:0.7">(have ${info.matScan.available})</span>` : "—"}</td>
          <td style="text-align:center">${info.opNeed ? `${info.opNeedMarks} ${_esc(info.opPool)} marks <span style="opacity:0.7">(${info.opPoolBad ? "⚠ not an OP channel — unpayable" : `have ${info.opAvail}`})</span>` : "—"}</td>
          <td style="text-align:center">${info.dc}${info.attempts ? ` <span style="opacity:0.6">(-${2 * info.attempts})</span>` : ""}</td>
          <td style="text-align:right"><button type="button" class="bbttcc-tk-hex-repair-begin" data-hex-uuid="${_esc(info.hexUuid)}" ${can ? "" : "disabled style=\"opacity:0.5\""} title="${info.party.here ? "" : `The party is at ${_esc(info.party.name || "?")}`}">${label}</button></td>
        </tr>`;
    }))).join("");

    const content = `<div style="font-size:0.84rem;max-height:60vh;overflow-y:auto">
      <p style="margin:0.2rem 0 0.5rem">Corrupted sparks held by <b>${_esc(faction.name)}</b> members${hexSparks.length ? ", and sparks seated in the land the dark has taken (⬡ — repaired on site)" : ""}. Begin Repair opens the ritual dialog.</p>
      <table style="width:100%;border-collapse:collapse" class="bbttcc-tk-ledger">
        <thead><tr style="background:rgba(255,255,255,0.06);text-align:left">
          <th style="padding:0.3rem">Spark</th>
          <th style="padding:0.3rem">Owner</th>
          <th style="padding:0.3rem;text-align:center">Mat</th>
          <th style="padding:0.3rem;text-align:center">Marks</th>
          <th style="padding:0.3rem;text-align:center">DC</th>
          <th style="padding:0.3rem;text-align:right"></th>
        </tr></thead>
        <tbody>${rows}${hexRows}</tbody>
      </table>
    </div>`;

    const dlg = new Dialog({
      title: `Spark Repair Ledger — ${faction.name}`,
      content,
      buttons: { close: { label: "Close" } },
      render: (html) => {
        html.find(".bbttcc-tk-repair-begin").on("click", async (ev) => {
          const btn = ev.currentTarget;
          const actorId = btn.dataset.actorId;
          const sparkKey = btn.dataset.sparkKey;
          const ownerActor = game.actors?.get(actorId);
          if (!ownerActor) return;
          dlg.close();
          await openRepairRitual({ ownerActor, sparkKey, factionId });
        });
        html.find(".bbttcc-tk-hex-repair-begin").on("click", async (ev) => {
          const hexUuid = ev.currentTarget.dataset.hexUuid;
          if (!hexUuid) return;
          dlg.close();
          await openHexRepairRite({ hexUuid, factionId });
        });
      }
    }, { width: 760 }).render(true);
  }

  // ── Hex-spark repair rite (Dave 2026-11-02: "Corrupted Sparks should show on the
  // quest log and an option to repair") ──────────────────────────────────
  // A SEATED spark (flags.bbttcc-territory.spark on a hex Drawing) the Advance's
  // Boiling Point corrupted. Same ritual as a carried spark — the recipe is the
  // spark item's repair block (resolved by key from the sparks pack), paid from
  // the Domain's stockpile/pockets + bank, a contributor's check die + ritual vs
  // DC — with one more gate: the party must stand IN the hex (api.travel.whereIs).
  // Attempts live on the hex flag as spark.repairAttempts (DC −2 each, floor 8);
  // full success calls tikkun.hex.repair (state → dormant, hexRepaired hook) and
  // clears the counter. Player seats relay the whole rite to the GM (gmExec type
  // "tikkun.hexRepairRite"); the handler re-checks everything against live state.
  const TER = "bbttcc-territory";
  const HEX_RITE_RELAY = "tikkun.hexRepairRite";
  const _hexName = (doc) => String(doc?.flags?.[TER]?.name || doc?.text || "").replace(/\s+/g, " ").trim() || "that hex";
  const _sephLabelOf = (seph) => seph
    ? String(game.fourththing?.constants?.SEPHIROTH?.[seph]?.label ?? (seph.charAt(0).toUpperCase() + seph.slice(1)))
    : "";
  function _partyAt(factionId, hexUuid) {
    const w = game.bbttcc?.api?.travel?.whereIs;
    if (typeof w !== "function") return { known: false, here: true, name: "" };   // no travel module → ungated
    let r = null;
    try { r = w(factionId); } catch (_e) { r = null; }
    return { known: true, here: !!r && String(r.hexUuid) === String(hexUuid), name: String(r?.name || "") };
  }
  function _defaultFactionId() {
    const c = game.user?.character;
    const fid = String(c?.getFlag?.("bbttcc-factions", "factionId") || "").replace(/^Actor\./, "");
    return fid || null;
  }

  async function _hexRiteInfo(hexUuid, factionId) {
    let doc = null;
    try { const r = await fromUuid(String(hexUuid || "")); doc = r?.document ?? r; } catch (_e) { doc = null; }
    if (!doc) return { ok: false, error: "hex not found" };
    const s = doc.flags?.[TER]?.spark;
    if (!s?.key) return { ok: false, error: "no spark seated here", doc };
    const parsed = game.bbttcc?.api?.tikkun?.hex?.parseKey?.(s.key) ?? null;
    const key = parsed?.key || String(s.key);
    const sephirah = parsed?.sephirah || "";
    const sparkItem = await _resolveSparkSafely(null, key);
    const recipe = sparkItem ? (_sparkSys(sparkItem)?.repair ?? {}) : {};
    const matKey  = String(recipe.materialKey ?? "").trim();
    const matNeed = Number(recipe.materialAmount) || 0;
    const opPool  = String(recipe.opCost?.pool ?? "").trim();
    const opNeed  = Number(recipe.opCost?.amount) || 0;   // authored in OP steps (roll-bonus scale)
    const mpo     = _marksPerOp();
    const opNeedMarks = opNeed * mpo;
    const baseDC  = Number(recipe.ritualDC) || 15;
    const attempts = Number(s.repairAttempts) || 0;
    const dc      = Math.max(8, baseDC - 2 * attempts);
    const fid = String(factionId || "").replace(/^Actor\./, "") || null;
    const faction = fid ? game.actors?.get(fid) ?? null : null;
    const matScan = faction ? _scanMaterialAcrossFaction(faction.id, matKey) : { available: 0, stockpile: 0, holders: [] };
    const opAvail = faction ? _factionOpAvailable(faction, opPool) : 0;
    const opPoolBad = !!opPool && opNeed > 0 && !_isOpChannel(opPool);
    const matOK = !matKey || matScan.available >= matNeed;
    const opOK  = !opPool || (!opPoolBad && opAvail >= opNeedMarks);
    const party = fid ? _partyAt(fid, doc.uuid) : { known: false, here: false, name: "" };
    return {
      ok: true, doc, hexUuid: doc.uuid, hexName: _hexName(doc), key, sephirah, sephLabel: _sephLabelOf(sephirah),
      state: String(s.state || "dormant"), corrupted: s.state === "corrupted",
      sparkItem, sparkName: sparkItem?.name || (sephirah ? `Spark of ${_sephLabelOf(sephirah)}` : key),
      matKey, matNeed, opPool, opNeed, opNeedMarks, mpo, baseDC, attempts, dc,
      faction, matScan, opAvail, opPoolBad, matOK, opOK, party,
      ready: !!sparkItem && matOK && opOK && !opPoolBad && (!opNeed || mpo > 0)
    };
  }

  // Corrupted hex sparks, for the Quest Log / Repair Ledger. World-wide (a seated
  // spark belongs to the land, not a Domain); `here` is read for factionId's party.
  async function listCorruptedHexSparks({ factionId } = {}) {
    const hx = game.bbttcc?.api?.tikkun?.hex;
    if (typeof hx?.all !== "function") return [];
    const fid = String(factionId || _defaultFactionId() || "").replace(/^Actor\./, "") || null;
    const out = [];
    for (const s of hx.all()) {
      if (s?.state !== "corrupted") continue;
      // HEX VISIBILITY (Dave 2026-11-02): a player only hears about a lamp in a hex they can see — a fogged hex is not a map leak
      if (!game.user?.isGM) { try { const d = fromUuidSync?.(s.hexUuid); if (d?.hidden === true) continue; } catch (_eH) {} }
      const info = await _hexRiteInfo(s.hexUuid, fid).catch(() => null);
      if (!info?.ok) continue;
      out.push({
        hexUuid: info.hexUuid, hexName: info.hexName, scene: s.scene, key: info.key,
        sephirah: info.sephirah, sephLabel: info.sephLabel, sparkName: info.sparkName,
        dc: info.dc, attempts: info.attempts, here: !!info.party.here, partyAt: info.party.name, ready: info.ready
      });
    }
    return out;
  }

  async function openHexRepairRite({ hexUuid, factionId } = {}) {
    const fid = String(factionId || _defaultFactionId() || "").replace(/^Actor\./, "");
    if (!hexUuid) { ui.notifications?.error?.("Hex repair: hexUuid required."); return { ok: false, error: "hexUuid required" }; }
    if (!fid) { ui.notifications?.warn?.("Hex repair: no Domain — open it from your Domain's Quest Log."); return { ok: false, error: "no faction" }; }
    const info = await _hexRiteInfo(hexUuid, fid);
    if (!info.ok) { ui.notifications?.warn?.(`Hex repair: ${info.error}.`); return info; }
    if (!info.corrupted) { ui.notifications?.info?.(`The ${info.sparkName} at ${info.hexName} is not corrupted.`); return { ok: false, error: "not corrupted" }; }
    if (!info.faction) { ui.notifications?.error?.(`Domain ${fid} not found.`); return { ok: false, error: "faction not found" }; }
    if (!info.party.here) {
      ui.notifications?.warn?.(`Ride to ${info.hexName} first — the rite is done on site.`);
      return { ok: false, error: "not-here", hexName: info.hexName };
    }
    if (!info.sparkItem) {
      ui.notifications?.error?.(`Spark "${info.key}" is not resolvable in the sparks pack — no recipe to repair it with.`);
      return { ok: false, error: "no recipe" };
    }
    if (info.opNeed && !info.mpo) { ui.notifications?.error?.("Repair: OP↔marks ratio unavailable (bbttcc-factions op engine not ready)."); return { ok: false, error: "no ratio" }; }

    const { matKey, matNeed, opPool, opNeedMarks, matScan, opAvail, matOK, opOK, opPoolBad, dc, baseDC, attempts, mpo } = info;
    const members = _getFactionMembers(info.faction.id);
    const mine = game.user?.character?.id;
    const memberOpts = members.map(m => `<option value="${m.id}" ${m.id === mine ? "selected" : ""}>${_esc(m.name)}</option>`).join("");
    const matLine = matKey
      ? `<li>Material: <b>${matNeed}× ${_esc(matKey)}</b> &nbsp; <span style="color:${matOK ? "#6fcf97" : "#c03030"}">${matOK ? "✓ available" : `✗ have ${matScan.available}`}</span>${matScan.stockpile ? ` <span style="opacity:0.6">(${matScan.stockpile} in the Domain stockpile)</span>` : ""}</li>`
      : `<li>Material: <i>(none required)</i></li>`;
    const opLine = opPool
      ? `<li>Cost: <b>${opNeedMarks} ${_esc(opPool)} marks</b> &nbsp; <span style="color:${opOK ? "#6fcf97" : "#c03030"}">${opOK ? `✓ have ${opAvail}` : (opPoolBad ? `✗ "${_esc(opPool)}" is not a Domain channel — recipe cannot be paid` : `✗ have ${opAvail}`)}</span></li>`
      : `<li>Cost: <i>(no marks required)</i></li>`;
    const content = `<div style="font-size:0.86rem">
      <h3 style="margin:0.2rem 0 0.4rem">⚒ Repair: ${_esc(info.sparkName)}${info.sephLabel ? ` <span style="opacity:0.6">(${_esc(info.sephLabel)})</span>` : ""}</h3>
      <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.8">Seated at <b>${_esc(info.hexName)}</b> · Domain: <b>${_esc(info.faction.name)}</b> · Attempts so far: <b>${attempts}</b> · DC: <b>${dc}</b>${attempts ? ` <span style="opacity:0.6">(base ${baseDC} − ${2 * attempts})</span>` : ""}</p>
      <p style="margin:0.3rem 0;font-size:0.78rem;font-style:italic">The dark took this lamp. Mend it here, where it burns.</p>
      <ul style="margin:0.4rem 0;padding-left:1.2rem">${matLine}${opLine}</ul>
      <hr/>
      <div class="form-group" style="margin:0.4rem 0">
        <label>Ritual contributor</label>
        <select name="contributor">${memberOpts || `<option value="">— no Stewards in this Domain —</option>`}</select>
      </div>
      <div class="form-group" style="margin:0.4rem 0">
        <label>Extra ${opPool ? `${_esc(opPool)} ` : ""}spend — steps of ${mpo} marks, +1 to roll each (0–3)</label>
        <input type="number" name="extraOp" value="0" min="0" max="3" />
      </div>
      <p style="margin:0.4rem 0 0;font-size:0.74rem;opacity:0.7">Roll: <code>check die + ritual skill + cost steps + extra steps</code> vs DC ${dc}. Margin ≥0 → the lamp is mended; -1 to -3 → partial (DC drops 2 next try); -4 or worse → failure (ritual debt). Materials and marks are spent either way.</p>
    </div>`;

    new Dialog({
      title: `Repair Rite: ${info.sparkName} — ${info.hexName}`,
      content,
      buttons: {
        roll: {
          label: "Roll Ritual",
          callback: async (html) => {
            if (opPoolBad) { ui.notifications?.error?.(_badPoolMsg(opPool, info.sparkName)); return; }
            if (!matOK || !opOK) {
              const missing = [];
              if (!matOK) missing.push(`materials: need ${matNeed}× ${matKey}, have ${matScan.available}`);
              if (!opOK)  missing.push(`marks: need ${opNeedMarks} ${opPool}, have ${opAvail}`);
              ui.notifications?.warn?.(`Cannot proceed — ${missing.join(" · ")}.`);
              return;
            }
            const contributorId = String(html.find("[name='contributor']").val() || "");
            if (!contributorId) { ui.notifications?.warn?.("No contributor selected."); return; }
            const extraOp = Math.max(0, Math.min(3, Math.floor(Number(html.find("[name='extraOp']").val()) || 0)));
            const payload = { hexUuid: info.hexUuid, factionId: info.faction.id, contributorId, extraOp };
            try {
              const gx = game.bbttcc?.api?.gmExec;
              let res;
              if (gx?.call) res = await gx.call(HEX_RITE_RELAY, payload, { timeoutMs: 30000 });
              else if (game.user?.isGM) res = await _performHexRite(payload, { fromUserId: game.user.id, fromUserName: game.user.name, local: true });
              else throw new Error("a GM must be connected to perform the rite");
              if (res?.outcome && !game.user?.isGM) ui.notifications?.info?.(`Repair rite at ${info.hexName}: ${res.outcome} (${res.total} vs DC ${res.dc}).`);
            } catch (e) {
              ui.notifications?.error?.(`Repair rite not performed — ${e?.message ?? e}`);
            }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "roll"
    }, { width: 480 }).render(true);
    return { ok: true, opened: true };
  }

  // GM side — the authority. Validates the payload against live state, pays, rolls, applies.
  async function _performHexRite(p, meta = {}) {
    if (!game.user?.isGM) throw new Error("hex repair rite runs on a GM seat");
    const fid = String(p?.factionId || "").replace(/^Actor\./, "");
    const info = await _hexRiteInfo(p?.hexUuid, fid);
    if (!info.ok) throw new Error(info.error);
    if (!info.corrupted) throw new Error(`the ${info.sparkName} at ${info.hexName} is no longer corrupted — nothing paid, nothing rolled`);
    const factionActor = info.faction;
    if (!factionActor) throw new Error("Domain not found");
    if (!info.sparkItem) throw new Error(`spark "${info.key}" has no recipe (not in the sparks pack)`);

    const caller = game.users?.get(String(meta?.fromUserId || "")) || null;
    if (!meta?.local && !caller?.isGM) {
      let ownsDomain = false; try { ownsDomain = !!factionActor.testUserPermission?.(caller, "OWNER"); } catch (_e) {}
      const stewardFid = String(caller?.character?.getFlag?.("bbttcc-factions", "factionId") || "").replace(/^Actor\./, "");
      if (!ownsDomain && stewardFid !== factionActor.id) throw new Error(`${caller?.name || "caller"} does not ride with ${factionActor.name}`);
    }
    if (!info.party.here) throw new Error(`ride to ${info.hexName} first — the rite is done on site`);

    const contributor = game.actors?.get(String(p?.contributorId || ""));
    if (!contributor || String(contributor.getFlag?.("bbttcc-factions", "factionId") || "").replace(/^Actor\./, "") !== factionActor.id) {
      throw new Error("the contributor must be one of the Domain's Stewards");
    }
    const { matKey, matNeed, opPool, opNeed, mpo, dc } = info;
    if (info.opPoolBad) throw new Error(_badPoolMsg(opPool, info.sparkName));
    if (opNeed && !mpo) throw new Error("OP↔marks ratio unavailable");
    let extraOp = Math.max(0, Math.min(3, Math.floor(Number(p?.extraOp) || 0)));
    if (extraOp && !opPool) extraOp = 0;
    if (extraOp && info.opAvail < (opNeed + extraOp) * mpo) throw new Error(`extra spend needs ${(opNeed + extraOp) * mpo} ${opPool} marks in total, have ${info.opAvail}`);

    // Pay first (marks, then material; a material failure refunds the marks) — same rule as the carried rite.
    let paidMarks = 0;
    if (opPool && (opNeed || extraOp)) paidMarks = await _debitOp(factionActor, opPool, (opNeed + extraOp) * mpo);
    try {
      if (matKey && matNeed) await _consumeMaterial(factionActor.id, matKey, matNeed);
    } catch (e) {
      try { await _refundOp(factionActor, opPool, paidMarks); } catch (eR) { console.warn(TAG, "marks refund failed:", eR); }
      throw new Error(`material: ${e.message}${paidMarks ? ` (${paidMarks} ${opPool} marks refunded)` : ""}`);
    }

    const dice = game.bbttcc?.dice;
    const sys = contributor.system?.system ?? contributor.system ?? {};
    const ritSkill = dice ? dice.skillBonus(contributor, "ritual", "soul")
      : Number(sys.skills?.ritual?.value ?? 0) + Number(sys.attributes?.soul?.value ?? 2);
    const breakdown = dice?.isRFI?.() === false ? [["ritual skill", ritSkill]]
      : [["ritual", Number(sys.skills?.ritual?.value ?? 0)], ["soul", Number(sys.attributes?.soul?.value ?? 2)]];
    const totalBonus = ritSkill + extraOp + opNeed;
    const formula = `${dice?.checkFormula?.() ?? (game.fourththing?.rolls?.checkFormula?.() || "2d10x10")} + ${totalBonus}`;
    const roll = await new Roll(formula).roll();
    const total = roll.total;
    const margin = total - dc;
    const outcome = margin >= 0 ? "success" : (margin >= -3 ? "partial" : "failure");

    const doc = info.doc;
    if (outcome === "success") {
      const r = await game.bbttcc?.api?.tikkun?.hex?.repair?.(doc.uuid);
      if (r && r.ok === false) console.warn(TAG, "hex.repair refused after a won rite:", r);
      try { await doc.update({ [`flags.${TER}.spark.repairAttempts`]: 0 }); } catch (_e) {}   // repair() merges, so the counter is zeroed by hand
    } else {
      try { await doc.update({ [`flags.${TER}.spark.repairAttempts`]: info.attempts + 1 }); } catch (e) { console.warn(TAG, "attempt counter write failed:", e); }
    }
    if (outcome === "failure") {
      try {
        const logs = factionActor.getFlag("bbttcc-factions", "warLogs") || [];
        logs.push({
          ts: Date.now(), type: "ritual-debt", source: "tikkun-repair",
          msg: `Failed repair of the ${info.sparkName} seated at ${info.hexName} (${contributor.name}${caller && !meta?.local ? `, called by ${caller.name}` : ""}). Roll ${total} vs DC ${dc}. Materials and marks spent; the lamp stays dark; narrative debt incurred.`
        });
        await factionActor.setFlag("bbttcc-factions", "warLogs", logs);
      } catch (e) { console.warn(TAG, "warLog stamp failed:", e); }
    }

    const headerColor = outcome === "success" ? "#6fcf97" : (outcome === "partial" ? "#e8c84a" : "#c03030");
    const headerIcon  = outcome === "success" ? "✦" : (outcome === "partial" ? "⊘" : "⚠");
    const headerText  = outcome === "success" ? "Lamp Mended" : (outcome === "partial" ? "Repair Stalled" : "Repair Failed");
    const where = _esc(info.hexName);
    const outcomeLine = outcome === "success"
      ? `<p style="margin:0.3rem 0">The ${_esc(info.sparkName)} at <b>${where}</b> sheds its corruption. It sleeps again, waiting to be integrated.</p>`
      : outcome === "partial"
      ? `<p style="margin:0.3rem 0">The work bites but does not bind. Materials and marks spent. The next rite at ${where} goes at DC ${Math.max(8, dc - 2)}.</p>`
      : `<p style="margin:0.3rem 0">The rite breaks against the corruption. Materials and marks spent; the lamp at ${where} stays dark; <b>${_esc(factionActor.name)}</b> incurs ritual debt.</p>`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker?.({ actor: contributor }) ?? {},
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:${headerColor}">${headerIcon} ${headerText}: ${_esc(info.sparkName)}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem">${_esc(contributor.name)} performs the repair rite at <b>${where}</b>${info.sephLabel ? ` on the <i>${_esc(info.sephLabel)}</i> spark` : ""}.</p>
        <div class="ft-roll-formula">
          <span class="ft-fp" title="check die">${(roll.terms[0]?.results ?? []).map(r => r.result).join(" + ")}</span>
          ${breakdown.map(([t, v]) => `<span class="ft-fp" title="${t}">+${v}</span>`).join("\n          ")}
          ${extraOp ? `<span class="ft-fp" title="extra ${_esc(opPool)} spend (${extraOp * mpo} marks)">+${extraOp}</span>` : ""}
          ${opNeed ? `<span class="ft-fp" title="${_esc(opPool)} cost (${opNeed * mpo} marks)">+${opNeed}</span>` : ""}
        </div>
        <div class="ft-roll-result"><span class="ft-total">${total}</span> <span style="opacity:0.7;font-size:0.78rem">vs DC ${dc}</span></div>
        ${outcomeLine}
      </div>`
    }).catch(() => {});
    return { ok: true, outcome, total, dc, nextDC: outcome === "success" ? null : Math.max(8, dc - 2), hexUuid: doc.uuid, key: info.key };
  }

  // ── Pending Deposits Ledger (Phase E.3b) ────────────────────────────────
  // Mirror of the Repair Ledger but for sparks that have been integrated
  // personally and are eligible for faction deposit (not corrupted, not
  // already deposited). Each row gets an "Accept Deposit" button that fires
  // depositSpark for the GM.
  async function _scanPendingDeposits(factionId) {
    const members = _getFactionMembers(factionId);
    const out = [];
    for (const a of members) {
      const map = a.getFlag?.("bbttcc-tikkun", "sparks") || {};
      for (const [k, s] of Object.entries(map)) {
        if (!s) continue;
        if (!s.integrated || s.corrupted || s.deposited) continue;
        const item = await _resolveSparkSafely(s, k);
        out.push({ actor: a, sparkKey: k, spark: s, item });
      }
    }
    return out;
  }

  async function openDepositLedger(factionId) {
    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Deposit Ledger is GM-only for v1.");
      return;
    }
    const faction = game.actors?.get(factionId);
    if (!faction) {
      ui.notifications?.error?.(`Faction ${factionId} not found.`);
      return;
    }
    const pending = await _scanPendingDeposits(factionId);
    if (!pending.length) {
      new Dialog({
        title: `Pending Deposits — ${faction.name}`,
        content: `<p style="margin:0.6rem 0">No sparks awaiting deposit on <b>${_esc(faction.name)}</b>'s members. Either nothing has been integrated yet, or everything is already in the faction's hands.</p>`,
        buttons: { ok: { label: "Close" } }
      }).render(true);
      return;
    }

    const rows = pending.map(({ actor, sparkKey, spark, item }) => {
      const sephLabel = _sparkSys(item)?.sephirah
        ? (game.fourththing?.constants?.SEPHIROTH?.[_sparkSys(item)?.sephirah]?.label ?? _sparkSys(item)?.sephirah)
        : (spark.sephirah ?? "");
      const kindLabel = spark.kind ?? _sparkSys(item)?.kind ?? "";
      return `
        <tr>
          <td>${_esc(item?.name ?? spark.name ?? sparkKey)} ${sephLabel ? `<span style="opacity:0.6;font-size:0.74rem">(${_esc(sephLabel)})</span>` : ""}</td>
          <td>${_esc(actor.name)}</td>
          <td style="text-align:center">${kindLabel}</td>
          <td style="text-align:right"><button type="button" class="bbttcc-tk-deposit-accept" data-actor-id="${actor.id}" data-spark-key="${sparkKey}">Accept Deposit</button></td>
        </tr>`;
    }).join("");

    const content = `<div style="font-size:0.84rem;max-height:60vh;overflow-y:auto">
      <p style="margin:0.2rem 0 0.5rem">Sparks integrated personally by <b>${_esc(faction.name)}</b>'s operatives, awaiting faction handover. Accept Deposit transfers the spark into the faction's count.</p>
      <table style="width:100%;border-collapse:collapse" class="bbttcc-tk-pending">
        <thead><tr style="background:rgba(255,255,255,0.06);text-align:left">
          <th style="padding:0.3rem">Spark</th>
          <th style="padding:0.3rem">Owner</th>
          <th style="padding:0.3rem;text-align:center">Kind</th>
          <th style="padding:0.3rem;text-align:right"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

    const dlg = new Dialog({
      title: `Pending Deposits — ${faction.name}`,
      content,
      buttons: { close: { label: "Close" } },
      render: (html) => {
        html.find(".bbttcc-tk-deposit-accept").on("click", async (ev) => {
          const btn = ev.currentTarget;
          const actorId  = btn.dataset.actorId;
          const sparkKey = btn.dataset.sparkKey;
          const api = game.bbttcc?.api?.tikkun;
          if (!api?.depositSpark) {
            ui.notifications?.error?.("depositSpark not installed.");
            return;
          }
          try {
            await api.depositSpark({ actorId, sparkKey, factionId });
            // Soft-refresh the ledger by re-opening it.
            dlg.close();
            await openDepositLedger(factionId);
          } catch (e) {
            ui.notifications?.warn?.(e?.message ?? String(e));
          }
        });
      }
    }, { width: 640 }).render(true);
  }

  // ── API exposure ────────────────────────────────────────────────────────
  function _install() {
    try {
      game.bbttcc ??= { api: {} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.tikkun ??= {};
      game.bbttcc.api.tikkun.openRepairLedger = openRepairLedger;
      game.bbttcc.api.tikkun.openRepairRitual = openRepairRitual;
      game.bbttcc.api.tikkun.openDepositLedger = openDepositLedger;
      game.bbttcc.api.tikkun.openHexRepairRite = openHexRepairRite;
      game.bbttcc.api.tikkun.listCorruptedHexSparks = listCorruptedHexSparks;
      try { game.bbttcc.api.gmExec?.register?.(HEX_RITE_RELAY, (p, meta) => _performHexRite(p, meta)); } catch (eR) { console.warn(TAG, "hex rite relay register failed:", eR); }
    } catch (e) { console.warn(TAG, "install failed:", e); }
  }
  Hooks.once("ready", _install);
  try { if (game?.ready) _install(); } catch {}

  // ── Faction sheet entry buttons ────────────────────────────────────────
  // Two GM-only buttons on faction actor sheets — Repair Ledger (Phase D)
  // and Pending Deposits (Phase E). Idempotent — re-render safe.
  //
  // Faction detection mirrors bbttcc-factions/scripts/module.js:isFactionActor:
  //   flag bbttcc-factions.isFaction === true  OR  system.details.type.value === "faction"
  // Actor type can be character/npc — don't gate on that.
  //
  // BBTTCCFactionSheet template uses <nav class="bbttcc-tabs" data-group="main">
  // as its tab nav — that's our injection landmark.
  function _isFactionActor(a) {
    if (!a) return false;
    try {
      if (a.getFlag?.("bbttcc-factions", "isFaction")) return true;
      if (foundry.utils.getProperty(a, "system.details.type.value") === "faction") return true;
    } catch (_e) {}
    return false;
  }
  function _injectFactionButton(app, html) {
    try {
      if (!game.user?.isGM) return;
      const actor = app?.actor ?? app?.document;
      if (!_isFactionActor(actor)) return;

      const root = html?.[0] ?? html?.jquery ? html[0] : html;
      if (!root || typeof root.querySelector !== "function") return;
      if (root.querySelector("[data-bbttcc-tk-buttons='1']")) return;

      // Class-driven styling lives in modules/bbttcc-tikkun/styles/tikkun-styles.css
      // under the [data-bbttcc-tk-buttons] root selector — keep this minimal.
      const wrap = document.createElement("section");
      wrap.dataset.bbttccTkButtons = "1";

      const lbl = document.createElement("strong");
      lbl.textContent = "Tikkun";
      wrap.appendChild(lbl);

      const mkBtn = (label, handler) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); handler(); });
        return b;
      };
      wrap.appendChild(mkBtn("⚒ Spark Repair Ledger",  () => openRepairLedger(actor.id)));
      wrap.appendChild(mkBtn("→ Pending Deposits",      () => openDepositLedger(actor.id)));

      // Preferred target — INSIDE the Activities tab section, so buttons
      // live with other faction-action affordances. Selector targets the
      // <section> element specifically; the bare `[data-tab='activities']`
      // selector ALSO matches the <a> nav button (which appears first in
      // document order), and prepending into the link displaces its label.
      const activitiesPanel = root.querySelector("section.bbttcc-tab-activities, section.bbttcc-tab[data-tab='activities']");
      if (activitiesPanel) {
        activitiesPanel.prepend(wrap);
        return;
      }
      const overviewPanel = root.querySelector("section.bbttcc-tab-overview, section.bbttcc-tab[data-tab='overview']");
      if (overviewPanel) {
        overviewPanel.prepend(wrap);
        return;
      }
      const formEl = root.querySelector("form.bbttcc-faction-sheet, form, .window-content");
      formEl?.prepend?.(wrap);
    } catch (e) { console.warn(TAG, "faction button inject failed:", e); }
  }
  Hooks.on("renderActorSheet",   _injectFactionButton);
  Hooks.on("renderApplicationV2", _injectFactionButton);
  // BBTTCCFactionSheet extends ActorSheet (AppV1). Foundry fires class-named
  // hooks too; subscribe by class name for max compatibility.
  Hooks.on("renderBBTTCCFactionSheet", _injectFactionButton);
})();
