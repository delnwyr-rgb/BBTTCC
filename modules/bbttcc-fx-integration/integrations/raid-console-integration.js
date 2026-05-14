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

function outcomeKind(outcome) {
  const s = String(outcome || "").toLowerCase();
  if (s.includes("great") || s.includes("success") || s.includes("win")) return "good";
  if (s.includes("fail") || s.includes("loss") || s.includes("lockdown")) return "bad";
  return "info";
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

  root.addEventListener("change", (ev) => {
    const input = ev.target?.closest?.('input[type="checkbox"][data-maneuver]');
    if (!input) return;
    const round = extractRound(app, Number(input.dataset.roundIndex || 0));
    api.playKey(input.dataset.maneuver, {
      checkbox: input,
      root,
      label: input.closest("label")?.innerText?.trim() || input.dataset.maneuver,
      raidType: roundRaidType(app, round)
    }, { phase: "invoke", banner: false });
  }, true);

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
    const selected = readSelected(roundBefore);
    const root = normalizeRoot(this);
    const raidType = roundRaidType(this, roundBefore);

    for (const key of selected.att) {
      await api.playKey(key, { root, label: key.replace(/_/g, " "), raidType }, { phase: "invoke", banner: false, raidType });
    }
    for (const key of selected.def) {
      await api.playKey(key, { root, label: key.replace(/_/g, " "), raidType }, { phase: "invoke", banner: false, raidType });
    }

    const result = await origCommit.apply(this, [idx, ...rest]);

    const roundAfter = extractRound(this, idx) || roundBefore;
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
        targetToken: target
      }, { phase: "resolve", banner: false, raidType });
    }

    await api.playKey("raid_outcome", {
      root,
      outcome: roundAfter?.outcome || "Resolved",
      outcomeLabel: `Raid ${roundAfter?.outcome || "Resolved"}`,
      kind: outcomeKind(roundAfter?.outcome),
      raidType,
      targetToken: target
    }, { phase: "resolve", raidType });

    if (roundAfter?.targetType === "facility") {
      await api.playKey("facility_damage", {
        root,
        outcome: roundAfter?.outcome || "Facility Effect",
        raidType,
        targetToken: target
      }, { phase: "resolve", banner: false, raidType });
    }
    if (roundAfter?.targetType === "rig") {
      await api.playKey("rig_damage", {
        root,
        outcome: roundAfter?.outcome || "Rig Effect",
        raidType,
        targetToken: target
      }, { phase: "resolve", banner: false, raidType });
    }
    if (roundAfter?.targetType === "creature" && roundAfter?.meta?.boss?.damageState) {
      await api.playKey("boss_phase_change", {
        root,
        outcomeLabel: `Boss ${roundAfter.meta.boss.damageState}`,
        raidType: "boss",
        targetToken: target
      }, { phase: "resolve", raidType: "boss" });
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
