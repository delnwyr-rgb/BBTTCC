// Bad Eden — Seed Balance-Pass Wave 1 Maneuvers into Doctrines Pack (2026-05-23)
// ─────────────────────────────────────────────────────────────────────────────
// MANEUVER_BALANCE_PASS.md Wave 1 tool. Reads the runtime catalog at
// `game.bbttcc.api.raid.balanceManeuvers` (published by
// `maneuvers-balance-content.enhancer.js`) and creates doctrine pack docs so
// the 8 new maneuvers (4 Siege breach + 4 Universal) appear in the compendium.
//
// Idempotent: skips entries whose `flags.bbttcc.key` is already in the pack.
// Mirrors seed-sprint2-maneuvers.macro.js exactly.
//
// Knobs:
const DRY_RUN = true;          // false: actually create pack entries
const VERBOSE_CONSOLE = false; // true: log full doc shape per entry
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  const catalog = game.bbttcc?.api?.raid?.balanceManeuvers;
  if (!Array.isArray(catalog) || !catalog.length) {
    ui.notifications?.error("game.bbttcc.api.raid.balanceManeuvers unavailable — is maneuvers-balance-content.enhancer.js loaded?");
    return;
  }

  const ICON_BY_ENGINE = {
    universal: "icons/svg/upgrade.svg",
    violence:  "icons/svg/sword.svg",
    intrigue:  "icons/svg/cowled.svg",
    presence:  "icons/svg/aura.svg",
    courtly:   "icons/svg/aura.svg"
  };
  // Siege-tagged maneuvers get a distinct icon even though engine === violence.
  const iconFor = (m) =>
    (Array.isArray(m.raidTypes) && m.raidTypes.includes("siege"))
      ? "icons/svg/castle.svg"
      : (ICON_BY_ENGINE[m.engine] || "icons/svg/item-bag.svg");

  const existingDocs = await pack.getDocuments();
  const existingKeys = new Set();
  for (const doc of existingDocs) {
    const k = doc.flags?.bbttcc?.key;
    if (k) existingKeys.add(String(k));
  }

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
      img: iconFor(m),
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
            authoredSprint: "balance-w1"
          },
          effects: {
            text: m.effectsText
          }
        }
      }
    };
    toCreate.push(docData);
    if (VERBOSE_CONSOLE) console.log("[seed-balance]", m.key, docData);
  }

  let createdIds = [];
  if (!DRY_RUN && toCreate.length) {
    try {
      const created = await pack.documentClass.createDocuments(toCreate, { pack: PACK_ID });
      createdIds = Array.isArray(created) ? created.map((d) => d.id) : [];
      ui.notifications?.info(`Seeded ${createdIds.length} balance maneuvers into ${PACK_ID}`);
    } catch (e) {
      console.error("[seed-balance] createDocuments failed", e);
      ui.notifications?.error("Balance seed failed — see console");
    }
  }

  console.groupCollapsed(`[seed-balance] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — to-create=${toCreate.length} · skipped=${skipped.length} · created=${createdIds.length}`);
  console.log("to-create:", toCreate.map((d) => ({ name: d.name, key: d.flags.bbttcc.key })));
  console.log("skipped:", skipped);
  console.log("createdIds:", createdIds);
  console.groupEnd();

  const createRows = toCreate.map((d) => {
    const m = catalog.find((x) => x.key === d.flags.bbttcc.key);
    const costStr = Object.entries(m?.cost || {}).map(([k, v]) => `${k}:${v}`).join(" + ") || "—";
    return `<tr><td>T${m?.tier ?? "?"}</td><td>${d.name}</td><td><code>${d.flags.bbttcc.key}</code></td><td>${m?.engine ?? "—"}</td><td>${(m?.raidTypes || []).join("/")}</td><td>${m?.fireMode ?? "—"}</td><td>${costStr}</td></tr>`;
  }).join("");

  const skippedRows = skipped.map((s) => `<tr><td colspan="6"><code>${s.key}</code> — ${s.name}</td><td><i>${s.reason}</i></td></tr>`).join("");

  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';
  const summary =
`<div style="font-family:var(--font-primary)">
<h3 style="margin:0 0 6px">⚖️ Balance Wave 1 Maneuvers → Doctrines Pack — ${mode}</h3>
<div style="font-size:11px;line-height:1.4">
<b>${toCreate.length}</b> to create · <b>${skipped.length}</b> skipped · <b>${createdIds.length}</b> written
</div>
${toCreate.length ? `<table style="font-size:10px;border-collapse:collapse;width:100%;margin-top:6px">
<thead><tr style="background:#eee"><th>Tier</th><th>Name</th><th>Key</th><th>Engine</th><th>RaidTypes</th><th>FireMode</th><th>Cost</th></tr></thead>
<tbody>${createRows}</tbody></table>` : ""}
${skippedRows ? `<details style="margin-top:6px"><summary><b>Skipped</b> (already in pack)</summary><table style="font-size:10px;border-collapse:collapse;width:100%"><tbody>${skippedRows}</tbody></table></details>` : ""}
${DRY_RUN ? '<p style="margin-top:8px;font-size:11px"><b>To apply:</b> edit macro, set <code>DRY_RUN = false</code>, re-run.</p>' : ""}
</div>`;

  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
