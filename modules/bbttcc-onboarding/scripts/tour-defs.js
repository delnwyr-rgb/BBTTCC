/* bbttcc-onboarding/scripts/tour-defs.js
 * The tour catalog. Each definition drives the runner in tours.js against a REAL
 * interface — the player's own sheet/console, never a mock-up. Keep card text
 * mechanics-first (what it is → what it does → when you'd use it); keep the
 * Operator's speak lines for flavor at the seams, not inside every step.
 *
 * Rollout tracker (owner ask 2026-07-05):
 *   ✅ steward-sheet ✅ bridge ✅ faction-sheet (below)
 *   ✅ hex-sheet ✅ travel-console ✅ planner-hud ✅ raid-console
 *   ✅ rig-sheet ✅ market ✅ banks
 *   GM: ✅ faction-gm ✅ facilities ✅ hex-craft ✅ turn-driver ✅ dashboard
 *       ✅ overview ✅ campaign-engine ✅ beat-editor ✅ story-console — ALL DONE
 */

const TAG = "[onboarding/tour-defs]";

/* ───────────────────── PLAYER · Steward sheet ───────────────────── */

const stewardSheetTour = {
  id: "steward-sheet",
  title: "The Meatsuit Interface (Steward Sheet)",
  audience: "player",
  intro: "Pulling up your chassis diagnostics— *bzzt* —your sheet. This is the meatsuit's control surface. Touring it top to bottom; everything here is live, so feel free to poke.",
  outro: "Tour complete. The meatsuit manual is— —static— —is you, now. Hover anything on the sheet for the fine print.",

  open: async (ctx) => {
    const sheet = ctx.steward?.sheet;
    if (!sheet) {
      ui.notifications?.warn?.("No Steward assigned — set your character (player config → Select Character) and rerun the tour.");
      return null;
    }
    await sheet.render(true);
    return sheet;
  },

  steps: [
    {
      id: "identity", title: "Who the meat says you are",
      selector: ".ft-header",
      text: "Your identity block: Path, Ancestry, Heritage and Doctrine set what your body can learn; the Faction pill links to the people who claim you.\nInitiation is your level — Tier gates the strongest gear, manifestations and faction plays."
    },
    {
      id: "faculties", title: "Faculties — the six dials",
      selector: ".ft-attr-grid",
      text: "The six Faculties are your raw capabilities. Every check in the game reads one of them.\nThe ⚀ button rolls a bare Faculty test (2d10, tens explode, + the Faculty) — used for contests and anything without a trained Aptitude.",
      speak: "Six dials. The factory settings were better, but these are yours."
    },
    {
      id: "pools", title: "Integrity & Stress",
      selector: ".ft-derived",
      text: "Integrity is the meat's hit points — run out and the body stops cooperating.\nStress is psychic load: manifestation strain, horror, overreach. It recovers with rest and scene breaks; maxing it out breaks something you'd rather keep."
    },
    {
      id: "defenses", title: "Guard · Evasion · Resolve",
      selector: ".ft-defenses",
      text: "Your three defenses. Guard turns hits aside, Evasion keeps you from being hit at all, Resolve holds the mind together against fear, coercion and the uncanny.\nEach has its own ⚀ roll (2d10 explode + defense) when the world tests you directly. The chips underneath list immunities ⦿, resistances ◑ and vulnerabilities ▲."
    },
    {
      id: "tabs", title: "The eight tabs",
      selector: ".ft-tabs",
      text: "Everything else lives behind these: Steward (this overview), Engagement (combat), Aptitudes (trained skills), Manifestations (your powers), Principles (class features), States (active effects), Inventory, and The Work (the long game).\nWe'll hit the important ones now."
    },
    {
      id: "aptitudes", title: "Aptitudes — trained skill ranks",
      pre: '.ft-tabs a[data-tab="skills"]',
      selector: '.ft-body .tab[data-tab="skills"]',
      text: "Aptitudes are Faculties with training. Ranks run 0–5 and each rank stacks a permanent benefit: Trained stops fumbles, Proficient rerolls your lowest die, Expert floors dice at 4, Master rolls 3d10 drop-lowest, Legendary auto-succeeds once per scene.\nHover any rank label for the full accrued list."
    },
    {
      id: "manifestations", title: "Manifestations — the reality dials",
      pre: '.ft-tabs a[data-tab="powers"]',
      selector: '.ft-body .tab[data-tab="powers"]',
      text: "Your manifestations live here — cast from this tab, sustained against your Clarity.\nNew ones are authored in the Manifestation Engine (the step-by-step builder); every knob in that wizard has its own hover explanation when you get there."
    },
    {
      id: "states", title: "States — what's riding you",
      pre: '.ft-tabs a[data-tab="effects"]',
      selector: '.ft-body .tab[data-tab="effects"]',
      text: "Active conditions, buffs, debuffs and lingering effects. Temporary ones list their clock and fall off when it runs out.\nIf something feels wrong with your numbers, look here first — something usually is."
    },
    {
      id: "inventory", title: "Inventory",
      pre: '.ft-tabs a[data-tab="inventory"]',
      selector: '.ft-body .tab[data-tab="inventory"]',
      text: "Carried gear, weapons and armor. Items you lack the training to use are flagged — untrained armor and weapons work badly, when they work at all.\nEquip state matters: only equipped items contribute."
    },
    {
      id: "tikkun", title: "The Work",
      pre: '.ft-tabs a[data-tab="tikkun"]',
      selector: '.ft-body .tab[data-tab="tikkun"]',
      optional: true,
      text: "The long game — repairing the world, not just surviving it. Progress here tracks your part in the repair and unlocks the campaign's highest-tier play.\nIt fills slowly. That's the point."
    },
    {
      id: "editmode", title: "Edit mode",
      selector: ".ft-edit-mode-btn",
      text: "The ✎ toggle exposes the raw inputs — direct rank edits, identity fields, the normally-locked plumbing.\nDay to day you leave it off; the sheet plays itself through clicks and rolls."
    },
    {
      id: "faction", title: "Your faction — the bigger body",
      selector: ".ft-id-faction",
      text: "You aren't just a body — you're a stake in a faction. The → button opens its sheet: OP banks, territory, politics, the strategic layer.\nThat interface has its own tour when you're ready.",
      speak: "Meatsuit: toured. Next size up is the faction — a body made of people. Different manual— *bzzt* —same principle."
    }
  ]
};

/* ───────────────────── PLAYER · The Bridge ───────────────────── */
// Steward ↔ Faction OP exchange. Anchors + text come from the "bridge" help
// dictionary registered by bbttcc-core/scripts/bbttcc-bridge.js — one source.

const bridgeTour = {
  id: "bridge",
  title: "The Bridge (Steward ↔ Faction OP)",
  audience: "player",
  intro: "Opening the Bridge — the exchange rate between your meat and your movement. Everything you burn here, somebody collects on later. That's not a warning, it's— *bzzt* —it's accounting.",
  outro: "Bridge tour complete. Sacrifice makes the faction strong; backing makes you dangerous; Blood Debt makes the world remember. Spend accordingly.",

  open: async (ctx) => {
    const bridge = game.bbttcc?.api?.bridge;
    if (!bridge?.open) {
      ui.notifications?.warn?.("Bridge not loaded — is bbttcc-core enabled?");
      return null;
    }
    bridge.open(ctx.steward?.id);
    return null; // dialog mounts on document.body; steps find it by data-tour anchors
  },

  steps: [
    { id: "faction",   title: "The faction side",   selector: '[data-tour="bridge.faction"]',   help: ["bridge","faction"] },
    { id: "actor",     title: "The steward side",   selector: '[data-tour="bridge.actor"]',     help: ["bridge","actor"] },
    { id: "sacrifice", title: "Manifestation — paying power IN", selector: '[data-tour="bridge.sacrifice"]', help: ["bridge","sacrifice"],
      speak: "Four currencies, one meat. The exchange never favors you. It's not supposed to." },
    { id: "opqty",     title: "OP quantity = Blood Debt", selector: '[data-tour="bridge.mOpQty"]', help: ["bridge","mOpQty"] },
    { id: "manifest",  title: "The sacrifice button", selector: '[data-tour="bridge.manifestBtn"]', help: ["bridge","manifestBtn"] },
    { id: "bspend",    title: "Backing — drawing power OUT", selector: '[data-tour="bridge.bSpend"]', help: ["bridge","bSpend"] },
    { id: "bkind",     title: "What gets rolled", selector: '[data-tour="bridge.bRollKind"]', help: ["bridge","bRollKind"] },
    { id: "bmode",     title: "Flat or dice", selector: '[data-tour="bridge.bMode"]', help: ["bridge","bMode"] },
    { id: "backing",   title: "The backing button", selector: '[data-tour="bridge.backingBtn"]', help: ["bridge","backingBtn"] }
  ]
};

/* ───────────────────── PLAYER · Faction sheet ───────────────────── */
// V1 ActorSheet. Tabs switch via nav.bbttcc-tabs a.item[data-tab] clicks; panels
// are display:none until active, so every off-Overview step uses `pre`.
// Several cards are enhancer-injected after render → marked optional.

function _resolveFactionForTour(ctx) {
  if (ctx.faction) return ctx.faction;
  const api = game.bbttcc?.api;
  return game.actors.find(a => {
    try {
      const k = api?.actorKind?.(a);
      if (k) return k === "faction";
      return a.type === "faction" || !!a.getFlag?.("bbttcc-factions", "isFaction");
    } catch (_) { return false; }
  }) || null;
}

async function _openFactionSheet(ctx) {
  const faction = _resolveFactionForTour(ctx);
  if (!faction) {
    ui.notifications?.warn?.("No faction found — found one first (or link your Steward to a faction), then rerun the tour.");
    return null;
  }
  await faction.sheet?.render(true);
  return faction.sheet;
}

const factionSheetTour = {
  id: "faction-sheet",
  title: "The Bigger Body (Faction Sheet)",
  audience: "player",
  intro: "Opening your faction — a body made of people, land and leverage. Same idea as the meatsuit, bigger stakes, slower heartbeat. One Turn per beat.",
  outro: "Faction toured. Your steward acts in scenes; your faction acts in Turns. Keep both alive and the world starts answering to you.",
  open: _openFactionSheet,

  steps: [
    {
      id: "hero", title: "Identity & vitals",
      selector: "fieldset.bbttcc-card-overview-hero",
      text: "The faction at a glance: crest, name, power-level status, Total OPs against your budget, and the Victory Points / Unity chip.\nVP runs a 0–25 ladder — 25 triggers a campaign resolution beat."
    },
    {
      id: "opbank", title: "The OP Bank — nine kinds of power",
      selector: "fieldset.bbttcc-header-card-opbank",
      text: "Banked Operation Points across nine tracks — Violence, Nonlethal, Intrigue, Economy, Soft Power, Diplomacy, Logistics, Culture, Faith.\nThe bank persists across Turns and pays for everything: raids, markets, backing, builds. Bank math: 1 OP = 10 marks. Hover any column header for what that track buys.",
      speak: "Nine currencies. Your enemies only ever count one of them. That's how you beat them."
    },
    {
      id: "dashboard", title: "The dashboard tiles",
      selector: ".bbttcc-fdash-row",
      optional: true,
      text: "Big-number tiles with trend arrows — Victory, Unity, Morale, Loyalty. These update automatically each Turn; the arrows tell you which way the wind is blowing before the numbers get dangerous."
    },
    {
      id: "health", title: "Faction health tracks",
      selector: "fieldset.bbttcc-card-health",
      text: "The internal weather: Unity (cohesion — low invites schism), Morale (fight — modifies OP rolls), Loyalty (adherence — low risks defections), Darkness (Qliphothic taint — corrupts rolls and recruits).\nAll update automatically each Turn. Hover each for the full mechanics."
    },
    {
      id: "ops", title: "Organization Points — rolling power",
      selector: "section.bbttcc-tab-overview fieldset.bbttcc-card-ops",
      text: "Each track has a Value plus your Roster's contribution. The ⚀ rolls 2d10 (10s explode) + Value + Roster.\nEvery 10 rolled banks Momentum. The +/− arrows adjust the bank by 1."
    },
    {
      id: "momentum", title: "Momentum — the strategic surge",
      selector: "button[data-bbttcc-momentum-spend]",
      optional: true,
      text: "Momentum banks +1 for every 10 rolled on OP checks and resets each Turn — spend it or lose it.\nThe menu: 1 arms +1d10 on your next OP roll, 2 forces an opposed reroll, 3 refunds an OP cost, 5 is Reshape Strategy (GM-gated)."
    },
    {
      id: "politics", title: "Political Pressure",
      selector: "fieldset.bbttcc-card-politics",
      optional: true,
      text: "Your people have opinions. The Center is the dominant philosophy; Drift (−100..+100) is pressure against it, escalating the State: Stable → Strained → Fractured → Rupturing.\nRupturing factions can split or flip. Soft-power campaigns, atrocities and succession crises all feed Drift."
    },
    {
      id: "raid", title: "Activities — the Raid console",
      pre: 'nav.bbttcc-tabs a.item[data-tab="activities"]',
      selector: "button[data-open-raid-console]",
      text: "The Activities tab is where the faction acts. Open Raid stages an assault, infiltration or courtly intrigue against a target hex or faction — you commit OP and maneuvers, the GM resolves rounds.\nThe Raid console has its own tour."
    },
    {
      id: "planned", title: "The Next Turn queue",
      selector: "fieldset.bbttcc-card-planned",
      optional: true,
      text: "Strategic actions staged here fire when the GM advances the Turn (Apply). Anything flagged 'Cannot afford' will fizzle — check your bank before the Turn ticks."
    },
    {
      id: "quests", title: "Quest Log",
      selector: "fieldset.bbttcc-card-quests",
      optional: true,
      text: "Your faction's open and completed quests — the story's ledger of what you've promised and delivered. Opens in its own window."
    },
    {
      id: "secrets", title: "Courtly Secrets",
      selector: 'tr.bbttcc-doctrine-row[data-kind="secret"]',
      optional: true,
      text: "Leverage with a shelf life — you hold up to five Secrets, Stolen or Earned.\nThe Play button only lights up during an active Courtly/Presence raid: that's when a secret becomes a weapon."
    },
    {
      id: "tier", title: "Assets — Tier & capacity",
      pre: 'nav.bbttcc-tabs a.item[data-tab="assets"]',
      selector: ".bbttcc-tier-assets-wrap",
      optional: true,
      text: "Faction Tier gates what you can field — higher tier, bigger plays, cheaper Bridge sacrifices.\nThe capacity strip shows asset load; the pressure chips (Overextension, Upkeep, Risk) warn when the empire is heavier than the foundation."
    },
    {
      id: "hexes", title: "Owned Hexes — the land itself",
      selector: "fieldset.bbttcc-card-owned-hexes",
      optional: true,
      text: "Every hex the faction holds, with per-Turn yields. Open any hex sheet from here.\nLand is where OP actually comes from — the Hex sheet has its own tour."
    },
    {
      id: "roster", title: "Relationships — the Roster",
      pre: 'nav.bbttcc-tabs a.item[data-tab="relationships"]',
      selector: "fieldset.bbttcc-card-roster",
      optional: true,
      text: "The people who ARE the faction. Each member's aptitudes contribute to OP rolls per track (totals = Value + Roster).\nThis is you, by the way — your Steward's row feeds every faction roll."
    },
    {
      id: "trade", title: "Trade inbox & history",
      selector: "#bbttcc-trade-inbox-card",
      optional: true,
      text: "Offers from other factions land here — Accept, Decline or Counter. The history card below is the receipts.\nBigger deals (Allied Sends, brokered exchanges) run through the Exchange dialogs."
    },
    {
      id: "warlogs", title: "War Logs — the memory",
      pre: 'nav.bbttcc-tabs a.item[data-tab="warlogs"]',
      selector: "fieldset.bbttcc-card-warlogs",
      optional: true,
      text: "Everything the faction has done or suffered — Turns, commits, raids, outcomes. When you're arguing about how the war started, the answer is in here.",
      speak: "The war log never argues back. That's what makes it the most dangerous document you own."
    }
  ]
};

/* ───────────────────── GM · Faction sheet (edit controls) ───────────────────── */

const factionGmTour = {
  id: "faction-gm",
  title: "Faction Sheet — GM Controls",
  audience: "gm",
  intro: "GM channel. Same faction sheet the players see, plus the levers they don't. Touring the override surface— *bzzt* —use it gently or don't get caught.",
  outro: "GM controls toured. Everything you apply through the Manual Edit writes an audit line to the War Logs — the world keeps receipts, even on you.",
  open: _openFactionSheet,

  steps: [
    {
      id: "toggle", title: "The Edit toggle",
      selector: ".bbttcc-gm-edit-toggle",
      text: "This header button flips GM Edit Mode (a world setting) and re-renders the sheet.\nOFF, the sheet is what players see. ON, the GM Manual Edit fieldset appears on Overview."
    },
    {
      id: "gmedit", title: "GM Manual Edit",
      selector: "fieldset.bbttcc-card-gmedit",
      optional: true,
      onEnter: async () => {
        if (!document.querySelector("fieldset.bbttcc-card-gmedit")) {
          document.querySelector(".bbttcc-gm-edit-toggle")?.click();
          await new Promise(r => setTimeout(r, 500));
        }
      },
      text: "Direct writes to the canonical flags: OP bank per track (in OP units), Morale/Loyalty/Darkness, VP and Unity.\nStage values, add an audit note, then Apply commits everything at once — and logs a gm_adjustment entry in the War Logs. Clear discards. Copy ID grabs the faction's actor id for macros."
    },
    {
      id: "politics", title: "Political override & drift nudges",
      selector: "select[data-pol-override]",
      optional: true,
      text: "Override the faction's political Center outright, or nudge Drift by ±5/±20 to push a faction toward (or back from) Strained, Fractured, Rupturing. Reset zeroes the drift.\nUse for story beats the simulation didn't earn on its own."
    },
    {
      id: "doctrines", title: "Granting doctrines",
      pre: 'nav.bbttcc-tabs a.item[data-tab="activities"]',
      selector: 'button[data-doctrine-act="add"]',
      optional: true,
      text: "The Add buttons on Maneuvers, Strategic Activities and Courtly Secrets are GM-only — grant from the Doctrines catalog, or drag entries onto the dropzones.\nRemove links revoke. Players can open and read what they hold, not change it."
    },
    {
      id: "advance", title: "Advance Tier",
      pre: 'nav.bbttcc-tabs a.item[data-tab="assets"]',
      selector: "button.bbttcc-tier-advance-btn",
      optional: true,
      text: "Runs the tier-advancement check: the victory-gate report lists anything blocking (capacity, stability, victory conditions) and advances the tier when eligible.\nTier feeds raid gating, asset capacity and Bridge pricing — it's the biggest single dial on a faction."
    },
    {
      id: "stockpile", title: "Stockpile adjustments",
      selector: 'button[data-action="adjust"]',
      optional: true,
      text: "GM-only manual edits to the material stockpile — players get deposit/withdraw, you get the thumb on the scale."
    }
  ]
};

/* ───────────────────── PLAYER · Hex sheet ───────────────────── */
// Anchors + text come from the "hex" help dictionary registered by
// bbttcc-territory/scripts/bbttcc-hex-sheet.enhancer.js. Opens a hex the
// player's faction owns when possible, else any territory hex.

function _findHexUuidForTour(ctx) {
  const fid = ctx.faction?.id || null;
  let ownedAnywhere = null, anyCurrent = null, anyAnywhere = null;
  const scan = (scene, isCurrent) => {
    for (const d of scene?.drawings ?? []) {
      const f = d.flags?.["bbttcc-territory"];
      if (!f) continue;
      const owner = String(f.factionId || f.ownerId || "").trim();
      if (fid && owner === fid) { if (isCurrent) return d.uuid; ownedAnywhere = ownedAnywhere || d.uuid; }
      if (isCurrent) anyCurrent = anyCurrent || d.uuid;
      anyAnywhere = anyAnywhere || d.uuid;
    }
    return null;
  };
  const hit = scan(canvas?.scene, true);
  if (hit) return hit;
  for (const s of game.scenes) { if (s !== canvas?.scene) scan(s, false); if (ownedAnywhere) break; }
  return ownedAnywhere || anyCurrent || anyAnywhere;
}

const hexSheetTour = {
  id: "hex-sheet",
  title: "The Land Itself (Hex Sheet)",
  audience: "player",
  intro: "Opening a hex — one tile of the world, with its own economy, weather and grudges. This is what your faction is actually made of. Stewarding it well is— *bzzt* —is the whole job, honestly.",
  outro: "Hex toured. Land makes OP, OP makes power, power protects land. Break the loop anywhere and the other two follow it down.",

  open: async (ctx) => {
    const open = game.bbttcc?.api?.territory?.openHexSheet;
    if (!open) { ui.notifications?.warn?.("Hex sheet API not loaded — is bbttcc-territory enabled?"); return null; }
    const uuid = _findHexUuidForTour(ctx);
    if (!uuid) { ui.notifications?.warn?.("No territory hexes found on any scene — claim or create one first."); return null; }
    await open(uuid);
    return null; // app mounts on document.body; steps find it by data-tour anchors
  },

  steps: [
    { id: "identity", title: "What this tile is",       selector: '[data-tour="hex.identity"]', help: ["hex","identity"] },
    { id: "owner",    title: "Who holds it",            selector: '[data-tour="hex.owner"]',    help: ["hex","owner"] },
    { id: "holdings", title: "Holdings — what's stationed here", selector: '[data-tour="hex.holdings"]', help: ["hex","holdings"], optional: true,
      speak: "Garrisons defect after three turns of neglect. The land remembers who feeds it." },
    { id: "tracks",   title: "Integration & the local tracks", selector: '[data-tour="hex.tracks"]', help: ["hex","integration"], optional: true },
    { id: "radiation", title: "Radiation — the slow enemy", selector: '[data-tour="hex.radiation"]', help: ["hex","radiation"], optional: true },
    { id: "pressure", title: "Pressure & conditions",   selector: '[data-tour="hex.pressure"]', help: ["hex","pressure"], optional: true },
    { id: "tabs",     title: "Overview vs Dossier",     selector: '[data-tour="hex.tabs"]',     help: ["hex","tabOverview"] },
    { id: "yields",   title: "Yields — where OP comes from", pre: 'button[data-bbttcc-hex-tab="overview"]', selector: '[data-tour="hex.yields"]', help: ["hex","yields"],
      speak: "Every mark your faction spends started life as a pip on a tile like this one." },
    { id: "nodes",    title: "Resource nodes & harvesting", selector: '[data-tour="hex.nodes"]', help: ["hex","nodeHarvest"], optional: true },
    { id: "bu",       title: "Build Units — engineering throughput", selector: '[data-tour="hex.buildUnits"]', help: ["hex","buildUnits"], optional: true },
    { id: "fortify",  title: "Fortify / Repair / Build", selector: '[data-tour="hex.fortify"]', help: ["hex","buFortify"], optional: true },
    { id: "dossier",  title: "The Dossier — reading the land", pre: 'button[data-bbttcc-hex-tab="dossier"]', selector: '[data-tour="hex.whatsHere"]', help: ["hex","whatsHere"], optional: true },
    { id: "next",     title: "Next steps",              selector: '[data-tour="hex.nextSteps"]', help: ["hex","nextSteps"], optional: true }
  ]
};

/* ───────────────────── PLAYER · Travel Console ───────────────────── */
// AppV2 singleton at game.bbttcc.ui.travelConsole (no args). The DOM is
// injected by _onRender — selectors below are the JS-built ones (both
// travel-console.hbs files are decoys; do not target them).

const travelConsoleTour = {
  id: "travel-console",
  title: "Moving the Meat (Travel Console)",
  audience: "player",
  intro: "Opening the Travel Console. The map is not the territory, but this thing charges you OP for both. Plot the route BEFORE you pay for it— *bzzt* —radiation doesn't refund.",
  outro: "Travel toured. Cheap routes are slow, fast routes glow in the dark, and the weather hates everyone equally. Plan accordingly.",

  open: async () => {
    const tc = game.bbttcc?.ui?.travelConsole;
    if (!tc) { ui.notifications?.warn?.("Travel Console not loaded — is bbttcc-travel enabled?"); return null; }
    await tc.render(true);
    return tc;
  },

  steps: [
    {
      id: "hero", title: "The route table",
      selector: ".bbttcc-travel-hero",
      text: "Plot a multi-leg route across the hex map, price it, then execute it as one commitment.\nYour faction auto-detects from whatever token you had selected."
    },
    {
      id: "faction", title: "Lead faction — who pays",
      selector: '#bbttcc-travel-console [data-role="faction"]',
      text: "The lead faction's OP pool pays for the route. It follows your selected token live; players see only factions they own."
    },
    {
      id: "planner", title: "Building the route",
      selector: '[data-action="rp-pick"]',
      text: "Pick on Map lets you click hexes on the canvas to append legs. Auto-Plan A→B runs a shortest-path between two picked hexes and fills the legs for you.\nThe manual-entry drawer below does the same from dropdowns."
    },
    {
      id: "legs", title: "The legs — where the cost lives",
      selector: ".rp-legs",
      text: "One row per leg: terrain sets the OP cost (ley-gates discount up to 40%), the hazard chip flags environmental danger, and the weather chip prices the sky.\nA shield badge means someone in your party can mitigate that leg's weather. Hover any chip for the details.",
      speak: "Every leg is a small bill. The route is the invoice."
    },
    {
      id: "estimate", title: "The estimate",
      selector: ".rp-est",
      text: "Legs, distance, and total estimated OP — checked live against your faction's bank so you know if you can afford it before you commit."
    },
    {
      id: "radiation", title: "Projected radiation",
      selector: ".rp-rad",
      text: "Travel through bad sky costs more than OP: each leg's weather adds Radiation Points (0.5 to 3 per leg), bucketed into an exposure tier for the whole route.\nHot routes are sometimes worth it. Sometimes."
    },
    {
      id: "abilities", title: "Vanguard abilities",
      selector: ".rp-abilities-block",
      optional: true,
      text: "Travel-relevant abilities from your roster — guides, weather-wardens, scouts. These surface automatically once a faction is picked and can mitigate specific legs."
    },
    {
      id: "stack", title: "Joining factions — traveling together",
      selector: ".rp-stack-block",
      optional: true,
      text: "Allied factions can ride along as one stack. Each passenger pays its own OP (scaled per faction) — the cost preview appears once someone joins.\nAllies only; the picker stays locked until you have some."
    },
    {
      id: "vertical", title: "Dive & Ascend — the third axis",
      selector: '[data-action="rp-dive"]',
      optional: true,
      text: "Dive drops the faction into the underwater scene linked to the current hex (needs a depth-rated submersible); Ascend goes up to the aerial or orbital layer (needs a flyer or spacecraft).\nThe world has floors and ceilings."
    },
    {
      id: "execute", title: "Execute Route — the commit",
      selector: '[data-action="rp-exec"]',
      text: "Runs the route leg by leg: debits every traveler, rolls encounters (you'll be prompted; the GM's run silently), fires the travel visuals, and moves the world.\nGMs get an overrides prompt first — cost multipliers, encounter DC tweaks.",
      speak: "Execute is the only button here that spends real money. The rest is window shopping."
    },
    {
      id: "output", title: "The log",
      selector: ".rp-out",
      optional: true,
      text: "Execution results land here — what was paid, what was rolled, where you ended up. If a leg fails, this is where it says why."
    }
  ]
};

/* ───────────────────── PLAYER · Activity Planner ───────────────────── */
// Strategic-turn activities (deliberately NOT the three raid types — those
// live in the Raid Console). Opens locked to the player's faction.

const plannerTour = {
  id: "planner-hud",
  title: "The Long Game (Activity Planner)",
  audience: "player",
  intro: "Opening the Activity Planner — everything your faction can do that isn't hitting someone. Slower than a raid, cheaper than a war, and it compounds.",
  outro: "Planner toured. Raids win rounds; planned activities win Turns. The factions that scare people run both.",

  open: async (ctx) => {
    const openPlanner = game.bbttcc?.api?.raid?.openActivityPlanner;
    if (!openPlanner) { ui.notifications?.warn?.("Activity Planner not loaded — is bbttcc-raid enabled?"); return null; }
    const faction = _resolveFactionForTour(ctx);
    if (!faction) { ui.notifications?.warn?.("No faction found — the planner needs one."); return null; }
    openPlanner({ factionId: faction.id, lockFaction: true });
    return null; // window mounts at #bbttcc-activity-planner
  },

  steps: [
    {
      id: "root", title: "The strategic catalog",
      selector: "section.bbttcc-activity-planner",
      text: "Every strategic activity your faction can run this Turn — espionage, trade plays, propaganda, construction. The three raid types live in the Raid Console; this is everything else.\nFlow: pick a target, pick an activity, Plan it."
    },
    {
      id: "target", title: "Target hex",
      selector: 'button[data-act="pick"]',
      optional: true,
      text: "Most activities aim at a hex — pick from the dropdown or click one on the map. The list only offers hexes you control or border; the GM can bypass that.\nRig-repair activities swap this for a rig picker."
    },
    {
      id: "categories", title: "Category pills",
      selector: 'button[data-act="filter-cat"]',
      text: "Filter the catalog by the OP track each activity leans on — the same nine currencies as everywhere else. The search box narrows further by name."
    },
    {
      id: "list", title: "The activity list — tier-gated",
      selector: ".bbttcc-activity-row",
      optional: true,
      text: "Each row shows its Tier requirement, OP costs, and package group. You can run anything at or under your faction's Tier; UNLOCKED badges mark activities you've learned above tier.\nClick a row to select it.",
      speak: "The locked rows exist. You just can't see them yet. Motivation— *bzzt* —included free."
    },
    {
      id: "tips", title: "The ⓘ icons — full rules on hover",
      selector: '.bbttcc-tip-icon[data-tip-kind="strategic"]',
      optional: true,
      text: "Every activity carries a tip icon with its complete rules text — effects, costs, requirements. Hover or click. When in doubt, the ⓘ is the law."
    },
    {
      id: "showlocked", title: "Show Locked (GM)",
      selector: 'input[type="checkbox"]',
      optional: true,
      text: "GM-only: reveals tier-locked activities with their LOCKED badges and bypasses target filtering — for planning what a faction grows INTO, not what it can do today."
    },
    {
      id: "telemetry", title: "The tally",
      selector: ".bbttcc-planner-telemetry",
      optional: true,
      text: "Your faction's Tier and how much of the catalog it can reach — available, locked, total. Watch this grow as the faction advances."
    },
    {
      id: "plan", title: "Plan Activity — the commit",
      selector: 'button[data-act="plan"]',
      text: "Validates the target and stakes the activity — it lands in your faction sheet's Next Turn queue and fires when the GM advances the Turn (Apply).\nOne activity per click; the war log records it as planned."
    }
  ]
};

/* ───────────────────── PLAYER+GM · Raid Console ───────────────────── */
// One template, isGM branches — GM-only steps auto-skip for players and
// vice versa. If the faction has NO active raid session, we stage a practice
// one (the onboarding finale's trick) so the console isn't an empty shell,
// and clear it again when the tour ends.

let _raidTourStagedFactionId = null;

const raidConsoleTour = {
  id: "raid-console",
  title: "The Sharp End (Raid Console)",
  audience: "player",
  intro: "Opening the Raid Console. Three ways to take what's theirs: Violence, Intrigue, Presence. Same table, different knives. If there's no live raid I've staged you a practice target— *bzzt* —it won't mind.",
  outro: "Raid console toured. Remember the shape: stage OP into the contested key, pick maneuvers, commit the round. Presence raids swap the dice for the courtly influence engine — different tour, same appetite.",

  open: async (ctx) => {
    const raidApi = game.bbttcc?.api?.raid;
    if (!raidApi?.openConsole) { ui.notifications?.warn?.("Raid Console not loaded — is bbttcc-raid enabled?"); return null; }
    const faction = _resolveFactionForTour(ctx);
    if (!faction) { ui.notifications?.warn?.("No faction found — the raid console needs one."); return null; }

    _raidTourStagedFactionId = null;
    try {
      const existing = faction.getFlag("bbttcc-raid", "raidSession");
      const live = existing && (existing.targetUuid || (existing.rounds || []).length);
      if (!live) {
        const targetUuid = _findHexUuidForTour({ faction: null }); // any hex — practice dummy
        if (targetUuid) {
          const hexDoc = await fromUuid(targetUuid).catch(() => null);
          const hexOwner = String(hexDoc?.flags?.["bbttcc-territory"]?.factionId || hexDoc?.flags?.["bbttcc-territory"]?.ownerId || "").trim();
          const defenderId = (hexOwner && hexOwner !== faction.id) ? hexOwner : null;
          await faction.setFlag("bbttcc-raid", "raidSession", {
            rev: Date.now(), ts: Date.now(), by: game.user.id,
            attackerId: faction.id, supportFactionIds: [],
            activityKey: "violence", difficulty: "normal",
            targetType: "hex", targetUuid,
            targetName: (hexDoc?.text || hexDoc?.flags?.["bbttcc-territory"]?.name || "Practice Target"),
            defenderId, rounds: [], logWar: false, includeDefender: !!defenderId
          });
          _raidTourStagedFactionId = faction.id;
        }
      }
    } catch (e) { console.warn("[onboarding/tour-defs] raid tour staging skipped:", e); }

    raidApi.openConsole({ factionId: faction.id });
    return null; // window mounts at #bbttcc-raid-console
  },

  close: async () => {
    if (!_raidTourStagedFactionId) return;
    try {
      const f = game.actors.get(_raidTourStagedFactionId);
      await f?.unsetFlag("bbttcc-raid", "raidSession");
    } catch (_) {}
    _raidTourStagedFactionId = null;
  },

  steps: [
    {
      id: "ident", title: "The identity strip",
      selector: ".bbttcc-raid-ident",
      text: "Who's raiding what: the resolved target, the PRIMARY CONTESTED KEY (the OP track this raid is fought in — gold pill), and portraits of the attacker plus any coalition supporters."
    },
    {
      id: "setup", title: "GM setup row",
      selector: 'select[data-id="attacker"]',
      optional: true,
      text: "GM-only: pick the attacker, the activity type — Violence, Intrigue or Presence, each with its own maneuver set and math — the difficulty band, and the target (Pick Target grabs a hex off the canvas).\nAdd Round starts the exchange once attacker + target + activity are set."
    },
    {
      id: "playerbank", title: "Your bank",
      selector: "section.bbttcc-bank",
      text: "The OP pools funding this raid. Players see their own bank; the GM sees attacker and defender side by side.\nEverything you stage into a round drains from here — check it before you promise."
    },
    {
      id: "coalition", title: "Coalition support",
      selector: ".bbttcc-coalition-bar",
      optional: true,
      text: "Allied factions backing the raid. Supporters contribute OP, add a coalition bonus to the roll, and fire their OWN eligible maneuvers each round.\nThe GM adds or removes supporters here.",
      speak: "Friends make the number bigger. That's what friends are for."
    },
    {
      id: "rounds", title: "Rounds — the heartbeat",
      selector: "section.bbttcc-rounds",
      optional: true,
      text: "A raid is a series of rounds. Open one (Manage) and you get the staging panel: push OP into the contested key with the ± buttons, pick maneuvers, then the GM commits — one roll against the DC, outcome logged in this table.\nYour staged OP only counts once you hit Commit Staging up top."
    },
    {
      id: "maneuvers", title: "Maneuvers — the knives",
      selector: ".bbttcc-mans-cell",
      optional: true,
      text: "Per-side maneuver picker inside an open round: each maneuver has an OP cost, a fire-mode badge, and an ⓘ icon with its complete rules.\nThe projected-spend line totals what you've promised before anything rolls. Availability gates on faction tier and Beat grants."
    },
    {
      id: "staging", title: "Commit Staging — sending it to the GM",
      selector: 'button[data-id="commit-staging"]',
      optional: true,
      text: "Player-side: your staged OP and maneuvers are a draft until this button sends them to the GM's round. No commit, no contribution — don't leave the table with a full draft."
    },
    {
      id: "commit", title: "Commit (Roll) — resolving the round",
      selector: '[data-manage-act="commit"]',
      optional: true,
      text: "GM-only: locks the round and rolls it — staged OP and maneuvers versus the DC (hover the ⓘ for the DC breakdown). The outcome colors the round log and fires the round-commit hook every listener watches."
    },
    {
      id: "end", title: "Reset & End Raid",
      selector: 'button[data-id="end-raid"]',
      optional: true,
      text: "GM-only: Reset clears the rounds but keeps the setup; End Raid tears down the whole session — rounds, supporters, target — and propagates the clear to every player's console."
    }
  ]
};

/* ───────────────────── PLAYER · Rig sheet ───────────────────── */
// AppV2, custom tab wiring (nav.ft-tabs a.item[data-tab] clicks). Rig actors
// are type "rig" owned via system.identity.factionOwnerId.

function _resolveRigForTour(ctx) {
  const viaResolver = game.bbttcc?.onboarding?.resolve?.rig?.(ctx.faction);
  if (viaResolver?.sheet) return viaResolver;
  const fid = ctx.faction?.id || null;
  const rigs = game.actors.filter(a => a.type === "rig");
  if (fid) {
    const owned = rigs.find(a => {
      const sys = a.system?.system ?? a.system;
      return String(sys?.identity?.factionOwnerId || "") === fid;
    });
    if (owned) return owned;
  }
  return rigs[0] || null;
}

const rigSheetTour = {
  id: "rig-sheet",
  title: "The Rolling Body (Rig Sheet)",
  audience: "player",
  intro: "Opening your rig — a body with wheels, guns and a payroll. Same rules as every other body you own: feed it, crew it, don't let Integrity hit zero.",
  outro: "Rig toured. Parked rigs produce, deployed rigs fight at half output, destroyed rigs produce paperwork. Choose wisely.",

  open: async (ctx) => {
    const rig = _resolveRigForTour(ctx);
    if (!rig) { ui.notifications?.warn?.("No rig actor found — mint one from the Rig Builder first."); return null; }
    await rig.sheet?.render(true);
    return rig.sheet;
  },

  steps: [
    {
      id: "header", title: "Identity — mobility, state, owner",
      selector: "header.ft-rig-header",
      text: "The pills that matter: Mobility (stationary / mobile / hybrid) decides if this thing travels at all; State runs the output throttle — Parked yields 100%, Deployed 50%, Destroyed 0.\nThe owner pill binds it to a faction; the duplicate button opens the Rig Builder pre-filled."
    },
    {
      id: "stats", title: "The four tiles",
      selector: ".ft-rig-stat-grid",
      text: "Integrity is the rig's health — zero means destroyed. Tier and bracket gate what it can mount; Crew shows seated versus capacity; Output is current throughput after the state throttle.\nMobile rigs get Deploy / Recall buttons right on the Integrity tile."
    },
    {
      id: "crew", title: "Crew — who runs the meat-wagon",
      pre: 'nav.ft-tabs a.item[data-tab="crew"]',
      selector: '.ft-body .tab[data-tab="crew"]',
      text: "The frame defines role capacity — pilot, gunner, engineer, general crew. Drag a Steward or NPC onto a slot to board them; occupied slots open the sheet or disembark.\nNo pilot, no steering: moving a rig in combat is a crew action.",
      speak: "A rig with no crew is just expensive terrain."
    },
    {
      id: "defenses", title: "Combat — the three DCs",
      pre: 'nav.ft-tabs a.item[data-tab="combat"]',
      selector: ".ft-rig-contact-defenses",
      text: "Guard is the DC against melee and rams, Evasion against ranged, Resolve against EMP and demoralize effects — bracket base plus tier.\nBelow, the defense table cycles resist/immune/vulnerable per damage type."
    },
    {
      id: "weapons", title: "Weapons & heat",
      selector: ".ft-rig-weapons",
      optional: true,
      text: "Hardpoints are slot-capped by the frame (the pill goes red on overage). Drop rig-weapon items to mount them.\nFiring builds heat — every shot adds +1, and a maxed heat meter locks the guns until it bleeds off."
    },
    {
      id: "frame", title: "Gear — the frame is the law",
      pre: 'nav.ft-tabs a.item[data-tab="gear"]',
      selector: ".ft-rig-gear-frame",
      text: "The frame sets base Integrity, all three slot caps (⚔ weapons, ⚙ systems, ⚡ outputs) and which mobility types are legal.\nSystems (sensors, shields, comms) and Output modules install below, each against its own cap."
    },
    {
      id: "output", title: "Output — why the faction keeps it",
      pre: 'nav.ft-tabs a.item[data-tab="output"]',
      selector: ".ft-rig-output-summary",
      optional: true,
      text: "Output modules yield resources to the owning faction every Turn, scaled by the state throttle. A parked rig is a little factory; a deployed one is a half-speed factory with a gun."
    },
    {
      id: "travel", title: "Travel — speed & range",
      pre: 'nav.ft-tabs a.item[data-tab="travel"]',
      selector: ".ft-rig-travel-grid",
      optional: true,
      text: "Authored speed, range and hazard resistance, plus the derived table converting hexes to feet and squares (1 hex = 30 ft, grid-aware).\nStationary rigs don't have this tab — they ARE the hex."
    },
    {
      id: "gmedit", title: "GM Edit",
      pre: 'nav.ft-tabs a.item[data-tab="gmedit"]',
      selector: '.ft-body .tab[data-tab="gmedit"]',
      optional: true,
      text: "GM-only (needs Edit Mode on): manual overrides for integrity, tier, bracket and per-role crew capacity — the thumb on the scale when the frame math doesn't fit the story."
    }
  ]
};

/* ───────────────────── PLAYER · Market ───────────────────── */
// Anchors + text ship with bbttcc-market's own registry entries (appKey
// "market"). Opens via the singleton API; buyer context rides a setting.

const marketTour = {
  id: "market",
  title: "The Long Market (Market)",
  audience: "player",
  intro: "Opening the Market. Everything has a price; whether it's YOUR price depends on your faction's Economic Horizon. Hover the chips— *bzzt* —the chips know.",
  outro: "Market toured. Standard Issue is free, ambition costs double, and artifacts aren't for sale to anyone. That's not a bug, that's an economy.",

  open: async () => {
    const openMarket = game.bbttcc?.api?.market?.openMarket;
    if (!openMarket) { ui.notifications?.warn?.("Market not loaded — is bbttcc-market enabled?"); return null; }
    openMarket();
    return null; // singleton mounts at #bbttcc-market
  },

  steps: [
    { id: "context",  title: "The buyer context",  selector: '[data-tour="market.context"]',  help: ["market", "context"] },
    { id: "vendor",   title: "Vendor",             selector: '[data-tour="market.vendor"]',   help: ["market", "vendor"] },
    { id: "faction",  title: "Who pays",           selector: '[data-tour="market.faction"]',  help: ["market", "faction"] },
    { id: "character",title: "Who receives",       selector: '[data-tour="market.character"]',help: ["market", "character"] },
    { id: "hex",      title: "Delivery hex",       selector: '[data-tour="market.hex"]',      help: ["market", "hex"], optional: true },
    { id: "catalog",  title: "The catalog",        selector: '[data-tour="market.catalog"]',  help: ["market", "catalog"] },
    { id: "search",   title: "Finding things",     selector: '[data-tour="market.search"]',   help: ["market", "search"] },
    { id: "chip",     title: "The Horizon chip — your real price", selector: '[data-tour="market.chip"]', help: ["market", "chip"], optional: true,
      speak: "The list price is a story. The chip is the truth." },
    { id: "cost",     title: "The cost line",      selector: '[data-tour="market.cost"]',     help: ["market", "cost"], optional: true },
    { id: "buy",      title: "Buy — the commit",   selector: '[data-tour="market.buy"]',      help: ["market", "buy"], optional: true },
    { id: "manage",   title: "Manage Catalogs (GM)", selector: '[data-tour="market.manage"]', help: ["market", "manage"], optional: true }
  ]
};

/* ───────────────────── PLAYER · Banks (personal + faction) ───────────────────── */
// One tour, two windows: opens the Personal Bank, then a mid-tour step opens
// the Faction Bank (the runner falls back to document-wide selector search).

function _resolveStewardForBankTour(ctx) {
  if (ctx.steward) return ctx.steward;
  return game.actors.find(a => a.type === "character" && a.isOwner) ||
         game.actors.find(a => a.type === "character") || null;
}

const banksTour = {
  id: "banks",
  title: "Vaults & Treasuries (Banks)",
  audience: "player",
  intro: "Opening your vault. Rule one of Bad Eden banking: gear is personal, Marks are political. Rule two— *bzzt* —there is no interest rate. The apocalypse ate it.",
  outro: "Banks toured. Personal vault for your gear, faction treasury for the war chest, coalition stash for trust exercises. Deposit salvage, mint Marks, sleep with receipts.",

  open: async (ctx) => {
    const banks = game.bbttcc?.api?.banks;
    if (!banks?.openPersonalBank) { ui.notifications?.warn?.("Banks not loaded — is bbttcc-banks enabled?"); return null; }
    const steward = _resolveStewardForBankTour(ctx);
    if (!steward) { ui.notifications?.warn?.("No character found for the personal bank."); return null; }
    banks.openPersonalBank(steward);
    return null;
  },

  steps: [
    {
      id: "note", title: "The personal vault",
      selector: ".bbttcc-bank-note",
      text: "Your personal bank holds GEAR only — weapons, armor, kit, bound manifestations. Marks (money) live at the faction tier; a steward's pockets aren't a treasury."
    },
    {
      id: "dest", title: "Deposit destination",
      selector: 'select[data-role="bank-dest"]',
      text: "Where a deposit lands: your personal vault, a faction treasury you can access, or a coalition stash.\nSalvage deposited to a faction gets refined into Marks on the spot — that's the main way loot becomes money."
    },
    {
      id: "carried", title: "Carried — what can go in",
      selector: 'ul[data-side="carried"]',
      optional: true,
      text: "Your bankable inventory, with tier badges and ⚡ salvage markers. Deposit moves the item out of your pockets and into the chosen vault."
    },
    {
      id: "stored", title: "Stored — getting it back",
      selector: 'ul[data-side="stored"]',
      optional: true,
      text: "The vault's contents. Withdraw puts an item back in your inventory. Nothing decays in here; the vault is the one place the world can't touch."
    },
    {
      id: "treasury", title: "The faction treasury",
      selector: ".bbttcc-treasury",
      optional: true,
      onEnter: async (ctx) => {
        const f = _resolveFactionForTour(ctx);
        if (f) { try { game.bbttcc?.api?.banks?.openFactionBank?.(f); } catch (_) {} }
        await new Promise(r => setTimeout(r, 500));
      },
      text: "The faction bank: Marks per OP bucket, shown against their caps (full chips light up). Read-only here — Marks move through the OP engine, the Exchange, and the Market, not by hand.\nBelow it, the faction vault stores shared gear.",
      speak: "This is the war chest. Everyone can see it. That's a feature."
    },
    {
      id: "toolbar", title: "Coalition hosting & withdrawals",
      selector: ".bbttcc-bank-toolbar",
      optional: true,
      text: "Owners and GMs can flip this faction into a Coalition Treasury host — allied factions gain a deposit destination, and a shared coalition vault appears.\nThe recipient picker routes withdrawn gear to one of your stewards."
    },
    {
      id: "fvault", title: "The faction vault",
      selector: 'ul[data-side="faction"]',
      optional: true,
      text: "Shared gear storage. Withdrawing needs manage rights AND an owned steward to receive the item — the vault never dumps gear onto the floor."
    }
  ]
};

/* ───────────────────── GM · Facility Console ───────────────────── */
// Deliberately short: the console is a retirement shim (2026-05-08) —
// facilities ARE stationary Rig actors now. Text comes from the "facilities"
// help dictionary registered by bbttcc-facility-console.

const facilitiesTour = {
  id: "facilities",
  title: "Facilities (The Short Version)",
  audience: "gm",
  intro: "Opening the Facility Console — briefly. This window mostly exists to tell you it retired. Facilities got promoted to full rig actors; the console is the forwarding address.",
  outro: "That's the whole console. For the actual facility interface, run the Rig Sheet tour — a facility is just a rig that decided to stop moving.",

  open: async (ctx) => {
    const Ctor = game.bbttcc?.apps?.FacilityConsole;
    if (!Ctor) { ui.notifications?.warn?.("Facility Console not loaded — is bbttcc-facility-console enabled?"); return null; }
    const hexUuid = _findHexUuidForTour(ctx) || "";
    const appInst = new Ctor({ hexUuid });
    await appInst.render(true, { focus: true });
    return appInst;
  },

  steps: [
    { id: "console",  title: "What this window is now", selector: "form.bbttcc-facility-config-shim", help: ["facilities", "console"] },
    { id: "retired",  title: "Why it retired",          selector: '[data-tour="facilities.retired"]', help: ["facilities", "retired"] },
    { id: "create",   title: "Create Facility",         selector: '[data-ft-shim-action="create-facility"]', help: ["facilities", "createFacility"],
      speak: "One click, one new stationary rig. The bunker business has never been easier— *bzzt* —or more actor-shaped." },
    { id: "actors",   title: "Open Actors & Rigs",      selector: '[data-ft-shim-action="open-actors-rigs"]', help: ["facilities", "openActors"] },
    { id: "legacy",   title: "Legacy audit data",       selector: '[data-ft-shim-action="show-legacy"]', help: ["facilities", "showLegacy"] },
    { id: "why",      title: "The design note",         selector: '[data-tour="facilities.whyUnified"]', help: ["facilities", "whyUnified"], optional: true }
  ]
};

/* ───────────────────── GM · Hex Craft (create + edit) ───────────────────── */
// Creation: toolbar button → canvas click → editor auto-opens (the tour only
// DESCRIBES this — a canvas click while placing writes a Drawing). Editing:
// openHexConfig(uuid) is write-safe until Save; the injected GM panel's
// Apply/Clear buttons write IMMEDIATELY and are never pre-clicked.

const hexCraftTour = {
  id: "hex-craft",
  title: "Shaping the Land (Hex Create & Edit)",
  audience: "gm",
  intro: "GM channel. Opening the hex workshop — where the world gets its tiles. I'll open a real hex's editor; nothing saves until you press Save, so wander freely.",
  outro: "Hex craft toured. Type times Size times Alignment plus Modifiers equals the economy — and everything on this form is a dial on somebody's future.",

  open: async (ctx) => {
    const api = game.bbttcc?.api?.territory;
    if (!api?.openHexConfig) { ui.notifications?.warn?.("Territory module not loaded."); return null; }
    const uuid = _findHexUuidForTour(ctx);
    if (uuid) await api.openHexConfig(uuid);
    else ui.notifications?.warn?.("No hexes exist yet — the tour will cover creation first.");
    return null; // dialog mounts at #bbttcc-hex-config
  },

  steps: [
    {
      id: "create", title: "Create Hex — button, click, done",
      selector: '#bbttcc-toolbar [data-action="create-hex"]',
      optional: true,
      text: "The creation flow: click this, then click anywhere on the canvas — the hex Drawing is created there (snapped, unclaimed wilderness) and its editor opens automatically. Esc cancels placement.\nI won't press it — the next canvas click after it would plant a real hex.",
      speak: "One click arms it, the second click is real estate. No takebacks— *bzzt* —well, one Delete key of takebacks."
    },
    {
      id: "editor", title: "The Hex Configuration editor",
      selector: "form.bbttcc-hex-config",
      text: "The full hex editor — also reachable by Shift-clicking (or double-clicking) any hex on the canvas as GM.\nNothing here persists until Save; Cancel or closing the window discards everything. Poke freely."
    },
    {
      id: "identity", title: "Name, owner, status",
      selector: 'form.bbttcc-hex-config select[name="factionId"]',
      text: "Owner binds the hex to a faction — its yields flow there each Turn. Status runs claimed / unclaimed / contested; contested hexes are raid bait by design."
    },
    {
      id: "economy", title: "Type × Size — the economic engine",
      selector: 'form.bbttcc-hex-config select[name="type"]',
      text: "Terrain Type sets the resource base; settlement Size multiplies it; Sephirot alignment adds on top; the modifier checkboxes below adjust the total.\nThat computed number becomes the per-Turn yield row you see on the Overview."
    },
    {
      id: "modifiers", title: "Modifiers",
      selector: 'form.bbttcc-hex-config input[name="modifiers"]',
      optional: true,
      text: "Twelve toggles — Well-Maintained, Fortified, Radiation Zone and friends — each multiplying or adjusting the auto-calculated resources. These are the fast levers for making a hex feel lived-in or ruined."
    },
    {
      id: "leylines", title: "Leylines & gates",
      selector: "fieldset.bbttcc-leylines-panel",
      optional: true,
      text: "The hex's mystical plumbing: primary resonance, flow state, purity, memory charge — and ley-gates, which link two hexes and discount travel through them (up to 40%), gated by faction tier and a lock."
    },
    {
      id: "resources", title: "Resources & the override switch",
      selector: 'form.bbttcc-hex-config input[name="resources.food"]',
      text: "The five yield numbers. Normally auto-calculated from Type × Size × Alignment + Modifiers; tick Manual Override in the Save Behavior box to save exactly what you type instead.\nOverride is for story exceptions — the auto-calc keeps the economy consistent."
    },
    {
      id: "gmpanel", title: "The GM Manual Edit panel — live wires",
      selector: 'fieldset[data-bbttcc="gm-edit-panel"]',
      optional: true,
      text: "Travel-cost override, development stage and lock, alarm level, and the campaign beat that fires when a party enters this hex.\n⚠ Unlike the rest of the form, Apply and Clear here write IMMEDIATELY — they don't wait for Save. Look, don't lean.",
      speak: "Everything else on this form asks permission. These two buttons ask forgiveness."
    },
    {
      id: "save", title: "Save vs Cancel",
      selector: "#bbttcc-hex-config .dialog-button.save",
      optional: true,
      text: "Save commits the whole form to the hex Drawing in one update. Cancel (or the window ✕) walks away clean.\nFor this tour: walk away clean."
    }
  ]
};

/* ───────────────────── GM · Turn Driver ───────────────────── */
// The Turn Driver is a process, not a window: toolbar button → confirm dialog
// → the full advance pipeline. The tour narrates; it never opens the confirm
// (a stray Yes would commit a real Turn).

const turnDriverTour = {
  id: "turn-driver",
  title: "The Heartbeat (Turn Driver)",
  audience: "gm",
  intro: "GM channel. This one isn't a window — it's the world's heartbeat. One button, one confirmation, and every queued promise in the campaign comes due at once.",
  outro: "Turn Driver toured. Dry-run when unsure, Apply when ready, read the Dashboard after. The Turn forgives nothing but it announces everything.",

  open: async () => {
    const bar = document.querySelector("#bbttcc-toolbar");
    if (!bar) ui.notifications?.warn?.("Bad Eden toolbar not found — is bbttcc-territory active on this scene?");
    return null; // steps target the persistent toolbar
  },

  steps: [
    {
      id: "bar", title: "The Bad Eden bar",
      selector: "#bbttcc-toolbar .bbttcc-toolbar-main",
      text: "Every GM tool hangs off this bar — Dashboard, Create Hex, Overview, Market, Campaigns, Story, Raid, Plan, Travel, and the one we're here for: Turn Driver, at the end. Position of honor."
    },
    {
      id: "button", title: "Advance Turn — the button",
      selector: "#bbttcc-btn-turn-driver",
      text: "Clicking this opens an 'Advance Turn' confirmation (No is the default — a stray Enter won't end the world). Yes runs the full advance with apply: true.\nI'm not opening it; this tour is a map, not a detonation."
    },
    {
      id: "sequence", title: "What actually fires on Apply",
      selector: "#bbttcc-btn-turn-driver",
      text: "In order: queued post-effects promote → planned raids and strategic actions consume → territory tracks run (hex yields pay out, 2 Materials pips → 1 Build Unit) → scheduled OP bonuses mature → OP regen → logistics pressure → cleanup → world turn +1.\nThen the end-hook wave: radiation decays and spreads, facility turn effects apply, tier stability checks, pressure recomputes, and every faction's Momentum resets to zero."
    },
    {
      id: "dryrun", title: "The dry-run — rehearse the heartbeat",
      selector: "#bbttcc-btn-turn-driver",
      text: "game.bbttcc.api.turn.advanceTurn({ apply: false }) runs the whole pipeline as a preview — every mutation is skipped, including (as of today) the Momentum reset and pressure writes that used to leak through.\nUse it before any Turn you're nervous about.",
      speak: "Rehearsal is free. Opening night costs everyone their Momentum."
    },
    {
      id: "after", title: "Reading the aftermath",
      selector: '#bbttcc-toolbar [data-action="territory-dashboard"]',
      text: "After a real Turn: the Dashboard shows the new territory state, the Overview shows every faction's health at a glance, and each faction's War Logs got a turn entry.\nIf something looks wrong, the logs say what fired and why."
    }
  ]
};

/* ───────────────────── GM · Campaign Dashboard ───────────────────── */
// Text lives in the "dashboard" help dictionary (bbttcc-territory). The
// dashboard is an inline-edit spreadsheet — every cell writes on change, so
// the tour points but never edits.

const dashboardTour = {
  id: "dashboard",
  title: "Mission Control (Campaign Dashboard)",
  audience: "gm",
  intro: "GM channel. The Dashboard — every hex in the world as one editable spreadsheet. Powerful the way a chainsaw is powerful: keep your fingers where you can see them, edits save instantly.",
  outro: "Dashboard toured. Filter, fix, focus — and remember every cell you touch saves on change. The chainsaw does not have an undo lever, but it does have War Logs.",

  open: async () => {
    const opener = globalThis.BBTTCC_OpenTerritoryDashboard;
    if (typeof opener !== "function") { ui.notifications?.warn?.("Dashboard not available — is bbttcc-territory enabled?"); return null; }
    return opener() || null; // window: #bbttcc-territory-dashboard
  },

  steps: [
    { id: "header",  title: "The command strip",  selector: '[data-tour="dashboard.header"]',  help: ["dashboard", "header"] },
    { id: "refresh", title: "Refresh",            selector: '[data-tour="dashboard.refresh"]', help: ["dashboard", "refresh"] },
    { id: "travel",  title: "Plan Travel",        selector: '[data-tour="dashboard.planTravel"]', help: ["dashboard", "planTravel"], optional: true },
    { id: "adopt",   title: "Adopt Hexes",        selector: '[data-tour="dashboard.adoptHexes"]', help: ["dashboard", "adoptHexes"], optional: true },
    { id: "filters", title: "The filter bar",     selector: '[data-tour="dashboard.filters"]', help: ["dashboard", "filters"],
      speak: "Nine filters, AND-combined. The world is only overwhelming until you subtract most of it." },
    { id: "count",   title: "The match counter",  selector: '[data-tour="dashboard.filterCount"]', help: ["dashboard", "filterCount"], optional: true },
    { id: "table",   title: "The spreadsheet — live wires", selector: '[data-tour="dashboard.table"]', help: ["dashboard", "table"],
      text: "Every hex as a row; owner, status, type, size, population, capital and all five resources are edited INLINE — each change writes to the hex flags immediately with a ✓ Saved toast.\nThis is the fastest way to fix the world and the fastest way to break it. There is no draft mode." },
    { id: "actions", title: "Row actions",        selector: '[data-tour="dashboard.actions"]', help: ["dashboard", "colActions"], optional: true,
      text: "Per-hex: Focus pans the canvas to it, Edit opens the full Hex Configuration dialog, Sheet opens the hex sheet, Delete removes the Drawing (with a confirm).\nFocus and Sheet are free; Edit holds writes until Save; Delete is forever." }
  ]
};

/* ───────────────────── GM · Campaign Overview ───────────────────── */
// Read-only rollup — the safest window in the game. Text from the "overview"
// help dictionary; the World-Health chip is injected by bbttcc-epic.

const overviewTour = {
  id: "overview",
  title: "The State of the World (Campaign Overview)",
  audience: "gm",
  intro: "GM channel. The Overview — every faction's vital signs on one read-only page. Nothing here can break anything; this is the window you open BEFORE opening the windows that can.",
  outro: "Overview toured. World-Health up top, faction health down the rows, Great Work on the far edge. When those three agree with your plans, advance the Turn.",

  open: async () => {
    const openOverview = game.bbttcc?.api?.territory?.openCampaignOverview;
    if (!openOverview) { ui.notifications?.warn?.("Overview not available — is bbttcc-territory enabled?"); return null; }
    return openOverview() || null; // window: #bbttcc-campaign-overview
  },

  steps: [
    { id: "worldhealth", title: "World-Health — the repair meter", selector: '[data-tour="overview.worldHealth"]', help: ["overview", "worldHealth"], optional: true,
      speak: "Three of one hundred fifty-five hexes aligned. The world stirs. It would stir faster with help— *bzzt* —hint." },
    { id: "header",  title: "Read-only, world-wide",  selector: '[data-tour="overview.header"]', help: ["overview", "header"] },
    { id: "table",   title: "The faction rollup",      selector: '[data-tour="overview.table"]', help: ["overview", "colFaction"],
      text: "One row per faction across ALL scenes: power Status, hex count, which scenes it touches, per-Turn resource yields, and summed defense.\nAn Unclaimed aggregate row appears at the bottom when ownerless hexes exist — that's your expansion frontier." },
    { id: "open",    title: "The Open buttons",        selector: '[data-tour="overview.open"]', help: ["overview", "colOpen"], optional: true },
    { id: "health",  title: "Faction health columns",  selector: '[data-tour="overview.health"]', help: ["overview", "health"], optional: true,
      text: "VP, Unity, Morale, Loyalty, Darkness — the same tracks as each faction sheet, lined up for comparison. This is where you spot the faction quietly rotting before it ruptures." },
    { id: "gw",      title: "Sparks & the Great Work", selector: '[data-tour="overview.health"]', help: ["overview", "gw"], optional: true,
      text: "The endgame columns: Sparks collected (of 3) and Great Work readiness. Ready needs all three sparks, VP 10+, Unity 30+, Darkness 3 or less, and no corrupted sparks.\n'Not Ready' is a to-do list, not a verdict — hover any cell for exactly which requirement is blocking." }
  ]
};

/* ───────────────────── GM · Campaign Engine (Builder) ───────────────────── */
// The big one. V1 app; all five tab panels stay in the DOM (.is-hidden) but
// every tab click re-renders — the runner re-queries per step, so that's fine.
// Text lives in the "campaign" help dictionary (89 keys, bbttcc-campaign).

const campaignEngineTour = {
  id: "campaign-engine",
  title: "The Spine of the Story (Campaign Engine)",
  audience: "gm",
  intro: "GM channel. Opening the Campaign Engine — beats, quests, travel tables and the flow map, all in one machine. It's big. That's why I'm here. Hover anything for the fine print; the fine print is new.",
  outro: "Campaign Engine toured. Campaigns hold beats, beats fire the world, quests bind beats to land, and the Flow map shows you the whole nervous system. The Beat Editor has its own tour — that's where the deep magic lives.",

  open: async () => {
    const openBuilder = game.bbttcc?.api?.campaign?.openBuilder;
    if (!openBuilder) { ui.notifications?.warn?.("Campaign Engine not loaded — is bbttcc-campaign enabled?"); return null; }
    await openBuilder();
    return null; // window: #bbttcc-campaign-builder
  },

  steps: [
    {
      id: "root", title: "One machine, five rooms",
      selector: '[data-tour="campaign.root"]',
      text: "A campaign is a spine: an ordered list of beats (story events that fire), a quest registry bound to hexes, travel encounter tables, and a flow visualizer.\nThe five tabs are the rooms; everything here is GM-only — players see the Beat Mirror instead."
    },
    {
      id: "campaigns", title: "The campaign list",
      pre: '[data-action="main-tab"][data-tab="campaign"]',
      selector: '[data-tour="campaign.campaigns"]',
      text: "Your campaigns, with the Active chip marking which one drives the world — the Story Director tick, Reality-Tear draws and turn announcements all read the active campaign.\nRun First Beat does exactly what it says: fires the opener beat and nothing else."
    },
    {
      id: "bundles", title: "Bundles — campaigns as cargo",
      selector: '[data-tour="campaign.bundles"]',
      optional: true,
      text: "Export a campaign to a portable bundle, import one in, remap its IDs to this world's actors/scenes/hexes, and scan for unresolved keys.\nThis is how a campaign travels between worlds without dragging its skeleton behind it."
    },
    {
      id: "selected", title: "The selected campaign",
      selector: '[data-tour="campaign.selected"]',
      optional: true,
      text: "Metadata, description, and the faction roster this campaign concerns — the Settings button edits them.\nActive Factions matter: several engines filter their attention to the campaign's cast."
    },
    {
      id: "travel", title: "Travel tables",
      pre: '[data-action="main-tab"][data-tab="travel"]',
      selector: '[data-tour="campaign.panel-travel"]',
      text: "Terrain- and tier-keyed encounter tables (travel_<terrain>_t<tier>) that the Travel Console rolls when parties move. Fix Travel Tables repairs the id wiring.\nPreview Roll is a true dry-run: it shows which beat WOULD fire, with a clearly-labeled 'Run This Beat Now' escalation if you actually want it live.",
      speak: "Preview means preview now. The world and the button have— *bzzt* —reconciled."
    },
    {
      id: "beats", title: "Beats — the story's ammunition",
      pre: '[data-action="main-tab"][data-tab="beats"]',
      selector: '[data-tour="campaign.panel-beats"]',
      text: "Every beat in the campaign, in firing order. Filters by text, type, turn gate and quest; the chips show fired-state, quest binding and turn gating (turn gates are advisory — the GM gets a whisper, not a lock).\nReorder with the arrows; Set Index jumps a beat to a slot; Compact Order squeezes the numbering back to 1..N."
    },
    {
      id: "beatactions", title: "Per-beat actions",
      selector: '[data-tour="campaign.beat-actions"]',
      optional: true,
      text: "Run executes the beat NOW — journal, audio, scene, dialog, world effects, time points, in that order — and soft-locks it behind the fired-chip confirm. Edit opens the Beat Editor (its own tour).\nDelete now scans the campaign for references first and offers 'Delete + Clear Links' — no more silent dangling routes."
    },
    {
      id: "quests", title: "Quests — story bound to land",
      pre: '[data-action="main-tab"][data-tab="quests"]',
      selector: '[data-tour="campaign.panel-quests"]',
      text: "The quest registry: status lifecycle (edit, complete, archive, reopen), and hex links — bind a quest to territory, and players discover it when the hex is fog-revealed or you toggle its hint. GMs see everything; the hint switches control what players see.\nPan-to-hex jumps the canvas; the faction sheets' Quest Logs read from here."
    },
    {
      id: "flow", title: "The Visualizer — where you PLAY it",
      pre: '[data-action="main-tab"][data-tab="flow"]',
      selector: '[data-tour="campaign.flow-canvas"]',
      optional: true,
      text: "Every other room in this machine BUILDS the campaign. This room plays it. Beats are live cards: ⚡ ready now, ⛩ blocked (hover for exactly which condition, with its current value), ✓ fired — dimmed and turn-stamped, ⏳ cooling. A green ▶ on a ready card fires it right here.\nScroll to zoom at the cursor, drag anywhere to pan, click a card to open its editor.",
      speak: "The other tabs are the workshop. This is the— *bzzt* —cockpit."
    },
    {
      id: "flowscope", title: "Scope — the map that grows",
      selector: '[data-tour="campaign.flow-scope"]',
      optional: true,
      text: "▶ In play (the default) shows only the living map: the trail behind you, what's ready or cooling now, and what's within one unlock of the table. 🛠 Everything is the author's full corpus — all 600-odd beats.\nIn play, the map GROWS as the campaign is played. Act 6 stays invisible until the world walks toward it."
    },
    {
      id: "flowbar", title: "The flow toolbar",
      selector: '[data-tour="campaign.flow-bar"]',
      optional: true,
      text: "Turn, Quest, Act and View filters — they stack with Scope. Act slices one act of the funnel (Ambient = the phase-free pool: travel encounters, the Garden); Lanes view lays quests out as horizontal timelines, the fastest way to sanity-check an arc.\n🔄 Reset opens the Reset Console; 📊 Census prints the campaign's health report."
    },
    {
      id: "flowmeta", title: "The truth strip",
      selector: '[data-tour="campaign.flow-meta"]',
      optional: true,
      text: "Where the world stands, in one line: current ACT and its name, world turn, days spent against the month's budget, and the live counts — ⚡ ready · ⛩ blocked · ✓ fired · 🔊 voiced.\nWhen anyone asks 'where are we in the campaign?', the answer is this strip."
    },
    {
      id: "nowpanel", title: "The Now Panel — your co-pilot",
      selector: '[data-tour="campaign.now-panel"]',
      optional: true,
      text: "On a brand-new campaign this opens with one unmissable card: 🎬 BEGIN — the canonical opening beat and a big ▶. Your first click requires zero knowledge.\nBelow it: ⚡ Available now (story beats first; the self-firing 🎲 ambient pool folded away), ⏳ Coming up with the exact condition each beat waits on, and sections that wake as they gain signal — chains, pressures, faction relations. Every row: click to fly the camera there, ⓘ for the full description, ▶ to fire. Drag the left edge to widen.",
      speak: "It starts with one button. It ends with a war room. That's— —static— —intentional."
    }
  ]
};

/* ───────────────────── GM · Beat Editor ───────────────────── */
// Opens the first beat of the active campaign. All five panels are in the DOM
// (.is-hidden); switch via .bbttcc-tab[data-tab] clicks (which also run the
// sync-preserve hooks). Injected panels land ~50ms post-render — the runner's
// waitFor polling absorbs that. Text: "beats" dictionary (120 keys).

const beatEditorTour = {
  id: "beat-editor",
  title: "Anatomy of a Beat (Beat Editor)",
  audience: "gm",
  intro: "GM channel. Opening a real beat from your active campaign — the atom of the story engine. Five tabs, a lot of wiring, and a tooltip on every wire. Edits survive tab-hopping now; Save is still the only real commit.",
  outro: "Beat toured. The rules in one breath: complete quests on terminal beats, treat the id field as load-bearing, and Save before you close. Everything else, hover for.",

  open: async () => {
    const api = game.bbttcc?.api?.campaign;
    if (!api) { ui.notifications?.warn?.("Campaign module not loaded."); return null; }
    const campaignId = api.getActiveCampaignId?.() || null;
    const beat = campaignId ? (api.getCampaign?.(campaignId)?.beats?.[0] || null) : null;
    if (!campaignId || !beat) {
      ui.notifications?.warn?.("No active campaign with beats — set a campaign Active in the Campaign Engine, then rerun this tour.");
      return null;
    }
    try {
      const mod = await import("/modules/bbttcc-campaign/apps/campaign-beat-editor.js");
      const App = mod.BBTTCCCampaignBeatEditorApp || mod.default;
      if (!App) throw new Error("Beat editor class not found");
      new App({ campaignId, beat, activeTab: "core" }).render(true);
    } catch (e) {
      console.warn("[onboarding/tour-defs] beat editor open failed", e);
      ui.notifications?.warn?.("Could not open the Beat Editor — open a beat via the Campaign Engine's Edit button and rerun.");
    }
    return null; // window: #bbttcc-campaign-beat-editor
  },

  steps: [
    {
      id: "tabs", title: "Five tabs, one atom",
      selector: '[data-tour="beats.tabs"]',
      text: "Core (identity), Injection (when it fires on its own), Scene (what it shows), Choices (how players branch it), Effects (what it does to the world).\nAll five tabs preserve in-progress edits when you switch — Save commits them to the beat."
    },
    {
      id: "basics", title: "Identity — id, label, type",
      selector: '[data-tour="beats.basicInfo"]',
      text: "The id is load-bearing: choices, outcome routes and encounter tables reference beats by id. Rename with care and re-check routes after.\nType changes the beat's anatomy — encounter and cinematic types grow extra sections."
    },
    {
      id: "quest", title: "Quest linkage",
      selector: '[data-tour="beats.questLinkage"]',
      text: "Binds this beat to a quest, step and role. The golden rule from the fire-order work: put quest COMPLETION on terminal beats — child routes resolve before parent effects, so mid-chain completion can strand the quest."
    },
    {
      id: "audio", title: "Audio — intro-on-open",
      selector: '[data-tour="beats.audio"]',
      optional: true,
      text: "The beat's soundscape. Intro audio fires when the dialog OPENS (the locked design call), curtain-call rules handle the tail. Playlist sounds use their playlist volume; the volume knob here only governs raw file playback."
    },
    {
      id: "injection", title: "Injection — firing on its own",
      pre: '.bbttcc-tab[data-tab="injection"]',
      selector: '[data-tour="beats.injection"]',
      text: "Tag-matched injection lets travel and world systems pull this beat in dynamically. Once-per-hex, cooldown turns and repeatable control re-firing; once-per-firing semantics are engine-enforced.\nThe Governance quartet is visibly disabled with a 'not wired' badge — the injector reads those from trigger context, so the controls tell the truth until they're connected."
    },
    {
      id: "scene", title: "Scene — what the players see",
      pre: '.bbttcc-tab[data-tab="scene"]',
      selector: '[data-tour="beats.linkedScene"]',
      text: "Scene link and activation, journal page reveal, and NPC actor placement — the beat can dress the stage before the dialog opens.\nCinematic-type beats get their transition block here."
    },
    {
      id: "choices", title: "Choices — the branches",
      pre: '.bbttcc-tab[data-tab="choices"]',
      selector: '[data-tour="beats.choices"]',
      optional: true,
      text: "Each choice routes to a next beat, optionally gated by a stat check with a DC and a separate failure route.\nBelow the choices, the new Outcomes section authors beat.outcomes — the success/failure fallback routes that outcome-trigger beats and unrouted check failures resolve through.",
      speak: "Every choice is a door. As of today, every door has a visible hinge."
    },
    {
      id: "effects", title: "World Effects — the payload",
      pre: '.bbttcc-tab[data-tab="effects"]',
      selector: '[data-tour="beats.worldEffects"]',
      text: "What firing actually does: territory outcomes, radiation deltas, faction effects, spark links, gate unlocks, turn requests, quest effects, war-log entries — applied in the engine's fixed order (hover the header for it).\nThese fields now survive tab switches and row-adds like everything else; Save commits."
    },
    {
      id: "casualties", title: "The injected panels",
      selector: '[data-tour="beats.casualties"]',
      optional: true,
      text: "Casualties, faction GM effects, world modifiers, unlocks — panels injected by their engines about 50ms after render.\nRelationship Effects is live now: rows save in the mutation engine's shape, Reciprocal mirrors the row both directions, and old-format rows migrate on load."
    },
    {
      id: "footer", title: "Save — the only real commit",
      selector: '[data-tour="beats.footer"]',
      text: "Save harvests the whole form and writes the beat; Cancel discards everything including panel edits.\nTab switches no longer eat edits, but Save is still the only thing that writes to the campaign — close without it and the session never happened."
    }
  ]
};

/* ───────────────────── GM · Story Console ───────────────────── */
// Mal's manual mission control — same engine the Story Director runs
// autonomously. Text from the "story" help dictionary (bbttcc-core).

const storyConsoleTour = {
  id: "story-console",
  title: "Mal's Remote Control (Story Console)",
  audience: "gm",
  intro: "GM channel. Opening the GOTTGAIT Story Console — the manual override on the story engine. The Story Director fires beats on its own schedule; this window is you, reaching past it, saying 'this one, now'.",
  outro: "Story Console toured. Director for the drumbeat, console for the solo. Every fire from either lands in the same ledger — the story never forgets who pulled the trigger.",

  open: async () => {
    const openConsole = game.bbttcc?.api?.story?.openGOTTGAITConsole;
    if (!openConsole) { ui.notifications?.warn?.("Story Console not loaded — is bbttcc-core enabled?"); return null; }
    return openConsole() || null; // window: #gottgait-story-console
  },

  steps: [
    {
      id: "root", title: "The manual override",
      selector: '[data-tour="story.root"]',
      text: "Every button here calls the same campaign APIs the autonomous Story Director uses — run a beat, fire the injector, roll an encounter table — and every fire is recorded in the shared director ledger.\nDirector = automatic. Console = you."
    },
    {
      id: "filters", title: "Quest & Turn filters",
      selector: '[data-tour="story.filters"]',
      text: "Narrow every beat list below by quest binding or authored turn number. These persist world-wide (all GMs share them), so the console reopens where you left it."
    },
    {
      id: "advisor", title: "The GM Advisor",
      selector: '[data-tour="story.advisor"]',
      text: "Reads the world's vital signs — faction Stability, logistics Overextension, table Narrative momentum — and makes a Difficulty call (hold or raise), with beat and table suggestions to match.\nMal adds an editorial one-liner. Hover each band in the report for what it means.",
      speak: "The Advisor reads the room. Mal reads the Advisor. You read Mal. Chain of command— *bzzt* —functioning."
    },
    {
      id: "activate", title: "Activate — one switch, whole engine",
      selector: '[data-tour="story.activate"]',
      optional: true,
      text: "Sets the active campaign for EVERYTHING — the Story Director's autonomous firing, quests, doors, turn announcements, and this console — in one click.\n(Until today this button only switched the console and quietly left the Director on the old campaign. One setting now.)"
    },
    {
      id: "builder", title: "Straight to the Builder",
      selector: '[data-tour="story.builder"]',
      optional: true,
      text: "Opens the Campaign Engine on this campaign — for when running beats turns into editing them. The Builder and Beat Editor have their own tours."
    },
    {
      id: "injector", title: "Injector Fire",
      selector: '[data-tour="story.injector"]',
      optional: true,
      text: "Fires the tag-matched beat injector by hand: point it at a hex, give it tags, and it pulls an eligible beat exactly as travel would — same gating, same once-per-hex rules, same ledger entry."
    },
    {
      id: "tables", title: "Random tables — Mal's dice",
      selector: '[data-tour="story.tables"]',
      optional: true,
      text: "Rolls an encounter table on demand — hex and tags filter eligibility, and the rolled beat runs for real. This is the loaded one; the Builder's Preview Roll is the rehearsal."
    },
    {
      id: "beats", title: "Run any beat, now",
      selector: '[data-tour="story.beats"]',
      optional: true,
      text: "The filtered beat list for the active campaign. One click runs the beat through the full pipeline — journal, audio, scene, dialog, effects.\n✓ badges mark already-fired beats, and re-running one asks first — the soft-lock reads the Director's ledger."
    }
  ]
};

/* ───────────────────── registration ───────────────────── */

Hooks.once("ready", () => {
  const tours = globalThis.game?.bbttcc?.onboarding?.tours;
  if (!tours?.register) return console.warn(TAG, "tour engine missing — defs not registered.");
  tours.register(stewardSheetTour);
  tours.register(bridgeTour);
  tours.register(factionSheetTour);
  tours.register(factionGmTour);
  tours.register(hexSheetTour);
  tours.register(travelConsoleTour);
  tours.register(plannerTour);
  tours.register(raidConsoleTour);
  tours.register(rigSheetTour);
  tours.register(marketTour);
  tours.register(banksTour);
  tours.register(facilitiesTour);
  tours.register(hexCraftTour);
  tours.register(turnDriverTour);
  tours.register(dashboardTour);
  tours.register(overviewTour);
  tours.register(campaignEngineTour);
  tours.register(beatEditorTour);
  tours.register(storyConsoleTour);
  console.log(TAG, "registered: steward-sheet, bridge, faction-sheet, faction-gm, hex-sheet, travel-console, planner-hud, raid-console, rig-sheet, market, banks, facilities, hex-craft, turn-driver, dashboard, overview, campaign-engine, beat-editor, story-console");
});
