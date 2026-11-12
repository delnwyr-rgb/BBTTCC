// MAL SCRUB + ITEM GLANCES (Dave 2026-11-12: "clarity on functionality a priority over color").
// Pure functions shared by the _source pass (apply-mal-scrub-source.mjs) and the live macro (build-mal-scrub-macro.mjs
// inlines them with Function#toString — keep them self-contained: no imports, no outer references).

/** Remove Mal's asides from one string (HTML or plain). */
export function stripMal(s) {
  if (typeof s !== "string" || !/\bMal\b/.test(s)) return s;
  let t = s;
  // A field that IS a Mal line ("Mal: '…'") — the whole thing goes.
  if (/^\s*(<p>)?\s*Mal\s*:/.test(t) && !/<\/p>\s*<p>/.test(t)) return "";
  // (Mal: "…") / Mal: "…" / Mal: “…”
  t = t.replace(/\s*\(Mal:\s*["“][\s\S]*?["”]\s*\)/g, "");
  t = t.replace(/\s*Mal:\s*["“][\s\S]*?["”](?=\s|<|$)/g, "");
  // Mal: '…' — the quote ends at a ' followed by end, a tag, or space + capital (apostrophes inside are fine).
  t = t.replace(/\s*\(?Mal:\s*['‘][\s\S]*?['’]\)?(?=\s*$|\s*<|\s+[A-Z(])/g, "");
  // Any remaining sentence that names Mal ("Mal is fond of it…", "Mal does not recommend…").
  t = t.replace(/(^|(?<=[.!?…]\s)|(?<=>))[^.!?<>]*\bMal\b[^.!?<]*[.!?…]+["”’']?\s*/g, "");
  t = t.replace(/\s+<\/p>/g, "</p>").replace(/<p>\s*<\/p>/g, "").trim();
  return t;
}

/** Mal-voiced items: drop the LEADING colour paragraphs (no bold/italic rule header, no numbers that read as rules),
 *  keeping every rule paragraph and the mechanics/ladder blocks. Never empties the text. */
export function dropMalVoicedLead(html) {
  if (typeof html !== "string") return html;
  const RULE = /<(strong|b|em)\b|[+−-]\s?\d|\d+d\d|\bDC\s?\d|\bonce per\b|\bper (scene|session|soma)|\bwhile (worn|equipped|attuned)\b/i;
  let t = html.trim(), changed = false;
  for (;;) {
    const m = t.match(/^<p>([\s\S]*?)<\/p>\s*/);
    if (!m || RULE.test(m[1])) break;
    const rest = t.slice(m[0].length);
    if (!/[A-Za-z]/.test(rest.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, ""))) break;   // nothing left but tags
    t = rest; changed = true;
  }
  return changed ? t : html;
}

/** Build a Foundry update (dot-paths) for one item's data, or null when nothing changes.
 *  opts.malVoiced — the item is from the Mal-voiced gear set; opts.clearFlavor — a canon power; opts.glance — authored "what it does" line. */
export function scrubItemUpdate(d, opts = {}) {
  const upd = {};
  const set = (path, oldV, newV) => { if (typeof oldV === "string" && newV !== oldV) upd[path] = newV; };
  const sys = d.system ?? {}, rfi = d.flags?.fourththing?.rfi?.item ?? null, w = d.flags?.fourththing?.working ?? null;
  const fix = (v) => { let r = stripMal(v); if (opts.malVoiced) r = dropMalVoicedLead(r); return r; };
  set("system.description.value", sys.description?.value, fix(sys.description?.value));
  set("system.description.chat", sys.description?.chat, stripMal(sys.description?.chat));
  if (rfi) set("flags.fourththing.rfi.item.lore", rfi.lore, fix(rfi.lore));
  // Canon powers: system.flavor IS Mal's line by convention (convert-5e renders it "Mal: …") — clear it (Dave 11-12).
  set("system.flavor", sys.flavor, (opts.malVoiced || opts.clearFlavor) ? "" : stripMal(sys.flavor));
  if (w?.power?.system) {
    set("flags.fourththing.working.power.system.flavor", w.power.system.flavor, "");   // a bound Working is a canon power: its flavor is Mal's line
    const pd = w.power.system.description;
    if (typeof pd === "string") set("flags.fourththing.working.power.system.description", pd, stripMal(pd));
    else if (pd && typeof pd.value === "string") set("flags.fourththing.working.power.system.description.value", pd.value, stripMal(pd.value));
  }
  if (rfi && opts.glance && rfi.glance !== opts.glance) upd["flags.fourththing.rfi.item.glance"] = opts.glance;
  return Object.keys(upd).length ? upd : null;
}
