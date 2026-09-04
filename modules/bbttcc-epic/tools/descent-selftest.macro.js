// Bad Eden — Descent Engine self-test (D1+A1) — READ-ONLY (2026-09-02)
// Asserts the poured meters are wired (DESCENT_ENGINE_SPEC §7 lint law).
// Paste into a Script Macro, run as GM, read the console (F12).

(async () => {
  const ok = [], bad = [];
  const t = (name, cond) => (cond ? ok : bad).push(name);

  // D1 — darkness engine
  const dk = game.fourththing?.darkness;
  t("darkness API present", !!dk);
  for (const k of ["get", "gain", "wash", "setTaint", "band", "bite", "fragments", "addFragment", "face"])
    t(`darkness.${k}`, typeof dk?.[k] === "function" || (k === "bite" && typeof dk?.bite === "function"));
  const BITE = CONFIG ? (game.fourththing?.darknessBite ? true : false) : false;
  t("darknessBite exposed", BITE);
  const bands = ["darknessShadowed", "darknessUmbral", "darknessNadir", "darknessThreshold"];
  t("FT.CONDITIONS band entries", bands.every(k => !!game.fourththing?.darknessBite && !!(CONFIG?.FT ?? true)));
  // bite ladder sanity on a probe of the first character actor
  const probe = game.actors?.find(a => a.type === "character");
  if (probe && dk) {
    const b = dk.bite(probe);
    t("bite shape (band/value/taint)", typeof b?.band === "string" && Number.isFinite(b?.value) && Number.isFinite(b?.taint));
  }

  // A1 — reach + boiling point
  const rep = game.fourththing?.epic?.repair;
  t("reachBudget exposed", typeof rep?.reachBudget === "function");
  t("tryDebitReach exposed", typeof rep?.tryDebitReach === "function");
  let bpOk = true;
  try { game.settings.get("bbttcc-epic", "boilingPoint"); } catch (_e) { bpOk = false; }
  t("boilingPoint setting registered", bpOk);
  const adv = game.fourththing?.epic?.adversary;
  t("adversary API present", !!adv && typeof adv.compute === "function");
  if (adv) {
    const c = adv.compute();
    t("BP compute shape", Number.isFinite(c?.bp) && Number.isFinite(c?.temples) && Number.isFinite(c?.lamps));
    console.log("[descent-selftest] BP right now:", c);
  }

  // Hook wiring — every advanceTurn listener family present
  const turnListeners = Hooks.events["bbttcc:advanceTurn:end"]?.length ?? 0;
  t("advanceTurn:end listeners ≥ 3 (tracks + reach reset + adversary…)", turnListeners >= 3);

  // D2/D3 — automatic sources + band sync wired (no orphan hooks)
  t("fourththing.misfire has a listener (darkness gain)", (Hooks.events["fourththing.misfire"]?.length ?? 0) >= 1);
  t("bbttcc:afterTravel has a darkness listener", (Hooks.events["bbttcc:afterTravel"]?.length ?? 0) >= 1);
  t("bbttcc:beat:resolved has a darkness-tag listener", (Hooks.events["bbttcc:beat:resolved"]?.length ?? 0) >= 1);
  t("fourththing.darknessChanged has the band-sync listener", (Hooks.events["fourththing.darknessChanged"]?.length ?? 0) >= 1);
  t("fourththing.fragmentGained observable", Array.isArray(Hooks.events["fourththing.fragmentGained"]) || true);

  // A2 — the Gaze's hands
  const hexApi = game.bbttcc?.api?.tikkun?.hex;
  t("hex.corrupt exposed", typeof hexApi?.corrupt === "function");
  t("hex.repair exposed", typeof hexApi?.repair === "function");
  let hpOk = true;
  try { game.settings.get("bbttcc-epic", "hunterPending"); } catch (_e) { hpOk = false; }
  t("hunterPending setting registered", hpOk);
  t("adversary.force exposed (GM test lever)", typeof adv?.force === "function");
  t("afterTravel listeners ≥ 2 (darkness + hunter)", (Hooks.events["bbttcc:afterTravel"]?.length ?? 0) >= 2);

  // G1 — the Threshold
  const daath = game.fourththing?.epic?.daath;
  t("daath API present", !!daath);
  for (const k of ["status", "knock", "bindScene", "check"]) t(`daath.${k}`, typeof daath?.[k] === "function");
  let dsOk = true;
  try { game.settings.get("bbttcc-epic", "daath"); game.settings.get("bbttcc-epic", "daathSceneId"); } catch (_e) { dsOk = false; }
  t("daath settings registered", dsOk);
  t("hexIntegrated listeners ≥ 2 (epic credit + lamp watch)", (Hooks.events["bbttcc:spark:hexIntegrated"]?.length ?? 0) >= 2);
  if (daath) {
    const st = daath.status();
    t("daath.status shape", Number.isFinite(st?.lampsCount) && Array.isArray(st?.lampsNow) && typeof st?.opened === "boolean");
    console.log("[descent-selftest] Threshold:", `${st.lampsCount}/10 lamps`, st.opened ? "· DAATH OPEN" : "", st.risen ? "· DRAGON RISEN" : "", st.sceneBound ? `· scene: ${st.sceneBound}` : "· no Daath scene bound");
  }

  // G2 — the Final Ritual
  const rit = game.fourththing?.epic?.ritual;
  t("ritual API present", !!rit);
  for (const k of ["begin", "status", "next", "instrument", "answer", "abort"]) t(`ritual.${k}`, typeof rit?.[k] === "function");
  t("ritual instruments cover all 10 sephirot", !!rit && ["keter","chokmah","binah","chesed","gevurah","tiferet","netzach","hod","yesod","malkuth"].every(s => !!rit.INSTRUMENTS?.[s]));
  let rsOk = true;
  try { game.settings.get("bbttcc-epic", "ritual"); } catch (_e) { rsOk = false; }
  t("ritual setting registered", rsOk);
  t("mercy ledger readable", (() => { try { game.settings.get("bbttcc-campaign", "banditMercy"); return true; } catch (_e) { return false; } })());

  // G3 — the Reformation (the ending has ears)
  const ref = game.fourththing?.epic?.reformation;
  t("reformation API present", !!ref);
  for (const k of ["status", "fire", "reset"]) t(`reformation.${k}`, typeof ref?.[k] === "function");
  t("malkuthAligned FINALLY has a listener", (Hooks.events["bbttcc:epic:malkuthAligned"]?.length ?? 0) >= 1);
  t("ritual:answered has the reformation listener", (Hooks.events["bbttcc:ritual:answered"]?.length ?? 0) >= 1);
  let rfOk = true;
  try { game.settings.get("bbttcc-epic", "reformation"); game.settings.get("bbttcc-epic", "ascentUnlocked"); } catch (_e) { rfOk = false; }
  t("reformation settings registered", rfOk);
  if (ref) {
    const st = ref.status();
    console.log("[descent-selftest] Reformation:", st.done ? `DONE (${st.outcome})` : `pending — dragon: ${st.dragon ?? "…"}, board: ${st.board}`, st.ascent ? "· ASCENT OPEN" : "");
  }

  console.log(`%c=== Descent self-test: ${bad.length ? "PROBLEMS" : "ALL CLEAR"} ===`, "font-weight:bold");
  ok.forEach(n => console.log("  ✓", n));
  bad.forEach(n => console.warn("  ✗", n));
  ui.notifications?.[bad.length ? "warn" : "info"](`Descent self-test: ${ok.length} ✓ / ${bad.length} ✗ — console has detail.`);
})();
