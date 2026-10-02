const TAG = "[bbttcc-fx/raid]";

function normalizeRoot(app) {
  return app?.element?.[0] || app?.element || null;
}

function extractRound(app, idx) {
  try {
    return app?.vm?.rounds?.[Number(idx)] || null;
  } catch {
    return null;
  }
}

function readSelected(round) {
  return {
    att: Array.isArray(round?.mansSelected) ? round.mansSelected.slice() : [],
    def: Array.isArray(round?.mansSelectedDef) ? round.mansSelectedDef.slice() : []
  };
}

function roundRaidType(app, round) {
  return round?.raidType || app?.vm?.raidType || app?.raidType || app?.options?.raidType || "";
}

function findCanvasTarget(round) {
  try {
    const tokenId = round?.defenderTokenId || round?.targetTokenId || round?.tokenId || round?.meta?.defenderTokenId || round?.meta?.targetTokenId;
    if (tokenId && canvas?.tokens?.get) {
      const tok = canvas.tokens.get(tokenId);
      if (tok) return tok;
    }
  } catch {}

  try {
    const controlled = canvas?.tokens?.controlled?.[0];
    if (controlled) return controlled;
  } catch {}

  return null;
}

function bindUIDelegates(api, app, root) {
  if (!root || root.__bbttccFXBound) return;
  root.__bbttccFXBound = true;

  // No checkbox "change" listener: the raid console's own change delegate
  // already plays the invoke FX (checked only); a second one here doubled it
  // and also fired on untick.

  root.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button[data-act], [data-manage-act], [data-id]");
    if (!btn) return;

    const round = extractRound(app, Number(btn.dataset.roundIndex || 0));
    const raidType = roundRaidType(app, round);
    const label = btn.textContent?.trim() || btn.dataset.act || btn.dataset.manageAct || btn.dataset.id;
    if (btn.dataset.act === "commit" || btn.dataset.manageAct === "commit") {
      api.playKey("raid_outcome", { root, label: `Resolving ${label}`, raidType }, { phase: "invoke", banner: true, raidType });
    } else if (btn.dataset.act === "post") {
      api.playKey("raid_outcome", { root, label: "Posting Raid Card", raidType }, { phase: "invoke", banner: true, raidType });
    } else if (btn.dataset.id === "add-round") {
      api.playKey("raid_outcome", { root, label: "Round Added", raidType }, { phase: "invoke", banner: true, raidType });
    }
  }, true);
}

function patchConsoleClass(api, ConsoleClass) {
  if (!ConsoleClass || ConsoleClass.__bbttccFXPatched) return false;
  ConsoleClass.__bbttccFXPatched = true;

  const proto = ConsoleClass.prototype;

  const origOnRender = proto._onRender;
  proto._onRender = async function (...args) {
    const res = await origOnRender.apply(this, args);
    const root = normalizeRoot(this);
    bindUIDelegates(api, this, root);
    return res;
  };

  const origCommit = proto._commitRound;
  proto._commitRound = async function (idx, ...rest) {
    const roundBefore = extractRound(this, idx);
    const wasCommitted = !!roundBefore?.committed;
    const selected = readSelected(roundBefore);
    const root = normalizeRoot(this);
    const raidType = roundRaidType(this, roundBefore);

    const result = await origCommit.apply(this, [idx, ...rest]);

    // Only play commit FX when the round actually committed just now. Native
    // _commitRound bails without committing on a cancelled confirm(), a player
    // seat ("Waiting for GM"), or a failed gate — no phantom "resolved" raid.
    const roundAfter = extractRound(this, idx);
    if (!game.user?.isGM || !roundAfter || wasCommitted || !roundAfter.committed) return result;

    const target = findCanvasTarget(roundAfter);
    const allKeys = [...selected.att, ...selected.def];
    const margin = Number(roundAfter?.margin ?? ((roundAfter?.total || 0) - (roundAfter?.dcFinal || 0)));
    const floatText = Number.isFinite(margin) ? `${margin >= 0 ? "+" : ""}${margin}` : String(roundAfter?.outcome || "");

    await api.playRolls({
      raidType,
      attackerName: roundAfter?.attackerName || roundAfter?.attName,
      defenderName: roundAfter?.defenderName || roundAfter?.defName,
      attackerTotal: roundAfter?.total,
      defenderTotal: roundAfter?.dcFinal,
      margin,
      label: roundAfter?.raidType || raidType || "Raid Clash",
      targetToken: target
    }, { raidType, label: roundAfter?.raidType || raidType || "Raid Clash" });

    // Per-maneuver impact/resolve ladder (native commit doesn't play these).
    // raid_outcome / rig_damage / boss_phase_change are owned by native
    // _commitRound — replaying them here doubled every banner + broadcast.
    for (const key of allKeys) {
      await api.playKey(key, {
        root,
        floatText,
        targetEl: root?.querySelector?.("tbody") || root,
        outcome: roundAfter?.outcome,
        raidType,
        targetToken: target
      }, { phase: "impact", banner: false, raidType });

      await api.playKey(key, {
        root,
        outcome: roundAfter?.outcome || key.replace(/_/g, " "),
        outcomeLabel: key.replace(/_/g, " "),
        raidType,
        targetToken: target,
        effectRequiresTarget: true
      }, { phase: "resolve", banner: false, raidType });
    }

    // facility_damage is NOT played by native _commitRound (rig/boss are) — keep it here.
    if (roundAfter?.targetType === "facility") {
      await api.playKey("facility_damage", {
        root,
        outcome: roundAfter?.outcome || "Facility Effect",
        raidType,
        targetToken: target
      }, { phase: "resolve", banner: false, raidType });
    }

    return result;
  };

  return true;
}

export function installRaidConsoleIntegration(api) {
  const attempt = () => {
    const ConsoleClass = game.bbttcc?.api?.raid?.ConsoleClass || game.modules.get("bbttcc-raid")?.api?.raid?.ConsoleClass || game.modules.get("bbttcc-raid")?.api?.ConsoleClass;
    if (!ConsoleClass) return false;
    const ok = patchConsoleClass(api, ConsoleClass);
    if (ok) console.log(TAG, "Raid Console patched.");
    return ok;
  };

  if (attempt()) return;
  setTimeout(attempt, 250);
  setTimeout(attempt, 1000);

  Hooks.on("renderApplication", (app) => {
    const root = normalizeRoot(app);
    if (!root) return;
    if (!root.classList?.contains("bbttcc-raid-console")) return;
    bindUIDelegates(api, app, root);
  });
}
