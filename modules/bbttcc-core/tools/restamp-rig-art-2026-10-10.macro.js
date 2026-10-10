// restamp-rig-art-2026-10-10.macro.js — RUN IN-WORLD (GM) on EMBER (roll-for-initiation-bad-eden).
// Swaps un-shippable rig / structure art (third-party token packs, GOTTGAIT wasteland
// structures, mystery-man / core-svg placeholders) for the Bad Eden DA rig icons that
// ship in modules/bbttcc-core/assets/rigs/. Keyed by ember actor id; the name must
// still match or the row is skipped. Updates the actor img, its prototype token, and
// every placed token of that actor whose texture still shows the OLD art (custom
// per-token art is left alone).
//
// DRY_RUN=true first (just reports). Set DRY_RUN=false to apply. No F5 needed.
(async () => {
  const DRY_RUN = false;                              // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const BASE = "modules/bbttcc-core/assets/rigs/";
  const MAP = {
    // third-party token packs
    "0VKY5rmlFUROaqrZ": ["Ralphie Baby",                 "mechsuit_3.webp"],
    "GmLGX29T7mCZznZn": ["Carlsbad",                     "mechsuit_2.webp"],
    "JxisaDofHcrk2I1u": ["Chopper Four",                 "personal_rig_5.webp"],
    "KX1SHfWr8mN6DOeq": ["Evil Bad Rig",                 "medium_rig_1.webp"],
    // placeholders
    "Y8clVTHWbwGhniGS": ["Space Marine (Mecha · T0)",    "mechsuit_1.webp"],
    "6WEFlEH5evLLLXZa": ["Hexmobile",                    "personal_rig_1.webp"],
    "EMi49n3lm2q65ywF": ["Hexmobile",                    "personal_rig_3.webp"],
    "TUDk6eMjueS3iZ9L": ["Hexmobile",                    "personal_rig_4.webp"],
    // wasteland structures
    "3Oth1OqkHthCeoKp": ["Generator Hut",                "infrastructure_1.webp"],
    "ES923aaaysqX5J7B": ["Fewer Dead Fish Smell Saloon", "infrastructure_2.webp"],
    "43fKY4WrzxxyVYUd": ["Wasteland Shack",              "infrastructure_3.webp"],
    "yv3VHAwUP05IKnBC": ["Fuel Shed",                    "infrastructure_4.webp"],
    "XGk8Y8AXJFwn8k9q": ["Watchtower",                   "watchtower.webp"],
    "A3JxXSAdgpCjxgnm": ["Wall Placeable",               "wall.webp"],
    "RuWuBKyB1SpmP8uO": ["Junk Barricade",               "junk_wall_1.webp"],
    "srPvqJbIAt0UdLBs": ["Junk Barricade",               "junk_wall_2.webp"],
    "mHs2fluhE9W80ArW": ["Glyph-Ward Pylon",             "pylon.webp"]
  };
  const rows = [], skipped = [];
  for (const [id, [name, file]] of Object.entries(MAP)) {
    const a = game.actors.get(id);
    if (!a) { skipped.push(`${name} (${id}): not in this world`); continue; }
    if (a.name !== name) { skipped.push(`${id}: name is "${a.name}", expected "${name}"`); continue; }
    const oldImg = a.img, newImg = BASE + file;
    if (oldImg === newImg) { skipped.push(`${name}: already done`); continue; }
    const tokens = [];
    for (const s of game.scenes) for (const t of s.tokens) {
      if (t.actorId === id && t.texture?.src === oldImg) tokens.push(t);
    }
    rows.push({ a, name, oldImg, newImg, tokens });
  }

  // Compendium rigs (module packs; unlocked for the write, re-locked after).
  const PACK_MAP = { "bbttcc-master-content.npcs": { "Vila's Dreammobile": "personal_rig_7.webp" } };
  const packRows = [];
  for (const [cid, byName] of Object.entries(PACK_MAP)) {
    const pack = game.packs.get(cid);
    if (!pack) { skipped.push(`${cid}: pack not found`); continue; }
    const docs = await pack.getDocuments();
    for (const [name, file] of Object.entries(byName)) {
      const d = docs.find(x => x.name === name);
      if (!d) { skipped.push(`${cid} / ${name}: not in pack`); continue; }
      if (d.img === BASE + file) { skipped.push(`${name} (pack): already done`); continue; }
      packRows.push({ pack, d, name: `${name} (pack)`, oldImg: d.img, newImg: BASE + file, tokens: [] });
    }
  }

  if (!DRY_RUN) {
    for (const r of packRows) {
      const wasLocked = r.pack.locked;
      if (wasLocked) await r.pack.configure({ locked: false });
      await r.d.update({ img: r.newImg, "prototypeToken.texture.src": r.newImg });
      if (wasLocked) await r.pack.configure({ locked: true });
    }
    for (const r of rows) {
      await r.a.update({ img: r.newImg, "prototypeToken.texture.src": r.newImg });
      for (const t of r.tokens) await t.update({ "texture.src": r.newImg });
    }
  }
  rows.push(...packRows);
  const html = `<h3>Rig art restamp ${DRY_RUN ? "(DRY RUN)" : "— APPLIED"}</h3>`
    + `<p>${rows.length} actor(s), ${rows.reduce((n, r) => n + r.tokens.length, 0)} placed token(s).</p><ul>`
    + rows.map(r => `<li><b>${r.name}</b> → ${r.newImg.split("/").pop()} <small>(${r.tokens.length} token${r.tokens.length === 1 ? "" : "s"}; was ${decodeURIComponent(r.oldImg).split("/").pop()})</small></li>`).join("")
    + `</ul>` + (skipped.length ? `<p>Skipped:</p><ul>${skipped.map(s => `<li>${s}</li>`).join("")}</ul>` : "");
  ChatMessage.create({ content: html, whisper: [game.user.id] });
  console.log("[restamp-rig-art]", DRY_RUN ? "DRY RUN" : "APPLIED", rows, skipped);
})();
