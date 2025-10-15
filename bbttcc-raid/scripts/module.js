/* modules/bbttcc-raid/scripts/module.js
 * BBTTCC Raid — Persistent Raid Console (multi-round) + Hex picker + Dry-Run kernel
 * Console uses classic Application (V1). Provide a valid template path to avoid null .startsWith crash.
 */
const RAID_ID = "bbttcc-raid";
const TERR_ID = "bbttcc-territory";
const FCT_ID  = "bbttcc-factions";
const TAG = "[bbttcc-raid]";

const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

/* ---------- config ---------- */
const RAID_DIFFICULTIES = {
  trivial:{ name:"Trivial", modifier:-2 }, easy:{ name:"Easy", modifier:-1 }, medium:{ name:"Medium", modifier:0 },
  hard:{ name:"Hard", modifier:1 }, extreme:{ name:"Extreme", modifier:2 }
};

/* ---------- helpers ---------- */
const isFaction = (a) => {
  if (!a) return false;
  try {
    if (a.getFlag?.(FCT_ID,"isFaction") === true) return true;
    const t = (foundry.utils.getProperty(a,"system.details.type.value") ?? "").toString().toLowerCase();
    if (t === "faction") return true;
    const cls = a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
    return String(cls||"").includes("BBTTCCFactionSheet");
  } catch { return false; }
};
const isCharacter = (a) => String(a?.type ?? "").toLowerCase() === "character";

function charBelongsToFaction(char, faction) {
  const byId = char.getFlag?.(FCT_ID,"factionId");
  if (byId) return byId === faction.id;
  const legacy = char?.flags?.[TERR_ID]?.faction;
  return legacy && String(legacy).trim() === String(faction.name).trim();
}

function categoryTotal(faction, key) {
  key = key.toLowerCase();
  const opsFlags = foundry.utils.duplicate(faction.getFlag(FCT_ID,"ops") || {});
  const base = Number(opsFlags?.[key]?.value ?? 0);
  let contrib = 0;
  for (const a of game.actors.contents) {
    if (!isCharacter(a)) continue;
    if (!charBelongsToFaction(a, faction)) continue;
    let c = a.getFlag?.(FCT_ID,"opContribution");
    if (!c || Object.values(c).every(v => (Number(v)||0)===0))
      c = a?.flags?.["bbttcc-character-options"]?.calculatedOPs || {};
    contrib += Number(c?.[key] ?? 0);
  }
  return base + contrib;
}

/* ---------- safe actor resolve ---------- */
async function getActorByIdOrUuid(maybeIdOrUuid) {
  const s = String(maybeIdOrUuid ?? "");
  if (!s) return null;
  try {
    if (s.startsWith("Actor.")) return await fromUuid(s);
    return game.actors.get(s) ?? null;
  } catch (e) {
    warn("getActorByIdOrUuid error", e);
    return null;
  }
}

/* ---------- hex resolve (coordinate hit-test) ---------- */
function isHexDrawing(d) {
  const doc = d?.document ?? d;
  const f = doc?.flags?.[TERR_ID] ?? {};
  if (f.isHex === true) return true;
  if (String(f.kind||"").toLowerCase() === "territory-hex") return true;
  const sh = doc?.shape ?? d?.shape;
  const n = Array.isArray(sh?.points) ? sh.points.length : 0;
  return sh?.type === "p" && n >= 10; // 6 verts => 12 points; allow >=10
}

function hexUnderWorldPoint(pt) {
  const list = canvas?.drawings?.placeables ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (!isHexDrawing(p)) continue;
    try {
      const local = p.toLocal(new PIXI.Point(pt.x, pt.y));
      if (p.hitArea?.contains?.(local.x, local.y)) return p;
      const sh = p.document.shape;
      if (sh?.type === "p" && Array.isArray(sh.points)) {
        const poly = new PIXI.Polygon(sh.points);
        if (poly.contains(local.x, local.y)) return p;
      }
      const w = sh?.width ?? p.width ?? 0, h = sh?.height ?? p.height ?? 0;
      if (local.x>=0 && local.y>=0 && local.x<=w && local.y<=h) return p;
    } catch { /* continue */ }
  }
  return null;
}

/** Prompt to click a hex; returns {drawing, uuid, flags} or null. */
async function pickTargetHex({ prompt="Click a BBTTCC hex…" } = {}) {
  if (!canvas?.ready) { ui.notifications?.error?.("Canvas not ready."); return null; }
  const note = ui.notifications?.info?.(prompt, {permanent:true});
  const res = await new Promise((resolve) => {
    const once = (ev) => {
      try {
        canvas.stage.off("pointerdown", once);
        const fed = ev?.data ?? ev;
        const pt = fed?.global ? { x: fed.global.x, y: fed.global.y } : (canvas.mousePosition ?? {x:0,y:0});
        const hit = hexUnderWorldPoint(pt);
        if (!hit) { ui.notifications?.warn?.("No BBTTCC hex under cursor."); return resolve(null); }
        resolve({ drawing: hit.document, uuid: hit.document.uuid, flags: foundry.utils.duplicate(hit.document.flags?.[TERR_ID] ?? {}) });
      } catch (e) { warn("pickTargetHex error", e); resolve(null); }
      finally { try { note?.remove?.(); } catch {} }
    };
    canvas.stage.on("pointerdown", once);
  });
  return res;
}

/* ---------- hex defense ---------- */
const SIZE_DEF = { outpost:0, village:1, town:1, city:2, metropolis:3, megalopolis:4, small:0, standard:1, large:3 };
const MOD_DEF  = { "Fortified":3, "Difficult Terrain":1 };
async function hexDefense(doc) {
  const f = doc?.flags?.[TERR_ID] ?? {};
  const sizeKey = String(f.size ?? "town").toLowerCase();
  let defense = Number(SIZE_DEF[sizeKey] ?? 1);
  if (Array.isArray(f.modifiers)) for (const m of f.modifiers) defense += Number(MOD_DEF[m] ?? 0);
  if (String(f.type||"").toLowerCase() === "fortress") defense += 2;
  if (f.capital) defense += 1;
  return Math.max(0, Math.round(defense));
}

/* ---------- Dry Run kernel (ASYNC) ---------- */
async function computeDryRun(attacker, { mode="assault", difficulty="medium" } = {}, baseDC) {
  const key = (mode === "infiltration") ? "intrigue" : "military";
  const attBonus = categoryTotal(attacker, key);
  const diffAdj  = Number(RAID_DIFFICULTIES[difficulty]?.modifier ?? 0);
  const DC       = Math.max(0, Number(baseDC||0) + diffAdj);

  const roll = new Roll("1d20 + @b", { b: attBonus });
  await roll.evaluate({ async: true }); // v13: dice must be async

  const total  = roll.total;
  const outcome = (total >= DC + 5) ? "Great Success" : (total >= DC) ? "Success" : "Fail";
  const detail  = outcome === "Great Success" ? "Decisive result; strong position next turn."
                  : outcome === "Success"     ? "Objective achieved; limited friction."
                                              : "No breakthrough; defenders hold.";
  return { key, attBonus, baseDC:Number(baseDC||0), diffAdj, DC, roll, total, outcome, detail };
}

async function raidDryRun({ attackerId, mode="assault", targetUuid, difficulty="medium", post=false }) {
  if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
  const attacker = await getActorByIdOrUuid(attackerId);
  if (!attacker || !isFaction(attacker)) return ui.notifications?.warn?.("Pick a valid attacker faction.");
  const target = targetUuid ? await fromUuid(targetUuid) : null;
  if (!target) return ui.notifications?.warn?.("Target hex not found.");
  const baseDC = await hexDefense(target);

  const res = await computeDryRun(attacker, { mode, difficulty }, baseDC);
  const out = {
    attackerId: attacker.id, attackerName: attacker.name,
    targetUuid, targetName: (target.flags?.[TERR_ID]?.name || target.text || "Hex"),
    mode, difficulty, ...res
  };

  if (post) {
    const diffName  = RAID_DIFFICULTIES[difficulty]?.name ?? difficulty;
    const modeLabel = (mode === "infiltration") ? "Infiltration (Intrigue)" : "Assault (Military)";
    const card = `
      <section class="bbttcc-raid">
        <h3 style="margin:0 0 .25rem 0;">BBTTCC — Raid (Dry Run)</h3>
        <p style="margin:.25rem 0;"><strong>Mode:</strong> ${modeLabel} • <strong>Difficulty:</strong> ${diffName}</p>
        <table class="bbttcc-table" style="width:100%;">
          <thead><tr><th style="text-align:left;">Attacker</th><th>Target Hex</th><th>Roll</th><th>DC</th><th>Outcome</th></tr></thead>
          <tbody><tr>
            <td>${foundry.utils.escapeHTML(out.attackerName)} <small>(+${out.attBonus} ${out.key})</small></td>
            <td>${foundry.utils.escapeHTML(out.targetName)}</td>
            <td class="center"><code>${out.roll.result}</code> = <strong>${out.total}</strong></td>
            <td class="center"><strong>${out.DC}</strong> <small>(Hex ${out.baseDC}${out.diffAdj?` ${out.diffAdj>0?'+':''}${out.diffAdj}`:""})</small></td>
            <td class="center"><strong>${out.outcome}</strong><br/><small>${out.detail}</small></td>
          </tr></tbody>
        </table>
      </section>`;
    ChatMessage.create({ speaker:{alias:"BBTTCC Raid"}, flavor:card, whisper: game.users.filter(u=>u.isGM).map(u=>u.id) });
  }
  return out;
}

async function pickAndDryRun({ attackerId, mode="assault", difficulty="medium", post=false } = {}) {
  const sel = await pickTargetHex({ prompt: "Click a BBTTCC hex to raid…" });
  if (!sel) return null;
  return await raidDryRun({ attackerId, mode, difficulty, targetUuid: sel.uuid, post });
}

/* ---------- Raid Console (V1 Application) ---------- */
class BBTTCC_RaidConsole extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-raid-console",
      title: "BBTTCC — Raid Console",
      // IMPORTANT: Use a valid template path; we overwrite content after render.
      template: "templates/generic/tab-navigation.hbs",
      width: 760,
      height: 580,
      resizable: true,
      classes: ["bbttcc","bbttcc-raid-console"]
    });
  }

  constructor(options={}) {
    super(options);
    this._firstRenderOK = false;
    this.vm = { attackerId:"", mode:"assault", difficulty:"medium", targetName:"—", targetUuid:"", rounds:[] };
  }

  _fmtTS(ts){ try{ return new Date(ts).toLocaleString(); }catch{ return ""; } }

  _buildHTML() {
    const facs = (game.actors?.contents ?? []).filter(isFaction).sort((a,b)=>a.name.localeCompare(b.name));
    const attackerOptions = [`<option value="">(select)</option>`]
      .concat(facs.map(f => `<option value="${f.id}" ${this.vm.attackerId===f.id?"selected":""}>${foundry.utils.escapeHTML(f.name)}</option>`))
      .join("");
    const mAssault = this.vm.mode==="assault" ? "active" : "";
    const mInfil   = this.vm.mode==="infiltration" ? "active" : "";
    const diffOpts = Object.entries(RAID_DIFFICULTIES).map(([k,v]) =>
      `<option value="${k}" ${this.vm.difficulty===k?"selected":""}>${v.name} (${v.modifier>=0?"+":""}${v.modifier})</option>`
    ).join("");
    const rows = this.vm.rounds.map((r,idx)=> `
      <tr data-idx="${idx}">
        <td class="center">${idx+1}</td>
        <td><small>${this._fmtTS(r.ts)}</small></td>
        <td>${foundry.utils.escapeHTML(r.attackerName)}</td>
        <td>${foundry.utils.escapeHTML(r.targetName)}</td>
        <td>${r.mode==="infiltration"?"Infiltration":"Assault"}</td>
        <td class="center">${RAID_DIFFICULTIES[r.difficulty]?.name ?? r.difficulty}</td>
        <td class="center">+${r.attBonus}</td>
        <td class="center">${r.baseDC}</td>
        <td class="center"><code>${r.roll.result}</code> = <strong>${r.total}</strong></td>
        <td class="center"><strong>${r.outcome}</strong></td>
        <td class="center">
          <button data-act="post">Post</button>
          <button data-act="copy">Copy</button>
          <button data-act="del">✕</button>
        </td>
      </tr>`).join("");

    return `
    <style>
      .bbttcc-raid-console .row { display:flex; align-items:center; gap:.5rem; margin:.35rem 0; }
      .bbttcc-raid-console .row label { min-width:7rem; font-weight:600; }
      .bbttcc-raid-console button.active { background:#3b82f6; color:#fff; }
      .bbttcc-raid-console .pad { padding:.6rem .7rem; border:1px solid var(--color-border,#555); border-radius:8px; }
      .bbttcc-raid-console table { width:100%; }
      .bbttcc-raid-console table td, .bbttcc-raid-console table th { white-space:nowrap; }
      .bbttcc-raid-console .tools { display:flex; gap:.4rem; justify-content:flex-end; }
      .bbttcc-raid-console input[readonly] { background: rgba(255,255,255,.06); }
    </style>
    <section class="pad">
      <div class="row">
        <label>Attacker</label>
        <select id="attacker" style="min-width:18rem;">${attackerOptions}</select>
        <span class="flex1"></span>
        <div class="tools"><button id="reset">Reset</button></div>
      </div>
      <div class="row">
        <label>Mode</label>
        <div class="row" style="gap:.25rem;">
          <button id="m-assault" class="${mAssault}">Assault</button>
          <button id="m-infil"   class="${mInfil}">Infiltration</button>
        </div>
        <label style="min-width:auto;">Difficulty</label>
        <select id="difficulty">${diffOpts}</select>
      </div>
      <div class="row">
        <label>Target</label>
        <input type="text" id="targetName" value="${foundry.utils.escapeHTML(this.vm.targetName)}" readonly style="flex:1;"/>
        <button id="pick">Pick Hex…</button>
        <button id="run" class="default">Add Round</button>
      </div>
    </section>
    <section style="margin-top:.5rem; max-height: 300px; overflow:auto;">
      <table class="bbttcc-table">
        <thead><tr>
          <th>#</th><th>When</th><th>Attacker</th><th>Target</th><th>Mode</th><th>Diff</th>
          <th>Atk</th><th>Hex</th><th>Roll</th><th>Outcome</th><th>Actions</th>
        </tr></thead>
        <tbody id="rounds-body">
          ${rows || `<tr><td colspan="11" class="center"><em>No rounds yet — pick a hex and “Add Round”.</em></td></tr>`}
        </tbody>
      </table>
    </section>`;
  }

  async _render(force=false, options={}) {
    await super._render(force, options);
    try {
      const $el = $(this.element);
      $el.find(".window-content").html(this._buildHTML());
      this._wire($el);
      if (!this._centered) {
        const el = this.element[0]; el.style.left = "calc(50% - 380px)"; el.style.top = "110px"; this._centered = true;
      }
      this._firstRenderOK = true;
    } catch (e) {
      console.error(TAG, "Custom render failed", e);
      ui.notifications?.error?.("Raid Console failed to render — see console.");
    }
    return this;
  }

  _wire($root) {
    $root.off(".bbttccRaid");

    $root.on("change.bbttccRaid", "#attacker", (ev)=> { this.vm.attackerId = ev.currentTarget.value || ""; });

    $root.on("click.bbttccRaid",  "#m-assault", (ev)=> { ev.preventDefault(); this.vm.mode="assault"; this.render(false); });
    $root.on("click.bbttccRaid",  "#m-infil",   (ev)=> { ev.preventDefault(); this.vm.mode="infiltration"; this.render(false); });

    $root.on("change.bbttccRaid", "#difficulty",(ev)=> { this.vm.difficulty = ev.currentTarget.value || "medium"; });

    $root.on("click.bbttccRaid", "#pick", async (ev)=> {
      ev.preventDefault();
      const sel = await pickTargetHex({ prompt:"Click a BBTTCC hex to raid…" });
      if (!sel) return;
      this.vm.targetUuid = sel.uuid || "";
      this.vm.targetName = (sel.flags?.name || (sel.uuid ? sel.uuid.split(".").pop() : "—"));
      ui.notifications?.info?.(`Target: ${this.vm.targetName}`);
      this.render(false);
    });

    $root.on("click.bbttccRaid", "#run", async (ev)=> {
      ev.preventDefault();
      try {
        if (!this.vm.attackerId) { ui.notifications?.warn?.("Pick an attacker faction first."); return; }
        if (!this.vm.targetUuid) { ui.notifications?.warn?.("Pick a target hex first."); return; }

        const attacker = await getActorByIdOrUuid(this.vm.attackerId);
        if (!attacker) { ui.notifications?.error?.("Attacker not found."); return; }

        const target   = this.vm.targetUuid ? await fromUuid(this.vm.targetUuid) : null;
        if (!target) { ui.notifications?.error?.("Target hex not found."); return; }

        const baseDC   = await hexDefense(target);
        const comp     = await computeDryRun(attacker, { mode:this.vm.mode, difficulty:this.vm.difficulty }, baseDC);

        const round = {
          ts: Date.now(),
          attackerId: attacker.id, attackerName: attacker.name,
          targetUuid: target.uuid, targetName: (target.flags?.[TERR_ID]?.name || target.text || "Hex"),
          mode: this.vm.mode, difficulty: this.vm.difficulty, ...comp
        };
        this.vm.rounds.push(round);
        this.render(false);
      } catch (e) {
        console.error(TAG, "Add Round failed", e);
        ui.notifications?.error?.("Add Round failed — see console.");
      }
    });

    $root.on("click.bbttccRaid", "#reset", (ev)=> {
      ev.preventDefault();
      if (!confirm("Clear all rounds in this console?")) return;
      this.vm.rounds = []; this.render(false);
    });

    $root.on("click.bbttccRaid", "#rounds-body button[data-act]", async (ev)=> {
      ev.preventDefault();
      const $tr = $(ev.currentTarget).closest("tr");
      const idx = Number($tr.data("idx"));
      const r = this.vm.rounds[idx]; if (!r) return;
      const act = ev.currentTarget.dataset.act;

      if (act === "post") {
        const diffName = RAID_DIFFICULTIES[r.difficulty]?.name ?? r.difficulty;
        const modeLabel = r.mode==="infiltration" ? "Infiltration (Intrigue)" : "Assault (Military)";
        const card = `
          <section class="bbttcc-raid">
            <h3 style="margin:0 0 .25rem 0;">BBTTCC — Raid (Round ${idx+1})</h3>
            <p style="margin:.25rem 0;"><strong>Mode:</strong> ${modeLabel} • <strong>Difficulty:</strong> ${diffName}</p>
            <table class="bbttcc-table" style="width:100%;">
              <thead><tr><th style="text-align:left;">Attacker</th><th>Target Hex</th><th>Roll</th><th>DC</th><th>Outcome</th></tr></thead>
              <tbody><tr>
                <td>${foundry.utils.escapeHTML(r.attackerName)} <small>(+${r.attBonus} ${r.key})</small></td>
                <td>${foundry.utils.escapeHTML(r.targetName)}</td>
                <td class="center"><code>${r.roll.result}</code> = <strong>${r.total}</strong></td>
                <td class="center"><strong>${r.DC}</strong> <small>(Hex ${r.baseDC}${r.diffAdj?` ${r.diffAdj>0?'+':''}${r.diffAdj}`:""})</small></td>
                <td class="center"><strong>${r.outcome}</strong></td>
              </tr></tbody>
            </table>
          </section>`;
        ChatMessage.create({ speaker:{alias:"BBTTCC Raid"}, flavor:card, whisper: game.users.filter(u=>u.isGM).map(u=>u.id) });
      }
      else if (act === "copy") {
        const txt = `Raid Round ${idx+1} — ${r.attackerName} → ${r.targetName} | ${r.mode}/${r.difficulty} | atk +${r.attBonus} vs DC ${r.DC} (hex ${r.baseDC}) | roll ${r.roll.result} = ${r.total} → ${r.outcome}`;
        try {
          if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(txt);
          } else {
            const ta = document.createElement("textarea");
            ta.value = txt;
            document.body.appendChild(ta);
            ta.select(); document.execCommand("copy");
            document.body.removeChild(ta);
          }
          ui.notifications?.info?.("Round summary copied.");
        } catch {
          ui.notifications?.warn?.("Could not copy to clipboard.");
        }
      }
      else if (act === "del") {
        this.vm.rounds.splice(idx, 1);
        this.render(false);
      }
    });
  }
}

/* ---------- robust API binding (singleton) ---------- */
function bindAPI() {
  const mod = game.modules.get(RAID_ID);
  let _console = null;
  async function openRaidConsole() {
    if (!_console) _console = new BBTTCC_RaidConsole();
    await _console.render(true, { focus: true });
    return _console;
  }
  mod.api = Object.assign(mod.api || {}, {
    pickTargetHex, raidDryRun, pickAndDryRun, openRaidConsole,
    RAID_DIFFICULTIES
  });
  globalThis.BBTTCC_Raid = mod.api;
  log("API ready:", Object.keys(mod.api));
}
Hooks.once("ready", bindAPI);
