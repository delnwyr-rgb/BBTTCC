// BBTTCC — Refactor NPCs to Unified RFI Schema (2026-05-12)
// ─────────────────────────────────────────────────────────────────────────────
// World-wide NPC sanitizer + canonicalizer. Walks game.actors filtered to
// type:"npc" and, per actor:
//
//   1. STRIPS legacy D&D5e cruft that crept in from pre-fourththing exports:
//        system.abilities (str/dex/con/int/wis/cha)
//        system.attributes.{ac,hp,movement,init,attunement,senses,
//                           spellcasting,exhaustion,concentration,
//                           hd,death,spell,price,loyalty}
//        system.details.{cr,type,alignment,biography,ideal,bond,flaw,
//                        race,habitat,treasure}
//        system.{traits,source,currency,bonuses,tools,spells}
//        system.resources.{legact,legres,lair}     (boss-only fields)
//        system.skills.*                           (D&D skill block; fourththing
//                                                  uses {} per npc template)
//
//   2. ENSURES flags.fourththing.rfi.actor exists with:
//        tier      — from system.tier / details.tier
//        bracket   — heuristic from token width + size + tier
//        archetype — slug of name (preserve if already set)
//        bestiary.{themes, role, lootTable}
//        price     — game.fourththing.pricing.computeBossPricing(...)
//
//   3. (OPT-IN) Rescales integrity to bestiary canon table when current value
//      is obviously stale (heuristic: integrity.max <= 10 OR HP from cruft
//      block is >1.5× integrity.max). Preserves current damage ratio.
//
//   4. REPORTS NPCs with zero offensive items (clean chassis, no items) so
//      the GM can author them by hand. Does NOT auto-stub.
//
// Items on actors are NOT touched. Apex Predator's feat/technique items with
// attack activities pass through intact.
//
// Knobs (set in the dialog or edit defaults below):
//   DRY_RUN              — true: log payloads, post chat report, don't write
//   FORCE_INTEGRITY      — true: rescale ALL actors, not just stale ones
//   SKIP_ALREADY_CLEAN   — true: leave actors with no cruft + rfi flag alone
//
// Idempotent. Safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const pricing = game.fourththing?.pricing;
  if (!pricing) {
    ui.notifications?.error("game.fourththing.pricing unavailable — is rfi-pricing.js loaded?");
    return;
  }

  // ── Canon tables (mirror seed-bestiary.macro.js) ──────────────────────────
  const INTEGRITY = {
    light:  { I: 25, II: 32, III: 39, IV: 46 },
    medium: { I: 40, II: 50, III: 60, IV: 70 },
    heavy:  { I: 60, II: 75, III: 90, IV: 105 }
  };
  const TIER_INT_TO_ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
  const ROMAN_TO_INT      = { I: 1, II: 2, III: 3, IV: 4 };

  // 5E damage type → RFI canon (subset; mirrors translate-5e-npcs.macro.js).
  const DT_FOLD = {
    bludgeoning: "kinetic", piercing: "kinetic", slashing: "kinetic", force: "kinetic",
    fire: "energy", cold: "energy", lightning: "energy", acid: "energy", thunder: "energy",
    radiant: "sephirotic", necrotic: "qliphothic", poison: "poison", psychic: "psychic"
  };
  const foldDt = (t) => DT_FOLD[String(t || "").toLowerCase()] ?? null;

  // 5E condition → RFI condition
  const COND_FOLD = {
    incapacitated: "staggered", frightened: "shaken", paralyzed: "staggered",
    petrified: "staggered", stunned: "staggered", unconscious: "dying",
    grappled: "restrained"
  };
  const foldCond = (c) => COND_FOLD[String(c || "").toLowerCase()] ?? String(c || "").toLowerCase();

  // Cruft paths to delete (path-relative to the actor). Using Foundry's `-=`
  // delete sentinel. Nested deletes preserve sibling keys.
  const CRUFT_PATHS = [
    "system.-=abilities",
    "system.attributes.-=ac",
    "system.attributes.-=hp",
    "system.attributes.-=movement",
    "system.attributes.-=init",
    "system.attributes.-=attunement",
    "system.attributes.-=senses",
    "system.attributes.-=spellcasting",
    "system.attributes.-=exhaustion",
    "system.attributes.-=concentration",
    "system.attributes.-=loyalty",
    "system.attributes.-=hd",
    "system.attributes.-=death",
    "system.attributes.-=spell",
    "system.attributes.-=price",
    "system.details.-=cr",
    "system.details.-=type",
    "system.details.-=alignment",
    "system.details.-=biography",
    "system.details.-=ideal",
    "system.details.-=bond",
    "system.details.-=flaw",
    "system.details.-=race",
    "system.details.-=habitat",
    "system.details.-=treasure",
    "system.-=traits",
    "system.-=source",
    "system.-=currency",
    "system.-=bonuses",
    "system.-=tools",
    "system.-=spells",
    "system.resources.-=legact",
    "system.resources.-=legres",
    "system.resources.-=lair"
  ];

  // ── Heuristics ────────────────────────────────────────────────────────────
  const slug = (s) => String(s || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  function inferTier(actor) {
    const sys = actor.system;
    const t = Number(sys?.tier ?? sys?.details?.tier);
    if (t >= 1 && t <= 4) return t;
    const cr = Number(sys?.details?.cr);
    if (Number.isFinite(cr)) {
      if (cr <= 1)  return 1;
      if (cr <= 4)  return 2;
      if (cr <= 10) return 3;
      return 4;
    }
    return 1;
  }

  function inferBracket(actor) {
    const existing = actor.flags?.fourththing?.rfi?.actor?.bracket;
    if (existing && INTEGRITY[existing]) return existing;
    const w = Number(actor.prototypeToken?.width ?? 1);
    const sz = String(actor.system?.traits?.size ?? "").toLowerCase();
    if (w >= 3 || sz === "grg" || sz === "huge") return "heavy";
    if (w >= 2 || sz === "lg")  return "medium";
    return "light";
  }

  function inferRole(actor) {
    const existing = String(actor.system?.role || "").trim();
    if (existing) {
      // Normalize a few common 5E-port role strings to bestiary canon
      const k = existing.toLowerCase();
      if (/brute|warrior|berserker|fighter|champion/.test(k))   return "brute";
      if (/caster|mage|witch|priest|adept|warlock|cleric/.test(k)) return "caster";
      if (/stealth|rogue|spy|stalker|assassin|skirmisher/.test(k)) return "stealth";
      if (/scout|ranger|tracker/.test(k))                       return "scout";
      if (/hardened|sentinel|guard|warden|knight/.test(k))      return "hardened";
      return existing; // keep custom label if non-empty
    }
    // Attribute-based fallback
    const a = actor.system?.attributes || {};
    const v = Number(a.violence?.value ?? 0);
    const i = Number(a.intrigue?.value ?? 0);
    const s = Number(a.soul?.value ?? 0);
    const b = Number(a.body?.value ?? 0);
    if (s >= 4)              return "caster";
    if (i >= 4 && v < i)     return "stealth";
    if (b >= 4 && v <= b)    return "hardened";
    return "brute";
  }

  function inferThemes(actor) {
    const existing = actor.flags?.fourththing?.rfi?.actor?.bestiary?.themes;
    if (Array.isArray(existing) && existing.length) return existing;
    const themes = new Set();
    const type5e = String(actor.system?.details?.type?.value || "").toLowerCase().trim();
    if (type5e) themes.add(type5e);
    const name = actor.name.toLowerCase();
    for (const [pat, theme] of [
      [/hex|witch|cursed/, "hex-touched"],
      [/witness/, "witness"],
      [/sept|prayer|priest|acolyte/, "sept"],
      [/raider|marauder|bandit/, "raider"],
      [/pre-?fall|relic|drone|sentinel|construct/, "pre-fall"],
      [/cult/, "cultist"],
      [/oath|vow|bound|thrall/, "oath-bound"],
      [/wolf|hawk|bear|cat|beast|stalker|stray|skitter|reaper/, "wildlife"],
      [/legend|avatar|apex|warlord|apotheon/, "legendary"]
    ]) if (pat.test(name)) themes.add(theme);
    return [...themes];
  }

  function inferCurrency(actor, role) {
    const existing = actor.flags?.fourththing?.rfi?.actor?.price?.currency;
    if (existing) return existing;
    if (role === "stealth" || role === "scout")  return "intrigue";
    if (role === "caster")                       return "softpower";
    if (role === "hardened")                     return "violence";
    return "violence";
  }

  // ── Per-actor refactor planner ────────────────────────────────────────────
  function planRefactor(actor, { forceIntegrity }) {
    const sys = actor.system || {};
    const cruftHits = [];

    // Detect each cruft path that's actually present (skip deletes for paths
    // that don't exist — keeps the update payload tight and idempotent).
    const has = (obj, path) => {
      const parts = path.replace(/-=/, "").split(".").slice(1); // drop "system."
      let cur = obj;
      for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
        else return false;
      }
      return true;
    };
    const deletes = {};
    for (const path of CRUFT_PATHS) {
      // Convert "system.X.-=Y" → check if sys.X.Y exists
      const ok = (() => {
        const m = path.match(/^system(?:\.([^=]+))?\.-=([\w$]+)$/);
        if (!m) return false;
        const subPath = m[1] ? m[1].replace(/\.$/, "") : "";
        const leaf = m[2];
        let cur = sys;
        if (subPath) {
          for (const p of subPath.split(".")) {
            if (cur && typeof cur === "object" && p in cur) cur = cur[p];
            else return false;
          }
        }
        return cur && typeof cur === "object" && leaf in cur;
      })();
      if (ok) {
        deletes[path] = null;
        cruftHits.push(path.replace(/^system\./, "").replace("-=", ""));
      }
    }

    // Skills: collapse to {} if any non-empty keys present
    const skillKeys = Object.keys(sys.skills || {});
    const skillsReset = skillKeys.length > 0;

    // rfi.actor flag block (build current view + target view)
    const cur = actor.flags?.fourththing?.rfi?.actor ?? {};
    const tierInt = inferTier(actor);
    const tier    = TIER_INT_TO_ROMAN[tierInt] ?? "I";
    const bracket = inferBracket(actor);
    const role    = inferRole(actor);
    const themes  = inferThemes(actor);
    const currency = inferCurrency(actor, role);
    const archetype = cur.archetype || slug(actor.name);
    const prices  = pricing.computeBossPricing({ tier, bracket });
    const lootTable = Array.isArray(cur.bestiary?.lootTable) ? cur.bestiary.lootTable : [];

    const targetRfi = {
      tier,
      bracket,
      archetype,
      bestiary: { themes, role, lootTable },
      price: {
        marks:        cur.price?.marks      ?? prices.bounty,
        bounty:       cur.price?.bounty     ?? prices.bounty,
        hire:         cur.price?.hire       ?? prices.hire,
        ransom:       cur.price?.ransom     ?? prices.ransom,
        currency:     cur.price?.currency   ?? currency,
        gmOverride:   cur.price?.gmOverride ?? false,
        notes:        cur.price?.notes      ?? `T${tier} ${bracket} ${role} (bestiary) — bounty ${prices.bounty} / hire ${prices.hire} / ransom ${prices.ransom} marks (paid in ${currency})`
      }
    };
    const rfiMissing = !cur || !cur.tier || !cur.bracket || !cur.price?.marks;

    // Integrity rescale decision
    const oldMax = Number(sys.derived?.integrity?.max ?? 0);
    const oldVal = Number(sys.derived?.integrity?.value ?? oldMax);
    const hpFromCruft = Number(sys?.attributes?.hp?.max ?? 0);
    const canonMax = INTEGRITY[bracket]?.[tier] ?? oldMax;
    const stale = oldMax <= 10 || hpFromCruft > oldMax * 1.5;
    const willRescale = forceIntegrity || (stale && canonMax !== oldMax);
    let newIntegrity = null;
    if (willRescale) {
      const ratio = oldMax > 0 ? Math.max(0, Math.min(1, oldVal / oldMax)) : 1;
      const newVal = Math.max(0, Math.round(canonMax * ratio));
      const newStressMax = Math.max(5, Math.floor(canonMax / 2));
      const oldStressMax = Number(sys.derived?.stress?.max ?? 0);
      const stressRatio = oldStressMax > 0
        ? Math.max(0, Math.min(1, Number(sys.derived?.stress?.value ?? oldStressMax) / oldStressMax))
        : 1;
      newIntegrity = {
        old: { value: oldVal, max: oldMax },
        new: { value: newVal, max: canonMax, stressMax: newStressMax, stressVal: Math.round(newStressMax * stressRatio) }
      };
    }

    // Defenses: fold any lingering 5E damage types in resistances/immunities/vuln
    const foldDefenseList = (arr) => {
      if (!Array.isArray(arr)) return null;
      const out = new Set();
      let changed = false;
      for (const e of arr) {
        const raw = typeof e === "string" ? e : (e?.type ?? "");
        const folded = foldDt(raw);
        if (folded && folded !== raw) { out.add(folded); changed = true; }
        else if (raw) out.add(String(raw).toLowerCase());
      }
      return changed ? [...out] : null;
    };
    const defR = foldDefenseList(sys.defenses?.resistances);
    const defI = foldDefenseList(sys.defenses?.immunities);
    const defV = foldDefenseList(sys.defenses?.vulnerabilities);
    const ciFold = (() => {
      const arr = sys.conditionImmunities || [];
      if (!Array.isArray(arr) || !arr.length) return null;
      const out = arr.map(foldCond);
      return out.some((v, i) => v !== arr[i]) ? out : null;
    })();

    // Empty-items detection (report only)
    const items = actor.items?.contents ?? actor.items ?? [];
    const offensive = items.filter(i => {
      const t = i.type;
      if (t === "weapon") return true;
      if (t === "feat" || t === "feature") {
        const acts = i.system?.activities || {};
        return Object.values(acts).some(a => a?.type === "attack");
      }
      return false;
    });
    const emptyItems = offensive.length === 0;

    // Assemble update payload
    const update = { ...deletes };
    if (skillsReset) update["system.skills"] = {};
    if (defR) update["system.defenses.resistances"]     = defR;
    if (defI) update["system.defenses.immunities"]      = defI;
    if (defV) update["system.defenses.vulnerabilities"] = defV;
    if (ciFold) update["system.conditionImmunities"]    = ciFold;
    if (rfiMissing) update["flags.fourththing.rfi.actor"] = targetRfi;
    if (newIntegrity) {
      update["system.derived.integrity.value"] = newIntegrity.new.value;
      update["system.derived.integrity.max"]   = newIntegrity.new.max;
      update["system.derived.stress.max"]      = newIntegrity.new.stressMax;
      update["system.derived.stress.value"]    = newIntegrity.new.stressVal;
    }
    // Backfill system.tier / system.details.tier / system.details.level if absent
    if (!Number.isFinite(Number(sys.tier)) || !sys.tier) update["system.tier"] = tierInt;
    if (!Number.isFinite(Number(sys.details?.tier)))  update["system.details.tier"]  = tierInt;
    if (!Number.isFinite(Number(sys.details?.level))) update["system.details.level"] = tierInt;

    const noop = Object.keys(update).length === 0;
    const group = emptyItems
      ? (cruftHits.length || rfiMissing || willRescale ? "B-cruft-empty" : "B-clean-empty")
      : (cruftHits.length ? "A-cruft" : (rfiMissing || willRescale ? "C-needs-flag" : "Z-clean"));

    return {
      actor, update, noop, group,
      diff: {
        cruftHits, skillsReset,
        defenseFold: { R: !!defR, I: !!defI, V: !!defV, CI: !!ciFold },
        rfiMissing, newIntegrity, emptyItems,
        targetRfi
      }
    };
  }

  // ── Dialog (DialogV2) ─────────────────────────────────────────────────────
  const html = `
    <div style="display:flex;flex-direction:column;gap:.5rem;font-size:.9em;">
      <p><strong>Refactor NPCs to unified RFI schema.</strong></p>
      <p style="opacity:.8;">Walks every <code>type:"npc"</code> actor, strips D&amp;D5e cruft,
        backfills <code>flags.fourththing.rfi.actor</code>, and (opt-in) rescales integrity
        to the bestiary canon table. Items are not modified.</p>
      <label><input type="checkbox" name="rfx-dry" checked/> <strong>Dry run</strong> (preview only — chat card + console, no writes)</label>
      <label><input type="checkbox" name="rfx-force-int"/> Force integrity rescale on every actor (not just stale ones)</label>
      <label><input type="checkbox" name="rfx-skip-clean" checked/> Skip actors already canonical (no cruft + rfi flag present)</label>
      <hr/>
      <p style="opacity:.7;">Report groups: <b>A</b>=cruft to strip · <b>B</b>=empty items (manual authoring needed) · <b>C</b>=flag missing only · <b>Z</b>=already canonical</p>
    </div>`;

  const opts = await foundry.applications.api.DialogV2.wait({
    window: { title: "Refactor NPCs → Unified RFI Schema" },
    content: html,
    buttons: [
      {
        action: "run",
        label: "Run",
        icon: "fas fa-cog",
        default: true,
        callback: (event, button, dialog) => {
          const root = dialog.element;
          return {
            DRY_RUN:            !!root.querySelector('[name="rfx-dry"]')?.checked,
            FORCE_INTEGRITY:    !!root.querySelector('[name="rfx-force-int"]')?.checked,
            SKIP_ALREADY_CLEAN: !!root.querySelector('[name="rfx-skip-clean"]')?.checked
          };
        }
      },
      { action: "cancel", label: "Cancel", icon: "fas fa-times" }
    ],
    rejectClose: false
  });

  if (!opts || opts === "cancel") return;
  const { DRY_RUN, FORCE_INTEGRITY, SKIP_ALREADY_CLEAN } = opts;

  const npcs = game.actors.filter(a => a.type === "npc");
  const plans = npcs.map(a => planRefactor(a, { forceIntegrity: FORCE_INTEGRITY }));

  const buckets = { "A-cruft": [], "B-cruft-empty": [], "B-clean-empty": [], "C-needs-flag": [], "Z-clean": [] };
  for (const p of plans) buckets[p.group].push(p);

  console.groupCollapsed(`[refactor-npcs] ${DRY_RUN ? "DRY-RUN" : "WET-RUN"} — ${plans.length} NPC(s)`);
  console.table(plans.map(p => ({
    name:        p.actor.name,
    group:       p.group,
    cruftKeys:   p.diff.cruftHits.length,
    skillsReset: p.diff.skillsReset,
    rfiMissing:  p.diff.rfiMissing,
    integrity:   p.diff.newIntegrity
      ? `${p.diff.newIntegrity.old.value}/${p.diff.newIntegrity.old.max} → ${p.diff.newIntegrity.new.value}/${p.diff.newIntegrity.new.max}`
      : "—",
    tier:        p.diff.targetRfi.tier,
    bracket:     p.diff.targetRfi.bracket,
    role:        p.diff.targetRfi.bestiary.role,
    emptyItems:  p.diff.emptyItems
  })));
  console.groupEnd();

  const toCommit = plans.filter(p => {
    if (p.noop) return false;
    if (SKIP_ALREADY_CLEAN && p.group === "Z-clean") return false;
    return true;
  });

  if (!DRY_RUN && toCommit.length) {
    const updates = toCommit.map(p => ({ _id: p.actor.id, ...p.update }));
    await Actor.updateDocuments(updates);
    console.log(`[refactor-npcs] committed ${toCommit.length} update(s)`);
  }

  // ── Chat report card ────────────────────────────────────────────────────
  const fmtGroup = (label, list) => `
    <details ${list.length ? "open" : ""} style="margin:.25rem 0;">
      <summary><strong>${label}</strong> — ${list.length}</summary>
      ${list.length ? `<ul style="margin:.25rem 0 .25rem 1rem;padding:0;">${list.map(p => `
        <li style="margin:.15rem 0;">
          <code>${p.actor.name}</code>
          ${p.diff.cruftHits.length ? `<span style="opacity:.7;"> · strip ${p.diff.cruftHits.length} key${p.diff.cruftHits.length===1?"":"s"}</span>` : ""}
          ${p.diff.skillsReset ? `<span style="opacity:.7;"> · reset skills</span>` : ""}
          ${p.diff.rfiMissing  ? `<span style="opacity:.7;"> · add rfi.actor</span>` : ""}
          ${p.diff.newIntegrity ? `<span style="opacity:.7;"> · integ ${p.diff.newIntegrity.old.max}→${p.diff.newIntegrity.new.max}</span>` : ""}
          ${p.diff.emptyItems  ? `<span style="color:#c93;"> · ⚠ no items</span>` : ""}
          <span style="opacity:.55;"> [T${p.diff.targetRfi.tier} ${p.diff.targetRfi.bracket} ${p.diff.targetRfi.bestiary.role}]</span>
        </li>`).join("")}</ul>` : ""}
    </details>`;

  const card = `
    <section>
      <header><strong>NPC Refactor — ${DRY_RUN ? "DRY-RUN" : "COMMITTED"}</strong></header>
      <p style="opacity:.85;">${plans.length} NPC(s) scanned · ${toCommit.length} ${DRY_RUN ? "would update" : "updated"}</p>
      ${fmtGroup("A · cruft to strip",        buckets["A-cruft"])}
      ${fmtGroup("B · cruft + empty items",   buckets["B-cruft-empty"])}
      ${fmtGroup("B · clean but empty items", buckets["B-clean-empty"])}
      ${fmtGroup("C · flag missing only",     buckets["C-needs-flag"])}
      ${fmtGroup("Z · already canonical",     buckets["Z-clean"])}
      <p style="opacity:.7;font-size:.85em;margin-top:.5rem;">
        ⚠ = no offensive items detected (weapon / feat-with-attack-activity). Author by hand.
      </p>
    </section>`;
  ChatMessage.create({ content: card, whisper: [game.user.id] });
  ui.notifications.info(`${DRY_RUN ? "DRY-RUN: would update" : "Updated"} ${toCommit.length} NPC(s). See chat + console for details.`);
})();
