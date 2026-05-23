# Siege Raid Type — Full Playtest Script (Phases A–F)

A GM walkthrough that exercises the **entire** siege engine end-to-end. Themed lightly as the
**Siege of Troy** to validate the Iliad/Odyssey north-star, but any besieged hex works.

- Run everything as **GM**. The strategic engine is GM-authoritative; players watch via the read-only Siege HUD.
- Each step lists **DO** (the action) → **WATCH** (what you should observe) → and the underlying **API** where useful.
- Console snippets assume you've grabbed the besieged hex's UUID once: open the hex, then
  `const HEX = canvas.tokens?.controlled?.[0]?.document?.parent?.uuid;` — or just use the value the planner shows.
- Spec reference: `SIEGE_RAID_TYPE_SPEC.md`. Wiring oracle: run `tools/siege-phase-{a,c,d,e,f}-selftest.macro.js` first (all green = engine wired).

---

## 0 · Preflight — what the world needs

Before declaring, confirm (console, as GM):

```js
const S = game.bbttcc.api.siege;
// A target hex with at least one Structure layer:
const hex = await fromUuid("<HEX_UUID>");
console.log("layers:", hex.flags?.["bbttcc-territory"]?.structureActorIds);   // ≥1 actor id
console.log("owner :", S.list, hex.flags?.["bbttcc-territory"]?.factionId);    // the DEFENDER faction
// An attacker faction + a depot hex it owns that has a "Supply Line" modifier chain to the target.
```

Checklist:
- [ ] **Target hex** has `structureActorIds` (the wall/gate layers) — or you'll override layers in the planner.
- [ ] **Defender faction** = the target hex owner (`flags.bbttcc-territory.factionId`).
- [ ] **Attacker faction** exists (a BBTTCC faction actor with OP).
- [ ] **Depot hex** owned by the attacker, passing `validateDepot` (own a hex adjacent-ish with a Supply Line chain).
- [ ] **Champion rosters** on both factions: open each faction sheet → **⚔ Champions (N)** button → add 2–3, or hit *Auto-suggest top 5*. (Hector & Paris for Troy; Achilles, Patroclus, Ajax, Agamemnon for the Achaeans.)

```js
S.championCandidates("<attackerFactionId>");          // ranked PCs/bosses/rigs
await S.openChampionRosterDialog("<attackerFactionId>"); // GUI editor
```

---

## Act I · Declare the Siege  *(Phase A / A.5)*

**DO** — Open the **Strategic Activity Planner**, pick **Begin Siege [T2]**. The siege panel appears:
set the **size dial** (Standard for a normal run; **Protracted/Epic** to feel the 10-year Troy grind),
pick the **depot** (✓/✗ shows `validateDepot`), choose **intent** (Sack / Raze / Capture), review the **layer preview**. Plan it.

**WATCH**
- A war-log/chat entry: "Begin Siege … Buffer N OP committed."
- The **⚔ Sieges HUD** appears (top-right) showing the new siege: Buffer bar, `supply: supplied`, layers strip, size.
- `S.list()` returns the active siege; `S.getState(HEX)` shows the full state object.

> If a Bulwark "Siege Cost reduced" output was armed on the attacker, the depot cost is discounted (consumed here).

---

## Act II · The Long Watch  *(Phase B supply tick + Phase C threat vectors)*

**DO** — Advance the campaign turn (your normal turn-advance; fires `bbttcc:advanceTurn:end`). Repeat a few times.
To force a single tick without advancing the world: `await S.tickOne(HEX)`.

**WATCH**
- Buffer **ticks down** each turn (drain = size × terrain × distance × harassment − champion bonus). The HUD Buffer bar **changes colour**: green > 50% → amber 25–50% → **red < 25%** (F.4).
- `supply:` chip tracks **supplied / harassed / severed**. `S.computeDrain(HEX)` shows the breakdown.

**DO (threat vectors)** — From a non-attacker faction, plan against a **supply-path hex**:
`Interdict Supply Line` (strips Supply Line), then attacker `Counter-Interdict` (restores it) or `Escort Supply Line` (cancels a pulse next tick). Defender `Sortie` (sever + Buffer −15 + 1d4 casualties).

**WATCH** — `N cut` chip on the HUD when path hexes are interdicted; next tick the supply status reflects the net interdiction-vs-escort. Severed supply starts the **grace clock** — the chip shows `supply: severed · grace N` (F.4), counting down.

---

## Act III · Omens & Plague  *(Phase F.3 Event Deck)*

**DO** — Keep ticking. Each turn rolls 2d10 ≥ 14 (~28%). When it fires, an event is drawn from the
terrain deck (`S.pickEventDeck` chose it at Begin Siege). To force one for testing:

```js
const st = await S.getState(HEX);
await game.bbttcc.api.siege.events.drawAndApplyEvent({ state: st, hexUuid: HEX, hexDoc: await fromUuid(HEX), turn: 99, deckId: st.eventDeckId || "generic", gateRoll: { roll: 18 } });
await S.setState(HEX, st);   // persist (the tick normally does this)
```

**WATCH** — Amber **⚑ event banner** + chat-card beat: Plague (Buffer −10 + a champion wounded), Good/Bad Omen (morale ± + Anytime budget), Reinforcements (+OP), Prophet's Visitation (morale swing), and — on a long siege (duration ≥ 6) — the rare **Divine Plague** (Buffer −40, 1d4 attacker champions wounded, defender +2 morale).

**DO (Pray for Omen)** — Defender plans **Pray for Omen** (`omenReroll = true`), then trigger another event.
**WATCH** — The beat notes "omen re-rolled in the defender's favour" — the engine drew twice and kept the kinder draw.

---

## Act IV · Champions on the Wall  *(Phase D.4 duel + E.2 levers + F.2 cascade)*

**DO** — On the HUD, click **Duel** (lit when both sides have an active champion), or
`S.openChampionDuelDialog({ hexUuid: HEX })`. Stage **Hector vs Patroclus**. Resolve by roll (margin ≥ 10 is lethal) or declare + tick "Lethal".

**WATCH (the Patroclus loop — F.2)** — On a **kill**:
- Death banner + chat card; the loser flips to `dead`.
- **Champion Death Cascade fires**: if the **attacker's** champion fell → Buffer.violence −20, attacker morale −2, and **30% of each *absent* attacker champion returns to `active`** (Achilles answers). If the **defender's** fell → defender morale −2, absent defenders rally, and the **current layer threshold weakens 10%** ("The Wall Mourns" banner).
- A "☠ … Falls" consequences chat card lists exactly what happened.

**DO (levers)** — `Champion Withdraws` (Achilles sulks → `absent`), later `Champion Returns`; `Champion Defends Wall` (locks a defender active 2 turns, +1 Anytime).

---

## Act V · Relief Force  *(Phase E.3)*

**DO** — Defender (or an ally) plans **Call Relief** (needs a willing ally). A wave is pushed, arriving in **2 ticks**. Advance turns.

**WATCH** — HUD shows `relief ×1` (en route, dim), then on arrival a blue **"Relief Approaches"** banner and the chip turns to a glowing **`relief here ×1`**; the GM **🛡 Relieve** button lights up.

**DO** — Click **🛡 Relieve** (or `S.conveneRelief({ hexUuid: HEX })`). Scene-swaps (if a relief scene is bound), opens the console, and the **Relief Force dialog** appears. Resolve by roll (besiegers hold ties) or declare.

**WATCH**
- **Besiegers hold** → "Relief Repulsed" banner; Buffer −15; defender −1 morale (recorded to `pendingMoraleDeltas`, applied at siege end). Siege continues.
- **Relief breaks through** → `lost_relieved` → jumps straight to **Act IX** (write-back: attacker −2 morale, relieving faction +1 + relationship).

---

## Act VI · The Breach  *(Phase D.1–D.3)*

**DO** — Deal Structure damage to the **current layer** (via the bbttcc-structures damage path / a Catastrophic Entry, or for testing: `S.breachCurrentLayer(HEX)`). Layers fall per their transition rule (Razed / Threshold / Stockpile).

**WATCH**
- **Catastrophic Entry VFX**: red full-screen flash + board shake + "<Layer> Breached" banner; HUD layer strikes through (✗) and the next layer lights (◄). The auto-suggest **pip** glows → click **⚔ Convene** to run the tactical Breach Scene (scene swap + console).
- Breaching the **final** layer → `won_storm` → **Act IX**.

---

## Act VII · Negotiation  *(Phase E.1)*

**DO (Sue for Terms)** — Defender plans **Sue for Terms**; resolve as attacker:
`await S.resolveTerms(HEX, { accept: true })` → `won_sack` (or `{accept:false}` to grind on).

**DO (Demand Surrender)** — Attacker plans **Demand Surrender**; resolve as defender:
`await S.resolveSurrender(HEX, { response: "yield" })` → `won_surrender` · `"parley"` → Buffer +10 · `"refuse"` → defiance.

**WATCH** — Outcome banner (amber "Sacked" / green "Garrison Yields") → **Act IX**.

---

## Act VIII · The Wooden Horse  *(Phase E.4 Trojan Horse + Sinon)*

**DO** — HUD **🐴 Trojan** (or `S.openTrojanHorseDialog({ hexUuid: HEX })`). The 3-roll gate appears: **Sneak** (vs Suspicion = 10 + watching defender champions), **Sabotage** (Faith/Diplomacy), **Breach** (Violence). Optionally enable **Sinon Mode** and pick a champion to sacrifice (+5 all rolls, or one auto-success).

**WATCH**
- **All pass** → violet **"The Gates Open from Within"**; every layer falls at once → `won_trojan_horse` → **Act IX** (defender holdings preserved 50%, "Treachery" modifier).
- **Any fail** → red **"The Ruse is Undone"**; forces halved + Buffer −40 + attacker −2 morale; the siege grinds on.
- **Sinon** → the sacrificed champion dies *regardless* ("… enters the gates" violet banner) and the F.2 cascade fires.

---

## Act IX · The Write-Back  *(Phase F.1 — where it all lands)*

Any terminal outcome fires `bbttcc:siege:outcome`, which the write-back engine consumes (GM-only, once).

**WATCH** — Confirm the world actually changed:
- **Hex**: ownership flips to the attacker (on storm/surrender/trojan/pyrrhic), `["Sacked"]` (+ `"Treachery"` for trojan) modifiers added, an **improvement-ledger** entry recorded.
- **Morale**: both factions moved per the §8 row, **plus** any `pendingMoraleDeltas` (the relief/trojan mid-siege deltas) drained.
- **Buffer refund**: attacker gets a % back via `op.commit` (sack 100% / surrender 50% / trojan 25%).
- **Holdings** (on a taken hex): captured (intent sack/capture) or destroyed (raze) — `flags.bbttcc-raid.siegeFate` stamped, never deleted.
- **War Log saga**: a `siege_resolved` entry with the **full `narrativeBeats[]`** on *both* factions (`flags.bbttcc-factions.warLogs`).
- **End-of-siege chat card** with the retold saga (expand "Siege Saga (N beats)"), the siege flag cleared, and the HUD row gone.

```js
console.log((await fromUuid(HEX)).flags["bbttcc-territory"].factionId);     // → attacker id
console.log(game.actors.get("<attackerId>").getFlag("bbttcc-factions","warLogs").at(-1)); // siege_resolved
```

---

## Outcome forcing table (for systematic testing)

| Outcome | How to trigger |
|---|---|
| `won_storm` | Breach the final layer (`S.breachCurrentLayer(HEX)` until last) |
| `won_sack` | Defender **Sue for Terms** → `S.resolveTerms(HEX,{accept:true})` |
| `won_surrender` | Attacker **Demand Surrender** → `S.resolveSurrender(HEX,{response:"yield"})` |
| `won_trojan_horse` | **🐴 Trojan** dialog, pass all 3 rolls (Sinon auto-success helps) |
| `lost_hold` | Tick until Buffer hits 0 with supply intact |
| `lost_supply_crisis` | Sever supply (Interdict path) + let grace expire, then Buffer 0 |
| `lost_relieved` | **Call Relief** → arrives → **Relieve** → relief wins |
| `lost_pyrrhic` *(no auto-trigger yet)* | Force: set `status` + fire outcome (snippet below) |
| `abandoned` *(no auto-trigger yet)* | Force: set `status` + fire outcome (snippet below) |

```js
// Force any terminal outcome through the real write-back (incl. pyrrhic / abandoned):
const s = await S.getState(HEX); s.status = "lost_pyrrhic"; await S.setState(HEX, s);
Hooks.callAll("bbttcc:siege:outcome", { siegeId: s.siegeId, hexUuid: HEX, status: s.status });
```

> `lost_pyrrhic` (storm with >50% attacker losses) and `abandoned` (attacker withdraws) have **matrix rows** that write back correctly, but no *automatic* detector/activity triggers them yet — they're GM-invoked for now (a candidate for a later pass / Phase G).

---

## Debug & VFX cheat-sheet

```js
const S = game.bbttcc.api.siege;
S.list();                                  // active sieges
S.getState(HEX); S.computeDrain(HEX);      // inspect
S.tickOne(HEX); S.tickAll();               // force a strategic tick
S.breachCurrentLayer(HEX);                 // force the current layer to breach
S.openChampionDuelDialog({hexUuid:HEX});
S.openChampionRosterDialog("<factionId>");
S.conveneRelief({hexUuid:HEX}); S.resolveRelief({hexUuid:HEX, outcome:"attacker_won"});
S.openTrojanHorseDialog({hexUuid:HEX});
S.resolveTerms(HEX,{accept:true}); S.resolveSurrender(HEX,{response:"yield"});
S.applyOutcomeWriteback(HEX);              // re-run write-back for the current status
S.runChampionCascade({siegeId:"<id>", hexUuid:HEX, championId:"<actorId>", side:"attacker"});
S.events.drawAndApplyEvent({...}); S.events.reloadDecks();
S.refreshHud();

// VFX previews (no state change):
["layerBreached","convene","outcome","championDuel","reliefArrives","reliefConvene",
 "reliefRepulsed","trojanHorse","trojanFailed","cascade","event"]
  .forEach(k => S.previewVfx(k, { side:"attacker", rallied:[], status:"won_storm", name:"Plague" }));
```

---

## Regression watch-list (the gotchas these phases hit)

- **Single writer**: only the GM mutates siege state. The write-back, cascade, and tick guard `game.user.isGM`; relays re-fire hooks on other clients for VFX/HUD only.
- **Players see it live**: with a 2nd (player) client connected, the read-only HUD should update on tick, event, duel, breach, relief, and cascade — not just on your local actions. (F.4 relays `ticked` + `championStatus`.)
- **pendingMoraleDeltas**: relief-repulsed (def −1) and trojan-fail (atk −2) land at **siege end** via the write-back drain, not mid-siege. Verify they show up in the final morale move.
- **No double-write**: a terminal outcome firing twice should write back once (idempotent — the siege flag is cleared after the first).
- **OP units**: Buffer is OP; `opBank` is marks (×10). A refund of 60 OP = 600 marks. Watch the attacker's OP, not a 10× error.
- **Holdings are non-destructive**: "destroyed" holdings get a `siegeFate` flag + drop off the hex roster; the actors still exist (undo-friendly).
