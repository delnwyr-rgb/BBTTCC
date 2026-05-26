// BBTTCC — Seed Courtly Maneuvers into Doctrines Pack (2026-05-23)
// ─────────────────────────────────────────────────────────────────────────────
// MANEUVER_BALANCE_PASS.md §3.E. The 12 Courtly Intrigue anytime maneuvers
// (Phase D) currently exist ONLY at runtime — registered into EFFECTS by
// `maneuvers-courtly-content.enhancer.js` but never written to the doctrines
// pack. They are therefore invisible in the compendium and a faction can't
// "own" them. This macro reads `game.bbttcc.api.raid.courtlyManeuvers` and
// creates the matching pack docs, bringing Presence to full depth in browse.
//
// Also (STEP 2) tags the orphaned `Psychological Pressure` pack doc with
// engine = "presence" so it stops showing as untagged.
//
// Idempotent: skips entries whose `flags.bbttcc.key` is already in the pack.
//
// Knobs:
const DRY_RUN = true;          // false: actually mutate the pack
const TAG_PSYCH_PRESSURE = true; // also set engine=presence on Psychological Pressure
const VERBOSE_CONSOLE = false;
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  const catalog = game.bbttcc?.api?.raid?.courtlyManeuvers;
  if (!Array.isArray(catalog) || !catalog.length) {
    ui.notifications?.error("game.bbttcc.api.raid.courtlyManeuvers unavailable — is maneuvers-courtly-content.enhancer.js loaded?");
    return;
  }

  const existingDocs = await pack.getDocuments();
  const existingKeys = new Set();
  for (const doc of existingDocs) {
    const k = doc.flags?.bbttcc?.key;
    if (k) existingKeys.add(String(k));
  }

  // ── STEP 1: build courtly pack docs ────────────────────────────────────────
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
      img: "icons/svg/aura.svg",
      system: {
        description: { value: m.description || `<p>${m.effectsText || m.label}</p>`, chat: "" }
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
            engine: m.engine || "courtly",
            layer: m.layer || "tactical",
            costBand: m.costBand,
            raidTypes: (m.raidTypes || ["presence"]).slice(),
            fireMode: m.fireMode || "anytime",
            opCosts: foundry.utils.deepClone(m.cost || {}),
            authoredSprint: "courtly-d"
          },
          effects: { text: m.effectsText }
        }
      }
    };
    toCreate.push(docData);
    if (VERBOSE_CONSOLE) console.log("[seed-courtly]", m.key, docData);
  }

  let createdIds = [];
  if (!DRY_RUN && toCreate.length) {
    try {
      const created = await pack.documentClass.createDocuments(toCreate, { pack: PACK_ID });
      createdIds = Array.isArray(created) ? created.map((d) => d.id) : [];
      ui.notifications?.info(`Seeded ${createdIds.length} courtly maneuvers into ${PACK_ID}`);
    } catch (e) {
      console.error("[seed-courtly] createDocuments failed", e);
      ui.notifications?.error("Courtly seed failed — see console");
    }
  }

  // ── STEP 2: tag Psychological Pressure engine=presence ─────────────────────
  let psychResult = "skipped (TAG_PSYCH_PRESSURE=false)";
  if (TAG_PSYCH_PRESSURE) {
    const psych = existingDocs.find((d) => {
      const k = String(d.flags?.bbttcc?.key || "");
      return k === "opt_psychological_pressure" || /psychological pressure/i.test(d.name || "");
    });
    if (!psych) {
      psychResult = "not found in pack";
    } else if (psych.flags?.bbttcc?.meta?.engine) {
      psychResult = `already tagged engine=${psych.flags.bbttcc.meta.engine}`;
    } else if (DRY_RUN) {
      psychResult = `would set engine=presence on "${psych.name}"`;
    } else {
      try {
        await psych.update({ "flags.bbttcc.meta.engine": "presence" });
        psychResult = `set engine=presence on "${psych.name}"`;
      } catch (e) {
        psychResult = `update failed: ${e.message}`;
      }
    }
  }

  console.groupCollapsed(`[seed-courtly] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — to-create=${toCreate.length} · skipped=${skipped.length} · created=${createdIds.length}`);
  console.log("to-create:", toCreate.map((d) => ({ name: d.name, key: d.flags.bbttcc.key })));
  console.log("skipped:", skipped);
  console.log("psych pressure:", psychResult);
  console.groupEnd();

  const createRows = toCreate.map((d) => {
    const m = catalog.find((x) => x.key === d.flags.bbttcc.key);
    const costStr = Object.entries(m?.cost || {}).map(([k, v]) => `${k}:${v}`).join(" + ") || "—";
    return `<tr><td>T${m?.tier ?? "?"}</td><td>${d.name}</td><td><code>${d.flags.bbttcc.key}</code></td><td>${m?.fireMode ?? "—"}</td><td>${costStr}</td></tr>`;
  }).join("");
  const skippedRows = skipped.map((s) => `<tr><td colspan="4"><code>${s.key}</code> — ${s.name}</td><td><i>${s.reason}</i></td></tr>`).join("");
  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';
  const summary =
`<div style="font-family:var(--font-primary)">
<h3 style="margin:0 0 6px">👑 Courtly Maneuvers → Doctrines Pack — ${mode}</h3>
<div style="font-size:11px;line-height:1.4">
<b>${toCreate.length}</b> to create · <b>${skipped.length}</b> skipped · <b>${createdIds.length}</b> written<br>
Psychological Pressure: <i>${psychResult}</i>
</div>
${toCreate.length ? `<table style="font-size:10px;border-collapse:collapse;width:100%;margin-top:6px">
<thead><tr style="background:#eee"><th>Tier</th><th>Name</th><th>Key</th><th>FireMode</th><th>Cost</th></tr></thead>
<tbody>${createRows}</tbody></table>` : ""}
${skippedRows ? `<details style="margin-top:6px"><summary><b>Skipped</b> (already in pack)</summary><table style="font-size:10px;border-collapse:collapse;width:100%"><tbody>${skippedRows}</tbody></table></details>` : ""}
${DRY_RUN ? '<p style="margin-top:8px;font-size:11px"><b>To apply:</b> edit macro, set <code>DRY_RUN = false</code>, re-run.</p>' : ""}
</div>`;
  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
