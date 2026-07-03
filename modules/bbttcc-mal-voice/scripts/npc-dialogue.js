/* bbttcc-mal-voice/scripts/npc-dialogue.js
 * Runtime-AI arc — NPC dialogue windows: talk to any NPC token.
 *
 * A 💬 button on NPC token HUDs (and `game.bbttcc.mal.npc.talkTo(actor)`)
 * opens a per-NPC chat window. The NPC's persona is assembled live from the
 * actor: name, role, tier, creature type (flags.fourththing.creatureType),
 * faction, notes/bio, tags — plus optional PRIVATE GM persona notes
 * (flags["bbttcc-mal-voice"].persona.notes: knowledge, secrets, agenda,
 * speech quirks) that shape the character without ever being quoted.
 *
 * Prompt shape per turn: [shared lore primer (cached 1h), NPC persona
 * (cached 5m)] + full conversation history via the adapter's multi-turn
 * `messages` support. Replies stream into the window bubble.
 *
 * Persistence: conversation history lives on the actor flag
 * `bbttcc-mal-voice.dialogue` (capped). Only GMs can write actor flags, so
 * GM conversations persist across sessions; player conversations persist
 * for the session (in-memory) and on top of whatever the GM's flag holds.
 *
 * Settings: `npcDialoguePlayers` — allow players to open dialogues (GM
 * always can).
 */

const MODULE_ID = "bbttcc-mal-voice";
const TAG = "[mal-voice:npc]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

const HISTORY_CAP = 40;          // stored turns (user+assistant combined)
const APPS = new Map();          // actorId -> app instance

// ---------------------------------------------------------------------------
// Persona assembly
// ---------------------------------------------------------------------------

function _stripHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.innerHTML = String(s);
  return (d.textContent || "").replace(/\s+\n/g, "\n").trim();
}

function _esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// NPCs at this table come in two shapes: npc-type actors (system.role,
// system.notes, system.factionId) AND character-type actors built on the
// Steward chassis via the NPC Builder (flags.fourththing.kind === "npc",
// system.biography.concept/.notes, faction at flags["bbttcc-factions"]) —
// read both.
function _npcRole(sys)  { return String(sys.role || sys.biography?.concept || "").trim(); }
function _npcNotes(sys) { return [sys.notes, sys.biography?.notes].filter(Boolean).join("\n\n"); }

function _isTaggedNpc(actor) {
  return actor?.flags?.fourththing?.kind === "npc"
      || actor?.flags?.["bbttcc-auto-link"]?.entityKind === "npc";
}

// Chassis-built NPCs carry their whole identity as embedded items — class,
// subclass, species/heritage, archetype, alignment, crew type, occult
// association, enlightenment. Summarize them so even a blank biography
// yields a characterful persona.
const IDENTITY_FEAT_RE = /^(Crew Type|Occult Association|Enlightenment|Archetype|Alignment|.*Heritage):/;

function _identityFromItems(actor) {
  const items = actor.items?.contents ?? actor.items ?? [];
  const names = (t) => items.filter(i => i.type === t).map(i => i.name);
  const classes    = names("class");
  const subclasses = names("subclass");
  const species    = names("species");
  const feats = items
    .filter(i => i.type === "feat" && IDENTITY_FEAT_RE.test(i.name || ""))
    .map(i => i.name)
    .slice(0, 8);
  const out = [];
  if (classes.length)  out.push(`Calling: ${classes.join(", ")}${subclasses.length ? ` — ${subclasses.join(", ")}` : ""}`);
  if (species.length)  out.push(`Ancestry: ${species.join(", ")}`);
  if (feats.length)    out.push(`Identity: ${feats.join("; ")}`);
  return out;
}

// ---------------------------------------------------------------------------
// World-lore sweep: journals + campaign beats that mention this NPC.
//
// The table's canon lives in journals ("Thatwards Ho!") and campaign beats,
// not on the sheet — so the persona mines them live. We extract only the
// paragraphs/choices that mention the NPC (full name, or a distinctive
// first name), label each with its source, and cap the total so the cached
// persona block stays lean. Computed once per window open — close and
// reopen the window to pick up new journal writing.
// ---------------------------------------------------------------------------

function _gatherWorldLore(actor, { maxChars = 8000 } = {}) {
  const name = String(actor?.name || "").trim();
  if (!name) return "";

  const terms = [name.toLowerCase()];
  const first = name.split(/\s+/)[0];
  if (first && first.length >= 4 && first.toLowerCase() !== terms[0]) terms.push(first.toLowerCase());
  const matches = (s) => { const low = String(s || "").toLowerCase(); return terms.some(t => low.includes(t)); };

  const chunks = [];
  let used = 0;
  const push = (header, text) => {
    if (used >= maxChars || !text) return true;
    const body = String(text).slice(0, Math.min(2400, maxChars - used));
    const chunk = `— ${header}:\n${body}`;
    chunks.push(chunk);
    used += chunk.length;
    return used < maxChars;
  };

  // Journal pages: keep only the paragraphs that mention the NPC.
  try {
    outer:
    for (const entry of game.journal?.contents ?? []) {
      for (const page of entry.pages?.contents ?? []) {
        if (page.type !== "text") continue;
        const text = _stripHtml(page.text?.content || "");
        if (!text || !matches(text)) continue;
        const hits = text.split(/\n+/).map(p => p.trim()).filter(p => p && matches(p));
        if (!hits.length) continue;
        if (!push(`Journal "${entry.name}" › "${page.name}"`, hits.join("\n"))) break outer;
      }
    }
  } catch (e) { warn("journal lore sweep failed:", e?.message); }

  // Campaign beats: label + description + choice texts that mention the NPC.
  try {
    let raw = game.settings.get("bbttcc-campaign", "campaigns");
    let data = (typeof raw === "string") ? JSON.parse(raw) : raw;
    const campaigns =
        Array.isArray(data)            ? data
      : Array.isArray(data?.campaigns) ? data.campaigns
      : data ? Object.values(data) : [];
    outer2:
    for (const c of campaigns) {
      for (const b of (c?.beats ?? [])) {
        const choiceTexts = (b?.choices ?? []).map(ch => `Choice "${ch?.label ?? ""}": ${ch?.description ?? ""}`);
        const all = [b?.label, b?.description, ...choiceTexts].filter(Boolean).map(String);
        if (!all.some(matches)) continue;
        const hits = [];
        if (b?.description && matches(b.description)) hits.push(String(b.description));
        for (const ct of choiceTexts) if (matches(ct)) hits.push(ct);
        if (!hits.length) hits.push(all.join("\n").slice(0, 600));
        if (!push(`Campaign beat "${b?.label ?? b?.id ?? "beat"}"`, hits.join("\n"))) break outer2;
      }
    }
  } catch (_e) { /* bbttcc-campaign absent or setting unregistered — fine */ }

  return chunks.join("\n\n");
}

function _buildPersonaPrompt(actor, lore = null) {
  const sys = actor.system?.system ?? actor.system ?? {};
  const name = actor.name;
  const role = _npcRole(sys);
  const tier = Number(sys.details?.tier) || Number(sys.tier) || 1;
  const notes = _stripHtml(_npcNotes(sys)).slice(0, 2500);
  const tags = Array.isArray(sys.tags) ? sys.tags.filter(Boolean).join(", ") : "";

  let creature = actor.flags?.fourththing?.creatureType ?? actor.flags?.fourththing?.creatureTypes ?? null;
  if (Array.isArray(creature)) creature = creature.filter(Boolean).join(", ");

  const factionId = actor.flags?.["bbttcc-factions"]?.factionId || sys.faction?.id || sys.factionId || null;
  const factionName = factionId ? (game.actors.get(factionId)?.name || null) : null;

  const gmNotes = String(actor.getFlag(MODULE_ID, "persona")?.notes || "").trim();
  const sceneName = game.scenes?.active?.name || null;

  const facts = [];
  if (role)        facts.push(`Role/occupation: ${role}`);
  if (creature)    facts.push(`Creature type: ${creature}`);
  if (factionName) facts.push(`Faction: ${factionName}`);
  facts.push(..._identityFromItems(actor));
  if (tags)        facts.push(`Tags: ${tags}`);
  facts.push(`Rough power tier: ${tier} (express through demeanor, never numbers)`);
  if (sceneName)   facts.push(`Current scene: ${sceneName}`);

  const worldLore = (lore === null) ? _gatherWorldLore(actor) : String(lore || "");

  return `You are ${name}, a character living in Bad Eden. You are IN CONVERSATION with one or more Stewards standing in front of you. Stay completely in character as ${name} at all times.

## WHO YOU ARE
${facts.map(f => `• ${f}`).join("\n")}
${notes ? `\n## YOUR STORY (bio/notes — this is what shaped you)\n${notes}` : ""}
${worldLore ? `\n## WHAT THE CHRONICLE SAYS ABOUT YOU (from the world's journals and campaign beats)\nThese are events, descriptions, and moments involving you. Past-tense entries are your lived history — you remember them from your own point of view. Future-sounding or conditional entries have NOT happened: treat them at most as rumors, premonitions, or things you're entangled in but don't fully understand — never state them as fact, and never reveal them as "beats", "choices", or any other game construct.\n\n${worldLore}` : ""}
${gmNotes ? `\n## PRIVATE TRUTH (GM notes — these facts are TRUE about you and guide everything you say, but you NEVER recite them verbatim, and you guard anything marked secret the way a real person guards secrets)\n${gmNotes}` : ""}

## HOW TO SPEAK
1. Reply as ${name} would — voice, dialect, mood, agenda. 1–4 sentences unless the moment truly demands more. Plain speech only: no markdown, no stage directions, no narration of your own actions unless brief and natural ("*spits*" style asides are fine sparingly).
2. You know ONLY what ${name} would plausibly know. If asked about things beyond your world, knowledge, or station, react in character — confusion, suspicion, deflection, a shrug. Never break character, never mention being an AI, never reveal game mechanics or numbers.
3. Each Steward's line begins with their name (e.g. "Etta: ..."). Address people by name when natural. You may lie, bargain, evade, or refuse like a real person with your own interests.
4. You have wants. Let your agenda leak into the conversation — favors asked, warnings given, prices named, grudges nursed.
5. If the conversation stalls, offer a hook: something you've seen, heard, lost, or fear. People in Bad Eden always know something.`;
}

// ---------------------------------------------------------------------------
// History persistence (actor flag; GM-writable only)
// ---------------------------------------------------------------------------

function _loadHistory(actor) {
  try {
    const d = actor.getFlag(MODULE_ID, "dialogue");
    return Array.isArray(d?.messages) ? d.messages.slice(-HISTORY_CAP) : [];
  } catch (_e) { return []; }
}

async function _saveHistory(actor, messages) {
  if (!game.user.isGM) return;   // players lack flag-write permission on unowned NPCs
  try {
    await actor.setFlag(MODULE_ID, "dialogue", { messages: messages.slice(-HISTORY_CAP) });
  } catch (e) { warn("history save failed:", e?.message); }
}

// ---------------------------------------------------------------------------
// Dialogue window (raw ApplicationV2 — rendered once, DOM managed manually)
// ---------------------------------------------------------------------------

let NpcDialogueApp = null;

function _defineAppClass() {
  if (NpcDialogueApp) return NpcDialogueApp;
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base) return null;

  NpcDialogueApp = class extends Base {
    static DEFAULT_OPTIONS = {
      classes: ["bbttcc-npc-dialogue"],
      window: { icon: "fa-solid fa-comments", resizable: true },
      position: { width: 440, height: 580 }
    };

    constructor(actor, options = {}) {
      super({ ...options, id: `bbttcc-npc-dialogue-${actor.id}` });
      this.actor = actor;
      this._history = _loadHistory(actor);   // [{role, content, speaker, ts}]
      this._busy = false;
      this._els = {};
      // World-lore sweep (journals + beats) once per window open; byte-stable
      // across the conversation so the cached persona block keeps hitting.
      this._lore = _gatherWorldLore(actor);
      if (this._lore) log(`world lore for '${actor.name}': ${this._lore.length} chars gathered from journals/beats`);
    }

    get title() { return `${this.actor?.name ?? "NPC"}`; }

    async _renderHTML(_context, _options) {
      const root = document.createElement("div");
      root.style.cssText = "display:flex;flex-direction:column;height:100%;gap:.5em;";

      // Header: portrait + name + GM persona button
      const header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;gap:.5em;flex:0 0 auto;";
      header.innerHTML = `
        <img src="${_esc(this.actor.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;object-fit:cover;border:1px solid #666;border-radius:4px;flex:0 0 auto;"/>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:bold;">${_esc(this.actor.name)}</div>
          <div style="font-size:.75em;opacity:.65;">${_esc(_npcRole(this.actor.system?.system ?? this.actor.system ?? {}) || "…is listening.")}</div>
        </div>`;
      if (game.user.isGM) {
        const gmBtn = document.createElement("button");
        gmBtn.type = "button";
        gmBtn.title = "Edit private persona notes (GM)";
        gmBtn.style.cssText = "flex:0 0 auto;width:auto;padding:.2em .5em;line-height:1;";
        gmBtn.innerHTML = `<i class="fa-solid fa-brain"></i>`;
        gmBtn.addEventListener("click", () => editPersona(this.actor));
        header.appendChild(gmBtn);

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.title = "Clear conversation history (GM)";
        clearBtn.style.cssText = "flex:0 0 auto;width:auto;padding:.2em .5em;line-height:1;";
        clearBtn.innerHTML = `<i class="fa-solid fa-eraser"></i>`;
        clearBtn.addEventListener("click", async () => {
          this._history = [];
          await _saveHistory(this.actor, []);
          this._els.list.replaceChildren();
          this._bubble("assistant", "…", { system: true }).textContent = "(the slate is wiped clean)";
        });
        header.appendChild(clearBtn);
      }
      root.appendChild(header);

      // Message list
      const list = document.createElement("div");
      list.style.cssText = "flex:1 1 auto;overflow-y:auto;display:flex;flex-direction:column;gap:.4em;padding:.4em;border:1px solid rgba(120,120,120,.35);border-radius:4px;background:rgba(0,0,0,.12);";
      root.appendChild(list);
      this._els.list = list;

      // Input row
      const inputRow = document.createElement("div");
      inputRow.style.cssText = "display:flex;gap:.4em;flex:0 0 auto;align-items:flex-end;";
      const input = document.createElement("textarea");
      input.rows = 2;
      input.placeholder = `Speak to ${this.actor.name}… (Enter to send, Shift+Enter for a new line)`;
      input.style.cssText = "flex:1;resize:none;";
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); this._send(); }
      });
      const sendBtn = document.createElement("button");
      sendBtn.type = "button";
      sendBtn.style.cssText = "flex:0 0 auto;width:auto;padding:.35em .8em;";
      sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
      sendBtn.addEventListener("click", () => this._send());
      inputRow.appendChild(input);
      inputRow.appendChild(sendBtn);
      root.appendChild(inputRow);
      this._els.input = input;
      this._els.sendBtn = sendBtn;

      // Replay stored history
      for (const m of this._history) {
        this._bubble(m.role, m.content, { speaker: m.speaker, noScroll: true });
      }
      requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });

      return root;
    }

    _replaceHTML(result, content, _options) {
      content.replaceChildren(result);
      content.style.display = "flex";
      content.style.flexDirection = "column";
    }

    // ----- DOM helpers -----
    _bubble(role, text, { speaker = null, noScroll = false, system = false } = {}) {
      const isNpc = role === "assistant";
      const wrap = document.createElement("div");
      wrap.style.cssText = `max-width:85%;align-self:${isNpc ? "flex-start" : "flex-end"};`;
      const label = document.createElement("div");
      label.style.cssText = "font-size:.68em;opacity:.55;margin:0 .2em .1em;";
      label.textContent = isNpc ? this.actor.name : (speaker || game.user.name);
      const body = document.createElement("div");
      body.style.cssText = isNpc
        ? "border-left:3px solid #4db8b0;background:rgba(77,184,176,.10);padding:.35em .55em;border-radius:0 6px 6px 0;white-space:pre-wrap;"
        : "border-right:3px solid #b8974d;background:rgba(184,151,77,.10);padding:.35em .55em;border-radius:6px 0 0 6px;white-space:pre-wrap;text-align:left;";
      if (system) body.style.opacity = ".6";
      // Strip the stored "Name: " prefix from user turns for display.
      let display = String(text ?? "");
      if (!isNpc && speaker && display.startsWith(`${speaker}: `)) display = display.slice(speaker.length + 2);
      body.textContent = display;
      wrap.appendChild(label);
      wrap.appendChild(body);
      this._els.list.appendChild(wrap);
      if (!noScroll) this._els.list.scrollTop = this._els.list.scrollHeight;

      // NPC bubbles get a tiny share-to-chat control.
      if (isNpc && !system) {
        const share = document.createElement("a");
        share.style.cssText = "font-size:.65em;opacity:.5;cursor:pointer;margin-left:.3em;";
        share.innerHTML = `<i class="fa-solid fa-share"></i> to chat`;
        share.addEventListener("click", () => this._shareToChat(body.textContent));
        wrap.appendChild(share);
      }
      return body;
    }

    async _shareToChat(text) {
      if (!text) return;
      try {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor, alias: this.actor.name }),
          content: `<div class="bbttcc-mal-voice" style="border-left:3px solid #4db8b0;padding:.4em .6em;background:rgba(77,184,176,.08);font-style:italic">${_esc(text)}</div>`,
          flags: { [MODULE_ID]: { npcDialogue: this.actor.id } }
        });
      } catch (e) { warn("share failed:", e?.message); }
    }

    // ----- The exchange -----
    async _send() {
      if (this._busy) return;
      const raw = String(this._els.input.value || "").trim();
      if (!raw) return;

      const settings = game.bbttcc?.mal?.settings;
      const provider = game.bbttcc?.mal?.providers?.[settings?.provider?.() || "anthropic"];
      if (!provider?.call) return ui.notifications?.warn("Mal Voice provider not available.");
      if (!settings?.apiKey?.()) return ui.notifications?.warn("No API key configured (Module Settings → Bad Eden Mal Voice).");

      const speaker = game.user.character?.name || game.user.name;
      const userContent = `${speaker}: ${raw}`;

      this._busy = true;
      this._els.input.value = "";
      this._els.input.disabled = true;
      this._els.sendBtn.disabled = true;

      this._bubble("user", userContent, { speaker });
      this._history.push({ role: "user", content: userContent, speaker, ts: Date.now() });

      const npcBubble = this._bubble("assistant", "…");

      try {
        const lore = game.bbttcc?.mal?.lore;
        const usePrimer = lore?.enabled?.() !== false;
        const system = [];
        if (usePrimer) system.push({ text: lore?.getPrimer?.() || "", cache: "1h" });
        system.push({ text: _buildPersonaPrompt(this.actor, this._lore), cache: true });

        const res = await provider.call({
          system,
          messages: this._history.map(m => ({ role: m.role, content: m.content })),
          maxTokens: 350,
          temperature: 0.9,
          stream: true,
          onDelta: (text) => {
            npcBubble.textContent = text;
            this._els.list.scrollTop = this._els.list.scrollHeight;
          }
        });

        if (!res.ok) {
          npcBubble.textContent = `(…the words don't come. ${res.error}: ${res.message || ""})`;
          npcBubble.style.opacity = ".55";
        } else {
          npcBubble.textContent = res.text || "…";
          this._history.push({ role: "assistant", content: res.text || "", speaker: this.actor.name, ts: Date.now() });
          await _saveHistory(this.actor, this._history);
          this._logCall(res);
        }
      } catch (e) {
        warn("dialogue exchange failed:", e?.message || e);
        npcBubble.textContent = "(…something swallowed the reply. Check the console.)";
        npcBubble.style.opacity = ".55";
      } finally {
        this._busy = false;
        this._els.input.disabled = false;
        this._els.sendBtn.disabled = false;
        this._els.input.focus();
        this._els.list.scrollTop = this._els.list.scrollHeight;
      }
    }

    _logCall(res) {
      try {
        if (!game.user.isGM) return;
        const entries = (game.settings.get(MODULE_ID, "callLog") || []).slice(-199);
        entries.push({
          ts: Date.now(),
          voiceId: `npc:${this.actor.id}`,
          hook: "npc-dialogue",
          model: res.model,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          cacheReadTokens: res.cacheReadTokens ?? 0,
          cacheWriteTokens: res.cacheWriteTokens ?? 0,
          costUSD: res.costEstimateUSD,
          durationMs: null
        });
        game.settings.set(MODULE_ID, "callLog", entries);
      } catch (_e) { /* non-fatal */ }
    }

    async close(options) {
      APPS.delete(this.actor?.id);
      return super.close(options);
    }
  };

  return NpcDialogueApp;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function talkTo(actorOrToken) {
  const actor = actorOrToken?.actor ?? actorOrToken;
  if (!actor?.id) return ui.notifications?.warn("No actor to talk to.");
  const App = _defineAppClass();
  if (!App) return ui.notifications?.error("ApplicationV2 not available in this Foundry version.");

  let app = APPS.get(actor.id);
  if (app) return app.render({ force: true });
  app = new App(actor);
  APPS.set(actor.id, app);
  return app.render({ force: true });
}

async function editPersona(actor) {
  if (!game.user.isGM) return;
  const cur = String(actor.getFlag(MODULE_ID, "persona")?.notes || "");
  const content = `
    <p style="font-size:.8em;opacity:.75;margin:0 0 .4em;">Private GM truth for <b>${_esc(actor.name)}</b> — knowledge, secrets, agenda, speech quirks. Shapes every reply; never quoted to players.</p>
    <textarea name="notes" rows="12" style="width:100%;">${_esc(cur)}</textarea>`;

  const DialogV2 = foundry.applications?.api?.DialogV2;
  let notes = null;
  if (DialogV2?.wait) {
    notes = await DialogV2.wait({
      window: { title: `Persona — ${actor.name}` },
      position: { width: 480 },
      content,
      buttons: [
        { action: "save", label: "Save", icon: "fa-solid fa-floppy-disk", default: true,
          callback: (_ev, button) => button.form.elements.notes.value },
        { action: "cancel", label: "Cancel", callback: () => null }
      ]
    }).catch(() => null);
  } else {
    notes = await new Promise((resolve) => {
      new Dialog({
        title: `Persona — ${actor.name}`,
        content,
        buttons: {
          save:   { label: "Save", callback: (html) => resolve(html.find?.("[name=notes]").val?.() ?? html[0]?.querySelector("[name=notes]")?.value ?? null) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "save",
        close: () => resolve(null)
      }).render(true);
    });
  }

  if (notes === null || notes === "cancel") return;
  await actor.setFlag(MODULE_ID, "persona", { notes: String(notes) });
  ui.notifications?.info(`Persona notes saved for ${actor.name}.`);
}

// ---------------------------------------------------------------------------
// Entry points.
//
// 1. Keybinding (default Y) — the primary door: hover any NPC token and
//    press the key. Hover needs no ownership, so this works for players
//    and GMs alike. Rebindable in Configure Controls.
// 2. Token HUD button — bonus GM path (Foundry only opens the HUD on
//    right-click of an OWNED token, so players can't reach it on NPCs).
//
// "NPC" at this table means: any actor that is NOT a player's character.
// NPCs are built on the Steward chassis (character-type) or npc-type — so
// we gate on ownership (actor.hasPlayerOwner), never on actor type.
// ---------------------------------------------------------------------------

function _playersAllowed() {
  try { return !!game.settings.get(MODULE_ID, "npcDialoguePlayers"); } catch (_e) { return true; }
}

// Returns null if talkable, else a human-readable refusal reason (logged so
// a silent no-op is always diagnosable from the console).
function _refusalReason(actor, tokenDoc = null) {
  if (!actor) return "token has no actor";
  if (game.user.isGM) return null;                       // GM talks to anything
  if (!_playersAllowed()) return "npcDialoguePlayers setting is off";
  if (tokenDoc?.hidden) return `'${actor.name}' is hidden`;
  if (_isTaggedNpc(actor)) return null;                  // explicit NPC tag (flags.fourththing.kind) always talkable
  if (actor.hasPlayerOwner) return `'${actor.name}' is a player-owned character (stewards aren't AI-driven)`;
  return null;
}

// Hover tracking via the core hoverToken hook — canvas.tokens.hover isn't
// reliable across Foundry versions.
let HOVERED_TOKEN = null;
Hooks.on("hoverToken", (token, hovered) => {
  if (hovered) HOVERED_TOKEN = token;
  else if (HOVERED_TOKEN === token) HOVERED_TOKEN = null;
});

function _resolveHoveredToken() {
  return HOVERED_TOKEN
      || canvas?.tokens?.hover
      || canvas?.tokens?.placeables?.find(t => t.hover)
      || null;
}

Hooks.on("renderTokenHUD", (hud, html) => {
  try {
    const root = (html instanceof HTMLElement) ? html : html?.[0];
    const actor = hud?.object?.actor;
    if (!root || !actor) return;
    const refusal = _refusalReason(actor, hud?.object?.document);
    if (refusal) { log(`HUD button skipped: ${refusal}`); return; }
    const col = root.querySelector(".col.right") || root.querySelector(".col.left") || root;
    if (col.querySelector(".bbttcc-npc-talk")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-icon bbttcc-npc-talk";
    btn.title = `Speak with ${actor.name}`;
    btn.innerHTML = `<i class="fa-solid fa-comments"></i>`;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      talkTo(actor);
    });
    col.appendChild(btn);
  } catch (e) { warn("HUD button failed:", e?.message); }
});

// ---------------------------------------------------------------------------
// Settings + install
// ---------------------------------------------------------------------------

Hooks.once("init", () => {
  // Hover-a-token-and-press-Y. Default is Y (T is taken by core's Target).
  try {
    game.keybindings.register(MODULE_ID, "talkToHovered", {
      name: "Speak with hovered NPC",
      hint: "Open the AI dialogue window for the NPC token under your cursor. Works for players — no token ownership needed.",
      editable: [{ key: "KeyY" }],
      onDown: () => {
        try {
          const tok = _resolveHoveredToken();
          if (!tok) { log("talk key pressed but no token is hovered"); return false; }
          const refusal = _refusalReason(tok.actor, tok.document);
          if (refusal) { log(`talk key refused: ${refusal}`); return false; }
          talkTo(tok.actor);
          return true;
        } catch (e) { warn("talk key failed:", e?.message); return false; }
      }
    });
  } catch (e) { warn("keybinding registration failed:", e?.message); }

  game.settings.register(MODULE_ID, "npcDialoguePlayers", {
    name:    "Players can speak with NPCs",
    hint:    "Show the dialogue button on NPC token HUDs for players (GMs always see it). Conversations use the world API key under the gm-key-powers-all policy.",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: true
  });
});

function _install() {
  try {
    globalThis.game.bbttcc     ??= { api: {} };
    globalThis.game.bbttcc.mal ??= {};
    globalThis.game.bbttcc.mal.npc = Object.assign(globalThis.game.bbttcc.mal.npc || {}, {
      talkTo,
      editPersona,
      _apps: APPS,
      _buildPersonaPrompt,
      _gatherWorldLore
    });
    log("NPC dialogue installed (game.bbttcc.mal.npc.talkTo).");
  } catch (e) {
    warn("install failed:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
