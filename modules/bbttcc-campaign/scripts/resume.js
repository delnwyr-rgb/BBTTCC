/* bbttcc-campaign/scripts/resume.js — "⏯ The last time we saw Lucky…" (Dave, 2026-10-27: "It's how I kick off all of my games.").
 * "When I logged back in … I'm not super sure what we had just done. … a bookmark for the campaign that's easy to pick
 * right back up the next time."
 *
 * Reads three records the game already keeps, plus the bookmark module.js now writes:
 *   - world setting bbttcc-campaign.bookmark — the beat window that was OPEN when the GM seat went away
 *     (module.js _bookmarkOpen/_bookmarkClose around every beat dialog; resolving a window clears it)
 *   - the story store's played beats (api.campaign.story.state → played[id].ts)
 *   - the Director's choice log (setting directorState.choices: {beatId, label, next, ts})
 * and shows one card: when you last played, ▶ Pick up the beat that was open (runBeat force — it was legitimately on
 * screen), "Previously…" (the last beats played, with the choice made in each), and ▶ the story's next beat when nothing
 * was left open. The card opens by itself for the primary GM on login (once per page load, when there is a session to
 * resume) and from the Visualizer's "⏯ The last time we saw Lucky…" button / the GM landing page.
 * API: game.bbttcc.api.campaign.resume.{open, data}
 */

const MOD_ID = "bbttcc-campaign";
const TAG = "[bbttcc-campaign/resume]";
const RECENT = 8;
const AUTO_OPEN_DAYS = 30;
const esc = (s) => { try { return foundry.utils.escapeHTML(String(s ?? "")); } catch (_e) { return String(s ?? ""); } };
const api = () => game.bbttcc?.api?.campaign;

function _when(ts) {
  if (!ts) return "";
  const d = new Date(Number(ts)); const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (days === 0) return `today, ${time}`;
  if (days === 1) return `yesterday, ${time}`;
  if (days < 7) return `${d.toLocaleDateString([], { weekday: "long" })}, ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

/** Everything the card shows, read fresh. */
async function data() {
  const A = api(); const cid = A?.getActiveCampaignId?.(); const camp = cid ? A.getCampaign(cid) : null;
  if (!camp) return null;
  const byId = new Map((camp.beats || []).map(b => [String(b.id), b]));
  let bm = {}; try { bm = game.settings.get(MOD_ID, "bookmark") || {}; } catch (_e) {}
  const open = (bm.campaignId === cid && bm.open?.beatId && byId.has(String(bm.open.beatId))) ? bm.open : null;

  let played = {}; try { played = A.story?.state?.(cid)?.played || {}; } catch (_e) {}
  let choices = []; try { const ds = game.settings.get(MOD_ID, "directorState"); const d = typeof ds === "string" ? JSON.parse(ds) : ds; choices = Array.isArray(d?.choices) ? d.choices.filter(c => !c.campaignId || c.campaignId === cid) : []; } catch (_e) {}
  const lastChoiceFor = (beatId, ts) => { let hit = null; for (const c of choices) if (String(c.beatId) === beatId && Number(c.ts) >= Number(ts) - 1000) hit = c; return hit; };

  const recent = Object.entries(played)
    .map(([id, v]) => ({ id, ts: Number(v?.ts) || 0 }))
    .filter(r => r.ts && byId.has(r.id))
    .sort((a, b) => b.ts - a.ts).slice(0, RECENT)
    .map(r => { const c = lastChoiceFor(r.id, r.ts); return { id: r.id, ts: r.ts, label: byId.get(r.id)?.label || r.id, choice: c?.label || null }; });

  const lastTs = Math.max(Number(bm.ts) || 0, recent[0]?.ts || 0);
  // no bookmark (a session before the recorder, or a window someone dismissed): the latest beat that offers choices and
  // never had one made "looks unfinished" — most likely what was on screen when the session ended
  let unfinished = null;
  if (!open && recent[0] && !recent[0].choice) {
    const b = byId.get(recent[0].id);
    if ((b?.choices || []).length && !(bm.lastResolved && bm.lastResolved.beatId === recent[0].id && Number(bm.lastResolved.at) >= recent[0].ts)) unfinished = { beatId: recent[0].id, label: recent[0].label, since: recent[0].ts };
  }
  let next = null;
  try {
    const sit = await A.director?.situation?.({ full: false });
    const n = sit?.now?.next;
    if (n?.beat) next = { id: n.beat.id, label: n.beat.label || n.beat.id, ready: !!n.ready, line: n.line || "" };
  } catch (_e) {}
  return { cid, open, unfinished, recent, lastTs, next, openSince: open?.since || null };
}

let _dlg = null;
async function open() {
  if (!game.user?.isGM) return ui.notifications?.info?.("The bookmark is the GM's — ask your GM to pick the story back up.");
  const d = await data();
  if (!d) return ui.notifications?.warn?.("No active campaign.");
  try { _dlg?.close?.(); } catch (_e) {}

  const rows = d.recent.map(r => `<li><span class="when">${esc(_when(r.ts))}</span> <b>${esc(r.label)}</b>${r.choice ? ` <span class="chose">— chose “${esc(r.choice)}”</span>` : ""}</li>`).join("");
  const content =
    `<div class="bbttcc-resume">` +
      `<p class="last">Last played <b>${esc(_when(d.lastTs) || "—")}</b>.</p>` +
      (d.open
        ? `<div class="open"><div class="k">Still open when you left</div><div class="v">${esc(d.open.label)}</div><div class="s">opened ${esc(_when(d.openSince))}</div></div>`
        : d.unfinished
        ? `<div class="open"><div class="k">Looks unfinished</div><div class="v">${esc(d.unfinished.label)}</div><div class="s">the last beat played (${esc(_when(d.unfinished.since))}) — no choice was ever made in it</div></div>`
        : (d.next ? `<div class="open"><div class="k">Next in the story</div><div class="v">${esc(d.next.label)}</div>${d.next.line ? `<div class="s">${esc(d.next.line)}</div>` : ""}${d.next.ready ? "" : `<div class="s">(not ready yet — its conditions aren't met)</div>`}</div>`
                 : `<p class="s">Nothing was left open, and the story has no ready next beat.</p>`)) +
      (rows ? `<div class="k prev">Previously…</div><ol class="recent">${rows}</ol>` : "") +
    `</div>` +
    `<style>
      .bbttcc-resume .last{margin:0 0 .6em}
      .bbttcc-resume .open{border-left:3px solid #f4c842;background:rgba(244,200,66,.08);padding:.45em .65em;margin:0 0 .7em;border-radius:4px}
      .bbttcc-resume .k{font-size:.75em;letter-spacing:.14em;text-transform:uppercase;opacity:.7}
      .bbttcc-resume .v{font-size:1.15em;font-weight:700;margin:.15em 0}
      .bbttcc-resume .s{font-size:.85em;opacity:.75}
      .bbttcc-resume .prev{margin:.2em 0 .3em}
      .bbttcc-resume .recent{margin:0;padding-left:1.3em;max-height:16em;overflow:auto}
      .bbttcc-resume .recent li{margin:.15em 0;line-height:1.3}
      .bbttcc-resume .when{opacity:.6;font-size:.82em;white-space:nowrap}
      .bbttcc-resume .chose{opacity:.8;font-style:italic}
    </style>`;

  const run = async (beatId) => {
    const A = api(); if (!A?.runBeat) return;
    try { await A.runBeat(d.cid, beatId, { force: true, source: "resume" }); }
    catch (e) { console.warn(TAG, "resume run failed", e); ui.notifications?.error?.("Couldn't start that beat — see the console."); }
  };
  const buttons = {};
  if (d.open) buttons.pick = { icon: '<i class="fas fa-play"></i>', label: `Pick up: ${d.open.label}`, callback: () => { run(d.open.beatId); } };
  else if (d.unfinished) buttons.pick = { icon: '<i class="fas fa-play"></i>', label: `Pick up: ${d.unfinished.label}`, callback: () => { run(d.unfinished.beatId); } };
  else if (d.next?.ready) buttons.next = { icon: '<i class="fas fa-play"></i>', label: `Run next: ${d.next.label}`, callback: () => { run(d.next.id); } };
  buttons.close = { icon: '<i class="fas fa-times"></i>', label: "Not now" };

  _dlg = new Dialog({ title: "⏯ The last time we saw Lucky…", content, buttons, default: Object.keys(buttons)[0] }, { left: 80, top: 10, width: 460 });
  _dlg.render(true);
  return _dlg;
}

function _isPrimaryGM() {
  if (!game.user?.isGM) return false;
  try { const gx = game.bbttcc?.api?.gmExec; const p = (typeof gx?.primaryGmId === "function") ? gx.primaryGmId() : game.users?.activeGM?.id; return !p || p === game.user.id; } catch (_e) { return true; }
}

Hooks.once("ready", () => {
  const install = () => { const A = api(); if (A) A.resume = { open, data }; };
  install(); setTimeout(install, 1500);   // the campaign API object is (re)built during ready
  globalThis.BBTTCCResume = { open, data };
  if (!_isPrimaryGM()) return;
  setTimeout(async () => {
    try {
      const d = await data(); if (!d) return;
      const fresh = d.lastTs && (Date.now() - d.lastTs) < AUTO_OPEN_DAYS * 86400000;
      if (d.open || d.unfinished || (fresh && d.recent.length)) open();
    } catch (e) { console.warn(TAG, "auto-open failed", e); }
  }, 3000);
});
