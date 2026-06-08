// travel-gauntlet-static-audit.macro.js — RUN IN-WORLD (GM). READ-ONLY (never writes).
// ─────────────────────────────────────────────────────────────────────────────
// TRAVEL GAUNTLET · Phase 1 — the static auditor. Sweeps the live Travel + Environment
// surface for static bug CLASSES without driving a single leg. Catches:
//   K. API WIRING — travelHex / travel.travelHex / travel.arc.rollStep /
//      travel.weather.{archetypes,get} / _hexTravel.TERRAIN_TABLE / radiation.{get,add} /
//      territory.leylines.resolveRemoteAdjacency / op.commit all installed.
//   T. TERRAIN TABLE — every entry has a non-empty cost object + a tier in 1..4, and
//      every cost key is a known OP/mark pool (a typo'd cost key silently never debits).
//   W. WEATHER ARCHETYPES — ≥1 archetype, each with a sane duration {min≤max, ≥1}.
//   X. CROSS-SYSTEM PRESENCE — the env systems travel leans on (radiation, leylines)
//      are actually reachable, else travel silently no-ops their effects.
//
// Output: console tables + JSON (auto-downloaded) + a GM chat card. READ-ONLY.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const api = game.bbttcc?.api;
  if (!api) return ui.notifications.error("game.bbttcc.api not found.");

  const OP_POOLS = new Set(["violence","intrigue","softpower","diplomacy","economy","nonlethal","faith","logistics","siege","body","soul","culture"]);
  const F = [];
  const add = (cls, level, name, detail = "") => F.push({ cls, level, name, detail });
  const norm = (s) => String(s ?? "").toLowerCase().trim();

  // ══════ K · API WIRING ══════
  const checks = [
    ["travelHex",                    api?.travelHex],
    ["travel.travelHex",             api?.travel?.travelHex],
    ["travel.arc.rollStep",          api?.travel?.arc?.rollStep],
    ["travel.weather.archetypes",    api?.travel?.weather?.archetypes],
    ["travel.weather.get",           api?.travel?.weather?.get],
    ["_hexTravel.TERRAIN_TABLE",     api?._hexTravel?.TERRAIN_TABLE],
    ["op.commit",                    api?.op?.commit]
  ];
  for (const [name, v] of checks) add("K", v ? "OK" : "BUG", name, v ? "installed" : "MISSING");

  // ══════ X · CROSS-SYSTEM PRESENCE (travel leans on these) ══════
  add("X", (api?.radiation?.get && api?.radiation?.add) ? "OK" : "WARN", "radiation.{get,add}",
    (api?.radiation?.get && api?.radiation?.add) ? "installed" : "bbttcc-radiation not reachable — RP accrual on travel will silently no-op");
  add("X", api?.territory?.leylines?.resolveRemoteAdjacency ? "OK" : "WARN", "leylines.resolveRemoteAdjacency",
    api?.territory?.leylines?.resolveRemoteAdjacency ? "installed" : "leyline gate resolver missing — gate discount never applies");

  // ══════ T · TERRAIN TABLE ══════
  const TT = api?._hexTravel?.TERRAIN_TABLE;
  if (!TT || typeof TT !== "object") {
    add("T", "BUG", "TERRAIN_TABLE", "missing — no terrain cost/tier data");
  } else {
    const keys = Object.keys(TT);
    add("T", keys.length ? "OK" : "BUG", "terrain count", `${keys.length} terrain keys`);
    for (const k of keys) {
      const spec = TT[k] || {};
      const cost = spec.cost || {};
      const costKeys = Object.keys(cost);
      if (!costKeys.length) add("T", "WARN", `${k}.cost`, "empty cost object (free terrain — intended?)");
      for (const ck of costKeys) {
        if (!OP_POOLS.has(norm(ck))) add("T", "BUG", `${k}.cost`, `cost key "${ck}" is not a known OP pool — it will silently never debit`);
        const v = Number(cost[ck]);
        if (!Number.isFinite(v) || v < 0) add("T", "BUG", `${k}.cost`, `cost "${ck}" not a non-negative number: ${cost[ck]}`);
      }
      const tier = Number(spec.tier);
      if (!Number.isFinite(tier) || tier < 1 || tier > 4) add("T", "BUG", `${k}.tier`, `tier not in 1..4: ${spec.tier}`);
    }
  }

  // ══════ W · WEATHER ARCHETYPES ══════
  const WA = api?.travel?.weather?.archetypes;
  if (!WA || typeof WA !== "object") {
    add("W", "BUG", "weather archetypes", "missing — weather engine not loaded");
  } else {
    const wkeys = Object.keys(WA);
    add("W", wkeys.length ? "OK" : "BUG", "archetype count", `${wkeys.length}: ${wkeys.join(", ")}`);
    for (const wk of wkeys) {
      const dur = WA[wk]?.duration || {};
      const min = Number(dur.min), max = Number(dur.max);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < min) add("W", "BUG", `${wk}.duration`, `bad duration {min:${dur.min}, max:${dur.max}} (need 1 ≤ min ≤ max)`);
    }
  }

  // ══════ REPORT ══════
  const order = { BUG: 0, WARN: 1, INFO: 2, OK: 3 };
  F.sort((a, b) => (order[a.level] - order[b.level]) || a.cls.localeCompare(b.cls));
  const bugs = F.filter(f => f.level === "BUG"), warns = F.filter(f => f.level === "WARN"), infos = F.filter(f => f.level === "INFO");
  const byCls = {};
  for (const f of F) { (byCls[f.cls] ??= { BUG: 0, WARN: 0, INFO: 0, OK: 0 })[f.level]++; }

  console.log(`\n══════ TRAVEL GAUNTLET · STATIC AUDIT ══════`);
  console.log(`${F.length} checks · ${bugs.length} BUG · ${warns.length} WARN · ${infos.length} INFO · ${Math.round(performance.now() - t0)}ms`);
  console.table(Object.entries(byCls).map(([cls, v]) => ({ class: cls, BUG: v.BUG, WARN: v.WARN, INFO: v.INFO, OK: v.OK })));
  if (bugs.length)  { console.log("── BUGS"); console.table(bugs); }
  if (warns.length) { console.log("── WARNINGS"); console.table(warns); }

  try {
    saveDataToFile(JSON.stringify({ world: game.world?.id, when: new Date().toISOString(), counts: { bug: bugs.length, warn: warns.length, info: infos.length }, byCls, findings: F }, null, 2),
      "application/json", `travel-gauntlet-audit-${game.world?.id ?? "world"}.json`);
  } catch (_e) {}

  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#7ab8e8"><div class="ft-roll-header"><span class="ft-roll-name">🛤️ Travel Gauntlet — Static Audit</span></div>
      <p style="margin:0.2rem 0;font-size:0.8rem"><b>${F.length}</b> checks · <b style="color:${bugs.length ? "#ff8a8a" : "#a0d8a0"}">${bugs.length} BUG</b> · <b style="color:#e8c84a">${warns.length} WARN</b>.</p>
      ${(bugs.length || warns.length) ? `<ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.72rem">${[...bugs, ...warns].slice(0, 8).map(b => `<li><b>[${b.cls}/${b.level}]</b> ${foundry.utils.escapeHTML(b.name)} — ${foundry.utils.escapeHTML(b.detail)}</li>`).join("")}</ul>` : `<p style="margin:0.2rem 0;font-size:0.74rem;color:#a0d8a0">No BUG/WARN findings.</p>`}
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Full tables in console · JSON downloaded.</p></div>`
  });
})();
