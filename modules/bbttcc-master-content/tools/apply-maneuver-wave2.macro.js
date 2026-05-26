// BBTTCC — Maneuver Balance Pass WAVE 2 (mutating) — 2026-05-24
// ─────────────────────────────────────────────────────────────────────────────
// MANEUVER_BALANCE_PASS.md §3.C (merge) + §3.D (retune). Mutates the doctrines
// pack to match the code-side changes already shipped in bbttcc-raid:
//
//   §3.C MERGE — Radiant Rally + Battlefield Harmony folded into Rally the Line.
//     • DELETE pack docs: radiant_rally, battlefield_harmony.
//     • UPDATE rally_the_line description (now carries +2 Morale / −1 Darkness rider).
//     • Optional faction sweep: remove embedded copies of the two retired keys.
//
//   §3.D RETUNE — descriptions for chrono_loop_command / reality_hack /
//     void_signal_collapse updated to the new, less-swingy effects.
//
// Code side (already done, no macro needed): runtime EFFECTS (compat-bridge.js +
// data JSON), THROUGHPUT handlers, the nullify consumer, picker lists.
//
// Idempotent: skips updates whose target text already matches; skips deletes for
// docs already gone.
//
// Knobs:
const DRY_RUN = true;          // false: actually mutate the pack + factions
const SWEEP_FACTIONS = true;   // also remove embedded retired maneuver items from faction actors
const VERBOSE_CONSOLE = false;
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  // New player-facing descriptions (neutral register — Mal-voicing is a separate pass).
  const UPDATES = {
    rally_the_line: {
      name: "Rally the Line",
      desc: "<p>An officer's voice cuts the noise and the line steadies. <b>+1 to allies' next attack/defense roll.</b> On a successful round the rally carries the whole faction: <b>+2 Morale and −1 Darkness.</b></p><p><i>(Consolidates the former Radiant Rally.)</i></p>"
    },
    chrono_loop_command: {
      desc: "<p>You fold the moment back on itself and try the breath again. On a successful round, <b>re-run one failed roll.</b> But the loop frays when you push it and lose — <b>on a failed round, Darkness +1.</b></p>"
    },
    reality_hack: {
      desc: "<p>You reach past the rules of the round and shove. <b>Re-roll your faction's round result once — you must keep the second result, better or worse.</b> Bending the world is never free: <b>Darkness +1.</b></p>"
    },
    void_signal_collapse: {
      desc: "<p>A wave of dead air rolls across the field and the enemy's clever plans dissolve into static. <b>Nullify all enemy maneuvers this round; your own still resolve.</b> <b>Darkness +1.</b></p>"
    }
  };
  const RETIRE_KEYS = ["radiant_rally", "battlefield_harmony"];

  const docs = await pack.getDocuments();
  const byKey = new Map();
  for (const d of docs) {
    const k = d.flags?.bbttcc?.key;
    if (k) byKey.set(String(k), d);
  }
  // Name-based fallback for legacy docs lacking flags.bbttcc.key.
  const byNameLc = new Map(docs.map((d) => [String(d.name || "").toLowerCase(), d]));
  const resolve = (key, ...nameHints) => {
    if (byKey.has(key)) return byKey.get(key);
    for (const n of nameHints) { const d = byNameLc.get(n.toLowerCase()); if (d) return d; }
    // loose: name startsWith
    return docs.find((d) => RETIRE_KEYS.concat(Object.keys(UPDATES)).length && new RegExp("^" + key.replace(/_/g, "[ _-]"), "i").test(String(d.name || ""))) || null;
  };

  const report = { updated: [], skipped: [], deleted: [], notFound: [], factions: [] };

  // ── §3.D + rally_the_line: update descriptions ─────────────────────────────
  for (const [key, u] of Object.entries(UPDATES)) {
    const d = resolve(key, key.replace(/_/g, " "));
    if (!d) { report.notFound.push(key); continue; }
    const cur = d.system?.description?.value || "";
    if (cur.trim() === u.desc.trim()) { report.skipped.push({ key, name: d.name, reason: "desc already current" }); continue; }
    const patch = { "system.description.value": u.desc };
    if (u.name && d.name !== u.name) patch.name = u.name;
    if (VERBOSE_CONSOLE) console.log("[wave2] update", key, patch);
    if (!DRY_RUN) await d.update(patch);
    report.updated.push({ key, name: u.name || d.name });
  }

  // ── §3.C: delete retired pack docs ─────────────────────────────────────────
  for (const key of RETIRE_KEYS) {
    const d = resolve(key, key.replace(/_/g, " "));
    if (!d) { report.notFound.push(key + " (delete target, already gone)"); continue; }
    if (VERBOSE_CONSOLE) console.log("[wave2] delete", key, d.id);
    if (!DRY_RUN) await d.delete();
    report.deleted.push({ key, name: d.name, id: d.id });
  }

  // ── §3.C: faction sweep — strip embedded copies of the retired keys ────────
  if (SWEEP_FACTIONS) {
    const factions = game.actors.filter((a) =>
      a.flags?.["bbttcc-factions"]?.isFaction === true ||
      a.system?.details?.type?.value === "faction"
    );
    for (const f of factions) {
      const retiredItems = f.items.filter((i) => RETIRE_KEYS.includes(String(i.flags?.bbttcc?.key || "")));
      if (!retiredItems.length) continue;
      const hasRally = f.items.some((i) => String(i.flags?.bbttcc?.key || "") === "rally_the_line");
      const ids = retiredItems.map((i) => i.id);
      if (!DRY_RUN) await f.deleteEmbeddedDocuments("Item", ids);
      report.factions.push({
        faction: f.name,
        removed: retiredItems.map((i) => i.flags.bbttcc.key),
        keepsRally: hasRally,
        note: hasRally ? "already owns Rally the Line" : "⚠ does NOT own Rally the Line — GM may want to grant it"
      });
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.groupCollapsed(`[wave2] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — updated=${report.updated.length} deleted=${report.deleted.length} skipped=${report.skipped.length} factions=${report.factions.length}`);
  console.log(report);
  console.groupEnd();

  const row = (cells) => `<tr>${cells.map((c) => `<td style="padding:1px 6px">${c}</td>`).join("")}</tr>`;
  const updRows = report.updated.map((u) => row([`<code>${u.key}</code>`, u.name, "desc updated"])).join("");
  const delRows = report.deleted.map((d) => row([`<code>${d.key}</code>`, d.name, "🗑 deleted"])).join("");
  const skpRows = report.skipped.map((s) => row([`<code>${s.key}</code>`, s.name, `<i>${s.reason}</i>`])).join("");
  const nfRows  = report.notFound.map((k) => row([`<code>${k}</code>`, "—", "<i>not found</i>"])).join("");
  const facRows = report.factions.map((x) => row([x.faction, x.removed.join(", "), x.note])).join("");
  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';

  const summary =
`<div style="font-family:var(--font-primary);font-size:11px">
<h3 style="margin:0 0 6px">⚖️ Maneuver Balance — Wave 2 (merge + retune) — ${mode}</h3>
<b>${report.updated.length}</b> updated · <b>${report.deleted.length}</b> deleted · <b>${report.skipped.length}</b> skipped · <b>${report.factions.length}</b> factions swept
<table style="border-collapse:collapse;width:100%;margin-top:6px"><tbody>
${updRows}${delRows}${skpRows}${nfRows}
</tbody></table>
${facRows ? `<details style="margin-top:6px" open><summary><b>Faction sweep</b></summary><table style="border-collapse:collapse;width:100%"><tbody>${facRows}</tbody></table></details>` : "<p style='margin-top:6px'><i>No factions own the retired maneuvers.</i></p>"}
${DRY_RUN ? '<p style="margin-top:8px"><b>To apply:</b> set <code>DRY_RUN = false</code>, re-run. (Run AFTER reloading Foundry so the code-side changes are live.)</p>' : ""}
</div>`;
  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
