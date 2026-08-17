/* bbttcc-onboarding/tools/wire-tutorial-scenes.macro.js
 * GM macro — point each onboarding beat at the Scene it should use.
 *
 * The director resolves tutorial scenes by FLAG, not by name:
 *   flags["bbttcc-onboarding"].tutorialScene = "<key>"
 * A scene that gets rebuilt/replaced (e.g. swapped for an animated map) loses
 * that flag, and the beat silently loses its set dressing. This macro re-points
 * any key at any scene, and CLEARS the key off whatever held it before — two
 * scenes claiming one key would leave resolution to whichever sorted first.
 *
 * Paste into a script macro named "◇ Wire Onboarding Scenes".
 * Direct form (console): game.bbttcc.onboarding.wireScene("meatsuit-range", "6YetGOfAK3IhsZ9k")
 */
(async () => {
  const MOD = "bbttcc-onboarding";
  const KEYS = [
    { key: "incarnation",    label: "Incarnation",        beat: "incarnation" },
    { key: "meatsuit-range", label: "Proving Ground",     beat: "meatsuit — ability test + Straw Adversary" },
    { key: "driving-course", label: "Test Track",         beat: "driving — rig + 4 wrecks" },
    { key: "sandbox-hex",    label: "Sandbox Hold",       beat: "stewardship — Tutelary Hold" },
    { key: "hostile-hex",    label: "Hostile Frontier",   beat: "travel + triple raid finale" }
  ];

  if (!game.user.isGM) { ui.notifications.warn("Wire Onboarding Scenes: GM only."); return; }

  const scenes = [...game.scenes].sort((a, b) => a.name.localeCompare(b.name));
  if (!scenes.length) { ui.notifications.warn("No scenes in this world."); return; }

  const current = (key) => game.scenes.find(s => s.getFlag(MOD, "tutorialScene") === key) || null;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const rows = KEYS.map(k => {
    const cur = current(k.key);
    const opts = [`<option value="">— none —</option>`].concat(
      scenes.map(s => `<option value="${s.id}"${cur?.id === s.id ? " selected" : ""}>${esc(s.name)}</option>`)
    ).join("");
    return `<div class="form-group" style="margin-bottom:0.55em;">
      <label><b>${esc(k.label)}</b> <span style="opacity:0.6;font-size:0.85em">(${esc(k.key)})</span><br>
      <span style="opacity:0.55;font-size:0.8em">${esc(k.beat)}</span></label>
      <select name="${esc(k.key)}" style="width:100%;">${opts}</select>
      <div style="font-size:0.78em;opacity:0.6;">now: ${cur ? esc(cur.name) : "<b style='color:#e07a5f'>NOT WIRED</b>"}</div>
    </div>`;
  }).join("");

  const content = `<div>
    <p style="margin:0 0 0.6em;">Point each onboarding beat at its Scene. Re-pointing a key clears it from the scene that held it.</p>
    ${rows}
  </div>`;

  let picked = null;
  const DV2 = foundry?.applications?.api?.DialogV2;
  if (DV2?.wait) {
    await DV2.wait({
      window: { title: "◇ Wire Onboarding Scenes" },
      content,
      position: { width: 460 },
      buttons: [
        { action: "save", label: "Wire them up", default: true, callback: (_ev, btn) => {
            const root = btn?.form ?? btn;
            picked = {};
            for (const k of KEYS) picked[k.key] = root?.querySelector?.(`[name="${k.key}"]`)?.value || "";
          } },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false, modal: false
    }).catch(() => null);
  } else {
    await new Promise((resolve) => {
      new Dialog({
        title: "◇ Wire Onboarding Scenes", content,
        buttons: {
          save: { label: "Wire them up", callback: (html) => {
              picked = {};
              for (const k of KEYS) picked[k.key] = html.find(`[name="${k.key}"]`).val() || "";
            } },
          cancel: { label: "Cancel" }
        },
        default: "save", close: () => resolve()
      }, { width: 460 }).render(true);
    });
  }

  if (!picked) { ui.notifications.info("Wiring cancelled — nothing changed."); return; }

  const changes = [];
  for (const k of KEYS) {
    const wantId = picked[k.key];
    const had = current(k.key);
    if (had?.id === wantId) continue;                       // already correct

    // Clear the key from every other scene holding it (v14: unsetFlag, not "-=key").
    for (const s of game.scenes) {
      if (s.id !== wantId && s.getFlag(MOD, "tutorialScene") === k.key) {
        try { await s.unsetFlag(MOD, "tutorialScene"); } catch (e) { console.warn("[wire-scenes] unset failed", s.name, e); }
      }
    }
    if (wantId) {
      const sc = game.scenes.get(wantId);
      if (sc) {
        try {
          await sc.setFlag(MOD, "tutorialScene", k.key);
          // Players must be able to VIEW it or the beat's dive lands nowhere.
          const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
          if ((sc.ownership?.default ?? 0) < OBSERVER) {
            await sc.update({ ownership: { ...(sc.ownership ?? {}), default: OBSERVER } });
            console.log(`[wire-scenes] raised "${sc.name}" to default OBSERVER (players can enter).`);
          }
          changes.push(`${k.key} → ${sc.name}`);
        } catch (e) { console.error("[wire-scenes] setFlag failed", sc.name, e); }
      }
    } else if (had) {
      changes.push(`${k.key} → (cleared)`);
    }
  }

  // Report + flag anything still unwired.
  const missing = KEYS.filter(k => !current(k.key)).map(k => k.key);
  console.log("[wire-scenes] wiring now:",
    Object.fromEntries(KEYS.map(k => [k.key, current(k.key)?.name ?? null])));

  if (changes.length) ui.notifications.info(`Onboarding scenes wired: ${changes.join(" · ")}`);
  else ui.notifications.info("Onboarding scenes: nothing to change.");
  if (missing.length) ui.notifications.warn(`Still unwired: ${missing.join(", ")} — those beats will run without their scene.`);
})();
