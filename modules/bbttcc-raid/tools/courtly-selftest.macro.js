/* courtly-selftest.macro.js — GM, READ-ONLY (writes nothing, plays nothing).
 * Static wiring self-test for the Courtly Intrigue subsystem, in the spirit of
 * the siege-phase-* suite (the courtly engine never had one — atlas cleanup,
 * 2026-08-28). Checks API surface, secret effect-key parity, pack health,
 * maneuver registration, socket envelope declarations, and the mal-voice
 * extraction seams. Results: console.table + one GM whisper.
 */
(async () => {
  if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
  const R = [];
  const pass = (name, ok, note = "") => R.push({ check: name, ok: ok ? "✅" : "❌", note });

  const raid = game.bbttcc?.api?.raid;

  // 1) Engine + scenario surface
  pass("api.raid.courtly (scenario factory)", typeof raid?.courtly === "function");
  pass("api.raid._lastCourtly slot", "_lastCourtly" in (raid ?? {}),
       raid?._lastCourtly ? "scenario LIVE right now" : "empty (normal at rest)");

  // 2) Secrets API + effect-key parity
  const cs = raid?.courtlySecrets;
  pass("api.raid.courtlySecrets", !!cs);
  for (const fn of ["addSecret", "playSecret", "getSecrets", "enforceCap", "describeEffect", "normEffectKeys"]) {
    pass(`courtlySecrets.${fn}`, typeof cs?.[fn] === "function");
  }
  const keys = Array.isArray(cs?.EFFECT_KEYS) ? cs.EFFECT_KEYS : [];
  pass("EFFECT_KEYS present", keys.length >= 15, `${keys.length} keys`);
  const missingInfo = keys.filter(k => !cs?.EFFECT_INFO?.[k]);
  pass("EFFECT_INFO covers every key", missingInfo.length === 0, missingInfo.join(", "));

  // 3) courtly-secrets compendium: reachable, non-empty, every doc's effect keys valid
  const pack = game.packs.get("bbttcc-master-content.courtly-secrets");
  pass("pack bbttcc-master-content.courtly-secrets", !!pack);
  if (pack) {
    const docs = await pack.getDocuments();
    pass("pack has secret templates", docs.length > 0, `${docs.length} docs`);
    const bad = [];
    for (const d of docs) {
      const raw = d.getFlag?.("bbttcc-raid", "secret")?.effectKeys
               ?? d.getFlag?.("bbttcc-raid", "secret")?.effectKey;
      const norm = cs?.normEffectKeys?.(raw) ?? [];
      if (!norm.length || norm.some(k => !keys.includes(k))) bad.push(`${d.name} (${JSON.stringify(raw)})`);
    }
    pass("every pack secret has valid effect keys", bad.length === 0, bad.slice(0, 4).join(" · "));
  }

  // 4) The 12 courtly anytime maneuvers registered with the courtly engine
  const EFFECTS = raid?.EFFECTS ?? {};
  const courtlyKeys = Object.keys(EFFECTS).filter(k => k.startsWith("courtly_"));
  pass("courtly_* maneuvers in EFFECTS", courtlyKeys.length >= 12, `${courtlyKeys.length} found`);
  const wrongEngine = courtlyKeys.filter(k => EFFECTS[k]?.engine && EFFECTS[k].engine !== "courtly");
  pass("courtly maneuvers tagged engine:courtly", wrongEngine.length === 0, wrongEngine.join(", "));
  const noFireMode = courtlyKeys.filter(k => !EFFECTS[k]?.fireMode);
  pass("courtly maneuvers carry fireMode", noFireMode.length === 0, noFireMode.join(", "));

  // 5) Socket envelope declarations (courtlyHook + courtlyPlaySecret)
  const env = game.bbttcc?.api?.agent?.socketEnvelopes?.() ?? {};
  const envTypes = Array.isArray(env) ? env.map(e => e.type ?? e) : Object.keys(env);
  for (const t of ["courtlyHook", "courtlyPlaySecret"]) {
    pass(`socket envelope declared: ${t}`, envTypes.includes(t));
  }

  // 6) mal-voice extraction seams (fail-soft — courtly runs without them)
  const mal = game.bbttcc?.mal;
  pass("mal.npc.armedSecretCount (converseSecret probe)", typeof mal?.npc?.armedSecretCount === "function", mal ? "" : "mal-voice absent (extraction degrades to blind draw)");
  pass("mal.npc.addMemory (betrayal memory)", typeof mal?.npc?.addMemory === "function");

  // 7) Scandal/disgrace faction badge data shape (spot check every faction)
  const shapeBad = [];
  for (const a of game.actors?.contents ?? []) {
    if (a.getFlag?.("bbttcc-factions", "isFaction") !== true) continue;
    const scars = a.getFlag?.("bbttcc-raid", "scandalScars");
    if (scars != null && !Array.isArray(scars)) shapeBad.push(a.name);
  }
  pass("scandalScars flags well-shaped on factions", shapeBad.length === 0, shapeBad.join(", "));

  // Report
  console.table(R);
  const fails = R.filter(r => r.ok === "❌");
  const html = `<h3>♕ Courtly Self-Test — ${fails.length ? `${fails.length} FAIL` : "ALL PASS"}</h3>
    <p>${R.length} checks. ${fails.length ? "Failed: " + fails.map(f => f.check).join(" · ") : "Court is in session."}</p>
    <p style="opacity:0.7">Full table in console (F12). Read-only — nothing was written or played.</p>`;
  await ChatMessage.create({ content: html, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Courtly Self-Test" } });
})();
