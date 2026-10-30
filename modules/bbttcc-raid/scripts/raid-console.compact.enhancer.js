/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-raid · raid-console.compact.enhancer.js — compact Raid Console (2026-10-09)
 * ─────────────────────────────────────────────────────────────────────────────
 * Trailer playtest: the GM view stacked BOTH bank tables and THREE full maneuver
 * lists (attacker 34 + defender 48 + support 32 rows) — the console needed
 * scrolling just to reach Commit. This post-render layer applies to every raid
 * mode the console runs (violence / intrigue (Alarm) / presence + courtly):
 *
 *   • Bank tables  → one-line summaries ("Attacker — 56 Viol · 57 Intr …"),
 *                    click to expand (state remembered per console).
 *   • Maneuvers    → Attacker / Defender / Support TABS (count of ticks on
 *                    each tab), one list visible at a time.
 *   • Usable only  → on by default: hides rows the side can't field (gate as
 *                    a player would see it) or can't afford from its bank.
 *                    Ticked rows always stay visible. "+N hidden" shows.
 *   • ↻ Repeat last round → opt-in copy of the previous round's picks (new
 *                    rounds now start clean — module.raid-console.js).
 *
 * Pure DOM/CSS over the console's own markup — no engine state is changed
 * except by the Repeat button (which writes the round's selection arrays the
 * same way ticking does). Re-applied on every render and on in-place picker
 * re-renders (MutationObserver), so it composes with the console's own
 * partial updates.
 * ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const TAG = "[bbttcc-raid/compact]";
  const CLS = "bbttcc-raid-console";
  const STYLE_ID = "bbttcc-raid-compact-style";

  const _esc = (t) => foundry.utils.escapeHTML(String(t ?? ""));
  const _num = (v) => Math.floor(Number(v) || 0);

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      .${CLS} .rc-bank-summary{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;cursor:pointer;
        padding:.25rem .5rem;margin:.15rem 0;border:1px solid rgba(212,163,95,.35);border-radius:6px;
        background:rgba(40,30,12,.55);font-size:.78rem;color:#ffd28a;user-select:none}
      .${CLS} .rc-bank-summary b{color:#fff3d6}
      .${CLS} .rc-bank-summary .rc-caret{opacity:.7;width:1em}
      .${CLS} .rc-bank-summary .rc-chip{opacity:.9;white-space:nowrap}
      .${CLS} section.bbttcc-bank.rc-collapsed{display:none!important}
      .${CLS} .rc-man-tabs{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;margin:.35rem 0 .25rem}
      .${CLS} .rc-man-tab{padding:.2rem .6rem;border-radius:6px;border:1px solid rgba(212,163,95,.4);
        background:rgba(30,22,10,.6);color:#e8d3a8;font-size:.78rem;cursor:pointer}
      .${CLS} .rc-man-tab.active{background:rgba(212,163,95,.28);color:#fff;border-color:rgba(255,210,138,.85)}
      .${CLS} .rc-man-tab .rc-n{font-weight:700;color:#ffd28a;margin-left:.25rem}
      .${CLS} .rc-man-tools{margin-left:auto;display:flex;gap:.45rem;align-items:center;font-size:.74rem;color:#d8c39a}
      .${CLS} .rc-man-tools button{padding:.15rem .5rem;font-size:.74rem}
      .${CLS} .rc-hidden-note{font-size:.7rem;opacity:.65;margin:.1rem 0 .2rem}
      .${CLS} fieldset.bbttcc-mans.rc-tab-off{display:none!important}
      .${CLS} .mans-wrap > label.rc-unusable{display:none!important}
      .${CLS} img.bbttcc-raid-faction-token{width:30px!important;height:30px!important;max-width:30px!important;
        object-fit:cover;border-radius:50%;flex:0 0 30px}
    `;
    document.head.appendChild(st);
  }

  const raidApi = () => game.bbttcc?.api?.raid || null;
  const bankOf = (actor) => actor?.getFlag?.("bbttcc-factions", "opBank") || actor?.flags?.["bbttcc-factions"]?.opBank || {};

  // Cost as marks per pool, case-insensitive (softPower vs softpower).
  function costMarks(eff) {
    const c = eff?.opCosts || eff?.cost || {};
    const out = {};
    for (const [k, v] of Object.entries(c || {})) {
      const n = Number(v) || 0; if (!n) continue;
      out[String(k).toLowerCase()] = (out[String(k).toLowerCase()] || 0) + n;
    }
    return out;
  }
  function affordable(eff, actor) {
    if (!actor) return true;
    const bank = bankOf(actor); const lc = {};
    for (const [k, v] of Object.entries(bank)) lc[String(k).toLowerCase()] = Number(v) || 0;
    for (const [k, v] of Object.entries(costMarks(eff))) if ((lc[k] || 0) < v) return false;
    return true;
  }
  function usable(key, actor) {
    const api = raidApi();
    if (!api?.canUseManeuver || !actor) return true;
    try { const r = api.canUseManeuver(actor, key, { ignoreGM: true }); return r === true || r?.ok === true; }
    catch (_e) { return true; }
  }

  // ── Bank summaries ─────────────────────────────────────────────────────────
  function compactBanks(app, root) {
    app.__rcBankOpen ??= false;
    for (const sec of root.querySelectorAll("section.bbttcc-bank")) {
      if (sec.previousElementSibling?.classList?.contains("rc-bank-summary")) {
        sec.classList.toggle("rc-collapsed", !app.__rcBankOpen);
        continue;
      }
      const title = (sec.querySelector("h4")?.textContent || "Bank").replace(/\s+/g, " ").trim();
      // Header row = pool names (th); the first data row = values (td).
      const chips = [];
      const table = sec.querySelector("table");
      if (table) {
        const heads = [...table.querySelectorAll("th")].map(e => e.textContent.trim());
        const firstRow = [...table.querySelectorAll("tr")].find(tr => tr.querySelector("td"));
        const vals = firstRow ? [...firstRow.querySelectorAll("td")].map(e => e.textContent.trim()) : [];
        heads.forEach((h, i) => { if (h && vals[i] != null && vals[i] !== "") chips.push(`<span class="rc-chip">${_esc(h)} <b>${_esc(vals[i])}</b></span>`); });
      }
      const sum = document.createElement("div");
      sum.className = "rc-bank-summary";
      sum.title = "Click to show / hide the full bank table";
      sum.innerHTML = `<span class="rc-caret">${app.__rcBankOpen ? "▾" : "▸"}</span><span>${_esc(title)}</span>${chips.slice(0, 9).join("")}`;
      sum.addEventListener("click", () => { app.__rcBankOpen = !app.__rcBankOpen; reapply(app); });
      sec.parentNode.insertBefore(sum, sec);
      sec.classList.toggle("rc-collapsed", !app.__rcBankOpen);
    }
    for (const s of root.querySelectorAll(".rc-bank-summary .rc-caret")) s.textContent = app.__rcBankOpen ? "▾" : "▸";
  }

  // ── Maneuver tabs + usable-only filter ─────────────────────────────────────
  function sideOfFieldset(fs) {
    const lg = (fs.querySelector("legend")?.textContent || "").toLowerCase();
    if (lg.includes("defender")) return "def";
    if (lg.includes("support")) return "support";
    return "att";
  }

  function compactPicker(app, root) {
    app.__rcTab ??= "att";
    app.__rcUsableOnly ??= true;
    const vm = app.vm || {};
    for (const cell of root.querySelectorAll(".bbttcc-mans-cell")) {
      const tr = cell.closest("tr");
      const idx = Number(tr?.previousElementSibling?.dataset?.idx ?? tr?.dataset?.idx ?? -1);
      const round = vm.rounds?.[idx] || null;
      const sets = [...cell.querySelectorAll("fieldset.bbttcc-mans")];
      if (!sets.length) continue;

      const attacker = game.actors?.get?.(round?.attackerId || vm.attackerId) || null;
      let defender = null;
      try { defender = game.actors?.get?.(round?.defenderId || vm.defenderId) || null; } catch (_e) {}
      const EFF = raidApi()?.EFFECTS || {};

      const counts = { att: 0, def: 0, support: 0 };
      const hidden = { att: 0, def: 0, support: 0 };
      for (const fs of sets) {
        const side = sideOfFieldset(fs);
        for (const lbl of fs.querySelectorAll(".mans-wrap > label")) {
          const cb = lbl.querySelector("input[data-maneuver]");
          if (!cb) continue;
          if (cb.checked) counts[side]++;
          let actor = side === "def" ? defender : attacker;
          if (side === "support") actor = game.actors?.get?.(cb.dataset.factionId || "") || null;
          const key = cb.dataset.maneuver;
          const ok = cb.checked || !app.__rcUsableOnly || (usable(key, actor) && affordable(EFF[key], actor));
          lbl.classList.toggle("rc-unusable", !ok);
          if (!ok) hidden[side]++;
        }
        fs.classList.toggle("rc-tab-off", side !== app.__rcTab);
      }

      // Tab bar (rebuilt each pass — cheap, keeps counts live).
      cell.querySelector(".rc-man-tabs")?.remove();
      cell.querySelector(".rc-hidden-note")?.remove();
      const present = new Set(sets.map(sideOfFieldset));
      if (!present.has(app.__rcTab)) app.__rcTab = present.has("att") ? "att" : [...present][0];
      for (const fs of sets) fs.classList.toggle("rc-tab-off", sideOfFieldset(fs) !== app.__rcTab);
      const label = { att: "⚔ Attacker", def: "🛡 Defender", support: "🤝 Support" };
      const bar = document.createElement("div");
      bar.className = "rc-man-tabs";
      bar.innerHTML = ["att", "def", "support"].filter(s => present.has(s)).map(s =>
        `<span class="rc-man-tab${s === app.__rcTab ? " active" : ""}" data-rc-tab="${s}">${label[s]}<span class="rc-n">${counts[s] || ""}</span></span>`).join("")
        + `<span class="rc-man-tools">
             <label title="Hide maneuvers this side can't field or afford (ticked ones always show)"><input type="checkbox" data-rc-usable ${app.__rcUsableOnly ? "checked" : ""}> Usable only</label>
             ${idx > 0 && round && !round.committed ? `<button type="button" data-rc-repeat title="Copy the previous round's maneuvers (all sides) into this round">↻ Repeat last round</button>` : ""}
           </span>`;
      const firstFs = sets[0];
      firstFs.parentNode.insertBefore(bar, firstFs);
      const hiddenHere = hidden[app.__rcTab] || 0;
      if (hiddenHere) {
        const note = document.createElement("div");
        note.className = "rc-hidden-note";
        note.textContent = `+${hiddenHere} hidden (can't field or afford) — untick "Usable only" to see all`;
        bar.insertAdjacentElement("afterend", note);
      }

      bar.addEventListener("click", (ev) => {
        const t = ev.target.closest?.("[data-rc-tab]");
        if (t) { app.__rcTab = t.dataset.rcTab; reapply(app); return; }
        if (ev.target.closest?.("[data-rc-repeat]")) { repeatLast(app, idx); }
      });
      bar.querySelector("[data-rc-usable]")?.addEventListener("change", (ev) => { app.__rcUsableOnly = !!ev.target.checked; reapply(app); });
    }
  }

  function repeatLast(app, idx) {
    try {
      const rounds = app.vm?.rounds || [];
      const cur = rounds[idx]; const prev = rounds[idx - 1];
      if (!cur || !prev || cur.committed) return;
      cur.mansSelected = Array.isArray(prev.mansSelected) ? prev.mansSelected.slice() : [];
      cur.mansSelectedDef = Array.isArray(prev.mansSelectedDef) ? prev.mansSelectedDef.slice() : [];
      const sup = {};
      for (const [fid, keys] of Object.entries(prev.mansSelectedSupport || {})) sup[fid] = Array.isArray(keys) ? keys.slice() : [];
      cur.mansSelectedSupport = sup;
      try { app._queueSaveSession?.(); } catch (_e) {}
      app.render?.();
      ui.notifications?.info?.("Copied the previous round's maneuvers.");
    } catch (e) { console.warn(TAG, "repeat failed", e); }
  }

  function reapply(app) {
    const root = app?.element;
    if (!root?.classList?.contains?.(CLS)) return;
    app.__rcApplying = true;
    try { compactBanks(app, root); compactPicker(app, root); }
    catch (e) { console.warn(TAG, "apply failed", e); }
    finally {
      // Drop our own mutations — the observer fires as a microtask after this flag resets, so the guard alone looped every frame (2026-10-28).
      try { app.__rcObserver?.takeRecords?.(); } catch (_e) {}
      app.__rcApplying = false;
    }
  }

  function observe(app) {
    const root = app?.element;
    if (!root || app.__rcObserver) return;
    let queued = false;
    app.__rcObserver = new MutationObserver(() => {
      if (app.__rcApplying || queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; reapply(app); });
    });
    app.__rcObserver.observe(root, { childList: true, subtree: true });
  }

  const isConsole = (app) => app?.constructor?.name === "BBTTCC_RaidConsole" || app?.element?.classList?.contains?.(CLS);

  Hooks.on("renderApplicationV2", (app) => {
    try {
      if (!isConsole(app)) return;
      injectStyle();
      reapply(app);
      observe(app);
    } catch (e) { console.warn(TAG, "render hook failed", e); }
  });
  Hooks.on("closeApplicationV2", (app) => { try { if (isConsole(app)) { app.__rcObserver?.disconnect(); app.__rcObserver = null; } } catch (_e) {} });

  console.log(TAG, "Compact Raid Console loaded");
})();

/* ─────────────────────────────────────────────────────────────────────────────
 * CONFLICT BAR (owner 2026-10-30: "kill this everywhere, and fold all the functionality into the HUD toolbar at the
 * bottom, or the tracking meter at the top") — PLAYER SEATS. While a Domain Conflict console is open on a player
 * seat, its window is parked off-screen and this bottom bar becomes the surface: the round, your Domain's bank /
 * staged / remaining, the −10 +10 +50 +100 staging buttons, Commit staging to GM, and your side's maneuvers as
 * chips (tick = select, ▶ = fire an anytime one). Every control PRESSES THE CONSOLE'S OWN BUTTON / CHECKBOX, so the
 * session sync, side permissions, fire gates and charge guards are the console's — nothing is re-implemented.
 * "⤢ Console" brings the window back (escape hatch); the GM seat keeps the window (its side folds in after launch).
 * The Court strip (raid-courtly.hud.js) sits on top of this bar; the top tracker names Attacker vs Defender.
 * ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const TAG = "[bbttcc-raid/conflict-bar]";
  const BAR_ID = "bbttcc-conflict-bar";
  const STYLE_ID = "bbttcc-conflict-bar-style";
  const CLS = "bbttcc-raid-console";
  const esc = (t) => foundry.utils.escapeHTML(String(t ?? ""));
  const txt = (el) => String(el?.textContent ?? "").replace(/\s+/g, " ").trim();
  let _showWindow = false, _timer = null, _obs = null, _obsApp = null, _opening = -1;
  let _collapsed = (() => { try { return localStorage.getItem("bbttcc-conflict-bar-collapsed") === "1"; } catch (_e) { return false; } })();

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement("style"); st.id = STYLE_ID;
    st.textContent = `
      .${CLS}.cb-docked{position:fixed!important;left:-20000px!important;top:0!important;opacity:0!important;pointer-events:none!important}
      #${BAR_ID}{position:fixed;left:50%;transform:translateX(-50%);z-index:65;width:min(1120px,calc(100vw - 340px));
        display:flex;flex-direction:column;gap:.3rem;padding:.35rem .55rem;border-radius:10px;color:#e8d3a8;font-size:.78rem;
        background:rgba(14,10,6,.9);border:1px solid rgba(212,163,95,.55);box-shadow:0 4px 18px rgba(0,0,0,.5)}
      #${BAR_ID} .cb-row{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}
      #${BAR_ID} .cb-title{color:#ffd28a;font-weight:700;letter-spacing:.04em}
      #${BAR_ID} .cb-dim{opacity:.7}
      #${BAR_ID} .cb-bank b{color:#fff3d6}
      #${BAR_ID} button{padding:.1rem .5rem;border-radius:6px;border:1px solid rgba(212,163,95,.5);background:rgba(40,30,12,.7);
        color:#ffe7bd;font-size:.76rem;line-height:1.5;cursor:pointer}
      #${BAR_ID} button:hover{background:rgba(212,163,95,.3)}
      #${BAR_ID} .cb-commit.pending{background:rgba(251,191,36,.35);border-color:rgba(251,191,36,.9);color:#fef3c7;font-weight:700}
      #${BAR_ID} .cb-status{font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
      #${BAR_ID} .cb-status.pending{color:#fbbf24}
      #${BAR_ID} .cb-tools{margin-left:auto;display:flex;gap:.3rem}
      #${BAR_ID} .cb-mans{display:flex;flex-wrap:wrap;gap:.3rem;max-height:9.5em;overflow-y:auto}
      #${BAR_ID} .cb-man{display:inline-flex;align-items:center;gap:.3rem;padding:.12rem .45rem;border-radius:12px;cursor:pointer;
        border:1px solid rgba(212,163,95,.35);background:rgba(30,22,10,.65)}
      #${BAR_ID} .cb-man.on{background:rgba(212,163,95,.32);border-color:rgba(255,210,138,.95);color:#fff}
      #${BAR_ID} .cb-man small{opacity:.75}
      #${BAR_ID} .cb-man .cb-fire{padding:0 .35rem;font-size:.7rem}
      #${BAR_ID}.collapsed .cb-body{display:none}
      #${BAR_ID} .cb-side{font-size:.68rem;opacity:.8;margin-right:.15rem}`;
    document.head.appendChild(st);
  }

  function liveConsole() {
    for (const a of (globalThis.__bbttccRaidOpenConsoles || [])) if (a?.rendered && a.element && a.vm?.attackerId) return a;
    return null;
  }
  function activeIdx(app) {
    const R = app?.vm?.rounds || [];
    for (let i = R.length - 1; i >= 0; i--) { const r = R[i]; if (r && !r.committed && !r.cancelled) return i; }
    return -1;
  }
  const rowsFor = (app, idx) => [...app.element.querySelectorAll(`tr[data-idx="${idx}"]`)];
  const manageRowOf = (app, idx) => rowsFor(app, idx).find(tr => tr.querySelector("td[colspan]"));
  const sideOf = (fs) => { const lg = txt(fs.querySelector("legend")).toLowerCase(); return lg.includes("defender") ? "def" : lg.includes("support") ? "support" : "att"; };

  function place(bar) {
    let top = window.innerHeight - 8;
    for (const id of ["bbttcc-combat-dock", "hotbar", "ft-crew-hud"]) {
      const el = document.getElementById(id); if (!el || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect(); if (r.height > 0 && r.top > window.innerHeight * 0.5) top = Math.min(top, r.top);
    }
    bar.style.bottom = Math.max(8, Math.round(window.innerHeight - top + 8)) + "px";
    try { game.bbttcc?.api?.raid?.courtlyHud?.place?.(); } catch (_e) {}
  }

  function teardown() {
    document.getElementById(BAR_ID)?.remove();
    try { _obs?.disconnect(); } catch (_e) {} _obs = null; _obsApp = null;
  }

  function render() {
    _timer = null;
    if (game.user?.isGM) return teardown();
    const app = liveConsole();
    if (!app) return teardown();
    injectStyle();
    app.element.classList.toggle("cb-docked", !_showWindow);
    if (_obsApp !== app) {
      try { _obs?.disconnect(); } catch (_e) {}
      _obs = new MutationObserver(() => schedule()); _obs.observe(app.element, { childList: true, subtree: true }); _obsApp = app;
    }
    const vm = app.vm || {};
    const idx = activeIdx(app);
    const round = idx >= 0 ? vm.rounds[idx] : null;
    let row = idx >= 0 ? manageRowOf(app, idx) : null;
    // the round's controls only exist once its panel is open — open it once (the console's own Open button)
    if (round && !row && _opening !== idx) {
      _opening = idx;
      const btn = rowsFor(app, idx).map(tr => tr.querySelector('[data-act="manage"]')).find(Boolean);
      if (btn) { btn.click(); schedule(250); }
    }
    if (row) _opening = -1;

    const kindLbl = (() => { try { return game.bbttcc?.api?.raid?.typeLabel?.(round?.activityLabel || vm.activityKey) || round?.activityLabel || "Conflict"; } catch (_e) { return "Conflict"; } })();
    let bar = document.getElementById(BAR_ID);
    if (!bar) { bar = document.createElement("div"); bar.id = BAR_ID; document.body.appendChild(bar); }
    bar.classList.toggle("collapsed", _collapsed);

    const head = `<div class="cb-row">
        <span class="cb-title">⚔ ${esc(kindLbl)}</span>
        <span class="cb-dim">${round ? `Round ${idx + 1}` : (vm.rounds?.length ? "between rounds" : "waiting for the GM's first round")}</span>
        ${vm.targetName ? `<span class="cb-dim">· ${esc(vm.targetName)}</span>` : ""}
        <span class="cb-tools">
          <button type="button" data-cb="window" title="Show / hide the full console window">${_showWindow ? "⤓ Dock" : "⤢ Console"}</button>
          <button type="button" data-cb="collapse" title="Collapse / expand">${_collapsed ? "▸" : "▾"}</button>
        </span></div>`;

    let body = "";
    if (!round) {
      body = `<div class="cb-row cb-dim">The GM opens each round — your stakes and maneuvers appear here when it does.</div>`;
    } else if (!row) {
      body = `<div class="cb-row cb-dim">Opening Round ${idx + 1}…</div>`;
    } else {
      // bank / stage / commit — straight off the console's "Your Commitments" panel
      const card = row.querySelector(".card");
      const domainH = [...(card?.querySelectorAll("h5") || [])].find(h => /Your Domain|Attacker|Supporter/i.test(txt(h)));
      const bankP = domainH?.nextElementSibling;
      const stage = [...row.querySelectorAll('[data-manage-act="stage"]')];
      const commit = row.querySelector('[data-id="commit-staging"]');
      const status = commit ? txt(commit.previousElementSibling) : "";
      const note = commit ? txt(commit.nextElementSibling) : "";
      const notIn = /not in this conflict/i.test(txt(card));
      const pending = /pending/i.test(status);
      bar.__stage = stage; bar.__commit = commit;
      const stageHtml = stage.map((b, i) => `<button type="button" data-cb="stage" data-i="${i}"${b.disabled ? " disabled" : ""}>${esc(txt(b))}</button>`).join("");
      const line1 = notIn ? `<div class="cb-row cb-dim">You're not in this conflict — staging unavailable.</div>` : `<div class="cb-row">
          <span class="cb-dim">${esc(txt(domainH).replace(/^Your Domain\s*—\s*/i, ""))}</span>
          <span class="cb-bank">${bankP ? bankP.innerHTML : ""}</span>
          ${stageHtml}
          ${commit ? `<span class="cb-status${pending ? " pending" : ""}">${esc(status)}</span><button type="button" data-cb="commit" class="cb-commit${pending ? " pending" : ""}">Commit staging to GM</button><span class="cb-dim">${esc(note)}</span>` : ""}
        </div>`;
      // maneuvers — every non-defender fieldset the console shows this seat, minus rows "Usable only" hides
      const mans = []; bar.__mans = mans;
      for (const fs of row.querySelectorAll("fieldset.bbttcc-mans")) {
        const side = sideOf(fs); if (side === "def") continue;
        for (const lbl of fs.querySelectorAll(".mans-wrap > label")) {
          if (lbl.classList.contains("rc-unusable")) continue;
          const cb = lbl.querySelector("input[data-maneuver]"); if (!cb) continue;
          const name = txt(lbl.querySelector("span")) || cb.dataset.maneuver;
          const cost = txt(lbl.querySelector("small"));
          const fire = lbl.querySelector("[data-fire-maneuver]");
          mans.push({ cb, fire, side, html: `<span class="cb-man${cb.checked ? " on" : ""}" data-cb="man" data-i="${mans.length}" title="${esc(cost || name)}">${cb.checked ? "☑" : "☐"} ${esc(name)}${cost ? ` <small>${esc(cost.replace(/^\(|\)$/g, ""))}</small>` : ""}${fire ? `<button type="button" class="cb-fire" data-cb="fire" data-i="${mans.length}">${esc(txt(fire) || "▶")}</button>` : ""}</span>` });
        }
      }
      const sideLbl = { att: "⚔", support: "🤝" };
      const manHtml = mans.length ? mans.map(m => m.html.replace('data-cb="man"', `data-cb="man"`)).join("") : `<span class="cb-dim">No maneuvers you can field this round.</span>`;
      body = line1 + `<div class="cb-row"><span class="cb-side">${sideLbl[mans[0]?.side] || "⚔"} Maneuvers</span></div><div class="cb-mans">${manHtml}</div>`;
    }
    bar.innerHTML = head + `<div class="cb-body">${body}</div>`;
    place(bar);
  }

  function schedule(ms = 80) { if (_timer) clearTimeout(_timer); _timer = setTimeout(() => { try { render(); } catch (e) { console.warn(TAG, "render failed", e); } }, ms); }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest?.(`#${BAR_ID} [data-cb]`); if (!t) return;
    const bar = document.getElementById(BAR_ID); const act = t.dataset.cb; const i = Number(t.dataset.i);
    ev.preventDefault(); ev.stopPropagation();
    try {
      if (act === "window") { _showWindow = !_showWindow; const app = liveConsole(); if (app) { app.element.classList.toggle("cb-docked", !_showWindow); if (_showWindow) app.bringToFront?.(); } return schedule(0); }
      if (act === "collapse") { _collapsed = !_collapsed; try { localStorage.setItem("bbttcc-conflict-bar-collapsed", _collapsed ? "1" : "0"); } catch (_e) {} return schedule(0); }
      if (act === "stage") return bar?.__stage?.[i]?.click();
      if (act === "commit") return bar?.__commit?.click();
      if (act === "fire") return bar?.__mans?.[i]?.fire?.click();
      if (act === "man") { const m = bar?.__mans?.[i]; if (!m) return; m.cb.checked = !m.cb.checked; m.cb.dispatchEvent(new Event("change", { bubbles: true })); return schedule(); }
    } catch (e) { console.warn(TAG, "action failed", act, e); }
  }, true);

  Hooks.on("renderApplicationV2", (app) => { if (app?.element?.classList?.contains?.(CLS)) schedule(); });
  Hooks.on("closeApplicationV2", (app) => { if (app?.element?.classList?.contains?.(CLS)) schedule(); });
  Hooks.on("updateActor", (_a, ch) => { if (foundry.utils.hasProperty(ch, "flags.bbttcc-raid")) schedule(150); });
  Hooks.on("canvasReady", () => schedule(300));
  window.addEventListener("resize", () => { const b = document.getElementById(BAR_ID); if (b) place(b); });
  console.log(TAG, "Conflict bar loaded (player seats)");
})();
