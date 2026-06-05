// modules/bbttcc-raid/scripts/tableau.directional-art.js
//
// BBTTCC Directional Token Art — facing-aware token artwork
// Lineage: the standalone "directional-token-art" module (pre-monorepo),
// rebuilt as a tableau-substrate sibling. Works on ANY scene, per-token
// opt-in — the forced-perspective tableau is just where it shines.
//
// A token carries up to four artworks (front/back/left/right). When it moves
// or rotates, the matching artwork is injected into the SAME document update
// via preUpdateToken — one DB write, no flicker, persists and broadcasts to
// every client. (The legacy module compared positions in updateToken, where
// _source already holds the NEW coords, so movement-swap never actually
// fired. preUpdate is the only place old-vs-new is still comparable.)
//
// Visual semantics on a tableau (forced-perspective diorama):
//   south = moving DOWN  = toward camera   = front view
//   north = moving UP    = away from camera = back view
//   east  = moving RIGHT = right profile
//   west  = moving LEFT  = left profile
//
// Mirror fallback: provide only ONE side profile and the other side reuses it
// horizontally flipped (texture.scaleX sign). Halves the art players need.
// The sign is only touched when a mirror state actually changes, so a token
// that never mirrors never has its scaleX managed.
//
// Actor-level library copy: save the image set to the ACTOR (default in the
// config dialog) and every token it spawns — now and forever — inherits it,
// no per-spawn setup. Token-level config remains a per-token override
// (enabled:false explicitly opts one token out). Facing is always per-token.
//
// Config UI: 🧭 compass button on the Token HUD — GM and token OWNERS alike
// (players upload their own art; FilePicker honors their upload permissions).
// Manual rotation: core Foundry already rotates controlled tokens with
// SHIFT+arrows / SHIFT+WASD — the legacy module's custom listener is gone.

(() => {
  const MOD = "bbttcc-raid";
  const TAG = "[bbttcc-raid/directional-art]";
  const FLAG = "directionalArt";

  const SET_MOVE = "directionalArtOnMove";
  const SET_ROT  = "directionalArtOnRotate";

  // Ignore sub-threshold jitters (grid snap wobble, nudge artifacts).
  const MIN_MOVE_PX = 10;

  const DIR_KEYS = Object.freeze(["south", "north", "east", "west"]);

  // --- Direction math --------------------------------------------------------
  // Screen coords: +x = east/right, +y = SOUTH/down (toward tableau camera).
  // atan2 convention: 0° = east, 90° = south, 180° = west, 270° = north.

  function dirFromAngle(deg) {
    const a = ((Number(deg) % 360) + 360) % 360;
    if (a < 45 || a >= 315) return "east";
    if (a < 135) return "south";
    if (a < 225) return "west";
    return "north";
  }

  const dirFromDelta = (dx, dy) => dirFromAngle(Math.atan2(dy, dx) * 180 / Math.PI);

  // Foundry token rotation: 0 = facing south (down), and core's own
  // rotate-toward-movement uses atan2(dy,dx) - 90. Invert: facing = rot + 90.
  const dirFromRotation = (rot) => dirFromAngle(Number(rot) + 90);

  // --- Flag access -----------------------------------------------------------
  // Config lives at TWO levels:
  //   * ACTOR  flags.bbttcc-raid.directionalArt {enabled, images} — the
  //     library copy, tied to the actor document (travels with its UUID,
  //     exports, compendia). Every token the actor spawns inherits it —
  //     configure once, every drop is directional from birth.
  //   * TOKEN  same path — a per-token override. enabled:true beats the
  //     actor; enabled:false explicitly opts THIS token out. A bare
  //     {facing} stamp (from movement) does NOT count as an override.
  // Facing is ALWAYS per-token (two tokens of one actor face independently).

  function baseActorOf(tokenDoc) {
    return tokenDoc?.actorId ? (game.actors?.get(tokenDoc.actorId) ?? null) : null;
  }

  function getFacing(tokenDoc) {
    return tokenDoc?.flags?.[MOD]?.[FLAG]?.facing ?? "south";
  }

  function getDirArt(tokenDoc) {
    const own = tokenDoc?.flags?.[MOD]?.[FLAG];
    if (own?.enabled === true) return own;
    if (own?.enabled === false) return null; // explicit per-token opt-out
    const actor = tokenDoc?.actor ?? baseActorOf(tokenDoc);
    const inherited = actor?.flags?.[MOD]?.[FLAG];
    return inherited?.enabled === true ? inherited : null;
  }

  // Resolve the artwork for a direction. Mirror fallback: a missing side
  // profile reuses the other side flipped. Front/back have no fallback —
  // a missing slot just keeps the current art (facing is still recorded).
  function resolveArt(images, dir) {
    const own = images?.[dir];
    if (typeof own === "string" && own.trim()) return { src: own, flip: false };
    if (dir === "east" && images?.west) return { src: images.west, flip: true };
    if (dir === "west" && images?.east) return { src: images.east, flip: true };
    return null;
  }

  // Stamp facing + art into a pending `changes` object (preUpdate injection)
  // or a fresh one (manual setDirection). Only writes texture keys that
  // actually differ, so no-op facings cost nothing.
  function applyFacingToChanges(doc, cfg, dir, changes) {
    foundry.utils.setProperty(changes, `flags.${MOD}.${FLAG}.facing`, dir);
    const art = resolveArt(cfg.images, dir);
    if (!art) return;
    if (art.src !== doc.texture?.src) {
      foundry.utils.setProperty(changes, "texture.src", art.src);
    }
    const curFlip = (doc.texture?.scaleX ?? 1) < 0;
    if (art.flip !== curFlip) {
      const mag = Math.abs(doc.texture?.scaleX ?? 1) || 1;
      foundry.utils.setProperty(changes, "texture.scaleX", art.flip ? -mag : mag);
    }
  }

  async function setDirection(tokenOrDoc, dir) {
    const doc = tokenOrDoc?.document ?? tokenOrDoc;
    const cfg = getDirArt(doc);
    if (!cfg) return ui.notifications?.warn("Directional art is not enabled for this token.");
    if (!DIR_KEYS.includes(dir)) return ui.notifications?.warn(`Unknown direction "${dir}" (use ${DIR_KEYS.join("/")}).`);
    const changes = {};
    applyFacingToChanges(doc, cfg, dir, changes);
    await doc.update(changes);
  }

  // Warm the texture cache so the first swap in each direction doesn't hitch.
  function preloadArt(cfg) {
    const load = foundry.canvas?.loadTexture ?? globalThis.loadTexture;
    if (!load) return;
    for (const dir of DIR_KEYS) {
      const src = cfg?.images?.[dir];
      if (typeof src === "string" && src.trim()) {
        try { load(src); } catch (_e) {}
      }
    }
  }

  // --- The core hooks: stamp facing on the move, swap art AT REST -------------
  // v1 injected texture.src into the movement update itself. That entangled
  // the swap with the movement animation: a texture change forces a FULL token
  // redraw at animation end (bars/border flash at natural size, then the
  // tableau re-shrinks them = scale pop), and fast successive drags cancel
  // the crossfade mid-flight, leaving the VISUAL texture stale while the
  // document was already correct — a stuck facing no further diff would heal.
  //
  // v2: preUpdateToken (initiating client, old coords still comparable) only
  // stamps the facing FLAG — cheap, no redraw, rides the move. The art swap
  // itself happens after the movement animation settles, as its own update,
  // always derived from the LATEST facing vs the live document. Rapid moves
  // coalesce to a single swap; the swap crossfades while the token is at
  // rest, where the end-of-transition redraw is barely noticeable.

  Hooks.on("preUpdateToken", (doc, changes) => {
    try {
      const cfg = getDirArt(doc);
      if (!cfg) return;
      // An explicit texture change riding this update (our own settle-swap,
      // a polymorph, a wildcard re-roll) owns the art — don't restamp facing.
      if (foundry.utils.getProperty(changes, "texture.src") !== undefined) return;

      let dir = null;
      if ((changes.x !== undefined || changes.y !== undefined) && game.settings.get(MOD, SET_MOVE)) {
        const dx = (changes.x ?? doc.x) - doc.x;
        const dy = (changes.y ?? doc.y) - doc.y;
        if (Math.hypot(dx, dy) >= MIN_MOVE_PX) dir = dirFromDelta(dx, dy);
      }
      // Rotation beats movement when both ride one update (explicit intent).
      if (changes.rotation !== undefined && game.settings.get(MOD, SET_ROT)) {
        dir = dirFromRotation(changes.rotation);
      }
      if (!dir || dir === getFacing(doc)) return;

      foundry.utils.setProperty(changes, `flags.${MOD}.${FLAG}.facing`, dir);
    } catch (e) { console.warn(TAG, "preUpdateToken facing failed", e); }
  });

  // Facing changed → wait out the movement animation, then swap the art.
  // Initiator-only (one client writes); per-token guard coalesces bursts.
  const _settling = new Set();

  async function settleThenSwap(doc) {
    if (_settling.has(doc.uuid)) return;
    _settling.add(doc.uuid);
    try {
      // Chained drags spawn fresh animation contexts — loop until quiet.
      let p;
      while ((p = doc.object?.movementAnimationPromise)) await p;
      const cfg = getDirArt(doc);
      if (!cfg) return;
      const art = resolveArt(cfg.images, getFacing(doc));
      if (!art) return;
      const changes = {};
      if (art.src !== doc.texture?.src) changes["texture.src"] = art.src;
      const curFlip = (doc.texture?.scaleX ?? 1) < 0;
      if (art.flip !== curFlip) {
        changes["texture.scaleX"] = (art.flip ? -1 : 1) * (Math.abs(doc.texture?.scaleX ?? 1) || 1);
      }
      if (Object.keys(changes).length) await doc.update(changes);
    } catch (e) { console.warn(TAG, "settle-swap failed", e); }
    finally { _settling.delete(doc.uuid); }
  }

  Hooks.on("updateToken", (doc, changes, _options, userId) => {
    try {
      if (userId !== game.user.id) return;
      if (foundry.utils.getProperty(changes, `flags.${MOD}.${FLAG}.facing`) === undefined) return;
      settleThenSwap(doc);
    } catch (e) { console.warn(TAG, "updateToken facing watch failed", e); }
  });

  // Fresh spawn of an actor with a library copy → snap to facing art at once
  // (the prototype texture may not be the front view). settleThenSwap is a
  // no-op when the art already matches.
  Hooks.on("createToken", (doc, _options, userId) => {
    try {
      if (userId !== game.user.id) return;
      const cfg = getDirArt(doc);
      if (!cfg) return;
      preloadArt(cfg);
      settleThenSwap(doc);
    } catch (e) { console.warn(TAG, "createToken snap failed", e); }
  });

  // Warm caches when a scene loads so direction swaps are instant.
  Hooks.on("canvasReady", () => {
    try {
      for (const doc of canvas?.scene?.tokens ?? []) {
        const cfg = getDirArt(doc);
        if (cfg) preloadArt(cfg);
      }
    } catch (_e) {}
  });

  // --- Config dialog ----------------------------------------------------------

  const _esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  // Labels speak tableau: what the player sees, not compass jargon.
  const ROWS = Object.freeze([
    { key: "south", label: "Front",         icon: "fa-arrow-down",  hint: "Toward camera — moves down" },
    { key: "north", label: "Back",          icon: "fa-arrow-up",    hint: "Away from camera — moves up" },
    { key: "east",  label: "Right profile", icon: "fa-arrow-right", hint: "Moves right" },
    { key: "west",  label: "Left profile",  icon: "fa-arrow-left",  hint: "Moves left" }
  ]);

  function buildFormRows(cfg, actor) {
    const rows = ROWS.map(({ key, label, icon, hint }) => {
      const val = cfg?.images?.[key] ?? "";
      return `
        <div class="form-group">
          <label>${label} <i class="fa-solid ${icon}"></i></label>
          <div class="form-fields">
            <img class="dta-prev" data-for="${key}" src="${_esc(val)}" width="36" height="36"
                 style="flex:0 0 36px; height:36px; object-fit:contain; border:1px solid var(--color-border-light-tertiary, #7a7971); border-radius:3px; ${val ? "" : "visibility:hidden;"}">
            <input type="text" name="${key}" value="${_esc(val)}" placeholder="${hint}">
            <button type="button" class="dta-browse" data-target="${key}" title="Browse" style="flex:0 0 30px;">
              <i class="fa-solid fa-file-import"></i>
            </button>
          </div>
        </div>`;
    }).join("");
    // Default scope = actor: configure once, every spawn of this actor is
    // directional from birth — the whole point of the library copy.
    const scope = actor ? `
      <div class="form-group">
        <label>Save to</label>
        <div class="form-fields" style="flex-direction:column; align-items:flex-start; gap:2px;">
          <label style="font-weight:normal;"><input type="radio" name="scope" value="actor" checked>
            ${_esc(actor.name)} — every token, now and on spawn</label>
          <label style="font-weight:normal;"><input type="radio" name="scope" value="token">
            This token only (override)</label>
        </div>
      </div>` : `<input type="hidden" name="scope" value="token">`;
    return `
      <div class="form-group">
        <label><input type="checkbox" name="enabled" ${cfg?.enabled ? "checked" : ""}> Swap art with facing</label>
      </div>
      ${rows}
      ${scope}
      <p class="notes">Leave one profile empty and it mirrors the other, flipped.
      Art swaps when the token moves (or rotates); SHIFT+arrows rotate in place.</p>`;
  }

  function wireForm(root) {
    if (!root) return;
    root.querySelectorAll("button.dta-browse").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const input = root.querySelector(`input[name="${btn.dataset.target}"]`);
        if (!input) return;
        const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
        new FP({
          type: "imagevideo",
          current: input.value,
          callback: (path) => {
            input.value = path;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }).render(true);
      });
    });
    root.querySelectorAll('input[type="text"][name]').forEach((inp) => {
      inp.addEventListener("change", () => {
        const img = root.querySelector(`img.dta-prev[data-for="${inp.name}"]`);
        if (!img) return;
        img.src = inp.value || "";
        img.style.visibility = inp.value ? "visible" : "hidden";
      });
    });
  }

  async function saveFromForm(doc, form) {
    if (!form) return;
    const fd = new FormDataExtended(form).object;
    const enabled = !!fd.enabled;
    const images = {};
    for (const key of DIR_KEYS) images[key] = (fd[key] ?? "").trim();
    const payload = { enabled, images };

    const actor = doc.actor ?? baseActorOf(doc);
    const toActor = fd.scope === "actor" && actor;
    if (toActor) {
      // Library copy on the BASE actor (synthetic token-actors write through
      // to the world actor) so future spawns inherit it.
      const base = actor.isToken ? (baseActorOf(doc) ?? actor) : actor;
      await base.update({ [`flags.${MOD}.${FLAG}`]: payload });
      // Drop any token-level override so inheritance takes effect here too.
      if (doc.flags?.[MOD]?.[FLAG] !== undefined) {
        await doc.update({ [`flags.${MOD}.-=${FLAG}`]: null });
      }
    } else {
      await doc.update({ [`flags.${MOD}.${FLAG}`]: { ...payload, facing: getFacing(doc) } });
    }

    if (enabled) {
      preloadArt(payload);
      // Snap the art to the current facing immediately — no need to move first.
      const changes = {};
      applyFacingToChanges(doc, payload, getFacing(doc), changes);
      if (foundry.utils.getProperty(changes, "texture.src") !== undefined ||
          foundry.utils.getProperty(changes, "texture.scaleX") !== undefined) {
        await doc.update(changes);
      }
    }
    const where = toActor ? `${actor.name} (all tokens)` : doc.name;
    ui.notifications?.info(`Directional art ${enabled ? "saved" : "disabled"} for ${where}.`);
  }

  async function openConfig(tokenOrDoc) {
    const doc = tokenOrDoc?.document ?? tokenOrDoc;
    if (!doc) return;
    if (!(game.user?.isGM || doc.isOwner)) {
      return ui.notifications?.warn("You can only configure directional art for your own tokens.");
    }
    // Show the EFFECTIVE config: a real token-level override wins (a bare
    // {facing} stamp from movement doesn't count), else the actor's library
    // copy, else blank.
    const own = doc.flags?.[MOD]?.[FLAG];
    const actor = doc.actor ?? baseActorOf(doc);
    const ownIsConfig = own && (own.images !== undefined || own.enabled !== undefined);
    const cfg = ownIsConfig ? own : (actor?.flags?.[MOD]?.[FLAG] ?? { enabled: false, images: {} });
    const rows = buildFormRows(cfg, actor);
    const title = `Directional Art — ${doc.name}`;

    const D2 = foundry.applications?.api?.DialogV2;
    if (D2) {
      // DialogV2 wraps content in its own <form>; pass bare rows.
      await D2.wait({
        window: { title, icon: "fa-solid fa-compass" },
        position: { width: 460 },
        content: rows,
        buttons: [
          {
            action: "save", label: "Save", icon: "fa-solid fa-floppy-disk", default: true,
            callback: (_ev, button) => saveFromForm(doc, button.form)
          },
          { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
        ],
        render: (_ev, dialog) => wireForm(dialog.element ?? dialog),
        rejectClose: false
      });
      return;
    }

    // v11 fallback: classic Dialog needs its own <form> wrapper.
    new Dialog({
      title,
      content: `<form class="bbttcc-directional-art">${rows}</form>`,
      buttons: {
        save: {
          label: "Save", icon: '<i class="fa-solid fa-floppy-disk"></i>',
          callback: (html) => saveFromForm(doc, (html?.[0] ?? html)?.querySelector?.("form"))
        },
        cancel: { label: "Cancel", icon: '<i class="fa-solid fa-xmark"></i>' }
      },
      default: "save",
      render: (html) => wireForm(html?.[0] ?? html)
    }).render(true);
  }

  // --- Token HUD: 🧭 compass — config entry for GM AND token owners -----------
  // Sibling to the tableau 🎭 masks toggle (same .col.right, distinct action).
  // Lit when the token has directional art enabled.

  Hooks.on("renderTokenHUD", (hud, html) => {
    try {
      const doc = hud?.object?.document;
      if (!doc) return;
      if (!(game.user?.isGM || doc.isOwner)) return;
      // v13+ AppV2 HUD is a <form>, and HTMLFormElement[0] indexes its own
      // inputs — only unwrap [0] for actual jQuery (v11/12), never elements.
      const root = html instanceof HTMLElement ? html : (html?.[0] ?? html);
      const col = root?.querySelector?.(".col.right");
      if (!col || col.querySelector('[data-action="bbttcc-directional-art"]')) return;
      const on = !!getDirArt(doc);
      const btn = document.createElement("div");
      btn.className = `control-icon${on ? " active" : ""}`;
      btn.dataset.action = "bbttcc-directional-art";
      btn.title = on
        ? "Directional art: swapping with facing — click to configure"
        : "Directional art: off — click to set up front/back/side art";
      btn.innerHTML = `<i class="fa-solid fa-compass"></i>`;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        openConfig(doc);
      });
      col.appendChild(btn);
    } catch (e) { console.warn(TAG, "token HUD directional-art button failed", e); }
  });

  // --- Settings ----------------------------------------------------------------

  Hooks.once("init", () => {
    game.settings.register(MOD, SET_MOVE, {
      name: "Directional art: swap on movement",
      hint: "Tokens with directional art change artwork to match their movement direction.",
      scope: "world", config: true, type: Boolean, default: true
    });
    game.settings.register(MOD, SET_ROT, {
      name: "Directional art: swap on rotation",
      hint: "Tokens with directional art change artwork when rotated (SHIFT+arrows / mousewheel).",
      scope: "world", config: true, type: Boolean, default: true
    });
  });

  // --- API surface ---------------------------------------------------------------

  Hooks.once("ready", () => {
    if (!game.bbttcc) game.bbttcc = {};
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.raid) game.bbttcc.api.raid = {};
    game.bbttcc.api.raid.directionalArt = {
      DIR_KEYS,
      isEnabled: (tokenOrDoc) => !!getDirArt(tokenOrDoc?.document ?? tokenOrDoc),
      read: (tokenOrDoc) => (tokenOrDoc?.document ?? tokenOrDoc)?.flags?.[MOD]?.[FLAG] ?? null,
      // configure(token, { south, north, east, west }) — per-token override.
      configure: async (tokenOrDoc, images = {}, { enabled = true } = {}) => {
        const doc = tokenOrDoc?.document ?? tokenOrDoc;
        if (!doc?.update) return;
        const clean = {};
        for (const key of DIR_KEYS) clean[key] = (images[key] ?? "").trim?.() ?? "";
        await doc.update({ [`flags.${MOD}.${FLAG}`]: { enabled, images: clean, facing: getFacing(doc) } });
        if (enabled) preloadArt({ images: clean });
      },
      // configureActor(actorOrUuid, images) — the library copy: every token
      // of this actor (current AND future spawns) inherits it. Accepts an
      // Actor document or its UUID ("Actor.abc123" / compendium uuid).
      configureActor: async (actorOrUuid, images = {}, { enabled = true } = {}) => {
        const actor = typeof actorOrUuid === "string" ? await fromUuid(actorOrUuid) : actorOrUuid;
        if (!actor?.update) return ui.notifications?.warn("Actor not found.");
        const clean = {};
        for (const key of DIR_KEYS) clean[key] = (images[key] ?? "").trim?.() ?? "";
        await actor.update({ [`flags.${MOD}.${FLAG}`]: { enabled, images: clean } });
        if (enabled) preloadArt({ images: clean });
        return actor;
      },
      setDirection,
      openConfig,
      dirFromDelta,
      dirFromRotation
    };
    console.log(TAG, "ready. API: game.bbttcc.api.raid.directionalArt");
  });

  console.log(TAG, "Directional Token Art loaded");
})();
