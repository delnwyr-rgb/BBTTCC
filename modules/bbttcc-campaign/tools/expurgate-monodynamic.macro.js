/* expurgate-monodynamic.macro.js — spend the receipts, never the name.
 * 2026-08-19. GM only. DRY_RUN default true. Idempotent.
 *
 * 🔒 Owner ruling 2026-08-19: "MD should be expurgated from anything player
 * facing at this stage, definitely." Monodynamic Industries / Mr. Monocle are
 * the NEXT campaign's big bad ([[reference_monodynamic_canon]]); current
 * content shows RECEIPTS ONLY — the invoice, the seal, the quiet coin, the
 * hand on the tiller — and never the proper noun. `seed-opening-edition.macro.js:17`
 * already carries the rule as a comment; the Valhaulan finale simply drifted.
 *
 * WHAT THIS DOES NOT DO: it does not delete the intelligence. Every scene still
 * delivers exactly what it delivered before — that someone off-map paid for
 * the redirection, that the Valhaulans were pointed, that Khezek-Tor was
 * injured rather than tapped. Only the NAME is withheld, which is what makes
 * it a reveal to spend later instead of a fact already spent.
 *
 * SCOPE (from audit-monodynamic-exposure, run 2026-08-19):
 *  · vs_bridge_muster — the ONLY automatic leak (playerFacing → broadcast)
 *  · raid_thatwards_courtly_sklar — a CHOICE BUTTON naming it; the option text
 *    is the reveal before anyone clicks
 *  · 7 × raid_thatwards_* descriptions — read-aloud scene prose
 *
 * DELIBERATELY EXEMPT:
 *  · stillwater_harvest — "the most Monodynamic thing a coalition can do" is a
 *    SIMILE. 🔒 Owner ruling: keep. With no context a player hears a strange
 *    but plausible idiom, not a corporation.
 *  · stillwater_covenant — the mention sits inside the field's `⚙ GM:` block,
 *    which is never read aloud.
 *  · worldEffects / tags — mechanical GM-side fields.
 *  · The Unicorn VC Class rig — handled in code instead (`gmOnly: true` in
 *    rig-builder.js), because that text is correct and wanted later.
 *
 * 🪤 Two traps this respects:
 *  1. `raid_thatwards_*` beats exist ONLY in the live world — no seeder writes
 *     them — but `vs_bridge_muster` DOES come from seed-valhaulan-spine.macro.js.
 *     That seeder is patched in the repo in the same change; fixing the live
 *     world alone would let the next seed run undo this.
 *  2. Khezek Tor → Khezek-Tor (owner ruling, same day) is folded into the
 *     rewritten sentences so this pass doesn't reintroduce the old spelling.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // Surgical phrase swaps, scoped to a beat + field. Whole-description rewrites
  // would be unreviewable; these are diffable by eye.
  const EDITS = [
    { beat: "vs_bridge_muster", field: "description",
      from: "on Monodynamic's quiet coin",
      to:   "on somebody else's quiet coin" },

    { beat: "raid_thatwards_courtly_sklar", field: "choices[0].label",
      from: "Be direct about the Spark and Monodynamic",
      to:   "Be direct about the Spark and who paid for it" },

    { beat: "raid_thatwards_infiltration_success", field: "description",
      from: "records. Monodynamic Industries. They did not mean to hurt Khezek Tor.",
      to:   "records. Not a name — an account number, a shipping seal, and a signature nobody initials twice. They did not mean to hurt Khezek-Tor." },

    { beat: "raid_thatwards_courtly_honest", field: "description",
      from: "acting on Monodynamic direction",
      to:   "acting on someone else's direction — a client whose paper she has seen and whose name she will not say" },

    { beat: "raid_thatwards_courtly_playful", field: "description",
      from: "She spits the Monodynamic name like it owes her money.",
      to:   "She spits the client's name like it owes her money — too fast and too quiet, and it is gone before you can hold on to it." },

    { beat: "raid_thatwards_siege_success", field: "description",
      from: "Monodynamic pointed them at a sealed energetic redirection they did not understand",
      to:   "Someone off-map pointed them at a sealed energetic redirection they did not understand" },

    { beat: "raid_thatwards_outcome_neutral_spark", field: "description",
      from: "Monodynamic redirected energies through the seal",
      to:   "someone with money and patience redirected energies through the seal" },

    { beat: "raid_thatwards_rewards_major", field: "description",
      from: "strong Monodynamic intel",
      to:   "strong intel on whoever holds the paper" },

    { beat: "raid_thatwards_rewards_intel_only", field: "description",
      from: "Monodynamic used the Valhaulans as deniable vectors",
      to:   "Someone used the Valhaulans as deniable vectors" }
  ];

  const TARGETS = [/\bMonodynamic\b/i, /\bMr\.?\s*Monocle\b/i, /\bMonocle\b/i];
  const EXEMPT = new Set(["stillwater_harvest", "stillwater_covenant"]);

  let raw = game.settings.get(NS, "campaigns");
  const wasString = typeof raw === "string";
  const camps = wasString ? JSON.parse(raw) : foundry.utils.deepClone(raw);

  const get = (b, field) => {
    const m = field.match(/^choices\[(\d+)\]\.(\w+)$/);
    return m ? b.choices?.[+m[1]]?.[m[2]] : b[field];
  };
  const set = (b, field, v) => {
    const m = field.match(/^choices\[(\d+)\]\.(\w+)$/);
    if (m) b.choices[+m[1]][m[2]] = v; else b[field] = v;
  };

  const report = [], missed = [];
  let applied = 0;

  for (const e of EDITS) {
    let found = false;
    for (const camp of Object.values(camps || {})) {
      const b = (camp?.beats || []).find(x => x?.id === e.beat);
      if (!b) continue;
      const cur = String(get(b, e.field) ?? "");
      if (!cur) continue;
      if (cur.includes(e.from)) {
        found = true; applied++;
        set(b, e.field, cur.split(e.from).join(e.to));
        report.push(`✎ ${e.beat} .${e.field}\n     − ${e.from}\n     + ${e.to}`);
      } else if (cur.includes(e.to)) {
        found = true;
        report.push(`· ${e.beat} .${e.field} — already expurgated`);
      }
    }
    // 🚨 A silent no-match is the dangerous failure: the pass would report
    // success while the name stayed in play. Say it loudly instead.
    if (!found) missed.push(`✗ ${e.beat} .${e.field} — PHRASE NOT FOUND: "${e.from}"`);
  }

  // sweep: anything still naming the target, minus the ruled exemptions
  const leftovers = [];
  for (const camp of Object.values(camps || {})) {
    for (const b of (camp?.beats || [])) {
      if (EXEMPT.has(b.id)) continue;
      const scan = [["label", b.label], ["description", b.description], ["memoryText", b.memoryText]]
        .concat((b.choices || []).flatMap((ch, i) => [[`choices[${i}].label`, ch?.label], [`choices[${i}].description`, ch?.description]]));
      for (const [path, val] of scan)
        if (typeof val === "string" && TARGETS.some(re => re.test(val)))
          leftovers.push(`   ${b.id} .${path}`);
    }
  }

  const out = [`${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${applied} phrase edit(s)`];
  out.push(...report);
  if (missed.length) { out.push(`\n🚨 ${missed.length} EDIT(S) DID NOT MATCH — fix these before applying:`); out.push(...missed); }
  out.push(`\n🔒 exempt by ruling: ${[...EXEMPT].join(", ")}`);
  out.push(`\n${leftovers.length ? "⚠ STILL NAMED (player-facing fields, non-exempt):" : "✅ no non-exempt player-facing field names the target"}`);
  out.push(...leftovers);

  console.log("[expurgate-monodynamic]\n" + out.join("\n"));

  if (DRY_RUN) return ui.notifications.info(`Expurgation DRY RUN: ${applied} edit(s), ${missed.length} unmatched — see console.`);
  if (missed.length) return ui.notifications.error(`Refusing to apply: ${missed.length} phrase(s) did not match. See console.`);

  // back up before writing — the campaigns setting is the whole story spine
  try {
    saveDataToFile(JSON.stringify(wasString ? JSON.parse(raw) : raw, null, 2),
      "application/json", `campaigns-backup-pre-expurgation.json`);
  } catch (e) { console.warn("[expurgate] backup failed:", e); }

  await game.settings.set(NS, "campaigns", wasString ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Expurgation APPLIED: ${applied} edit(s). Backup downloaded.`);
})();
