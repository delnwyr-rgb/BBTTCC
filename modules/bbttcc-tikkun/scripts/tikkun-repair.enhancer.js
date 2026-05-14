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
 *   • Partial (roll == DC-1 to DC-3): mats + OP consumed, DC drops 2 for
 *     the next attempt (tracked on spark.repair.attempts).
 *   • Failure (roll ≤ DC-4): mats + OP consumed; "ritual debt" entry
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

console.log("[bbttcc-tikkun/repair] LOADED");

(() => {
  const TAG = "[bbttcc-tikkun/repair]";

  // ── OP pool keys (mirrors bbttcc-bridge.js) ────────────────────────────
  const OP_POOLS = ["violence","intrigue","softpower","diplomacy","economy","nonlethal","faith","logistics","siege","body","soul","culture"];

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
  // Returns { available: number, holders: [{ actor, item, charges }] }.
  // Charges represent stack size on individual items (per RFI item schema).
  function _scanMaterialAcrossFaction(factionId, materialKey) {
    const out = { available: 0, holders: [] };
    if (!materialKey) return out;
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
    // Largest stacks first to minimize item deletions
    scan.holders.sort((a, b) => b.charges - a.charges);
    let remaining = amount;
    const drained = [];
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
  function _opBank(factionActor) {
    return foundry.utils.duplicate(factionActor?.flags?.["bbttcc-factions"]?.opBank ?? {});
  }

  function _factionOpAvailable(factionActor, pool) {
    if (!factionActor || !pool) return 0;
    return Number(_opBank(factionActor)[pool]) || 0;
  }

  async function _debitOp(factionActor, pool, amount) {
    if (!factionActor || !pool || !amount) return;
    const bank = _opBank(factionActor);
    const cur = Number(bank[pool]) || 0;
    if (cur < amount) throw new Error(`Insufficient ${pool} OP: have ${cur}, need ${amount}.`);
    bank[pool] = cur - amount;
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

    const recipe = sparkItem.system?.repair ?? {};
    const matKey   = String(recipe.materialKey ?? "").trim();
    const matNeed  = Number(recipe.materialAmount) || 0;
    const opPool   = String(recipe.opCost?.pool ?? "").trim();
    const opNeed   = Number(recipe.opCost?.amount) || 0;
    const baseDC   = Number(recipe.ritualDC) || 15;
    const attempts = Number(spark.repair?.attempts) || 0;
    const dc       = Math.max(8, baseDC - 2 * attempts);

    const matScan = _scanMaterialAcrossFaction(factionActor.id, matKey);
    const opAvail = _factionOpAvailable(factionActor, opPool);
    const matOK   = !matKey  || matScan.available >= matNeed;
    const opOK    = !opPool || opAvail >= opNeed;

    // Contributor picker — any faction member.
    const members = _getFactionMembers(factionActor.id);
    const memberOpts = members.map(m => `<option value="${m.id}" ${m.id === ownerActor.id ? "selected" : ""}>${m.name}</option>`).join("");

    const sephLabel = sparkItem.system?.sephirah
      ? (game.fourththing?.constants?.SEPHIROTH?.[sparkItem.system.sephirah]?.label ?? sparkItem.system.sephirah)
      : "";

    const matLine = matKey
      ? `<li>Material: <b>${matNeed}× ${matKey}</b> &nbsp; <span style="color:${matOK ? "#6fcf97" : "#c03030"}">${matOK ? "✓ available" : `✗ have ${matScan.available}`}</span></li>`
      : `<li>Material: <i>(none required)</i></li>`;
    const opLine = opPool
      ? `<li>OP: <b>${opNeed} ${opPool}</b> &nbsp; <span style="color:${opOK ? "#6fcf97" : "#c03030"}">${opOK ? `✓ have ${opAvail}` : `✗ have ${opAvail}`}</span></li>`
      : `<li>OP: <i>(none required)</i></li>`;

    const content = `<div style="font-size:0.86rem">
      <h3 style="margin:0.2rem 0 0.4rem">⚒ Repair: ${sparkItem.name}${sephLabel ? ` <span style="opacity:0.6">(${sephLabel})</span>` : ""}</h3>
      <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.8">Owner: <b>${ownerActor.name}</b> · Faction: <b>${factionActor.name}</b> · Attempts so far: <b>${attempts}</b> · DC: <b>${dc}</b>${attempts ? ` <span style="opacity:0.6">(base ${baseDC} − ${2*attempts})</span>` : ""}</p>
      <ul style="margin:0.4rem 0;padding-left:1.2rem">${matLine}${opLine}</ul>
      <hr/>
      <div class="form-group" style="margin:0.4rem 0">
        <label>Ritual contributor</label>
        <select name="contributor">${memberOpts || `<option value="">— no faction members —</option>`}</select>
      </div>
      <div class="form-group" style="margin:0.4rem 0">
        <label>Extra OP spend (+1 to roll per OP, 0–3)</label>
        <input type="number" name="extraOp" value="0" min="0" max="3" />
      </div>
      <p style="margin:0.4rem 0 0;font-size:0.74rem;opacity:0.7">Roll: <code>2d10 + ritual + soul + extraOp</code> vs DC ${dc}. Margin ≥0 → success; -1 to -3 → partial (DC drops 2 next try); -4 or worse → failure (ritual debt).</p>
    </div>`;

    new Dialog({
      title: `Repair Ritual: ${sparkItem.name}`,
      content,
      buttons: {
        roll: {
          label: "Roll Ritual",
          callback: async (html) => {
            if (!matOK || !opOK) {
              const missing = [];
              if (!matOK) missing.push(`materials: need ${matNeed}× ${matKey}, have ${matScan.available}`);
              if (!opOK)  missing.push(`OP: need ${opNeed} ${opPool}, have ${opAvail}`);
              ui.notifications?.warn?.(`Cannot proceed — ${missing.join(" · ")}.`);
              return;
            }
            const contribId = html.find("[name='contributor']").val();
            const extraOp   = Math.max(0, Math.min(3, Number(html.find("[name='extraOp']").val()) || 0));
            const contributor = game.actors?.get(contribId);
            if (!contributor) {
              ui.notifications?.warn?.("No contributor selected.");
              return;
            }
            await _executeRepairRoll({
              ownerActor, contributor, sparkKey, spark, sparkItem,
              factionActor, matKey, matNeed, opPool, opNeed, extraOp, dc, baseDC
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
    factionActor, matKey, matNeed, opPool, opNeed, extraOp, dc, baseDC
  }) {
    // Skill bonus: ritual rank + soul attribute. Both pulled from contributor's
    // system.skills/system.attributes (post-AE applied by Foundry prepareData).
    const sys      = contributor.system?.system ?? contributor.system ?? {};
    const ritRank  = Number(sys.skills?.ritual?.value ?? 0);
    const soulAttr = Number(sys.attributes?.soul?.value ?? 2);
    const totalBonus = ritRank + soulAttr + extraOp + opNeed; // OP cost itself contributes too
    const formula  = `2d10 + ${totalBonus}`;
    const roll = await new Roll(formula).roll();
    const total = roll.total;
    const margin = total - dc;
    const outcome = margin >= 0 ? "success" : (margin >= -3 ? "partial" : "failure");

    // Side effects: consume materials + debit OP regardless of outcome.
    const debitErrors = [];
    try {
      if (matKey  && matNeed) await _consumeMaterial(factionActor.id, matKey, matNeed);
    } catch (e) { debitErrors.push(`material: ${e.message}`); }
    try {
      if (opPool && opNeed)   await _debitOp(factionActor, opPool, opNeed);
    } catch (e) { debitErrors.push(`op: ${e.message}`); }
    if (debitErrors.length) {
      ui.notifications?.error?.(`Repair commit had errors: ${debitErrors.join("; ")}`);
      // Continue — the dice were rolled and the table saw them. Better to
      // record the result than to silently swallow.
    }

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
          msg: `Failed repair of ${sparkItem.name} (${ownerActor.name}). Roll ${total} vs DC ${dc}. Materials and OP consumed; spark remains corrupted; narrative debt incurred.`
        });
        await factionActor.setFlag("bbttcc-factions", "warLogs", logs);
      } catch (e) { console.warn(TAG, "warLog stamp failed:", e); }
    }

    // Chat narration.
    const sephLabel = sparkItem.system?.sephirah
      ? (game.fourththing?.constants?.SEPHIROTH?.[sparkItem.system.sephirah]?.label ?? sparkItem.system.sephirah)
      : "";
    const headerColor = outcome === "success" ? "#6fcf97" : (outcome === "partial" ? "#e8c84a" : "#c03030");
    const headerIcon  = outcome === "success" ? "✦" : (outcome === "partial" ? "⊘" : "⚠");
    const headerText  = outcome === "success" ? "Spark Repaired" : (outcome === "partial" ? "Repair Stalled" : "Repair Failed");
    const outcomeLine = outcome === "success"
      ? `<p style="margin:0.3rem 0">The ${sparkItem.name} sheds its corruption. Eligible for re-deposit.</p>`
      : outcome === "partial"
      ? `<p style="margin:0.3rem 0">The work bites but does not bind. Materials and OP consumed. The ritual scars the spark just enough that the next attempt's DC drops by 2 (now ${Math.max(8, dc - 2)}).</p>`
      : `<p style="margin:0.3rem 0">The ritual breaks against the corruption. Materials and OP consumed; the spark remains tainted; <b>${factionActor.name}</b> incurs ritual debt — a narrative thread for the GM to weave back.</p>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker?.({ actor: contributor }) ?? {},
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:${headerColor}">${headerIcon} ${headerText}: ${sparkItem.name}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem">${contributor.name} performs the repair ritual on <b>${ownerActor.name}</b>'s ${sephLabel ? `<i>${sephLabel}</i> ` : ""}spark.</p>
        <div class="ft-roll-formula">
          <span class="ft-fp" title="2d10">${(roll.terms[0]?.results ?? []).map(r => r.result).join(" + ")}</span>
          <span class="ft-fp" title="ritual">+${ritRank}</span>
          <span class="ft-fp" title="soul">+${soulAttr}</span>
          ${extraOp ? `<span class="ft-fp" title="extra OP">+${extraOp}</span>` : ""}
          <span class="ft-fp" title="${opPool} OP cost">+${opNeed}</span>
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
    if (!corrupted.length) {
      new Dialog({
        title: `Spark Repair Ledger — ${faction.name}`,
        content: `<p style="margin:0.6rem 0">No corrupted sparks across <b>${faction.name}</b>'s members. The Great Work is unstained — for now.</p>`,
        buttons: { ok: { label: "Close" } }
      }).render(true);
      return;
    }

    const rows = corrupted.map(({ actor, sparkKey, spark, item }) => {
      const sephLabel = item?.system?.sephirah
        ? (game.fourththing?.constants?.SEPHIROTH?.[item.system.sephirah]?.label ?? item.system.sephirah)
        : "";
      const recipe = item?.system?.repair ?? {};
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
      const ready = matAvail >= matNeed && opAvail >= opNeed;
      return `
        <tr>
          <td>${item?.name ?? sparkKey} ${sephLabel ? `<span style="opacity:0.6;font-size:0.74rem">(${sephLabel})</span>` : ""}</td>
          <td>${actor.name}</td>
          <td style="text-align:center">${matNeed ? `${matNeed}× ${matKey} <span style="opacity:0.7">(have ${matAvail === Infinity ? "—" : matAvail})</span>` : "—"}</td>
          <td style="text-align:center">${opNeed ? `${opNeed} ${opPool} <span style="opacity:0.7">(have ${opAvail === Infinity ? "—" : opAvail})</span>` : "—"}</td>
          <td style="text-align:center">${dc}${attempts ? ` <span style="opacity:0.6">(-${2*attempts})</span>` : ""}</td>
          <td style="text-align:right"><button type="button" class="bbttcc-tk-repair-begin" data-actor-id="${actor.id}" data-spark-key="${sparkKey}" ${ready ? "" : "disabled style=\"opacity:0.5\""}>Begin Repair</button></td>
        </tr>`;
    }).join("");

    const content = `<div style="font-size:0.84rem;max-height:60vh;overflow-y:auto">
      <p style="margin:0.2rem 0 0.5rem">Corrupted sparks held by <b>${faction.name}</b> members. Begin Repair opens the ritual dialog.</p>
      <table style="width:100%;border-collapse:collapse" class="bbttcc-tk-ledger">
        <thead><tr style="background:rgba(255,255,255,0.06);text-align:left">
          <th style="padding:0.3rem">Spark</th>
          <th style="padding:0.3rem">Owner</th>
          <th style="padding:0.3rem;text-align:center">Mat</th>
          <th style="padding:0.3rem;text-align:center">OP</th>
          <th style="padding:0.3rem;text-align:center">DC</th>
          <th style="padding:0.3rem;text-align:right"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
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
      }
    }, { width: 720 }).render(true);
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
        content: `<p style="margin:0.6rem 0">No sparks awaiting deposit on <b>${faction.name}</b>'s members. Either nothing has been integrated yet, or everything is already in the faction's hands.</p>`,
        buttons: { ok: { label: "Close" } }
      }).render(true);
      return;
    }

    const rows = pending.map(({ actor, sparkKey, spark, item }) => {
      const sephLabel = item?.system?.sephirah
        ? (game.fourththing?.constants?.SEPHIROTH?.[item.system.sephirah]?.label ?? item.system.sephirah)
        : (spark.sephirah ?? "");
      const kindLabel = spark.kind ?? item?.system?.kind ?? "";
      return `
        <tr>
          <td>${item?.name ?? spark.name ?? sparkKey} ${sephLabel ? `<span style="opacity:0.6;font-size:0.74rem">(${sephLabel})</span>` : ""}</td>
          <td>${actor.name}</td>
          <td style="text-align:center">${kindLabel}</td>
          <td style="text-align:right"><button type="button" class="bbttcc-tk-deposit-accept" data-actor-id="${actor.id}" data-spark-key="${sparkKey}">Accept Deposit</button></td>
        </tr>`;
    }).join("");

    const content = `<div style="font-size:0.84rem;max-height:60vh;overflow-y:auto">
      <p style="margin:0.2rem 0 0.5rem">Sparks integrated personally by <b>${faction.name}</b>'s operatives, awaiting faction handover. Accept Deposit transfers the spark into the faction's count.</p>
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
