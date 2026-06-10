// Bad Eden — Seed Sprint 2 Maneuvers into Doctrines Pack (2026-05-14)
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 2 Tool of MANEUVER_CATALOG_SPEC.md §5. Reads the runtime catalog
// at `game.bbttcc.api.raid.sprint2Maneuvers` (published by
// `maneuvers-sprint2-content.enhancer.js`) and creates corresponding
// doctrine pack doc entries so they appear in the compendium for players.
//
// Idempotent: skips entries whose canonical `flags.bbttcc.key` already
// exists in the pack. Re-run safely after editing the catalog — only new
// keys land.
//
// Knobs:
const DRY_RUN = true;          // false: actually create pack entries
const VERBOSE_CONSOLE = false; // true: log full doc shape per entry
//
// Output: console + whispered chat card with per-entry status.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  const catalog = game.bbttcc?.api?.raid?.sprint2Maneuvers;
  if (!Array.isArray(catalog) || !catalog.length) {
    ui.notifications?.error("game.bbttcc.api.raid.sprint2Maneuvers unavailable — is maneuvers-sprint2-content.enhancer.js loaded?");
    return;
  }

  // Engine → default icon (Foundry-standard SVG paths).
  const ICON_BY_ENGINE = {
    universal: "icons/svg/upgrade.svg",
    violence:  "icons/svg/sword.svg",
    intrigue:  "icons/svg/cowled.svg",
    presence:  "icons/svg/aura.svg"
  };

  // Survey existing pack keys (avoid duplicate inserts).
  const existingDocs = await pack.getDocuments();
  const existingKeys = new Set();
  for (const doc of existingDocs) {
    const k = doc.flags?.bbttcc?.key;
    if (k) existingKeys.add(String(k));
  }

  // Build doc payloads from catalog entries.
  const toCreate = [];
  const skipped = [];

  for (const m of catalog) {
    if (existingKeys.has(m.key)) {
      skipped.push({ key: m.key, name: m.label, reason: "already in pack" });
      continue;
    }
    const docData = {
      name: m.label,
      type: "feat",
      img: ICON_BY_ENGINE[m.engine] || "icons/svg/item-bag.svg",
      system: {
        description: {
          value: m.description || `<p>${m.effectsText || m.label}</p>`,
          chat: ""
        }
      },
      flags: {
        bbttcc: {
          kind: "maneuver",
          key: m.key,
          meta: {
            tier: m.tier,
            rarity: "common",
            minFactionTier: null,
            storyOnly: false,
            availability: "standard",
            unlockKey: null,
            engine: m.engine,
            layer: m.layer,
            costBand: m.costBand,
            raidTypes: m.raidTypes.slice(),
            fireMode: m.fireMode,
            opCosts: foundry.utils.deepClone(m.cost),
            authoredSprint: 2
          },
          effects: {
            text: m.effectsText
          }
        }
      }
    };
    toCreate.push(docData);
    if (VERBOSE_CONSOLE) console.log("[seed-s2]", m.key, docData);
  }

  // Apply if not DRY_RUN.
  let createdIds = [];
  if (!DRY_RUN && toCreate.length) {
    try {
      const created = await pack.documentClass.createDocuments(toCreate, { pack: PACK_ID });
      createdIds = Array.isArray(created) ? created.map((d) => d.id) : [];
      ui.notifications?.info(`Seeded ${createdIds.length} S2 maneuvers into ${PACK_ID}`);
    } catch (e) {
      console.error("[seed-s2] createDocuments failed", e);
      ui.notifications?.error("S2 seed failed — see console");
    }
  }

  // Report.
  console.groupCollapsed(`[seed-s2] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — to-create=${toCreate.length} · skipped=${skipped.length} · created=${createdIds.length}`);
  console.log("to-create:", toCreate.map((d) => ({ name: d.name, key: d.flags.bbttcc.key })));
  console.log("skipped:", skipped);
  console.log("createdIds:", createdIds);
  console.groupEnd();

  const createRows = toCreate.map((d) => {
    const m = catalog.find((x) => x.key === d.flags.bbttcc.key);
    const costStr = Object.entries(m?.cost || {}).map(([k, v]) => `${k}:${v}`).join(" + ") || "—";
    return `<tr><td>T${m?.tier ?? "?"}</td><td>${d.name}</td><td><code>${d.flags.bbttcc.key}</code></td><td>${m?.engine ?? "—"}</td><td>${m?.layer ?? "—"}</td><td>${m?.fireMode ?? "—"}</td><td>${costStr}</td></tr>`;
  }).join("");

  const skippedRows = skipped.map((s) => `<tr><td colspan="6"><code>${s.key}</code> — ${s.name}</td><td><i>${s.reason}</i></td></tr>`).join("");

  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';
  const summary =
`<div style="font-family:var(--font-primary)">
<h3 style="margin:0 0 6px">🌱 Sprint 2 Maneuvers → Doctrines Pack — ${mode}</h3>
<div style="font-size:11px;line-height:1.4">
<b>${toCreate.length}</b> to create · <b>${skipped.length}</b> skipped · <b>${createdIds.length}</b> written
</div>
${toCreate.length ? `<table style="font-size:10px;border-collapse:collapse;width:100%;margin-top:6px">
<thead><tr style="background:#eee"><th>Tier</th><th>Name</th><th>Key</th><th>Engine</th><th>Layer</th><th>FireMode</th><th>Cost</th></tr></thead>
<tbody>${createRows}</tbody></table>` : ""}
${skippedRows ? `<details style="margin-top:6px"><summary><b>Skipped</b> (already in pack)</summary><table style="font-size:10px;border-collapse:collapse;width:100%"><tbody>${skippedRows}</tbody></table></details>` : ""}
${DRY_RUN ? '<p style="margin-top:8px;font-size:11px"><b>To apply:</b> edit macro, set <code>DRY_RUN = false</code>, re-run.</p>' : ""}
</div>`;

  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
