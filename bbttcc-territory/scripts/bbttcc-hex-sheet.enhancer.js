// modules/bbttcc-territory/scripts/bbttcc-hex-sheet.enhancer.js
// BBTTCC — Hex Sheet 3.0 (4X Strategy Tile View, read-only)
//
// Provides a "nice" sheet for a Territory Hex (drawing or tile) with:
// - Left 1/3 art panel
// - Right 2/3 data: summary, resources, modifiers, tracks
// - Integration / Radiation / Darkness tracks as hex pips
// - Gold/Sapphire chips for modifiers
//
// Does NOT replace the existing Hex Config UI; it's a display layer only.
//
// API: game.bbttcc.api.territory.openHexSheet(hexUuid)
// Example:
//   game.bbttcc.api.territory.openHexSheet("Scene.XYZ.SceneId.Drawing.ABC");

(() => {
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc-hex-sheet]";

  const App2 = foundry?.applications?.api?.ApplicationV2 || Application;

  function ensureNS() {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= game.bbttcc.api || {};
    game.bbttcc.api.territory ??= game.bbttcc.api.territory || {};
  }

  const OP_ICON = {
    economy:    "💰",
    intrigue:   "🕵",
    faith:      "🌞",
    logistics:  "📦",
    culture:    "🎨",
    violence:   "⚔",
    nonlethal:  "🛡",
    diplomacy:  "🕊",
    softpower:  "🎭",
    softPower:  "🎭",
    materials:  "⛏"
  };

  const RES_LABEL = {
    economy:    "Economy",
    intrigue:   "Intrigue",
    faith:      "Faith",
    logistics:  "Logistics",
    culture:    "Culture",
    violence:   "Violence",
    nonlethal:  "Non-Lethal",
    diplomacy:  "Diplomacy",
    softpower:  "Soft Power",
    softPower:  "Soft Power",
    materials:  "Materials"
  };

  const HEX_GLYPH = "⬢"; // hexagon-like glyph

  class BBTTCC_HexSheet extends App2 {
    static get defaultOptions() {
      return {
        id: "bbttcc-hex-sheet",
        title: "BBTTCC — Hex Sheet",
        classes: ["bbttcc","bbttcc-hex-sheet"],
        width: 960,
        height: 600,
        resizable: true,
        minimizable: true,
        positionOrtho: true
      };
    }

    static PARTS = { body: { template: null } };

    constructor(hexUuid, options={}) {
      super(options);
      this.hexUuid = hexUuid;
    }

    /** Resolve the hex document WITHOUT using fromUuid, to avoid socket/uuid issues. */
    async _getHexDoc() {
      if (!this.hexUuid) return null;
      const raw = String(this.hexUuid);

      // Case 1: Scene.{sceneId}.Drawing.{drawingId} or .Tile.{tileId}
      const parts = raw.split(".");
      if (parts[0] === "Scene" && parts.length >= 4) {
        const sceneId    = parts[1];
        const collection = parts[2];
        const docId      = parts[3];
        const sc         = game.scenes?.get(sceneId);
        if (sc) {
          if (collection === "Drawing" && sc.drawings) {
            const d = sc.drawings.get(docId);
            if (d) return d;
          }
          if (collection === "Tile" && sc.tiles) {
            const t = sc.tiles.get(docId);
            if (t) return t;
          }
        }
      }

      // Case 2: Full UUID match on any drawing/tile in any scene
      try {
        for (const sc of game.scenes || []) {
          for (const d of sc.drawings?.contents || []) {
            if (d.uuid === raw) return d;
          }
          for (const t of sc.tiles?.contents || []) {
            if (t.uuid === raw) return t;
          }
        }
      } catch (e) {
        console.warn(TAG, "Scene scan failed while looking for hex uuid", raw, e);
      }

      console.warn(TAG, "Unable to resolve hex for uuid", raw);
      return null;
    }

    async _renderInner() {
      const wrap = document.createElement("section");
      wrap.className = "bbttcc-hex-sheet";
      wrap.style.display = "flex";
      wrap.style.flexDirection = "row";
      wrap.style.height = "100%";
      wrap.style.background = "linear-gradient(135deg, #020617, #020617 40%, #020617 100%)";
      wrap.style.color = "#e5e7eb";
      wrap.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

      const doc = await this._getHexDoc();
      if (!doc) {
        const msg = document.createElement("div");
        msg.style.margin = "12px";
        msg.style.fontSize = "0.9rem";
        msg.textContent = "Could not resolve hex for UUID: " + this.hexUuid;
        wrap.appendChild(msg);
        return wrap;
      }

      const tf  = doc?.flags?.[MOD_T] || {};
      const name        = tf.name       || doc?.text || doc?.name || "Unnamed Hex";
      const ownerId     = tf.factionId  || tf.ownerId || "";
      const status      = tf.status     || "Unclaimed";
      const terrain     = tf.terrain    || tf.terrainKey || "Unknown Terrain";
      const type        = tf.type       || "Standard";
      const size        = tf.size       || tf.sizeKey || "";
      const population  = tf.population || tf.popKey  || "";
      const alignment   = tf.sephirahKey || tf.alignment || "";
      const conditions  = Array.isArray(tf.conditions) ? tf.conditions : [];
      const modifiers   = Array.isArray(tf.modifiers) ? tf.modifiers : [];
      const resources   = tf.resources || {};
      const integration = tf.integration || {};
      const integProg   = Number(integration.progress ?? 0);
      const integStage  = integration.stageLabel || integration.stage || "";
      const notes       = tf.notes || tf.note || "";

      const modsObj     = tf.mods || {};
      const radiation   = Number(modsObj.radiation || 0);
      const darkness    = Number(modsObj.darkness  || 0);

      const owner = ownerId ? game.actors.get(ownerId) : null;

      /* LEFT PANEL — ART / SUMMARY */
      const left = document.createElement("div");
      left.className = "bbttcc-hex-sheet-left";
      left.style.flex = "0 0 32%";
      left.style.display = "flex";
      left.style.flexDirection = "column";
      left.style.padding = "10px 12px";
      left.style.boxSizing = "border-box";
      left.style.borderRight = "1px solid rgba(148,163,184,0.6)";

      const art = document.createElement("div");
      art.style.flex = "0 0 220px";
      art.style.borderRadius = "12px";
      art.style.border = "1px solid rgba(148,163,184,0.9)";
      art.style.boxShadow = "0 10px 30px rgba(15,23,42,0.9)";
      art.style.background = "radial-gradient(circle at top, #22c55e33, #0f172a 60%, #020617 100%)";
      art.style.display = "flex";
      art.style.flexDirection = "column";
      art.style.justifyContent = "space-between";
      art.style.padding = "10px 12px";

      const artTitle = document.createElement("div");
      artTitle.style.fontSize = "1.05rem";
      artTitle.style.fontWeight = "700";
      artTitle.style.letterSpacing = "0.06em";
      artTitle.style.textTransform = "uppercase";
      artTitle.textContent = name;

      const artSub = document.createElement("div");
      artSub.style.fontSize = "0.8rem";
      artSub.style.opacity = "0.85";
      artSub.textContent = `${terrain} • ${type || "Hex"}`;

      const artBadge = document.createElement("div");
      artBadge.style.alignSelf = "flex-end";
      artBadge.style.fontSize = "0.8rem";
      artBadge.style.padding = "4px 8px";
      artBadge.style.borderRadius = "999px";
      artBadge.style.border = "1px solid rgba(251,191,36,0.9)";
      artBadge.style.background = "rgba(15,23,42,0.9)";
      artBadge.style.color = "#facc15";
      artBadge.style.display = "inline-flex";
      artBadge.style.alignItems = "center";
      artBadge.style.gap = "4px";
      artBadge.innerHTML = `⬢ <span>${status}</span>`;

      art.appendChild(artTitle);
      art.appendChild(artSub);
      art.appendChild(artBadge);
      left.appendChild(art);

      // Owner / alignment
      const ownerBlock = document.createElement("div");
      ownerBlock.style.marginTop = "12px";
      ownerBlock.style.padding = "8px 10px";
      ownerBlock.style.borderRadius = "8px";
      ownerBlock.style.background = "rgba(15,23,42,0.9)";
      ownerBlock.style.border = "1px solid rgba(55,65,81,0.9)";

      const ownerLabel = document.createElement("div");
      ownerLabel.style.fontSize = "0.8rem";
      ownerLabel.style.opacity = "0.85";
      ownerLabel.textContent = "Owner";

      const ownerName = document.createElement("div");
      ownerName.style.fontSize = "0.95rem";
      ownerName.style.fontWeight = "600";
      ownerName.textContent = owner?.name || "Unclaimed";

      const alignRow = document.createElement("div");
      alignRow.style.marginTop = "4px";
      alignRow.style.fontSize = "0.8rem";
      alignRow.style.display = "flex";
      alignRow.style.justifyContent = "space-between";
      alignRow.style.opacity = "0.9";
      alignRow.innerHTML = `
        <span><strong>Size:</strong> ${size || "—"}</span>
        <span><strong>Population:</strong> ${population || "—"}</span>
      `;

      const alignRow2 = document.createElement("div");
      alignRow2.style.marginTop = "2px";
      alignRow2.style.fontSize = "0.8rem";
      alignRow2.style.opacity = "0.9";
      alignRow2.innerHTML = `<strong>Alignment:</strong> ${alignment || "—"}`;

      ownerBlock.appendChild(ownerLabel);
      ownerBlock.appendChild(ownerName);
      ownerBlock.appendChild(alignRow);
      ownerBlock.appendChild(alignRow2);
      left.appendChild(ownerBlock);

      // Conditions
      if (conditions && conditions.length) {
        const condBlock = document.createElement("div");
        condBlock.style.marginTop = "10px";
        condBlock.style.fontSize = "0.8rem";
        condBlock.innerHTML = `<div style="opacity:.85; margin-bottom:2px;">Conditions</div>`;
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.flexWrap = "wrap";
        row.style.gap = "4px";

        for (const c of conditions) {
          const chip = document.createElement("span");
          chip.textContent = c;
          chip.style.padding = "2px 6px";
          chip.style.borderRadius = "999px";
          chip.style.fontSize = "0.75rem";
          chip.style.border = "1px solid rgba(251,191,36,0.9)";
          chip.style.background =
            c === "Radiated" ? "rgba(248,113,113,0.12)" :
            c === "Purified" ? "rgba(59,130,246,0.12)" :
            "rgba(30,64,175,0.15)";
          chip.style.color = "#fef9c3";
          row.appendChild(chip);
        }

        condBlock.appendChild(row);
        left.appendChild(condBlock);
      }

      /* RIGHT PANEL — DATA */
      const right = document.createElement("div");
      right.className = "bbttcc-hex-sheet-right";
      right.style.flex = "1 1 auto";
      right.style.display = "flex";
      right.style.flexDirection = "column";
      right.style.padding = "10px 12px";
      right.style.boxSizing = "border-box";

      // Resources
      const resSection = document.createElement("section");
      resSection.style.borderRadius = "8px";
      resSection.style.border = "1px solid rgba(55,65,81,0.9)";
      resSection.style.background = "rgba(15,23,42,0.9)";
      resSection.style.padding = "6px 8px";
      resSection.style.marginBottom = "8px";

      const resHeader = document.createElement("div");
      resHeader.style.fontSize = "0.85rem";
      resHeader.style.fontWeight = "600";
      resHeader.style.borderBottom = "1px solid rgba(75,85,99,0.9)";
      resHeader.style.paddingBottom = "2px";
      resHeader.style.marginBottom = "4px";
      resHeader.textContent = "Resources / Yields (per Strategic Turn)";
      resSection.appendChild(resHeader);

      const resGrid = document.createElement("div");
      resGrid.style.display = "grid";
      resGrid.style.gridTemplateColumns = "repeat(3, minmax(0,1fr))";
      resGrid.style.gap = "4px 10px";

      const resKeys = Object.keys(resources || {});
      if (!resKeys.length) {
        const msg = document.createElement("div");
        msg.style.fontSize = "0.8rem";
        msg.style.opacity = "0.8";
        msg.textContent = "No resource pips configured for this hex.";
        resSection.appendChild(msg);
      } else {
        for (const k of resKeys) {
          const v = Number(resources[k] || 0);
          const lbl = RES_LABEL[k] || k;
          const icon = OP_ICON[k] || "⬡";

          const row = document.createElement("div");
          row.style.fontSize = "0.8rem";
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.gap = "4px";

          const labelSpan = document.createElement("span");
          labelSpan.style.minWidth = "100px";
          labelSpan.textContent = `${icon} ${lbl}`;

          const pipsSpan = document.createElement("span");
          pipsSpan.style.letterSpacing = "1px";
          pipsSpan.style.fontSize = "0.85rem";

          if (v <= 6) pipsSpan.textContent = "●".repeat(v);
          else        pipsSpan.textContent = `●×${v}`;

          row.appendChild(labelSpan);
          row.appendChild(pipsSpan);
          resGrid.appendChild(row);
        }
        resSection.appendChild(resGrid);
      }

      right.appendChild(resSection);

      // Modifiers
      const modsSection = document.createElement("section");
      modsSection.style.borderRadius = "8px";
      modsSection.style.border = "1px solid rgba(55,65,81,0.9)";
      modsSection.style.background = "rgba(15,23,42,0.9)";
      modsSection.style.padding = "6px 8px";
      modsSection.style.marginBottom = "8px";

      const modsHeader = document.createElement("div");
      modsHeader.style.fontSize = "0.85rem";
      modsHeader.style.fontWeight = "600";
      modsHeader.style.borderBottom = "1px solid rgba(75,85,99,0.9)";
      modsHeader.style.paddingBottom = "2px";
      modsHeader.style.marginBottom = "4px";
      modsHeader.textContent = "Modifiers & Tags";
      modsSection.appendChild(modsHeader);

      const modsGrid = document.createElement("div");
      modsGrid.style.display = "flex";
      modsGrid.style.flexWrap = "wrap";
      modsGrid.style.gap = "4px";

      if (!modifiers || !modifiers.length) {
        const msg = document.createElement("div");
        msg.style.fontSize = "0.8rem";
        msg.style.opacity = "0.8";
        msg.textContent = "No modifiers applied.";
        modsSection.appendChild(msg);
      } else {
        for (const m of modifiers) {
          const chip = document.createElement("span");
          chip.textContent = m;
          chip.style.fontSize = "0.75rem";
          chip.style.padding = "2px 6px";
          chip.style.borderRadius = "999px";
          chip.style.border = "1px solid rgba(251,191,36,0.9)"; // gold
          chip.style.background = "rgba(30,64,175,0.35)";       // sapphire-ish
          chip.style.color = "#fef9c3";
          chip.style.whiteSpace = "nowrap";
          modsGrid.appendChild(chip);
        }
        modsSection.appendChild(modsGrid);
      }

      right.appendChild(modsSection);

      // Tracks
      const tracksSection = document.createElement("section");
      tracksSection.style.borderRadius = "8px";
      tracksSection.style.border = "1px solid rgba(55,65,81,0.9)";
      tracksSection.style.background = "rgba(15,23,42,0.9)";
      tracksSection.style.padding = "6px 8px";
      tracksSection.style.marginBottom = "8px";

      const tracksHeader = document.createElement("div");
      tracksHeader.style.fontSize = "0.85rem";
      tracksHeader.style.fontWeight = "600";
      tracksHeader.style.borderBottom = "1px solid rgba(75,85,99,0.9)";
      tracksHeader.style.paddingBottom = "2px";
      tracksHeader.style.marginBottom = "4px";
      tracksHeader.textContent = "Tracks & State";
      tracksSection.appendChild(tracksHeader);

      const makeTrackRow = (label, value, max, color) => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.fontSize = "0.8rem";
        row.style.marginBottom = "2px";

        const l = document.createElement("span");
        l.textContent = label;

        const pips = document.createElement("span");
        pips.style.letterSpacing = "2px";
        pips.style.fontSize = "0.9rem";
        pips.style.color = color;

        const val = Math.max(0, Math.min(max, Number(value || 0)));
        let str = "";
        for (let i=0;i<max;i++) {
          str += (i < val) ? HEX_GLYPH : "◌";
        }
        pips.textContent = str;

        row.appendChild(l);
        row.appendChild(pips);
        return row;
      };

      tracksSection.appendChild(
        makeTrackRow(`Integration (${integProg}/6${integStage?` – ${integStage}`:""})`, integProg, 6, "#22c55e")
      );
      tracksSection.appendChild(
        makeTrackRow(`Radiation (${radiation})`, radiation, 6, "#f97316")
      );
      tracksSection.appendChild(
        makeTrackRow(`Local Darkness (${darkness})`, darkness, 6, "#a855f7")
      );

      right.appendChild(tracksSection);

      // Notes
      const notesSection = document.createElement("section");
      notesSection.style.borderRadius = "8px";
      notesSection.style.border = "1px solid rgba(55,65,81,0.9)";
      notesSection.style.background = "rgba(15,23,42,0.9)";
      notesSection.style.padding = "6px 8px";

      const notesHeader = document.createElement("div");
      notesHeader.style.fontSize = "0.85rem";
      notesHeader.style.fontWeight = "600";
      notesHeader.style.borderBottom = "1px solid rgba(75,85,99,0.9)";
      notesHeader.style.paddingBottom = "2px";
      notesHeader.style.marginBottom = "4px";
      notesHeader.textContent = "GM Notes (Hex)";
      notesSection.appendChild(notesHeader);

      const notesBody = document.createElement("div");
      notesBody.style.fontSize = "0.8rem";
      notesBody.style.opacity = notes ? "0.95" : "0.6";
      notesBody.style.whiteSpace = "pre-wrap";
      notesBody.style.maxHeight = "120px";
      notesBody.style.overflowY = "auto";
      notesBody.textContent = notes || "No notes stored on this hex.";
      notesSection.appendChild(notesBody);

      right.appendChild(notesSection);

      wrap.appendChild(left);
      wrap.appendChild(right);

      return wrap;
    }

    async _renderHTML() {
      const html = await this._renderInner();
      return { html, parts:{ body: html } };
    }

    async _replaceHTML(result) {
      const node = result?.html ?? result;
      if (node) this.element.replaceChildren(node);
      return this.element;
    }
  }

  Hooks.once("ready", () => {
    ensureNS();
    game.bbttcc.api.territory.openHexSheet = (hexUuid) => {
      if (!hexUuid) {
        ui.notifications?.warn?.("openHexSheet: hexUuid required.");
        return null;
      }
      try {
        const app = new BBTTCC_HexSheet(hexUuid);
        app.render(true, { focus:true });
        return app;
      } catch (e) {
        console.warn(TAG, "openHexSheet failed:", e);
        ui.notifications?.error?.("Failed to open Hex Sheet (see console).");
        return null;
      }
    };
    console.log(TAG, "Hex Sheet 3.0 enhancer installed. Use game.bbttcc.api.territory.openHexSheet(uuid).");
  });

})();
