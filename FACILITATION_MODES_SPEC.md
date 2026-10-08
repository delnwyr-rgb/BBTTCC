# FACILITATION MODES — Campaign Engine spec (BUILT + DEPLOYED 2026-10-07, not committed)

Owner ask (Dave, 2026-10-07): the shipped story content should come with selectable
*facilitation experiences*. Three automated presets + one manual mode. Presets are
GLOBAL (world-scoped) and sit ON TOP of the per-beat authoring fields: a GM writing
their own story still authors text / audio / order per beat; the mode decides what
of that is honoured at the table.

Line refs are to `modules/bbttcc-campaign/scripts/module.js` (9419 lines on 10-07)
unless another file is named. CAPABILITIES.md line numbers for this module are stale.

## 0. Ground truth — what exists today (from the 10-07 code sweep)

| Behaviour | Existing control | Scope | Override point |
|---|---|---|---|
| Beat text to players | `beat.playerFacing` + 4 aliases, OR-ed at `:2394` → Courier whisper → `player-beat-mirror-app.js` | per-beat | `:2394` |
| Choices to players | same mirror; **read-only by design** (`player-beat-mirror-app.js:259`); only the seat running `executeBeat` (GM) can click | per-beat | `:2400` payload + mirror `:259` |
| Narration audio | `beat.audio {enabled, autoplay, broadcastPlayers…}`; `_maybePlayBeatAudio :1585`; `BeatAudioManager.playForBeat` refuses non-GM (`audio/beat-audio-manager.js:405`); mal-voice `dialogueIntroAudio` | per-beat + 1 world bool | `:1585`, `:403`, mal-voice `:2065` |
| Beat advancement | GM Run button → `runBeat :4397`; Director (`director.enabled`, always `_gmPromptStoryBeat :6044`); hex arrival autofire (`api.travel.js:675`, no confirm, relays to GM) | mixed | `executeBeat :3436`, `runHexEnterBeatNow api.travel.js:706` |
| Travel execution | any faction owner may Execute (`bbttcc-travel-console.js:1096/2021`); players forced to `encounterPolicy:"prompt"`; OP debits relay via `op.commit` | none | `bbttcc-travel-console.js:2022`, filter `:1107` |
| NPC AI (mal-voice) | `npcDialoguePlayers` (players may talk), `dialogueEnactMode` (gm-confirm/auto, GM convos only); **no master off, GM always allowed** (`_refusalReason npc-dialogue.js:2636`) | world | `npc-dialogue.js:2635` + `talkTo` entry |
| Roll adjudication | CODE RULE (ruling 2026-08-30): aptitude checks → `_gmAdjudicate :1689`; `op.*` auto-roll `:2168` | none | `:2681`, mirrored `_enactChoiceCore :2436` |
| Any mode/preset | **NONE** | — | register in init block `:8877-9160` |

Known wart to fix in the same pass: `api.campaign.remirrorBeatDialog` (`:9318`)
broadcasts without honouring `playerFacing` or `_visibleChoiceIndices`.

## 1. The model — one world setting, eight policies

```
bbttcc-campaign.facilitation.mode   : "tabletop" | "projectionist" | "autopilot" | "manual"
bbttcc-campaign.facilitation.policy : { …eight keys below… }   (world, GM-writable)
```

Choosing a preset WRITES the eight policy keys (so Manual starts from the last preset
and the GM nudges from there). In Manual the keys are edited directly. One resolver:

```js
// game.bbttcc.api.campaign.facilitation.get() → effective policy object
// game.bbttcc.api.campaign.facilitation.set(mode | partialPolicy)
// Hook: "bbttcc:campaign:facilitationChanged" {mode, policy, prev}
```
Every read site calls `facilitation().<key>`; nothing else reads the raw setting.
Rule for every key: **`authored`** means "honour the per-beat field as written";
the other values override it.

| key | values | Tabletop (GM mode) | Projectionist (Cinematic) | Autopilot (proposed 3rd) |
|---|---|---|---|---|
| `beatText` | authored · never · always | **never** | authored | always |
| `choices` | authored · hidden · mirror · playerPick | **hidden** | mirror (today's behaviour) | playerPick (needs relay, §3) |
| `narration` | authored · gmLocal · off | **off** | authored | authored |
| `beatAdvance` | gmConfirm · silent | gmConfirm | gmConfirm | silent |
| `hexAutofire` | authored · off | authored (GM sees it, players don't) | authored | authored |
| `travelExec` | anyOwner · gmOnly | **gmOnly** | anyOwner | anyOwner |
| `npcAi` | on · off | **off** | on | on |
| `rolls` | rules · gmAll · auto | gmAll | rules (today) | auto |

**Tabletop** = Dave's "GM mode": GM shows the scene and the NPC tokens, narrates
from the GM dialog, no text/choices/audio reach players, players plot travel but the
GM executes, no AI NPCs. **Projectionist** = full interactivity as authored; GM
forwards beats, adjudicates, and role-plays the gaps. **Autopilot** = the engine runs
itself (Director silent, players pick, rolls auto) — PROPOSED as the missing third
automated preset; Dave named only two. ⚠ Needs a ruling.

## 2. Injection points (one line each, all behind the resolver)

1. `beatText` → `:2394` `isPlayerFacing = pol==="always" ? true : pol==="never" ? false : <authored OR>`.
   Same test inside `remirrorBeatDialog :9318` (fixes the wart).
2. `choices` → `:2400` mirror payload: `hidden` strips `choices[]`; `playerPick` sets a
   `canPick` flag the mirror app reads at `:259` to leave buttons live.
3. `narration` → `_maybePlayBeatAudio :1585`: `off` returns early; `gmLocal` forces
   `broadcastPlayers=false`. Mirror in `playForBeat :403` (belt and braces) and in
   mal-voice `dialogueIntroAudio` read `:2065` (treat `off` as false).
4. `beatAdvance` → `directorTick` passes `opts.silent = (pol==="silent")` into
   `_gmPromptStoryBeat :6044` / `_gmPromptTalkInvite :6019`.
5. `hexAutofire` → `runHexEnterBeatNow api.travel.js:706` returns early when `off`.
6. `travelExec` → `bbttcc-travel-console.js:2022`: non-GM seat + `gmOnly` → the
   Execute button becomes **"Hand route to GM"**, which posts the planned route
   (faction, path, cost preview) as a GM-whispered card with a one-click Execute.
   New gmExec type `travel.routeHandoff` (payload = the planned route, validated
   against ownership). The planner stays fully usable for players.
7. `npcAi` → `_refusalReason npc-dialogue.js:2635`: `off` refuses GM and player alike
   with "Facilitation: Tabletop — NPCs are played at the table." Also forces
   `director.autoInvite` behaviour off while `off`.
8. `rolls` → `_runBeatDialog :2681` + `_enactChoiceCore :2436`: `gmAll` routes `op.*`
   checks through `_gmAdjudicate` too (OP still debited on the GM's SUCCESS/FAIL);
   `auto` rolls aptitude checks with `_rollChoiceCheck` instead of asking.

Settings UI: a "Facilitation" settings-menu FormApplication (bbttcc-campaign) —
four radio cards with one-paragraph descriptions, below them the eight policy rows,
greyed unless Manual. Also surfaced as a chip in the Visualizer header. Colour cue
rule applies (blue/yellow + glyph, never red/green alone).

## 3. Gaps the ask exposes (not built today)

- **Players clicking choices** does not exist anywhere outside mal-voice's
  GM-approval card. "Full interactivity" in Projectionist today = players WATCH the
  mirror while the GM clicks. If Dave wants players to pick, that's a new
  `campaign.choice` gmExec relay (validate: beat open on GM seat, choice visible,
  steward owned by the clicker) — moderate work, and it opens the question of
  WHICH player picks when several are present (first click wins vs steward of the
  active faction).
- **Travel handoff card** (§2.6) is new UI, small.
- **`rolls: gmAll`** changes OP economics at the table (GM decides outcome; OP spend
  still happens). Confirm that's wanted in Tabletop or leave Tabletop at `rules`.

## 4. Rulings — RULED by Dave 2026-10-07
R1. ✅ Autopilot IS the third automated mode.
R2. ✅ Projectionist: GM clicks (mirror stays read-only). `playerPick` is Autopilot-only.
R3. ✅ Tabletop rolls = `gmAll`: players roll EVERY check (aptitude AND OP) with real
    dice; the GM records SUCCESS/FAIL in the adjudication dialog. OP is still debited.
R4. ✅ Names: Tabletop / Projectionist / Autopilot / Manual.

## 5. Lint / atlas
- Add `facilitation.*` to CAPABILITIES.md (bbttcc-campaign settings + API + hook,
  Appendix A) in the build session.
- Lint rule candidate (lint-campaign): a beat that is `playerFacing` but has no
  `audio` and no description text is a Tabletop no-op — warn.

## 6. BUILD LOG — 2026-10-07 (deployed local + foundry + ember, F5 to load; NOT committed)
- NEW `modules/bbttcc-campaign/scripts/facilitation.js` — settings (`facilitation.mode` config dropdown with onChange preset
  mirror, hidden `facilitation.policy`), `registerMenu` "Open Facilitation" (AppV2 window: 4 preset cards + 8 selects, greyed
  unless Manual), resolver `facilitation()`, writer `setFacilitation()`, hook `bbttcc:campaign:facilitationChanged`,
  `installFacilitationAPI` → `api.campaign.facilitation.*`. Imported by module.js (no module.json edit).
- module.js: `_facPlayerFacing`; mirror payload `beatId/choicesHidden/canPick/pickToken`; mirror HTML live pick buttons
  (Autopilot) relaying gmExec `bbttcc-campaign:choice.pick`; `__bbttccCurrentBeatDialogPick` handle on the GM dialog
  (presses the real button; pre-selects the clicker's steward; first pick wins); `_maybePlayBeatAudio` off/gmLocal;
  `directorTick` silent default; rolls gmAll/auto in both check paths; `_directorIssueInvites` npcAi gate; `remirrorBeatDialog`
  now async, honours mode + visible choices (the §0 wart).
- api.travel.js `runHexEnterBeatNow`: `hexAutofire off` returns after `_recordPosition`.
- bbttcc-travel-console.js: `travelExec gmOnly` on a player seat → "✋ Hand route to GM" (ride session `stage:"handoff"` +
  GM-whispered card `flags.bbttcc-travel.routeHandoff` + Open-Console button; GM: pick faction → ↻ Resume ride → ▶ Execute).
- npc-dialogue.js: `_facNpcAiOff()` first clause of `_refusalReason` + `talkTo` guard; `_playIntroAudio` narration-off.
- Offline: resolver harness (presets, patch→Manual, patch-equals-preset snaps back, coercion, bad mode throws) ✅.
  node --check (ESM as .mjs) ✅ all five files. CAPABILITIES.md §9/§10/§13 updated.

## 7. LIVE TEST CHECKLIST (Dave / Mags, two seats)
1. Module Settings → bbttcc-campaign → "Facilitation mode" dropdown + "Open Facilitation" button present.
2. Tabletop: run a playerFacing beat → NO mirror on the player seat; GM dialog unchanged; beat audio does not autoplay;
   player Travel Console shows "✋ Hand route to GM" → GM card → Resume ride → Execute; Talk-to-NPC refused on both seats;
   an `op.*` choice goes to the GM SUCCESS/FAIL dialog.
3. Projectionist: everything as before (regression pass).
4. Autopilot: mirror shows live buttons on the player seat; click → GM dialog resolves with that choice; second click says
   "already chosen"; Director tick fires without the prompt; aptitude choice auto-rolls.
5. Manual: change one select, Apply → mode shows Manual; set the eight back to a preset → snaps to that preset's name.
If the dropdown is missing after a hard reload, the browser kept the old module.js: bump bbttcc-campaign module.json
version → pm2 restart + full cache bust (see feedback_modulejson_cachebust_restart).
