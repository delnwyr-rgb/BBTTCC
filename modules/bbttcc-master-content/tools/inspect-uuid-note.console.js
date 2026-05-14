// Paste into F12 console (as GM). Logs the raw HTML of any item still
// containing both "placeholder" and "UUID" so we can see what shape the
// remaining notes actually have.
(async () => {
  const found = [];

  // Pack
  const pack = game.packs.get("bbttcc-master-content.ancestries");
  if (pack) {
    const idx = await pack.getIndex({ fields: ["name"] });
    for (const e of idx) {
      const doc = await pack.getDocument(e._id);
      const v = doc.system?.description?.value ?? "";
      if (/placeholder/i.test(v) && /UUID/i.test(v)) {
        found.push({ where: "pack", name: doc.name, value: v });
      }
    }
  }

  // Actors
  for (const actor of game.actors) {
    for (const item of actor.items) {
      const v = item.system?.description?.value ?? "";
      if (/placeholder/i.test(v) && /UUID/i.test(v)) {
        found.push({ where: `actor:${actor.name}`, name: item.name, value: v });
      }
    }
  }

  console.log(`%cFound ${found.length} items still carrying placeholder+UUID.`,
    "color:#ffaa00;font-weight:bold");
  for (const f of found) {
    console.groupCollapsed(`${f.where} — ${f.name}`);
    // Find ~250 chars around "placeholder" so we see the shape
    const idx = f.value.search(/placeholder/i);
    const start = Math.max(0, idx - 200);
    const end = Math.min(f.value.length, idx + 400);
    console.log(`...${f.value.slice(start, end)}...`);
    console.log("FULL LENGTH:", f.value.length);
    console.groupEnd();
  }
  console.log("DONE");
})();
