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
 * Courtly bridge: the persona can carry EXTRACTABLE SECRETS (🧠 editor).
 * When a conversation truly meets a secret's unlock condition, the NPC
 * divulges it via the divulge_secret tool and the asking faction gains a
 * courtly Secret Item (bbttcc-raid's courtlySecrets API) — player
 * extractions pause on a GM approval card, GM extractions confirm inline.
 * Fail-soft: without the courtlySecrets API the feature stays dormant.
 *
 * Courtly on-ramp: a faction NPC's persona can carry a COURT DOOR (🧠
 * editor) — an unlock condition under which they usher Stewards INTO their
 * faction's court. The open_court_door tool stamps the entering faction
 * with flags["bbttcc-raid"].courtlyDoor (consumed by the courtly engine at
 * scenario creation: invited = +2 first exchange, conceded = +1 with
 * Suspicion starting at 1) and posts a table card that opens the Raid
 * Console. Same trust model as secrets: GM inline confirm, player approval
 * card. Fail-soft: without game.bbttcc.api.raid.courtly the door is dormant.
 *
 * Mid-raid: when a Courtly Intrigue scenario is ONGOING and the NPC is in
 * that room (tableau courtier or side faction), each send injects the live
 * board (standing/suspicion/scandal/favor lean) as an uncached section, and
 * the NPC holds the court_notices tool — blunt or indiscreet Steward lines
 * raise the suspicion track (murmur +1 / stir +2, GM-confirmed).
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
// EXTRACTABLE SECRETS — conversation as espionage (courtly bridge).
//
// The GM arms an NPC with extractable secrets in the 🧠 persona editor, one
// per line:  Label :: effectKey :: unlock condition :: the truth to reveal
// When a Steward genuinely meets a secret's condition in conversation, the
// model calls divulge_secret AS it speaks the truth; the mechanical payoff
// (a courtly Secret Item on the asking faction, playable in courtly raids)
// routes through a GM approval card for player conversations — the same
// trust model as story moments. A divulged secret is spent
// (persona.secretsUsed); re-arm by changing its label. Requires bbttcc-raid's
// courtlySecrets API; without it the whole feature stays dormant.
// ---------------------------------------------------------------------------

const SECRETS_PACK_ID = "bbttcc-master-content.courtly-secrets";

function _secretsApi() {
  const api = game.bbttcc?.api?.raid?.courtlySecrets;
  return api?.addSecret ? api : null;
}

function _secretSlug(label) {
  return String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// Parse the persona's authored secret lines. Bad lines are skipped with a
// console warning, never thrown.
function _parseSecretLines(raw) {
  const api = _secretsApi();
  const out = [];
  for (const line of String(raw || "").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split("::").map(s => s.trim());
    if (parts.length < 4) { warn(`secret line needs 4 '::' fields, skipped: "${t.slice(0, 60)}"`); continue; }
    const [label, , condition] = parts;
    let effectKey = parts[1];
    const truth = parts.slice(3).join(" :: ");
    // effectKey may be compound ("rollPlus2+coverTracks") — normalize via the
    // raid API when present; a line with NO valid key is skipped.
    if (api?.normEffectKeys) {
      const keys = api.normEffectKeys(effectKey);
      if (!keys.length) {
        warn(`secret "${label}" has unknown effectKey "${effectKey}", skipped (valid: ${(api.EFFECT_KEYS || []).join(", ")})`);
        continue;
      }
      effectKey = keys.join("+");
    }
    const key = _secretSlug(label);
    if (!key || !condition || !truth) continue;
    if (out.some(s => s.key === key)) continue;   // duplicate labels collapse
    out.push({ key, label, effectKey, condition, truth });
  }
  return out;
}

function _armedSecrets(actor) {
  if (!_secretsApi()) return [];   // no courtly bridge on this world — dormant
  const persona = actor.getFlag(MODULE_ID, "persona") || {};
  const used = persona.secretsUsed || {};
  return _parseSecretLines(persona.secretsRaw).filter(s => !used[s.key]);
}

// Faction resolution mirrors bbttcc-factions' internal helpers (it exposes no
// public API for these): isFaction flag or system.details.type.value, and a
// character belongs via flag factionId / system.faction.id / faction name.
function _isFactionActor(a) {
  try {
    if (a?.getFlag?.("bbttcc-factions", "isFaction")) return true;
    if (foundry.utils.getProperty(a, "system.details.type.value") === "faction") return true;
  } catch (_e) {}
  return false;
}
function _allFactions() { return (game.actors?.contents || []).filter(_isFactionActor); }
function _factionOfCharacter(char) {
  if (!char) return null;
  try {
    const byId = char.getFlag?.("bbttcc-factions", "factionId");
    if (byId && game.actors?.get(byId)) return game.actors.get(byId);
    const sys = char.system?.system ?? char.system ?? {};
    const sysFid = sys?.faction?.id;
    if (sysFid && game.actors?.get(String(sysFid))) return game.actors.get(String(sysFid));
    const byName = String(char.getFlag?.("bbttcc-factions", "factionName") || sys?.faction?.name || "").trim();
    if (byName) return _allFactions().find(f => String(f.name).trim() === byName) || null;
  } catch (_e) {}
  return null;
}
// The NPC's own faction — the court a door opens onto. Same lookup chain the
// persona prompt uses for the "Faction:" fact.
function _factionOfNpc(actor) {
  if (!actor) return null;
  try {
    const sys = actor.system?.system ?? actor.system ?? {};
    const fid = actor.flags?.["bbttcc-factions"]?.factionId || sys.faction?.id || sys.factionId || null;
    const f = fid ? game.actors?.get(String(fid)) : null;
    return (f && _isFactionActor(f)) ? f : null;
  } catch (_e) { return null; }
}

// Courtly on-ramp gate: the raid module's scenario engine must be loaded for
// a court door to exist at all (same fail-soft doctrine as courtlySecrets).
function _courtlyRaidApi() {
  const api = game.bbttcc?.api?.raid;
  return (typeof api?.courtly === "function") ? api : null;
}

// Grant the mechanical payoff: clone a template from the courtly-secrets pack
// (matching effectKey, any template as fallback — addSecret honors the flag
// we stamp on the clone), re-skin it as THIS secret, hand it to the faction,
// spend the persona entry, and write the NPC's memory of having talked.
// Always runs on a GM client (inline confirm or approval card).
async function _grantSecret({ npcActor, def, factionId, acquisition, speakerName }) {
  const api = _secretsApi();
  if (!api) return { ok: false, error: "courtly secrets API not available" };
  const faction = game.actors?.get(String(factionId || ""));
  if (!faction) return { ok: false, error: "no faction chosen" };
  const pack = game.packs?.get(SECRETS_PACK_ID);
  const docs = pack ? await pack.getDocuments() : [];
  // Compound-aware template match: exact effect set → same first effect → any
  // (the flags stamped on the clone below carry the real effect list anyway).
  const norm = (v) => api.normEffectKeys ? api.normEffectKeys(v) : [String(v || "")].filter(Boolean);
  const wantKeys = norm(def.effectKey);
  const docKeys = (d) => { const m = d.flags?.["bbttcc-raid"]?.secret; return norm(m?.effectKeys ?? m?.effectKey); };
  const template = docs.find(d => docKeys(d).join("+") === wantKeys.join("+"))
    || docs.find(d => docKeys(d)[0] === wantKeys[0])
    || docs[0] || null;
  if (!template) return { ok: false, error: `courtly-secrets compendium missing/empty (${SECRETS_PACK_ID})` };

  const source = template.clone({
    name: def.label,
    system: { description: { value:
      `<p><em>${_esc(def.truth)}</em></p><p style="opacity:.75;font-size:.9em;">Divulged in conversation by ${_esc(npcActor.name)} (${_esc(acquisition)}). ${_esc(api.describeEffect?.(def.effectKey) || def.effectKey)}.</p>` } },
    flags: { "bbttcc-raid": { secret: {
      effectKey: wantKeys.join("+"), effectKeys: wantKeys,
      // Provenance for the betrayal memory (backlog #5): addSecret's merge
      // preserves extra keys, so playSecret can find WHO divulged this and
      // write them a memory when their truth is carried into open court.
      source: { npcActorId: npcActor.id, npcName: npcActor.name, speakerName: String(speakerName || ""), acquisition, ts: Date.now() }
    } } }
  });
  const created = await api.addSecret(faction.id, source, { acquisition, effectKey: wantKeys.join("+") });
  if (!created) return { ok: false, error: "addSecret refused (see notifications)" };

  const persona = npcActor.getFlag(MODULE_ID, "persona") || {};
  const secretsUsed = { ...(persona.secretsUsed || {}) };
  secretsUsed[def.key] = { ts: Date.now(), by: String(speakerName || ""), acquisition, label: def.label };
  await npcActor.setFlag(MODULE_ID, "persona", { ...persona, secretsUsed });

  try {
    await game.bbttcc?.mal?.npc?.addMemory?.(npcActor,
      acquisition === "stolen"
        ? `${speakerName || "A Steward"} pried the truth about "${def.label}" out of me — I regret letting it slip.`
        : `I trusted ${speakerName || "a Steward"} with the truth about "${def.label}".`);
  } catch (_e) {}
  try {
    Hooks.callAll("bbttcc:dialogue:secretDivulged", {
      npcActorId: npcActor.id, factionId: faction.id, key: def.key, label: def.label,
      effectKey: def.effectKey, acquisition, itemId: created.id
    });
  } catch (_e) {}
  return { ok: true, created, faction };
}

// Grant the courtly on-ramp: stamp the entering faction with the door flag
// the courtly engine consumes at scenario creation, remember the moment on
// the NPC, and post the table card that opens the Raid Console. Always runs
// on a GM client (inline confirm or approval card).
async function _grantCourtDoor({ npcActor, defenderId, factionId, method, speakerName }) {
  if (!_courtlyRaidApi()) return { ok: false, error: "courtly raid API not available" };
  const attacker = game.actors?.get(String(factionId || ""));
  if (!attacker) return { ok: false, error: "no entering faction chosen" };
  const defender = game.actors?.get(String(defenderId || ""));
  if (!defender) return { ok: false, error: "the NPC's court (defender faction) no longer exists" };
  if (attacker.id === defender.id) return { ok: false, error: "a faction cannot enter its own court as an outsider" };

  const stamp = {
    npcActorId: npcActor.id, npcName: npcActor.name,
    defenderId: defender.id, defenderName: defender.name,
    method: method === "conceded" ? "conceded" : "invited",
    ts: Date.now()
  };
  await attacker.update({ "flags.bbttcc-raid.courtlyDoor": stamp });

  try {
    await game.bbttcc?.mal?.npc?.addMemory?.(npcActor,
      stamp.method === "conceded"
        ? `${speakerName || "A Steward"} pressured me into opening the court's door to ${attacker.name} — my name walks in with them, and I fear it.`
        : `I opened the court's door to ${attacker.name} myself, on ${speakerName || "a Steward"}'s word — my name walks in with them.`);
  } catch (_e) {}
  try {
    Hooks.callAll("bbttcc:dialogue:courtDoorOpened", {
      npcActorId: npcActor.id, attackerId: attacker.id, defenderId: defender.id, method: stamp.method
    });
  } catch (_e) {}

  // Table-visible signpost: one click opens the Raid Console on the entering
  // faction. The GM still targets one of the defender's holdings and picks
  // Courtly Intrigue — the stamped introduction is consumed at creation.
  try {
    await ChatMessage.create({
      content: `<div class="bbttcc-mal-voice" style="border-left:3px solid #4db87a;padding:.4em .6em;background:rgba(77,184,122,.08);">
        <b>🎭 The way into court stands open</b><br>
        <b>${_esc(npcActor.name)}</b> ushers <b>${_esc(attacker.name)}</b> toward <b>${_esc(defender.name)}</b>'s court <small style="opacity:.7;">(${stamp.method === "conceded" ? "grudgingly" : "a warm introduction"})</small>.<br>
        <span style="font-size:.8em;opacity:.7;">Open the Raid Console, target one of ${_esc(defender.name)}'s holdings, and choose Courtly Intrigue — the introduction is waiting at the threshold.</span><br>
        <button type="button" data-bbttcc-court-console="${_esc(attacker.id)}" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-chess-queen"></i> To the Court</button>
      </div>`,
      flags: { [MODULE_ID]: { courtDoorOpened: true } }
    });
  } catch (e) { warn("court door table card failed:", e?.message); }

  return { ok: true, attacker, defender };
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

    // ----- Extractable secrets (courtly bridge) -----
    async _availableSecrets() {
      try { return _armedSecrets(this.actor); }
      catch (e) { warn("secrets sweep failed:", e?.message); return []; }
    }

    _secretTool(secrets) {
      return {
        name: "divulge_secret",
        description: "Reveal one of the secrets you guard. Call this ONLY when this conversation has genuinely met that secret's unlock condition — never speculatively, never because you were merely asked. Call it AS you give the truth up, then speak it plainly in character.",
        input_schema: {
          type: "object",
          properties: {
            secretKey: { type: "string", enum: secrets.map(s => String(s.key)) },
            method: {
              type: "string", enum: ["earned", "stolen"],
              description: "earned = you share it willingly (trust, fair trade, true persuasion). stolen = it was pried out of you (deception, coercion, drink, a slip you already regret)."
            },
            rationale: { type: "string", description: "One short line: how the condition was met." }
          },
          required: ["secretKey", "method"]
        }
      };
    }

    _secretsSection(secrets) {
      return `## SECRETS YOU GUARD (via the divulge_secret tool)
These truths are yours and yours alone. Each has a price — the condition under which, and ONLY under which, you would let it go:

${secrets.map(s => `• [${s.key}] ${s.label}
  THE TRUTH: ${s.truth}
  YOU WILL ONLY TELL IF: ${s.condition}`).join("\n")}

How to guard them:
1. Deflect, deny, redirect — like a real person with something to lose. You may let a Steward FEEL there is more beneath ("that's co-op business", a look away, a too-quick answer), but never hint at the substance.
2. When the conversation GENUINELY meets a secret's condition — truly met, not merely gestured at — call divulge_secret AS you give it up, then speak the truth plainly in your own voice, the whole of it. Judge the method honestly: freely given is "earned"; tricked, coerced, or slipped is "stolen".
3. One secret per reply, and a told secret is TOLD — never tease it again as if still hidden.
4. Never mention the tool, conditions, keys, or anything mechanical. The Stewards only ever hear a person deciding to talk.`;
    }

    // Executes (or routes for approval) a divulge_secret tool call. The words
    // are spoken in the conversation either way — what the approval gates is
    // the MECHANICAL leverage (the courtly Secret Item).
    async _resolveDivulge(toolUse, secrets) {
      const key = String(toolUse?.input?.secretKey || "");
      const def = secrets.find(s => String(s.key) === key);
      if (!def) return "No such secret is yours to tell. Continue the conversation naturally.";
      const method = (toolUse?.input?.method === "stolen") ? "stolen" : "earned";
      const speakerName = game.user.character?.name || game.user.name;
      const faction = _factionOfCharacter(game.user.character);

      // GM at the keyboard: inline confirm, grant immediately.
      if (game.user.isGM) {
        const picked = await this._confirmDivulge(def, method, faction);
        if (!picked) return "You hold your tongue after all — the truth stays yours for now. Steer the conversation gently elsewhere.";
        const r = await _grantSecret({ npcActor: this.actor, def, factionId: picked.factionId, acquisition: picked.acquisition, speakerName });
        if (!r.ok) {
          warn(`secret grant failed: ${r.error}`);
          return `You have let the truth out — speak it plainly now, in your own voice. (Table note: the leverage could not be recorded — ${r.error}.)`;
        }
        return "You have let the truth out. Speak it plainly now, in your own voice — the whole of it.";
      }

      // Player at the keyboard: the mechanical grant is GM-client work, so it
      // always routes through the approval card (like player story moments).
      await this._postSecretCard(def, method, String(toolUse?.input?.rationale || ""), faction, speakerName);
      return "You have let the truth out. Speak it plainly now, in your own voice — the whole of it. Whether it becomes a weapon is not yours to know.";
    }

    async _confirmDivulge(def, method, faction) {
      const DialogV2 = foundry.applications?.api?.DialogV2;
      const factions = _allFactions();
      if (!factions.length) { ui.notifications?.warn?.("No faction actors exist to receive the secret."); return null; }
      const opts = factions.map(f => `<option value="${_esc(f.id)}"${faction?.id === f.id ? " selected" : ""}>${_esc(f.name)}</option>`).join("");
      const content = `
        <p><b>${_esc(this.actor.name)}</b> is ready to divulge <b>${_esc(def.label)}</b>.</p>
        <p style="font-size:.85em;opacity:.85;margin:.3em 0;"><em>${_esc(def.truth)}</em></p>
        <p style="font-size:.8em;opacity:.7;margin:.3em 0;">Condition: ${_esc(def.condition)} — model judged it met (${_esc(method)}).<br>Effect if granted: ${_esc(_secretsApi()?.describeEffect?.(def.effectKey) || def.effectKey)}</p>
        <div class="form-group"><label>Leverage goes to</label><select name="factionId" style="width:100%;">${opts}</select></div>`;
      const read = (button, acq) => ({ factionId: String(button.form?.elements?.factionId?.value || ""), acquisition: acq });
      try {
        if (DialogV2?.wait) {
          const r = await DialogV2.wait({
            window: { title: `Divulge secret — ${this.actor.name}` },
            position: { width: 440 },
            content,
            buttons: [
              { action: "earned", label: "Grant (earned)", icon: "fa-solid fa-handshake", default: method === "earned",
                callback: (_ev, button) => read(button, "earned") },
              { action: "stolen", label: "Grant (stolen)", icon: "fa-solid fa-user-secret", default: method === "stolen",
                callback: (_ev, button) => read(button, "stolen") },
              { action: "withhold", label: "Withhold", callback: () => null }
            ]
          }).catch(() => null);
          return (r && typeof r === "object" && r.factionId) ? r : null;
        }
      } catch (_e) {}
      return null;
    }

    async _postSecretCard(def, method, rationale, faction, speakerName) {
      try {
        const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
        const factions = _allFactions();
        const opts = factions.map(f => `<option value="${_esc(f.id)}"${faction?.id === f.id ? " selected" : ""}>${_esc(f.name)}</option>`).join("");
        await ChatMessage.create({
          whisper: gmIds,
          content: `<div class="bbttcc-mal-voice" style="border-left:3px solid #7a4db8;padding:.4em .6em;background:rgba(122,77,184,.08);">
            <b>Secret divulged — leverage awaiting approval</b><br>
            <b>${_esc(this.actor.name)}</b> gave up <i>${_esc(def.label)}</i> to ${_esc(speakerName)} <small style="opacity:.7;">(model judged: ${_esc(method)})</small><br>
            <span style="font-size:.85em;opacity:.85;"><em>${_esc(def.truth)}</em></span><br>
            <span style="font-size:.8em;opacity:.7;">Condition: ${_esc(def.condition)}${rationale ? ` — ${_esc(rationale)}` : ""}</span><br>
            <span style="font-size:.8em;opacity:.7;">Effect if granted: ${_esc(_secretsApi()?.describeEffect?.(def.effectKey) || def.effectKey)}. The NPC has already said the words — granting only attaches the leverage.</span><br>
            ${factions.length ? `<label style="font-size:.8em;">Leverage to <select name="bbttccSecretFaction" style="width:auto;max-width:60%;">${opts}</select></label><br>` : ""}
            <button type="button" data-bbttcc-secret="earned" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-handshake"></i> Grant (earned)</button>
            <button type="button" data-bbttcc-secret="stolen" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-user-secret"></i> Grant (stolen)</button>
            <button type="button" data-bbttcc-secret="decline" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-xmark"></i> Withhold</button>
          </div>`,
          flags: { [MODULE_ID]: { pendingSecret: {
            npcActorId: this.actor.id, key: def.key, label: def.label, effectKey: def.effectKey,
            truth: def.truth, condition: def.condition, method,
            factionId: faction?.id || null, speakerName, userId: game.user.id,
            transcript: this._history.slice(-6).map(m => m.content).join("\n")
          } } }
        });
      } catch (e) { warn("secret card failed:", e?.message); }
    }

    // ----- The court door (courtly on-ramp) -----
    // Backlog #2: talking your way INTO a courtly engagement. The persona
    // carries ONE door condition; when a conversation genuinely meets it,
    // the NPC ushers the Stewards toward their faction's court. The grant
    // stamps flags["bbttcc-raid"].courtlyDoor on the entering faction —
    // consumed by the courtly engine at scenario creation — and posts a
    // table card that opens the Raid Console. No courtly engine, no NPC
    // faction, or a Steward already inside this court → no door exists.
    _availableCourtDoor() {
      try {
        if (!_courtlyRaidApi()) return null;
        const condition = String(this.actor.getFlag(MODULE_ID, "persona")?.courtDoor || "").trim();
        if (!condition) return null;
        const defender = _factionOfNpc(this.actor);
        if (!defender) return null;
        const mine = _factionOfCharacter(game.user.character);
        if (mine && mine.id === defender.id) return null;   // your own court needs no door
        return { condition, defender };
      } catch (e) { warn("court door sweep failed:", e?.message); return null; }
    }

    _courtDoorTool() {
      return {
        name: "open_court_door",
        description: "Usher the Stewards into your faction's court — this begins a formal courtly engagement against it. Call this ONLY when this conversation has genuinely met your door's condition — never speculatively, never because you were merely asked. Call it AS you narrate granting them entry.",
        input_schema: {
          type: "object",
          properties: {
            approach: {
              type: "string", enum: ["invited", "conceded"],
              description: "invited = you willingly sponsor their entry (trust, alliance, a deal fairly struck). conceded = they argued, pressured, or maneuvered you into opening it."
            },
            rationale: { type: "string", description: "One short line: how the condition was met." }
          },
          required: ["approach"]
        }
      };
    }

    _courtDoorSection(door) {
      return `## THE COURT DOOR YOU HOLD (via the open_court_door tool)
You can bring outsiders before ${door.defender.name}'s court — introductions, access, standing. That is real power, and you spend it carefully.
YOU WILL ONLY OPEN THE DOOR IF: ${door.condition}

How to hold it:
1. You may let Stewards feel you have reach ("I could get you in front of them… for the right reasons"), but the door stays shut until the condition above is truly met — met in this conversation, not merely gestured at.
2. When it IS met, call open_court_door AS you narrate granting entry, then speak the ushering-in plainly in your own voice. Judge the approach honestly: freely sponsored is "invited"; argued or pressured out of you is "conceded".
3. Opening the door is a serious act — your name travels with them into that court. Let that weight show.
4. Never mention the tool, the condition, or anything mechanical. The Stewards only ever hear a person deciding to open a way.`;
    }

    // Executes (or routes for approval) an open_court_door tool call. The
    // ushering is spoken in the conversation either way — what the approval
    // gates is the MECHANICAL entry (the courtlyDoor stamp + table card).
    async _resolveCourtDoor(toolUse, door) {
      if (!door) return "No door is yours to open. Continue the conversation naturally.";
      const method = (toolUse?.input?.approach === "conceded") ? "conceded" : "invited";
      const speakerName = game.user.character?.name || game.user.name;
      const faction = _factionOfCharacter(game.user.character);

      // GM at the keyboard: inline confirm, stamp immediately.
      if (game.user.isGM) {
        const picked = await this._confirmCourtDoor(door, method, faction);
        if (!picked) return "You keep the door shut after all — the way stays yours. Steer the conversation gently elsewhere.";
        const r = await _grantCourtDoor({ npcActor: this.actor, defenderId: door.defender.id, factionId: picked.factionId, method: picked.method, speakerName });
        if (!r.ok) {
          warn(`court door grant failed: ${r.error}`);
          return `You have spoken the way open — narrate ushering them in. (Table note: the entry could not be recorded — ${r.error}.)`;
        }
        return "The door stands open. Narrate ushering them in — the introduction, the way through, what you expect of them in there.";
      }

      // Player at the keyboard: the stamp is GM-client work, so it always
      // routes through the approval card (like secrets and story moments).
      await this._postCourtDoorCard(door, method, String(toolUse?.input?.rationale || ""), faction, speakerName);
      return "You have spoken the way open and the Gamemaster has been told. Narrate ushering them in — but the court itself has not yet received them.";
    }

    async _confirmCourtDoor(door, method, faction) {
      const DialogV2 = foundry.applications?.api?.DialogV2;
      const factions = _allFactions().filter(f => f.id !== door.defender.id);
      if (!factions.length) { ui.notifications?.warn?.("No faction actors exist to walk through the door."); return null; }
      const opts = factions.map(f => `<option value="${_esc(f.id)}"${faction?.id === f.id ? " selected" : ""}>${_esc(f.name)}</option>`).join("");
      const content = `
        <p><b>${_esc(this.actor.name)}</b> is ready to open the court door into <b>${_esc(door.defender.name)}</b>.</p>
        <p style="font-size:.8em;opacity:.7;margin:.3em 0;">Condition: ${_esc(door.condition)} — model judged it met (${_esc(method)}).<br>Invited = +2 on the first exchange. Conceded = +1, and Suspicion starts at 1.</p>
        <div class="form-group"><label>Entering faction (attacker)</label><select name="factionId" style="width:100%;">${opts}</select></div>`;
      const read = (button, m) => ({ factionId: String(button.form?.elements?.factionId?.value || ""), method: m });
      try {
        if (DialogV2?.wait) {
          const r = await DialogV2.wait({
            window: { title: `Court door — ${this.actor.name}` },
            position: { width: 440 },
            content,
            buttons: [
              { action: "invited", label: "Open (invited)", icon: "fa-solid fa-door-open", default: method === "invited",
                callback: (_ev, button) => read(button, "invited") },
              { action: "conceded", label: "Open (conceded)", icon: "fa-solid fa-door-closed", default: method === "conceded",
                callback: (_ev, button) => read(button, "conceded") },
              { action: "withhold", label: "Keep it shut", callback: () => null }
            ]
          }).catch(() => null);
          return (r && typeof r === "object" && r.factionId) ? r : null;
        }
      } catch (_e) {}
      return null;
    }

    async _postCourtDoorCard(door, method, rationale, faction, speakerName) {
      try {
        const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
        const factions = _allFactions().filter(f => f.id !== door.defender.id);
        const opts = factions.map(f => `<option value="${_esc(f.id)}"${faction?.id === f.id ? " selected" : ""}>${_esc(f.name)}</option>`).join("");
        await ChatMessage.create({
          whisper: gmIds,
          content: `<div class="bbttcc-mal-voice" style="border-left:3px solid #4db87a;padding:.4em .6em;background:rgba(77,184,122,.08);">
            <b>Court door — entry awaiting approval</b><br>
            <b>${_esc(this.actor.name)}</b> would usher ${_esc(speakerName)} into <b>${_esc(door.defender.name)}</b>'s court <small style="opacity:.7;">(model judged: ${_esc(method)})</small><br>
            <span style="font-size:.8em;opacity:.7;">Condition: ${_esc(door.condition)}${rationale ? ` — ${_esc(rationale)}` : ""}</span><br>
            <span style="font-size:.8em;opacity:.7;">Invited = +2 on the first exchange. Conceded = +1, and Suspicion starts at 1. The NPC has already spoken the way open — granting stamps the entry; the raid itself still begins from the Raid Console.</span><br>
            ${factions.length ? `<label style="font-size:.8em;">Entering faction <select name="bbttccCourtDoorFaction" style="width:auto;max-width:60%;">${opts}</select></label><br>` : ""}
            <button type="button" data-bbttcc-court-door="invited" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-door-open"></i> Open (invited)</button>
            <button type="button" data-bbttcc-court-door="conceded" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-door-closed"></i> Open (conceded)</button>
            <button type="button" data-bbttcc-court-door="decline" style="width:auto;padding:.2em .6em;margin-top:.3em;"><i class="fa-solid fa-xmark"></i> Keep it shut</button>
          </div>`,
          flags: { [MODULE_ID]: { pendingCourtDoor: {
            npcActorId: this.actor.id, condition: door.condition,
            defenderId: door.defender.id, defenderName: door.defender.name, method,
            factionId: faction?.id || null, speakerName, userId: game.user.id,
            transcript: this._history.slice(-6).map(m => m.content).join("\n")
          } } }
        });
      } catch (e) { warn("court door card failed:", e?.message); }
    }

    // ----- The live court board (courtly mid-raid context) -----
    // Backlog #3: when a Courtly Intrigue scenario is ONGOING and this NPC
    // is part of that world (a flagged tableau courtier on the scene, or
    // their faction is a side), every send injects the live board —
    // standing, suspicion, scandal, their own favor lean — as an UNCACHED
    // system section, so the NPC speaks to the actual state of the room.
    // The scenario object lives on the client that created it (the console
    // runner's, normally the GM's — the same seat that runs NPC talk); on
    // other clients this section simply never appears. Fail-soft throughout.
    // The live-court gate, shared by the board section (#3) and the
    // court_notices suspicion tool (#4): returns { sc, st, A, D, mySide }
    // when a scenario is ongoing AND this NPC is in that room, else null.
    _courtlyLive() {
      try {
        const sc = game.bbttcc?.api?.raid?._lastCourtly;
        const st = sc?.getState?.();
        if (!st || st.outcome !== "ongoing") return null;
        const A = game.actors?.get(st.attackerId);
        const D = game.actors?.get(st.defenderId);
        if (!A || !D) return null;
        const myFaction = _factionOfNpc(this.actor);
        const isCourtier = (canvas?.tokens?.placeables || []).some(t =>
          t.document?.flags?.["bbttcc-raid"]?.tableauActor === true && t.actor?.id === this.actor.id);
        const mySide = myFaction?.id === A.id ? "A" : myFaction?.id === D.id ? "D" : null;
        if (!isCourtier && !mySide) {
          // Validation eyes: distinguish "not fired" from "fired but subtle".
          log(`courtly scenario ongoing, but '${this.actor.name}' is NOT in that room (token not tableau-flagged; faction ${myFaction ? `'${myFaction.name}'` : "none"} is not a side) — no board section`);
          return null;
        }
        return { sc, st, A, D, mySide };
      } catch (e) { warn("courtly live sweep failed:", e?.message); return null; }
    }

    _courtlyBoardSection(live) {
      try {
        const { st, A, D, mySide } = live;

        const standing = (inf, max) => {
          const pct = max > 0 ? inf / max : 0;
          if (inf <= 0) return "broken — their voice is spent";
          if (pct >= 0.75) return "standing firm";
          if (pct >= 0.4) return "pressed, but holding";
          return "tottering — one hard blow from ruin";
        };
        const s = Number(st.suspicion || 0);
        const room =
          s >= 10 ? "the court has collapsed into open scandal" :
          s >= 7 ? "one wrong word from open scandal — fans hide mouths, servants linger at doors" :
          s >= 4 ? "wary — the games being played are being noticed" :
          s >= 2 ? "murmuring — eyes flick to doorways a beat too often" :
          "at ease, for now";
        const scandals = [st.scandalOnA ? A.name : null, st.scandalOnD ? D.name : null].filter(Boolean);

        const favA = Number(this.actor.flags?.["bbttcc-raid"]?.courtFavor?.[A.id] ?? 0);
        const favD = Number(this.actor.flags?.["bbttcc-raid"]?.courtFavor?.[D.id] ?? 0);
        const lean = (n, f) =>
          n >= 2 ? `you are openly ${f.name}'s creature — a patron's warmth` :
          n === 1 ? `you incline toward ${f.name}` :
          n === -1 ? `${f.name} has cost you something — you remember` :
          n <= -2 ? `you bear ${f.name} a cold grudge` : null;
        const leans = [lean(favA, A), lean(favD, D)].filter(Boolean);

        return `## THE COURT TONIGHT (a courtly engagement is underway around this very conversation)
"${st.label}" — round ${st.round}. ${A.name} presses their suit against ${D.name}'s court, and you are in that room.
• ${A.name}: ${standing(st.influenceA, st.maxA)} (influence ${st.influenceA}/${st.maxA}).
• ${D.name}: ${standing(st.influenceD, st.maxD)} (influence ${st.influenceD}/${st.maxD}).
• The room is ${room} (suspicion ${s}/10).
• ${scandals.length ? `Scandal clings to ${scandals.join(" and ")}.` : "No open scandal — yet."}
• Your lean: ${leans.length ? leans.join("; ") + "." : "you owe neither side anything, and both know it."}
${mySide ? `• This is YOUR faction's fight — you stand with ${mySide === "A" ? A.name : D.name}, and their fortunes tonight are yours.` : ""}

How to speak to it:
1. This contest is the living backdrop of everything you say — let it color your mood, caution, and appetite for risk. When the room is wary, you speak lower; when your side falters, it shows.
2. The numbers above are for YOUR calibration only. NEVER speak numbers, "influence", "suspicion", "rounds", or any game construct — translate them into a person's read of a room ("half the court watched that exchange", "she's lost the ear of the chamber", "careful — tonight everyone is listening").
3. Your lean shows in tone, not declarations — warmth, coldness, what you choose to notice, whom you defend unasked.`;
      } catch (e) { warn("courtly board section failed:", e?.message); return ""; }
    }

    // ----- Bluntness → Suspicion (courtly social cost) -----
    // Backlog #4: clumsy or aggressive lines spoken INSIDE a live courtly
    // engagement raise the suspicion track. The NPC judges the room's
    // reaction via the court_notices tool (murmur +1 / stir +2); a GM
    // confirm gates it — the model is policing players here, so a human
    // stays in the loop. raiseSuspicion() itself posts the public suspicion
    // card and refreshes the HUD, so the table always sees the receipt.
    _suspicionTool() {
      return {
        name: "court_notices",
        description: "The room notices a Steward's misstep. Call this ONLY when a Steward's LATEST line, spoken amid the courtly engagement, is genuinely blunt, aggressive, or indiscreet in a way this court would notice — a threat, a delicate thing named outright, a crass open bribe, pressing on after your clear warning. Never for mere directness or hard bargaining. Call it AS you react, then answer as someone who knows the room just shifted.",
        input_schema: {
          type: "object",
          properties: {
            severity: {
              type: "string", enum: ["murmur", "stir"],
              description: "murmur = eyes flick, fans pause (a small lapse, Suspicion +1). stir = an audible ripple, servants sent from the room (an open blunder, Suspicion +2)."
            },
            line: { type: "string", description: "One short line: what was said or done that the room caught." }
          },
          required: ["severity"]
        }
      };
    }

    _suspicionSection() {
      return `## THE ROOM IS LISTENING (via the court_notices tool)
Every word of this conversation lands inside the engagement above — and courts punish clumsiness.
1. When a Steward's LATEST line is genuinely blunt, aggressive, or indiscreet — a threat, a delicate thing named outright, a crass open bribe, pressing on after your clear warning — call court_notices AS you react: "murmur" for a small lapse, "stir" for an open blunder.
2. Hard bargaining, directness, or uncomfortable questions asked with grace are NOT missteps. Judge as this court would, not as a scold — most lines should pass without notice.
3. At most one notice per Steward line, and only ever for the latest line — never re-litigate older ones.
4. After the tool returns, answer in character as someone who felt the room shift — cooler, more guarded, aware of the watchers. Never mention the tool or anything mechanical.`;
    }

    async _resolveCourtNotice(toolUse, live) {
      if (!live?.sc || typeof live.sc.raiseSuspicion !== "function")
        return "The room lets it pass. Continue the conversation naturally.";
      const severity = (toolUse?.input?.severity === "stir") ? "stir" : "murmur";
      const amount = severity === "stir" ? 2 : 1;
      const line = String(toolUse?.input?.line || "").slice(0, 140);

      // GM sanity gate. (A non-GM only ever reaches here when the scenario
      // object lives on THEIR client — i.e. they're already driving the
      // whole courtly engine locally — so no extra approval hop is added.)
      if (game.user.isGM) {
        const ok = await this._confirmCourtNotice(severity, amount, line);
        if (!ok) return "On second look, no one of consequence caught it — the room lets it pass. Continue naturally, though YOU noticed.";
      }

      try {
        const after = await live.sc.raiseSuspicion(amount, line ? `overheard in conversation: ${line}` : "a misstep in conversation");
        return `The room noticed — suspicion now stands at ${after}/10 (for your calibration only; never speak numbers). React in character: cooler, more guarded, aware of the watchers.`;
      } catch (e) {
        warn("court notice failed:", e?.message);
        return "The moment passes without consequence. Continue naturally.";
      }
    }

    async _confirmCourtNotice(severity, amount, line) {
      const DialogV2 = foundry.applications?.api?.DialogV2;
      const content = `<p><b>${_esc(this.actor.name)}</b> judges the room caught a misstep${line ? `:<br><em style="font-size:.85em;">"${_esc(line)}"</em>` : "."}</p>
        <p style="font-size:.8em;opacity:.7;margin:.3em 0;">${severity === "stir" ? "An open blunder" : "A small lapse"} — Suspicion +${amount}.</p>`;
      try {
        if (DialogV2?.confirm) return !!(await DialogV2.confirm({ window: { title: "The court notices?" }, content }));
        return !!(await Dialog.confirm({ title: "The court notices?", content }));
      } catch (_e) { return false; }
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
        const secrets = await this._availableSecrets();
        const courtDoor = this._availableCourtDoor();
        const toolList = [];
        if (choices.length) { toolList.push(this._choiceTool(choices)); system.push({ text: this._momentsSection(choices) }); }
        if (doors.length)   { toolList.push(this._doorTool(doors));     system.push({ text: this._doorsSection(doors) }); }
        if (secrets.length) { toolList.push(this._secretTool(secrets)); system.push({ text: this._secretsSection(secrets) }); }
        if (courtDoor)      { toolList.push(this._courtDoorTool());     system.push({ text: this._courtDoorSection(courtDoor) }); }
        const live = this._courtlyLive();
        if (live) {
          const favA = Number(this.actor.flags?.["bbttcc-raid"]?.courtFavor?.[live.A.id] ?? 0);
          const favD = Number(this.actor.flags?.["bbttcc-raid"]?.courtFavor?.[live.D.id] ?? 0);
          log(`courtly board INJECTED for '${this.actor.name}' — round ${live.st.round}, influence ${live.st.influenceA}/${live.st.influenceD}, suspicion ${live.st.suspicion}, favor A:${favA} D:${favD}, court_notices armed`);
          const board = this._courtlyBoardSection(live);
          if (board) system.push({ text: board });
          toolList.push(this._suspicionTool());
          system.push({ text: this._suspicionSection() });
        }
        const tools = toolList.length ? toolList : undefined;

        const baseMessages = this._history.map(m => ({ role: m.role, content: m.content }));
        // An intro-on-open opening line makes the transcript assistant-first;
        // the Messages API requires user-first, so seat a neutral scene note
        // ahead of it.
        if (baseMessages[0]?.role === "assistant") {
          baseMessages.unshift({ role: "user", content: "[Scene note — not spoken by anyone: the scene opens. You have already delivered your opening line; continue from it.]" });
        }
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
              : (tu.name === "divulge_secret")
              ? await this._resolveDivulge(tu, secrets)
              : (tu.name === "open_court_door")
              ? await this._resolveCourtDoor(tu, courtDoor)
              : (tu.name === "court_notices")
              ? await this._resolveCourtNotice(tu, live)
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

// Intro-on-open (owner-locked audio doctrine, 2026-07-04): when a conversation
// window OPENS for an NPC who is hosting a live story moment with recorded
// audio, that recording plays — it IS the NPC's opening line; the live AI
// dialogue continues from it. Fires only on a fresh window (focusing an open
// one replays nothing), GM-side only (the BeatAudioManager broadcasts to
// players itself when the beat says so). The first offerable moment with
// audio wins; outcome stingers play separately at enact (curtain call).
async function _playIntroAudio(actor) {
  try {
    if (!game.user?.isGM) return;
    let on = true;
    try { on = !!game.settings.get(MODULE_ID, "dialogueIntroAudio"); } catch (_e) {}
    if (!on) return;
    const api = game.bbttcc?.api?.campaign;
    const rows = (await api?.dialogue?.choicesFor?.(actor.id, {})) || [];
    if (!rows.length) return;
    let beats = null;
    try {
      const campId = api?.getActiveCampaignId?.();
      const camp = api?.getCampaign?.(campId);
      beats = Array.isArray(camp?.beats) ? camp.beats : null;
      if (!beats) {
        const raw = game.settings.get("bbttcc-campaign", "campaigns");
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        beats = data?.[campId]?.beats || [];
      }
    } catch (_e) { return; }
    for (const r of rows) {
      const b = beats.find(x => x?.id === r.beatId);
      if (!b?.audio?.enabled) continue;
      if (!String(b.audio.src || b.audio.playlistSoundUuid || "").trim()) continue;
      log(`intro-on-open: playing '${b.id}' audio for ${actor.name}`);
      await api?.audio?.play?.(b, { trigger: "dialogue-intro" });
      await _postIntroText(actor, b);
      return;
    }
  } catch (e) {
    warn("intro-on-open audio failed:", e?.message || e);
  }
}

// The recording IS the NPC's opening line — and the beat's DESCRIPTION is its
// written version. Deliver it alongside the audio: once per beat it lands in
// the dialogue window as the NPC's first bubble AND in the persisted history,
// so the transcript shows what was spoken and the live AI continues from a
// line it has already delivered instead of a cold start. Re-opening the
// window replays the recording (doctrine) but never re-posts the text — the
// stored transcript already holds it and replays with the history.
async function _postIntroText(actor, beat) {
  try {
    const plain = String(beat?.description || "")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) return;
    const app = APPS.get(actor.id);
    if (!app) return;
    if ((app._history || []).some(m => m?.introBeatId === beat.id)) return;
    // Wait out the fresh window's first render (async lore/story-state sweep)
    // so the bubble list exists.
    for (let i = 0; i < 60 && !app._els?.list; i++) await new Promise(r => setTimeout(r, 50));
    if (!app._els?.list) return;
    app._bubble("assistant", plain);
    app._history.push({ role: "assistant", content: plain, speaker: actor.name, ts: Date.now(), introBeatId: beat.id });
    await _saveHistory(actor, app._history);
    log(`intro-on-open: posted '${beat.id}' written opening for ${actor.name}`);
  } catch (e) {
    warn("intro-on-open written version failed:", e?.message || e);
  }
}

async function talkTo(actorOrToken) {
  const actor = actorOrToken?.actor ?? actorOrToken;
  if (!actor?.id) return ui.notifications?.warn("No actor to talk to.");
  const App = _defineAppClass();
  if (!App) return ui.notifications?.error("ApplicationV2 not available in this Foundry version.");

  let app = APPS.get(actor.id);
  if (app) return app.render({ force: true });
  app = new App(actor);
  APPS.set(actor.id, app);
  const rendered = app.render({ force: true });
  _playIntroAudio(actor).catch(() => {});   // fresh window only — never on re-focus
  return rendered;
}

// ---------------------------------------------------------------------------
// Persona editor (ApplicationV2) — topics, private truth, and the extractable
// SECRETS BUILDER: one card per secret with an effect-key dropdown instead of
// hand-typed `::` lines, plus Re-arm buttons for spent secrets. Storage stays
// the persona.secretsRaw line format so the runtime parser, spent-tracking,
// and anything already authored are unchanged — the builder is purely an
// authoring surface. The old raw-text dialog remains as the fallback for
// pre-ApplicationV2 cores.
// ---------------------------------------------------------------------------

const PERSONA_APPS = new Map();   // actorId -> editor instance

// Lenient split for the builder: never drops a malformed line — whatever the
// GM typed shows up in the fields for repair. (Strict validation stays in
// _parseSecretLines at runtime.)
function _parseSecretLinesLenient(raw) {
  const out = [];
  for (const line of String(raw || "").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split("::").map(s => s.trim());
    out.push({ label: parts[0] || "", effectKey: parts[1] || "", condition: parts[2] || "", truth: parts.slice(3).join(" :: ") });
  }
  return out;
}

// Shared post-save: any open dialogue window re-sweeps so changes take
// effect immediately.
async function _afterPersonaSave(actor) {
  const app = APPS.get(actor.id);
  if (app) {
    app._storyState = await _storyState(actor);
    app._lore = _gatherWorldLore(actor, { state: app._storyState });
    app._dossier = _gatherDossier(actor, { state: app._storyState });
    log(`persona saved; lore re-swept for '${actor.name}' (${app._lore.length} chars, dossier ${app._dossier.length})`);
  }
}

let PersonaEditorApp = null;

function _definePersonaEditor() {
  if (PersonaEditorApp) return PersonaEditorApp;
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base) return null;

  PersonaEditorApp = class extends Base {
    static DEFAULT_OPTIONS = {
      classes: ["bbttcc-npc-persona-editor"],
      window: { icon: "fa-solid fa-brain", resizable: true },
      position: { width: 560, height: 660 }
    };

    constructor(actor, options = {}) {
      super({ ...options, id: `bbttcc-npc-persona-${actor.id}` });
      this.actor = actor;
      this._cur = actor.getFlag(MODULE_ID, "persona") || {};
      this._used = { ...(this._cur.secretsUsed || {}) };
      this._els = {};
    }

    get title() { return `Persona — ${this.actor?.name ?? "NPC"}`; }

    _hint(html) {
      const p = document.createElement("p");
      p.style.cssText = "font-size:.8em;opacity:.75;margin:0;";
      p.innerHTML = html;
      return p;
    }

    async _renderHTML(_context, _options) {
      const cur = this._cur;
      const api = _secretsApi();
      const root = document.createElement("div");
      root.style.cssText = "display:flex;flex-direction:column;gap:.5em;height:100%;padding:.5em;";

      // Whole window is a drop target for existing courtly secrets.
      const unmark = () => { if (this._els.rows) { this._els.rows.style.outline = ""; this._els.rows.style.outlineOffset = ""; } };
      root.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        if (this._els.rows) { this._els.rows.style.outline = "2px dashed #a78bfa"; this._els.rows.style.outlineOffset = "3px"; }
      });
      root.addEventListener("dragleave", unmark);
      root.addEventListener("drop", (ev) => { unmark(); this._onDropSecret(ev); });

      const scroll = document.createElement("div");
      scroll.style.cssText = "flex:1 1 auto;overflow-y:auto;display:flex;flex-direction:column;gap:.45em;padding-right:.3em;";
      root.appendChild(scroll);

      scroll.appendChild(this._hint(`<b>Knowledge topics</b> — comma-separated names/places/subjects <b>${_esc(this.actor.name)}</b> knows about. The journal/beat sweep pulls every paragraph mentioning these, so "Dougan Marsh, The Gullywasher" makes those stories part of what they know. (For curated whole-page facts, prefer a World Dossier journal page tagged <code>@knownBy: ${_esc(this.actor.name)}</code> — it's injected verbatim, no keyword luck.)`));
      const topics = document.createElement("input");
      topics.type = "text";
      topics.placeholder = "Dougan Marsh, The Gullywasher, Port Kudzu…";
      topics.value = String(cur.topics || "");
      scroll.appendChild(topics);
      this._els.topics = topics;

      scroll.appendChild(this._hint(`<b>Private GM truth</b> — knowledge, secrets, agenda, speech quirks. Shapes every reply; never quoted to players.`));
      const notes = document.createElement("textarea");
      notes.rows = 8;
      notes.style.cssText = "width:100%;resize:vertical;";
      notes.value = String(cur.notes || "");
      scroll.appendChild(notes);
      this._els.notes = notes;

      scroll.appendChild(this._hint(`<b>Extractable secrets</b> — when a conversation genuinely meets a secret's unlock condition, ${_esc(this.actor.name)} divulges it and the asking Steward's faction gains it as courtly leverage (player extractions pause on a GM approval card; yours confirm inline). A divulged secret is spent until you re-arm it below. <b>Drag any courtly secret</b> (compendium row or faction-held item) onto this window to arm it here — you only write the unlock condition.${api ? "" : " <b>⚠ Courtly secrets API not detected (bbttcc-raid) — secrets stay dormant.</b>"}`));

      const rows = document.createElement("div");
      rows.style.cssText = "display:flex;flex-direction:column;";
      scroll.appendChild(rows);
      this._els.rows = rows;
      for (const s of _parseSecretLinesLenient(cur.secretsRaw)) this._addSecretRow(s);

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.style.cssText = "width:auto;align-self:flex-start;padding:.25em .7em;";
      addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add secret`;
      if (!api) { addBtn.disabled = true; addBtn.title = "bbttcc-raid courtly secrets API not detected"; }
      addBtn.addEventListener("click", () => this._addSecretRow({}));
      scroll.appendChild(addBtn);

      const npcFaction = _factionOfNpc(this.actor);
      scroll.appendChild(this._hint(`<b>Court door</b> — leave blank for none. The condition under which ${_esc(this.actor.name)} would usher Stewards INTO ${npcFaction ? `<b>${_esc(npcFaction.name)}</b>'s` : "their faction's"} court — talking their way into a Courtly Intrigue engagement against it (invited = +2 on the first exchange; talked into it = +1 with Suspicion starting at 1). The door is standing — it can open again another day.${_courtlyRaidApi() ? "" : " <b>⚠ Courtly raid API not detected (bbttcc-raid) — the door stays dormant.</b>"}${npcFaction ? "" : " <b>⚠ This NPC belongs to no faction — the door stays dormant until they do.</b>"}`));
      const courtDoor = document.createElement("input");
      courtDoor.type = "text";
      courtDoor.placeholder = "e.g. they bring proof the tithe is being skimmed, and swear to raise it before the court themselves";
      courtDoor.value = String(cur.courtDoor || "");
      scroll.appendChild(courtDoor);
      this._els.courtDoor = courtDoor;

      this._els.usedWrap = document.createElement("div");
      scroll.appendChild(this._els.usedWrap);
      this._renderUsed();

      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:.4em;flex:0 0 auto;justify-content:flex-end;";
      const save = document.createElement("button");
      save.type = "button";
      save.style.cssText = "width:auto;padding:.3em 1em;";
      save.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save`;
      save.addEventListener("click", () => this._save());
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.style.cssText = "width:auto;padding:.3em 1em;";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => this.close());
      footer.append(save, cancel);
      root.appendChild(footer);

      return root;
    }

    _replaceHTML(result, content, _options) {
      content.replaceChildren(result);
      content.style.display = "flex";
      content.style.flexDirection = "column";
    }

    _addSecretRow(data = {}) {
      const api = _secretsApi();
      const row = document.createElement("fieldset");
      row.style.cssText = "border:1px solid rgba(120,120,120,.4);border-radius:4px;padding:.45em .55em;margin:0 0 .5em;display:flex;flex-direction:column;gap:.35em;";
      row.dataset.secretRow = "1";

      const top = document.createElement("div");
      top.style.cssText = "display:flex;gap:.4em;align-items:center;";
      const label = document.createElement("input");
      label.type = "text";
      label.placeholder = "Label — the secret's name (e.g. The second ledger)";
      label.style.cssText = "flex:1;min-width:0;";
      label.value = String(data.label || "");
      label.dataset.f = "label";
      const del = document.createElement("button");
      del.type = "button";
      del.title = "Remove this secret";
      del.style.cssText = "flex:0 0 auto;width:auto;padding:.2em .5em;line-height:1;";
      del.innerHTML = `<i class="fa-solid fa-trash"></i>`;
      del.addEventListener("click", () => row.remove());
      top.append(label, del);
      row.appendChild(top);

      // Effects: 1..n stacked selects — a compound secret fires them all in
      // order on a single play (serialized "a+b" in the line format).
      const effectsWrap = document.createElement("div");
      effectsWrap.style.cssText = "display:flex;flex-direction:column;gap:.25em;";
      row.appendChild(effectsWrap);
      const initKeys = String(data.effectKey || "").split(/[+,]/).map(s => s.trim()).filter(Boolean);
      if (!initKeys.length) initKeys.push("");
      for (const k of initKeys) this._addEffectSelect(effectsWrap, k);
      const addFx = document.createElement("a");
      addFx.style.cssText = "font-size:.75em;opacity:.7;cursor:pointer;align-self:flex-start;";
      addFx.innerHTML = `<i class="fa-solid fa-plus"></i> add another effect`;
      addFx.addEventListener("click", () => this._addEffectSelect(effectsWrap, ""));
      row.appendChild(addFx);

      const cond = document.createElement("input");
      cond.type = "text";
      cond.placeholder = "Unlock condition — what a Steward must do or prove in conversation";
      cond.value = String(data.condition || "");
      cond.dataset.f = "condition";
      row.appendChild(cond);

      const truth = document.createElement("textarea");
      truth.rows = 2;
      truth.placeholder = "The truth — what the NPC actually reveals when it's given up";
      truth.style.cssText = "width:100%;resize:vertical;";
      truth.value = String(data.truth || "");
      truth.dataset.f = "truth";
      row.appendChild(truth);

      this._els.rows.appendChild(row);
      if (!data.label) label.focus();
      return row;
    }

    _addEffectSelect(effectsWrap, key = "") {
      const api = _secretsApi();
      const line = document.createElement("div");
      line.style.cssText = "display:flex;gap:.3em;align-items:center;";
      const effect = document.createElement("select");
      effect.dataset.f = "effectKey";
      effect.style.cssText = "flex:1;min-width:0;";
      const keys = api?.EFFECT_KEYS || [];
      if (key && !keys.includes(key)) {
        // Legacy/typo key: keep it visible and selected rather than silently
        // rewriting the secret — runtime will warn until the GM repicks.
        const o = document.createElement("option");
        o.value = key;
        o.textContent = `${key} — ⚠ unknown effect key`;
        o.selected = true;
        effect.appendChild(o);
      }
      for (const k of keys) {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = `${k} — ${api?.EFFECT_INFO?.[k] || k}`;
        if (k === key) o.selected = true;
        effect.appendChild(o);
      }
      const rm = document.createElement("button");
      rm.type = "button";
      rm.title = "Remove this effect";
      rm.style.cssText = "flex:0 0 auto;width:auto;padding:.15em .45em;line-height:1;";
      rm.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
      rm.addEventListener("click", () => {
        if (effectsWrap.querySelectorAll('select[data-f="effectKey"]').length <= 1)
          return ui.notifications?.warn?.("A secret needs at least one effect.");
        line.remove();
      });
      line.append(effect, rm);
      effectsWrap.appendChild(line);
      return line;
    }

    // Drag-and-drop: an existing courtly secret (compendium row, faction-held
    // item, or a Secrets & Leverage HUD row) dropped anywhere on this window
    // becomes a prefilled card — the GM only writes the unlock condition.
    async _onDropSecret(ev) {
      ev.preventDefault();
      let data = null;
      try {
        const raw = ev.dataTransfer.getData("application/bbttcc-courtly-secret")
                 || ev.dataTransfer.getData("text/plain");
        data = JSON.parse(raw || "{}");
      } catch (_e) { return; }
      let item = null;
      try {
        if (data?.kind === "courtly-secret" && data.actorId && data.itemId) {
          item = game.actors?.get(data.actorId)?.items?.get(data.itemId) || null;
        } else if (data?.type === "Item" && data.uuid) {
          item = await foundry.utils.fromUuid(data.uuid);
        }
      } catch (_e) {}
      if (!item) return;
      const meta = item.flags?.["bbttcc-raid"]?.secret;
      if (!meta) return ui.notifications?.warn?.(`"${item.name}" is not a courtly secret.`);
      const api = _secretsApi();
      const keys = api?.normEffectKeys
        ? api.normEffectKeys(meta.effectKeys ?? meta.effectKey)
        : [String(meta.effectKey || "")].filter(Boolean);
      this._addSecretRow({
        label: item.name,
        effectKey: keys.join("+"),
        condition: "",
        truth: _stripHtml(item.system?.description?.value || "")
      });
      ui.notifications?.info?.(`"${item.name}" armed — write its unlock condition, then Save.`);
    }

    _renderUsed() {
      const wrap = this._els.usedWrap;
      if (!wrap) return;
      wrap.replaceChildren();
      const entries = Object.entries(this._used);
      if (!entries.length) return;
      wrap.appendChild(this._hint(`<b>Divulged</b> — spent secrets stay spent until re-armed:`));
      for (const [key, u] of entries) {
        const line = document.createElement("div");
        line.style.cssText = "display:flex;align-items:center;gap:.5em;font-size:.8em;opacity:.85;margin:.15em 0;";
        const txt = document.createElement("span");
        txt.style.cssText = "flex:1;min-width:0;";
        txt.textContent = `✓ ${u?.label || key} — divulged to ${u?.by || "?"} (${u?.acquisition || "earned"})`;
        const rearm = document.createElement("button");
        rearm.type = "button";
        rearm.style.cssText = "flex:0 0 auto;width:auto;padding:.15em .5em;line-height:1;";
        rearm.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Re-arm`;
        rearm.addEventListener("click", () => { delete this._used[key]; this._renderUsed(); });
        line.append(txt, rearm);
        wrap.appendChild(line);
      }
    }

    _collectLines() {
      // Fields can't carry the '::' separator or newlines — collapse both.
      const clean = (s) => String(s || "").replace(/\s*\n+\s*/g, " ").split("::").join(":").trim();
      const lines = [];
      for (const row of this._els.rows.querySelectorAll("[data-secret-row]")) {
        const get = (f) => row.querySelector(`[data-f="${f}"]`)?.value ?? "";
        const label = clean(get("label"));
        const effectKey = Array.from(row.querySelectorAll('select[data-f="effectKey"]'))
          .map(s => String(s.value || "").trim()).filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join("+");
        const condition = clean(get("condition"));
        const truth = clean(get("truth"));
        if (!label && !condition && !truth) continue;   // untouched blank row
        if (!label || !condition || !truth) {
          ui.notifications?.warn?.(`Secret "${label || "(unnamed)"}" needs a label, condition, AND truth — not saved.`);
          continue;
        }
        lines.push(`${label} :: ${effectKey} :: ${condition} :: ${truth}`);
      }
      return lines;
    }

    async _save() {
      const secretsRaw = this._collectLines().join("\n");
      // Flag updates MERGE nested objects, so a re-armed (deleted) secretsUsed
      // key would silently survive a plain setFlag. Drop the whole subtree
      // via unsetFlag (never raw "-=key" updates — v14 deprecated that
      // syntax); the setFlag below re-merges only the surviving entries.
      const removed = Object.keys(this._cur.secretsUsed || {}).filter(k => !(k in this._used));
      if (removed.length) await this.actor.unsetFlag(MODULE_ID, "persona.secretsUsed");
      await this.actor.setFlag(MODULE_ID, "persona", {
        notes: String(this._els.notes.value ?? ""),
        topics: String(this._els.topics.value ?? ""),
        secretsRaw,
        secretsUsed: this._used,
        courtDoor: String(this._els.courtDoor?.value ?? "").trim()
      });
      await _afterPersonaSave(this.actor);
      ui.notifications?.info(`Persona saved for ${this.actor.name}.`);
      this.close();
    }

    async close(options) {
      PERSONA_APPS.delete(this.actor?.id);
      return super.close(options);
    }
  };

  return PersonaEditorApp;
}

async function editPersona(actor) {
  if (!game.user.isGM) return;
  const App = _definePersonaEditor();
  if (App) {
    let app = PERSONA_APPS.get(actor.id);
    if (app) return app.render({ force: true });
    app = new App(actor);
    PERSONA_APPS.set(actor.id, app);
    return app.render({ force: true });
  }
  return _editPersonaLegacy(actor);
}

// Raw-text fallback (pre-ApplicationV2 cores only).
async function _editPersonaLegacy(actor) {
  const cur = actor.getFlag(MODULE_ID, "persona") || {};
  const secretsApi = _secretsApi();
  const keysHint = secretsApi
    ? Object.entries(secretsApi.EFFECT_INFO || {}).map(([k, v]) => `${k} — ${v}`).join("\n")
    : "";
  const usedLines = Object.values(cur.secretsUsed || {})
    .map(u => `✓ ${_esc(u.label)} — divulged to ${_esc(u.by || "?")} (${_esc(u.acquisition)})`).join("<br>");
  const content = `
    <p style="font-size:.8em;opacity:.75;margin:0 0 .4em;"><b>Knowledge topics</b> — comma-separated names/places/subjects <b>${_esc(actor.name)}</b> knows about. The journal/beat sweep pulls every paragraph mentioning these, so "Dougan Marsh, The Gullywasher" makes those stories part of what they know. (For curated whole-page facts, prefer a World Dossier journal page tagged <code>@knownBy: ${_esc(actor.name)}</code> — it's injected verbatim, no keyword luck.)</p>
    <input type="text" name="topics" style="width:100%;margin-bottom:.6em;" placeholder="Dougan Marsh, The Gullywasher, Port Kudzu…" value="${_esc(cur.topics || "")}"/>
    <p style="font-size:.8em;opacity:.75;margin:0 0 .4em;"><b>Private GM truth</b> — knowledge, secrets, agenda, speech quirks. Shapes every reply; never quoted to players.</p>
    <textarea name="notes" rows="10" style="width:100%;">${_esc(cur.notes || "")}</textarea>
    <p style="font-size:.8em;opacity:.75;margin:.6em 0 .4em;"><b>Extractable secrets</b> — one per line: <code>Label :: effectKey :: unlock condition :: the truth to reveal</code>.<br>When a conversation genuinely meets a secret's condition, ${_esc(actor.name)} divulges it and the asking Steward's faction gains it as courtly leverage (player extractions pause on a GM approval card; yours confirm inline). A divulged secret is spent — change its label to re-arm it.${secretsApi ? "" : " <b>⚠ Courtly secrets API not detected (bbttcc-raid) — this section stays dormant.</b>"}</p>
    <textarea name="secretsRaw" rows="4" style="width:100%;" placeholder="The second ledger :: rollPlus2 :: they prove they already suspect the books are cooked :: The true tallies live under the third floorboard of the counting room.">${_esc(cur.secretsRaw || "")}</textarea>
    ${keysHint ? `<details style="font-size:.75em;opacity:.7;margin:.2em 0;"><summary>Valid effect keys</summary><pre style="white-space:pre-wrap;margin:.2em 0;">${_esc(keysHint)}</pre></details>` : ""}
    ${usedLines ? `<p style="font-size:.75em;opacity:.7;margin:.2em 0;">${usedLines}</p>` : ""}
    <p style="font-size:.8em;opacity:.75;margin:.6em 0 .4em;"><b>Court door</b> — leave blank for none. The condition under which ${_esc(actor.name)} would usher Stewards INTO their faction's court (a Courtly Intrigue engagement against it).</p>
    <input type="text" name="courtDoor" style="width:100%;" placeholder="e.g. they bring proof the tithe is being skimmed, and swear to raise it before the court themselves" value="${_esc(cur.courtDoor || "")}"/>`;

  const readForm = (form) => ({
    topics:     String(form?.elements?.topics?.value ?? ""),
    notes:      String(form?.elements?.notes?.value ?? ""),
    secretsRaw: String(form?.elements?.secretsRaw?.value ?? ""),
    courtDoor:  String(form?.elements?.courtDoor?.value ?? "")
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
              topics:     root.querySelector?.("[name=topics]")?.value ?? "",
              notes:      root.querySelector?.("[name=notes]")?.value ?? "",
              secretsRaw: root.querySelector?.("[name=secretsRaw]")?.value ?? "",
              courtDoor:  root.querySelector?.("[name=courtDoor]")?.value ?? ""
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
  const secretsRaw = String(result.secretsRaw ?? "");
  await actor.setFlag(MODULE_ID, "persona", {
    notes: String(result.notes), topics: String(result.topics),
    secretsRaw, secretsUsed: cur.secretsUsed || {},
    courtDoor: String(result.courtDoor ?? "").trim()
  });
  const armed = _parseSecretLines(secretsRaw).filter(s => !(cur.secretsUsed || {})[s.key]);
  if (secretsRaw.trim()) log(`persona secrets: ${armed.length} armed for '${actor.name}' (skipped lines warn above)`);
  await _afterPersonaSave(actor);
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

// Secret extraction cards (player-initiated divulge_secret) — same shape as
// story-moment approval, but the words are ALREADY spoken; the card only
// gates the mechanical leverage (earned/stolen courtly Secret Item).
async function _handleSecretCardClick(message, action, root) {
  if (!game.user.isGM) return;
  const p = message.getFlag(MODULE_ID, "pendingSecret");
  if (!p) return;

  let outcome;
  if (action === "decline") {
    outcome = "✗ Withheld — the words were spoken, but the table grants no leverage.";
  } else {
    const acquisition = action === "stolen" ? "stolen" : "earned";
    const factionId = root?.querySelector?.("[name=bbttccSecretFaction]")?.value || p.factionId;
    const npcActor = game.actors?.get(p.npcActorId);
    if (!npcActor) {
      outcome = "⚠ NPC actor no longer exists — nothing granted.";
    } else {
      const def = { key: p.key, label: p.label, effectKey: p.effectKey, condition: p.condition, truth: p.truth };
      try {
        const r = await _grantSecret({ npcActor, def, factionId, acquisition, speakerName: p.speakerName });
        outcome = r.ok
          ? `✓ Granted (${acquisition}) — "${p.label}" is now leverage held by ${r.faction.name}`
          : `⚠ grant failed: ${r.error}`;
      } catch (e) {
        outcome = `⚠ grant threw: ${e?.message || e}`;
      }
    }
  }

  try {
    await message.update({
      content: `<div class="bbttcc-mal-voice" style="border-left:3px solid #7a4db8;padding:.4em .6em;background:rgba(122,77,184,.08);">
        <b>Secret</b> — ${_esc(p.label)}<br>${_esc(outcome)}</div>`,
      [`flags.${MODULE_ID}.pendingSecret`]: null
    });
  } catch (e) { warn("secret card update failed:", e?.message); }
}

function _bindSecretButtons(message, root) {
  if (!root || !message?.getFlag?.(MODULE_ID, "pendingSecret")) return;
  for (const btn of root.querySelectorAll("[data-bbttcc-secret]")) {
    if (btn.dataset.bbttccBound) continue;   // v13 fires BOTH render hooks — bind once
    btn.dataset.bbttccBound = "1";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      _handleSecretCardClick(message, btn.dataset.bbttccSecret, root);
    });
  }
}

// Court-door cards (player-initiated open_court_door) — same shape as the
// secret cards: the ushering words are ALREADY spoken; the card only gates
// the mechanical entry (the courtlyDoor stamp + Raid Console signpost).
async function _handleCourtDoorCardClick(message, action, root) {
  if (!game.user.isGM) return;
  const p = message.getFlag(MODULE_ID, "pendingCourtDoor");
  if (!p) return;

  let outcome;
  if (action === "decline") {
    outcome = "✗ Kept shut — the words were warm, but the court receives no one.";
  } else {
    const method = action === "conceded" ? "conceded" : "invited";
    const factionId = root?.querySelector?.("[name=bbttccCourtDoorFaction]")?.value || p.factionId;
    const npcActor = game.actors?.get(p.npcActorId);
    if (!npcActor) {
      outcome = "⚠ NPC actor no longer exists — no door opened.";
    } else {
      try {
        const r = await _grantCourtDoor({ npcActor, defenderId: p.defenderId, factionId, method, speakerName: p.speakerName });
        outcome = r.ok
          ? `✓ Opened (${method}) — ${r.attacker.name} may now enter ${r.defender.name}'s court`
          : `⚠ door failed: ${r.error}`;
      } catch (e) {
        outcome = `⚠ door threw: ${e?.message || e}`;
      }
    }
  }

  try {
    await message.update({
      content: `<div class="bbttcc-mal-voice" style="border-left:3px solid #4db87a;padding:.4em .6em;background:rgba(77,184,122,.08);">
        <b>Court door</b> — ${_esc(p.defenderName || "the court")}<br>${_esc(outcome)}</div>`,
      [`flags.${MODULE_ID}.pendingCourtDoor`]: null
    });
  } catch (e) { warn("court door card update failed:", e?.message); }
}

function _bindCourtDoorButtons(message, root) {
  if (!root || !message?.getFlag?.(MODULE_ID, "pendingCourtDoor")) return;
  for (const btn of root.querySelectorAll("[data-bbttcc-court-door]")) {
    if (btn.dataset.bbttccBound) continue;   // v13 fires BOTH render hooks — bind once
    btn.dataset.bbttccBound = "1";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      _handleCourtDoorCardClick(message, btn.dataset.bbttccCourtDoor, root);
    });
  }
}

// The public "way is open" card: [To the Court] opens the Raid Console on
// the entering faction for whoever clicks (GM or player).
function _bindCourtConsoleButtons(_message, root) {
  if (!root) return;
  for (const btn of root.querySelectorAll("[data-bbttcc-court-console]")) {
    if (btn.dataset.bbttccBound) continue;   // v13 fires BOTH render hooks — bind once
    btn.dataset.bbttccBound = "1";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const open = game.bbttcc?.api?.raid?.openConsole || game.bbttcc?.api?.raid?.openRaidConsole;
      if (typeof open !== "function") return ui.notifications?.warn?.("Raid Console not available on this world.");
      open({ factionId: String(btn.dataset.bbttccCourtConsole || "") });
    });
  }
}

// v13+ fires renderChatMessageHTML (HTMLElement); older cores fire
// renderChatMessage (jQuery). Bind both defensively.
Hooks.on("renderChatMessageHTML", (message, html) => { try { _bindApprovalButtons(message, html); _bindSecretButtons(message, html); _bindCourtDoorButtons(message, html); _bindCourtConsoleButtons(message, html); } catch (_e) {} });
Hooks.on("renderChatMessage",     (message, html) => { try { const r = html?.[0] ?? html; _bindApprovalButtons(message, r); _bindSecretButtons(message, r); _bindCourtDoorButtons(message, r); _bindCourtConsoleButtons(message, r); } catch (_e) {} });

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

  game.settings.register(MODULE_ID, "dialogueIntroAudio", {
    name:    "Play recorded intro when a conversation opens",
    hint:    "When an NPC dialogue window opens and that NPC is hosting a live story moment with recorded audio, play the recording as the NPC's opening — live AI dialogue continues from it. Outcome-beat audio plays separately when a choice enacts (the curtain call).",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: true
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
      // Courtly bridge probe: how many extractable secrets are ARMED on this
      // NPC right now (parsed persona lines minus spent ones). Lets the raid
      // module's converse-flavored maneuvers (Read the Room / Eavesdrop)
      // find candidates without reaching into persona internals.
      armedSecretCount: (actorOrId) => {
        try {
          const actor = (typeof actorOrId === "string") ? game.actors.get(actorOrId) : (actorOrId?.actor ?? actorOrId);
          return actor ? _armedSecrets(actor).length : 0;
        } catch (_e) { return 0; }
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
