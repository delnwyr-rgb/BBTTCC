// Bad Eden — Scrub old D&D vernacular across ALL compendiums (Items + Actors)
// ─────────────────────────────────────────────────────────────────────────────
// Sweeps every Item and Actor compendium (+ world), rewriting dnd5e vocab (gp, hit
// points, AC, spells, long rest, fire/cold/necrotic damage, ability scores, ad/dis-
// advantage, saving throws, d20, proficiency/CR, distances→squares) into Bad Eden
// terms. Covers item descriptions (system.description + rfi.lore + legacySystem),
// ACTOR biographies, and items EMBEDDED on actors (NPC weapons/feats). "Species" /
// ancestries are Item subtypes, so they're swept too.
//
// SURVEY-FIRST — DRY_RUN = true writes nothing; it builds a "🧹 D&D Vernacular Scrub
// — Report" journal with a per-compendium summary + every rewrite + judgment-call
// flags. Review it, then flip DRY_RUN = false to APPLY. Idempotent; advantage/save
// are context-aware (won't touch names/idioms). Run on BOTH worlds.
// ─────────────────────────────────────────────────────────────────────────────

const SCAN_ALL_PACKS = true;       // true = every Item + Actor compendium; false = only PACK_ID
const PACK_TYPES = ["Item", "Actor"];
const PACK_ID = "bbttcc-master-content.items"; // used only when SCAN_ALL_PACKS = false
const DRY_RUN = false;              // SURVEY first; flip to false to APPLY
const INCLUDE_WORLD = true;        // also world Items + Actors
const INCLUDE_EMBEDDED_ITEMS = true; // also scrub items embedded on actors (NPC kit)
const SCRUB_NAMES = true;          // also normalize "(Recharge 5–6)" out of document names
const FT_PER_SQUARE = 5;          // battlemap squares, steward token scale (5 ft/square).
                                  // Vehicle scale = 20 ft/square; those docs are FLAGGED for review.
                                  // (Hexes are world-map only = 5 miles, so never used for ranges.)
const VEHICLE_HINT = /\b(module|ramming|pulsar|hauler|autocannon|mortar|battery|tower|turret|chassis|rig|vehicle)\b/i;

const ITEM_FIELDS = [
  "system.description.value",
  "flags.fourththing.rfi.item.lore",
  "flags.fourththing.rfi.item.legacySystem.description.value",
];
const ACTOR_FIELDS = [
  "system.description.value",
  "system.details.biography.value",
  "system.details.biography.public",
  "system.biography.value",
  "system.notes.value",
  "flags.fourththing.rfi.item.legacySystem.description.value",
];

// High-confidence rewrites. Case of the first letter is preserved.
const SWAPS = [
  // NOTE: advantage/disadvantage AND saving throws are handled context-sensitively in
  // scrub() — NOT here — so feature names ("Shadow Advantage") and English idioms
  // ("save for" = except, "save them" = rescue) are never mangled.
  // ability scores → faculties: Str→Violence, Dex→Intrigue, Con→Body, Int→Mind, Wis→Soul, Cha→Presence
  [/\bStrength\b/g, "Violence"], [/\bDexterity\b/g, "Intrigue"], [/\bConstitution\b/g, "Body"],
  [/\bIntelligence\b/g, "Mind"], [/\bWisdom\b/g, "Soul"], [/\bCharisma\b/g, "Presence"],
  [/\bSTR\b/g, "Violence"], [/\bDEX\b/g, "Intrigue"], [/\bCON\b/g, "Body"],
  [/\bINT\b/g, "Mind"], [/\bWIS\b/g, "Soul"], [/\bCHA\b/g, "Presence"],
  [/\bStr\b/g, "Violence"], [/\bDex\b/g, "Intrigue"], [/\bCon\b/g, "Body"],
  [/\bInt\b/g, "Mind"], [/\bWis\b/g, "Soul"], [/\bCha\b/g, "Presence"],
  // ability check → check (saving throws & "<faculty> save(s)" handled in scrub())
  [/\bability checks\b/gi, "checks"], [/\bability check\b/gi, "check"],
  // dice + tier: d20 → 2d10x10; challenge rating / CR → tier  (proficiency is context-
  // dependent, handled in scrub(); initiative left as-is)
  [/\b1?d20\b/gi, "2d10x10"],
  [/\bchallenge rating\b/gi, "tier"], [/\bCR\b/g, "tier"],
  // currency
  [/\bgold pieces?\b/gi, "marks"], [/\bsilver pieces?\b/gi, "marks"], [/\bcopper pieces?\b/gi, "marks"],
  [/\bgp\b/gi, "marks"], [/\bsp\b/gi, "marks"], [/\bcp\b/gi, "marks"],
  // resources / defenses
  [/\bhit points?\b/gi, "Integrity"], [/\bHP\b/g, "Integrity"],
  [/\barmou?r class\b/gi, "Guard"], [/\bAC\b/g, "Guard"],
  // magic
  [/\bspellcasting\b/gi, "manifesting"], [/\bspellcaster\b/gi, "manifester"],
  [/\bspells\b/gi, "manifestations"], [/\bspell\b/gi, "manifestation"],
  // rest / recharge cadence
  [/\b(?:long|short)\s+rests?\b/gi, "Soma Break"], [/\bper\s+rest\b/gi, "per Soma Break"],
  [/\bonce\s*\/\s*day\b/gi, "once per Soma Break"], [/\b1\s*\/\s*day\b/gi, "1 per Soma Break"],
  [/\bonce\s+per\s+day\b/gi, "once per Soma Break"], [/\bper\s+day\b/gi, "per Soma Break"],
  [/\brecharge\s*\d\s*[-–—]\s*\d\b/gi, "recharges on a Soma Break"], [/\brecharge\s*\d\+/gi, "recharges on a Soma Break"],
  // dnd damage types → Bad Eden (only the "<type> damage" form, to stay safe)
  [/\bfire damage\b/gi, "thermal damage"], [/\bcold damage\b/gi, "thermal damage"],
  [/\blightning damage\b/gi, "electrical damage"], [/\bthunder damage\b/gi, "electrical damage"],
  [/\bacid damage\b/gi, "chemical damage"], [/\bnecrotic damage\b/gi, "qliphothic damage"],
  [/\bradiant damage\b/gi, "sephirotic damage"], [/\bforce damage\b/gi, "kinetic damage"],
  [/\bslashing damage\b/gi, "kinetic damage"], [/\bpiercing damage\b/gi, "kinetic damage"],
  [/\bbludgeoning damage\b/gi, "kinetic damage"], [/\bnecrotic\b/gi, "qliphothic"],
  // leftover stub markers + grammar bobbles from the port
  [/\s*\[TODO[^\]]*\]/gi, ""], [/\bonce per a Soma Break\b/gi, "once per Soma Break"],
  [/\bper a Soma Break\b/gi, "per Soma Break"],
];

// Judgment-call terms — DETECTED and reported, never auto-changed (no mapping given yet).
const FLAGS = [
  [/\bgold\b(?!\s*pieces?)/gi, "gold (bare — substance name or currency?)"],
  [/\bcantrips?\b/gi, "cantrip (no Bad Eden mapping given)"],
  [/\bspell slots?\b/gi, "spell slot (no mapping given)"],
  [/\bhit dice\b/gi, "hit dice (no mapping given)"],
  [/(?:\d+d\d+\s+energy|energy\s+damage|energy\s*\()/i, "retired 'energy' damage — assign electrical / thermal / chemical"],
  [/\(([^)]+)\)\s*\((?!\1)[^)]+\)/g, "mismatched double skill-tag — e.g. (Violence) (Body)"],
];

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const targetPacks = SCAN_ALL_PACKS
    ? game.packs.filter(p => PACK_TYPES.includes(p.metadata.type))
    : [game.packs.get(PACK_ID)].filter(Boolean);
  if (!targetPacks.length) return ui.notifications?.error("No target packs found.");
  const getP = foundry.utils.getProperty, esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const preserveCase = (m, repl) => /^[A-Z]/.test(m) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
  const ADV = "reroll the lowest die", DIS = "roll 3d10 keep lowest 2";
  const ADV_VERB = /\b(?:have|has|had|gain|gains|gaining|grant|grants|granting|give|gives|giving|impose|imposes)\s+(dis)?advantage\b/gi;
  const ADV_PREP = /\b(dis)?advantage\b(?=\s+(?:on|to|against|vs\.?|in|when|while|for)\b)/gi;
  const VERB_DROP = /\b(?:have|has|had|gain|gains|gaining|grant|grants|granting|give|gives|giving)\s+(?=(?:reroll the lowest die|roll 3d10 keep lowest 2)\b)/gi;
  const FACULTY = /\b(Violence|Intrigue|Presence|Body|Mind|Soul)\s+saves?\b/g;
  // D&D skill → Bad Eden faculty, to resolve mismatched double skill-tags like
  // "Athletics (Violence) (Body)" — keep the faculty that matches the skill, drop the other.
  const SKILL_FACULTY = {
    athletics: "Violence",
    acrobatics: "Intrigue", "sleight of hand": "Intrigue", stealth: "Intrigue",
    arcana: "Mind", history: "Mind", investigation: "Mind", nature: "Mind", religion: "Mind",
    "animal handling": "Soul", insight: "Soul", medicine: "Soul", perception: "Soul", survival: "Soul",
    deception: "Presence", intimidation: "Presence", performance: "Presence", persuasion: "Presence",
  };
  const FAC = "(?:Violence|Intrigue|Presence|Body|Mind|Soul)";

  function scrub(text, ftPerSquare = FT_PER_SQUARE) {
    let out = String(text ?? "");
    // advantage/disadvantage ONLY in mechanical context (verb-prefixed or prep-suffixed),
    // so feature names ("Shadow Advantage") and flavor prose are left untouched.
    out = out.replace(ADV_VERB, (m, dis) => m.replace(/(dis)?advantage/i, dis ? DIS : ADV));
    out = out.replace(ADV_PREP, (m, dis) => preserveCase(m, dis ? DIS : ADV));
    // generic confident swaps (abilities, currency, damage types, rest cadence, …)
    for (const [re, rep] of SWAPS) out = out.replace(re, (m) => preserveCase(m, rep));
    // proficiency is context-dependent: "proficiency bonus" = the number → tier; but
    // "gain proficiency in/with X" = becoming trained → "a skill rank" / "trained".
    out = out.replace(/\b(gains?)\s+proficiency\s+(in|with)\b/gi, (m, g, p) => `${g} a skill rank ${p}`)
             .replace(/\bproficien(?:t|cy)\s+(in|with)\b/gi, (m, p) => `trained ${p}`)
             .replace(/\bproficiency bonus\b/gi, (m) => preserveCase(m, "tier"));
    // saving throws → checks; "<faculty> save(s)" and "save(s) vs/against" → check(s).
    // Bare "save"/"saves" (rescue, or "save for" = except) is intentionally left alone.
    out = out.replace(/\bsaving throws\b/gi, (m) => preserveCase(m, "checks"))
             .replace(/\bsaving throw\b/gi, (m) => preserveCase(m, "check"))
             .replace(FACULTY, (m, f) => `${f} ${/saves\b/i.test(m) ? "checks" : "check"}`)
             .replace(/\bsaves\b(?=\s+(?:vs\.?|against)\b)/gi, (m) => preserveCase(m, "checks"))
             .replace(/\bsave\b(?=\s+(?:vs\.?|against)\b)/gi, (m) => preserveCase(m, "check"));
    // drop a dangling verb left in front of a converted phrase ("you have reroll…" → "you reroll…")
    out = out.replace(VERB_DROP, "");
    // resolve MISMATCHED double skill-tags via the skill→faculty map, then collapse EXACT dupes
    out = out.replace(new RegExp(`\\b([A-Z][a-z]+(?: [A-Z][a-z]+)?)\\s*\\((${FAC})\\)\\s*\\((${FAC})\\)`, "g"),
      (m, skill, a, b) => { const want = SKILL_FACULTY[skill.toLowerCase()]; return want === a ? `${skill} (${a})` : want === b ? `${skill} (${b})` : m; });
    out = out.replace(/\(([^)]+)\)\s*\(\1\)/g, "($1)");
    // distances → battlemap SQUARES (ftPerSquare: 5 steward / 20 vehicle); eat a trailing "ft." period
    out = out.replace(/(\d+)\s*\/\s*(\d+)\s*[-‑–]?\s*(?:ft|feet|foot)\b\.?/gi,
      (_, a, b) => `${Math.max(1, Math.round(a / ftPerSquare))}/${Math.max(1, Math.round(b / ftPerSquare))} squares`);
    out = out.replace(/(\d+)\s*[-‑–]?\s*(?:ft|feet|foot)\b\.?/gi,
      (_, n) => { const s = Math.max(1, Math.round(n / ftPerSquare)); return `${s} square${s === 1 ? "" : "s"}`; });
    // NOTE: no global whitespace collapse — it churned the ⚙️ block indentation.
    return out;
  }
  // Names get a CONSERVATIVE scrub — recharge notation only (e.g. "(Recharge 5–6)").
  const scrubName = (name) => !SCRUB_NAMES ? String(name ?? "") : String(name ?? "")
    .replace(/\(\s*recharge\s*\d(?:\s*[-–—]\s*\d)?\s*\)/gi, "(recharges on a Soma Break)")
    .replace(/\brecharge\s*\d(?:\s*[-–—]\s*\d)?\b/gi, "recharges on a Soma Break");

  const detectFlags = (text) => {
    const hits = new Set();
    for (const [re, label] of FLAGS) { if (re.test(String(text ?? ""))) hits.add(label); re.lastIndex = 0; }
    return [...hits];
  };

  const changes = [], flagged = [], perPack = [];
  const recordChange = (src, name, field, before, after) =>
    changes.push({ src, name, field, before: String(before).replace(/<[^>]+>/g, " ").slice(0, 120), after: String(after).replace(/<[^>]+>/g, " ").slice(0, 120) });

  // Scrub a doc's OWN text fields. Flags computed on POST-scrub text (shows residue only).
  function scrubOwn(doc, fields, src) {
    const fps = VEHICLE_HINT.test(doc.name) ? 20 : FT_PER_SQUARE;
    const upd = { _id: doc.id }; let changed = false, hadFt = false; const f = new Set();
    for (const path of fields) {
      const cur = getP(doc, path); if (cur == null || String(cur).trim() === "") continue;
      if (/\d+\s*[-‑–]?\s*(?:ft|feet|foot)\b/i.test(cur)) hadFt = true;
      const next = scrub(cur, fps);
      detectFlags(next).forEach(x => f.add(x));
      if (next !== String(cur)) { upd[path] = next; changed = true; recordChange(src, doc.name, path.split(".").pop(), cur, next); }
    }
    const nn = scrubName(doc.name);
    if (nn !== doc.name) { upd.name = nn; changed = true; recordChange(src, doc.name, "name", doc.name, nn); }
    if (hadFt && VEHICLE_HINT.test(doc.name)) f.add("converted at 20 ft/square (vehicle scale) — verify");
    if (f.size) flagged.push({ src, name: doc.name, terms: [...f] });
    return { upd, changed };
  }

  // Scrub items embedded on an actor → array of embedded-item updates.
  function scrubEmbedded(actor, src) {
    const ups = [];
    for (const it of actor.items) {
      const fps = VEHICLE_HINT.test(it.name) ? 20 : FT_PER_SQUARE;
      const u = { _id: it.id }; let ch = false;
      for (const path of ITEM_FIELDS) {
        const cur = getP(it, path); if (cur == null || String(cur).trim() === "") continue;
        const next = scrub(cur, fps);
        if (next !== String(cur)) { u[path] = next; ch = true; recordChange(`${src} › ${actor.name}`, it.name, path.split(".").pop(), cur, next); }
      }
      const nn = scrubName(it.name);
      if (nn !== it.name) { u.name = nn; ch = true; recordChange(`${src} › ${actor.name}`, it.name, "name", it.name, nn); }
      if (ch) ups.push(u);
    }
    return ups;
  }

  async function sweep(label, docs, type, applyFn) {
    const ownUpdates = [], embByDoc = [];
    for (const doc of docs) {
      const { upd, changed } = scrubOwn(doc, type === "Actor" ? ACTOR_FIELDS : ITEM_FIELDS, label);
      if (changed) ownUpdates.push(upd);
      if (type === "Actor" && INCLUDE_EMBEDDED_ITEMS) {
        const e = scrubEmbedded(doc, label);
        if (e.length) embByDoc.push({ doc, e });
      }
    }
    const own = ownUpdates.length, emb = embByDoc.reduce((n, x) => n + x.e.length, 0);
    if (!DRY_RUN && (own || emb)) await applyFn(ownUpdates, embByDoc);
    perPack.push({ label, type, docs: docs.length, own, emb });
    console.log(`%c[${label}] own:${own} embedded:${emb} (of ${docs.length} ${type})`, "color:#ffb000;font-weight:bold");
    return own + emb;
  }

  let total = 0;
  for (const pk of targetPacks) {
    const type = pk.metadata.type;
    const DocClass = type === "Actor" ? Actor : Item;
    const docs = await pk.getDocuments();
    total += await sweep(`pack:${pk.collection}`, docs, type, async (ownUpdates, embByDoc) => {
      const wasLocked = pk.locked; if (wasLocked) await pk.configure({ locked: false });
      try {
        if (ownUpdates.length) await DocClass.updateDocuments(ownUpdates, { pack: pk.collection });
        for (const { doc, e } of embByDoc) await doc.updateEmbeddedDocuments("Item", e);
      } finally { if (wasLocked) await pk.configure({ locked: true }); }
    });
  }
  if (INCLUDE_WORLD) {
    total += await sweep("world-items", Array.from(game.items), "Item", async (u) => { if (u.length) await Item.updateDocuments(u); });
    total += await sweep("world-actors", Array.from(game.actors), "Actor", async (u, embByDoc) => {
      if (u.length) await Actor.updateDocuments(u);
      for (const { doc, e } of embByDoc) await doc.updateEmbeddedDocuments("Item", e);
    });
  }

  // ---- report journal ----
  const ppRows = perPack.filter(p => p.own || p.emb).sort((a, b) => (b.own + b.emb) - (a.own + a.emb))
    .map(p => `<tr><td>${esc(p.label.replace(/^pack:/, ""))}</td><td>${esc(p.type)}</td><td>${p.docs}</td><td>${p.own}</td><td>${p.emb}</td></tr>`).join("\n");
  const CAP = 400;
  const chRows = changes.slice(0, CAP).map(c => `<tr><td>${esc(c.src.replace(/^pack:/, ""))}</td><td>${esc(c.name)}</td><td>${esc(c.field)}</td><td><span style="opacity:.65">${esc(c.before)}</span></td><td>${esc(c.after)}</td></tr>`).join("\n");
  const flRows = flagged.map(f => `<tr><td>${esc(f.src.replace(/^pack:/, ""))}</td><td>${esc(f.name)}</td><td>${esc(f.terms.join(", "))}</td></tr>`).join("\n");
  const html = `<h2>🧹 D&D Vernacular Scrub — Report</h2>`
    + `<p><em>${DRY_RUN ? "DRY RUN — nothing written." : `Applied ${total} update(s).`} Packs swept: ${perPack.length}. Total rewrites: ${changes.length}. Docs with judgment-call terms: ${flagged.length}.</em></p>`
    + `<h3>Per-compendium summary (with rewrites)</h3><table border="1" cellpadding="3" style="border-collapse:collapse"><thead><tr><th>Source</th><th>Type</th><th>Docs</th><th>Own</th><th>Embedded</th></tr></thead><tbody>\n${ppRows}\n</tbody></table>`
    + `<h3>Rewrites (${changes.length}${changes.length > CAP ? `, first ${CAP} shown` : ""})</h3><table border="1" cellpadding="3" style="border-collapse:collapse"><thead><tr><th>Source</th><th>Doc</th><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>\n${chRows}\n</tbody></table>`
    + `<h3>Flagged for your call (${flagged.length})</h3><table border="1" cellpadding="3" style="border-collapse:collapse"><thead><tr><th>Source</th><th>Doc</th><th>Terms</th></tr></thead><tbody>\n${flRows}\n</tbody></table>`;
  const jname = "🧹 D&D Vernacular Scrub — Report";
  const existing = game.journal.getName(jname);
  if (existing) { const p = existing.pages.contents[0]; if (p) await p.update({ "text.content": html }); else await existing.createEmbeddedDocuments("JournalEntryPage", [{ name: "Report", type: "text", text: { content: html, format: 1 } }]); }
  else await JournalEntry.create({ name: jname, pages: [{ name: "Report", type: "text", text: { content: html, format: 1 } }] });

  console.log("%c[scrub-dnd-vernacular]", "color:#ffb000;font-weight:bold", DRY_RUN ? "DRY RUN" : `APPLIED ${total}`, "rewrites:", changes.length, "flagged:", flagged.length, "packs:", perPack.length);
  ui.notifications.info(`D&D scrub: ${changes.length} rewrite(s) ${DRY_RUN ? "previewed" : "applied"} across ${perPack.length} pack(s); ${flagged.length} flagged. See journal "${jname}".` + (DRY_RUN ? " (DRY RUN — flip to apply.)" : ""));
})();
