/**
 * Bad Eden — FIX: Adversary beat scene link  (GM macro)
 *
 * The "The Watcher Notices — Reality Tear" beat fires correctly but its
 * sceneId doesn't resolve in this world, so the scene jump silently no-ops
 * (executeBeat → _diveScene(null) returns without warning).
 *
 * TWO MODES:
 *   1. DIAGNOSE (default — NEW_SCENE = "")
 *      Prints the beat's current sceneId, whether it resolves, and lists
 *      every scene in the world with likely candidates highlighted.
 *      Read-only; safe to run any time.
 *   2. REPAIR (set NEW_SCENE to a scene name, id, or uuid; DRY_RUN=false)
 *      Downloads a full `campaigns` backup, then patches the beat's sceneId
 *      to the resolved scene's UUID.
 *
 * HOW TO RUN: paste into a Foundry Script Macro (GM), or the dev console.
 */
(async () => {
  const DRY_RUN   = false;    // <-- set false to actually write (repair mode only)
  const NEW_SCENE = "Adversary Beat";      // <-- scene NAME, id, or uuid to relink; "" = diagnose only

  const NS = "bbttcc-campaign", KEY = "campaigns";
  const BEAT_ID = "adversary_reality_tear_watcher_notices";

  // ---- Load campaigns (same container-shape handling as the seeder) ----
  let raw = game.settings.get(NS, KEY);
  const wasString = typeof raw === "string";
  let data = wasString ? JSON.parse(raw) : raw;
  if (!data) return ui.notifications.error("No campaigns setting found.");

  const activeId = game.settings.get(NS, "activeCampaignId");
  const campaign =
      Array.isArray(data)            ? (data.find(c => c?.id === activeId) || data[0])
    : Array.isArray(data?.campaigns) ? (data.campaigns.find(c => c?.id === activeId) || data.campaigns[0])
    :                                  (data[activeId] || Object.values(data).find(c => c?.id === activeId) || Object.values(data)[0]);
  if (!campaign || !Array.isArray(campaign.beats))
    return ui.notifications.error("Could not locate active campaign / beats[].");

  const beat = campaign.beats.find(b => b?.id === BEAT_ID);
  if (!beat) return ui.notifications.error(`Beat '${BEAT_ID}' not found in campaign "${campaign.label || campaign.title}".`);

  // ---- Resolve helper: name | id | uuid -> Scene doc ----
  const resolveScene = async (ref) => {
    const r = String(ref || "").trim();
    if (!r) return null;
    if (r.includes(".")) { try { return await fromUuid(r); } catch (_e) { return null; } }
    return game.scenes.get(r)
        || game.scenes.find(s => s.name === r)
        || game.scenes.find(s => s.name.toLowerCase() === r.toLowerCase())
        || null;
  };

  const currentRef = String(beat.sceneId || "").trim();
  const currentScene = await resolveScene(currentRef);

  console.group("%c[Adversary beat scene-link fixer]", "font-weight:bold");
  console.log(`Campaign: ${campaign.label || campaign.title} (${campaign.id})`);
  console.log(`Beat: ${beat.label}`);
  console.log(`Current sceneId: ${currentRef || "(empty)"} → ${currentScene ? `RESOLVES ✓ ("${currentScene.name}")` : "DOES NOT RESOLVE ✗ (this is why the jump no-ops)"}`);

  // ---- Diagnose mode: list scenes + highlight candidates ----
  if (!NEW_SCENE) {
    const hot = /watch|tear|advers|rift|rupture|sunder|void|dark/i;
    const rows = game.scenes.contents
      .map(s => ({ name: s.name, id: s.id, uuid: s.uuid, active: s.active ? "◀ active" : "", candidate: hot.test(s.name) ? "★ likely" : "" }))
      .sort((a, b) => (b.candidate ? 1 : 0) - (a.candidate ? 1 : 0) || a.name.localeCompare(b.name));
    console.table(rows);
    console.groupEnd();
    const stars = rows.filter(r => r.candidate).map(r => `<b>${r.name}</b> <code>${r.uuid}</code>`).join("<br>");
    ChatMessage.create({ whisper: [game.user.id], content:
      `<b>Adversary beat scene-link — DIAGNOSE</b><br>` +
      `Current link: <code>${currentRef || "(empty)"}</code> — ${currentScene ? `resolves to <b>${currentScene.name}</b> ✓` : "<span style='color:#e8c84a'>does not resolve ✗</span>"}<br>` +
      (stars ? `Likely candidates:<br>${stars}<br>` : "No name-match candidates; see console table for all scenes.<br>") +
      `Set <code>NEW_SCENE</code> to the right scene name/uuid and <code>DRY_RUN=false</code> to repair.` });
    return;
  }

  // ---- Repair mode ----
  const target = await resolveScene(NEW_SCENE);
  if (!target) {
    console.groupEnd();
    return ui.notifications.error(`NEW_SCENE '${NEW_SCENE}' did not resolve to a scene in this world. Run in diagnose mode (NEW_SCENE="") to list scenes.`);
  }
  console.log(`New scene: "${target.name}" → ${target.uuid}`);
  console.groupEnd();

  if (DRY_RUN) {
    ui.notifications.warn(`DRY RUN — would relink '${beat.label}' sceneId: ${currentRef || "(empty)"} → ${target.uuid} ("${target.name}"). Set DRY_RUN=false to apply.`);
    return;
  }

  // BACKUP first — abort if it fails (never write without a restore point).
  try {
    const save = foundry.utils?.saveDataToFile ?? saveDataToFile;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    save(JSON.stringify(data, null, 2), "application/json", "campaigns-backup-" + stamp + ".json");
  } catch (e) {
    console.error(e);
    return ui.notifications.error("Backup download failed — ABORTED. No changes written.");
  }

  beat.sceneId = target.uuid;
  await game.settings.set(NS, KEY, wasString ? JSON.stringify(data) : data);

  ui.notifications.info(`Adversary beat relinked to "${target.name}" (${target.uuid}). Backup downloaded.`);
  ChatMessage.create({ whisper: [game.user.id], content:
    `<b>Adversary beat scene-link — REPAIRED &check;</b><br>` +
    `<b>${beat.label}</b> now links to <b>${target.name}</b> <code>${target.uuid}</code>.<br>` +
    `Next Rupture/Sundering overshoot will activate it.` });
})();
