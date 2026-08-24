/**
 * sync-class-fossil-prune.macro.js — GM macro/console. DRY_RUN default true.
 *
 * The fossil-prose sweep (2026-08-23) rewrote/pruned the retired
 * Strain/Resonance and Civic Charge/Administrative Pressure/Precedent
 * economies in the classes compendium. This syncs copies already GRANTED
 * onto actor sheets:
 *  · DELETE actor items matching the pruned trackers (CL Resonance & Strain /
 *    Resonance Pool / Strain; Pactkeeper Civic Charge / Administrative
 *    Pressure / Spend Civic Charge) + de-dupe extra "Resonance Channel"
 *    copies down to one.
 *  · RE-SYNC descriptions of the 45 rewritten/recosted items from the
 *    updated classes compendium (match by exact name).
 */
(async () => {
  const DRY_RUN = true;
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const PACK = game.packs.get("bbttcc-master-content.classes");
  if (!PACK) return ui.notifications.error("classes compendium not found.");
  const docs = await PACK.getDocuments();
  const byName = new Map(docs.map(d => [d.name, d]));

  const DELETE_NAMES = new Set([
    "Cosmic Linguist: Resonance & Strain", "Cosmic Linguist: Resonance Pool", "Cosmic Linguist: Strain",
    "Pactkeeper: Civic Charge", "Pactkeeper: Administrative Pressure", "Pactkeeper: Spend Civic Charge"
  ]);
  const SYNC_NAMES = new Set(["Annotator: Circle Discipline","Annotator: Correspondence Mastery","Annotator: Great Work Rite","Annotator: Ritual Annotation","Annotator: Stored Annotation","Archivist of Precedent (Bad Eden)","Archivist: Akashic Access","Archivist: Akashic Override","Archivist: Archival Recall","Archivist: Cross-Reference Reality","Archivist: Expectation Gravity","Archivist: Historiographic Authority","Archivist: Immutable Record","Archivist: Redundant Recordkeeping","Auditor (Bad Eden)","Auditor: Compliance Action","Auditor: Deicidal Injunction","Auditor: Forensic Audit","Auditor: Hard Shutdown","Auditor: Quarantine Order","Auditor: Sanction Protocol","Cosmic Linguist: Core Features","Cosmic Linguist: Initiation 1 — True-Name Touch","Cosmic Linguist: Resonance Channel","Cosmic Linguist: Semantic Editor","Jurisdiction: Records & Precedent","Metaphor Apostle: Archetype Binding","Metaphor Apostle: Make It True","Metaphor Apostle: Myth Hook","Metaphor Apostle: Shared Dream","Metaphor Apostle: Symbolic Substitution","Pactkeeper: Core Features","Pactkeeper: Invoke Precedent","Redactor: Name Stripping","Redactor: Persistent Deletion","Redactor: Redline the Draft","Redactor: Semantic Redaction","Redactor: Total Redaction","Steward of Living Communities (Bad Eden)","Steward: Civic Apotheosis","Steward: Cohesion Pulse","Steward: Community Contract","Steward: Integration Charter","Steward: Mutual Aid Network","Steward: Public Works Miracle"]);

  let deleted = 0, synced = 0, deduped = 0;
  for (const a of game.actors.contents) {
    const toDelete = [];
    let channelSeen = false;
    for (const it of a.items) {
      if (DELETE_NAMES.has(it.name)) { toDelete.push(it.id); continue; }
      if (it.name === "Cosmic Linguist: Resonance Channel") {
        if (channelSeen) { toDelete.push(it.id); deduped++; continue; }
        channelSeen = true;
      }
      if (SYNC_NAMES.has(it.name)) {
        const src = byName.get(it.name);
        const newDesc = src?.system?.description?.value ?? src?.system?.description;
        const curDesc = it.system?.description?.value ?? it.system?.description;
        if (typeof newDesc === "string" && newDesc && newDesc !== curDesc) {
          synced++;
          console.log(`[fossil-sync] ${a.name} › ${it.name}: description updated`);
          if (!DRY_RUN) await it.update({ "system.description.value": newDesc });
        }
      }
    }
    if (toDelete.length) {
      deleted += toDelete.length;
      console.log(`[fossil-sync] ${a.name}: deleting ${toDelete.length} fossil item(s)`);
      if (!DRY_RUN) await a.deleteEmbeddedDocuments("Item", toDelete);
    }
  }
  const msg = `[fossil-sync] ${DRY_RUN ? "DRY RUN — " : ""}deleted ${deleted} (incl. ${deduped} duplicate Channel) · descriptions synced ${synced}`;
  console.log(msg);
  ui.notifications.info(msg + (DRY_RUN ? " (set DRY_RUN=false to apply)" : ""));
})();
