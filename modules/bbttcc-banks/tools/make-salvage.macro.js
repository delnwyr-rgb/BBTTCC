// modules/bbttcc-banks/tools/make-salvage.macro.js
// Bad Eden — Banks & Loot test helper (Phase 2). Stamp a carried item as SALVAGE so
// it refines into Marks when banked at a faction. Paste into a Script Macro and run
// (GM). Until Phase 3's loot system exists, this is how you create salvage to test
// the steward → faction transmute. Idempotent (re-stamps cleanly).

(async () => {
  const MOD = "bbttcc-banks";
  const BUCKETS = ["violence", "nonlethal", "intrigue", "economy", "softpower", "diplomacy", "logistics", "culture", "faith"];

  // Target = selected token's actor, else the first character you own.
  const actor = canvas.tokens?.controlled?.[0]?.actor
    ?? game.actors?.contents?.find(a => a.type === "character" && a.isOwner);
  if (!actor) return ui.notifications.warn("Select a Steward token (or own a character) first.");

  const items = actor.items.filter(i => ["weapon", "armor", "gear"].includes(i.type)
    && !i.system?.manifestation); // physical gear, not manifestations
  if (!items.length) return ui.notifications.warn(`${actor.name} has no plain gear items to stamp as salvage.`);

  const itemOpts = items.map(i => `<option value="${i.id}">${foundry.utils.escapeHTML(i.name)}</option>`).join("");
  const bucketOpts = BUCKETS.map(b => `<option value="${b}"${b === "economy" ? " selected" : ""}>${b}</option>`).join("");

  const content = `
    <div style="display:flex;flex-direction:column;gap:.5rem;">
      <p style="margin:0;opacity:.85;">Stamp an item on <b>${foundry.utils.escapeHTML(actor.name)}</b> as salvage.
      When deposited to a faction it refines into Marks (1 OP = 10 marks; faction bucket cap 50–130).</p>
      <label>Item <select name="item">${itemOpts}</select></label>
      <label>Mark value <input type="number" name="markValue" value="30" min="1" step="1"/></label>
      <label>Bucket <select name="bucket">${bucketOpts}</select></label>
    </div>`;

  new Dialog({
    title: "Make Salvage",
    content,
    buttons: {
      cancel: { label: "Cancel" },
      stamp: {
        label: "Stamp Salvage",
        callback: async (html) => {
          const id = html.find('[name="item"]').val();
          const markValue = Math.max(1, Math.floor(Number(html.find('[name="markValue"]').val()) || 0));
          const bucket = String(html.find('[name="bucket"]').val() || "economy");
          const item = actor.items.get(id);
          if (!item) return ui.notifications.warn("Item not found.");
          await item.setFlag(MOD, "salvage", { markValue, bucket });
          ui.notifications.info(`"${item.name}" → salvage: ${markValue} ${bucket} marks.`);
          if (actor.sheet?.rendered) actor.sheet.render(false);
        },
      },
    },
    default: "stamp",
  }).render(true);
})();
