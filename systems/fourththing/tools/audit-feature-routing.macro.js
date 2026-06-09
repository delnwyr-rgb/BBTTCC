// audit-feature-routing.macro.js — RUN IN-WORLD (GM). READ-ONLY.
// Finds "firing buttons that don't do anything" by classifying every feature on what its
// HANDLER actually does — not just whether it's routed. Uses the system's OWN routeFeature
// + FEATURE_ROUTER, so it stays correct as the router changes.
//
// Buckets:
//   ACTIVE       — ▶Use runs a handler that mutates game state (works)
//   GENERIC      — routed to generic_per_use (prose-parsed stopgap, not the real effect)
//   INFO_ONLY    — ▶Use only shows a text dialog (passive_info etc.) — no mechanical effect
//   DEAD_BUTTON  — ▶Use exists but handler is an early-return no-op (Surge-folded stubs)
//   INERT        — no ▶Use button (unrouted / retired) — mostly legit-passive traits
//   ⚠ MISROUTE   — item routes to INFO/GENERIC/INERT but its id/name fully matches a real
//                  ACTIVE handler key → a wiring bug (e.g. the Harmony Marshal Tier mismatch)
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  let mod; try { mod = await import("/systems/fourththing/ft-class-automation.js"); }
  catch (e) { return ui.notifications.error("Import failed: " + e.message); }
  const { routeFeature, FEATURE_ROUTER } = mod;
  if (typeof routeFeature !== "function") return ui.notifications.error("routeFeature not exported.");

  // Audit compendium packs by default; also audits items on canvas-selected actors if any.
  const PACK_IDS = ["bbttcc-master-content.classes"];

  // Handler-behavior categories (from the handler-body audit 2026-06-08).
  const INFO = new Set(["passive_info", "shadow_courier_passive", "oldenborn_sun_scar", "circuitborn_glitch_surge"]);
  const DEAD = new Set(["shadow_courier_crossing", "shadow_courier_package", "shadow_courier_spend_access", "shadow_courier_access_pool"]);
  const GENERIC = new Set(["generic_per_use"]);
  const cat = (h) => h === null ? "INERT" : DEAD.has(h) ? "DEAD_BUTTON" : INFO.has(h) ? "INFO_ONLY" : GENERIC.has(h) ? "GENERIC" : "ACTIVE";

  // Active handler keys (for misroute detection) — tokens of the intended identifier.
  const tok = (s) => new Set(String(s).toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 2 && !["the", "tier", "core", "and"].includes(x)));
  const isActiveHandler = (h) => h && !INFO.has(h) && !DEAD.has(h) && !GENERIC.has(h);
  const activeKeys = Object.entries(FEATURE_ROUTER || {}).filter(([k, h]) => isActiveHandler(h)).map(([k, h]) => ({ k, h, toks: tok(k) }));
  const findMisroute = (item) => {
    const itoks = tok((item.system?.identifier ?? "") + " " + (item.name ?? ""));
    for (const a of activeKeys) { if (a.toks.size >= 2 && [...a.toks].every(t => itoks.has(t))) return a; }
    return null;
  };

  const sources = [];
  for (const id of PACK_IDS) { const p = game.packs.get(id); if (p) sources.push({ label: id, docs: await p.getDocuments() }); }
  const sel = canvas?.tokens?.controlled?.map(t => t.actor).filter(Boolean) ?? [];
  for (const a of sel) sources.push({ label: "actor:" + a.name, docs: Array.from(a.items) });

  const buckets = { ACTIVE: [], GENERIC: [], INFO_ONLY: [], DEAD_BUTTON: [], INERT: [] };
  const misroutes = [];
  const seen = new Set();
  for (const src of sources) {
    for (const d of src.docs) {
      if (!["feat", "feature"].includes(d.type)) continue;
      if (seen.has(d.name)) continue; seen.add(d.name);
      let h = null; try { h = routeFeature(d); } catch (e) {}
      const c = cat(h);
      buckets[c].push(`${d.name}${h ? "  →[" + h + "]" : ""}`);
      if (c !== "ACTIVE") { const mr = findMisroute(d); if (mr) misroutes.push({ name: d.name, id: d.system?.identifier ?? "", now: h || "INERT", shouldBe: mr.h }); }
    }
  }

  console.log("=== FEATURE ROUTING AUDIT (read-only) ===");
  console.log("sources:", sources.map(s => s.label).join(", "));
  console.table(Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));
  for (const k of ["DEAD_BUTTON", "INFO_ONLY", "GENERIC"]) {
    console.log(`\n--- ${k} (${buckets[k].length}) ---`); console.log(buckets[k].sort().join("\n") || "(none)");
  }
  console.log(`\n⚠⚠ MISROUTES (${misroutes.length}) — routed to INFO/GENERIC/INERT but a real ACTIVE handler matches — WIRING BUGS:`);
  for (const m of misroutes) console.log(`  "${m.name}" (id=${m.id})  now=[${m.now}] → SHOULD=[${m.shouldBe}]`);
  console.log(`\n(INERT ${buckets.INERT.length} not listed — mostly legit-passive traits. Add pack ids to PACK_IDS, or select tokens to audit built actors.)`);
  ui.notifications.info(`Routing audit: ${buckets.ACTIVE.length} active, ${buckets.GENERIC.length} generic, ${buckets.INFO_ONLY.length} info-only, ${buckets.DEAD_BUTTON.length} dead, ${misroutes.length} ⚠ misroutes. Console (F12).`);
})();
