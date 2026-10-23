// modules/bbttcc-market/scripts/contracts.js
// CONTRACTS — hired Crews and Occult Associations (ruling 15, Dave 2026-10-17: "make all the crews and associations
// HIREABLE. So the players can recruit the right crew for the right mission. And remove them entirely from the
// character/faction equation. The powers and benefits all stay the same, the bonuses and the maneuvers. And the caps
// on how many you can have. But you go and recruit a group to come with you.")
//
// How it works without re-plumbing a thing: a hire SETS the steward's crew / occult slot exactly as the old identity
// dropdown did (systems/fourththing/bbttcc-bridge.js setActorEchoAssetSlot → identity flag + embedded feats + the
// Domain's echoAssets pool), and records a contract with an expiry turn. Every consumer — raid maneuver grants, tier
// feats, opt_* unlocks, the muster count, the affiliation rows — keeps reading the slot. When the contract runs out
// (or the steward releases it) the slot is cleared, the crew's feats leave the sheet, and the Domain pool is re-synced.
//
// One contract per family (crew / occult) per steward at a time: that is the cap the identity slots always had.
//
// Storage: actor.flags["bbttcc-character-options"].contracts = { crew?: C, occult?: C }
//   C = { docId, pack, name, displayName, since, until, turns, source, entryId, vendorId, portrait?, noted? }
//   portrait = the face the player chose for the crew at hire (Asli art picker), else the catalog entry's image.
//   `until` = last world turn the contract covers (inclusive). Turn clock = game.bbttcc.api.world.getState().turn.
//
// API: game.bbttcc.api.contracts = { list(actor), get(actor, family), hire(actor, family, docId, opts), release(actor, family, opts),
//                                    sweep({apply}), turnsLeft(c), setPortrait(actor, family, img), choosePortrait(actor, family), FAMILIES }
// Hooks fired: "bbttcc:contract:hired" | "bbttcc:contract:released" | "bbttcc:contract:lastTurn" | "bbttcc:contract:ended" ({ actorId, family, contract })
// Market: catalog kind "contract" ({ contract: { family, docId, pack, turns } }) delivers through hire(). See market.js.
// Imported from market.js (same module scope) so no module.json edit is needed.

const CO = "bbttcc-character-options";
const TAG = "[bbttcc-market/contracts]";
const FAMILIES = Object.freeze({
  crew:   { label: "Crew",        pack: "bbttcc-character-options.crew-types",         namePattern: /^(?:Crew Type|Awesome Crew):\s*/i,      idPrefix: "crew-" },
  occult: { label: "Association", pack: "bbttcc-character-options.occult-associations", namePattern: /^(?:Occult Association|Occult):\s*/i, idPrefix: "occult-" },
});

const _turn = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch (_e) { return 0; } };
const _actor = (a) => (a instanceof Actor) ? a : (game.actors?.get(String(a ?? "").replace(/^Actor\./, "")) ?? null);
const _echo = () => game.fourththing?.echoAssets ?? {};
const _esc = (s) => { try { return foundry.utils.escapeHTML(String(s ?? "")); } catch { return String(s ?? ""); } };
const _normName = (raw, family) => String(raw ?? "").replace(FAMILIES[family]?.namePattern ?? /^$/, "").replace(/\s*\(Tier\s*\d+\)\s*$/i, "").trim();

function list(actorOrId) {
  const a = _actor(actorOrId); if (!a) return [];
  const raw = a.getFlag?.(CO, "contracts") || {};
  return Object.keys(FAMILIES).map(f => raw[f] ? { family: f, familyLabel: FAMILIES[f].label, ...raw[f], turnsLeft: turnsLeft(raw[f]) } : null).filter(Boolean);
}
function get(actorOrId, family) { return list(actorOrId).find(c => c.family === family) || null; }
function turnsLeft(c) {
  if (!c) return 0;
  if (c.until == null) return Infinity;
  return Math.max(0, Number(c.until) - _turn() + 1);
}
function isActive(c) { return !!c && turnsLeft(c) > 0; }

async function _resolveDoc(family, docId) {
  const fam = FAMILIES[family]; if (!fam) throw new Error(`Unknown contract family "${family}".`);
  const pack = game.packs?.get(fam.pack); if (!pack) throw new Error(`Missing pack: ${fam.pack}`);
  const doc = await pack.getDocument(String(docId || "").trim());
  if (!doc) throw new Error(`Could not resolve ${fam.label} ${docId} in ${fam.pack}.`);
  return doc;
}

/** Remove every embedded item of a family (base + tier feats): a hire replaces whatever the steward carried, an expiry clears it. */
async function _purgeFamilyItems(a, family) {
  const fam = FAMILIES[family];
  const ids = (a.items?.contents ?? []).filter(it => {
    const nm = String(it.name ?? ""); const ident = String(it.system?.identifier ?? "");
    const cat = it.flags?.[CO]?.category || it.flags?.[CO]?.option?.category || "";
    return fam.namePattern.test(nm) || ident.startsWith(fam.idPrefix) || cat === family || cat === `${family}-types` || (family === "occult" && cat === "occult-associations");
  }).map(it => it.id);
  if (ids.length) { try { await a.deleteEmbeddedDocuments("Item", ids); } catch (e) { console.warn(TAG, "family item cleanup failed", e); } }
  return ids.length;
}

/** The Tier Engine (bbttcc-character-options) attaches / removes the family's tier feats from the identity slot; then the OP recalc. */
async function _syncTierFeats(a) {
  try { await game.bbttcc?.api?.identity?.syncOptionTiers?.(a, { silent: true }); } catch (e) { console.warn(TAG, "syncOptionTiers failed", e); }
  try { await game.bbttcc?.api?.characterOptions?.recalcActor?.(a.id); } catch (_e) {}
}

/** Hire a crew / association for `turns` world turns (default 3). GM-side write (market relays players through gmExec). */
async function hire(actorOrId, family, docId, { turns = 3, source = "market", entryId = null, vendorId = null, quiet = false, portrait = null } = {}) {
  const a = _actor(actorOrId); if (!a) throw new Error("Steward not found.");
  if (a.type !== "character") throw new Error("Only a steward can hold a contract.");
  const fam = FAMILIES[family]; if (!fam) throw new Error(`Unknown contract family "${family}".`);
  const cur = get(a, family);
  if (isActive(cur)) throw new Error(`${a.name} already holds a ${fam.label.toLowerCase()} contract: ${cur.displayName} (${cur.turnsLeft === Infinity ? "standing" : cur.turnsLeft + " turn(s) left"}). Release it first.`);
  const doc = await _resolveDoc(family, docId);
  const setSlot = _echo().setSlot;
  if (typeof setSlot !== "function") throw new Error("Echo-asset slot API not available (system too old).");
  await _purgeFamilyItems(a, family);          // whatever crew the sheet still carried (legacy pick, lapsed contract) leaves first
  await setSlot(a, family, doc.id);
  await _syncTierFeats(a);                      // attach the crew's T1..tier feats (bonuses + opt_* unlocks ride on them)
  const t = _turn(); const n = Math.max(1, Math.floor(Number(turns) || 3));
  const contract = { docId: doc.id, pack: fam.pack, name: doc.name, displayName: _normName(doc.name, family), since: t, until: t + n - 1, turns: n, source, entryId, vendorId, portrait: portrait ? String(portrait) : null, hiredAt: Date.now() };
  await a.setFlag(CO, `contracts.${family}`, contract);
  try { await _echo().syncSteward?.(a); } catch (_e) {}
  try { Hooks.callAll("bbttcc:contract:hired", { actorId: a.id, family, contract }); } catch (_e) {}
  if (!quiet) _card(a, `✍ Hired: ${_esc(contract.displayName)}`, `${_esc(fam.label)} under contract to ${_esc(a.name)} for <b>${n}</b> turn${n === 1 ? "" : "s"} (through turn ${contract.until}). Their maneuvers, bonuses and people ride with you until then.`);
  return contract;
}

/** The crew's face — the player picks one at hire (Asli art picker); changeable any time from the Retinue card. */
async function setPortrait(actorOrId, family, img) {
  const a = _actor(actorOrId); if (!a) return null;
  if (!isActive(get(a, family))) return null;
  await a.setFlag(CO, `contracts.${family}.portrait`, img ? String(img) : null);
  try { Hooks.callAll("bbttcc:contract:portrait", { actorId: a.id, family, portrait: img || null }); } catch (_e) {}
  return img || null;
}

/** Open the art picker for a held contract and store the choice. Resolves to the chosen path, or null. */
async function choosePortrait(actorOrId, family) {
  const a = _actor(actorOrId); const c = a ? get(a, family) : null;
  const picker = game.bbttcc?.artPicker;
  if (!c || !picker?.pick) return null;
  const sel = await picker.pick({ kind: "echo", current: c.portrait || "", title: `Who leads ${c.displayName}?` });
  return sel?.img ? setPortrait(a, family, sel.img) : null;
}

/** End a contract now: clears the slot, removes the crew's embedded feats, re-syncs the Domain pool. */
async function release(actorOrId, family, { reason = "released", quiet = false } = {}) {
  const a = _actor(actorOrId); if (!a) throw new Error("Steward not found.");
  const fam = FAMILIES[family]; if (!fam) throw new Error(`Unknown contract family "${family}".`);
  const cur = get(a, family);
  // 1. the crew's items go (base + tier feats) so the Domain scan stops seeing them — one contract per family, so every item of the family is theirs
  await _purgeFamilyItems(a, family);
  // 2. the slot
  try { await _echo().setSlot?.(a, family, ""); } catch (e) { console.warn(TAG, "slot clear failed", e); }
  await _syncTierFeats(a);
  // 3. the record
  try { await a.unsetFlag(CO, `contracts.${family}`); } catch (_e) { try { await a.setFlag(CO, `contracts.${family}`, null); } catch (_e2) {} }
  // 4. the Domain pool
  try { await _echo().syncSteward?.(a); } catch (_e) {}
  try { Hooks.callAll(reason === "ended" ? "bbttcc:contract:ended" : "bbttcc:contract:released", { actorId: a.id, family, contract: cur }); } catch (_e) {}
  if (!quiet && cur) _card(a, reason === "ended" ? `⌛ Contract ended: ${_esc(cur.displayName)}` : `✂ Released: ${_esc(cur.displayName)}`,
    reason === "ended" ? `The ${_esc(fam.label.toLowerCase())} has moved on. Their maneuvers and bonuses leave with them — hire again at the Muster.` : `${_esc(a.name)} let the ${_esc(fam.label.toLowerCase())} go.`);
  return cur;
}

/** Turn clock: last-turn notice, then expiry. GM only; skipped on a dry turn. */
async function sweep({ apply = true } = {}) {
  if (!game.user?.isGM || apply === false) return { ended: 0, lastTurn: 0 };
  const t = _turn(); let ended = 0, lastTurn = 0;
  for (const a of (game.actors?.contents ?? [])) {
    if (a.type !== "character") continue;
    for (const c of list(a)) {
      if (c.until == null) continue;
      if (Number(c.until) < t) { try { await release(a, c.family, { reason: "ended" }); ended++; } catch (e) { console.warn(TAG, "expire failed", a.name, c.family, e); } }
      else if (Number(c.until) === t && c.noted !== t) {
        lastTurn++;
        try { await a.setFlag(CO, `contracts.${c.family}.noted`, t); } catch (_e) {}
        _card(a, `⌛ Last turn: ${_esc(c.displayName)}`, `This is the last turn of ${_esc(a.name)}'s ${_esc(c.familyLabel.toLowerCase())} contract. Renew at the Muster or they walk at Day's End.`);
        try { Hooks.callAll("bbttcc:contract:lastTurn", { actorId: a.id, family: c.family, contract: c }); } catch (_e) {}
      }
    }
  }
  return { ended, lastTurn };
}

function _card(actor, title, body) {
  try {
    const pub = (() => { try { return game.settings.get("bbttcc-core", "tableAnnouncements") !== "gm"; } catch { return true; } })();
    const whisper = pub ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper,
      content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">${title}</span></div><p style="margin:.2rem 0;font-size:.82rem;opacity:.85">${body}</p></div>` });
  } catch (_e) {}
}

Hooks.on("bbttcc:advanceTurn:end", (ctx) => { sweep({ apply: ctx?.apply !== false }).catch(e => console.warn(TAG, "sweep failed", e)); });

function _attach() {
  try {
    game.bbttcc ??= {}; game.bbttcc.api ??= {};
    game.bbttcc.api.contracts = { list, get, hire, release, sweep, turnsLeft, isActive, setPortrait, choosePortrait, FAMILIES };
  } catch (e) { console.warn(TAG, "wiring failed", e); }
}
Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}

export { list, get, hire, release, sweep, turnsLeft, isActive, FAMILIES };
