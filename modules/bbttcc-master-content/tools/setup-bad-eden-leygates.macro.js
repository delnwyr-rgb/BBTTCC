/* setup-bad-eden-leygates.macro.js
 *
 * One-shot Foundry macro that authors the canon Bad Eden Leygate Network on
 * the "Bad Eden, Starting Map" scene. Three bidirectional pairs (six anchor
 * hexes), all initially `enabled:false` so the master quest "The Leyline
 * Stabilizer" can flip them open one beat at a time.
 *
 * NETWORK
 *   Pair 1 (T1 — tutorial):     Furrier's Fixit-Farm  ↔  Port Kudzu
 *   Pair 2 (T2 — established):  Khezek-Tor            ↔  Lyrenn
 *   Pair 3 (T3 — great-power):  Legansus Waystation   ↔  Crown Mall
 *
 * Each anchor has gate.linkHexUuid set to its partner's Drawing UUID, a
 * minFactionTier matching the pair, and gate.enabled left FALSE. Set
 * gate.enabled = true on both ends of a pair when its quest beat resolves.
 *
 * SAFE TO RE-RUN. Existing gate values are normalized; only the six anchor
 * hexes are touched.
 *
 * Paste into a new Foundry macro (Script type) and execute as GM.
 */
(async () => {
  const SCENE_NAME = "Bad Eden, Starting Map";

  const ANCHORS = [
    { name: "Furrier's Fixit-Farm",  partner: "Port Kudzu",          tier: "T1", strength: 0.55 },
    { name: "Port Kudzu",            partner: "Furrier's Fixit-Farm", tier: "T1", strength: 0.55 },
    { name: "Khezek-Tor",            partner: "Lyrenn",              tier: "T2", strength: 0.65 },
    { name: "Lyrenn",                partner: "Khezek-Tor",          tier: "T2", strength: 0.65 },
    { name: "Legansus Waystation",   partner: "Crown Mall",          tier: "T3", strength: 0.80 },
    { name: "Crown Mall",            partner: "Legansus Waystation", tier: "T3", strength: 0.80 }
  ];

  if (!game.user.isGM) { ui.notifications?.error("GM only."); return; }

  const scene = game.scenes.getName(SCENE_NAME);
  if (!scene) { ui.notifications?.error(`Scene "${SCENE_NAME}" not found.`); return; }

  // Build a name → drawing index from this scene's hex drawings.
  const byName = new Map();
  for (const dr of scene.drawings) {
    const flg = dr.flags?.["bbttcc-territory"];
    if (!flg?.isHex) continue;
    const nm = String(flg.name || "").trim();
    if (nm) byName.set(nm, dr);
  }

  // Resolve every anchor first; bail loudly if any are missing.
  const resolved = [];
  for (const a of ANCHORS) {
    const dr = byName.get(a.name);
    const partner = byName.get(a.partner);
    if (!dr)      { ui.notifications?.error(`Missing anchor hex: ${a.name}`); return; }
    if (!partner) { ui.notifications?.error(`Missing partner hex for ${a.name}: ${a.partner}`); return; }
    resolved.push({ ...a, drId: dr.id, partnerUuid: `Scene.${scene.id}.Drawing.${partner.id}` });
  }

  // Compose the update batch.
  const updates = resolved.map(r => {
    const dr = scene.drawings.get(r.drId);
    const existingLey = foundry.utils.deepClone(dr.flags?.["bbttcc-territory"]?.leylines || {});
    const gate = Object.assign(
      { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"T2", locked:false },
      existingLey.gate || {},
      {
        enabled: false,                  // dormant — quest beat flips this true
        linkHexUuid: r.partnerUuid,
        strength: r.strength,
        minFactionTier: r.tier,
        locked: true                      // editor-protect; story content
      }
    );
    return {
      _id: r.drId,
      [`flags.bbttcc-territory.leylines.gate`]: gate
    };
  });

  await scene.updateEmbeddedDocuments("Drawing", updates);

  // Report.
  const lines = resolved.map(r => `  ${r.name}  →  ${r.partner}   [${r.tier}, str ${r.strength}]`);
  const msg = [
    `<h3>Bad Eden Leygate Network — installed</h3>`,
    `<p>Six anchor hexes wired into three bidirectional pairs. All gates start <strong>disabled</strong> (quest beats flip them open).</p>`,
    `<pre style="white-space:pre-wrap; font-size:.9em;">${lines.join("\n")}</pre>`,
    `<p>To open a pair manually for testing: open both anchor hex sheets, check <em>Enabled</em>, save. Travel v2 will then render the gold polyline + portal pulse.</p>`
  ].join("");
  ChatMessage.create({ content: msg, whisper: [game.user.id] });
  ui.notifications?.info("Bad Eden Leygate network installed (6 anchors, 3 pairs).");
})();
