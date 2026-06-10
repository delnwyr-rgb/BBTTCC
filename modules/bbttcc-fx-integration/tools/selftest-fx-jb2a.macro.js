/*
 * Bad Eden FX — JB2A self-test (RUN IN-WORLD as a GM macro).
 *
 * Verifies the new Sequencer/JB2A wiring end to end without running a raid:
 *  1. confirms Sequencer + JB2A are active and the family keys resolve,
 *  2. fires one centred "raid" effect per family (the no-target case),
 *  3. if you have a token selected, fires one on-target effect,
 *  4. if you pass a hex UUID below, pops a loop above that hex.
 *
 * Set HEX_UUID to a hex Drawing/Tile UUID on the CURRENT scene to test the
 * planner path. Leave null to skip it.
 */
const HEX_UUID = null; // e.g. "Scene.abc.Drawing.def"

const fx = game.bbttcc?.api?.fx;
if (!fx) return ui.notifications.error("[fx selftest] game.bbttcc.api.fx not found — is bbttcc-fx-integration active?");

const seqOk = !!game.modules.get("sequencer")?.active && !!globalThis.Sequence;
const jb2aOk = !!game.modules.get("jb2a_patreon")?.active || !!game.modules.get("JB2A_DnD5e")?.active;
console.log("[fx selftest] sequencer:", seqOk, "| jb2a:", jb2aOk);

const families = ["faith", "void", "temporal", "industrial", "political", "martial", "boss"];
const exists = (k) => !!globalThis.Sequencer?.Database?.entryExists?.(k);
for (const fam of families) {
  const circle = fx.effectForFamily(fam);
  const burst = fx.burstForFamily(fam);
  console.log(`[fx selftest] ${fam.padEnd(10)} circle=${exists(circle)} (${circle}) | burst=${exists(burst)} (${burst})`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 2 + 3: centred (no target) then on-target if a token is selected.
ui.notifications.info("[fx selftest] firing one centred effect per family…");
for (const fam of families) {
  // playKey resolve with no targetToken → centred; with a selected token → on it.
  const ctx = { outcomeLabel: `${fam} test`, targetToken: canvas.tokens?.controlled?.[0] || null };
  await fx.playKey(`__selftest_${fam}`, { ...ctx, family: fam }, { phase: "resolve", family: fam, banner: false });
  await wait(900);
}

// 4: planner hex loop.
if (HEX_UUID) {
  ui.notifications.info("[fx selftest] popping a loop above the hex…");
  await fx.playHexActivity("__selftest_hex", HEX_UUID, {});
}

ui.notifications.info("[fx selftest] done — check the console for key-resolution lines.");
