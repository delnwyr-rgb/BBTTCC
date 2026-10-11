/* ─────────────────────────────────────────────────────────────────────────────
 * roll-for-initiation-bad-eden · module.js — THE FRONT DOOR (2026-10-11)
 * ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden ships as ~25 modules. This one carries no engine of its own: its
 * manifest `requires` every shared part (Foundry enables them with it and, once
 * the parts have manifest/download URLs, installs them with it) and `recommends`
 * the system-specific ones — bbttcc-epic / bbttcc-onboarding on fourththing,
 * surge-powers / bad-eden-5e / dnd5e-table-kit on dnd5e. At ready it checks the
 * parts for the running system and tells the GM what's missing, once per world.
 * ───────────────────────────────────────────────────────────────────────────── */
const ID = "roll-for-initiation-bad-eden";
const TAG = `[${ID}]`;

Hooks.once("init", () => {
  game.settings.register(ID, "checkedVersion", { scope: "world", config: false, type: String, default: "" });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const me = game.modules.get(ID);
  const parts = me?.flags?.[ID] ?? {};
  const sys = game.system.id;
  const wanted = new Set([
    ...(me?.relationships?.requires ?? []).map(r => r.id),
    ...(sys === "fourththing" ? parts.rfiOnly ?? [] : []),
    ...(sys === "dnd5e" ? parts.dnd5eOnly ?? [] : [])
  ]);
  const missing = [...wanted].filter(id => !game.modules.get(id));
  const inactive = [...wanted].filter(id => game.modules.get(id) && !game.modules.get(id).active);
  console.log(TAG, `Bad Eden on ${sys}: ${wanted.size} parts wanted, ${missing.length} not installed, ${inactive.length} installed but off`);
  if (!missing.length && !inactive.length) return;
  const key = `${me.version}:${sys}`;
  if (game.settings.get(ID, "checkedVersion") === key) return;   // nag once per version per world
  await game.settings.set(ID, "checkedVersion", key);
  const li = (ids) => ids.map(id => `<li><code>${id}</code></li>`).join("");
  ChatMessage.create({ whisper: [game.user.id], content: `<div class="bad-eden-front-door"><h3>Roll For Initiation – Bad Eden</h3>
    ${missing.length ? `<p>Not installed (install them from the Add-on Modules browser, then enable):</p><ul>${li(missing)}</ul>` : ""}
    ${inactive.length ? `<p>Installed but not enabled for this world (Manage Modules):</p><ul>${li(inactive)}</ul>` : ""}
    <p style="opacity:.75;font-size:.85em">You'll see this once per Bad Eden version.</p></div>` });
});
