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
const MEMORY_CAP  = 30;          // durable story-event memories per NPC
const APPS = new Map();          // actorId -> app instance

// Stub choices for testing dialogue-driven beats before the campaign side
// ships its API (see badeden-bible/new-content/dialogue-driven-beats-spec.md):
//   game.bbttcc.mal.npc.setTestChoices(actorId, [{choiceKey, label, description}])
const TEST_CHOICES = new Map();  // actorId -> choices[]

// ---------------------------------------------------------------------------
// Persona assembly
// ---------------------------------------------------------------------------

function _stripHtml(s) {
  if (!s) return "";
  // Block-level closers become newlines BEFORE textContent flattening —
  // otherwise `<p>@after: x</p><p>body</p>` collapses to one line and the
  // leading-tag conventions (@after / @knownBy) can't find their line end.
  const html = String(s).replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/blockquote)[^>]*>/gi, "$&\n");
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || "").replace(/[ \t]*\n\s*/g, "\n").trim();
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

// GM-curated knowledge topics for this NPC (🧠 editor, comma-separated) —
// the sweep matches these terms in journals/beats IN ADDITION to the NPC's
// own name, so "Dougan Marsh, Gullywasher" makes her know those stories too.
function _personaTopics(actor) {
  return String(actor?.getFlag?.(MODULE_ID, "persona")?.topics || "")
    .split(",").map(t => t.trim().toLowerCase()).filter(t => t.length >= 3);
}

// Common knowledge: every text page of the designated journal (setting
// `npcCommonJournal`, default "NPC Common Knowledge") is included for EVERY
// NPC — the gazetteer of what any local knows: places, who's who, who holds
// what, current events. Write it once, all NPCs know it.
function _commonKnowledge({ maxChars = 9000, state = null } = {}) {
  let journalName = "NPC Common Knowledge";
  try { journalName = String(game.settings.get(MODULE_ID, "npcCommonJournal") || "").trim() || journalName; } catch (_e) {}
  const entry = game.journal?.getName?.(journalName) || game.journal?.contents?.find(j => j.name === journalName);
  if (!entry) return "";
  const parts = [];
  let used = 0;
  for (const page of entry.pages?.contents ?? []) {
    if (page.type !== "text" || used >= maxChars) continue;
    const raw = _stripHtml(page.text?.content || "");
    // Tag conventions apply here too: @knownBy pages are scoped (dossier
    // channel, not everyone's), @after pages stay hidden until the story
    // arrives (fails closed), and tag lines never reach the model.
    const { gate, knownBy, body } = _parsePageTags(raw);
    if (knownBy) continue;
    if (gate && !_questKnown(state, gate.questId, gate.needCompleted)) continue;
    const text = body.trim();
    if (!text) continue;
    const chunk = `— ${page.name}:\n${text}`.slice(0, maxChars - used);
    parts.push(chunk);
    used += chunk.length;
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Narrative time — the story state gates NPC KNOWLEDGE (what has happened vs
// what hasn't), just as choicesFor gates NPC MOMENTS. Provided by the
// campaign engine: game.bbttcc.api.campaign.dialogue.storyStateFor(actorId)
// -> { turn, quests: {completed:[{id,title}], active:[...], unstarted:[...]},
//      firedBeatIds: [...] }
// All consumption is defensive: absent API = current include-all behavior
// (except @after-tagged journal pages, which fail CLOSED — never leak the
// future).
// ---------------------------------------------------------------------------

async function _storyState(actor) {
  try {
    const api = game.bbttcc?.api?.campaign?.dialogue;
    if (!api?.storyStateFor) return null;
    const s = await api.storyStateFor(actor?.id ?? null);
    return (s && typeof s === "object") ? s : null;
  } catch (e) { warn("storyStateFor failed:", e?.message); return null; }
}

function _questKnown(state, questId, needCompleted = false) {
  if (!state) return false;   // fail closed for gated content
  const id = String(questId || "");
  // Beat gate: `@after: beat:<beatId>` — known once that beat has ACTUALLY
  // fired (storyStateFor.firedBeatIds: director fires ∪ dialogue enacts ∪
  // per-beat quest marks). This is how BRANCHED outcomes program community
  // knowledge: author one page per ending; only the fired one lights up.
  if (id.startsWith("beat:")) {
    const bid = id.slice(5);
    return (state.firedBeatIds || []).some(b => String(b) === bid);
  }
  const has = (arr) => (arr || []).some(q => String(q?.id ?? q) === String(id));
  if (needCompleted) return has(state.quests?.completed);
  return has(state.quests?.completed) || has(state.quests?.active);
}

// Journal page tag conventions — tags live on the page's LEADING lines (any
// order, one per line), and are stripped from the content that reaches the
// model:
//   @after: <questId>            page invisible until the quest is active/completed
//   @after: <questId>:completed  page invisible until the quest is completed
//   @knownBy: <who>, <who>, …    WORLD DOSSIER page — injected WHOLE into the
//                                knowledge of exactly the listed NPCs (never
//                                substring-swept). <who> = an actor name, an
//                                actor id, `faction:<name-or-id>`, or `all`.
//                                The page's SUBJECT knows it implicitly (page
//                                name == actor name).
function _parsePageTags(text) {
  let rest = String(text || "");
  let gate = null;
  let knownBy = null;
  // Consume tag lines (and blank lines between them) from the top.
  for (;;) {
    const mAfter = rest.match(/^\s*@after:\s*([\w:-]+?)(?::(completed))?\s*(?:\n|$)/i);
    if (mAfter) {
      gate = { questId: mAfter[1], needCompleted: !!mAfter[2] };
      rest = rest.slice(mAfter[0].length);
      continue;
    }
    const mKnown = rest.match(/^\s*@knownby:\s*([^\n]+?)\s*(?:\n|$)/i);
    if (mKnown) {
      knownBy = mKnown[1].split(",").map(s => s.trim()).filter(Boolean);
      rest = rest.slice(mKnown[0].length);
      continue;
    }
    break;
  }
  return { gate, knownBy, body: rest };
}

// Back-compat shim (old name, @after only).
function _parseAfterTag(text) {
  const { gate, body } = _parsePageTags(text);
  return { gate, body };
}

// ---------------------------------------------------------------------------
// WORLD DOSSIER — the persistent, authorable knowledge substrate.
//
// Any journal page carrying a leading `@knownBy:` tag is a dossier page: an
// explicit fact-sheet about one entity (a person, place, or faction) that the
// listed NPCs know WHOLE — deterministic curated knowledge, not substring
// luck. Convention: keep them in a "World Dossier" journal, one page per
// entity, but the tag works in any journal. `@after:` composes for facts the
// NPC only learns once the story arrives (fails closed without story state).
// This is the STATIC/authored layer; `memories` stays the layer that grows
// from play.
// ---------------------------------------------------------------------------

function _gatherDossier(actor, { maxChars = 12000, state = null } = {}) {
  const name = String(actor?.name || "").trim().toLowerCase();
  if (!name) return "";
  const ids = new Set([String(actor.id || ""), name]);
  const factionId = actor.flags?.["bbttcc-factions"]?.factionId
    || actor.system?.faction?.id || actor.system?.factionId || null;
  const factionName = factionId ? String(game.actors?.get?.(factionId)?.name || "").toLowerCase() : "";

  // Tier: 0 = names this actor (or is their own page), 1 = faction knowledge,
  // 2 = public ("all"). When the corpus outgrows the budget, the most personal
  // knowledge survives — an NPC never loses THEIR people to a gazetteer page.
  const tierOf = (who) => {
    const w = String(who || "").trim();
    const low = w.toLowerCase();
    if (!low) return -1;
    if (low === "all") return 2;
    if (low.startsWith("faction:")) {
      const f = low.slice(8).trim();
      return (!!f && (f === factionName || (factionId && w.slice(8).trim() === factionId))) ? 1 : -1;
    }
    return (ids.has(low) || ids.has(w)) ? 0 : -1;   // actor name (case-insensitive) or raw id
  };

  const found = [];
  try {
    for (const entry of game.journal?.contents ?? []) {
      for (const page of entry.pages?.contents ?? []) {
        if (page.type !== "text") continue;
        const raw = _stripHtml(page.text?.content || "");
        const { gate, knownBy, body } = _parsePageTags(raw);
        if (!knownBy) continue;                                     // not a dossier page
        if (gate && !_questKnown(state, gate.questId, gate.needCompleted)) continue;
        const isSelf = String(page.name || "").trim().toLowerCase() === name;
        const tiers = knownBy.map(tierOf).filter(t => t >= 0);
        if (!isSelf && !tiers.length) continue;
        const text = body.trim();
        if (!text) continue;
        const tier = isSelf ? 0 : Math.min(...tiers);
        found.push({ tier, chunk: `— ${page.name}:\n${text.slice(0, 2000)}` });
      }
    }
  } catch (e) { warn("dossier sweep failed:", e?.message); }

  // Personal first; authored (journal) order within a tier. Fill to budget.
  found.sort((a, b) => a.tier - b.tier);
  const parts = [];
  let used = 0;
  for (const f of found) {
    if (used + f.chunk.length > maxChars) break;
    parts.push(f.chunk);
    used += f.chunk.length;
  }
  return parts.join("\n\n");
}

function _gatherWorldLore(actor, { maxChars = 9000, state = null } = {}) {
  const name = String(actor?.name || "").trim();
  if (!name) return "";

  const terms = [name.toLowerCase()];
  const first = name.split(/\s+/)[0];
  if (first && first.length >= 4 && first.toLowerCase() !== terms[0]) terms.push(first.toLowerCase());
  terms.push(..._personaTopics(actor));
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

  // Journal pages: keep only the paragraphs that mention the NPC. Pages
  // gated with @after: are invisible until the campaign reaches them.
  try {
    outer:
    for (const entry of game.journal?.contents ?? []) {
      for (const page of entry.pages?.contents ?? []) {
        if (page.type !== "text") continue;
        const raw = _stripHtml(page.text?.content || "");
        const { gate, knownBy, body } = _parsePageTags(raw);
        if (knownBy) continue;   // dossier pages travel whole via _gatherDossier, never line-swept
        if (gate && !_questKnown(state, gate.questId, gate.needCompleted)) continue;
        const text = body;
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
    // With story state available, only FIRED beats are part of the chronicle
    // — an unfired beat hasn't happened, so the NPC can't know its contents.
    // (Currently-offerable moments reach the model via STORY MOMENTS instead.)
    const fired = Array.isArray(state?.firedBeatIds) ? new Set(state.firedBeatIds.map(String)) : null;
    outer2:
    for (const c of campaigns) {
      for (const b of (c?.beats ?? [])) {
        if (fired && b?.id && !fired.has(String(b.id))) continue;
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

// Authoritative now-line: what is done, underway, and NOT YET. Overrides any
// chronicle bleed-through — the fix for "Mara already knows Pip is missing".
function _presentMomentSection(state) {
  if (!state?.quests) return "";
  const list = (arr) => (arr || []).map(q => `• ${String(q?.title ?? q?.id ?? q)}`).join("\n");
  const done     = list(state.quests.completed);
  const active   = list(state.quests.active);
  const notyet   = list(state.quests.unstarted);
  if (!done && !active && !notyet) return "";
  return `## YOUR PRESENT MOMENT (authoritative — this OVERRIDES everything else in this prompt about what has happened)
The story stands exactly here, right now. Anything mentioned anywhere above that is not corroborated below as done or underway has NOT HAPPENED YET — you have no knowledge of it and no feelings about it, because for you it does not exist.
${done ? `\nDONE (lived history — you may remember and reference these):\n${done}` : ""}
${active ? `\nUNDERWAY (your live concerns right now):\n${active}` : ""}
${notyet ? `\nNOT YET (these do not exist for you — never mention, never hint, never grieve them):\n${notyet}` : ""}`;
}

function _buildPersonaPrompt(actor, lore = null, state = null, dossier = null) {
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

  // Durable story-event memories (written by the campaign engine when beats
  // this NPC embodies fire, or via game.bbttcc.mal.npc.addMemory) — how Mara
  // "remembers" handing over the Leygate part when she later calls about Pip.
  const memories = (actor.getFlag(MODULE_ID, "memories") || [])
    .slice(-MEMORY_CAP)
    .map(m => `• ${String(m?.text ?? m ?? "").trim()}`)
    .filter(l => l.length > 2);

  const facts = [];
  if (role)        facts.push(`Role/occupation: ${role}`);
  if (creature)    facts.push(`Creature type: ${creature}`);
  if (factionName) facts.push(`Faction: ${factionName}`);
  facts.push(..._identityFromItems(actor));
  if (tags)        facts.push(`Tags: ${tags}`);
  facts.push(`Rough power tier: ${tier} (express through demeanor, never numbers)`);
  if (sceneName)   facts.push(`Current scene: ${sceneName}`);

  const worldLore = (lore === null) ? _gatherWorldLore(actor, { state }) : String(lore || "");
  const dossierText = (dossier === null) ? _gatherDossier(actor, { state }) : String(dossier || "");
  const common = _commonKnowledge({ state });

  return `You are ${name}, a character living in Bad Eden. You are IN CONVERSATION with one or more Stewards standing in front of you. Stay completely in character as ${name} at all times.

## WHO YOU ARE
${facts.map(f => `• ${f}`).join("\n")}
${notes ? `\n## YOUR STORY (bio/notes — this is what shaped you)\n${notes}` : ""}
${memories.length ? `\n## SHARED HISTORY (things that truly happened between you and the Stewards — you remember these firsthand and may refer back to them)\n${memories.join("\n")}` : ""}
${common ? `\n## COMMON KNOWLEDGE (what any local knows — places, people, who holds what)\n${common}` : ""}
${dossierText ? `\n## PEOPLE & PLACES YOU KNOW (your own firsthand knowledge — these facts are true and familiar to you; speak of them naturally, in your own voice, from your own point of view)\n${dossierText}` : ""}
${worldLore ? `\n## WHAT THE CHRONICLE SAYS (about you, and about things you know)\nThese are events, descriptions, and moments involving you or subjects you know about. Past-tense entries are lived history or established fact — you remember or have heard them from your own point of view. Future-sounding or conditional entries have NOT happened: treat them at most as rumors, premonitions, or things you're entangled in but don't fully understand — never state them as fact, and never reveal them as "beats", "choices", or any other game construct. Where the YOUR PRESENT MOMENT section below disagrees with anything here, the PRESENT MOMENT wins.\n\n${worldLore}` : ""}
${_presentMomentSection(state)}
${gmNotes ? `\n## PRIVATE TRUTH (GM notes — these facts are TRUE about you and guide everything you say, but you NEVER recite them verbatim, and you guard anything marked secret the way a real person guards secrets)\n${gmNotes}` : ""}

## HOW TO SPEAK
1. Reply as ${name} would — voice, dialect, mood, agenda. 1–4 sentences unless the moment truly demands more. Plain speech only: no markdown, no stage directions, no narration of your own actions unless brief and natural ("*spits*" style asides are fine sparingly).
2. You know ONLY what ${name} would plausibly know. If asked about things beyond your world, knowledge, or station, react in character — confusion, suspicion, deflection, a shrug. Never break character, never mention being an AI, never reveal game mechanics or numbers.
2b. NEVER INVENT FACTS about named people, places, factions, territory, or events that are not in your knowledge above. If a Steward asks about someone or somewhere you don't recognize, say so in character ("Can't say I know the name — ask around the co-op") or clearly frame guesses as hearsay ("Way I heard it — and I heard it thirdhand…"). Getting the world wrong is worse than admitting ignorance. You may freely invent SMALL personal color (your own tastes, minor anecdotes, prices you'd charge) — never geography, allegiance, or history.
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
      // World-lore + dossier sweeps are async now (story-state gated) — run
      // in _renderHTML on open; byte-stable across the conversation so the
      // cached persona block keeps hitting.
      this._lore = null;
      this._dossier = null;
      this._storyState = null;
    }

    get title() { return `${this.actor?.name ?? "NPC"}`; }

    async _renderHTML(_context, _options) {
      // Narrative-time-aware lore sweep, once per window open.
      if (this._lore === null) {
        this._storyState = await _storyState(this.actor);
        this._lore = _gatherWorldLore(this.actor, { state: this._storyState });
        this._dossier = _gatherDossier(this.actor, { state: this._storyState });
        log(`world lore for '${this.actor.name}': ${this._lore.length} chars, dossier: ${this._dossier.length} chars` +
            (this._storyState ? " (story-state gated)" : " (no story state API — ungated)"));
      }
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

        // GM: fire a story moment deterministically — conversation is the
        // preferred surface, but when the model narrates around a committed
        // decision instead of enacting it, the GM pulls the trigger here and
        // the NPC then closes the scene in character.
        const boltBtn = document.createElement("button");
        boltBtn.type = "button";
        boltBtn.title = "Enact a story moment now (GM)";
        boltBtn.style.cssText = "flex:0 0 auto;width:auto;padding:.2em .5em;line-height:1;";
        boltBtn.innerHTML = `<i class="fa-solid fa-bolt"></i>`;
        boltBtn.addEventListener("click", () => this._gmFireMoment());
        header.appendChild(boltBtn);

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

    // ----- Dialogue-driven beats (story moments) -----
    // Contract: badeden-bible/new-content/dialogue-driven-beats-spec.md.
    // The campaign engine reports which beat choices this NPC currently
    // embodies; they become a closed-enum tool the model may call when the
    // conversation naturally arrives there. Nothing new is ever invented —
    // the enum IS the beat's existing choices, gates already applied.
    async _availableChoices() {
      try {
        const api = game.bbttcc?.api?.campaign?.dialogue;
        if (api?.choicesFor) {
          const out = await api.choicesFor(this.actor.id, {});
          if (Array.isArray(out)) return out.filter(c => c?.choiceKey && c?.label);
        }
      } catch (e) { warn("choicesFor failed:", e?.message); }
      return TEST_CHOICES.get(this.actor.id) || [];
    }

    // ----- Mid-conversation doors (point_the_way) -----
    // The fiction moves before any commitment does ("she leads them back
    // through the crates…") — this tool lets the NPC make the path REAL:
    // calling it posts a clickable signpost card (scene doors activate the
    // beat's scene + narrate its arrival; hub doors run the next beat).
    async _availableDoors() {
      try {
        const api = game.bbttcc?.api?.campaign?.dialogue;
        if (api?.doorsFor) {
          const out = await api.doorsFor(this.actor.id, {});
          if (Array.isArray(out)) return out.filter(d => d?.key && d?.label);
        }
      } catch (e) { warn("doorsFor failed:", e?.message); }
      return [];
    }

    _doorTool(doors) {
      return {
        name: "point_the_way",
        description: "Make the path real when you lead or direct the Stewards somewhere. Call this AS you narrate taking them there or pointing them there — a clickable way appears for the table. It does not end the conversation and commits no one.",
        input_schema: {
          type: "object",
          properties: {
            doorKey: { type: "string", enum: doors.map(d => String(d.key)) },
            line: { type: "string", description: "One short in-character line for the signpost card (e.g. 'Right through here, past the crates.')." }
          },
          required: ["doorKey"]
        }
      };
    }

    _doorsSection(doors) {
      return `## WAYS YOU CAN OPEN (via the point_the_way tool)
${doors.map(d => `• [${d.key}] ${d.label}`).join("\n")}

Ways are places AND people. When you lead the Stewards somewhere, direct them there, or HAND THEM OFF to someone ("come on, I'll walk you over" / "she'll want a word"), call point_the_way with the matching way AS you narrate it — the path or the person becomes real and clickable for the table, and a hand-off opens that conversation at once. At most once per move. It does not end your conversation, and it commits nobody to anything.`;
    }

    async _resolveDoor(toolUse, doors) {
      const key = String(toolUse?.input?.doorKey || "");
      const door = doors.find(d => String(d.key) === key);
      if (!door) return "No such way is open. Continue the conversation naturally.";
      try {
        const api = game.bbttcc?.api?.campaign?.dialogue;
        if (api?.pointTheWay) {
          // Person-doors carry the scene with them: the handed-to NPC gets
          // the tail of THIS conversation so they know what just happened.
          const transcript = this._history.slice(-8).map(m => m.content).join("\n");
          const r = await api.pointTheWay({ actorId: this.actor.id, doorKey: key, line: String(toolUse?.input?.line || ""), transcript, userId: game.user.id });
          if (r?.ok) return r.summary || "The way stands open. Continue in character.";
          return `The way could not be opened (${r?.error || "unknown"}). Continue naturally.`;
        }
      } catch (e) { warn("pointTheWay failed:", e?.message); }
      return "The way could not be opened. Continue naturally.";
    }

    _choiceTool(choices) {
      return {
        name: "enact_story_choice",
        description: "Enact one of your currently-available story moments. Call this ONLY when the conversation has naturally arrived at that decision and a Steward has clearly committed to it. Never call it speculatively.",
        input_schema: {
          type: "object",
          properties: {
            choiceKey: { type: "string", enum: choices.map(c => String(c.choiceKey)) },
            rationale: { type: "string", description: "One short line: how the conversation arrived at this moment." }
          },
          required: ["choiceKey"]
        }
      };
    }

    _momentsSection(choices) {
      // Group rows by beat: each beat is a SCENE with an authored script
      // (the beat description — the NPC's own pre-written dialog) and the
      // real paths on the table (the choices).
      const scenes = new Map();
      for (const c of choices) {
        const key = String(c.beatId ?? c.beatLabel ?? c.choiceKey);
        if (!scenes.has(key)) scenes.set(key, { label: c.beatLabel || "", script: c.beatDescription || "", rows: [] });
        scenes.get(key).rows.push(c);
      }
      const blocks = [...scenes.values()].map(s =>
        `◈ SCENE: ${s.label}` +
        (s.script ? `\n  Your script (authored for you — deliver its substance in your own voice when the scene opens):\n  ${s.script}` : "") +
        `\n  The real paths on the table:\n` +
        s.rows.map(c => `  • [${c.choiceKey}] ${c.label}${c.description ? ` — ${c.description}` : ""}`).join("\n"));

      return `## STORY MOMENTS YOU MAY ENACT (via the enact_story_choice tool)
These are real crossroads in the story that YOU embody right now:

${blocks.join("\n\n")}

How to handle them:
1. THE MOMENT A STEWARD RAISES A SCENE'S SUBJECT (asks for the thing, names the problem), MOVE INTO THE SCENE: play your script, then lay the real paths before them plainly, in your own voice, as natural offers — "we could trade proper… or talk a shared arrangement… or you can walk". Do NOT make them guess what's possible; you are the one holding the terms. Just never recite them as a numbered menu.
2. Path descriptions are the narrator talking to the players — treat them as scene direction (stakes, tone, costs, consequences). NEVER read them aloud, and never name dice, checks, points, or costs by game words; translate stakes into your own speech (a fair swap, a favor owed, a hard price, bad blood).
3. Only call the tool when a Steward has CLEARLY committed in the conversation ("yes, we'll do it", handing over the thing, agreeing to go). Weighing a path aloud is not committing to it — BUT a decision REPORTED AS ALREADY MADE ("it's done — we chose mercy", "I showed him mercy, he'll work it off") IS a commitment: call the tool for the matching path immediately, so the decision becomes real. Do not close a scene in words while leaving its moment un-enacted.
4. If the Stewards decline or drift away, let it go gracefully — the moment remains open for another day.
5. After the tool returns, narrate what just happened in character, in your own voice.
6. Never mention the tool, keys, beats, or choices as game constructs.`;
    }

    // GM ⚡: enact one of this NPC's live moments directly (real pipeline —
    // curtain call, memories, quest effects, handoff card), then nudge the
    // NPC to close the scene in character.
    async _gmFireMoment() {
      if (!game.user.isGM) return;
      const api = game.bbttcc?.api?.campaign?.dialogue;
      if (!api?.enact) return ui.notifications?.warn?.("Campaign dialogue API not available.");
      const choices = await this._availableChoices();
      if (!choices.length) return ui.notifications?.info?.(`${this.actor.name} holds no live story moments right now.`);
      const DialogV2 = foundry.applications?.api?.DialogV2;
      const options = choices.map(c =>
        `<option value="${_esc(c.choiceKey)}">${_esc(c.beatLabel || c.beatId)} — ${_esc(c.label)}</option>`).join("");
      const content = `<p style="font-size:.85em;opacity:.8;">Enact which moment through <b>${_esc(this.actor.name)}</b>? (Runs the real pipeline; the NPC then closes the scene in character.)</p>
        <select name="choiceKey" style="width:100%;">${options}</select>`;
      let picked = null;
      try {
        if (DialogV2?.wait) {
          picked = await DialogV2.wait({
            window: { title: `Story moment — ${this.actor.name}` }, content,
            buttons: [
              { action: "fire", label: "Enact", icon: "fa-solid fa-bolt", default: true,
                callback: (_ev, button) => String(button.form?.elements?.choiceKey?.value || "") },
              { action: "cancel", label: "Cancel", callback: () => null }
            ]
          }).catch(() => null);
        }
      } catch (_e) { picked = null; }
      if (!picked || picked === "cancel") return;
      const choice = choices.find(c => String(c.choiceKey) === String(picked));
      if (!choice) return;
      const r = await api.enact({
        beatId: choice.beatId, choiceIndex: choice.choiceIndex, choiceKey: choice.choiceKey,
        speakerActorId: this.actor.id, userId: game.user.id,
        transcript: this._history.slice(-6).map(m => m.content).join("\n")
      });
      if (r?.ok === false) return ui.notifications?.warn?.(`Moment failed: ${r?.error || "unknown"}`);
      await this._send(`[Scene note — not spoken by anyone: the moment has just TRULY happened. ${String(r?.summary || "")} Narrate the close in character — deliver the authored scene's substance in your own voice, then let the scene end.]`, "— scene —");
    }

    // Executes (or routes for approval) an enact_story_choice tool call.
    // Returns the tool_result text the model narrates from.
    async _resolveEnact(toolUse, choices) {
      const key = String(toolUse?.input?.choiceKey || "");
      const choice = choices.find(c => String(c.choiceKey) === key);
      if (!choice) return `No such moment is available. Continue the conversation naturally without it.`;

      let mode = "gm-confirm";
      try { mode = game.settings.get(MODULE_ID, "dialogueEnactMode") || "gm-confirm"; } catch (_e) {}
      const api = game.bbttcc?.api?.campaign?.dialogue;
      const transcript = this._history.slice(-6).map(m => m.content).join("\n");

      const doEnact = async () => {
        if (api?.enact) {
          const r = await api.enact({
            beatId: choice.beatId ?? null,
            choiceIndex: choice.choiceIndex ?? null,
            choiceKey: key,
            speakerActorId: this.actor.id,
            userId: game.user.id,
            transcript
          });
          if (r?.ok === false) return `The moment could not be enacted (${r?.error || "unknown"}). Continue naturally; treat it as not yet happened.`;
          return r?.summary || `The moment "${choice.label}" has now truly happened. Narrate it in character.`;
        }
        // Stub path (campaign API not yet installed): mark it enacted for testing.
        log(`STUB enact: ${key} ("${choice.label}") — campaign.dialogue.enact not installed yet`);
        return `The moment "${choice.label}" has now truly happened (test harness). Narrate it in character.`;
      };

      // GM at the keyboard: inline confirm (or straight through on auto).
      if (game.user.isGM) {
        if (mode === "gm-confirm") {
          const ok = await this._confirmEnact(choice);
          if (!ok) return `The Gamemaster holds this moment back for now. It has NOT happened — steer the conversation gently elsewhere.`;
        }
        return await doEnact();
      }

      // Player at the keyboard: campaign.dialogue.enact is GM-client only,
      // so player-initiated moments ALWAYS route through the GM approval
      // card (regardless of dialogueEnactMode). The NPC speaks as if the
      // deal is struck in words while the deed awaits.
      await this._postApprovalCard(choice, transcript);
      return `The agreement has been spoken and the Gamemaster has been notified, but the deed itself has NOT happened yet. Speak as someone who has just shaken hands on a thing that is about to be done.`;
    }

    async _confirmEnact(choice) {
      const DialogV2 = foundry.applications?.api?.DialogV2;
      const content = `<p><b>${_esc(this.actor.name)}</b> wants to enact:</p><p style="margin:.3em 0;"><b>${_esc(choice.label)}</b>${choice.description ? `<br><span style="font-size:.85em;opacity:.8;">${_esc(choice.description)}</span>` : ""}</p>`;
      try {
        if (DialogV2?.confirm) return !!(await DialogV2.confirm({ window: { title: "Enact story moment?" }, content }));
        return !!(await Dialog.confirm({ title: "Enact story moment?", content }));
      } catch (_e) { return false; }
    }

    async _postApprovalCard(choice, transcript) {
      try {
        const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
        await ChatMessage.create({
          whisper: gmIds,
          content: `<div class="bbttcc-mal-voice" style="border-left:3px solid #b8974d;padding:.4em .6em;background:rgba(184,151,77,.08);">
            <b>Story moment awaiting approval</b><br>
            <b>${_esc(this.actor.name)}</b> → <i>${_esc(choice.label)}</i><br>
            ${choice.description ? `<span style="font-size:.85em;opacity:.8;">${_esc(choice.description)}</span><br>` : ""}
            <button type="button" data-bbttcc-enact="approve" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-check"></i> Enact</button>
            <button type="button" data-bbttcc-enact="decline" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-xmark"></i> Decline</button>
          </div>`,
          flags: { [MODULE_ID]: { pendingEnact: {
            beatId: choice.beatId ?? null, choiceIndex: choice.choiceIndex ?? null,
            choiceKey: choice.choiceKey, label: choice.label,
            speakerActorId: this.actor.id, userId: game.user.id, transcript
          } } }
        });
      } catch (e) { warn("approval card failed:", e?.message); }
    }

    // ----- The exchange -----
    // overrideRaw/overrideSpeaker: programmatic turns (scene notes) — used by
    // nudge() so an NPC can SPEAK FIRST when a conversation is handed to them.
    async _send(overrideRaw = null, overrideSpeaker = null) {
      if (this._busy) return;
      const raw = String(overrideRaw ?? this._els.input.value ?? "").trim();
      if (!raw) return;

      const settings = game.bbttcc?.mal?.settings;
      const provider = game.bbttcc?.mal?.providers?.[settings?.provider?.() || "anthropic"];
      if (!provider?.call) return ui.notifications?.warn("Mal Voice provider not available.");
      if (!settings?.apiKey?.()) return ui.notifications?.warn("No API key configured (Module Settings → Bad Eden Mal Voice).");

      const speaker = overrideSpeaker || game.user.character?.name || game.user.name;
      const userContent = overrideSpeaker ? raw : `${speaker}: ${raw}`;

      this._busy = true;
      if (overrideRaw === null) this._els.input.value = "";
      this._els.input.disabled = true;
      this._els.sendBtn.disabled = true;

      this._bubble("user", userContent, { speaker });
      this._history.push({ role: "user", content: userContent, speaker, ts: Date.now() });

      const npcBubble = this._bubble("assistant", "…");

      try {
        const lore = game.bbttcc?.mal?.lore;
        const usePrimer = lore?.enabled?.() !== false;
        // Fresh story state each send — quests can advance mid-conversation
        // (an enacted moment may complete one). Persona's PRESENT MOMENT
        // section keeps the NPC anchored to narrative NOW.
        this._storyState = await _storyState(this.actor);
        const system = [];
        if (usePrimer) system.push({ text: lore?.getPrimer?.() || "", cache: "1h" });
        system.push({ text: _buildPersonaPrompt(this.actor, this._lore, this._storyState, this._dossier), cache: true });

        // Story moments + doors: closed-enum tools + UNCACHED system sections
        // (quest state changes between sends; keep after cached breakpoints).
        const choices = await this._availableChoices();
        const doors = await this._availableDoors();
        const toolList = [];
        if (choices.length) { toolList.push(this._choiceTool(choices)); system.push({ text: this._momentsSection(choices) }); }
        if (doors.length)   { toolList.push(this._doorTool(doors));     system.push({ text: this._doorsSection(doors) }); }
        const tools = toolList.length ? toolList : undefined;

        const baseMessages = this._history.map(m => ({ role: m.role, content: m.content }));
        const res = await provider.call({
          system,
          messages: baseMessages,
          tools,
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
          let finalText = res.text || "";
          this._logCall(res);

          // Tool loop (single round): enact the story moment, then let the
          // NPC narrate onward with the outcome as tool_result. Continuation
          // streams into the same bubble below any pre-tool text.
          if (res.toolUses?.length && tools) {
            const tu = res.toolUses[0];
            log(`tool requested: ${tu.name} ${JSON.stringify(tu.input || {}).slice(0, 160)}`);
            const resultText = (tu.name === "point_the_way")
              ? await this._resolveDoor(tu, doors)
              : await this._resolveEnact(tu, choices);
            const prefix = finalText ? `${finalText}\n\n` : "";
            const cont = await provider.call({
              system,
              messages: [
                ...baseMessages,
                { role: "assistant", content: res.content },
                { role: "user", content: [{ type: "tool_result", tool_use_id: tu.id, content: resultText }] }
              ],
              tools,
              toolChoice: { type: "none" },   // one moment per message
              maxTokens: 350,
              temperature: 0.9,
              stream: true,
              onDelta: (text) => {
                npcBubble.textContent = prefix + text;
                this._els.list.scrollTop = this._els.list.scrollHeight;
              }
            });
            if (cont.ok) {
              finalText = prefix + (cont.text || "");
              this._logCall(cont);
            } else {
              finalText = prefix + `(…the moment lands, but the words trail off. ${cont.error})`;
            }
          }

          npcBubble.textContent = finalText || "…";
          this._history.push({ role: "assistant", content: finalText || "", speaker: this.actor.name, ts: Date.now() });
          await _saveHistory(this.actor, this._history);
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
  const cur = actor.getFlag(MODULE_ID, "persona") || {};
  const content = `
    <p style="font-size:.8em;opacity:.75;margin:0 0 .4em;"><b>Knowledge topics</b> — comma-separated names/places/subjects <b>${_esc(actor.name)}</b> knows about. The journal/beat sweep pulls every paragraph mentioning these, so "Dougan Marsh, The Gullywasher" makes those stories part of what they know. (For curated whole-page facts, prefer a World Dossier journal page tagged <code>@knownBy: ${_esc(actor.name)}</code> — it's injected verbatim, no keyword luck.)</p>
    <input type="text" name="topics" style="width:100%;margin-bottom:.6em;" placeholder="Dougan Marsh, The Gullywasher, Port Kudzu…" value="${_esc(cur.topics || "")}"/>
    <p style="font-size:.8em;opacity:.75;margin:0 0 .4em;"><b>Private GM truth</b> — knowledge, secrets, agenda, speech quirks. Shapes every reply; never quoted to players.</p>
    <textarea name="notes" rows="10" style="width:100%;">${_esc(cur.notes || "")}</textarea>`;

  const readForm = (form) => ({
    topics: String(form?.elements?.topics?.value ?? ""),
    notes:  String(form?.elements?.notes?.value ?? "")
  });

  const DialogV2 = foundry.applications?.api?.DialogV2;
  let result = null;
  if (DialogV2?.wait) {
    result = await DialogV2.wait({
      window: { title: `Persona — ${actor.name}` },
      position: { width: 480 },
      content,
      buttons: [
        { action: "save", label: "Save", icon: "fa-solid fa-floppy-disk", default: true,
          callback: (_ev, button) => readForm(button.form) },
        { action: "cancel", label: "Cancel", callback: () => null }
      ]
    }).catch(() => null);
  } else {
    result = await new Promise((resolve) => {
      new Dialog({
        title: `Persona — ${actor.name}`,
        content,
        buttons: {
          save:   { label: "Save", callback: (html) => {
            const root = html[0] ?? html;
            resolve({
              topics: root.querySelector?.("[name=topics]")?.value ?? "",
              notes:  root.querySelector?.("[name=notes]")?.value ?? ""
            });
          } },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "save",
        close: () => resolve(null)
      }).render(true);
    });
  }

  if (!result || result === "cancel" || typeof result !== "object") return;
  await actor.setFlag(MODULE_ID, "persona", { notes: String(result.notes), topics: String(result.topics) });
  // Open windows re-sweep so new topics take effect immediately.
  const app = APPS.get(actor.id);
  if (app) {
    app._storyState = await _storyState(actor);
    app._lore = _gatherWorldLore(actor, { state: app._storyState });
    app._dossier = _gatherDossier(actor, { state: app._storyState });
    log(`persona saved; lore re-swept for '${actor.name}' (${app._lore.length} chars, dossier ${app._dossier.length})`);
  }
  ui.notifications?.info(`Persona saved for ${actor.name}.`);
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
// GM approval cards (player-initiated story moments in gm-confirm mode)
// ---------------------------------------------------------------------------

async function _handleApprovalClick(message, action) {
  if (!game.user.isGM) return;
  const p = message.getFlag(MODULE_ID, "pendingEnact");
  if (!p) return;

  let outcome;
  if (action === "approve") {
    try {
      const api = game.bbttcc?.api?.campaign?.dialogue;
      if (api?.enact) {
        const r = await api.enact({
          beatId: p.beatId, choiceIndex: p.choiceIndex, choiceKey: p.choiceKey,
          speakerActorId: p.speakerActorId, userId: p.userId, transcript: p.transcript
        });
        outcome = (r?.ok === false) ? `⚠ enact failed: ${r?.error || "unknown"}` : `✓ Enacted — ${r?.summary || p.label}`;
      } else {
        log(`STUB enact (approval card): ${p.choiceKey} ("${p.label}")`);
        outcome = `✓ Enacted (test harness) — ${p.label}`;
      }
    } catch (e) {
      outcome = `⚠ enact threw: ${e?.message || e}`;
    }
  } else {
    outcome = `✗ Declined by the Gamemaster`;
  }

  try {
    await message.update({
      content: `<div class="bbttcc-mal-voice" style="border-left:3px solid #b8974d;padding:.4em .6em;background:rgba(184,151,77,.08);">
        <b>Story moment</b> — ${_esc(p.label)}<br>${_esc(outcome)}</div>`,
      [`flags.${MODULE_ID}.pendingEnact`]: null
    });
  } catch (e) { warn("approval card update failed:", e?.message); }
}

function _bindApprovalButtons(message, root) {
  if (!root || !message?.getFlag?.(MODULE_ID, "pendingEnact")) return;
  for (const btn of root.querySelectorAll("[data-bbttcc-enact]")) {
    if (btn.dataset.bbttccBound) continue;   // v13 fires BOTH render hooks — bind once
    btn.dataset.bbttccBound = "1";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      _handleApprovalClick(message, btn.dataset.bbttccEnact);
    });
  }
}

// v13+ fires renderChatMessageHTML (HTMLElement); older cores fire
// renderChatMessage (jQuery). Bind both defensively.
Hooks.on("renderChatMessageHTML", (message, html) => { try { _bindApprovalButtons(message, html); } catch (_e) {} });
Hooks.on("renderChatMessage",     (message, html) => { try { _bindApprovalButtons(message, html?.[0] ?? html); } catch (_e) {} });

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

  game.settings.register(MODULE_ID, "dialogueEnactMode", {
    name:    "Story moments from dialogue",
    hint:    "When an NPC conversation reaches an available beat choice: 'GM confirms' pauses for your approval (inline for GM conversations, an approval card for player ones); 'Automatic' enacts immediately.",
    scope:   "world",
    config:  true,
    type:    String,
    choices: { "gm-confirm": "GM confirms each moment (recommended)", "auto": "Automatic" },
    default: "gm-confirm"
  });

  game.settings.register(MODULE_ID, "npcCommonJournal", {
    name:    "NPC common-knowledge journal",
    hint:    "Name of a journal whose text pages are known to EVERY NPC — the gazetteer of what any local knows (places, people, who holds what). Write it once; all NPCs know it.",
    scope:   "world",
    config:  true,
    type:    String,
    default: "NPC Common Knowledge"
  });

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
      // Durable NPC story-event memory (also written by the campaign engine
      // per the dialogue-driven-beats spec).
      addMemory: async (actorOrId, text) => {
        const actor = (typeof actorOrId === "string") ? game.actors.get(actorOrId) : actorOrId;
        if (!actor || !text || !game.user.isGM) return false;
        const cur = (actor.getFlag(MODULE_ID, "memories") || []).slice(-(MEMORY_CAP - 1));
        cur.push({ ts: Date.now(), text: String(text) });
        await actor.setFlag(MODULE_ID, "memories", cur);
        return true;
      },
      // NPC speaks FIRST: opens (or focuses) the actor's dialogue window and
      // feeds it a bracketed scene note as the next turn — used by the
      // campaign's person-doors so a handed-off conversation continues
      // without the players having to speak. GM/programmatic use.
      nudge: async (actorOrId, context) => {
        const actor = (typeof actorOrId === "string") ? game.actors.get(actorOrId) : (actorOrId?.actor ?? actorOrId);
        if (!actor?.id || !String(context || "").trim()) return false;
        await talkTo(actor);
        const app = APPS.get(actor.id);
        if (!app) return false;
        // Let the fresh window finish its first render/lore sweep.
        await new Promise(r => setTimeout(r, 50));
        await app._send(`[Scene note — not spoken by anyone: ${String(context).trim()} You speak first; carry the scene forward in character.]`, "— scene —");
        return true;
      },
      // Stub choices for testing dialogue-driven beats before the campaign
      // API ships: setTestChoices("<actorId>", [{choiceKey, label, description}])
      setTestChoices: (actorId, choices) => {
        if (Array.isArray(choices) && choices.length) TEST_CHOICES.set(actorId, choices);
        else TEST_CHOICES.delete(actorId);
        return TEST_CHOICES.get(actorId) || null;
      },
      _apps: APPS,
      _buildPersonaPrompt,
      _gatherWorldLore,
      _gatherDossier
    });
    log("NPC dialogue installed (game.bbttcc.mal.npc.talkTo).");
  } catch (e) {
    warn("install failed:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
