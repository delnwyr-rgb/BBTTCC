// Bad Eden master-content / tools / audit-aurablade-doctrines.macro.js
//
// Read-only diagnostic for the Aurablade doctrine drift bug. Walks every
// Aurablade doctrine (Blood Hymn / Stillheart / Void Edge), enumerates the
// subclass doc + its associated feats, and dumps the result into a copyable
// Dialog (textarea + Copy button). Also posts to console for power users.
//
// USAGE: paste into a Script macro, run. Click "Copy to clipboard" in the
// dialog, then paste the output back to chat.

const PACK_ID = "bbttcc-master-content.classes";
const DOCTRINES = ["Blood Hymn", "Stillheart", "Void Edge"];

const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }

const derive = game.fourththing?._progression?.deriveItemUnlockLevel ?? (() => ({ tier: null, level: null }));
const allDocs = await pack.getDocuments();
const stripHtml = (s) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const truncate  = (s, n) => { const t = stripHtml(s); return t.length > n ? t.slice(0, n) + "…" : t; };

let report = "=== AURABLADE DOCTRINE AUDIT ===\n\n";

for (const dName of DOCTRINES) {
  const doc = allDocs.find(d => d.type === "subclass" && (d.name === dName || d.name.startsWith(dName)));
  report += `## ${dName}\n`;
  if (!doc) { report += "  subclass doc NOT FOUND\n\n"; continue; }

  const adv = doc.system?.advancement;
  const advList = Array.isArray(adv) ? adv : (adv && typeof adv === "object" ? Object.values(adv) : []);
  const grants = advList.filter(a => a?.type === "ItemGrant");
  report += `  identifier: ${doc.system?.identifier ?? ""}\n`;
  report += `  classIdentifier: ${doc.system?.classIdentifier ?? ""}\n`;
  report += `  advancement: ${advList.length} entries (${grants.length} ItemGrant)\n`;
  for (const g of grants) {
    const items = g.configuration?.items ?? [];
    report += `    L${g.level}: "${g.title}" — ${items.length} item(s) [${items.map(i => String(i.uuid).split(".").pop()).join(", ")}]\n`;
  }
  report += `  desc (first 800 chars):\n    ${truncate(doc.system?.description?.value, 800)}\n`;

  const ident = String(doc.system?.identifier ?? "").toLowerCase();
  const identPrefix = ident ? ident + "_" : "";
  const altIdent = String(dName).toLowerCase().replace(/\s+/g, "_") + "_";
  const namePrefix = `${dName}:`;
  const feats = allDocs.filter(d => {
    if (d.type !== "feat") return false;
    const fid = String(d.system?.identifier ?? "").toLowerCase();
    if (identPrefix && fid.startsWith(identPrefix)) return true;
    if (altIdent && fid.includes(altIdent)) return true;
    if (d.name?.startsWith(namePrefix)) return true;
    return false;
  });
  report += `\n  ${feats.length} feat(s) discovered:\n`;
  for (const f of feats) {
    report += `\n    • ${f.name}\n`;
    report += `        identifier: ${f.system?.identifier ?? ""}\n`;
    report += `        prereq.level: ${f.system?.prerequisites?.level ?? "(unset)"}\n`;
    report += `        derived.level: ${derive(f).level ?? "(none)"}\n`;
    report += `        desc: ${truncate(f.system?.description?.value, 300)}\n`;
  }
  report += "\n----------------------------------------\n\n";
}

console.log(report);

new Dialog({
  title: "Aurablade Doctrine Audit",
  content: `
    <p style="margin:0 0 0.5rem">Click <b>Copy to Clipboard</b>, then paste the result back to chat with Claude.</p>
    <textarea id="bbttcc-audit-out" style="width:100%;height:50vh;font-family:monospace;font-size:11px;white-space:pre;background:#0a1428;color:#f4f0e0;border:1px solid rgba(95,168,255,0.3);padding:8px;">${foundry.utils.escapeHTML(report)}</textarea>
  `,
  buttons: {
    copy: {
      icon: '<i class="fas fa-copy"></i>',
      label: "Copy to Clipboard",
      callback: async (html) => {
        const ta = html[0].querySelector("#bbttcc-audit-out");
        try {
          await navigator.clipboard.writeText(ta.value);
          ui.notifications.info("Audit copied to clipboard.");
        } catch (e) {
          ta.select();
          document.execCommand("copy");
          ui.notifications.info("Audit copied (fallback).");
        }
      }
    },
    close: { icon: '<i class="fas fa-times"></i>', label: "Close" }
  },
  default: "copy"
}, { width: 900, height: "auto", resizable: true }).render(true);
