// Bad Eden — Find which pack(s) contain a given item _id
// ─────────────────────────────────────────────────────────────────────────────
// Run as a GM script macro. Searches every registered pack (Item type) for
// each _id in IDS and reports back. Use to track down items whose JSON source
// path doesn't match a registered pack.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
const IDS = [
  { id: "N3xt88POaGL1U9AZ", note: "Hearth-Reader" },
  { id: "3DkiEhdk6HZ2jJWA", note: "Burrow Memory" },
  { id: "bwb2U6eXyuF97LeP", note: "Deep-Blooded" },
  { id: "qFHFFwxbz0Fhojgd", note: "Moon-Nerve" },
];

const lines = ["=== Item _id discovery ==="];
for (const { id, note } of IDS) {
  const matches = [];
  for (const pack of game.packs.values()) {
    if (pack.documentName !== "Item") continue;
    try {
      const idx = await pack.getIndex();
      if (idx.has(id)) matches.push(pack.collection);
    } catch (e) {}
  }
  lines.push(`${id}  (${note})  →  ${matches.length ? matches.join(", ") : "NOT FOUND in any Item pack"}`);
}
console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  content: `<pre style="font-size:0.78rem;white-space:pre-wrap">${lines.join("\n")}</pre>`,
  whisper: [game.user.id]
});
})();
