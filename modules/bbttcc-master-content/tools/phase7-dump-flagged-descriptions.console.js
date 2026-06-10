// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Phase 7 helper: dump flagged item descriptions as paste-friendly JSON
// ─────────────────────────────────────────────────────────────────────────────
// Run AFTER `phase7-survey-discipline-kit-and-subclass.console.js`. Pulls the
// flagged items out of `globalThis.__phase7Survey`, strips to the fields we
// need to author callouts (name + identifier + descTail), and prints both:
//   • a one-shot console.log of the JSON string (for copy-paste back to Claude)
//   • a `copy(...)` shortcut so you can put it on the clipboard with one click
//
// Filter: includes everything with markers OR class-type docs (those are the
// "kit overview" items that often hide a per-use callout in their summary).
// ─────────────────────────────────────────────────────────────────────────────
(() => {
  const survey = globalThis.__phase7Survey;
  if (!survey?.grouped) {
    console.error("globalThis.__phase7Survey not found. Run the survey script first.");
    return;
  }

  const out = {};
  for (const [key, items] of Object.entries(survey.grouped)) {
    const flagged = items.filter(i =>
      !i.alreadySurfaced && (i.markers.length || i.type === "class")
    );
    if (!flagged.length) continue;
    out[key] = flagged.map(i => ({
      name: i.name,
      identifier: i.identifier,
      type: i.type,
      markers: i.markers,
      descTail: i.descTail,
    }));
  }

  const json = JSON.stringify(out, null, 2);
  console.log(`%c=== Phase 7 flagged descriptions (${Object.values(out).reduce((a,b)=>a+b.length,0)} items) ===`,
    "color:#88ff88;font-weight:bold");
  console.log(json);

  // Put on clipboard for one-click paste-back
  if (typeof copy === "function") {
    copy(json);
    console.log("%c→ JSON copied to clipboard. Paste back to Claude.", "color:#ffaa00");
  } else {
    console.log("(`copy(json)` not available — select the JSON above and copy manually.)");
  }
})();
