// ─────────────────────────────────────────────────────────────────────────────
// seed-starter-manifestations.macro.js — RFI Pre-Ship Manifestations sprint
// 2026-04-28
//
// Seeds the systems/fourththing/packs/starter-manifestations compendium with
// 39 ready-to-play manifestations:
//   • 4 TCCs (cosmic_linguist, wyrdlens-adept, dreamwalker, pactkeeper) ×
//     6 each = 24  (mix of Workings + Forms)
//   • 5 non-TCCs (aurablade, bulwark, shadow_courier, soul-smith,
//     harmony-marshal) × 3 each = 15  (Form-stability only — non-TCCs cannot
//     cast `instant` Workings per FT_TCC_IDENTIFIERS gating in module.js:294).
//
// Idempotent: existing entries (matched by name) are skipped, not overwritten.
// Paste this entire file into a Foundry Script Macro and click execute as GM.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "fourththing.starter-manifestations";
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    ui.notifications.error(`Pack ${PACK_ID} not found. Is the fourththing system active?`);
    return;
  }
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { ui.notifications.error(`Cannot unlock ${PACK_ID}: ${e.message}`); return; }
  }

  // Build the full Item data object from a compact spec. Anything not
  // overridden falls back to schema defaults appropriate for the type.
  function mk(spec) {
    const isWorking = spec.kind === "power";
    const family = isWorking ? "working" : "form";
    const stability = spec.stability ?? (isWorking ? "instant" : "bound");
    const interaction = spec.interaction ?? (isWorking ? "event" : "weapon");

    const baseManifestation = {
      tier: spec.tier ?? 1,
      family,
      concept: spec.concept ?? "",
      form: spec.form ?? (isWorking ? "sigil" : "weapon"),
      function: spec.function ?? (isWorking ? "transform" : "harm"),
      stability,
      interactionModel: interaction,
      costType: spec.costType ?? (isWorking ? "clarity" : "none"),
      costValue: spec.costValue ?? (isWorking ? 1 : 0),
      costText: spec.costText ?? "",
      duration: spec.duration ?? (isWorking ? "instant" : "scene"),
      durationText: spec.durationText ?? "",
      triggerText: spec.triggerText ?? "",
      scale: spec.scale ?? "personal",
      targetText: spec.targetText ?? "",
      rangeAreaText: spec.rangeAreaText ?? "",
      maintenanceCost: spec.maintenanceCost ?? "",
      riskText: spec.riskText ?? "",
      pathResonance: spec.pathResonance ?? "",
      fictionalPermission: spec.fictionalPermission ?? "",
      gmCalibration: spec.gmCalibration ?? "",
      mechanicalHook: spec.mechanicalHook ?? "",
      signature: spec.signature ?? "",
      thirdThing: spec.thirdThing ?? "",
      opCost: { pool: "", value: 0 }
    };

    if (isWorking) {
      return {
        name: spec.name,
        type: "power",
        img: spec.img ?? "icons/magic/symbols/runes-carved-stone-tan.webp",
        system: {
          intent: spec.intent ?? "presence",
          channel: spec.channel ?? "soul",
          sephirah: spec.sephirah ?? "tiferet",
          mode: spec.mode ?? "hermetic",
          clarityRequired: spec.clarityRequired ?? Math.max(1, baseManifestation.tier),
          noiseGain: spec.noiseGain ?? 0,
          activation: spec.activation ?? "action",
          target: spec.target ?? "single",
          range: spec.range ?? "near",
          damage: spec.damage ?? "",
          damageType: spec.damageType ?? "energy",
          damageFlavor: spec.damageFlavor ?? "",
          effect: spec.effect ?? "",
          tags: spec.tags ?? [],
          category: "manifestation",
          flavor: spec.flavor ?? "",
          manifestation: baseManifestation
        },
        flags: {
          fourththing: {
            starterManifestation: true,
            path: spec.path
          }
        }
      };
    } else {
      return {
        name: spec.name,
        type: "weapon",
        img: spec.img ?? "icons/weapons/swords/sword-guard-engraved.webp",
        system: {
          category: spec.weaponCategory ?? "melee",
          intent: spec.intent ?? "violence",
          skill: spec.skill ?? "melee",
          damage: {
            formula: spec.damageFormula ?? "2d6",
            attribute: spec.attribute ?? (spec.intent ?? "violence"),
            type: spec.damageType ?? "kinetic",
            damageFlavor: spec.damageFlavor ?? "",
            track: spec.track ?? "integrity"
          },
          range: { short: spec.short ?? 1, long: spec.long ?? 1 },
          tags: spec.tags ?? [],
          effect: spec.effect ?? "",
          flavor: spec.flavor ?? "",
          manifestation: baseManifestation
        },
        flags: {
          fourththing: {
            starterManifestation: true,
            path: spec.path
          }
        }
      };
    }
  }

  // ───── Manifestation specifications ────────────────────────────────────────
  // Format: each entry is the minimal spec; mk() expands it.

  const SPECS = [
    // ════════════════════════════════════════════════════════════════════════
    // AURABLADE  (non-TCC) — 3 Forms; emotional edge, hot and immediate
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "aurablade", kind: "weapon", name: "Wrath-Brand",
      stability: "sustained", interaction: "weapon", form: "weapon", function: "harm",
      intent: "violence", channel: "body", sephirah: "gevurah", mode: "chaos",
      damageFormula: "2d6", damageType: "fire", damageFlavor: "righteous heat",
      concept: "A blade made of your conviction, hot to the touch and visibly upset.",
      signature: "The edge sings the name of the wrong it answers.",
      thirdThing: "When you kill with it, the body's clothes scorch the precise sin into the cloth.",
      mechanicalHook: "On a hit, target gains the Burning condition for 1 round.",
      duration: "scene", durationText: "Until the scene ends or you sheath your fury.",
      costType: "stress", costValue: 1, costText: "1 Stress to summon.",
      maintenanceCost: "1 Stress per scene maintained past the first.",
      riskText: "If you spend a turn calm, the brand fades and must be re-forged. If you betray the wrong it answers, it cuts you instead.",
      pathResonance: "Aurablade — fury chosen well, channeled cleanly.",
      fictionalPermission: "You hold a weapon people can see, fear, and recognize as yours alone.",
      gmCalibration: "A Tier-1 Form. Visible to anyone in the room. Cannot be hidden, smuggled, or ambushed-with.",
      tags: ["aurablade", "fire", "burn", "visible"],
      flavor: "Witness her unsheathe the brand and you witness exactly what she will not forgive."
    },
    {
      path: "aurablade", kind: "weapon", name: "Mercy's Edge",
      stability: "bound", interaction: "weapon", form: "weapon", function: "protect",
      intent: "presence", channel: "body", sephirah: "chesed", mode: "hermetic",
      damageFormula: "1d6", damageType: "kinetic", damageFlavor: "the cut between, not through",
      track: "stress", weaponCategory: "melee",
      concept: "A blade that refuses to maim — every wound it makes can be undone with care and time.",
      signature: "The cut leaves a faint silver line that fades when the target finally rests.",
      thirdThing: "It cannot be drawn against a sleeping or surrendered foe. It will not leave the sheath.",
      mechanicalHook: "Damage applies to Stress, not Integrity. On a hit, target may choose to fall back rather than continue the fight.",
      duration: "persistent", durationText: "Bound to you until you draw it in cruelty.",
      costType: "none", costValue: 0,
      riskText: "Drawing it in cruelty (against a helpless foe) shatters the blade. You'll need a season of mercy to re-forge it.",
      pathResonance: "Aurablade — fury restrained is fury sharpened.",
      fictionalPermission: "You can win a fight without a body count.",
      gmCalibration: "Tier-1 Form. Recognized at a glance by anyone who has been mercied by it before.",
      tags: ["aurablade", "mercy", "stress-track", "bound"],
      flavor: "She cuts him three times before he realizes she has not yet hurt him."
    },
    {
      path: "aurablade", kind: "weapon", name: "Dread Crown",
      stability: "enduring", interaction: "worn", form: "vestment", function: "command",
      intent: "presence", channel: "soul", sephirah: "binah", mode: "hermetic",
      damageFormula: "0", damageType: "psychic", damageFlavor: "the weight of being looked at",
      track: "stress", weaponCategory: "unarmed",
      concept: "A crown of shadow and refused mercy that hangs unseen above your head. Those who meet your eyes feel they have been judged.",
      signature: "Animals will not approach you. Children stop crying when you enter the room.",
      thirdThing: "Once a scene, you may name a single fear out loud — the room temperature drops a degree and your target hears it from the inside of their own thoughts.",
      mechanicalHook: "Once per scene, impose disadvantage (reroll-highest) on a Resolve check made within Near range.",
      duration: "persistent", durationText: "Persistent until you remove the crown — which only you can do.",
      costType: "none", costValue: 0,
      riskText: "Allies stop volunteering information. Lovers report your sleep is troubled. Pets run.",
      pathResonance: "Aurablade — when the edge is worn instead of swung.",
      fictionalPermission: "You walk into rooms and the rooms reorganize themselves around your presence.",
      gmCalibration: "Tier-2 Form. Always-on; impossible to mask except by deliberate effort. Affects social rolls in both directions.",
      tags: ["aurablade", "dread", "presence", "vestment", "always-on"],
      flavor: "She has not raised her voice in six years. She has not had to."
    },

    // ════════════════════════════════════════════════════════════════════════
    // BULWARK  (non-TCC) — 3 Forms; mass, anchoring, denial, shelter
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "bulwark", kind: "weapon", name: "Anvil Stance",
      stability: "sustained", interaction: "worn", form: "vestment", function: "protect",
      intent: "violence", channel: "body", sephirah: "malkuth", mode: "hermetic",
      damageFormula: "1d6", damageType: "kinetic", damageFlavor: "ground-driven",
      weaponCategory: "unarmed", skill: "brawl",
      concept: "You plant. The earth recognizes you. Forces that would move you are returned to whatever sent them.",
      signature: "A faint outline of footprints in stone where you have stood. Even on wood floors. Even on grass.",
      thirdThing: "When something tries to push you and fails, you can hear what it was hoping for.",
      mechanicalHook: "While stance is active, you cannot be moved against your will and you have +2 to Guard. Counter-attack any failed shove with the listed damage.",
      duration: "scene", durationText: "While you choose not to move.",
      costType: "stress", costValue: 1, costText: "1 Stress to enter the stance.",
      maintenanceCost: "Cannot move from your hex while stance is active.",
      riskText: "If forced to move (legitimate breakthrough, called shot, narrative consequence), you lose 1 Integrity from the violation.",
      pathResonance: "Bulwark — a body that has decided it is now geography.",
      fictionalPermission: "You are an immovable feature of this scene. The fight has to flow around you.",
      gmCalibration: "Tier-1 Form. Lasts as long as you remain stationary. Common-knowledge once another Bulwark sees it.",
      tags: ["bulwark", "stance", "anchor", "denial"],
      flavor: "He sets his feet. The argument changes."
    },
    {
      path: "bulwark", kind: "weapon", name: "Wall of My People",
      stability: "sustained", interaction: "zone", form: "field", function: "protect",
      intent: "presence", channel: "soul", sephirah: "chesed", mode: "hermetic",
      damageFormula: "0", damageType: "kinetic",
      weaponCategory: "ranged", skill: "athletics",
      concept: "A translucent curtain of refusal raised between threat and ward. It does not stop blades — it stops what blades mean.",
      signature: "The wall hums with the vowels of a language none of your enemies speak.",
      thirdThing: "Children, the elderly, and the surrendered who pass through it report a moment of perfect quiet.",
      mechanicalHook: "Allies on your side of the wall have +2 Resolve and reroll the lowest die against fear, charm, and intimidation. Hostile manifestations targeting them cost +1 Clarity to push through.",
      duration: "scene", durationText: "While you sing the wall standing.",
      costType: "stress", costValue: 2, costText: "2 Stress to raise.",
      maintenanceCost: "1 Stress per scene maintained past the first.",
      riskText: "The wall is visible and audible to everyone in Far range. Anyone tracking you at the strategic level knows where you are.",
      pathResonance: "Bulwark — denial is shelter for those it shelters.",
      fictionalPermission: "You declare a side of the conflict. People who were unsure step over to your side.",
      gmCalibration: "Tier-2 Form. Wall is one zone wide. Drops if you fall unconscious or stop singing.",
      tags: ["bulwark", "ward", "shelter", "audible"],
      flavor: "She doesn't even raise her voice. The wall hears her perfectly."
    },
    {
      path: "bulwark", kind: "weapon", name: "Pressure Front",
      stability: "enduring", interaction: "structure", form: "construct", function: "move",
      intent: "violence", channel: "body", sephirah: "netzach", mode: "hermetic",
      damageFormula: "2d6", damageType: "kinetic", damageFlavor: "advancing weight",
      weaponCategory: "melee", skill: "athletics", scale: "scene",
      concept: "A moving wedge of pressurized air and intent that walks where you walk. Whatever it touches has to choose: yield or be moved.",
      signature: "Loose paper, dust, and small debris drift toward you as if you are very gently inhaling the room.",
      thirdThing: "The front cannot be made silent. It always sounds like a held breath about to release.",
      mechanicalHook: "Once per turn while active, push a creature within Near range one zone away from you, dealing the listed damage if they collide with cover.",
      duration: "scene", durationText: "Walks with you for the scene.",
      costType: "stress", costValue: 2, costText: "2 Stress to manifest.",
      maintenanceCost: "1 Stress per scene maintained.",
      riskText: "Cannot be subtle. Any stealth or social stakes in the scene are renegotiated downward as soon as it appears.",
      pathResonance: "Bulwark — a fortification that walks.",
      fictionalPermission: "You are not just hard to move. You are now the thing doing the moving.",
      gmCalibration: "Tier-2 Form. Reads as a small siege weapon to anyone with military experience.",
      tags: ["bulwark", "advance", "shove", "loud"],
      flavor: "She walked at them. They moved."
    },

    // ════════════════════════════════════════════════════════════════════════
    // SHADOW COURIER  (non-TCC) — 3 Forms; thresholds, transit, deliveries
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "shadow_courier", kind: "weapon", name: "Wayhound Companion",
      stability: "bound", interaction: "companion", form: "construct", function: "move",
      intent: "intrigue", channel: "soul", sephirah: "yesod", mode: "hermetic",
      damageFormula: "1d6", damageType: "kinetic", damageFlavor: "phantom bite",
      weaponCategory: "unarmed", skill: "stealth",
      concept: "A dog made of streetlight and route-memory. It knows every shortcut you have ever taken, and a few you have not.",
      signature: "It leaves no prints, but every dog along the route reacts to it as a familiar.",
      thirdThing: "It cannot enter a place where it would not be welcome — even if you can.",
      mechanicalHook: "Once per scene, the Wayhound finds the fastest unobserved route between any two points you can both name. While following its path, you and one ally have +2 Stealth.",
      duration: "persistent", durationText: "Bound to you until banished or killed.",
      costType: "none", costValue: 0,
      riskText: "If killed, you lose access to one route for the next session. The Wayhound returns at the next dawn, but it remembers the death.",
      pathResonance: "Shadow Courier — every delivery needs a guide.",
      fictionalPermission: "You can find the way. Always. Even in a city you have never seen.",
      gmCalibration: "Tier-1 Form. Half-visible to anyone not looking for it. Fully visible to other dogs and to those who have been couriered before.",
      tags: ["shadow-courier", "companion", "route", "guide"],
      flavor: "The hound trots three steps ahead. He follows."
    },
    {
      path: "shadow_courier", kind: "weapon", name: "Threshold Cloak",
      stability: "bound", interaction: "worn", form: "vestment", function: "move",
      intent: "intrigue", channel: "mind", sephirah: "yesod", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "stealth",
      concept: "A coat woven from the dust of doorways. While you wear it, every threshold you cross argues your case for being on the other side.",
      signature: "The hem of the coat moves like water, never quite settling.",
      thirdThing: "You can hear, faintly, every word spoken near a doorway you have ever passed through. Most of it is small. Some of it is not.",
      mechanicalHook: "Once per scene, treat any door, gate, or threshold within Near range as already-passed for purposes of being seen, challenged, or recognized.",
      duration: "persistent", durationText: "Bound to you until removed deliberately.",
      costType: "none", costValue: 0,
      riskText: "If you cross a threshold while uninvited, you can do it once. The second uninvited crossing in the same scene costs 1 Stress and 1 Noise.",
      pathResonance: "Shadow Courier — the door is the deal.",
      fictionalPermission: "You have a relationship with thresholds the way other people have a relationship with their phone.",
      gmCalibration: "Tier-2 Form. Recognizable to other Shadow Couriers, Wayfarers, and to a few institutional sentries who have been trained to notice.",
      tags: ["shadow-courier", "vestment", "threshold", "stealth"],
      flavor: "He didn't knock. He had already been there."
    },
    {
      path: "shadow_courier", kind: "weapon", name: "Carry-the-Unsayable",
      stability: "enduring", interaction: "structure", form: "tool", function: "bind",
      intent: "intrigue", channel: "soul", sephirah: "binah", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics", scale: "scene",
      concept: "A small wooden box (or jar, or envelope) that holds messages no one is willing to speak aloud. While you carry it, the message stays unsaid by everyone around you — until you choose to deliver it.",
      signature: "The container is always the size and weight of the message it carries — sometimes a feather, sometimes a stone.",
      thirdThing: "Anyone who hears the message after you deliver it remembers the room they first heard it in for the rest of their life.",
      mechanicalHook: "While the box is sealed, no one in the scene can speak the message aloud, write it down, or imply it. Delivery imposes a condition on the recipient (Marked, Compelled, Inspired — GM/player negotiate).",
      duration: "persistent", durationText: "Until you deliver, destroy, or are forcibly relieved of the box.",
      costType: "stress", costValue: 1, costText: "1 Stress to seal a message into the box.",
      maintenanceCost: "1 Stress per scene the box is carried into a hostile situation.",
      riskText: "If the box is broken before delivery, the message comes out wrong — possibly inverted, possibly amplified, possibly heard by the wrong ear.",
      pathResonance: "Shadow Courier — the bearer answers for the cargo.",
      fictionalPermission: "You can carry a secret the world is desperate to spill, and the world will hold its tongue until you arrive.",
      gmCalibration: "Tier-3 Form. The box is a campaign hook. Other factions will try to take it, buy it, or read it.",
      tags: ["shadow-courier", "vessel", "sealed", "campaign-relevant"],
      flavor: "He sets the box on the table. The room knows what it is. The room waits."
    },

    // ════════════════════════════════════════════════════════════════════════
    // SOUL-SMITH  (non-TCC) — 3 Forms; sacramental craft, repair, devotion
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "soul-smith", kind: "weapon", name: "Reliquary Vow",
      stability: "bound", interaction: "worn", form: "vestment", function: "protect",
      intent: "presence", channel: "soul", sephirah: "tiferet", mode: "hermetic",
      damageFormula: "0", damageType: "energy",
      weaponCategory: "unarmed", skill: "athletics",
      concept: "A small relic — a coin, a tooth, a folded letter — into which you have hammered a single vow. While you wear it, the vow protects you from the kind of thing the vow forbids.",
      signature: "The relic is faintly warm. It shines when you act in keeping with the vow.",
      thirdThing: "If you break the vow, the relic cracks audibly. Everyone in the scene hears it.",
      mechanicalHook: "+2 Resolve against effects that would make you act against the vow. If you hold the vow under pressure, regain 1 Stress at the end of the scene.",
      duration: "persistent", durationText: "Bound to you until the relic cracks.",
      costType: "none", costValue: 0, costText: "Forge with a scene of devotion.",
      riskText: "Breaking the vow shatters the relic — and the relic was a piece of you. 1 Blood Debt. The vow can be re-forged, but the new one will be smaller.",
      pathResonance: "Soul-Smith — devotion made tactile.",
      fictionalPermission: "Your conviction is a real object that other people can recognize and react to.",
      gmCalibration: "Tier-1 Form. Vow is declared at forging — three to seven words. GM enforces.",
      tags: ["soul-smith", "vow", "relic", "vestment"],
      flavor: "She touched the coin at her throat. The temptation passed."
    },
    {
      path: "soul-smith", kind: "weapon", name: "Repaired Memory",
      stability: "sustained", interaction: "worn", form: "vestment", function: "repair",
      intent: "presence", channel: "soul", sephirah: "chesed", mode: "hermetic",
      damageFormula: "0", damageType: "energy",
      weaponCategory: "unarmed", skill: "athletics",
      concept: "You take a treasured memory — yours, or someone you love — and beat it flat into a piece of armor. You wear the memory between you and the world.",
      signature: "When struck, the armor briefly replays a fragment of the memory in light and sound, visible to all.",
      thirdThing: "If the memory is of someone living, they feel the impact at a distance. They will know.",
      mechanicalHook: "+2 Guard while active. Once per scene, when you would take damage, redirect that damage to Stress instead.",
      duration: "scene", durationText: "While you can hold the memory in mind under pressure.",
      costType: "stress", costValue: 1, costText: "1 Stress to call up the memory.",
      maintenanceCost: "1 Stress per scene maintained.",
      riskText: "If you take a final blow while wearing it, the memory itself breaks. You lose access to that memory for at least a session — possibly forever.",
      pathResonance: "Soul-Smith — what you cherish is also what shields you.",
      fictionalPermission: "Your past is structurally part of your defense.",
      gmCalibration: "Tier-2 Form. Memory must be named at the table. GM may invoke it later for narrative weight.",
      tags: ["soul-smith", "memory", "vestment", "vulnerable"],
      flavor: "She wore her grandmother's hands like a breastplate."
    },
    {
      path: "soul-smith", kind: "weapon", name: "Apprentice's Echo",
      stability: "enduring", interaction: "companion", form: "construct", function: "reveal",
      intent: "presence", channel: "mind", sephirah: "hod", mode: "hermetic",
      damageFormula: "0", damageType: "energy",
      weaponCategory: "unarmed", skill: "athletics", scale: "scene",
      concept: "The voice of a teacher, a mentor, or a master you have lost — preserved in a small object you forged. The voice speaks once a scene to remind you of a lesson you might be about to forget.",
      signature: "The voice is recognizable to anyone who knew the original. Some find this comforting. Some do not.",
      thirdThing: "On certain nights — anniversaries, full moons, the eve of a bad decision — the voice speaks without being asked.",
      mechanicalHook: "Once per scene, when you fail a roll that depends on training the teacher gave you, the voice prompts you and you may reroll the lowest die.",
      duration: "persistent", durationText: "Persistent. The echo is yours until you stop listening.",
      costType: "none", costValue: 0,
      riskText: "If you act decisively against what the teacher would have wanted, the voice falls silent for one session.",
      pathResonance: "Soul-Smith — devotion preserved through repetition.",
      fictionalPermission: "Your teacher is here. Quietly. In your pocket. They are not exactly happy with what you are about to do.",
      gmCalibration: "Tier-2 Form. Teacher must be named and given personality at the table. GM may voice them when invoked.",
      tags: ["soul-smith", "teacher", "echo", "lesson"],
      flavor: "He held the carving steady. The voice in the wood corrected him."
    },

    // ════════════════════════════════════════════════════════════════════════
    // HARMONY MARSHAL  (non-TCC) — 3 Forms; calm, cadence, lawful presence
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "harmony-marshal", kind: "weapon", name: "Cadence Standard",
      stability: "sustained", interaction: "structure", form: "construct", function: "command",
      intent: "presence", channel: "soul", sephirah: "tiferet", mode: "hermetic",
      damageFormula: "0", damageType: "energy",
      weaponCategory: "ranged", skill: "athletics", scale: "scene",
      concept: "A standing banner — wood, cloth, sigil — planted in the ground. While it stands, the room hears its rhythm and falls into pace with it.",
      signature: "The banner does not move in the wind. It moves in the room's tension.",
      thirdThing: "Animals in the room stop pacing. Crying children settle. The standard does not care which side wins; it cares that the room holds shape.",
      mechanicalHook: "While planted, allies in the same zone reroll the lowest die on Resolve and Initiative. Enemies in the same zone cannot use Surge to interrupt.",
      duration: "scene", durationText: "While the standard stands and you live.",
      costType: "stress", costValue: 1, costText: "1 Stress to plant.",
      maintenanceCost: "1 Stress per scene maintained.",
      riskText: "If the standard falls, all benefits stop and you take 1 Stress. If it is taken by an enemy, they may use it once against you.",
      pathResonance: "Harmony Marshal — the room finds its tempo and keeps it.",
      fictionalPermission: "You declare the rhythm. The room agrees.",
      gmCalibration: "Tier-2 Form. Always visible. Always a target. Common knowledge to anyone who has fought under or against a Marshal.",
      tags: ["harmony-marshal", "standard", "rhythm", "visible"],
      flavor: "He drove the pole into the dirt. The shouting stopped becoming useful."
    },
    {
      path: "harmony-marshal", kind: "weapon", name: "Marshal's Mantle",
      stability: "bound", interaction: "worn", form: "vestment", function: "command",
      intent: "presence", channel: "soul", sephirah: "binah", mode: "hermetic",
      damageFormula: "0", damageType: "energy",
      weaponCategory: "unarmed", skill: "athletics",
      concept: "A long coat or cloak that is read by every authority in the scene as legitimate, regardless of jurisdiction.",
      signature: "Insignia on the mantle subtly shift to whatever the watcher considers credible: badge, sigil, signet, brand.",
      thirdThing: "Anyone who saw you yesterday wearing the mantle remembers you wearing whatever they think you should have been wearing.",
      mechanicalHook: "+2 to any social roll where authority is the lever. Once per scene, you may treat a refusal as a delay — the refuser will obey, but later, with conditions.",
      duration: "persistent", durationText: "Bound to you while you carry it.",
      costType: "none", costValue: 0,
      riskText: "If you abuse the authority — order something flagrantly unjust — the mantle is recognizably yours forever after, and never anyone else's.",
      pathResonance: "Harmony Marshal — authority is a vestment, not a birthright.",
      fictionalPermission: "You speak with the weight of an institution that may or may not actually back you.",
      gmCalibration: "Tier-2 Form. Recognized as legitimate by 80% of NPCs. The 20% who see through it are usually consequential.",
      tags: ["harmony-marshal", "vestment", "authority", "ambiguous"],
      flavor: "She walked through the line. The line decided she was supposed to."
    },
    {
      path: "harmony-marshal", kind: "weapon", name: "Hearing-Field",
      stability: "enduring", interaction: "zone", form: "field", function: "reveal",
      intent: "presence", channel: "mind", sephirah: "binah", mode: "hermetic",
      damageFormula: "0", damageType: "energy",
      weaponCategory: "unarmed", skill: "athletics", scale: "scene",
      concept: "A circle drawn — physically or implicitly — within which everyone speaks in turn, hears every other voice clearly, and cannot lie without their voice cracking.",
      signature: "Inside the field, ambient noise drops to a hush. People can hear themselves think. Some find this terrifying.",
      thirdThing: "Anyone who lies inside the field is marked: they cough at the moment of the lie. Other people in the field hear it and know.",
      mechanicalHook: "While active, no one in the field can take a hostile action without it being seen by everyone present. Lies are exposed (a small but unmistakable cough). All Insight rolls in the field reroll the lowest die.",
      duration: "scene", durationText: "While you remain present and willing to enforce the field.",
      costType: "stress", costValue: 2, costText: "2 Stress to open the field.",
      maintenanceCost: "1 Stress per scene maintained.",
      riskText: "You cannot lie inside the field either. Truths you would rather have not said may surface.",
      pathResonance: "Harmony Marshal — the room governed by being heard.",
      fictionalPermission: "You can stop a brawl, expose a fraud, or force a conversation that has been overdue for a decade.",
      gmCalibration: "Tier-3 Form. Excellent for diplomatic scenes. Catastrophic in crowded markets, courts, or households with skeletons in the closet.",
      tags: ["harmony-marshal", "field", "truth", "stillness"],
      flavor: "He opened the field. Everyone realized at once who had been lying for the last three weeks."
    },

    // ════════════════════════════════════════════════════════════════════════
    // COSMIC LINGUIST  (TCC) — 3 Workings + 3 Forms; reality-as-text edits
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "cosmic_linguist", kind: "power", name: "Footnote",
      tier: 1, intent: "intrigue", channel: "mind", sephirah: "hod", mode: "hermetic",
      activation: "action", target: "single", range: "near",
      stability: "instant", interaction: "event", form: "sigil", function: "reveal",
      concept: "You append a small reading to a recent event — a footnote — that the room must now consider true alongside the original.",
      signature: "A faint asterisk hovers over the event you have annotated. Not everyone sees it; everyone who reads sees it.",
      thirdThing: "Other Linguists can read your footnotes. They will know who wrote it.",
      mechanicalHook: "Add one fact, motive, or implication to a recent event. Anyone present must reroll their lowest die on the next check that depends on understanding the event.",
      costType: "clarity", costValue: 1, clarityRequired: 1,
      duration: "scene", durationText: "The footnote stays attached for the rest of the scene.",
      riskText: "If your footnote contradicts a witnessed truth too brazenly, the footnote tears and you take 1 Noise.",
      pathResonance: "Cosmic Linguist (Annotator) — small surgical edit, large consequence.",
      fictionalPermission: "You don't change what happened. You change how the room is allowed to read what happened.",
      gmCalibration: "T1 Working. One sentence. GM and player negotiate exact wording.",
      tags: ["cosmic-linguist", "annotator", "edit", "social"],
      flavor: "She murmured one sentence. The story acquired a margin."
    },
    {
      path: "cosmic_linguist", kind: "power", name: "Strikethrough",
      tier: 2, intent: "intrigue", channel: "mind", sephirah: "binah", mode: "hermetic",
      activation: "action", target: "single", range: "near",
      stability: "instant", interaction: "event", form: "sigil", function: "transform",
      concept: "You delete a recent sentence — a thing said, a thing acted, a thing recorded — from the canon of the scene. It happened. It is no longer the case that it happened.",
      signature: "The deleted moment leaves a thin line through the air, a visible strikethrough that fades over the next minute.",
      thirdThing: "The deleted moment still happened in the deleter's memory. You will remember it forever, even if no one else does.",
      mechanicalHook: "Erase one specific action, statement, or observation from the last 60 seconds. People in the scene revise their memory. Hard evidence (writing, recording) develops a flaw or smudge.",
      costType: "clarity", costValue: 2, clarityRequired: 2, noiseGain: 1,
      duration: "instant", durationText: "Permanent — until someone else writes the moment back in.",
      riskText: "Major edits draw attention from other Linguists, archivists, and any reality-stable witness (some saints, some children, some Pactkeepers).",
      pathResonance: "Cosmic Linguist (Redactor) — power lies in clean omission.",
      fictionalPermission: "You can take back a word that has already been said. Reality cooperates. Mostly.",
      gmCalibration: "T2 Working. Cannot delete events that constitute the spine of the scene. GM may require a higher tier for that.",
      tags: ["cosmic-linguist", "redactor", "delete", "memory"],
      flavor: "He drew a line through what he had just said. They forgot. He did not."
    },
    {
      path: "cosmic_linguist", kind: "power", name: "Italic Emphasis",
      tier: 1, intent: "presence", channel: "mind", sephirah: "tiferet", mode: "hermetic",
      activation: "bonus", target: "self", range: "self",
      stability: "instant", interaction: "event", form: "sigil", function: "command",
      concept: "Your next utterance lands as inarguable. Not a compulsion — a perfect formatting of meaning. The thing you said is now what was said.",
      signature: "Your voice momentarily acquires an italic quality — slightly slanted, slightly warmer.",
      thirdThing: "The emphasized statement is remembered with perfect verbatim accuracy by everyone in the scene, even if they would prefer not to.",
      mechanicalHook: "Your next single statement (one sentence) is treated by the scene as common knowledge. Allies reroll lowest die on the next roll predicated on agreeing with you.",
      costType: "clarity", costValue: 1, clarityRequired: 1,
      duration: "instant", durationText: "Permanent for the conversation.",
      riskText: "You cannot use this to force compliance. If you try, the emphasis fails and you take 1 Stress.",
      pathResonance: "Cosmic Linguist (Metaphor Apostle) — the said becomes the case.",
      fictionalPermission: "You speak in italics. The room copies it down.",
      gmCalibration: "T1 Working. One sentence. NPCs may still disagree — they cannot pretend they didn't hear it.",
      tags: ["cosmic-linguist", "metaphor-apostle", "emphasis", "speech"],
      flavor: "He italicized a single word. The argument bent around it."
    },
    {
      path: "cosmic_linguist", kind: "weapon", name: "Living Glossary",
      stability: "bound", interaction: "worn", form: "vestment", function: "reveal",
      intent: "intrigue", channel: "mind", sephirah: "hod", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics",
      concept: "A small book or sheaf of pages bound to your hand. It updates itself as you read. Definitions are slightly malleable in your favor.",
      signature: "Pages turn when you turn your attention. The handwriting is yours and not yours.",
      thirdThing: "The glossary records your every working, even those you have not yet performed.",
      mechanicalHook: "Once per scene, redefine a single word in the conversation. The redefinition holds for the scene. +2 to Insight rolls while open.",
      duration: "persistent", durationText: "Bound to you until removed.",
      costType: "none", costValue: 0,
      riskText: "If destroyed, you lose access to your last 1d4 Workings until a new glossary is begun. Reading rival glossaries can corrupt yours.",
      pathResonance: "Cosmic Linguist (Annotator) — meaning under your continuous editing.",
      fictionalPermission: "You can change what a word means. Quietly. The room follows.",
      gmCalibration: "Tier-1 Form. Visible to other Linguists. Useless if you cannot read the language being spoken.",
      tags: ["cosmic-linguist", "vestment", "glossary", "reading"],
      flavor: "She licked her thumb. She turned a page. The word became something else."
    },
    {
      path: "cosmic_linguist", kind: "weapon", name: "Marginalia Drift",
      stability: "sustained", interaction: "zone", form: "field", function: "transform",
      intent: "intrigue", channel: "mind", sephirah: "binah", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics", scale: "scene",
      concept: "A field of slow, drifting margins around a person, place, or object. Annotations accumulate around it whether or not anyone is writing.",
      signature: "Light, almost-readable script drifts in the air at the edge of vision around the marked subject.",
      thirdThing: "The accumulated annotations include things no one has yet observed. The future leaks through.",
      mechanicalHook: "While active on a target, every Insight, Investigate, or Recall roll about the target rerolls the lowest die. Once per scene, ask the GM one question about the target — they answer truthfully but minimally.",
      duration: "scene", durationText: "While you maintain attention.",
      costType: "stress", costValue: 1, costText: "1 Stress to mark a subject.",
      maintenanceCost: "1 Stress per scene maintained.",
      riskText: "Other Linguists can read your marginalia. Annotation reveals the annotator.",
      pathResonance: "Cosmic Linguist (Archivist) — past and future as marginalia of the present.",
      fictionalPermission: "You can study a thing the way a scholar studies a manuscript. The thing knows.",
      gmCalibration: "Tier-2 Form. Visible to anyone with second sight. Excellent for investigation; expensive for action.",
      tags: ["cosmic-linguist", "field", "investigation", "annotation"],
      flavor: "He looked at the door. The margins of the door began to fill in."
    },
    {
      path: "cosmic_linguist", kind: "weapon", name: "Scribe's Familiar",
      stability: "enduring", interaction: "companion", form: "construct", function: "reveal",
      intent: "intrigue", channel: "mind", sephirah: "hod", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "stealth", scale: "scene",
      concept: "A small inkling — half ink-blot, half insect — that copies what you observe. It can be sent ahead to read for you.",
      signature: "It moves silently. It leaves a faint trail of ink that evaporates.",
      thirdThing: "It cannot lie to you, but it can choose what to mention first. It has preferences.",
      mechanicalHook: "Send the familiar Far range to scout. It returns with a single accurate sentence about what it saw. Once per scene, it may copy a written page verbatim.",
      duration: "persistent", durationText: "Persistent until destroyed.",
      costType: "none", costValue: 0,
      riskText: "If captured by another Linguist, they can read your recent Workings.",
      pathResonance: "Cosmic Linguist (Archivist) — observation as ongoing record.",
      fictionalPermission: "You have a small, smart, mostly-silent helper that reads on your behalf.",
      gmCalibration: "Tier-1 Form. Easily missed; easily destroyed by anyone paying attention. GM may grant it a small personality.",
      tags: ["cosmic-linguist", "companion", "scout", "reading"],
      flavor: "It scuttled under the door. It came back with the answer."
    },

    // ════════════════════════════════════════════════════════════════════════
    // WYRDLENS ADEPT  (TCC) — 3 Workings + 3 Forms; perception, correspondence
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "wyrdlens-adept", kind: "power", name: "Lensing",
      tier: 1, intent: "intrigue", channel: "mind", sephirah: "yesod", mode: "hermetic",
      activation: "action", target: "single", range: "near",
      stability: "instant", interaction: "event", form: "sigil", function: "reveal",
      concept: "Strip an illusion, glamour, or hidden structure off a target for one breath. Everyone present sees the thing as it actually is.",
      signature: "A faint glass-ring tone sounds at the moment of revelation.",
      thirdThing: "The thing being unmasked feels it. They will know it was you.",
      mechanicalHook: "Reveal hidden truth about a person, place, or object — invisibility, disguise, lie, secret structure. Allies reroll lowest die on the next check that uses the revealed information.",
      costType: "clarity", costValue: 1, clarityRequired: 1,
      duration: "instant", durationText: "One breath of clear sight.",
      riskText: "Some things are hidden for kindness. Some things should not be looked at directly.",
      pathResonance: "Wyrdlens Adept — perception as force.",
      fictionalPermission: "You can see through it. So can everyone with you.",
      gmCalibration: "T1 Working. Single subject. GM reveals one truth. Player chooses which axis (identity, intent, condition, history).",
      tags: ["wyrdlens", "reveal", "perception", "social-consequence"],
      flavor: "She tilted her head. The mask came off."
    },
    {
      path: "wyrdlens-adept", kind: "power", name: "Correspondence Strike",
      tier: 2, intent: "violence", channel: "mind", sephirah: "yesod", mode: "hermetic",
      activation: "action", target: "single", range: "far",
      stability: "instant", interaction: "event", form: "sigil", function: "harm",
      damage: "2d6", damageType: "psychic", damageFlavor: "the wound that was always there",
      concept: "Hit a target by hitting its mirror — its reflection in water, a portrait, an effigy, a shared thread. The harm transfers.",
      signature: "The mirror or surrogate cracks at the same instant the target staggers.",
      thirdThing: "The surrogate retains the wound permanently. Everyone who handles it after will sense it.",
      mechanicalHook: "Strike a surrogate to deal 2d6 psychic damage to the original at any range, ignoring cover and most defenses.",
      costType: "clarity", costValue: 2, clarityRequired: 2, noiseGain: 1,
      duration: "instant", durationText: "Strike resolves immediately.",
      riskText: "If the surrogate is destroyed in the process, the link is gone — no further strikes against this target through this object.",
      pathResonance: "Wyrdlens Adept — what touches the reflection touches the thing.",
      fictionalPermission: "You can hurt someone you cannot see, if you can name what they are like.",
      gmCalibration: "T2 Working. GM may require an Insight check to find the right correspondence first. High Surge potential.",
      tags: ["wyrdlens", "ranged", "psychic", "ritual"],
      flavor: "He cracked the cup in his hand. Across the city, the man at the table cried out."
    },
    {
      path: "wyrdlens-adept", kind: "power", name: "Wide Angle",
      tier: 2, intent: "intrigue", channel: "mind", sephirah: "binah", mode: "hermetic",
      activation: "action", target: "self", range: "self",
      stability: "instant", interaction: "event", form: "sigil", function: "reveal", scale: "scene",
      concept: "Perceive the entire scene at once — every speaker, every weapon, every relationship, every untold thing — for one breath.",
      signature: "Your eyes briefly cloud over with a faint geometric pattern.",
      thirdThing: "What you see in that moment is more than your conscious mind can hold. The rest goes into dreams later.",
      mechanicalHook: "GM describes the scene at a level above your current vantage: who is connected to whom, who is armed, who is lying, who is afraid, where the exits are. Allies reroll lowest die on Initiative this scene.",
      costType: "clarity", costValue: 2, clarityRequired: 2,
      duration: "instant", durationText: "One breath of total perception.",
      riskText: "Stress 1 from the influx. Anyone watching you closely sees the moment your eyes change.",
      pathResonance: "Wyrdlens Adept — the scene legible at once.",
      fictionalPermission: "You know what is happening in this room. All of it. Briefly.",
      gmCalibration: "T2 Working. GM gives 4-7 facts. Player chooses what to act on. Other casters in the scene notice.",
      tags: ["wyrdlens", "reveal", "scene-scale", "intelligence"],
      flavor: "She breathed in. The room stopped having secrets, briefly."
    },
    {
      path: "wyrdlens-adept", kind: "weapon", name: "Sigil of Seeing",
      stability: "bound", interaction: "worn", form: "vestment", function: "reveal",
      intent: "intrigue", channel: "mind", sephirah: "yesod", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics",
      concept: "A glyph etched somewhere on your body — palm, brow, sole of foot — that sharpens what you witness while you consciously focus on it.",
      signature: "The sigil glows faintly when looked at directly. It is impossible to look at and not be seen by.",
      thirdThing: "The sigil sees a few things you do not. Sometimes it warns you. Usually too late.",
      mechanicalHook: "+2 to all Insight, Notice, and Investigate rolls. Once per scene, the GM tells you one thing the sigil saw that you did not.",
      duration: "persistent", durationText: "Bound to your body.",
      costType: "none", costValue: 0,
      riskText: "Some things look back through it. Sleep is occasionally interrupted.",
      pathResonance: "Wyrdlens Adept — perception kept always, sharpened on demand.",
      fictionalPermission: "Your senses are visibly enhanced. People notice you noticing.",
      gmCalibration: "Tier-1 Form. Other Wyrdlens see the sigil and recognize the school.",
      tags: ["wyrdlens", "vestment", "sigil", "perception"],
      flavor: "She traced the mark on her palm. The room came into focus."
    },
    {
      path: "wyrdlens-adept", kind: "weapon", name: "Atlas Prism",
      stability: "sustained", interaction: "zone", form: "field", function: "reveal",
      intent: "intrigue", channel: "mind", sephirah: "binah", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics", scale: "scene",
      concept: "An array of small lenses — physical or summoned — that maps the hidden lines of a region. Trade routes, ley lines, social ties, surveillance.",
      signature: "The lenses arrange themselves in a slow geometric pattern around a central axis you choose.",
      thirdThing: "Once mapped, the region knows it has been mapped. It may push back over the next session.",
      mechanicalHook: "While active, allies have +2 to Investigate and Strategy rolls in the mapped region. GM provides a mental map of one hex's hidden lines: contraband routes, faction influence, ley resonance.",
      duration: "scene", durationText: "While you maintain the prism.",
      costType: "stress", costValue: 2, costText: "2 Stress to attune.",
      maintenanceCost: "1 Stress per scene maintained.",
      riskText: "Other Wyrdlens, certain Pactkeepers, and any sufficiently institutional surveillance apparatus will notice.",
      pathResonance: "Wyrdlens Adept — the map made tactical.",
      fictionalPermission: "You can see a region's hidden geography. The region notices.",
      gmCalibration: "Tier-3 Form. Excellent for strategic phases. Loud at the strategic layer; quiet at the tactical.",
      tags: ["wyrdlens", "field", "mapping", "strategic"],
      flavor: "He let the lenses settle. The city's secrets arranged themselves."
    },
    {
      path: "wyrdlens-adept", kind: "weapon", name: "Witness Flame",
      stability: "enduring", interaction: "structure", form: "construct", function: "reveal",
      intent: "intrigue", channel: "soul", sephirah: "tiferet", mode: "hermetic",
      damageFormula: "0", damageType: "energy",
      weaponCategory: "unarmed", skill: "athletics", scale: "scene",
      concept: "A small blue flame in a lantern, candle, or palm. It burns brighter when truth is spoken near it — and dimmer when truth is avoided.",
      signature: "The flame is silent. It is also faintly cold.",
      thirdThing: "When extinguished, the flame remembers the last lie told near it and carries that memory until relit.",
      mechanicalHook: "Within Near range of the flame, all Insight rolls reroll the lowest die. A liar in the same room will visibly notice the flame dim and may flinch.",
      duration: "persistent", durationText: "Persistent until extinguished or moved beyond Far range.",
      costType: "none", costValue: 0,
      riskText: "The flame draws witnesses. People in trouble may seek it out. People with secrets may try to put it out.",
      pathResonance: "Wyrdlens Adept — truth as low ambient flame.",
      fictionalPermission: "You can install a lie-detector in a room, leave the room, and trust the room.",
      gmCalibration: "Tier-2 Form. Always-on. Politically inconvenient in many settings.",
      tags: ["wyrdlens", "structure", "truth", "ambient"],
      flavor: "He set the lantern on the table. The conversation got more careful."
    },

    // ════════════════════════════════════════════════════════════════════════
    // DREAMWALKER  (TCC) — 3 Workings + 3 Forms; mirrors, doubles, dream-logic
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "dreamwalker", kind: "power", name: "Mirrorstep",
      tier: 1, intent: "intrigue", channel: "soul", sephirah: "yesod", mode: "hermetic",
      activation: "bonus", target: "self", range: "near",
      stability: "instant", interaction: "event", form: "gate", function: "move",
      concept: "Step into a reflective surface — water, glass, polished metal — and emerge from another within Near range.",
      signature: "Both surfaces ripple at the moment of transit. Other reflections in the room flicker.",
      thirdThing: "While in the in-between, you briefly see what the mirror's normal reflection is. Sometimes it is not what you expect.",
      mechanicalHook: "Move from one reflective surface to another within Near range. Counts as movement, not teleportation — line-of-sight cover is bypassed but tracking spells still tag you.",
      costType: "clarity", costValue: 1, clarityRequired: 1,
      duration: "instant", durationText: "One step.",
      riskText: "If the destination mirror is occupied (animal, hidden ally, hostile dream-thing), you arrive in their space. Mostly bad outcomes.",
      pathResonance: "Dreamwalker — mirrors as doors.",
      fictionalPermission: "You travel by reflection. Other Dreamwalkers know the technique. They may have set traps.",
      gmCalibration: "T1 Working. Limited to Near range. Cannot escape combat zones unless a mirror is present.",
      tags: ["dreamwalker", "movement", "mirror", "transit"],
      flavor: "He stepped into the puddle. He stepped out of the windowpane."
    },
    {
      path: "dreamwalker", kind: "power", name: "Borrowed Face",
      tier: 1, intent: "intrigue", channel: "soul", sephirah: "yesod", mode: "hermetic",
      activation: "action", target: "self", range: "self",
      stability: "instant", interaction: "transformation", form: "body", function: "transform",
      concept: "Wear someone's face for one beat — a sentence, a gesture, a glance through a doorway. Not their voice. Not their name. Just their face.",
      signature: "The borrowed face is slightly translucent. It looks right at a distance and wrong up close.",
      thirdThing: "The person whose face you borrow dreams of you that night. Most do not understand what they dreamed.",
      mechanicalHook: "Wear a face you have seen recently for one beat (one statement, one act of being seen, one passing glance). Bypasses one social check that depends on being recognized as them.",
      costType: "clarity", costValue: 1, clarityRequired: 1, noiseGain: 1,
      duration: "instant", durationText: "One beat.",
      riskText: "If you stretch the beat — try to hold the face for an extended scene — you take 1d4 Stress and the face starts to dissolve visibly.",
      pathResonance: "Dreamwalker — likeness as currency.",
      fictionalPermission: "You can be them, briefly, for the people who don't know them well.",
      gmCalibration: "T1 Working. Cannot fool intimates. Cannot perfectly fool anyone closer than a colleague.",
      tags: ["dreamwalker", "disguise", "face", "brief"],
      flavor: "She walked past the guard wearing his sister's face. He waved her through."
    },
    {
      path: "dreamwalker", kind: "power", name: "Sleep-Loop",
      tier: 2, intent: "intrigue", channel: "soul", sephirah: "yesod", mode: "hermetic",
      activation: "ritual", target: "single", range: "sight",
      stability: "instant", interaction: "mark", form: "rite", function: "bind",
      concept: "Mark a target you have seen recently. Tonight in their sleep, a moment of your choosing recurs over and over until they wake remembering it.",
      signature: "A small repeating glyph appears, briefly, on their pillow at the moment they fall asleep.",
      thirdThing: "If they recognize the sigil, they will recognize you. Some will retaliate.",
      mechanicalHook: "Choose a moment from the target's recent past or fictional possibility. They dream it on loop. The next morning they treat the moment as significant — believe it happened, fear it, want it, etc. (GM/player negotiate).",
      costType: "clarity", costValue: 2, clarityRequired: 2, noiseGain: 1,
      duration: "scene", durationText: "Resolves overnight.",
      riskText: "Strong-willed targets push the dream back. You may dream their version of you. Roll Resolve at dawn or take 1d4 Stress.",
      pathResonance: "Dreamwalker — sleep is editable.",
      fictionalPermission: "You can plant a thought, a fear, a longing that the target will wake convinced of.",
      gmCalibration: "T2 Working. Slow effect — payoff next session. GM should think about how the target will respond next time you meet.",
      tags: ["dreamwalker", "mark", "ritual", "sleep"],
      flavor: "He marked her at dinner. By breakfast, she was certain of him."
    },
    {
      path: "dreamwalker", kind: "weapon", name: "Dream-Twin",
      stability: "bound", interaction: "companion", form: "body", function: "transform",
      intent: "intrigue", channel: "soul", sephirah: "yesod", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "stealth",
      concept: "A quiet double of yourself, drawn from your own dream-stuff. It mirrors your gestures from a few feet away. It does not speak.",
      signature: "The twin is always slightly lower-resolution than you — softer edges, less specific clothes.",
      thirdThing: "If you sleep, the twin watches. It sometimes wakes you with news.",
      mechanicalHook: "While the twin is present, you have advantage (reroll lowest die) on Stealth and Insight. Enemies must succeed at a Notice check to determine which is the original. Once per scene, you may swap places.",
      duration: "persistent", durationText: "Bound to you while you live.",
      costType: "none", costValue: 0,
      riskText: "If the twin takes a fatal blow, you take 1 Stress and the twin is gone for the rest of the session.",
      pathResonance: "Dreamwalker — duplicity literalized.",
      fictionalPermission: "There are two of you. Most people cannot tell which is which.",
      gmCalibration: "Tier-2 Form. Cannot speak. Cannot perform fine work. Excellent decoy.",
      tags: ["dreamwalker", "companion", "double", "decoy"],
      flavor: "He turned. The twin had already turned. The guard could not decide who to swing at."
    },
    {
      path: "dreamwalker", kind: "weapon", name: "Lucid Standard",
      stability: "sustained", interaction: "structure", form: "construct", function: "command",
      intent: "presence", channel: "soul", sephirah: "yesod", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "ranged", skill: "athletics", scale: "scene",
      concept: "A banner woven from dreamthread, half-real. While planted, it operates within dreamtime — useful only when at least one combatant is sleeping, hallucinating, or dream-touched.",
      signature: "The standard ripples in a wind no one else can feel.",
      thirdThing: "It works perfectly during ambush of sleeping enemies. It does almost nothing in plain daylight.",
      mechanicalHook: "When at least one creature in the scene is dreaming, dazed, or unconscious, allies in the same zone reroll the lowest die on Stealth, Surprise, and Coup-de-grace rolls. Hostile dreamers in the zone are visible to your side regardless of cover.",
      duration: "scene", durationText: "While planted in a dream-touched scene.",
      costType: "stress", costValue: 1, costText: "1 Stress to plant.",
      maintenanceCost: "1 Stress per scene maintained.",
      riskText: "Useless in daylight on alert enemies. Excellent during night raids and when the GM is feeling generous.",
      pathResonance: "Dreamwalker — standards work in their proper kingdom.",
      fictionalPermission: "Your raid through a sleeping village goes silently and well.",
      gmCalibration: "Tier-2 Form. Conditional but powerful. Encourages stealth play.",
      tags: ["dreamwalker", "standard", "stealth", "night"],
      flavor: "She drove the standard into the floorboards. The sleeping house belonged to her."
    },
    {
      path: "dreamwalker", kind: "weapon", name: "Memory-Bramble",
      stability: "enduring", interaction: "zone", form: "field", function: "bind",
      intent: "intrigue", channel: "soul", sephirah: "yesod", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics", scale: "scene",
      concept: "A thicket of recurring dreams planted around a place. Anyone who sleeps within Near range of it dreams — slightly — of the same scene. The thicket grows.",
      signature: "Faint thorny shapes in the corners of the room you cannot quite focus on.",
      thirdThing: "Over weeks, the dreams become the place's reputation. Locals start to act it out.",
      mechanicalHook: "Plant once. From then on, anyone sleeping within Near range dreams the planted scene. After 1d4 sessions, the location takes on the qualities of the dream (haunted, prosperous, prone to fights, suddenly romantic).",
      duration: "persistent", durationText: "Persistent until uprooted.",
      costType: "stress", costValue: 2, costText: "2 Stress + 1 hour of focused dreaming.",
      riskText: "Strong-minded sleepers can prune the bramble. A skilled Dreamwalker can convert it.",
      pathResonance: "Dreamwalker — locations dreamed long enough become themselves.",
      fictionalPermission: "You can change a place's character, slowly, by changing what is dreamed there.",
      gmCalibration: "Tier-3 Form. Long-fuse. Excellent strategic tool. GM tracks slow drift.",
      tags: ["dreamwalker", "field", "long-game", "strategic"],
      flavor: "She slept in the inn three nights running. By the fourth night, the inn dreamed her dream."
    },

    // ════════════════════════════════════════════════════════════════════════
    // PACTKEEPER  (TCC) — 3 Workings + 3 Forms; agreements, witnesses, oaths
    // ════════════════════════════════════════════════════════════════════════
    {
      path: "pactkeeper", kind: "power", name: "Cite Precedent",
      tier: 1, intent: "presence", channel: "soul", sephirah: "binah", mode: "hermetic",
      activation: "action", target: "single", range: "near",
      stability: "instant", interaction: "event", form: "rite", function: "command",
      concept: "Reach into the record of past agreements and force reality to honor one of them again, here, now.",
      signature: "A faint sound of a gavel, a sealed envelope tearing, or a bell once rung.",
      thirdThing: "The cited precedent is briefly visible to all present — a word, a date, a name. Some of them recognize it.",
      mechanicalHook: "Name a precedent — a vow, a treaty, a contract, a rule of the house — that the target has previously agreed to, even implicitly. They must obey it now. If they refuse, they take 1 Blood Debt.",
      costType: "clarity", costValue: 1, clarityRequired: 1,
      duration: "instant", durationText: "Until the cited clause is fulfilled or broken.",
      riskText: "If you cite a precedent that does not actually exist, the working backfires — 1d4 Stress and the room knows you tried to lie about a contract.",
      pathResonance: "Pactkeeper (Archivist) — past rulings as present force.",
      fictionalPermission: "You can hold someone to something they actually agreed to. Reality cooperates.",
      gmCalibration: "T1 Working. GM may negotiate the strength of the precedent. Strong precedents = strong compulsion.",
      tags: ["pactkeeper", "archivist", "binding", "social"],
      flavor: "She named the treaty. He sat down."
    },
    {
      path: "pactkeeper", kind: "power", name: "Bind Witness",
      tier: 2, intent: "presence", channel: "soul", sephirah: "binah", mode: "hermetic",
      activation: "action", target: "single", range: "near",
      stability: "instant", interaction: "mark", form: "rite", function: "bind",
      concept: "Compel a target to bear witness — to either speak the truth on a chosen subject or carry a visible mark indicating their refusal.",
      signature: "A small invisible sigil affixes to their throat. Visible to other Pactkeepers and to anyone with second sight.",
      thirdThing: "The mark of refusal is recognized by every Pactkeeper they meet for a season. Their reputation will travel.",
      mechanicalHook: "Target must answer one question truthfully or accept the Marked condition (visible to all Pactkeepers, contracts, and institutional structures) for 1d4 sessions.",
      costType: "clarity", costValue: 2, clarityRequired: 2,
      duration: "instant", durationText: "Choice resolves immediately.",
      riskText: "If the target answers truthfully and the truth is dangerous to you, you cannot un-hear it.",
      pathResonance: "Pactkeeper (Auditor) — testimony as binding.",
      fictionalPermission: "You can compel speech. Or compel silence-with-consequence. The target chooses which.",
      gmCalibration: "T2 Working. Excellent for diplomacy, interrogation, and testimony. Politically loud.",
      tags: ["pactkeeper", "auditor", "compel", "testimony"],
      flavor: "He looked her in the eye. He chose the mark."
    },
    {
      path: "pactkeeper", kind: "power", name: "Penalty Clause",
      tier: 1, intent: "violence", channel: "soul", sephirah: "gevurah", mode: "hermetic",
      activation: "reaction", target: "single", range: "near",
      stability: "instant", interaction: "event", form: "sigil", function: "harm",
      damage: "2d6", damageType: "psychic", damageFlavor: "the consequence of an oath broken",
      concept: "When an oath sworn in your presence is broken, the breaker takes the wound the oath promised them.",
      signature: "A faint snap of a sealed scroll. The breaker visibly winces.",
      thirdThing: "The wound is the wound the breaker themselves named when they swore. Reality pays out exactly what was promised.",
      mechanicalHook: "Reaction: when a creature within Near range breaks an oath sworn in your witness, deal 2d6 psychic damage and apply a condition appropriate to the broken oath.",
      costType: "clarity", costValue: 1, clarityRequired: 1,
      duration: "instant", durationText: "Resolves at the moment of breaking.",
      riskText: "Reality charges interest. If the oath was vague, the penalty may be misapplied. If it was specific, the penalty is exact.",
      pathResonance: "Pactkeeper (Auditor) — the ledger settles itself.",
      fictionalPermission: "You can make an oath bite back when it is broken. Witnessed oaths are not free.",
      gmCalibration: "T1 Working. Requires you to have witnessed the oath. Conditional but devastating when triggered.",
      tags: ["pactkeeper", "reaction", "oath", "punishment"],
      flavor: "She had heard him swear. When he lied, the lie cut him."
    },
    {
      path: "pactkeeper", kind: "weapon", name: "Standing Oath",
      stability: "bound", interaction: "worn", form: "vestment", function: "command",
      intent: "presence", channel: "soul", sephirah: "tiferet", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics",
      concept: "A worn vestment — robe, sash, ring — into which you have hammered an oath you keep to yourself. While you wear it, your word carries weight.",
      signature: "The garment is plain but absolutely clean — it does not stain, fray, or weather.",
      thirdThing: "If you break the oath, the garment changes — visibly. The change is recognized by every Pactkeeper.",
      mechanicalHook: "+2 to social rolls when you give your word. Once per scene, when you make a promise, all parties present recognize it as binding without requiring further ceremony.",
      duration: "persistent", durationText: "Bound to you while you keep the oath.",
      costType: "none", costValue: 0,
      riskText: "Breaking the oath costs 1 Blood Debt and the vestment is ruined. Other Pactkeepers will know.",
      pathResonance: "Pactkeeper (Steward) — the sworn life made tactile.",
      fictionalPermission: "You are recognized as a person whose word counts. Until you break it.",
      gmCalibration: "Tier-1 Form. The oath must be specific and named at forging. GM enforces.",
      tags: ["pactkeeper", "steward", "vestment", "oath"],
      flavor: "He buttoned the robe. He had not lied since the year he forged it."
    },
    {
      path: "pactkeeper", kind: "weapon", name: "Court of Seven",
      stability: "sustained", interaction: "zone", form: "field", function: "reveal",
      intent: "presence", channel: "soul", sephirah: "binah", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics", scale: "scene",
      concept: "Open a circle around you in which seven invisible witnesses stand. Their attention enforces the unwritten rules of the room.",
      signature: "Seven faint shadows on the walls of the circle, even where there should be none. They do not move.",
      thirdThing: "The witnesses remember every conversation held within the circle. A skilled Pactkeeper can read them later.",
      mechanicalHook: "While the court is open, lies told inside it cost 1 Stress per attempt to the liar. Promises made inside it bind whether or not the parties intended.",
      duration: "scene", durationText: "While you stand in the circle.",
      costType: "stress", costValue: 1, costText: "1 Stress to convene the court.",
      maintenanceCost: "1 Stress per scene maintained.",
      riskText: "The witnesses also watch you. Your own lies cost as much as anyone else's.",
      pathResonance: "Pactkeeper (Steward) — the unseen jurisprudence of the room.",
      fictionalPermission: "You hold a small impromptu court. Reality remembers what is said in it.",
      gmCalibration: "Tier-2 Form. Excellent for negotiation, treaty, parley. Politically expensive.",
      tags: ["pactkeeper", "field", "court", "binding"],
      flavor: "She drew the circle. The room understood it had rules now."
    },
    {
      path: "pactkeeper", kind: "weapon", name: "Long Ledger",
      stability: "enduring", interaction: "structure", form: "tool", function: "reveal",
      intent: "intrigue", channel: "mind", sephirah: "binah", mode: "hermetic",
      damageFormula: "0", damageType: "psychic",
      weaponCategory: "unarmed", skill: "athletics", scale: "faction",
      concept: "A ledger — physical or implied — that records every promise spoken near you. The book updates itself. It is impossible to write in falsely.",
      signature: "Pages turn at quiet moments without being touched. Ink gathers on the page like dew.",
      thirdThing: "Over a season, the ledger accumulates enough material to embarrass any institution that has lied to you.",
      mechanicalHook: "Once per session, consult the ledger about a recent promise made in your presence. The ledger names the promise verbatim, the promiser, and any clauses.",
      duration: "persistent", durationText: "Persistent. The ledger is a campaign-relevant artifact.",
      costType: "none", costValue: 0,
      riskText: "Other Pactkeepers, archivists, and major faction lawyers will want to read it. Some will pay. Some will threaten.",
      pathResonance: "Pactkeeper (Archivist) — the long memory of the office.",
      fictionalPermission: "You have a book that nobody can lie to. Including you.",
      gmCalibration: "Tier-3 Form. Strategic-tier item. Excellent for long-arc political play.",
      tags: ["pactkeeper", "archivist", "tool", "campaign-relevant"],
      flavor: "She set the ledger on the table. She did not need to open it. He withdrew the offer."
    }
  ];

  // ───── Driver ──────────────────────────────────────────────────────────────
  await pack.getIndex();
  const existingNames = new Set(pack.index.map(e => e.name));

  const toCreate = [];
  let skipped = 0;
  for (const spec of SPECS) {
    if (existingNames.has(spec.name)) { skipped++; continue; }
    toCreate.push(mk(spec));
  }

  if (!toCreate.length) {
    ui.notifications.info(`All ${SPECS.length} starter manifestations already present in ${PACK_ID}. Nothing to do.`);
    return;
  }

  const cls = pack.documentClass; // Item document class
  const created = await cls.createDocuments(toCreate, { pack: PACK_ID, keepId: false });
  ui.notifications.info(`Seeded ${created.length} starter manifestations into ${PACK_ID}. Skipped ${skipped} duplicates.`);
  console.log("[seed-starter-manifestations] created:", created.map(c => c.name));
})();
