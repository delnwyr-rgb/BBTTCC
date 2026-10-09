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
    finally { app.__rcApplying = false; }
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
