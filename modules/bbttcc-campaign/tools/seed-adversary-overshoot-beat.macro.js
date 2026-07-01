/**
 * Bad Eden — SEED: Adversary "Reality Tear" beat  (GM macro)
 *
 * Adds ONE beat to the ACTIVE campaign that the Reality-Tear → Adversary wiring
 * draws when a roll overshoots its DC into the Rupture (+40) or Sundering (+50)
 * band. The system broadcasts `fourththing.overshoot`; bbttcc-campaign's listener
 * calls the injector with the tags below, which selects this beat.
 *
 * Tagged `adversary reality-tear` so it matches BOTH strong bands out of the box.
 * Linked to a scene via `sceneId` (SCENE_UUID) — executeBeat activates it.
 *
 * Idempotent: skips if a beat with this id already exists.
 * Safe: downloads a full `campaigns` backup before writing; aborts if that fails.
 *
 * HOW TO RUN: paste into a Foundry Script Macro (GM), or the dev console, and
 * execute. Leave DRY_RUN = true first to preview; set false to apply.
 */
(async () => {
  const DRY_RUN    = true;                        // <-- set to false to actually write
  const NS         = "bbttcc-campaign", KEY = "campaigns";
  const SCENE_UUID = "Scene.11PUiI2ZTxrtvsGu";    // <-- linked scene (edit if needed)
  const BEAT_ID    = "adversary_reality_tear_watcher_notices";

  const ADVERSARY_BEAT = {
    "id": BEAT_ID,
    "label": "The Watcher Notices — Reality Tear",
    "type": "dialog",
    "timeScale": "moment",
    // These tags are what the overshoot listener matches on (rupture + sundering
    // both include "adversary" and "reality-tear").
    "tags": "adversary reality-tear",
    "politicalTags": "",
    "outcomes": { "success": null, "failure": null },
    "inject": {
      "cooldownTurns": 1,          // Adversary notices at most once per campaign turn
      "repeatable": true,          // it can recur across the whole campaign
      "oncePerHex": false,
      "promptGM": "inherit",
      "fallbackOnDecline": "inherit",
      "allowMulti": "inherit",
      "oncePerHexGlobal": "inherit"
    },
    "actors": [],
    "choices": [
      {
        "label": "Hold still — let the pressure pass over you",
        "next": "",
        "description": "Nobody moves. The attention sweeps the room, finds no name worth speaking, and thins back into the dark between things. (GM: no immediate escalation — but the Adversary now knows this place exists.)",
        "checkStat": "", "checkDC": 0, "failNext": ""
      },
      {
        "label": "Cover the tear — spend a beat masking what you did",
        "next": "",
        "description": "Someone burns an action, a favor, or a small truth to paper over the wound in the world. The notice decays into a rumor. (GM: extract a light cost — 1 Clarity, an OP, or a secret now owed.)",
        "checkStat": "", "checkDC": 0, "failNext": ""
      },
      {
        "label": "Meet its gaze — let the Adversary mark you",
        "next": "",
        "description": "You look back. It looks longer. From here the Sitra Achra is oriented toward you: its Weight arrives sooner, and heavier, and it will spend future beats spending you. (GM: flag this party/faction as Noticed for later Adversary beats.)",
        "checkStat": "", "checkDC": 0, "failNext": ""
      }
    ],
    "encounter": { "key": "", "tier": null, "actorName": "" },
    "worldEffects": {
      "territoryOutcome": null, "factionEffects": [], "radiationDelta": 0,
      "sparkKey": null, "turnRequests": [], "warLog": "", "worldModifiers": [],
      "relationshipEffects": [], "questEffects": []
    },
    "description":
      "You reached too far, and the world felt it.\n\n" +
      "The overshoot doesn't just bruise the local air — it rings a bell on the Other Side. For a heartbeat the seams show: light bends the wrong way, sound arrives before its cause, and something vast and patient turns its head toward the noise you just made.\n\n" +
      "This is the Sitra Achra — the Adversary — noticing. Not attacking. Noticing. The way a landlord notices a light left on in a building he thought was empty.\n\n" +
      "It costs nothing to be seen once. It costs everything to be seen often.\n\n" +
      "(This beat fired because a roll tore reality open by +40 or more. Decide, together, how the party carries the Adversary's attention out of this scene.)",
    "questId": null, "questStep": null, "questRole": null,
    "targetHexUuid": null, "turnNumber": null,
    "cinematic": { "enabled": false, "startSceneId": null, "durationMs": 0, "nextSceneId": null },
    "journal": { "enabled": false, "entryId": null, "force": false },
    "unlocks": { "maneuvers": [], "strategics": [] },
    "timePoints": null,
    "sceneId": SCENE_UUID,          // <-- the linked scene
    "audio": { "enabled": false, "src": "", "volume": 0.85, "loop": false, "autoplay": false, "broadcastPlayers": true },
    "playerFacing": true,
    "refs": {},
    "playerFacingDialog": true,
    "dialogPlayerFacing": true,
    "playerFacingContent": true,
    "showToPlayers": true
  };

  let raw = game.settings.get(NS, KEY);
  const wasString = typeof raw === "string";
  let data = wasString ? JSON.parse(raw) : raw;
  if (!data) return ui.notifications.error("No campaigns setting found.");

  // Locate active campaign across container shapes (keyed map | array | {campaigns:[]}).
  const activeId = game.settings.get(NS, "activeCampaignId");
  const campaign =
      Array.isArray(data)            ? (data.find(c => c?.id === activeId) || data[0])
    : Array.isArray(data?.campaigns) ? (data.campaigns.find(c => c?.id === activeId) || data.campaigns[0])
    :                                  (data[activeId] || Object.values(data).find(c => c?.id === activeId) || Object.values(data)[0]);
  if (!campaign || !Array.isArray(campaign.beats))
    return ui.notifications.error("Could not locate active campaign / beats[].");

  // Sanity: warn (don't block) if the linked scene isn't present in this world.
  let sceneOk = false;
  try {
    const sid = SCENE_UUID.includes(".") ? SCENE_UUID.split(".").pop() : SCENE_UUID;
    sceneOk = !!game.scenes?.get?.(sid);
  } catch (_e) {}

  const exists = campaign.beats.some(b => b?.id === BEAT_ID);

  console.group("%c[Adversary overshoot-beat seeder]", "font-weight:bold");
  console.log("Campaign:", campaign.label || campaign.title, "(" + campaign.id + ") — current beats:", campaign.beats.length);
  console.log("Linked scene:", SCENE_UUID, sceneOk ? "(found ✓)" : "(NOT found in this world ⚠ — beat will still be added; link will no-op until the scene exists)");
  console.log(exists ? "Beat already present — will skip." : "Will add beat: " + BEAT_ID);
  console.groupEnd();

  if (exists) return ui.notifications.info("Adversary beat already seeded — nothing to add.");

  if (DRY_RUN) {
    ui.notifications.warn(`DRY RUN — would add 1 beat ("${ADVERSARY_BEAT.label}") to "${campaign.label || campaign.title}" (${campaign.beats.length} -> ${campaign.beats.length + 1}). Set DRY_RUN=false to apply.`);
    ChatMessage.create({ whisper: [game.user.id], content:
      `<b>Adversary overshoot-beat seeder (DRY RUN)</b><br>Would add <b>${ADVERSARY_BEAT.label}</b> (tags: <code>${ADVERSARY_BEAT.tags}</code>) linked to <code>${SCENE_UUID}</code>${sceneOk ? "" : " <span style='color:#e8c84a'>(scene not found in this world)</span>"}.<br>Set <code>DRY_RUN=false</code> to apply.` });
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

  campaign.beats.push(ADVERSARY_BEAT);
  await game.settings.set(NS, KEY, wasString ? JSON.stringify(data) : data);

  ui.notifications.info(`Adversary beat added — campaign now ${campaign.beats.length} beats. Backup downloaded.`);
  ChatMessage.create({ whisper: [game.user.id], content:
    `<b>Adversary overshoot-beat seeder — APPLIED &check;</b><br>Added <b>${ADVERSARY_BEAT.label}</b> (tags: <code>${ADVERSARY_BEAT.tags}</code>) linked to <code>${SCENE_UUID}</code>.<br>It will now draw automatically on a Rupture (+40) or Sundering (+50) overshoot. A backup file was downloaded first.` });
})();
