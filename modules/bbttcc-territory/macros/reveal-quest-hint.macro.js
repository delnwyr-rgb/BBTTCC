// Bad Eden Reveal Quest Hint
// GM macro — pick a quest, then click a Bad Eden hex on the canvas to mark
// the link "hinted" so players see the 📜 scroll marker even while the hex
// is still under fog. Use for "you've heard whispers about a faraway place"
// flavor before the hex itself is uncovered.

(async () => {
  if (!game.user?.isGM) { ui.notifications.warn("GM only."); return; }

  const ql = game?.bbttcc?.api?.territory?.questLinks;
  const cApi = game?.bbttcc?.api?.campaign?.quests;
  if (!ql || !cApi) { ui.notifications.error("Quest-links / campaign API not loaded."); return; }

  const all = cApi.listQuests({ status: "all" }) || [];
  if (!all.length) { ui.notifications.warn("No quests in registry."); return; }

  const opts = all.map(q => `<option value="${q.id}">${q.name} [${q.status}]</option>`).join("");
  const choice = await new Promise(resolve => {
    new Dialog({
      title: "Reveal Quest Hint — pick quest",
      content: `<form>
        <div class="form-group"><label>Quest</label><select name="qid">${opts}</select></div>
        <p class="notes" style="margin-top:6px; opacity:.8;">After clicking OK, click a Bad Eden hex on the canvas. The hex will be linked to this quest (if it isn't already) and the hint flag set so players see the scroll marker even while the hex is fogged.</p>
      </form>`,
      buttons: {
        ok: { label: "Pick Hex", callback: ($html) => {
          const r = $html?.[0] ?? $html;
          resolve(r?.querySelector?.('[name="qid"]')?.value || null);
        }},
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok"
    }).render(true);
  });
  if (!choice) return;

  ui.notifications.info("Click a Bad Eden hex on the canvas to reveal a hint for this quest.");
  const onClick = async (event) => {
    try {
      const local = event?.data?.getLocalPosition?.(canvas.app.stage);
      let pick = null;
      if (local) {
        for (const p of (canvas.drawings?.placeables || [])) {
          const d = p?.document; if (!d) continue;
          const f = d.flags?.["bbttcc-territory"]; if (!f) continue;
          const isHex = (f.isHex === true) || (f.kind === "territory-hex")
            || (d.shape?.type === "p" && Array.isArray(d.shape?.points) && d.shape.points.length === 12);
          if (!isHex) continue;
          const b = { minX: d.x, minY: d.y, maxX: d.x + (d.shape?.width || 0), maxY: d.y + (d.shape?.height || 0) };
          if (local.x >= b.minX && local.x <= b.maxX && local.y >= b.minY && local.y <= b.maxY) { pick = p; break; }
        }
      }
      if (!pick?.document) { ui.notifications.warn("Not a hex — cancelled."); return; }
      const did = pick.document.id;
      const links = ql.listQuestsForHex(did);
      if (!links.find(l => l.questId === choice)) {
        await ql.linkHexQuest(did, choice, { hinted: true });
        ui.notifications.info("Hex linked to quest with hint revealed.");
      } else {
        await ql.setHint(did, choice, { hinted: true });
        ui.notifications.info("Quest hint revealed on this hex.");
      }
    } catch (e) {
      console.warn("[bbttcc-reveal-quest-hint] failed", e);
    } finally {
      canvas.stage?.off("pointerdown", onClick);
    }
  };
  canvas.stage?.once("pointerdown", onClick);
})();
