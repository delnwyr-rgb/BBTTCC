// Bad Eden — Bulk-stamp Phase D resource grants on live ancestry/heritage/path items
// ─────────────────────────────────────────────────────────────────────────────
// Generated 2026-04-28T21:36:32.791Z by build-resource-grants-macros.mjs
// Filtered to 19 live items / 35 grants.
// Skips orphan-pack subclasses and zombie sub-heritages.
//
// Looks each item up by NAME across all Item packs. Idempotent (skips items
// that already have resourceGrants authored).
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;

const BATCH = [
  {
    "name": "Menhirkin",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "violence-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "non-lethal-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Oldenborn Heritage: Stormborn Nomad",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "non-lethal-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "faith-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Menhirkin Heritage: Igneous",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "violence-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "non-lethal-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Tellurian",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "logistics-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Menhirkin Heritage: Sedimentary",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "economy-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Husk",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "non-lethal-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Chthonic",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "violence-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "faith-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Empyrean",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "soft-power-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Abyssal",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "faith-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Sephirotic Scion Heritage: Ophanic",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "violence-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Oldenborn Heritage: Rustland Scavenger",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "economy-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Menhirkin Heritage: Metamorphic",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "non-lethal-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Human Heritage: Cro-Magnon",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "soft-power-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Sephirotic Scion Heritage: Seraphic",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "violence-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "faith-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Diabolic",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "violence-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Sephirotic Scion Heritage: Cherubic",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "soft-power-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "faith-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Human Heritage: Denisovan",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "logistics-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Echo-Diver",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "economy-op",
        "amount": 2
      }
    ]
  },
  {
    "name": "Qliph-Scarred",
    "grants": [
      {
        "cadence": "per-campaign-start",
        "resource": "violence-op",
        "amount": 2
      },
      {
        "cadence": "per-campaign-start",
        "resource": "intrigue-op",
        "amount": 2
      }
    ]
  }
];

async function findItemByName(name) {
  for (const pack of game.packs.values()) {
    if (pack.documentName !== "Item") continue;
    try {
      const idx = await pack.getIndex({ fields: ["name"] });
      const hit = idx.find(e => e.name === name);
      if (hit) {
        if (pack.locked) {
          try { await pack.configure({ locked: false }); }
          catch (e) { console.warn("[grants-stamp] could not unlock", pack.collection, e); }
        }
        const doc = await pack.getDocument(hit._id);
        if (doc) return { doc, pack: pack.collection };
      }
    } catch (e) { console.warn("[grants-stamp] index lookup failed for", pack.collection, e); }
  }
  return null;
}

const summary = { synced: [], skipped: [], errors: [], notFound: [] };

for (const job of BATCH) {
  try {
    const found = await findItemByName(job.name);
    if (!found) { summary.notFound.push(job.name); continue; }
    const { doc: liveItem, pack } = found;

    const existing = liveItem.flags?.fourththing?.resourceGrants;
    if (Array.isArray(existing) && existing.length > 0) {
      summary.skipped.push(`${job.name}: already has ${existing.length} grant(s)`);
      continue;
    }
    if (DRY_RUN) {
      summary.synced.push(`[dry] ${job.name}: would add ${job.grants.length}`);
      continue;
    }
    await liveItem.setFlag("fourththing", "resourceGrants", job.grants);
    summary.synced.push(`${job.name}: +${job.grants.length}`);
  } catch (err) {
    summary.errors.push(`${job.name}: ${err.message}`);
    console.error("[grants-stamp]", job, err);
  }
}

const lines = [
  `=== Bulk Resource-Grant Stamp (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
  `Synced:    ${summary.synced.length}`,
  `Skipped:   ${summary.skipped.length}`,
  `Not found: ${summary.notFound.length}`,
  `Errors:    ${summary.errors.length}`,
  ...(summary.notFound.length ? ["", "Items not found in any pack:", ...summary.notFound.map(s => `  ✗ ${s}`)] : []),
  ...(summary.errors.length ? ["", "Errors:", ...summary.errors.map(s => `  ✗ ${s}`)] : []),
  "", "Synced (first 30):",
  ...summary.synced.slice(0, 30).map(s => `  ✓ ${s}`),
  ...(summary.synced.length > 30 ? [`  …and ${summary.synced.length - 30} more`] : []),
];
console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  content: `<pre style="font-size:0.78rem;white-space:pre-wrap">${lines.join("\n")}</pre>`,
  whisper: [game.user.id]
});
})();
