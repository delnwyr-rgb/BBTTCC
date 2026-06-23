/**
 * create-manifestation-techniques.macro.js  (2026-06-22)
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds 16 manifestation-centered Techniques (item type "feat",
 * system.category "technique") into the "Bad Eden: Items" compendium under the
 * "BBTTCC Feats" folder. Closes the gap left when the manifestation system was
 * built AFTER the original Techniques list.
 *
 * SAFETY: purely ADDITIVE. Dedups by system.identifier (idempotent upsert) — it
 * only creates/updates the 16 named feats below and never deletes or touches any
 * other pack record. Run it IN-WORLD (Foundry macro), in BOTH worlds (foundry +
 * ember). This is the correct path for adding to a LIVE LevelDB pack — do NOT
 * rsync the repo pack over live (that has destroyed live-only content before).
 *
 * Set DRY_RUN = true first to preview the create/update/skip plan without writing.
 *
 * AUTOMATION (verified against systems/fourththing 2026-06-22):
 *   flags.fourththing.discipline.passive.{clarityMaxBonus,concurrencyBonus,
 *       upkeepScale,reachDiscount,misfireBandShift}  → consumed live at cast /
 *       upkeep / misfire / data-prep (module.js:7095,7121,7600,7602,16295).
 *   flags.fourththing.discipline.mode.{key,grants}    → same, gated on the actor's
 *       class stance flag (clSentence|wlRefraction|dwWalkingLane|pkSealedPact).
 *   flags.fourththing.rerolls = [{context:"caster-check",mode:"reroll-lowest"}]
 *       → fires on every manifestation cast roll (module.js:13380-13381).
 *   Levers with NO engine knob (Clarity-cost discount, Noise reduction, scale /
 *       range / signature tier) are authored as Rules text — GM/player applies.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PACK_ID     = "bbttcc-master-content.items";
const FOLDER_NAME = "BBTTCC Feats";
const SOURCE_TAG  = "BBTTCC Manifestation Techniques v1";
const PACK_FLAG   = "bbttcc-manifestation-techniques-v1";
const DRY_RUN     = false;   // ← set true to preview without writing

// auto = ⚙ engine-wired; text = ✍ Rules-only. `ft` is merged into flags.fourththing.
const SPECS = [
  // ── Clarity economy ───────────────────────────────────────────────────────
  {
    slug: "deep_well", name: "Deep Well", theme: "Clarity economy", access: "General",
    img: "icons/magic/water/orb-water-bubbles.webp",
    flavor: "Your reservoir of will runs deeper than most stewards'.",
    rules: "<p>Your maximum <strong>Clarity</strong> increases by <strong>2</strong>. A deeper reservoir lets you hold more manifestations at once and absorb a bad misfire without running dry.</p>",
    autoNote: "Applies automatically: +2 Clarity max.",
    ft: { discipline: { passive: { clarityMaxBonus: 2 } } }
  },
  {
    slug: "drawing_deep", name: "Drawing Deep", theme: "Clarity economy", access: "Cosmic Linguist",
    img: "icons/magic/symbols/runes-star-blue.webp",
    flavor: "You hold the Sentence open and let the meaning pour in.",
    rules: "<p>While your <strong>Sentence</strong> stance is active, your maximum <strong>Clarity</strong> increases by <strong>3</strong> — but the open channel costs you <strong>+1 Noise per scene</strong> for as long as the stance is held.</p>",
    autoNote: "Applies automatically while the Sentence stance is active: +3 Clarity max. (The +1 Noise/scene upkeep is tracked narratively.)",
    ft: { discipline: { mode: { key: "clSentence", grants: { clarityMaxBonus: 3 } } } }
  },
  {
    slug: "frugal_caster", name: "Frugal Caster", theme: "Clarity economy", access: "General",
    img: "icons/magic/light/explosion-star-glow-blue.webp",
    flavor: "You wring every drop of meaning from a working.",
    rules: "<p>Reduce the <strong>Clarity</strong> cost of any <strong>Tier&nbsp;1</strong> manifestation you cast by <strong>1</strong> (minimum&nbsp;0).</p>",
    ft: {}
  },
  {
    slug: "reclamation", name: "Reclamation", theme: "Clarity economy", access: "General",
    img: "icons/magic/control/buff-flight-wings-blue.webp",
    flavor: "You tear reserve will out of your own composure.",
    rules: "<p>Once per scene, you may take <strong>1 Stress</strong> to immediately recover <strong>2 Clarity</strong>, up to your maximum.</p>",
    ft: {}
  },

  // ── Concurrency & upkeep ──────────────────────────────────────────────────
  {
    slug: "many_hands", name: "Many Hands", theme: "Concurrency & upkeep", access: "General",
    img: "icons/magic/control/hypnosis-mesmerism-eye.webp",
    flavor: "You keep more plates spinning than anyone has a right to.",
    rules: "<p>You can sustain <strong>one additional manifestation</strong> before upkeep begins charging you for the overflow. Increases your manifestation <strong>concurrency by 1</strong>.</p>",
    autoNote: "Applies automatically: +1 manifestation concurrency.",
    ft: { discipline: { passive: { concurrencyBonus: 1 } } }
  },
  {
    slug: "light_footprint", name: "Light Footprint", theme: "Concurrency & upkeep", access: "General",
    img: "icons/magic/movement/trail-streak-zigzag-yellow.webp",
    flavor: "Your sustained workings sit lightly on the world.",
    rules: "<p>The ongoing <strong>upkeep</strong> cost of maintaining your sustained manifestations is <strong>halved</strong>.</p>",
    autoNote: "Applies automatically: upkeep cost ×0.5.",
    ft: { discipline: { passive: { upkeepScale: 0.5 } } }
  },
  {
    slug: "refracted_attention", name: "Refracted Attention", theme: "Concurrency & upkeep", access: "Wyrdlens-Adept",
    img: "icons/magic/perception/eye-ringed-glow-angry-blue.webp",
    flavor: "Through the lens, one mind looks out of many windows.",
    rules: "<p>While your <strong>Refraction</strong> stance is active, you split your focus across more threads: hold <strong>+1 manifestation</strong> and pay only <strong>three-quarters</strong> upkeep on what you sustain.</p>",
    autoNote: "Applies automatically while the Refraction stance is active: +1 concurrency, upkeep ×0.75.",
    ft: { discipline: { mode: { key: "wlRefraction", grants: { concurrencyBonus: 1, upkeepScale: 0.75 } } } }
  },
  {
    slug: "bound_and_bargained", name: "Bound and Bargained", theme: "Concurrency & upkeep", access: "Pactkeeper",
    img: "icons/magic/symbols/runes-carved-stone-purple.webp",
    flavor: "A sealed pact holds itself; you need only keep the terms.",
    rules: "<p>While your <strong>Sealed Pact</strong> stance is active, the bindings carry their own weight: the <strong>upkeep</strong> cost of your sustained manifestations is <strong>halved</strong>.</p>",
    autoNote: "Applies automatically while the Sealed Pact stance is active: upkeep ×0.5.",
    ft: { discipline: { mode: { key: "pkSealedPact", grants: { upkeepScale: 0.5 } } } }
  },

  // ── Misfire & risk ────────────────────────────────────────────────────────
  {
    slug: "steady_hand", name: "Steady Hand", theme: "Misfire & risk", access: "General",
    img: "icons/magic/defensive/shield-barrier-glowing-blue.webp",
    flavor: "When it goes wrong, your discipline pulls the backlash short.",
    rules: "<p>When a manifestation misfires, the result lands <strong>one band safer</strong> — your control biases the backlash toward the mild end of the table.</p>",
    autoNote: "Applies automatically: misfire band shifted −1 (safer).",
    ft: { discipline: { passive: { misfireBandShift: -1 } } }
  },
  {
    slug: "pay_the_toll", name: "Pay the Toll", theme: "Misfire & risk", access: "General",
    img: "icons/magic/death/skull-energy-light-purple.webp",
    flavor: "You have made your peace with the price of reaching.",
    rules: "<p>The <strong>Blood-Debt</strong> cost of reaching beyond your grasp is reduced by <strong>1</strong> (minimum&nbsp;0).</p>",
    autoNote: "Applies automatically: reach Blood-Debt cost −1.",
    ft: { discipline: { passive: { reachDiscount: 1 } } }
  },
  {
    slug: "lucid_footing", name: "Lucid Footing", theme: "Misfire & risk", access: "Dreamwalker",
    img: "icons/magic/control/sleep-bubble-purple.webp",
    flavor: "In the Lane, the dream cushions your mistakes.",
    rules: "<p>While you walk the <strong>Lane</strong>, misfires land <strong>two bands safer</strong> and the <strong>Blood-Debt</strong> cost of reaching is reduced by <strong>1</strong>.</p>",
    autoNote: "Applies automatically while the Walking-Lane stance is active: misfire band −2, reach Blood-Debt −1.",
    ft: { discipline: { mode: { key: "dwWalkingLane", grants: { misfireBandShift: -2, reachDiscount: 1 } } } }
  },
  {
    slug: "quiet_casting", name: "Quiet Casting", theme: "Misfire & risk", access: "General",
    img: "icons/magic/air/wind-vortex-swirl-gray.webp",
    flavor: "Your workings leave a fainter signature on the world.",
    rules: "<p>Reduce the <strong>Noise</strong> you generate on each cast by <strong>1</strong> (minimum&nbsp;0).</p>",
    ft: {}
  },

  // ── Reach, scale & signature ──────────────────────────────────────────────
  {
    slug: "sure_recitation", name: "Sure Recitation", theme: "Reach, scale & signature", access: "General — Tier 2+",
    img: "icons/magic/symbols/runes-triangle-orange.webp",
    flavor: "You speak your workings cleanly, even under pressure.",
    rules: "<p>On any manifestation <strong>cast roll</strong>, you may <strong>reroll the lowest die</strong>, keeping the new result if it is higher.</p>",
    autoNote: "Applies automatically: reroll the lowest die on every manifestation cast.",
    prereqLevel: 6,
    ft: { rerolls: [ { context: "caster-check", mode: "reroll-lowest", note: "Sure Recitation" } ] }
  },
  {
    slug: "overreach", name: "Overreach", theme: "Reach, scale & signature", access: "General",
    img: "icons/magic/fire/flame-burning-hand-purple.webp",
    flavor: "You stretch a working past where it ought to reach.",
    rules: "<p>When you cast a manifestation, you may treat your tier as <strong>one higher</strong> for determining its <strong>footprint and scale only</strong> (range, area, and number of targets). Its Clarity cost and Cast DC remain those of your actual tier.</p>",
    ft: {}
  },
  {
    slug: "wide_working", name: "Wide Working", theme: "Reach, scale & signature", access: "General",
    img: "icons/magic/light/explosion-star-glow-orange.webp",
    flavor: "What you shape, you shape broadly.",
    rules: "<p>Increase the <strong>area size</strong> of any area-of-effect manifestation you cast by one step (e.g. a 10&nbsp;ft burst becomes 15&nbsp;ft; a 15&nbsp;ft cone becomes 20&nbsp;ft).</p>",
    ft: {}
  },
  {
    slug: "signature_ascendant", name: "Signature Ascendant", theme: "Reach, scale & signature", access: "General",
    img: "icons/magic/symbols/star-solid-gold.webp",
    flavor: "The working that defines you grows as you do.",
    rules: "<p>Your <strong>signature manifestation</strong> counts as <strong>one tier higher</strong> for all effects (damage, healing, footprint, scale), though its Clarity cost is unchanged. If you have not yet designated a signature manifestation, you may do so when you take this Technique.</p>",
    ft: {}
  }
];

function buildDescription(spec) {
  const flavor = spec.flavor ? `<p><em>${spec.flavor}</em></p>` : "";
  const reqLine = (spec.access && spec.access !== "General")
    ? `<p style="font-size:0.8rem;opacity:0.85;margin:0.5rem 0 0"><strong>Requires:</strong> ${spec.access}</p>` : "";
  const autoLine = spec.autoNote
    ? `<p style="font-size:0.74rem;opacity:0.7;margin:0.5rem 0 0">⚙ ${spec.autoNote}</p>`
    : `<p style="font-size:0.74rem;opacity:0.7;margin:0.5rem 0 0">✍ Applied by the GM/player — no automatic engine effect.</p>`;
  return `<h2>${spec.name}</h2>${flavor}<hr /><h3>Rules</h3>${spec.rules}${reqLine}${autoLine}`;
}

function buildFeatData(spec, identifier, folderId) {
  const ft = foundry.utils.deepClone(spec.ft || {});
  return {
    name: spec.name,
    type: "feat",
    img: spec.img || "icons/magic/symbols/runes-star-blue.webp",
    folder: folderId,
    system: {
      category: "technique",
      identifier,
      source: { custom: SOURCE_TAG, rules: "2024", revision: 1 },
      description: { value: buildDescription(spec), chat: "" },
      requirements: (spec.access && spec.access !== "General") ? spec.access : "",
      type: { value: "feat", subtype: "" },
      prerequisites: { items: [], repeatable: false, level: spec.prereqLevel ?? null },
      properties: []
    },
    flags: {
      "bbttcc": { pack: PACK_FLAG, theme: spec.theme },
      "fourththing": ft
    }
  };
}

(async () => {
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error(`[manifestation-techniques] pack not found: ${PACK_ID}`); return; }

  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });

  try {
    const docs = await pack.getDocuments();

    // Resolve / create the target folder inside the compendium.
    let folder = pack.folders?.find(f => f.name === FOLDER_NAME && f.type === "Item")
              ?? pack.folders?.find(f => f.name === FOLDER_NAME);
    if (!folder && !DRY_RUN) {
      folder = await Folder.create({ name: FOLDER_NAME, type: "Item", color: "#6f4bd8" }, { pack: PACK_ID });
    }
    const folderId = folder?.id ?? null;

    const created = [], updated = [], planned = [];
    for (const spec of SPECS) {
      const identifier = `bbttcc_feat_${spec.slug}`;
      const existing = docs.find(d =>
        d.system?.identifier === identifier ||
        (d.name === spec.name && d.type === "feat"));
      const data = buildFeatData(spec, identifier, folderId);

      if (DRY_RUN) { planned.push(`${existing ? "UPDATE" : "CREATE"}  ${spec.name}  [${spec.access}]  ${spec.autoNote ? "⚙" : "✍"}`); continue; }

      if (existing) {
        await existing.update({
          name: data.name,
          img: data.img,
          folder: folderId,
          "system.category": "technique",
          "system.identifier": identifier,
          "system.source": data.system.source,
          "system.description.value": data.system.description.value,
          "system.requirements": data.system.requirements,
          "system.prerequisites.level": data.system.prerequisites.level,
          "flags.bbttcc": data.flags.bbttcc,
          "flags.fourththing": data.flags.fourththing
        });
        updated.push(spec.name);
      } else {
        await Item.create(data, { pack: PACK_ID });
        created.push(spec.name);
      }
    }

    if (DRY_RUN) {
      console.log("%c[manifestation-techniques] DRY RUN — plan:", "color:#6f4bd8;font-weight:bold");
      planned.forEach(p => console.log("  " + p));
      ui.notifications.info(`[DRY RUN] ${planned.length} Techniques planned — see console (F12). No changes written.`);
    } else {
      const msg = `Manifestation Techniques: ${created.length} created, ${updated.length} updated into "${pack.metadata.label}" › ${FOLDER_NAME}.`;
      console.log("%c[manifestation-techniques] " + msg, "color:#6f4bd8;font-weight:bold");
      if (created.length) console.log("  created: " + created.join(", "));
      if (updated.length) console.log("  updated: " + updated.join(", "));
      ui.notifications.info(msg);
    }
  } finally {
    if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });
  }
})();
