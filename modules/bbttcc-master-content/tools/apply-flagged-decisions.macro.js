// Bad Eden — Apply the owner's flagged-decision annotations (energy types + skill-tags)
// ─────────────────────────────────────────────────────────────────────────────
// The D&D scrub flagged judgment calls; the owner annotated each with an answer.
// This applies those answers across all Item + Actor compendiums (+ world + embedded):
//   • ENERGY_ASSIGN: replace the retired "energy" damage type with the assigned
//     Bad Eden type (thermal/electrical/chemical/sephirotic/radiation/qliphothic).
//   • TAG_RESOLVE: collapse a doc's mismatched double skill-tag "(X) (Y)" to the
//     chosen faculty, e.g. Threat Assessment → (Mind).
// Names are matched case-insensitively, ignoring any "(Recharge…)" suffix.
//
// SAFE — DRY_RUN = true writes nothing; logs every change. Flip to false to apply.
// Idempotent (re-running finds nothing once converted). Run on BOTH worlds.
// ─────────────────────────────────────────────────────────────────────────────

const DRY_RUN = false;              // flip to false to apply
const PACK_TYPES = ["Item", "Actor"];
const INCLUDE_WORLD = true;
const INCLUDE_EMBEDDED_ITEMS = true;

const ITEM_FIELDS = ["system.description.value", "flags.fourththing.rfi.item.lore", "flags.fourththing.rfi.item.legacySystem.description.value"];
const ACTOR_FIELDS = ["system.description.value", "system.details.biography.value", "system.details.biography.public", "system.biography.value", "system.notes.value", "flags.fourththing.rfi.item.legacySystem.description.value"];

// docName (lower-case, recharge-suffix stripped) → assigned damage type
const ENERGY_ASSIGN = {
  "wrath-brand": "thermal",
  "echo-diver heritage: abyssal": "thermal",
  "echo-diver heritage: tellurian": "electrical",
  "echo-diver heritage: empyrean": "chemical",
  "sephirotic scion heritage: seraphic": "sephirotic",
  "menhirkin (igneous): magma memory": "thermal",
  "menhirkin heritage: igneous": "thermal",
  "oldenborn (stormborn nomad): weatherwise": "electrical",
  "reactor shield cape": "radiation",
  "singing hammer": "sephirotic",
  "plasma lance": "thermal",
  "laser pistol, rad": "thermal",
  "laser rifle, rad": "thermal",
  "quantum staff": "thermal",
  "potion of radical chill": "thermal",
  "frikkin' laser blade saber": "thermal",
  "static aegis": "electrical",
  "burn-zone lunge": "thermal",
  "spark vow": "electrical",
  "hollow hunger": "qliphothic",
  "containment pulse": "thermal",
  "downdraft burn": "thermal",
  "targeting laser": "thermal",
  "pre-fall lance battery": "electrical",
  "still-charged frame": "electrical",
  "bough of just sentence": "sephirotic",
  "smoldering bite": "thermal",
  "rainbow cascade": "sephirotic",
  // "classification scan": "all"  ← pending owner clarification, intentionally omitted
};
// docName → faculty to keep when resolving its mismatched double skill-tag
const TAG_RESOLVE = {
  "threat assessment": "Mind",
  "calm the mob": "Presence",
  "weatherwise": "Soul",
};
const FAC = "(?:Violence|Intrigue|Presence|Body|Mind|Soul)";

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const getP = foundry.utils.getProperty, esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const norm = (s) => String(s ?? "").replace(/\s*\((?:recharge[^)]*|recharges on a soma break)\)\s*$/i, "").trim().toLowerCase();
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const convEnergy = (text, T) => String(text ?? "").replace(/\benergy\b/gi, (m) => /^[A-Z]/.test(m) ? cap(T) : T);
  const resolveTag = (text, F) => String(text ?? "").replace(new RegExp(`\\((${FAC})\\)\\s*\\((${FAC})\\)`, "g"), (m, a, b) => (a === F || b === F) ? `(${F})` : m);

  const changes = [];
  const transform = (doc, fields, src) => {
    const key = norm(doc.name), T = ENERGY_ASSIGN[key], F = TAG_RESOLVE[key];
    if (!T && !F) return null;
    const upd = { _id: doc.id }; let changed = false;
    for (const path of fields) {
      const cur = getP(doc, path); if (cur == null || String(cur).trim() === "") continue;
      let next = String(cur);
      if (T) next = convEnergy(next, T);
      if (F) next = resolveTag(next, F);
      if (next !== String(cur)) { upd[path] = next; changed = true; changes.push({ src, name: doc.name, do: T ? `energy→${T}` : `tag→${F}`, after: next.replace(/<[^>]+>/g, " ").slice(0, 130) }); }
    }
    return changed ? upd : null;
  };

  let total = 0;
  async function sweep(label, docs, type, applyFn) {
    const fields = type === "Actor" ? ACTOR_FIELDS : ITEM_FIELDS;
    const ownUpdates = [], embByDoc = [];
    for (const doc of docs) {
      const u = transform(doc, fields, label); if (u) ownUpdates.push(u);
      if (type === "Actor" && INCLUDE_EMBEDDED_ITEMS) {
        const e = []; for (const it of doc.items) { const iu = transform(it, ITEM_FIELDS, `${label} › ${doc.name}`); if (iu) e.push(iu); }
        if (e.length) embByDoc.push({ doc, e });
      }
    }
    const n = ownUpdates.length + embByDoc.reduce((a, x) => a + x.e.length, 0);
    if (!DRY_RUN && n) await applyFn(ownUpdates, embByDoc);
    if (n) console.log(`%c[${label}] ${n} change(s)`, "color:#ffb000;font-weight:bold");
    return n;
  }

  for (const pk of game.packs.filter(p => PACK_TYPES.includes(p.metadata.type))) {
    const type = pk.metadata.type, DocClass = type === "Actor" ? Actor : Item;
    total += await sweep(`pack:${pk.collection}`, await pk.getDocuments(), type, async (own, embByDoc) => {
      const wasLocked = pk.locked; if (wasLocked) await pk.configure({ locked: false });
      try {
        if (own.length) await DocClass.updateDocuments(own, { pack: pk.collection });
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

  const rows = changes.map(c => `<tr><td>${esc(c.src.replace(/^pack:/, ""))}</td><td>${esc(c.name)}</td><td>${esc(c.do)}</td><td>${esc(c.after)}</td></tr>`).join("\n");
  const html = `<h2>🎯 Flagged Decisions — Report</h2><p><em>${DRY_RUN ? "DRY RUN — nothing written." : `Applied ${total} change(s).`} ${changes.length} edit(s).</em></p>`
    + `<table border="1" cellpadding="3" style="border-collapse:collapse"><thead><tr><th>Source</th><th>Doc</th><th>Action</th><th>After</th></tr></thead><tbody>\n${rows}\n</tbody></table>`;
  const jname = "🎯 Flagged Decisions — Report";
  const ex = game.journal.getName(jname);
  if (ex) { const p = ex.pages.contents[0]; if (p) await p.update({ "text.content": html }); else await ex.createEmbeddedDocuments("JournalEntryPage", [{ name: "Report", type: "text", text: { content: html, format: 1 } }]); }
  else await JournalEntry.create({ name: jname, pages: [{ name: "Report", type: "text", text: { content: html, format: 1 } }] });

  console.log("%c[apply-flagged-decisions]", "color:#ffb000;font-weight:bold", DRY_RUN ? "DRY RUN" : `APPLIED ${total}`, "edits:", changes.length);
  ui.notifications.info(`Flagged decisions: ${changes.length} edit(s) ${DRY_RUN ? "previewed" : "applied"}. See journal "${jname}".` + (DRY_RUN ? " (DRY RUN — flip to apply.)" : ""));
})();
