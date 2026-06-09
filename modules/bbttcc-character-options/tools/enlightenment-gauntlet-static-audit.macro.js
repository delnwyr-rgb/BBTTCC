// enlightenment-gauntlet-static-audit.macro.js — RUN IN-WORLD (GM). READ-ONLY (never writes).
// ─────────────────────────────────────────────────────────────────────────────
// ENLIGHTENMENT GAUNTLET · Phase 1 — the static auditor. Sweeps the live Enlightenment
// surface for the bug CLASSES the audit turned up, WITHOUT forging an actor. Catches:
//   V. VOCABULARY SCHISM — the AE-engine ladder (enlightenment.js EFFECTS keys) vs the
//      sheet-dropdown ladder (bbttcc-auto-link ENLIGHTENMENT_ITEM_DATA names). Any level
//      the dropdown can create that the AE engine can't recognize is a silent clobber:
//      detectLevel returns "" → the reconciler wipes the flag + grants no Active Effect.
//   B. DEAD HOOK — bbttcc:enlightenmentChanged listener count (the dropdown fires it; if
//      nothing listens, the dropdown's only working output is its strategic-stat item flags).
//   P. PACK — the enlightenment-levels compendium is reachable and non-empty.
//   F. DORMANT PERKS — the marquee AE flags (opRegenBonus / auraClarity / minorMiracles /
//      healingHalved / darknessSpikes) — flagged here as the wiring backlog (read nowhere).
//
// Output: console tables + JSON (auto-downloaded) + a GM chat card. READ-ONLY.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const MOD = "bbttcc-character-options";
  const F = [];
  const add = (cls, level, name, detail = "") => F.push({ cls, level, name, detail });
  const norm = (s) => String(s ?? "").toLowerCase().trim();
  const slug = (s) => { const m = norm(s).match(/^enlightenment[:\-]\s*(.+)$/); return m ? m[1].trim().replace(/\s+/g, "-") : ""; };

  // The UNIFIED canonical ladder + the legacy AE-vocab the engine still resolves as aliases.
  // Mirrors enlightenment.js (LEVEL_KEYS + ALIASES) by hand — keep in step if the engine retunes.
  const CANONICAL = ["unawakened","awakening","seeking","wisdom","understanding","enlightened","qliphothic"];
  const ALIASES   = { awakened:"awakening", adept:"seeking", illuminated:"wisdom", transcendent:"enlightened", sleeper:"unawakened" };
  const canonSet  = new Set(CANONICAL);
  const recognized = (k) => canonSet.has(k) || (ALIASES[k] && canonSet.has(ALIASES[k]));

  // ══════ V · VOCABULARY (post-unification: dropdown == pack == engine) ══════
  for (const k of CANONICAL) {
    const ok = recognized(k);
    add("V", ok ? "OK" : "BUG", `level "${k}"`,
      ok ? "recognized by AE engine" : `AE engine has NO "${k}" → set via sheet, detectLevel=""→ flag clobbered + no Active Effect`);
  }
  for (const [legacy, canon] of Object.entries(ALIASES))
    add("V", recognized(legacy) ? "OK" : "WARN", `legacy "${legacy}"`,
      recognized(legacy) ? `resolves → "${canon}" (alias)` : "orphaned legacy level");

  // ══════ B · DEAD HOOK ══════
  const listeners = (Hooks?.events?.["bbttcc:enlightenmentChanged"]?.length) ?? 0;
  add("B", listeners > 0 ? "OK" : "WARN", "bbttcc:enlightenmentChanged listeners",
    `${listeners} listener(s)` + (listeners ? "" : " — dropdown fires into the void; AE comes only from the item path"));

  // ══════ P · PACK ══════
  const pack = game.packs.find(p => p.metadata?.name === "enlightenment-levels" || /enlightenment/i.test(p.metadata?.label ?? ""));
  if (!pack) add("P", "WARN", "enlightenment-levels pack", "not found (dropdown still falls back to inline item data)");
  else {
    const idx = await pack.getIndex();
    add("P", idx.size ? "OK" : "WARN", "enlightenment-levels pack", `${idx.size} item(s): ${[...idx].map(e => e.name).join(", ") || "—"}`);
    for (const e of idx) {
      const s = slug(e.name);
      add("P", recognized(s) ? "OK" : "WARN", `pack item "${e.name}"`,
        recognized(s) ? "recognized by AE engine" : `slug "${s}" not in canonical ladder`);
    }
  }

  // ══════ F · SIGNATURE PERKS (opRegenBonus wired; rest await design specs) ══════
  add("F", "OK", "flag bbttcc.enlightenment.opRegenBonus", "WIRED — Enlightened faction ×1.10 OP on Unity/Mercy regen (turn-extensions.enhancer.js)");
  for (const [flag, why] of [
    ["auraClarity",   "perception aura — what does it do to nearby tokens? (design)"],
    ["auraRange",     "aura radius — paired with auraClarity (design)"],
    ["minorMiracles", "undefined mechanic — needs a spec (design)"],
    ["healingHalved", "Qliphothic −50% healing — definable, needs a heal-intercept hook (design)"],
    ["darknessSpikes","Qliphothic darkness damage — definable, needs a darkness check (design)"],
  ]) add("F", "TODO", `flag bbttcc.enlightenment.${flag}`, why);

  // ══════ Module presence ══════
  add("K", game.modules.get(MOD)?.active ? "OK" : "BUG", `module ${MOD}`, game.modules.get(MOD)?.active ? "active" : "INACTIVE");

  // ── Report ──
  const order = { BUG: 0, WARN: 1, TODO: 2, OK: 3 };
  F.sort((a, b) => (order[a.level] - order[b.level]) || a.cls.localeCompare(b.cls));
  const bugs = F.filter(r => r.level === "BUG").length, warns = F.filter(r => r.level === "WARN").length, todos = F.filter(r => r.level === "TODO").length;
  console.log(`%c=== ENLIGHTENMENT GAUNTLET · STATIC AUDIT — ${bugs} BUG · ${warns} WARN · ${todos} TODO (${Math.round(performance.now() - t0)}ms) ===`,
    "font-weight:bold;color:" + (bugs ? "#e66" : warns ? "#ec9" : "#6c6"));
  console.table(F.map(r => ({ cls: r.cls, level: r.level, name: r.name, detail: r.detail })));

  try {
    const blob = new Blob([JSON.stringify({ when: new Date().toISOString(), bugs, warns, todos, findings: F }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "enlightenment-static-audit.json"; a.click();
  } catch (_e) {}

  const rows = F.map(r => `<tr><td>${r.cls}</td><td><b>${r.level}</b></td><td>${r.name}</td><td style="opacity:.8">${r.detail}</td></tr>`).join("");
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<div class="bbttcc card"><h3>🧘 Enlightenment Static Audit</h3>
      <p><b>${bugs}</b> BUG · <b>${warns}</b> WARN · <b>${todos}</b> TODO</p>
      <table style="font-size:11px"><tr><th>cls</th><th>lvl</th><th>name</th><th>detail</th></tr>${rows}</table></div>`
  });
  ui.notifications.info(`Enlightenment audit: ${bugs} BUG · ${warns} WARN · ${todos} TODO (see console + JSON).`);
})();
