/**
 * patch-reservoir-pactkeeper-texts.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Owner rulings 2026-08-23 (round two of the fossil sweep):
 *  · Dream Echo Reservoir = store ONE manifestation, release later at no base
 *    cost (no Clarity/Noise; reach/overcast/misfire still apply). Its own
 *    vessel, separate from the retired Echo Dice. (System code now implements
 *    this — the sheet button opens the store/release dialog.)
 *  · Dreamwalker class anchor: fold-note corrected so the Reservoir isn't
 *    lumped in with the retired dice.
 *  · The three Bad Eden Pactkeeper subclasses: every [TBD:balance] cost and
 *    duration finalized against the live Surge economy and DC ladder.
 *
 * Updates the LIVE classes compendium via the API (unlock → update → relock)
 * and re-syncs matching items already granted on actor sheets. Repo _source
 * carries identical text.
 */
(async () => {
  const DRY_RUN = false;
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const PACK = game.packs.get("bbttcc-master-content.classes");
  if (!PACK) return ui.notifications.error("classes compendium not found.");

  const RES_TXT = "<p><strong>Dream Echo Reservoir.</strong> You have learned to bottle a working before the world hears it.</p><p><strong>Store (1 slot):</strong> choose a manifestation you know and seal it into the reservoir. It waits — a dream deferred, still warm.</p><p><strong>Release:</strong> cast the stored manifestation at <strong>no base cost</strong> — no Clarity, no Noise. (Reach, overcast, and misfire rules still apply if you push it beyond its tier.) The reservoir then stands empty until you store again.</p><p><em>Separate from the retired Echo Dice — this is a vessel, not a currency. The Reservoir button on your sheet manages store and release.</em></p>";
  const ANCHOR_OLD = "Echo Dice are now Surge, and the eight soma-break feats live on as four tier powers.";
  const ANCHOR_NEW = "the old Echo Dice fold into Surge, the eight soma-break feats live on as four tier powers — and the <strong>Dream Echo Reservoir</strong> endures as its own vessel: store a manifestation, release it later at no base cost.";
  const TBD = {
    "[TBD:balance — 1 minute of scene time]": "1 minute of scene time (one round in combat)",
    "[TBD:balance DC]": "DC 17",
    "[TBD:balance — 2 Surge]": "2 Surge",
    "[TBD:balance — psychic damage or OP loss]": "Tier d6 psychic damage (to Stress) — or, against a faction, 1 OP from the relevant bank",
    "[TBD:balance — 1 hour / until resolved]": "one scene, or until formally resolved — whichever ends first",
    "[TBD:balance — 10 minutes of uninterrupted action]": "10 minutes of uninterrupted action",
    "[TBD:balance — 10 Surge]": "10 Surge",
    "[TBD:balance — a session-length stability bonus]": "+2 stability for the rest of the session",
    "[TBD:balance — 3]": "3",
    "[TBD:balance — Soul mod]": "your Soul modifier",
    "[TBD:balance — 8 Surge]": "8 Surge",
    "[TBD:balance — 5]": "5",
    "[TBD:balance — 1 hour]": "one hour",
    "[TBD:balance — 4 Surge]": "4 Surge",
    "[TBD:balance — 10+]": "10 or more",
    "[TBD:balance — stability bonus]": "a +2 stability bonus",
    "[TBD:balance — a week]": "one week",
    "[TBD:balance — 1 week or until formally contested]": "one week, or until formally contested"
  };
  const BAL_NOTE = "<p><em>Balance pass 2026-08-23: all costs and durations finalized against the live Surge economy and DC ladder.</em></p>";
  const SUBCLASSES = ["Auditor (Bad Eden)", "Archivist of Precedent (Bad Eden)", "Steward of Living Communities (Bad Eden)"];

  const wasLocked = PACK.locked;
  if (!DRY_RUN && wasLocked) await PACK.configure({ locked: false });
  const docs = await PACK.getDocuments();
  const byName = new Map(docs.map(d => [d.name, d]));
  let updated = 0;

  const setDesc = async (name, fn) => {
    const doc = byName.get(name);
    if (!doc) return console.warn(`[reservoir-patch] missing pack doc: ${name}`);
    const cur = doc.system?.description?.value ?? "";
    const next = fn(cur);
    if (next === cur) return console.log(`[reservoir-patch] ok (already): ${name}`);
    updated++;
    console.log(`[reservoir-patch] update: ${name}`);
    if (!DRY_RUN) await doc.update({ "system.description.value": next });
  };

  await setDesc("Dream Echo Reservoir", () => RES_TXT);
  await setDesc("Dreamwalker", cur => cur.includes(ANCHOR_OLD) ? cur.replace(ANCHOR_OLD, ANCHOR_NEW) : cur);
  for (const n of SUBCLASSES) {
    await setDesc(n, cur => {
      let t = cur;
      for (const [k, v] of Object.entries(TBD)) t = t.split(k).join(v);
      if (!t.includes("Balance pass 2026-08-23")) t += BAL_NOTE;
      return t;
    });
  }
  if (!DRY_RUN && wasLocked) await PACK.configure({ locked: true });

  // Actor-side sync for the five names.
  let synced = 0;
  const NAMES = new Set(["Dream Echo Reservoir", "Dreamwalker", ...SUBCLASSES]);
  const fresh = new Map((await PACK.getDocuments()).map(d => [d.name, d]));
  for (const a of game.actors.contents) {
    for (const it of a.items) {
      if (!NAMES.has(it.name)) continue;
      const src = fresh.get(it.name);
      const newDesc = src?.system?.description?.value;
      const curDesc = it.system?.description?.value ?? it.system?.description;
      if (typeof newDesc === "string" && newDesc && newDesc !== curDesc) {
        synced++;
        console.log(`[reservoir-patch] ${a.name} › ${it.name}: description synced`);
        if (!DRY_RUN) await it.update({ "system.description.value": newDesc });
      }
    }
  }
  const msg = `[reservoir-patch] ${DRY_RUN ? "DRY RUN — " : ""}pack docs updated ${updated} · actor items synced ${synced}`;
  console.log(msg);
  ui.notifications.info(msg + (DRY_RUN ? " (set DRY_RUN=false to apply)" : ""));
})();
