// translate-5e-npcs.macro.js — Roll for Initiation
// One-shot translator: 5E (dnd5e) NPC actor exports → RFI (fourththing) NPC
// actors written to the `bbttcc-master-content.npcs` compendium.
//
// Run as a Foundry script macro (in V14, wrap the body in an IIFE — see
// feedback_foundry_v14_macro_scope). A Dialog opens with a multi-file picker;
// pick every fvtt-Actor-*.json from /Users/gamingaccount/Downloads/5E NPCs and
// click Translate. Originals on disk are not modified. The macro creates new
// Actor docs in the pack — re-running on the same files will create duplicates,
// so delete prior runs first if you re-translate.
//
// Mappings:
//   abilities    → attributes (str→violence, dex→intrigue, con→body,
//                  int→mind, wis→soul, cha→presence) via floor((score-10)/2)+2
//   hp           → derived.integrity (val/max preserved)
//                  derived.stress.max = max(5, ceil(integrity_max / 2))
//   ac           → derived.guard, evasion = guard, resolve = 8 + soulValue
//   cr           → tier (≤1 → I, ≤4 → II, ≤10 → III, > 10 → IV)
//   di/dr/dv/ci  → defenses + conditionImmunities (5E damage types folded
//                  per RFI canon: kinetic/energy/sephirotic/qliphothic)
//   feat-typed items with an `attack` activity → RFI weapon items with a
//                  damage formula and the first damage type folded
//   other feat items → RFI feat items with description run through ftTranslate
//   biography text → notes (ftTranslate-scrubbed)
//
// Author: BBTTCC team — 2026-05-02

(async () => {
  const PACK_ID = "bbttcc-master-content.npcs";
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    return ui.notifications.error(`Compendium not found: ${PACK_ID}`);
  }

  // Pull the system's translation helpers. ftTranslate is the canonical text
  // scrubber; STAT_TO_FT and the term map back-stop everything else.
  let ftTranslate, STAT_TO_FT;
  try {
    const mod = await import("/systems/fourththing/ft-translation.js");
    ftTranslate = mod.ftTranslate;
    STAT_TO_FT  = mod.STAT_TO_FT;
  } catch (err) {
    return ui.notifications.error("Could not load ft-translation.js — is the fourththing system active? See console.");
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scoreToAttr = (s) => Math.max(0, Math.min(10, Math.floor(((Number(s) || 10) - 10) / 2) + 2));
  const crToTier    = (cr) => { const n = Number(cr) || 0; return n <= 1 ? 1 : n <= 4 ? 2 : n <= 10 ? 3 : 4; };

  // 5E damage type → RFI canon. Mirrors the fold rules in ft-translation.js.
  const DT_FOLD = {
    bludgeoning: "kinetic", piercing: "kinetic", slashing: "kinetic", force: "kinetic",
    fire: "energy", cold: "energy", lightning: "energy", acid: "energy", thunder: "energy",
    radiant: "sephirotic",
    necrotic: "qliphothic",
    poison: "poison",
    psychic: "psychic"
  };
  const foldDt = (t) => DT_FOLD[String(t || "").toLowerCase()] ?? "kinetic";

  // 5E condition → RFI condition (subset; anything else stays as-is).
  const COND_FOLD = {
    incapacitated: "staggered",
    frightened:    "shaken",
    paralyzed:     "staggered",
    petrified:     "staggered",
    stunned:       "staggered",
    unconscious:   "dying",
    grappled:      "restrained"
  };
  const foldCond = (c) => COND_FOLD[String(c || "").toLowerCase()] ?? String(c || "").toLowerCase();

  // 5E `traits.di/dr/dv` arrays of strings → defense entries `{ type }` with
  // their RFI fold. De-dupes the result so the engine doesn't carry parallel
  // entries for "fire" + "cold" (both → energy).
  const foldDefList = (arr) => {
    const out = new Set();
    for (const t of (arr ?? [])) out.add(foldDt(t));
    return [...out].map(type => ({ type }));
  };

  // Pick the FIRST damage part from a 5E activity and synthesize a damage
  // formula like "1d8+3". Bonus may be missing, in which case we just use NdX.
  const pickDamage = (activity) => {
    const part = activity?.damage?.parts?.[0];
    if (!part) return { formula: "", type: "kinetic" };
    const num   = Number(part.number ?? 1) || 1;
    const denom = Number(part.denomination ?? 6) || 6;
    const bonus = Number(part.bonus ?? 0) || 0;
    const formula = bonus ? `${num}d${denom}+${bonus}` : `${num}d${denom}`;
    const type    = foldDt(part.types?.[0]);
    return { formula, type };
  };

  // 5E feat with an attack-typed activity → RFI weapon item. Falls back to a
  // plain RFI feat-shaped item (`type: "feature"`) when there's no activity
  // (i.e., a passive trait like "Poor Discipline").
  const translateItem = (it) => {
    const desc5e = it?.system?.description?.value ?? "";
    const desc   = ftTranslate ? ftTranslate(desc5e) : desc5e;
    const activity = Object.values(it?.system?.activities ?? {})[0];
    const isAttack = activity?.type === "attack";
    if (isAttack) {
      const dmg = pickDamage(activity);
      const isRanged = String(activity.attack?.type?.value ?? "").toLowerCase() === "ranged";
      const range = activity.range?.special || activity.range?.value || (isRanged ? "30" : "5");
      const skill = isRanged ? "firearms" : "melee";
      return {
        name: it.name,
        type: "weapon",
        img:  it.img || "icons/svg/sword.svg",
        system: {
          category: isRanged ? "ranged" : "melee",
          intent:   "violence",
          skill,
          damage:   { formula: dmg.formula, attribute: "violence", type: dmg.type, track: "integrity" },
          range:    { short: 1, long: 1 },
          tags:     ["translated", "5e-port"],
          effect:   desc,
          flavor:   ""
        }
      };
    }
    return {
      name: it.name,
      type: "feature",
      img:  it.img || "icons/svg/aura.svg",
      system: {
        description: { value: desc },
        tags: ["translated", "5e-port"]
      }
    };
  };

  // ── Per-NPC translation ────────────────────────────────────────────────────
  const translateActor = (raw) => {
    const ab    = raw?.system?.abilities ?? {};
    const score = (k) => ab?.[k]?.value ?? 10;
    const attributes = {
      violence: { value: scoreToAttr(score("str")) },
      intrigue: { value: scoreToAttr(score("dex")) },
      body:     { value: scoreToAttr(score("con")) },
      mind:     { value: scoreToAttr(score("int")) },
      soul:     { value: scoreToAttr(score("wis")) },
      presence: { value: scoreToAttr(score("cha")) }
    };

    const hp     = raw?.system?.attributes?.hp ?? {};
    const intMax = Number(hp.max ?? hp.value ?? 10) || 10;
    const intVal = Number(hp.value ?? intMax) || intMax;
    const stressMax = Math.max(5, Math.ceil(intMax / 2));

    const ac    = raw?.system?.attributes?.ac ?? {};
    const acVal = Number(ac.value ?? ac.flat ?? 11) || 11;
    const soulVal = attributes.soul.value;

    const cr   = raw?.system?.details?.cr ?? 0;
    const tier = crToTier(cr);

    const traits = raw?.system?.traits ?? {};
    const defenses = {
      resistances:    foldDefList(traits.dr?.value),
      immunities:     foldDefList(traits.di?.value),
      vulnerabilities:foldDefList(traits.dv?.value)
    };
    const condImmunities = (traits.ci?.value ?? []).map(foldCond);

    const bio  = raw?.system?.details?.biography?.value ?? "";
    const notes = ftTranslate ? ftTranslate(bio) : bio;

    const items = (raw?.items ?? []).map(translateItem);

    // Role label: derive from creature type + "elite" if CR is high. Players
    // can re-author after import.
    const ctype = String(raw?.system?.details?.type?.value ?? "").trim();
    const role  = (cr >= 5 ? "Elite " : "") + (ctype ? ctype.replace(/^./, s => s.toUpperCase()) : "Combatant");

    // Tags — keep useful 5E provenance markers so a future audit pass can find
    // ports easily.
    const tags = ["5e-port", `cr-${cr}`].concat(Array.isArray(traits.languages?.value) ? traits.languages.value : []);

    return {
      name: raw.name,
      type: "npc",
      img:  raw.img || "icons/svg/mystery-man.svg",
      system: {
        role,
        tier,
        factionId: "",
        notes,
        attributes,
        skills: {},
        derived: {
          integrity: { value: intVal,    max: intMax },
          stress:    { value: stressMax, max: stressMax },
          guard:     { value: acVal },
          evasion:   { value: acVal },
          resolve:   { value: 8 + soulVal }
        },
        magic: {
          clarity: { value: 2, max: 5 },
          noise:   { value: 0, max: 10 },
          sephirah:"malkuth"
        },
        conditions: {
          staggered:false, scarred:false, calmed:false, blinded:false, prone:false,
          shaken:false, burning:false, restrained:false, charmed:false, compelled:false, dying:false
        },
        actions: { actionUsed:false, bonusUsed:false, reactionUsed:false },
        defenses,
        conditionImmunities: condImmunities,
        tags,
        radiation: { rp: 0, thresholds: { minor: 25, major: 50, severe: 75 } },
        darkness:  { value: 0, taint: 0, fragments: [] }
      },
      items,
      effects: [],
      ownership: { default: 0 }
    };
  };

  // ── File picker UI ─────────────────────────────────────────────────────────
  const html = `
    <div style="display:flex;flex-direction:column;gap:.5rem;">
      <p>Pick all <code>fvtt-Actor-*.json</code> files exported from your 5E world.<br/>
         New RFI NPC actors will be created in <code>${PACK_ID}</code>.</p>
      <input type="file" id="ft5e-files" multiple accept="application/json,.json"/>
      <label><input type="checkbox" id="ft5e-skip-empty" checked/> Skip the empty schema-template export (name=="Actor", no items)</label>
      <div id="ft5e-status" style="font-size:.85em;opacity:.85;"></div>
    </div>`;

  await new Promise((resolve) => {
    new Dialog({
      title: "Translate 5E NPCs → RFI",
      content: html,
      buttons: {
        translate: {
          icon: '<i class="fas fa-cog"></i>',
          label: "Translate",
          callback: async (dlgHtml) => {
            const root  = dlgHtml instanceof HTMLElement ? dlgHtml : dlgHtml[0];
            const input = root.querySelector("#ft5e-files");
            const skipEmpty = !!root.querySelector("#ft5e-skip-empty")?.checked;
            const files = Array.from(input?.files ?? []);
            if (!files.length) {
              ui.notifications.warn("No files selected.");
              return resolve();
            }
            const created = [];
            const skipped = [];
            for (const f of files) {
              try {
                const txt = await f.text();
                const raw = JSON.parse(txt);
                if (skipEmpty && (!raw.name || raw.name === "Actor") && (!raw.items?.length)) {
                  skipped.push(`${f.name} (empty schema)`); continue;
                }
                if (raw.type !== "npc") {
                  skipped.push(`${f.name} (type=${raw.type})`); continue;
                }
                const npc = translateActor(raw);
                const doc = await Actor.create(npc, { pack: PACK_ID });
                created.push(doc?.name ?? raw.name);
              } catch (err) {
                console.error(`[ft-5e-translate] ${f.name} failed:`, err);
                skipped.push(`${f.name} (${err.message})`);
              }
            }
            ui.notifications.info(`Translated ${created.length} NPC(s) into ${PACK_ID}. Skipped ${skipped.length}.`);
            console.log("[ft-5e-translate] created:", created);
            if (skipped.length) console.warn("[ft-5e-translate] skipped:", skipped);
            resolve();
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve() }
      },
      default: "translate"
    }, { width: 520 }).render(true);
  });
})();
