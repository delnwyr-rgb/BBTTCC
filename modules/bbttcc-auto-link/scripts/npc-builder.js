/* Bad Eden Auto-Link — RFI NPC Builder
 *
 * Light dialog (Manifestation Wizard pattern, not Tree of Life) that creates
 * a Roll For Initiation NPC as a CHARACTER-typed actor with an entityKind
 * flag marker. This lets the resulting actor use the full native PC sheet
 * (so all class / ancestry / heritage / archetype / etc. mechanisms work
 * out of the box) while being identifiable as an NPC for downstream hooks
 * via flags.bbttcc-auto-link.entityKind = "npc".
 *
 * Drag class / ancestry / heritage / archetype items onto the resulting
 * sheet — they wire identically to PC drops.
 *
 * 2026-05-16 — Classed Monsters sprint, NPC Builder slice.
 */

const MOD = "bbttcc-auto-link";
const CALLINGS_PACK = "bbttcc-character-options.npc-callings";
const ANCESTRIES_PACK = "bbttcc-master-content.ancestries";
const BRIDGE_PATH = "systems/fourththing/bbttcc-bridge.js";

/* Ancestry + heritage enumeration mirrors the steward sheet's indexers
 * (ftIndexItemPackByType / ftIndexHeritagePack in bbttcc-bridge.js — not
 * exported, so the shapes are replicated here). The GRANTS themselves go
 * through the bridge's exported applyActorAncestryChange /
 * applyActorHeritageChange so builder-made NPCs match sheet-edited ones. */

const _normFam = (s) => String(s ?? "").toLowerCase().replace(/-/g, "_");
// Cross-cutting heritage families bypass the ancestry filter (they key off
// sephirah alignment, not species) — keep in sync with bbttcc-bridge.js.
const CROSS_CUTTING_HERITAGE_FAMILIES = new Set(["sephirotic"]);

async function _ancestryIndex() {
  const pack = game.packs.get(ANCESTRIES_PACK);
  if (!pack) return [];
  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier", "flags.bbttcc.family", "flags.bbttcc.ancestryKey"] });
    return idx
      .filter(e => e.type === "species" || e.type === "race")
      .map(e => {
        const flags = e.flags?.bbttcc ?? {};
        return {
          id: e._id, name: e.name,
          family: _normFam(flags.family ?? e["flags.bbttcc.family"]
            ?? flags.ancestryKey ?? e["flags.bbttcc.ancestryKey"]
            ?? e.system?.identifier ?? e["system.identifier"])
        };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (err) {
    console.warn("[bbttcc-auto-link/npc-builder] ancestry index failed", err);
    return [];
  }
}

async function _heritageIndex() {
  const pack = game.packs.get(ANCESTRIES_PACK);
  if (!pack) return [];
  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier", "flags.bbttcc.kind", "flags.bbttcc.family"] });
    const candidates = idx
      .filter(e => String(e.type || "").toLowerCase() === "feat")
      .map(e => {
        const identifier = String(e.system?.identifier ?? e["system.identifier"] ?? "").toLowerCase();
        const flags = e.flags?.bbttcc ?? {};
        const kind = String(flags.kind ?? e["flags.bbttcc.kind"] ?? "").toLowerCase();
        // Shape 1: explicit heritage root. Shape 2: lineage tier-1 standing in
        // as the root for species that ship no separate root item.
        const isRoot = kind === "heritage" || identifier.endsWith("_heritage");
        const isTier1 = kind && identifier.endsWith("_tier1") && identifier.startsWith(`${kind}_`);
        if (!isRoot && !isTier1) return null;
        let family = _normFam(flags.family ?? e["flags.bbttcc.family"]);
        if (!family) {
          if (isTier1) family = _normFam(kind);
          else { const m = identifier.match(/^([a-z0-9]+)_/); if (m) family = m[1]; }
        }
        return { id: e._id, name: e.name, family, isRoot };
      })
      .filter(Boolean);
    // Families with an explicit root drop their tier-1 fallbacks (those are
    // heritage CONTENTS, not selectable heritages).
    const familiesWithRoot = new Set(candidates.filter(c => c.isRoot).map(c => c.family));
    return candidates
      .filter(c => c.isRoot || !familiesWithRoot.has(c.family))
      .map(({ id, name, family }) => ({ id, name, family }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (err) {
    console.warn("[bbttcc-auto-link/npc-builder] heritage index failed", err);
    return [];
  }
}

async function _callingOptions() {
  const pack = game.packs.get(CALLINGS_PACK);
  if (!pack) return null;
  try {
    const index = await pack.getIndex({ fields: ["type"] });
    const callings = index.filter(e => e.type === "class")
      .map(e => ({ id: e._id, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!callings.length) return null;
    return ['<option value="">— None (drag items later) —</option>']
      .concat(callings.map(c => `<option value="${c.id}">${foundry.utils.escapeHTML(c.name)}</option>`))
      .join("");
  } catch { return null; }
}

/* Grant a Calling to a freshly-built NPC: the class item, every tier feature
 * at or below the NPC's tier, and the aptitude kit (signature rank = tier,
 * secondary = tier − 1) read from the class item's flags. */
async function _grantCalling(actor, callingId, tier) {
  const pack = game.packs.get(CALLINGS_PACK);
  if (!pack) return;
  const classDoc = await pack.getDocument(callingId);
  const calling = classDoc?.flags?.fourththing?.calling;
  if (!classDoc || !calling?.key) return;

  const docs = await pack.getDocuments();
  const feats = docs
    .filter(d => d.type === "feature"
      && d.flags?.fourththing?.calling?.key === calling.key
      && Number(d.flags.fourththing.calling.tier ?? 99) <= tier)
    .sort((a, b) => Number(a.flags.fourththing.calling.tier) - Number(b.flags.fourththing.calling.tier));
  await actor.createEmbeddedDocuments("Item", [classDoc, ...feats].map(d => d.toObject()));

  const kit = {};
  if (calling.signature) kit[`system.skills.${calling.signature}.value`] = tier;
  if (calling.secondary) kit[`system.skills.${calling.secondary}.value`] = Math.max(0, tier - 1);
  if (Object.keys(kit).length) await actor.update(kit);
}

function _factionOptions() {
  const factions = (game.actors?.contents ?? [])
    .filter(a => {
      try {
        const k = game.bbttcc?.api?.actorKind?.(a);
        if (k) return k === "faction";
        return a.getFlag?.("bbttcc-factions", "isFaction")
          || a?.flags?.["bbttcc-factions"]?.isFaction
          || String(foundry.utils.getProperty(a, "system.details.type.value") ?? "").toLowerCase() === "faction";
      } catch { return false; }
    })
    .map(a => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return ['<option value="">— Unaffiliated —</option>']
    .concat(factions.map(f => `<option value="${f.id}">${foundry.utils.escapeHTML(f.name)}</option>`))
    .join("");
}

export async function openNPCBuilder() {
  const factionOpts = _factionOptions();
  const callingOpts = await _callingOptions();
  const ancestries  = await _ancestryIndex();
  const heritages   = await _heritageIndex();
  const esc = (s) => foundry.utils.escapeHTML(String(s));

  const ancestryOpts = ['<option value="">— None —</option>']
    .concat(ancestries.map(a => `<option value="${a.id}" data-family="${esc(a.family)}">${esc(a.name)}</option>`))
    .join("");

  const callingGroup = callingOpts ? `
      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Calling</label>
        <select data-bbttcc-field="callingId" style="padding:0.35rem 0.5rem; border-radius:3px;">${callingOpts}</select>
        <span style="opacity:0.65; font-size:0.75rem;">Non-Surge NPC-grade class: grants the Calling, its tier features, and its aptitude kit.</span>
      </div>` : "";

  // No outer <form> tag — Foundry's Dialog wraps content in its own <form>
  // element and nested forms get stripped by the browser. Use a <div> wrapper
  // and read inputs by querySelector in the callback.
  const content = `
    <div class="bbttcc-npc-builder" style="display:flex; flex-direction:column; gap:0.6rem;">
      <p style="margin:0 0 0.4rem; opacity:0.85; font-size:0.85rem;">
        Create a Roll For Initiation NPC. The actor uses the full PC sheet so
        every class, ancestry, heritage, archetype, crew, occult, alignment,
        and political-philosophy option works natively. It's flag-marked as
        an NPC for downstream targeting and behavior hooks.
      </p>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Name <span style="color:#f87171">*</span></label>
        <input type="text" data-bbttcc-field="name" required placeholder="e.g. Hex-Touched Champion" autofocus
               style="padding:0.35rem 0.5rem; border-radius:3px;"/>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Tier</label>
        <select data-bbttcc-field="tier" style="padding:0.35rem 0.5rem; border-radius:3px;">
          <option value="1">Tier I (level 1–4)</option>
          <option value="2">Tier II (level 5–10)</option>
          <option value="3">Tier III (level 11–16)</option>
          <option value="4">Tier IV (level 17+)</option>
        </select>
      </div>

      ${callingGroup}

      ${ancestries.length ? `
      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Ancestry</label>
        <select data-bbttcc-field="ancestryId" style="padding:0.35rem 0.5rem; border-radius:3px;">${ancestryOpts}</select>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Heritage</label>
        <select data-bbttcc-field="heritageId" style="padding:0.35rem 0.5rem; border-radius:3px;"></select>
        <span style="opacity:0.65; font-size:0.75rem;">Filtered by the chosen ancestry (Sephirotic heritages are always available).</span>
      </div>` : ""}

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Faction</label>
        <select data-bbttcc-field="factionId" style="padding:0.35rem 0.5rem; border-radius:3px;">${factionOpts}</select>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Token Disposition</label>
        <select data-bbttcc-field="disposition" style="padding:0.35rem 0.5rem; border-radius:3px;">
          <option value="-1" selected>Hostile</option>
          <option value="0">Neutral</option>
          <option value="1">Friendly</option>
          <option value="-2">Secret</option>
        </select>
      </div>

      <p style="opacity:0.7; font-size:0.78rem; margin:0.4rem 0 0;">
        After creation: open the sheet and drag Archetype / Crew / Occult /
        Sephirotic items from compendiums to flesh out the NPC further. All
        abilities will function the same as on a PC sheet.
      </p>
    </div>
  `;

  const result = await Dialog.wait({
    title: "Create RFI NPC",
    content,
    buttons: {
      create: {
        label: "Create NPC",
        icon: '<i class="fas fa-skull"></i>',
        callback: (html) => {
          const root = (html instanceof HTMLElement ? html : html[0]);
          if (!root) return { ok: false };
          const read = (k) => root.querySelector(`[data-bbttcc-field="${k}"]`)?.value ?? "";
          return {
            ok: true,
            name:        read("name"),
            tier:        read("tier"),
            callingId:   read("callingId"),
            ancestryId:  read("ancestryId"),
            heritageId:  read("heritageId"),
            factionId:   read("factionId"),
            disposition: read("disposition")
          };
        }
      },
      cancel: { label: "Cancel", callback: () => ({ ok: false }) }
    },
    default: "create",
    // Heritage dropdown re-filters live as the ancestry changes — same
    // family rules as the steward sheet's edit dropdowns.
    render: (html) => {
      const root = (html instanceof HTMLElement ? html : html[0]);
      const ancSel = root?.querySelector('[data-bbttcc-field="ancestryId"]');
      const herSel = root?.querySelector('[data-bbttcc-field="heritageId"]');
      if (!ancSel || !herSel) return;
      const rebuild = () => {
        const fam = _normFam(ancSel.selectedOptions[0]?.dataset?.family ?? "");
        const keep = herSel.value;
        const opts = heritages.filter(h => !fam || !h.family
          || _normFam(h.family) === fam
          || CROSS_CUTTING_HERITAGE_FAMILIES.has(_normFam(h.family)));
        herSel.innerHTML = ['<option value="">— None —</option>']
          .concat(opts.map(h => `<option value="${h.id}">${esc(h.name)}</option>`))
          .join("");
        if (opts.some(h => h.id === keep)) herSel.value = keep;
      };
      ancSel.addEventListener("change", rebuild);
      rebuild();
    }
  });

  if (!result?.ok) return null;
  const name = String(result.name || "").trim();
  if (!name) {
    ui.notifications?.warn?.("RFI NPC needs a name.");
    return null;
  }

  const tier = Math.max(1, Math.min(4, Number(result.tier) || 1));
  const disposition = Number(result.disposition ?? -1);
  const factionId = String(result.factionId || "").trim();

  // Build the actor payload. type:"character" so the full PC sheet renders
  // and every existing PC-side mechanism (FEATURE_ROUTER, identity bridge,
  // Bad Eden quickbar, Affiliations card, etc.) Just Works.
  const data = {
    name,
    type: "character",
    flags: {
      [MOD]: {
        entityKind: "npc",
        createdViaNPCBuilder: true,
        createdAt: Date.now()
      }
    },
    system: {
      details: { tier }
    },
    prototypeToken: {
      // NPCs default to UNLINKED tokens so each placed token is an independent
      // instance — matches Foundry's NPC convention.
      actorLink: false,
      disposition
    }
  };

  if (factionId) {
    data.flags["bbttcc-factions"] = { factionId };
  }

  let actor;
  try {
    actor = await Actor.create(data);
  } catch (err) {
    console.error("[bbttcc-auto-link/npc-builder] Actor.create failed", err);
    ui.notifications?.error?.(`Failed to create RFI NPC: ${err?.message || err}`);
    return null;
  }
  if (!actor) return null;

  const callingId = String(result.callingId || "").trim();
  if (callingId) {
    try {
      await _grantCalling(actor, callingId, tier);
    } catch (err) {
      console.error("[bbttcc-auto-link/npc-builder] Calling grant failed", err);
      ui.notifications?.warn?.(`NPC created, but the Calling grant failed: ${err?.message || err}`);
    }
  }

  // Ancestry + heritage go through the system bridge — the same apply
  // functions the steward sheet's edit dropdowns call, so the NPC gets the
  // species item, L1 advancement grants, lineage stamps, and nativeLinks
  // flags exactly as if edited by hand. Ancestry FIRST (its cascade clears
  // heritage), then heritage.
  const ancestryId = String(result.ancestryId || "").trim();
  const heritageId = String(result.heritageId || "").trim();
  if (ancestryId || heritageId) {
    try {
      const bridge = await import(foundry.utils.getRoute(BRIDGE_PATH));
      if (ancestryId) await bridge.applyActorAncestryChange(actor, ancestryId);
      if (heritageId) await bridge.applyActorHeritageChange(actor, heritageId);
    } catch (err) {
      console.error("[bbttcc-auto-link/npc-builder] ancestry/heritage grant failed", err);
      ui.notifications?.warn?.(`NPC created, but the ancestry/heritage grant failed: ${err?.message || err} — drag them onto the sheet instead.`);
    }
  }

  actor.sheet?.render(true);
  ui.notifications?.info?.(`Created RFI NPC: ${actor.name} (tier ${tier})`);
  return actor;
}

/* ======================================================================
 * Echo Mint — crew / occult roster members → real NPC actors
 *
 * Echo Rosters (bbttcc-bridge.js) already model WHO was in a Steward's
 * past-life crew or occult association; each member carries a reserved
 * `actorUuid` seam. This section fills it: mint a roster member as a
 * CHARACTER-typed NPC (same chassis as openNPCBuilder) with
 *   - a Calling picked from the crew/occult family (role keywords override),
 *   - an ECHO BOON: a bespoke 1/scene ability the family leaves on its
 *     people, in the Callings Trick house style, tier-scaled,
 *   - a tier-appropriate gear kit pulled from "Bad Eden: Items",
 * then writes the new actor's uuid back into the roster member.
 * ==================================================================== */

const ITEMS_PACK = "bbttcc-master-content.items";
const ECHO_TIER_TITLES = { 1: "Apprentice", 2: "Initiate", 3: "Master", 4: "Archon" };

const _echoSlug = (s) => String(s ?? "").toLowerCase()
  .replace(/\(tier\s*[ivx\d]+\)/g, "")
  .replace(/^(crew type|awesome crew|occult association)\s*:\s*/i, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* Family registry — keys match the packs' flags.bbttcc-character-options
 * option keys (dumped 2026-07-13 from crew-types / occult-associations).
 * `match` lists extra slugs the roster entry name may normalize to.
 * Boon `effect` strings may use {tier} and {2tier} tokens. */
const ECHO_FAMILIES = {
  /* ---- crews ---- */
  "mercenary-band": { kind: "crew", calling: "bravo", boon: {
    name: "One Last Contract", img: "icons/svg/sword.svg",
    flavor: "They took this contract lifetimes ago. It never closed.",
    effect: "Once per scene, when the echo strikes in direct defense of their Steward or a crewmate, the blow lands as if one tier higher and adds +{tier} damage." } },
  "storm-wardens": { kind: "crew", calling: "stalwart", boon: {
    name: "Weathered the Worst", img: "icons/svg/lightning.svg",
    flavor: "There is no storm they haven't already stood through once.",
    effect: "Once per scene, ignore one environmental or weather complication outright; allies within reach reduce its effect by {tier}." } },
  "ironbound-ascendants": { kind: "crew", calling: "bravo", boon: {
    name: "Iron Doctrine", img: "icons/svg/upgrade.svg",
    flavor: "The discipline outlived the order that taught it.",
    effect: "Once per scene, convert one failed Body defense into a success. While adjacent to their Steward, the echo adds +1 Guard." } },
  "ashbound-survivors": { kind: "crew", calling: "stalwart", boon: {
    name: "Rose From Ash", img: "icons/svg/fire.svg",
    flavor: "They have already died once, in the fire everyone talks about.",
    effect: "Once per scene, when reduced to 0 Integrity, hold at {tier} Integrity instead and act normally this round." } },
  "cultural-ambassadors": { kind: "crew", calling: "broker", boon: {
    name: "Every Tongue", img: "icons/svg/sound.svg",
    flavor: "A hundred tables, a hundred customs, none of them foreign anymore.",
    effect: "The echo speaks and reads every living language. Once per scene, shift a stranger's disposition one step toward friendly." } },
  "diplomatic-envoys": { kind: "crew", calling: "broker", boon: {
    name: "Under Flag", img: "icons/svg/holy-shield.svg",
    flavor: "The flag of parley is stitched into how they carry themselves.",
    effect: "Once per scene, declare parley: the echo cannot be attacked until they act aggressively this scene." } },
  "peacekeeper-corps": { kind: "crew", calling: "bravo", boon: {
    name: "De-escalate", img: "icons/svg/mage-shield.svg",
    flavor: "A thousand checkpoint standoffs live in the set of their shoulders.",
    effect: "Once per scene, freeze one act of violence before it lands — both parties hold for one beat while the echo speaks." } },
  "gridbreakers": { kind: "crew", calling: "operator", boon: {
    name: "Dead Channel", img: "icons/svg/silenced.svg",
    flavor: "Every grid has a weak span. They've slept inside most of them.",
    effect: "Once per scene, kill one device, camera, ward-node, or comm-line within near range until the scene ends." } },
  "verdant-stalkers": { kind: "crew", calling: "operator", boon: {
    name: "Green Silence", img: "icons/svg/oak.svg",
    flavor: "The green remembers them kindly and closes behind their steps.",
    effect: "Once per scene, the echo and one ally leave no trail and make no sound until either next acts openly." } },
  "covert-ops-cell": { kind: "crew", calling: "operator", boon: {
    name: "Never Here", img: "icons/svg/invisible.svg",
    flavor: "Officially, this person does not exist. Officially never changed.",
    effect: "Once per scene, retroactively establish the echo was somewhere else; one witness's account of them unravels." } },
  "survivors-militia": { kind: "crew", calling: "bravo", match: ["survivors", "militia"], boon: {
    name: "Hold the Door", img: "icons/svg/door-closed.svg",
    flavor: "Someone held the door once so they could live. They pay it forward.",
    effect: "Once per scene, utterly bar one entrance or chokepoint — nothing passes it for {tier} rounds." } },
  "abyssal-cartographers": { kind: "crew", calling: "savant", match: ["abyssal-cartographer"], boon: {
    name: "I Mapped This Dark", img: "icons/svg/cave.svg",
    flavor: "They have been deeper than this, with worse light.",
    effect: "Once per scene, the GM truthfully sketches the current site — exits, hazards, and one hidden thing." } },
  /* ---- occult associations ---- */
  "kabbalist": { kind: "occult", calling: "savant", boon: {
    name: "Letter of Making", img: "icons/svg/book.svg",
    flavor: "Some letters were taught to them before the world got its name back.",
    effect: "Once per scene, inscribe one Letter upon a door or object: it counts sealed and warded, −{tier} to any attempt to breach it, until the scene ends." } },
  "shaman": { kind: "occult", calling: "keeper", boon: {
    name: "Spirit Ledger", img: "icons/svg/pawprint.svg",
    flavor: "The local spirits keep accounts, and this one is owed.",
    effect: "Once per scene, ask the spirits of the place one yes/no question; they answer truthfully (GM voice)." } },
  "rosicrucian": { kind: "occult", calling: "savant", boon: {
    name: "Rose Cipher", img: "icons/svg/eye.svg",
    flavor: "Every symbol is a door, and they were given the hinge-oil.",
    effect: "Once per scene, read the concealed meaning of a document, symbol, or rite; codes and forgeries open to them." } },
  "biomancer": { kind: "occult", calling: "savant", match: ["biomancer-fleshcrafter", "fleshcrafter"], boon: {
    name: "Knit the Flesh", img: "icons/svg/regen.svg",
    flavor: "Flesh is a language; theirs is fluent, if oddly accented.",
    effect: "Once per scene, a touch restores {2tier} Integrity to a living creature, or purges one poison or disease." } },
  "goetic-summoner": { kind: "occult", calling: "keeper", boon: {
    name: "Name the Lesser", img: "icons/svg/cowled.svg",
    flavor: "A short list of small names, each one still under contract.",
    effect: "Once per scene, call a minor bound spirit for one errand — scout, fetch, carry, distract — lasting until the scene ends." } },
  "prophet-oracle": { kind: "occult", calling: "keeper", match: ["prophet", "oracle"], boon: {
    name: "It Was Foretold", img: "icons/svg/sun.svg",
    flavor: "They flinch a half-second before the dice do.",
    effect: "Once per scene, force a reroll of any one roll made within sight — the echo already saw it fall the other way." } },
  "tarot-mage": { kind: "occult", calling: "keeper", boon: {
    name: "Card Already Drawn", img: "icons/svg/daze.svg",
    flavor: "The deck was cut years ago; they're just turning the cards over.",
    effect: "Once per scene, name the Sun or the Tower: an ally gains +2 (Sun) or a foe suffers −2 (Tower) on their next check made within sight." } },
  "exorcist": { kind: "occult", calling: "keeper", match: ["exorcist-purifier", "purifier"], boon: {
    name: "Cast Out", img: "icons/svg/angel.svg",
    flavor: "What they drove out once still remembers their voice, and goes.",
    effect: "Once per scene, end one possession, haunting, or qliphothic effect of tier {tier} or lower on a touched subject." } },
  "gnostic": { kind: "occult", calling: "keeper", boon: {
    name: "Behind the Veil", img: "icons/svg/light.svg",
    flavor: "They woke up once inside the lie, and never quite fell back asleep.",
    effect: "Once per scene, for the rest of the scene the echo sees through illusions, glamours, and false faces within near range." } },
  "alchemist": { kind: "occult", calling: "savant", boon: {
    name: "One Vial Left", img: "icons/svg/poison.svg",
    flavor: "There is always exactly one vial left. Nobody asks where from.",
    effect: "Once per scene, produce one draught: restore {2tier} Integrity, or an acid, smoke, or antidote of tier {tier} or lower." } },
};

const ECHO_FALLBACK_BOON = {
  name: "Echo of a Past Life", img: "icons/svg/aura.svg",
  flavor: "The Steward remembers them for one thing above all. It still works.",
  effect: "Once per scene, do the thing the Steward remembers them for — automatically succeed at one tier-appropriate check within this crew's trade."
};

/* Role keywords override the family's default Calling — a Mercenary Band
 * chirurgeon should mint Savant, not Bravo. First match wins. */
const ECHO_ROLE_CALLINGS = [
  [/sniper|guard|soldier|blade|duelist|enforcer|muscle|sergeant|warrior|gunner|shooter/i, "bravo"],
  [/scout|infiltrat|thief|spy|lookout|smuggl|fence|burglar|assassin|tracker|stalker/i, "operator"],
  [/face|negotiat|diplomat|trader|broker|quartermaster|merchant|liaison|herald|envoy/i, "broker"],
  [/medic|chirurgeon|doctor|scholar|archivist|research|sage|cartograph|analyst|librarian|alchemist/i, "savant"],
  [/driver|laborer|porter|mechanic|foreman|engineer|mason|pilot|rigger|smith/i, "stalwart"],
  [/chaplain|priest|mystic|seer|oracle|shaman|exorcist|keeper|confessor|ritual/i, "keeper"],
];

/* Gear kits — exact item names in "Bad Eden: Items" (dumped 2026-07-13),
 * one loadout per Calling per tier; every kit adds a Stabilizer Patch.
 * Missing names are skipped with a console warning, never fatal. */
const ECHO_GEAR_KITS = {
  bravo: {
    1: ["Hand Axe", "Bulwark Hauberk", "Pressed Buckler"],
    2: ["Plasma Lance", "Steelweave Hauberk", "Static Aegis"],
    3: ["Singing Hammer", "Hex-Carved Plate", "Null-Field Tower Shield"],
    4: ["Yesodic Hammer of the First Word", "Yesodic Plating", "Null-Field Tower Shield"],
  },
  operator: {
    1: ["Combat Knife", "Sap", "Drifter's Weave"],
    2: ["Brass Knife of the Quiet Word", "Hex-Warded Duster"],
    3: ["Frikkin' Laser Blade Saber", "Neon Spirit Armor"],
    4: ["Yesodic Edge", "Neon Spirit Armor"],
  },
  broker: {
    1: ["Slug Pistol", "Drifter's Weave"],
    2: ["Hex-Script Pistol", "Septhide Vestments"],
    3: ["Mercy Driver", "Septhide Vestments", "Sept-Hush Amulet"],
    4: ["Mercy Driver", "Mantle of Witnessed Silence"],
  },
  stalwart: {
    1: ["Maul", "Worker's Leathers"],
    2: ["Maul", "Rad Suit (Mk I)"],
    3: ["Singing Hammer", "Rad Suit (Mk II)"],
    4: ["Yesodic Hammer of the First Word", "Rad Suit (Mk III)"],
  },
  savant: {
    1: ["Bolt-Driver", "Initiate's Robe"],
    2: ["Quantum Staff", "Septhide Vestments"],
    3: ["Phase Disruptor", "Rad Suit (Mk II)"],
    4: ["Schrödinger's Cudgel", "Mantle of Witnessed Silence"],
  },
  keeper: {
    1: ["Sap", "Initiate's Robe"],
    2: ["Pact-Pen Stylus", "Septhide Vestments"],
    3: ["Gilded Atonement Blade", "Septhide Vestments", "Sept-Hush Amulet"],
    4: ["Gilded Atonement Blade", "Mantle of Witnessed Silence"],
  },
};
const ECHO_GEAR_ALWAYS = ["Stabilizer Patch"];

/* Standard stat array, dealt across the six faculties in Calling-priority
 * order (template.json: system.attributes.<faculty>.value, default 2). */
const ECHO_STAT_ARRAY = [5, 4, 3, 3, 2, 2];
const ECHO_STAT_PRIORITIES = {
  bravo:    ["violence", "body", "presence", "intrigue", "soul", "mind"],
  operator: ["intrigue", "mind", "body", "presence", "violence", "soul"],
  broker:   ["presence", "intrigue", "mind", "soul", "body", "violence"],
  stalwart: ["body", "violence", "soul", "mind", "presence", "intrigue"],
  savant:   ["mind", "intrigue", "soul", "presence", "body", "violence"],
  keeper:   ["soul", "presence", "mind", "body", "intrigue", "violence"],
};

/* Ancestry affinity — per crew/occult family, weighted ancestry-family
 * slugs (the builder's _ancestryIndex family values). Keyword hits in the
 * member's role/notes always win over these weights. */
const ECHO_ANCESTRY_AFFINITY = {
  "mercenary-band": [["human", 3], ["oldenborn", 2], ["cryptidkin", 1], ["circuitborn", 1]],
  "storm-wardens": [["oldenborn", 4], ["human", 2], ["menhirkin", 1]],
  "ironbound-ascendants": [["circuitborn", 3], ["menhirkin", 2], ["human", 1]],
  "ashbound-survivors": [["oldenborn", 3], ["human", 2], ["qliph_scarred", 1]],
  "cultural-ambassadors": [["human", 3], ["sephirotic_scion", 1], ["cryptidkin", 1], ["oldenborn", 1]],
  "diplomatic-envoys": [["human", 3], ["sephirotic_scion", 2], ["circuitborn", 1]],
  "peacekeeper-corps": [["human", 3], ["circuitborn", 2], ["menhirkin", 1]],
  "gridbreakers": [["circuitborn", 4], ["human", 2], ["echo_diver", 1]],
  "verdant-stalkers": [["cryptidkin", 3], ["human", 2], ["oldenborn", 1]],
  "covert-ops-cell": [["human", 2], ["cryptidkin", 2], ["echo_diver", 1], ["circuitborn", 1]],
  "survivors-militia": [["human", 4], ["oldenborn", 2], ["cryptidkin", 1]],
  "abyssal-cartographers": [["echo_diver", 4], ["human", 1], ["menhirkin", 1]],
  "kabbalist": [["human", 3], ["sephirotic_scion", 2]],
  "shaman": [["cryptidkin", 2], ["human", 2], ["menhirkin", 2]],
  "rosicrucian": [["human", 3], ["sephirotic_scion", 1], ["circuitborn", 1]],
  "biomancer": [["human", 2], ["cryptidkin", 2], ["qliph_scarred", 1]],
  "goetic-summoner": [["human", 2], ["qliph_scarred", 2], ["sephirotic_scion", 1]],
  "prophet-oracle": [["sephirotic_scion", 2], ["human", 2], ["echo_diver", 1]],
  "tarot-mage": [["human", 3], ["echo_diver", 1], ["sephirotic_scion", 1]],
  "exorcist": [["human", 2], ["sephirotic_scion", 2], ["menhirkin", 1]],
  "gnostic": [["sephirotic_scion", 2], ["human", 2], ["qliph_scarred", 1]],
  "alchemist": [["human", 3], ["circuitborn", 1], ["oldenborn", 1]],
};
const ECHO_ANCESTRY_FALLBACK = [["human", 3], ["oldenborn", 1], ["cryptidkin", 1], ["circuitborn", 1]];

/* Deterministic per-member randomness: the same member always suggests the
 * same ancestry/heritage, but a roster stays varied member to member. */
function _echoSeed(str) {
  let h = 2166136261;
  for (const c of String(str ?? "")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function _echoPickWeighted(pairs, seed) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  if (!total) return null;
  let r = ((seed % 997) / 997) * total;
  for (const [v, w] of pairs) { r -= w; if (r < 0) return v; }
  return pairs[0]?.[0] ?? null;
}

/* Keyword candidates a heritage name yields: "Cryptidkin Heritage: Jackalope"
 * → "jackalope"; "Echo-Diver (Abyssal): Tide Recall" → "abyssal", "tide recall". */
function _echoHeritageKeywords(name) {
  const out = [];
  const paren = String(name).match(/\(([^)]+)\)/);
  if (paren) out.push(paren[1]);
  const colon = String(name).split(":").pop();
  if (colon) out.push(colon);
  return out.map(s => s.trim().toLowerCase()).filter(s => s.length >= 4);
}

/* Suggest {ancestryId, heritageId, ancestryName, heritageName} for a member.
 * Order: role/notes keywords (heritage first — most specific — then ancestry)
 * → weighted family affinity → seeded fallback. */
function _echoSuggestIdentity({ familyKey, member, ancestries, heritages }) {
  const seed = _echoSeed(`${member?.id ?? ""}|${member?.name ?? ""}`);
  const text = `${member?.role ?? ""} ${member?.notes ?? ""}`.toLowerCase();
  let heritage = null, ancestry = null;

  if (text.trim()) {
    for (const h of heritages) {
      if (_echoHeritageKeywords(h.name).some(k => text.includes(k))) { heritage = h; break; }
    }
    for (const a of ancestries) {
      if (text.includes(String(a.name).toLowerCase())) { ancestry = a; break; }
    }
  }
  if (heritage && !ancestry) {
    ancestry = ancestries.find(a => _normFam(a.family) === _normFam(heritage.family)) ?? null;
  }
  if (!ancestry) {
    const pool = ECHO_ANCESTRY_AFFINITY[familyKey] ?? ECHO_ANCESTRY_FALLBACK;
    const famSlug = _echoPickWeighted(pool, seed);
    ancestry = ancestries.find(a => _normFam(a.family) === _normFam(famSlug))
      ?? ancestries[seed % Math.max(1, ancestries.length)] ?? null;
  }
  if (ancestry && (!heritage || _normFam(heritage.family) !== _normFam(ancestry.family))) {
    const fam = _normFam(ancestry.family);
    const pool = heritages.filter(h => _normFam(h.family) === fam);
    heritage = pool.length ? pool[_echoSeed(`${seed}|heritage`) % pool.length] : null;
  }
  return {
    ancestryId: ancestry?.id ?? "", ancestryName: ancestry?.name ?? "",
    heritageId: heritage?.id ?? "", heritageName: heritage?.name ?? ""
  };
}

function _echoFamilyFor(entryName) {
  const slug = _echoSlug(entryName);
  if (!slug) return null;
  for (const [key, fam] of Object.entries(ECHO_FAMILIES)) {
    if (slug === key || (fam.match ?? []).includes(slug)) return { key, ...fam };
    // Tolerate partial slugs ("kabbalist" inside "occult-association-kabbalist").
    if (slug.includes(key) || key.includes(slug)) return { key, ...fam };
  }
  return null;
}

function _echoCallingFor(family, role) {
  const r = String(role ?? "");
  for (const [rx, calling] of ECHO_ROLE_CALLINGS) {
    if (r && rx.test(r)) return calling;
  }
  return family?.calling ?? "bravo";
}

function _echoFill(s, tier) {
  return String(s ?? "")
    .replace(/\{2tier\}/g, String(2 * tier))
    .replace(/\{tier\}/g, String(tier));
}

/* The Echo Boon feature item — Callings Trick house style, plus the
 * universal Echo's Mark that makes crew echoes *special*. */
function _echoBoonItemData({ family, kind, tier, stewardName, entryName, memberName, role, notes }) {
  const boon = family?.boon ?? ECHO_FALLBACK_BOON;
  const tierTitle = ECHO_TIER_TITLES[tier] ?? `Tier ${tier}`;
  const kindLabel = kind === "occult" ? "occult association" : "crew";
  const whoBits = [];
  if (role) whoBits.push(`<strong>${foundry.utils.escapeHTML(role)}</strong>`);
  if (notes) whoBits.push(foundry.utils.escapeHTML(notes));
  const description = `
    <p><em>Echoes are the past made flesh — people out of a Steward's former
    lives, walking beside them again. ${foundry.utils.escapeHTML(memberName)} is an echo of
    ${foundry.utils.escapeHTML(stewardName)}'s time with the
    <strong>${foundry.utils.escapeHTML(entryName)}</strong> ${kindLabel}. Being remembered
    leaves a mark.</em></p>
    ${whoBits.length ? `<p>${whoBits.join(" — ")}</p>` : ""}
    <p><strong>${foundry.utils.escapeHTML(boon.name)} — ${tierTitle} (Echo Boon)</strong></p>
    <p>${_echoFill(foundry.utils.escapeHTML(boon.effect), tier)}</p>
    <p><strong>Echo's Mark:</strong> while their Steward can see them, the echo adds
    +1 on any check made in direct support of the Steward.</p>
    <p><em>${foundry.utils.escapeHTML(boon.flavor)}</em></p>`;
  return {
    name: `${boon.name} (Echo Boon)`,
    type: "feature",
    img: boon.img,
    system: {
      category: "echo",
      source: "Echo Rosters",
      tags: ["echo", family?.key ?? "unaffiliated", `tier-${tier}`],
      description: { value: description }
    },
    flags: {
      fourththing: { echo: { family: family?.key ?? null, kind, tier, crewEcho: true } }
    }
  };
}

async function _echoGrantGear(actor, callingKey, tier) {
  const pack = game.packs.get(ITEMS_PACK);
  if (!pack) { console.warn(`[${MOD}/echo-mint] items pack ${ITEMS_PACK} missing — no gear granted`); return []; }
  const kit = (ECHO_GEAR_KITS[callingKey]?.[tier] ?? []).concat(ECHO_GEAR_ALWAYS);
  if (!kit.length) return [];
  const index = await pack.getIndex();
  const toEmbed = [];
  for (const itemName of kit) {
    const entry = index.find(e => e.name === itemName);
    if (!entry) { console.warn(`[${MOD}/echo-mint] gear "${itemName}" not found in ${ITEMS_PACK} — skipped`); continue; }
    const doc = await pack.getDocument(entry._id);
    if (doc) toEmbed.push(doc.toObject());
  }
  if (toEmbed.length) await actor.createEmbeddedDocuments("Item", toEmbed);
  return toEmbed.map(i => i.name);
}

async function _echoCallingClassId(callingKey) {
  const pack = game.packs.get(CALLINGS_PACK);
  if (!pack) return null;
  const index = await pack.getIndex({ fields: ["type", "flags.fourththing.calling"] });
  const entry = index.find(e => e.type === "class"
    && (e.flags?.fourththing?.calling?.key ?? e["flags.fourththing.calling"]?.key) === callingKey);
  return entry?._id ?? null;
}

async function _echoFolder(stewardName) {
  const name = `Echoes — ${stewardName}`;
  let folder = game.folders?.find(f => f.type === "Actor" && f.name === name);
  if (!folder) {
    // Folder documents have no ownership model — creation is GM-only, always.
    // A player minting echoes gets them unfiled instead of a red permission
    // error (2026-08-20 playtest: wizard Crew/Association step on a player login).
    if (!game.user?.isGM) return null;
    try { folder = await Folder.create({ name, type: "Actor", color: "#3b2f5c" }); }
    catch (e) { console.warn(`[${MOD}/echo-mint] folder create failed`, e); folder = null; }
  }
  return folder?.id ?? null;
}

/* Write the minted actor's uuid back into the persisted roster member.
 * New (unsaved) rows won't be found — the roster editor's own Save then
 * persists the uuid it already painted into the row. */
async function _echoWriteBackUuid(steward, entryName, memberId, uuid) {
  try {
    const bridge = await import(foundry.utils.getRoute(BRIDGE_PATH));
    const roster = bridge.getStewardEchoRoster?.(steward, entryName);
    const members = Array.isArray(roster?.members) ? foundry.utils.deepClone(roster.members) : [];
    const m = members.find(x => x.id === memberId);
    if (!m) return false;
    m.actorUuid = uuid;
    await bridge.setStewardEchoRoster?.(steward, entryName, members);
    return true;
  } catch (e) {
    console.warn(`[${MOD}/echo-mint] roster write-back failed`, e);
    return false;
  }
}

function _echoDefaultTier(steward) {
  const t = Number(foundry.utils.getProperty(steward, "system.details.tier"));
  return Math.max(1, Math.min(4, Number.isFinite(t) && t > 0 ? t : 1));
}

/* Small confirm dialog: Calling + Ancestry + Heritage (all pre-suggested)
 * + Tier + gear toggle. Pass members.length > 1 for the batch variant
 * (Calling and ancestry/heritage auto per member). */
async function _echoMintDialog({ steward, entryName, kind, members }) {
  const batch = members.length > 1;
  const first = members[0];
  const family = _echoFamilyFor(entryName);
  const suggested = _echoCallingFor(family, first?.role);
  const defTier = _echoDefaultTier(steward);
  const esc = (s) => foundry.utils.escapeHTML(String(s));

  // Identity indexes — shared with openNPCBuilder's dropdowns.
  const ancestries = await _ancestryIndex();
  const heritages = await _heritageIndex();
  const idn = (!batch && ancestries.length)
    ? _echoSuggestIdentity({ familyKey: family?.key, member: first, ancestries, heritages })
    : null;

  const callingSel = batch ? "" : `
    <div class="form-group" style="display:flex;flex-direction:column;gap:.2rem;">
      <label style="font-weight:600;">Calling</label>
      <select data-echo-field="calling" style="padding:.35rem .5rem;border-radius:3px;">
        ${["bravo", "operator", "broker", "stalwart", "savant", "keeper"].map(k =>
          `<option value="${k}" ${k === suggested ? "selected" : ""}>${k[0].toUpperCase()}${k.slice(1)}${k === suggested ? " (suggested)" : ""}</option>`).join("")}
      </select>
      <span style="opacity:.65;font-size:.75rem;">Suggested from the ${esc(entryName)} ${kind === "occult" ? "association" : "crew"}${first?.role ? ` and the role “${esc(first.role)}”` : ""}.</span>
    </div>`;

  const identitySel = batch
    ? (ancestries.length ? `
      <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;">
        <input type="checkbox" data-echo-field="identity" checked/> Suggest an Ancestry &amp; Heritage per member (varied — keyed off who they are)
      </label>` : "")
    : (ancestries.length ? `
      <div class="form-group" style="display:flex;flex-direction:column;gap:.2rem;">
        <label style="font-weight:600;">Ancestry</label>
        <select data-echo-field="ancestryId" style="padding:.35rem .5rem;border-radius:3px;">
          <option value="">— None —</option>
          ${ancestries.map(a => `<option value="${a.id}" data-family="${esc(a.family)}" ${a.id === idn?.ancestryId ? "selected" : ""}>${esc(a.name)}${a.id === idn?.ancestryId ? " (suggested)" : ""}</option>`).join("")}
        </select>
      </div>
      <div class="form-group" style="display:flex;flex-direction:column;gap:.2rem;">
        <label style="font-weight:600;">Heritage</label>
        <select data-echo-field="heritageId" style="padding:.35rem .5rem;border-radius:3px;"></select>
        <span style="opacity:.65;font-size:.75rem;">Filtered by the chosen ancestry${idn?.heritageName ? ` — suggested: ${esc(idn.heritageName)}` : ""}. Role/notes keywords steer the suggestion (write “jackalope” and get a Jackalope).</span>
      </div>` : "");
  const content = `
    <div style="display:flex;flex-direction:column;gap:.6rem;">
      <p style="margin:0;font-size:.85rem;opacity:.85;">
        ${batch
          ? `Mint <b>${members.length}</b> unlinked members of <b>${esc(entryName)}</b> as NPC echoes. Each gets a Calling (auto-picked from the ${kind === "occult" ? "association" : "crew"} and their role), its tier features and aptitude kit, an <b>Echo Boon</b>, and tier gear.`
          : `Mint <b>${esc(first?.name ?? "this member")}</b> as an NPC echo of <b>${esc(steward.name)}</b> — Calling + tier features + aptitude kit, an <b>Echo Boon</b>, ancestry &amp; heritage, and tier gear.`}
      </p>
      ${callingSel}
      ${identitySel}
      <div class="form-group" style="display:flex;flex-direction:column;gap:.2rem;">
        <label style="font-weight:600;">Tier</label>
        <select data-echo-field="tier" style="padding:.35rem .5rem;border-radius:3px;">
          ${[1, 2, 3, 4].map(t => `<option value="${t}" ${t === defTier ? "selected" : ""}>Tier ${["I", "II", "III", "IV"][t - 1]} — ${ECHO_TIER_TITLES[t]}${t === defTier ? " (Steward's tier)" : ""}</option>`).join("")}
        </select>
      </div>
      <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;">
        <input type="checkbox" data-echo-field="gear" checked/> Mint with appropriate gear (Bad Eden: Items)
      </label>
    </div>`;
  return Dialog.wait({
    title: batch ? `🎭 Mint Echo Crew — ${entryName}` : `🎭 Mint Echo — ${first?.name ?? entryName}`,
    content,
    buttons: {
      mint: {
        label: batch ? `Mint ${members.length} Echoes` : "Mint Echo",
        icon: '<i class="fas fa-theater-masks"></i>',
        callback: (html) => {
          const root = (html instanceof HTMLElement ? html : html[0]);
          const read = (k) => root?.querySelector(`[data-echo-field="${k}"]`);
          return {
            ok: true,
            calling: read("calling")?.value ?? "",
            tier: Math.max(1, Math.min(4, Number(read("tier")?.value) || defTier)),
            gear: !!read("gear")?.checked,
            ancestryId: read("ancestryId")?.value ?? "",
            heritageId: read("heritageId")?.value ?? "",
            suggestIdentity: !!read("identity")?.checked
          };
        }
      },
      cancel: { label: "Cancel", callback: () => ({ ok: false }) }
    },
    default: "mint",
    // Heritage re-filters live as the ancestry changes — the builder's own
    // family rules, with the suggested heritage pre-selected when it fits.
    render: (html) => {
      const root = (html instanceof HTMLElement ? html : html[0]);
      const ancSel = root?.querySelector('[data-echo-field="ancestryId"]');
      const herSel = root?.querySelector('[data-echo-field="heritageId"]');
      if (!ancSel || !herSel) return;
      const rebuild = () => {
        const fam = _normFam(ancSel.selectedOptions[0]?.dataset?.family ?? "");
        const keep = herSel.value || idn?.heritageId || "";
        const opts = heritages.filter(h => !fam || !h.family
          || _normFam(h.family) === fam
          || CROSS_CUTTING_HERITAGE_FAMILIES.has(_normFam(h.family)));
        herSel.innerHTML = ['<option value="">— None —</option>']
          .concat(opts.map(h => `<option value="${h.id}">${esc(h.name)}${h.id === idn?.heritageId ? " (suggested)" : ""}</option>`))
          .join("");
        if (opts.some(h => h.id === keep)) herSel.value = keep;
      };
      ancSel.addEventListener("change", () => { herSel.value = ""; rebuild(); });
      rebuild();
    }
  }, { width: 460 });
}

/* Mint ONE roster member. opts:
 *   steward (Actor), entryName, kind ("crew"|"occult"),
 *   member {id,name,role,notes,portrait}, tier?, calling?, gear? (bool),
 *   interactive? (default true → confirm dialog)
 * Returns the created Actor or null. */
export async function mintEchoMember(opts = {}) {
  const { steward, entryName, kind = "crew", member } = opts;
  if (!steward || !entryName || !member?.name) {
    ui.notifications?.warn?.("Echo mint needs a Steward, a crew/association name, and a named member.");
    return null;
  }
  const family = _echoFamilyFor(entryName);
  let { tier, calling, gear = true, ancestryId = "", heritageId = "", suggestIdentity = false } = opts;
  if (opts.interactive !== false && (!tier || !calling)) {
    const picked = await _echoMintDialog({ steward, entryName, kind, members: [member] });
    if (!picked?.ok) return null;
    tier = picked.tier; calling = picked.calling || _echoCallingFor(family, member.role); gear = picked.gear;
    ancestryId = picked.ancestryId; heritageId = picked.heritageId;
  }
  tier = Math.max(1, Math.min(4, Number(tier) || _echoDefaultTier(steward)));
  calling = calling || _echoCallingFor(family, member.role);

  // Batch path: suggest ancestry + heritage per member (seeded — the same
  // member always suggests the same lineage; a roster stays varied).
  if (suggestIdentity && !ancestryId) {
    try {
      const ancestries = await _ancestryIndex();
      const heritages = await _heritageIndex();
      if (ancestries.length) {
        const idn = _echoSuggestIdentity({ familyKey: family?.key, member, ancestries, heritages });
        ancestryId = idn.ancestryId; heritageId = idn.heritageId;
      }
    } catch (e) { console.warn(`[${MOD}/echo-mint] identity suggestion failed`, e); }
  }

  const folderId = await _echoFolder(steward.name);
  const portrait = String(member.portrait ?? "").trim();
  const data = {
    name: member.name,
    type: "character",
    folder: folderId ?? undefined,
    img: portrait || undefined,
    flags: {
      [MOD]: {
        entityKind: "npc",
        createdViaEchoMint: true,
        createdAt: Date.now(),
        echo: {
          stewardUuid: steward.uuid, stewardName: steward.name,
          entryName, kind, family: family?.key ?? null, memberId: member.id ?? null
        }
      }
    },
    system: { details: { tier } },
    prototypeToken: {
      actorLink: false,
      disposition: 1,
      ...(portrait ? { texture: { src: portrait } } : {})
    }
  };
  const stewardFactionId = steward.flags?.["bbttcc-factions"]?.factionId;
  if (stewardFactionId) data.flags["bbttcc-factions"] = { factionId: stewardFactionId };

  let actor;
  try { actor = await Actor.create(data); }
  catch (err) {
    console.error(`[${MOD}/echo-mint] Actor.create failed`, err);
    ui.notifications?.error?.(`Echo mint failed: ${err?.message || err}`);
    return null;
  }
  if (!actor) return null;

  // Calling: class + tier feats + aptitude kit — the proven builder path.
  try {
    const classId = await _echoCallingClassId(calling);
    if (classId) await _grantCalling(actor, classId, tier);
    else console.warn(`[${MOD}/echo-mint] no class item for calling "${calling}"`);
  } catch (err) {
    console.error(`[${MOD}/echo-mint] Calling grant failed`, err);
    ui.notifications?.warn?.(`Echo minted, but the Calling grant failed: ${err?.message || err}`);
  }

  // Stats: standard array 5/4/3/3/2/2 dealt in Calling-priority order, plus
  // the member's story on the sheet (biography = {concept, notes} strings).
  try {
    const order = (ECHO_STAT_PRIORITIES[calling] ?? ECHO_STAT_PRIORITIES.bravo).slice();
    // De-clone (2026-08-22): five Savants minted 2/4/3/2/5/3 five times over —
    // pure array-deal with no variety. Same trick as ancestry: the member's
    // name seeds a deterministic swap of one adjacent MID pair (never the
    // signature top stat), so a roster varies while each member stays stable.
    const seed = _echoSeed(`${member.name}|${calling}|stats`);
    const swapAt = 1 + (seed % (order.length - 2)); // indexes 1..4 — top stat untouched
    if (seed % 3 !== 0) [order[swapAt], order[swapAt + 1]] = [order[swapAt + 1], order[swapAt]];
    const update = {};
    order.forEach((att, i) => { update[`system.attributes.${att}.value`] = ECHO_STAT_ARRAY[i]; });
    update["system.biography.concept"] =
      `${member.role ? `${member.role} — ` : ""}${entryName} ${kind === "occult" ? "association" : "crew"}, echo of ${steward.name}`;
    if (member.notes) update["system.biography.notes"] = member.notes;
    await actor.update(update);
  } catch (err) {
    console.error(`[${MOD}/echo-mint] stat array failed`, err);
  }

  // Echo Boon — what makes them special. Role + notes ride along so the
  // sheet tells the member's story on open (characters carry no biography
  // field in this system's template).
  try {
    const boonData = _echoBoonItemData({
      family, kind, tier, stewardName: steward.name, entryName,
      memberName: member.name, role: member.role, notes: member.notes
    });
    await actor.createEmbeddedDocuments("Item", [boonData]);
  } catch (err) {
    console.error(`[${MOD}/echo-mint] Echo Boon grant failed`, err);
  }

  // Ancestry + heritage through the system bridge — same apply functions as
  // the steward sheet and openNPCBuilder (ancestry FIRST; its cascade clears
  // heritage), so echoes get species item + L1 grants + lineage stamps.
  if (ancestryId || heritageId) {
    try {
      const bridge = await import(foundry.utils.getRoute(BRIDGE_PATH));
      if (ancestryId) await bridge.applyActorAncestryChange(actor, ancestryId);
      if (heritageId) await bridge.applyActorHeritageChange(actor, heritageId);
    } catch (err) {
      console.error(`[${MOD}/echo-mint] ancestry/heritage grant failed`, err);
      ui.notifications?.warn?.(`Echo minted, but the ancestry/heritage grant failed: ${err?.message || err}`);
    }
  }

  // Gear kit.
  let gearNames = [];
  if (gear) {
    try { gearNames = await _echoGrantGear(actor, calling, tier); }
    catch (err) { console.error(`[${MOD}/echo-mint] gear grant failed`, err); }
  }

  if (member.id) await _echoWriteBackUuid(steward, entryName, member.id, actor.uuid);

  const boonName = (family?.boon ?? ECHO_FALLBACK_BOON).name;
  ui.notifications?.info?.(`🎭 Minted echo ${actor.name} — ${calling[0].toUpperCase()}${calling.slice(1)} T${tier}, boon "${boonName}"${gearNames.length ? `, gear ×${gearNames.length}` : ""}.`);
  return actor;
}

/* Mint EVERY roster member that lacks an actorUuid. One dialog (tier +
 * gear), Callings auto-picked per member. Returns [{memberId, uuid, name}]. */
export async function mintEchoRoster(opts = {}) {
  const { steward, entryName, kind = "crew" } = opts;
  let members = Array.isArray(opts.members) ? opts.members : null;
  if (!members) {
    try {
      const bridge = await import(foundry.utils.getRoute(BRIDGE_PATH));
      members = bridge.getStewardEchoRoster?.(steward, entryName)?.members ?? [];
    } catch (_e) { members = []; }
  }
  members = members.filter(m => m?.name && !String(m.actorUuid ?? "").trim());
  if (!members.length) {
    ui.notifications?.info?.("Every named member already has a linked actor — nothing to mint.");
    return [];
  }
  const picked = await _echoMintDialog({ steward, entryName, kind, members });
  if (!picked?.ok) return [];
  const family = _echoFamilyFor(entryName);
  const out = [];
  for (const member of members) {
    const actor = await mintEchoMember({
      steward, entryName, kind, member,
      tier: picked.tier, gear: picked.gear,
      calling: _echoCallingFor(family, member.role),
      suggestIdentity: !!picked.suggestIdentity,
      interactive: false
    });
    if (actor) out.push({ memberId: member.id ?? null, uuid: actor.uuid, name: actor.name });
  }
  if (out.length) ui.notifications?.info?.(`🎭 Echo crew minted: ${out.length}/${members.length} member${members.length === 1 ? "" : "s"} of ${entryName}.`);
  return out;
}

// Expose for the directory-button click handler in module.js, and as a
// scriptable API for downstream macros / agents.
function _install() {
  globalThis.BBTTCC_NPCBuilder = globalThis.BBTTCC_NPCBuilder || {};
  globalThis.BBTTCC_NPCBuilder.open = openNPCBuilder;
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.npcBuilder = { open: openNPCBuilder, mintEchoMember, mintEchoRoster };
  } catch(_e){}
}
_install();
Hooks.once("ready", _install);
