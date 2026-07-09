
/* ========================================================================== */
/* Bad Eden Bridge (Manifestation + Backing) — Sacrifice Types + Resource Locks  */
/* v13-safe UI injection: uses BOTH getActorSheetHeaderButtons and render hook */
/* ========================================================================== */
(function () {
  var FLAG_SCOPE = "bbttcc-bridge";

  function warn() { try { console.warn("[bbttcc-bridge]", ...arguments); } catch (_) {} }
  function num(x, d){ var n=Number(x); return isFinite(n)?n:(d!=null?d:0); }
  function opLabel(key){ key=String(key||"").trim().toLowerCase(); return key?key.charAt(0).toUpperCase()+key.slice(1):"OP"; }

  function _gp(obj, path){
    try { return foundry && foundry.utils && foundry.utils.getProperty ? foundry.utils.getProperty(obj, path) : null; } catch(_e){ return null; }
  }
  function _sp(obj, path, val){
    try { if(foundry && foundry.utils && foundry.utils.setProperty) return foundry.utils.setProperty(obj, path, val); } catch(_e) {}
    return null;
  }
  function _dup(x){
    try { return foundry && foundry.utils && foundry.utils.duplicate ? foundry.utils.duplicate(x) : JSON.parse(JSON.stringify(x||{})); } catch(_e){ return x; }
  }


/* ---------------------------------------
 * Blood Debt Canon Sync (Character Sheet source of truth)
 *
 * Canonical storage (Character Sheet / Identity Tab):
 *   flags.bbttcc.identity.bloodDebt = { value:Number, ledger:Array }
 * Legacy mirror (optional):
 *   flags.bbttcc.bloodDebt = Number
 *
 * Bridge storage (internal + locks):
 *   flags.bbttcc-bridge.bloodDebtModel = { value, ledger, locks }
 *   flags.bbttcc-bridge.bloodDebt      = Number
 *
 * Policy for Alpha:
 * - Bridge ALWAYS mirrors its bloodDebt value into canonical bbttcc.identity.bloodDebt.value
 * - GM clearing canonical Blood Debt to 0 is treated as "resolved": Bridge debt + locks are wiped.
 * ------------------------------------ */

function _readCanonicalBloodDebt(actor){
  try {
    var f = actor ? (actor.flags || {}) : {};
    var v1 = (((f.bbttcc||{}).identity||{}).bloodDebt) || null;
    if (v1 && typeof v1 === "object") {
      return {
        value: num(v1.value, 0),
        ledger: Array.isArray(v1.ledger) ? v1.ledger : []
      };
    }
    var legacy = num((f.bbttcc||{}).bloodDebt, 0);
    return { value: legacy, ledger: [] };
  } catch (_e) {
    return { value: 0, ledger: [] };
  }
}

async function _writeCanonicalBloodDebt(actor, model){
  try {
    if (!actor || typeof actor.update !== "function") return;
    model = model && typeof model === "object" ? model : {};
    var value = Math.max(0, num(model.value, 0));
    var ledger = Array.isArray(model.ledger) ? model.ledger : [];
    // Keep canonical + legacy mirror
    await actor.update({
      "flags.bbttcc.identity.bloodDebt": { value: value, ledger: ledger },
      "flags.bbttcc.bloodDebt": value
    });
  } catch (_e) {}
}

async function _syncCanonicalFromBridge(actor, bridgeModel){
  try {
    if (!actor) return;
    bridgeModel = bridgeModel && typeof bridgeModel === "object" ? bridgeModel : {};
    var value = Math.max(0, num(bridgeModel.value, 0));
    // Mirror value into canonical; do not try to merge ledgers (GM ledger is canonical).
    var canon = _readCanonicalBloodDebt(actor);
    if (num(canon.value, 0) !== value) {
      await _writeCanonicalBloodDebt(actor, { value: value, ledger: canon.ledger || [] });
    }
  } catch (_e) {}
}

async function _clearBridgeDebtAndLocks(actor){
  try {
    if (!actor || typeof actor.unsetFlag !== "function") return;
    await actor.unsetFlag(FLAG_SCOPE, "bloodDebtModel");
    await actor.unsetFlag(FLAG_SCOPE, "bloodDebt");
  } catch (_e) {}
}

  function readFactionOpBank(faction){
    try{
      if(!faction) return {};
      var bank = (faction.getFlag ? (faction.getFlag("bbttcc-factions","opBank")||{}) : ((faction.flags||{})["bbttcc-factions"]||{}).opBank||{});
      var out={}; Object.keys(bank||{}).forEach(function(k){ out[String(k)] = num(bank[k],0); });
      return out;
    }catch(_e){ return {}; }
  }

  function readFactionTier(faction){
    try{
      var a=((faction.flags||{})["bbttcc-factions"]||{});
      var t = (a.tier!=null?a.tier:(a.factionTier!=null?a.factionTier:(a.tierBand!=null?a.tierBand:a.tierLetter)));
      return (t==null||t==="") ? null : t;
    }catch(_e){ return null; }
  }

  // Integrity price per OP by faction tier. bbttcc-factions stores tier as a
  // NUMBER 0–4 (the letter A/B/C scheme this file originally read never matched,
  // so the price was silently flat 10 — fixed 2026-07-06). Letters still honored
  // for any legacy data. Price points kept: low tier 10 → T2 7 → T3+ 5.
  function integrityCostPerOp(faction){
    var t = readFactionTier(faction);
    var s = String(t==null?"":t).trim().toUpperCase();
    if(s==="C") return 5;
    if(s==="B") return 7;
    if(s===""||s==="A") return 10;
    var n = Number(s);
    if(isFinite(n)) return n>=3 ? 5 : (n===2 ? 7 : 10);
    return 10;
  }

  // Legacy letter-tier signature kept for any external macro callers.
  function hpCostPerOp(tier){ return tier==="C"?5:(tier==="B"?7:10); }

  async function resolveActorByIdOrUuid(idOrUuid){
    if(!idOrUuid) return null;
    var s=String(idOrUuid).trim();
    if(s.indexOf("Actor.")===0) s = s.slice(6);
    var a = game.actors.get(s);
    if(a) return a;
    if(typeof fromUuid==="function" && s.indexOf(".")!==-1){
      try{
        var doc = await fromUuid(s);
        if(doc && doc.documentName==="Actor") return doc;
      }catch(_e){}
    }
    return null;
  }

  function boundFactionIdForActor(actor){
    try{
      var f=actor.flags||{};
      var bb=f["bbttcc"]||f["bbttcc-core"]||{};
      if(bb.factionId) return String(bb.factionId);
      if(bb.factionUuid) return String(bb.factionUuid);
      var id2=(f["bbttcc-factions"]||{}).factionId;
      if(id2) return String(id2);
    }catch(_e){}
    try{ if(actor && (actor.flags||{})["bbttcc-factions"]) return String(actor.id||""); }catch(_e2){}
    return "";
  }

  async function opCommit(factionId, deltas, reason){
    var api = (game.bbttcc && game.bbttcc.api) ? game.bbttcc.api : null;
    var op = api ? api.op : null;
    if(!op || typeof op.commit!=="function") throw new Error("bbttcc api.op.commit not available");
    // op-engine expects a CONTEXT OBJECT ({source,label,allowOvercap}); the old
    // string reason meant every option read as undefined (fixed 2026-07-06).
    var ctx = (typeof reason === "string" || reason == null)
      ? { source: "bridge", label: String(reason || "Bridge") }
      : reason;
    return op.commit(factionId, deltas, ctx);
  }

  function _now(){ return Date.now(); }

  async function _appendBridgeLedger(pc, entry){
    try{
      var model = (pc.getFlag ? (pc.getFlag(FLAG_SCOPE, "bloodDebtModel")||null) : null);
      if(!model || typeof model!=="object"){
        var prev = num(pc.getFlag ? pc.getFlag(FLAG_SCOPE, "bloodDebt") : 0, 0);
        model = { value: prev, ledger: [], locks: [] };
      }
      model = _dup(model);
      model.value = num(model.value,0);
      model.ledger = Array.isArray(model.ledger) ? model.ledger : [];
      model.locks  = Array.isArray(model.locks)  ? model.locks  : [];
      model.ledger.unshift(entry);
      model.ledger = model.ledger.slice(0, 30);
      await pc.setFlag(FLAG_SCOPE, "bloodDebtModel", model);
      // legacy numeric mirror (keep)
      await pc.setFlag(FLAG_SCOPE, "bloodDebt", num(model.value,0));
    }catch(_e){}
  }

  async function _addLock(pc, lock){
    try{
      var model = (pc.getFlag ? (pc.getFlag(FLAG_SCOPE, "bloodDebtModel")||null) : null);
      if(!model || typeof model!=="object"){
        var prev = num(pc.getFlag ? pc.getFlag(FLAG_SCOPE, "bloodDebt") : 0, 0);
        model = { value: prev, ledger: [], locks: [] };
      }
      model = _dup(model);
      model.value = num(model.value,0);
      model.ledger = Array.isArray(model.ledger) ? model.ledger : [];
      model.locks  = Array.isArray(model.locks)  ? model.locks  : [];
      model.locks.unshift(lock);
      model.locks = model.locks.slice(0, 50);
      await pc.setFlag(FLAG_SCOPE, "bloodDebtModel", model);
      await pc.setFlag(FLAG_SCOPE, "bloodDebt", num(model.value,0));
      await _syncCanonicalFromBridge(pc, model);
    }catch(_e){}
  }

  async function _addBloodDebt(pc, delta, meta){
    delta = num(delta, 0);
    if(!delta) return;
    try{
      var model = (pc.getFlag ? (pc.getFlag(FLAG_SCOPE, "bloodDebtModel")||null) : null);
      if(!model || typeof model!=="object"){
        var prev = num(pc.getFlag ? pc.getFlag(FLAG_SCOPE, "bloodDebt") : 0, 0);
        model = { value: prev, ledger: [], locks: [] };
      }
      model = _dup(model);
      model.value = Math.max(0, num(model.value,0) + delta);
      model.ledger = Array.isArray(model.ledger) ? model.ledger : [];
      model.locks  = Array.isArray(model.locks)  ? model.locks  : [];
      await pc.setFlag(FLAG_SCOPE, "bloodDebtModel", model);
      await pc.setFlag(FLAG_SCOPE, "bloodDebt", num(model.value,0));
      await _appendBridgeLedger(pc, {
        ts: _now(),
        delta: delta,
        source: (meta && meta.source) ? String(meta.source) : "manifestation",
        note: (meta && meta.note) ? String(meta.note) : ""
      });
    }catch(_e){}
  }

  // ── RFI sacrifice debit functions ──────────────────────────────────────
  // Sacrifice surfaces target RFI faculty resources, not D&D paths. The
  // dnd5e legacy paths (hp/hd/exhaustion/spellslot) have been retired here;
  // legacy sacType strings still resolve via the alias map in
  // manifestSacrificeToFactionOp.

  function _readIntegrity(pc){
    try {
      // fourththing schema: system.derived.integrity.{value,max}
      var sys = pc?.system?.system ?? pc?.system;
      var iv  = num(sys?.derived?.integrity?.value, 0);
      var im  = num(sys?.derived?.integrity?.max,   0);
      return { value: iv, max: im };
    } catch(_e){ return { value: 0, max: 0 }; }
  }

  async function _debitIntegrity(pc, cost){
    var integ = _readIntegrity(pc);
    var cur = num(integ.value, 0);
    if (cur < cost) throw new Error("Not enough Integrity (need "+cost+", have "+cur+")");
    await pc.update({ "system.derived.integrity.value": Math.max(0, cur - cost) });
    return { integrityCost: cost };
  }

  function _readStress(pc){
    try {
      var sys = pc?.system?.system ?? pc?.system;
      var sv  = num(sys?.derived?.stress?.value, 0);
      var sm  = num(sys?.derived?.stress?.max,   0);
      return { value: sv, max: sm };
    } catch(_e){ return { value: 0, max: 0 }; }
  }

  async function _debitStress(pc, cost){
    // RFI Stress is a depleting track: value drops as stress accumulates.
    // Sacrificing Stress = pushing the value down further. Floor at 0.
    var st = _readStress(pc);
    var cur = num(st.value, 0);
    if (cur < cost) throw new Error("Not enough Stress (need "+cost+", have "+cur+")");
    await pc.update({ "system.derived.stress.value": Math.max(0, cur - cost) });
    return { stressCost: cost };
  }

  function _readSkillRank(pc, key){
    try {
      var sys = pc?.system?.system ?? pc?.system;
      return num(sys?.skills?.[key]?.value, 0);
    } catch(_e){ return 0; }
  }

  async function _debitAptitudeRank(pc, key, ranks){
    key = String(key||"").trim().toLowerCase();
    if (!key) throw new Error("Aptitude key required.");
    ranks = Math.max(1, num(ranks, 1));
    var cur = _readSkillRank(pc, key);
    if (cur < ranks) throw new Error("Not enough rank in "+key+" (need "+ranks+", have "+cur+")");
    var patch = {};
    patch["system.skills."+key+".value"] = Math.max(0, cur - ranks);
    await pc.update(patch);
    // Stamp a restore marker so the next Soma Break can roll it back.
    try {
      var burnFlag = pc.getFlag("fourththing", "aptitudeBurn") || [];
      if (!Array.isArray(burnFlag)) burnFlag = [];
      burnFlag.push({ key: key, ranks: ranks, ts: _now(), source: "manifestation" });
      await pc.setFlag("fourththing", "aptitudeBurn", burnFlag);
    } catch(_e){}
    return { aptitudeKey: key, ranks: ranks };
  }

  async function _addManifestationLockout(pc, tiers){
    tiers = Math.max(1, num(tiers, 1));
    try {
      var cur = num(pc.getFlag("fourththing", "manifestationLockout"), 0);
      var next = cur + tiers;
      await pc.setFlag("fourththing", "manifestationLockout", next);
      // Cleared at scene end / next Soma Break by hooks downstream; the flag
      // alone is enough to gate manifestation rolls in cast paths that
      // consult it.
      return { lockoutTiers: tiers, total: next };
    } catch(_e){
      throw new Error("Could not set manifestation lockout flag: "+(_e.message||_e));
    }
  }

  // Legacy dnd5e debits retired — kept as no-op stubs so any forgotten
  // call site fails loud rather than silently mutating dnd5e paths on an
  // RFI actor. Use _debitIntegrity / _debitStress / _debitAptitudeRank /
  // _addManifestationLockout instead.
  async function _debitHitDice(){ throw new Error("Hit Dice sacrifice retired — use 'aptitude' (Aptitude Rank burn)."); }
  async function _addExhaustion(){ throw new Error("Exhaustion sacrifice retired — use 'stress' (Stress damage)."); }

  // ── RFI sacrifice canon (2026-05-09 Blood Debt refit) ─────────────────
  // sacType canonical names (RFI-native):
  //   integrity      — debit integrity track. Cost = (faction-tier * 5) per OP.
  //   stress         — debit stress track. Cost = 2 per OP.
  //   aptitude       — burn 1 rank from a chosen aptitude/skill. 1 rank = 3 OP.
  //   manifestation  — manifestation lockout flag. 1 tier-lock (scene) = 4 OP.
  //
  // Legacy sacType strings remain accepted as aliases (so old macros / chat
  // scripts don't break):
  //   hp        → integrity
  //   exhaustion→ stress
  //   hitdie    → aptitude
  //   spellslot → manifestation
  var SACRIFICE_ALIAS = {
    hp: "integrity",
    exhaustion: "stress",
    hitdie: "aptitude",
    spellslot: "manifestation"
  };

  async function _recordBloodDebt(pc, value, meta){
    var ftBD = (game.fourththing && game.fourththing.bloodDebt) ? game.fourththing.bloodDebt : null;
    if (ftBD && typeof ftBD.add === "function") {
      try {
        await ftBD.add(pc, {
          value: num(value, 0),
          source: (meta && meta.source) || "manifestation",
          tag:    (meta && meta.tag)    || "",
          note:   (meta && meta.note)   || ""
        });
        return;
      } catch(_e){}
    }
    // Fallback: legacy bridge ledger.
    await _addBloodDebt(pc, value, meta);
  }

  async function manifestSacrificeToFactionOp(opts){
    opts = opts || {};
    var pc = game.actors.get(opts.pcActorId) || null;
    var faction = await resolveActorByIdOrUuid(opts.factionId);
    var opKey = String(opts.opKey||"").trim().toLowerCase();
    var opAmount = Math.max(1, num(opts.opAmount, 1));
    var sacRaw = String(opts.sacrificeType || "integrity").trim().toLowerCase();
    var sacType = SACRIFICE_ALIAS[sacRaw] || sacRaw;
    var note = String(opts.note || "").trim();

    if(!pc) throw new Error("PC actor not found");
    if(!faction) throw new Error("Faction actor not found");
    if(!opKey) throw new Error("Missing OP key");

    var integrityPer = Math.max(1, num(opts.integrityPerOpOverride, num(opts.hpPerOpOverride, integrityCostPerOp(faction))));

    // Blood Debt accrual: 1 BD point per OP yielded (narrative IOU).
    var bloodDebtDelta = opAmount;

    var debitMeta = { type: sacType, opKey: opKey, opAmount: opAmount };

    // ── Phase 1: validate & stage (NO writes). The deposit can be refused by
    // the op-engine (bank cap), so nothing may burn until it has committed.
    var doDebit = null;
    var lock = {
      ts: _now(), kind: sacType, opKey: opKey, opAmount: opAmount,
      factionId: faction.id, factionName: faction.name, note: note, resolved: false
    };

    if (sacType === "integrity") {
      var integrityCost = integrityPer * opAmount;
      var haveI = num(_readIntegrity(pc).value, 0);
      if (haveI < integrityCost) throw new Error("Not enough Integrity (need "+integrityCost+", have "+haveI+")");
      debitMeta.integrityCost = integrityCost;
      lock.integrityCost = integrityCost;
      doDebit = function(){ return _debitIntegrity(pc, integrityCost); };
    }
    else if (sacType === "stress") {
      var stressCost = Math.max(1, num(opts.stressPerOpOverride, 2)) * opAmount;
      var haveS = num(_readStress(pc).value, 0);
      if (haveS < stressCost) throw new Error("Not enough Stress (need "+stressCost+", have "+haveS+")");
      debitMeta.stressCost = stressCost;
      lock.stressCost = stressCost;
      doDebit = function(){ return _debitStress(pc, stressCost); };
    }
    else if (sacType === "aptitude") {
      var aptKey  = String(opts.aptitudeKey || opts.skillKey || "").trim().toLowerCase();
      var rankPerOp = Math.max(1, num(opts.opPerRank, 3));
      // 1 rank yields rankPerOp OP. ceil(opAmount/rankPerOp) ranks burned.
      var ranksToBurn = Math.max(1, Math.ceil(opAmount / rankPerOp));
      if (!aptKey) throw new Error("Aptitude sacrifice requires opts.aptitudeKey (e.g. 'athletics').");
      var haveR = _readSkillRank(pc, aptKey);
      if (haveR < ranksToBurn) throw new Error("Not enough rank in "+aptKey+" (need "+ranksToBurn+", have "+haveR+")");
      debitMeta.aptitudeKey = aptKey;
      debitMeta.ranksBurned = ranksToBurn;
      lock.aptitudeKey = aptKey;
      lock.ranks = ranksToBurn;
      doDebit = function(){ return _debitAptitudeRank(pc, aptKey, ranksToBurn); };
    }
    else if (sacType === "manifestation") {
      var opPerLock = Math.max(1, num(opts.opPerLockoutTier, 4));
      var lockTiers = Math.max(1, Math.ceil(opAmount / opPerLock));
      debitMeta.lockoutTiers = lockTiers;
      lock.lockoutTiers = lockTiers;
      doDebit = async function(){
        var lockRes = await _addManifestationLockout(pc, lockTiers);
        debitMeta.lockoutTotal = lockRes.total;
      };
    }
    else {
      throw new Error("Unknown RFI sacrifice type: "+sacRaw+" (canonical: integrity, stress, aptitude, manifestation)");
    }

    // ── Phase 2: deposit marks first. Engine canon (Phase A 2026-05-09):
    // 1 OP = 10 marks. The commit result was previously IGNORED, so a refused
    // deposit (bank at cap) still burned the steward's resources — fixed 2026-07-06.
    var deltas = {}; deltas[opKey] = +(opAmount * 10);
    var commitRes = await opCommit(faction.id, deltas, "Manifestation ("+sacType+"): "+pc.name+" → +"+opAmount+" "+opLabel(opKey)+" OP");
    if (!commitRes || commitRes.committed === false || commitRes.ok === false) {
      throw new Error("Faction OP deposit refused"+((commitRes && commitRes.error) ? ": "+commitRes.error : " (bank at cap?)")+" — nothing was sacrificed.");
    }

    // ── Phase 3: debit the steward. If this somehow fails after the pre-check,
    // claw the deposit back so the books stay balanced.
    try {
      await doDebit();
    } catch (eDebit) {
      try {
        var refund = {}; refund[opKey] = -(opAmount * 10);
        await opCommit(faction.id, refund, "Refund: failed sacrifice debit for "+pc.name);
      } catch (_eRefund) { warn("refund after failed debit ALSO failed — manual GM fix needed", _eRefund); }
      throw eDebit;
    }

    await _addLock(pc, lock);

    // Native Blood Debt ledger if fourththing is loaded; else legacy fallback.
    await _recordBloodDebt(pc, bloodDebtDelta, {
      source: "manifestation",
      tag:    "Sacrifice: "+sacType,
      note:   note
    });

    // GM whisper
    try{
      var gmIds = (game.users||[]).filter(function(u){ return u && u.isGM; }).map(function(u){ return u.id; });
      if(gmIds.length){
        var line = '<div><b>Manifestation</b>: '+pc.name+' → <b>+'+opAmount+' '+opLabel(opKey)+' OP</b> for '+faction.name+'</div>';
        line += '<div class="bbttcc-muted">Sacrifice: <b>'+sacType+'</b> • Blood Debt +<b>'+bloodDebtDelta+'</b></div>';
        if(note) line += '<div class="bbttcc-muted">Note: '+foundry.utils.escapeHTML(note)+'</div>';
        await ChatMessage.create({ whisper: gmIds, speaker:{alias:"Bad Eden Bridge"}, content: line });
      }
    }catch(_e){}

    return { ok:true, opKey: opKey, opAmount: opAmount, sacrificeType: sacType, bloodDebtDelta: bloodDebtDelta, debit: debitMeta };
  }

  // Back-compat: old name still works (HP only)
  async function manifestHpToFactionOp(opts){
    opts = opts || {};
    return manifestSacrificeToFactionOp({
      pcActorId: opts.pcActorId,
      factionId: opts.factionId,
      opKey: opts.opKey,
      opAmount: opts.opAmount,
      sacrificeType: "hp",
      hpPerOpOverride: opts.hpPerOpOverride,
      note: opts.note
    });
  }

  async function spendFactionOpForRoll(opts){
    opts = opts || {};
    var faction = await resolveActorByIdOrUuid(opts.factionId);
    var actor  = game.actors.get(opts.actorId) || null;

    var opKey = String(opts.opKey||"").trim().toLowerCase();
    var spend = Math.max(0, num(opts.spend,0));
    var mode  = String(opts.mode||"flat");
    var dicePerOp = String(opts.dicePerOp||"1d6");
    var flatPerOp = num(opts.flatPerOp, 2);
    var rollKind = String(opts.rollKind||"skill");
    var rollKey  = String(opts.rollKey||"").trim().toLowerCase();

    if(!faction) throw new Error("Faction actor not found");
    if(!actor) throw new Error("Actor not found");
    if(!opKey) throw new Error("Missing OP key");
    if(spend<=0) throw new Error("Spend must be > 0");

    // Bank values are MARKS (1 OP = 10 marks). User input "spend" is OP units.
    var bank = readFactionOpBank(faction);
    var poolMarks = num(bank[opKey], 0);
    var spendMarks = Math.round(spend * 10);
    if (poolMarks < spendMarks) throw new Error("Not enough "+opLabel(opKey)+" OP (need "+spend+", have "+(poolMarks/10)+")");

    var deltas={}; deltas[opKey] = -Math.abs(spendMarks);
    var commitRes = await opCommit(faction.id, deltas, "Backing: spent "+spend+" "+opLabel(opKey)+" OP for "+actor.name);
    if (!commitRes || commitRes.committed === false || commitRes.ok === false) {
      throw new Error("Faction OP spend refused"+((commitRes && commitRes.error) ? ": "+commitRes.error : "")+" — no roll fired.");
    }

    // Fire the steward's REAL RFI roll. The old dnd5e paths (actor.rollSkill /
    // rollAbilitySave / rollAbilityTest) never existed on fourththing actors, so
    // every backing roll silently fell through to a bare 1d20 — fixed 2026-07-06.
    // skill → rank-aware aptitude check; attribute/ability/save → faculty test.
    var ftRolls = (game.fourththing && game.fourththing.rolls) ? game.fourththing.rolls : null;
    var baseRoll = null, baseTotal = 0, baseDesc = "";
    if (rollKind === "skill" && rollKey && ftRolls && typeof ftRolls.skillCheck === "function") {
      var skRes = await ftRolls.skillCheck(actor, { skill: rollKey });
      baseTotal = num(skRes && skRes.total, 0);
      baseRoll  = (skRes && skRes.roll) || null;
      baseDesc  = opLabel(rollKey) + " (Aptitude)";
    }
    else if (rollKey && ftRolls && typeof ftRolls.attributeTest === "function") {
      baseRoll  = await ftRolls.attributeTest(actor, { attribute: rollKey, label: opLabel(rollKey) + " Test" });
      baseTotal = num(baseRoll && baseRoll.total, 0);
      baseDesc  = opLabel(rollKey) + " (Faculty)";
    }
    else {
      baseRoll  = await (new Roll("2d10x10")).evaluate();
      baseTotal = num(baseRoll.total, 0);
      baseDesc  = "2d10 (exploding, untyped)";
    }
    var finalTotal = baseTotal;

    if(mode==="dice"){
      var expr = "";
      var m = /^(\d+)d(\d+)$/i.exec(String(dicePerOp||"1d6").trim());
      if(m){
        expr = (num(m[1],1)*spend)+"d"+num(m[2],6);
      } else {
        var parts=[]; for(var i=0;i<spend;i++) parts.push(String(dicePerOp));
        expr = parts.join(" + ");
      }
      var br = await (new Roll(expr)).evaluate();
      finalTotal = baseTotal + num(br.total,0);
      await ChatMessage.create({ content:
        '<div class="bbttcc-muted"><b>Faction Backing</b>: '+faction.name+' spent <b>'+spend+' '+opLabel(opKey)+' OP</b> for '+actor.name+'.</div>'+
        '<div>'+baseDesc+': <b>'+baseTotal+'</b> +<b>'+expr+'</b> = <b>'+finalTotal+'</b></div>'+
        '<div class="bbttcc-muted">Bonus dice total: <b>'+br.total+'</b></div>'
      });
      return { ok:true, baseTotal:baseTotal, finalTotal:finalTotal, mode:mode, diceExpr:expr, spend:spend, opKey:opKey, roll:baseRoll };
    }

    var bonus = flatPerOp * spend;
    finalTotal = baseTotal + bonus;
    await ChatMessage.create({ content:
      '<div class="bbttcc-muted"><b>Faction Backing</b>: '+faction.name+' spent <b>'+spend+' '+opLabel(opKey)+' OP</b> for '+actor.name+'.</div>'+
      '<div>'+baseDesc+': <b>'+baseTotal+'</b> +<b>'+bonus+'</b> = <b>'+finalTotal+'</b></div>'
    });
    return { ok:true, baseTotal:baseTotal, finalTotal:finalTotal, mode:mode, flatBonus:bonus, spend:spend, opKey:opKey, roll:baseRoll };
  }

  // ── Hover-help (2026-07-06) ──────────────────────────────────────────────
  // One dictionary; mirrored into the central registry (game.bbttcc.help,
  // appKey "bridge") at attach() so the Operator tours read the same text.
  var BRIDGE_TIPS = {
    open:        "Bad Eden Bridge — move power between a Steward and their faction: sacrifice body/mind for faction OP, or spend faction OP to back a personal roll.",
    faction:     "Faction — the OP bank on the far side of the bridge. Sacrifices deposit here; Backing spends from here. Locked to your bound faction when opened from a sheet.",
    actor:       "Steward — the body paying the price (Manifestation) or receiving the boost (Backing). The list follows the selected faction's roster when one exists.",
    mOpKey:      "OP Type — which of the nine OP tracks the faction receives. Bank math: 1 OP = 10 marks.",
    mOpQty:      "OP Qty — how many OP to generate. Every OP yielded accrues 1 Blood Debt on the steward (the narrative IOU the world collects on).",
    sacrifice:   "Sacrifice — what the steward burns: Integrity (tier-priced meat), Stress (2/OP mind), Aptitude ranks (3 OP per rank, restored at the next Soma Break), or a Manifestation tier lockout (4 OP per tier, clears at Soma Break/scene end).",
    sacIntegrity:"Integrity cost per OP scales with faction tier — T0–1: 10 · T2: 7 · T3+: 5. Debited from the Integrity track; you must have the full cost on hand.",
    stressPerOp: "Stress / OP — Stress track points burned per OP (default 2). The track floors at 0 and you need the full cost available.",
    aptKey:      "Aptitude key — the skill whose ranks burn (e.g. athletics, stealth, occult). The burn is flag-tracked and restores automatically at the next Soma Break.",
    opPerRank:   "OP / Rank — OP yielded per rank burned (default 3). Ranks burned = ceiling(OP Qty ÷ this).",
    opPerLock:   "OP / Tier-lock — OP yielded per manifestation tier locked (default 4). Lockouts stack, gate casting, and clear at Soma Break.",
    mNote:       "Note — stamped on the Blood Debt ledger entry and the GM receipt whisper.",
    manifestBtn: "Deposits the OP marks FIRST (a full bank refuses and nothing burns), then debits the resource, records a Blood Debt lock on the steward, and whispers a receipt to the GM.",
    bOpKey:      "OP Type — which faction OP track pays for the backing.",
    bSpend:      "Spend — OP drawn from the faction bank (1 OP = 10 marks). Refused if the bank is short.",
    bRollKind:   "Roll — Aptitude fires the steward's full rank-aware skill check (rerolls, floors, surge); Faculty fires a bare attribute test.",
    bRollKey:    "Key — which aptitude or faculty to roll. The list follows the selected steward and shows current values.",
    bMode:       "Mode — Flat adds +2 per OP to the roll total; Bonus Dice rolls extra dice (default 1d6 per OP) and adds them.",
    bDice:       "Dice / OP — the die granted per OP in dice mode (default 1d6).",
    backingBtn:  "Spends the OP (verified against the bank), fires the steward's real roll, and posts base + backing = total to chat."
  };
  function tipAttr(key){
    var t = BRIDGE_TIPS[key] || "";
    if(!t) return "";
    try { t = foundry.utils.escapeHTML(t); } catch(_e){}
    return ' data-tooltip="'+t+'" data-tour="bridge.'+key+'"';
  }

  function buildBridgeDialog(actor){
    var boundFactionId = actor ? boundFactionIdForActor(actor) : "";
    var lockFaction = !!boundFactionId;
    var lockActor = !!(actor && actor.type === "character");

    var factions = game.actors.contents.filter(function(a){
      try {
        if (!a) return false;
        var k = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.actorKind) ? game.bbttcc.api.actorKind(a) : null;
        if (k) return k === "faction";
        // Fallback (actorKind API absent): strict markers only — NOT mere
        // bbttcc-factions flag presence, which faction-owned rigs/stewards carry.
        if (a.type === "faction") return true;
        if (a.getFlag && a.getFlag("bbttcc-factions","isFaction")) return true;
        var tv = String((((a.system||{}).details||{}).type||{}).value || "").toLowerCase();
        return tv === "faction";
      } catch(_e){ return false; }
    });

    var factionOptions = factions.map(function(f){
      return '<option value="'+f.id+'" '+(String(f.id)===String(boundFactionId)?"selected":"")+'>'+f.name+'</option>';
    }).join("");

    var keys=["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
    var opOptions = keys.map(function(k){ return '<option value="'+k+'">'+opLabel(k)+'</option>'; }).join("");

    function rosterActorsForFaction(factionId){
      try {
        var fid = String(factionId||"").replace(/^Actor\./,"").trim();
        var fac = game.actors.get(fid) || null;
        if (!fac) return [];
        var raw = (fac.getFlag ? (fac.getFlag("bbttcc-factions","roster") || []) : []);
        var out = [];
        for (var i=0; i<raw.length; i++){
          var entry = raw[i];
          var s = (typeof entry === "string") ? entry : (entry && (entry.uuid || entry.id)) ? String(entry.uuid || entry.id) : "";
          if (!s) continue;
          var id = String(s).replace(/^Actor\./,"").trim();
          var a = game.actors.get(id) || null;
          if (a && a.type === "character") out.push(a);
        }
        return out;
      } catch(_e){ return []; }
    }

    var actors = game.actors.contents.filter(function(a){
      if (!a) return false;
      var k = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.actorKind) ? game.bbttcc.api.actorKind(a) : null;
      return k ? k === "steward" : a.type==="character";
    });
    var actorOptions = actors.map(function(a){
      return '<option value="'+a.id+'" '+(actor && a.id===actor.id ? "selected":"")+'>'+a.name+'</option>';
    }).join("");

    var html =
      '<div class="bbttcc-choice-roll-dialog" style="min-width:560px;">'+
      ' <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:10px;">'+
      '  <div style="flex:1; min-width:240px;"'+tipAttr("faction")+'><label><b>Faction</b></label><select name="factionId" style="width:100%;" ' + (lockFaction ? 'disabled' : '') + '>'+factionOptions+'</select></div>'+
      '  <div style="flex:1; min-width:240px;"'+tipAttr("actor")+'><label><b>PC / Actor</b></label><select name="actorId" style="width:100%;" ' + (lockActor ? 'disabled' : '') + '>'+actorOptions+'</select></div>'+
      ' </div>'+

      ' <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">'+

      '  <div style="border:1px solid rgba(148,163,184,0.25); border-radius:12px; padding:12px; background: rgba(15,23,42,0.35);">'+
      '   <div style="font-weight:800; letter-spacing:.08em; text-transform:uppercase; font-size:11px; margin-bottom:8px;">Manifestation</div>'+

      '   <div style="display:flex; gap:8px; align-items:flex-end;">'+
      '    <div style="flex:1;"'+tipAttr("mOpKey")+'><label>OP Type</label><select name="m_opKey" style="width:100%;">'+opOptions+'</select></div>'+
      '    <div style="width:120px;"'+tipAttr("mOpQty")+'><label>OP Qty</label><input name="m_amount" type="number" min="1" step="1" value="1" style="width:100%;"/></div>'+
      '   </div>'+

      '   <div style="display:flex; gap:8px; align-items:flex-end; margin-top:8px;">'+
      '    <div style="flex:1;"'+tipAttr("sacrifice")+'><label>Sacrifice</label>'+
      '      <select name="m_sacType" style="width:100%;">'+
      '        <option value="integrity">Integrity</option>'+
      '        <option value="stress">Stress</option>'+
      '        <option value="aptitude">Aptitude Rank Burn</option>'+
      '        <option value="manifestation">Manifestation Lockout</option>'+
      '      </select>'+
      '    </div>'+
      '    <div style="width:140px;"'+tipAttr("mNote")+'><label>Note (optional)</label><input name="m_note" type="text" value="" style="width:100%;"/></div>'+
      '   </div>'+

      '   <div data-sac-panel="integrity" style="margin-top:8px;"'+tipAttr("sacIntegrity")+'>'+
      '     <div class="bbttcc-muted">Integrity cost per OP scales by faction tier (T0–1: 10 · T2: 7 · T3+: 5). Integrity is debited and Blood Debt accrues.</div>'+
      '   </div>'+

      '   <div data-sac-panel="stress" style="margin-top:8px; display:none;">'+
      '     <div style="display:flex; gap:8px; align-items:flex-end;">'+
      '       <div style="width:140px;"'+tipAttr("stressPerOp")+'><label>Stress / OP</label><input name="m_stressPerOp" type="number" min="1" step="1" value="2" style="width:100%;"/></div>'+
      '     </div>'+
      '     <div class="bbttcc-muted">Default: 2 Stress = 1 OP. The steward\'s Stress track depletes by this amount.</div>'+
      '   </div>'+

      '   <div data-sac-panel="aptitude" style="margin-top:8px; display:none;">'+
      '     <div style="display:flex; gap:8px; align-items:flex-end;">'+
      '       <div style="flex:1;"'+tipAttr("aptKey")+'><label>Aptitude key</label><input name="m_aptKey" type="text" value="" placeholder="e.g. athletics, stealth, occult" style="width:100%;"/></div>'+
      '       <div style="width:140px;"'+tipAttr("opPerRank")+'><label>OP / Rank</label><input name="m_opPerRank" type="number" min="1" step="1" value="3" style="width:100%;"/></div>'+
      '     </div>'+
      '     <div class="bbttcc-muted">Default: 1 rank burned = 3 OP. Burned ranks restore at the next Soma Break (flag-tracked).</div>'+
      '   </div>'+

      '   <div data-sac-panel="manifestation" style="margin-top:8px; display:none;">'+
      '     <div style="display:flex; gap:8px; align-items:flex-end;">'+
      '       <div style="width:140px;"'+tipAttr("opPerLock")+'><label>OP / Tier-lock</label><input name="m_opPerLock" type="number" min="1" step="1" value="4" style="width:100%;"/></div>'+
      '     </div>'+
      '     <div class="bbttcc-muted">Default: 1 manifestation tier locked (this scene) = 4 OP. Lockout flag clears at scene end / Soma Break.</div>'+
      '   </div>'+

      '   <div style="margin-top:10px;">'+
      '     <button type="button" class="bbttcc-sacrifice-btn" data-action="manifest"'+tipAttr("manifestBtn")+' style="border-color: rgba(244,63,94,0.55); background: rgba(244,63,94,0.10); color:#ffd6de;">Sacrifice & Grant OP</button>'+
      '     <div class="bbttcc-muted" style="margin-top:6px;">Debits the selected resource, grants faction OP, and records a Blood Debt lock.</div>'+
      '   </div>'+
      '  </div>'+

      '  <div style="border:1px solid rgba(148,163,184,0.25); border-radius:12px; padding:12px; background: rgba(15,23,42,0.35);">'+
      '   <div style="font-weight:800; letter-spacing:.08em; text-transform:uppercase; font-size:11px; margin-bottom:8px;">Backing</div>'+
      '   <div style="display:flex; gap:8px; align-items:flex-end;">'+
      '    <div style="flex:1;"'+tipAttr("bOpKey")+'><label>OP Type</label><select name="b_opKey" style="width:100%;">'+opOptions+'</select></div>'+
      '    <div style="width:120px;"'+tipAttr("bSpend")+'><label>Spend</label><input name="b_spend" type="number" min="1" step="1" value="1" style="width:100%;"/></div>'+
      '   </div>'+
      '   <div style="display:flex; gap:8px; align-items:flex-end; margin-top:8px;">'+
      '    <div style="flex:1;"'+tipAttr("bRollKind")+'><label>Roll</label><select name="b_kind" style="width:100%;">'+
      '      <option value="skill">Aptitude</option><option value="attribute">Faculty</option>'+
      '    </select></div>'+
      '    <div style="flex:1;"'+tipAttr("bRollKey")+'><label>Key</label><select name="b_key" style="width:100%;"><option value="">—</option></select></div>'+
      '   </div>'+
      '   <div style="display:flex; gap:8px; align-items:flex-end; margin-top:8px;">'+
      '    <div style="flex:1;"'+tipAttr("bMode")+'><label>Mode</label><select name="b_mode" style="width:100%;">'+
      '      <option value="flat">Flat Bonus (+2 / OP)</option><option value="dice">Bonus Dice (+1d6 / OP)</option>'+
      '    </select></div>'+
      '    <div style="width:140px;"'+tipAttr("bDice")+'><label>Dice / OP</label><input name="b_dice" type="text" value="1d6" style="width:100%;"/></div>'+
      '   </div>'+
      '   <div style="margin-top:10px;">'+
      '    <button type="button" class="bbttcc-sacrifice-btn" data-action="backing"'+tipAttr("backingBtn")+' style="border-color: rgba(56,189,248,0.55); background: rgba(56,189,248,0.10); color:#d6f3ff;">Spend OP & Roll</button>'+
      '    <div class="bbttcc-muted" style="margin-top:6px;">Rolls, applies backing, posts the combined total to chat.</div>'+
      '   </div>'+
      '  </div>'+

      ' </div>'+
      '</div>';

    var dlg = new Dialog({
      title: "Bad Eden — Manifestation Bridge",
      content: html,
      buttons: { close: { label: "Close" } },
      default: "close",
      render: function(html){
        try { dlg.setPosition({ width: 760, height: "auto" }); } catch(_e){}
        var root = html;

        function populateActorsFromFaction(){
          try{
            if (lockActor) return;
            var factionId = root.find("select[name='factionId']").val();
            var list = rosterActorsForFaction(factionId);
            if (!list.length) {
              list = game.actors.contents.filter(function(a){ return a && a.type==="character"; });
            }
            var sel = root.find("select[name='actorId']");
            if (!sel.length) return;
            var cur = sel.val() || "";
            var opts = list.map(function(a){
              return '<option value="'+a.id+'" '+(String(a.id)===String(cur)?"selected":"")+'>'+a.name+'</option>';
            }).join("");
            sel.html(opts);
          }catch(_e){}
        }

        function showSacPanel(kind){
          try{
            root.find("[data-sac-panel]").hide();
            root.find('[data-sac-panel="'+kind+'"]').show();
          }catch(_e){}
        }

        // Backing "Key" select follows the chosen steward: aptitudes (skills) or
        // faculties (attributes) with current values, instead of a free-text
        // guess at internal keys (2026-07-06).
        function populateRollKeys(){
          try{
            var aid = (lockActor && actor) ? actor.id : root.find("select[name='actorId']").val();
            var a = game.actors.get(String(aid||"")) || (lockActor ? actor : null);
            var sys = a ? ((a.system && a.system.system) ? a.system.system : a.system) : null;
            var kind = String(root.find("select[name='b_kind']").val()||"skill");
            var sel = root.find("select[name='b_key']");
            if (!sel.length) return;
            var cur = sel.val() || "";
            var src = (kind === "skill") ? ((sys && sys.skills) || {}) : ((sys && sys.attributes) || {});
            var opts = Object.keys(src).map(function(k){
              var e = src[k] || {};
              var lbl = e.label ? String(e.label) : opLabel(k);
              return '<option value="'+k+'" '+(k===cur?"selected":"")+'>'+lbl+' ('+num(e.value,0)+')</option>';
            }).join("");
            sel.html(opts || '<option value="">—</option>');
          }catch(_e){}
        }

        setTimeout(function(){
          try{
            populateActorsFromFaction();
            populateRollKeys();
            root.off("change.bbttccBridgeFaction", "select[name='factionId']");
            root.on("change.bbttccBridgeFaction", "select[name='factionId']", function(){ populateActorsFromFaction(); populateRollKeys(); });

            root.off("change.bbttccBridgeActor", "select[name='actorId']");
            root.on("change.bbttccBridgeActor", "select[name='actorId']", function(){ populateRollKeys(); });

            root.off("change.bbttccBridgeKind", "select[name='b_kind']");
            root.on("change.bbttccBridgeKind", "select[name='b_kind']", function(){ populateRollKeys(); });

            root.off("change.bbttccBridgeSac", "select[name='m_sacType']");
            root.on("change.bbttccBridgeSac", "select[name='m_sacType']", function(){
              var k = String(root.find("select[name='m_sacType']").val()||"integrity");
              showSacPanel(k);
            });

            showSacPanel(String(root.find("select[name='m_sacType']").val()||"integrity"));
          }catch(_e){}
        }, 0);

        root.on("click", "[data-action='manifest']", async function(ev){
          ev.preventDefault(); ev.stopPropagation();
          try{
            var factionId = root.find("select[name='factionId']").val();
            var actorId  = root.find("select[name='actorId']").val();
            var opKey    = root.find("select[name='m_opKey']").val();
            var amount   = num(root.find("input[name='m_amount']").val(), 1);
            var sacType  = String(root.find("select[name='m_sacType']").val() || "integrity");
            var note     = String(root.find("input[name='m_note']").val() || "");

            var stressPerOp = num(root.find("input[name='m_stressPerOp']").val(), 2);
            var aptKey      = String(root.find("input[name='m_aptKey']").val() || "").trim();
            var opPerRank   = num(root.find("input[name='m_opPerRank']").val(), 3);
            var opPerLock   = num(root.find("input[name='m_opPerLock']").val(), 4);

            await manifestSacrificeToFactionOp({
              pcActorId: actorId,
              factionId: factionId,
              opKey: opKey,
              opAmount: amount,
              sacrificeType: sacType,
              stressPerOpOverride: stressPerOp,
              aptitudeKey: aptKey,
              opPerRank: opPerRank,
              opPerLockoutTier: opPerLock,
              note: note
            });

            try { ui.notifications.info("Sacrifice accepted. OP granted."); } catch(_eN){}
          }catch(e){
            warn(e);
            try { ui.notifications.warn(String(e.message||e)); } catch(_e2){}
          }
        });

        root.on("click", "[data-action='backing']", async function(ev){
          ev.preventDefault(); ev.stopPropagation();
          try{
            var factionId = root.find("select[name='factionId']").val();
            var actorId  = root.find("select[name='actorId']").val();
            var opKey    = root.find("select[name='b_opKey']").val();
            var spend    = num(root.find("input[name='b_spend']").val(), 1);
            var kind     = String(root.find("select[name='b_kind']").val() || "skill");
            var key      = String(root.find("input[name='b_key']").val() || "").trim().toLowerCase();
            var mode     = String(root.find("select[name='b_mode']").val() || "flat");
            var dice     = String(root.find("input[name='b_dice']").val() || "1d6");

            await spendFactionOpForRoll({
              factionId: factionId,
              opKey: opKey,
              spend: spend,
              mode: mode,
              dicePerOp: dice,
              flatPerOp: 2,
              rollKind: kind,
              rollKey: key,
              actorId: actorId
            });
          }catch(e){
            warn(e);
            try { ui.notifications.warn(String(e.message||e)); } catch(_e2){}
          }
        });
      }
    }, { resizable: true });

    return dlg;
  }

  function openBridgeForActor(actor){
    try{
      if(actor && actor.getFlag){
        var bm = actor.getFlag(FLAG_SCOPE, "bloodDebtModel");
        if(bm && typeof bm === "object") _syncCanonicalFromBridge(actor, bm);
      }
    }catch(_e){}
    buildBridgeDialog(actor).render(true);
  }

  function injectHeaderButtonViaHook(app, html, data){
    try{
      if(!app || !app.object) return;
      var actor = app.object;
      if(actor.type !== "character" && actor.type !== "faction" && !((actor.flags||{})["bbttcc-factions"])) return;

      var header = html.closest(".window-app").find(".window-header");
      if(!header.length) return;
      if(header.find(".bbttcc-bridge-btn").length) return;

      var btn = $('<a class="bbttcc-bridge-btn" style="margin-left:6px;" title="Bad Eden Bridge"><i class="fas fa-exchange-alt"></i> Bridge</a>');
      btn.on("click", function(ev){ ev.preventDefault(); ev.stopPropagation(); openBridgeForActor(actor); });
      header.find(".window-title").after(btn);
    }catch(e){ warn("fallback inject failed", e); }
  }

  function attach(){
    if(!game.bbttcc) game.bbttcc = {};
    if(!game.bbttcc.api) game.bbttcc.api = {};
    if(!game.bbttcc.api.bridge) game.bbttcc.api.bridge = {};

    game.bbttcc.api.bridge.open = function(actorIdOrUuid){
      if(actorIdOrUuid){
        resolveActorByIdOrUuid(actorIdOrUuid).then(function(a){ openBridgeForActor(a); });
        return;
      }
      openBridgeForActor(null);
    };
    game.bbttcc.api.bridge.manifest = manifestSacrificeToFactionOp;
    game.bbttcc.api.bridge.manifestHp = manifestHpToFactionOp;
    game.bbttcc.api.bridge.backing = spendFactionOpForRoll;


// Canonical Blood Debt reset → wipe Bridge locks (GM manual resolution)
try{
  Hooks.on("updateActor", function(actor, changed){
    try{
      if(!actor) return;
      // only PCs/NPCs
      var t = String(actor.type||"");
      if(t !== "character" && t !== "npc") return;

      // Detect canonical blood debt touched
      var touched = false;
      try {
        if (changed && changed.flags && changed.flags.bbttcc) {
          if (changed.flags.bbttcc.bloodDebt != null) touched = true;
          var id = changed.flags.bbttcc.identity;
          if (id && id.bloodDebt != null) touched = true;
        }
      } catch(_eT) {}

      if(!touched) return;

      // Read current canonical value from actor post-update
      var canon = _readCanonicalBloodDebt(actor);
      var v = num(canon.value, 0);

      if(v === 0){
        // If bridge state exists, clear it
        var hasBridge = false;
        try {
          hasBridge = (actor.getFlag && (actor.getFlag(FLAG_SCOPE, "bloodDebtModel") || actor.getFlag(FLAG_SCOPE, "bloodDebt") != null));
        } catch(_eHB) {}
        if(hasBridge) _clearBridgeDebtAndLocks(actor);
      }
    }catch(_e){}
  });
}catch(_e){}

    // Header button injection (preferred hook)
    try{
      Hooks.on("getActorSheetHeaderButtons", function(app, buttons){
        try{
          var actor = app && app.object ? app.object : null;
          if(!actor) return;
          if(actor.type !== "character" && actor.type !== "faction" && !((actor.flags||{})["bbttcc-factions"])) return;
          buttons.unshift({
            label: "Bridge",
            class: "bbttcc-bridge-btn",
            icon: "fas fa-exchange-alt",
            onclick: function(){ openBridgeForActor(actor); }
          });
        }catch(_e){}
      });
    }catch(_eH){}

    // Fallback render hook (covers sheets where header buttons aren't honored)
    try{
      Hooks.on("renderActorSheet", injectHeaderButtonViaHook);
    }catch(_eR){}

    // AppV2 sheets — the two V1 hooks above NEVER fire for ActorSheetV2, so the
    // Bridge was unreachable from the fourththing Steward sheet (only the V1
    // faction sheet had the button). Fixed 2026-07-06.
    try{
      var injectV2 = function(app){
        try{
          var actorV2 = app && (app.actor || app.document);
          if(!actorV2 || actorV2.documentName!=="Actor") return;
          if(actorV2.type !== "character" && !((actorV2.flags||{})["bbttcc-factions"])) return;
          var el = (app.element instanceof HTMLElement) ? app.element : (app.element && app.element[0]);
          if(!el) return;
          var header = el.querySelector(".window-header");
          if(!header || header.querySelector(".bbttcc-bridge-btn")) return;
          var btn = document.createElement("a");
          btn.className = "bbttcc-bridge-btn";
          btn.style.cssText = "margin-left:6px; flex:0 0 auto; display:inline-flex; align-items:center; gap:4px; cursor:pointer;";
          try { btn.dataset.tooltip = BRIDGE_TIPS.open; } catch(_eT){}
          btn.innerHTML = '<i class="fas fa-exchange-alt"></i> Bridge';
          btn.addEventListener("click", function(ev){ ev.preventDefault(); ev.stopPropagation(); openBridgeForActor(actorV2); });
          var titleEl = header.querySelector(".window-title");
          if(titleEl && titleEl.after) titleEl.after(btn); else header.appendChild(btn);
        }catch(_e){}
      };
      Hooks.on("renderFourthThingCharacterSheet", injectV2);
    }catch(_eV2){}

    // Central hover-help registry (bbttcc-help.js loads first in this module) —
    // same text the Operator tours will step through.
    try{
      if(game.bbttcc.help && typeof game.bbttcc.help.register === "function"){
        game.bbttcc.help.register("bridge", BRIDGE_TIPS);
      }
    }catch(_eHelp){}

    warn("ready — api mounted at game.bbttcc.api.bridge (open/manifest/manifestHp/backing)");
  }

  Hooks.once("ready", attach);
})();
