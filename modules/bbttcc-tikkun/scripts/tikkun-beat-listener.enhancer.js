/* bbttcc-tikkun/scripts/tikkun-beat-listener.enhancer.js
 *
 * Phase B of B3 (project_tikkun_revisit_plan_2026_05_09.md).
 *
 * Subscribes to `bbttcc:beat:resolved` (fired from bbttcc-campaign's
 * executeBeat as of 2026-05-09 / Phase A.4) and routes beats with a
 * `beat.sparkLink` payload into the spark API. Authors no longer need to
 * write console calls — they declare the spark transition on the beat itself.
 *
 *   beat.sparkLink = {
 *     sparkUuid?: "Compendium.bbttcc-tikkun.sparks.Item.<id>",
 *     sparkKey?:  "spark_chesed_conceptual",   // alt: bbttcc-tikkun.identifier
 *     action:     "identify" | "acquire" | "integrate" | "deposit",
 *     actorId?:   "<actorId>",                 // overrides ctx.actorId
 *     methodTag?: "violence" | "diplomacy" | ... // for Phase C corruption
 *   }
 *
 * Phase C will read methodTag and consult the spark item's alignedMethods /
 * misalignedMethods to flag corruption automatically. For Phase B the
 * methodTag is captured into the spark history but does not alter status.
 *
 * Phase E will implement the "deposit" action (char→faction bridge). For
 * Phase B it's a stub that logs.
 */

console.log("[bbttcc-tikkun/beat-listener] LOADED");

(() => {
  const TAG = "[bbttcc-tikkun/beat-listener]";

  // Phase C of B3 — Sephirah-aware corruption flavor. Keyed by sephirah; the
  // narration weaves a one-sentence consequence so misalignment lands as
  // story, not just a flag flip. Dual-purpose: shown in chat + stamped into
  // the spark's history note for later retrieval.
  const CORRUPTION_FLAVOR = {
    keter:   "Unity fractures back into self — the spark is whole, but its crown is bowed.",
    chokmah: "Wisdom mistaken for cleverness — the spark hums off-key, an insight too quickly seized.",
    binah:   "Boundary violated to be reached — the spark contains its lesson, but the lesson is now bitter.",
    chesed:  "Mercy curdles into bitterness — the bond is taut, suspicious, easier to break than to give.",
    gevurah: "Severity gone soft on its own edge — the spark's discipline weeps where it should burn.",
    tiferet: "Harmony forced rather than found — the spark balances, but on a fulcrum of resentment.",
    netzach: "Endurance bought as a shortcut — the spark holds, but it remembers the corner cut.",
    hod:     "Glory bled to volume — the spark speaks, but it speaks too loudly to hear itself.",
    yesod:   "Foundation laid in haste — the spark dreams, but the dreams come threaded with nightmare.",
    malkuth: "Kingdom established by occupation — the spark grounds itself in soil that resents the stake."
  };

  // Returns the bbttcc.api.tikkun.checkMethodAlignment result with a graceful
  // null-API fallback so beat resolution never crashes when the API isn't
  // installed yet (rare race during world boot).
  function _alignmentOrNeutral(methodTag, sparkItem) {
    try {
      const fn = game.bbttcc?.api?.tikkun?.checkMethodAlignment;
      if (typeof fn !== "function") return "neutral";
      return fn(methodTag, sparkItem);
    } catch (e) { return "neutral"; }
  }

  function _flavorFor(sparkItem) {
    const seph = String(sparkItem?.system?.sephirah ?? "").toLowerCase();
    return CORRUPTION_FLAVOR[seph] || "The spark is gathered, but its alignment with its own domain is shaken.";
  }

  // Pull a spark identifier off the beat payload. Both shapes accepted.
  function _sparkRefFromLink(link) {
    if (!link) return null;
    return link.sparkUuid || link.sparkKey || null;
  }

  // Resolve which character actor this spark transition lands on. Priority:
  //   1. beat.sparkLink.actorId (explicit author override)
  //   2. ctx.actorId
  //   3. ctx.actor (object form)
  //   4. ctx.actorUuid (string form)
  //   5. linked-PC fallback if exactly one user has a character with the
  //      spark already (otherwise GM-prompt the choice).
  // Returns the actor or null. Caller decides whether to prompt or skip.
  async function _resolveBeatActor(link, ctx) {
    const tryId = (id) => {
      if (!id) return null;
      const a = game.actors?.get(String(id).replace(/^Actor\./, ""));
      return a && a.type === "character" ? a : null;
    };
    let actor = tryId(link?.actorId) || tryId(ctx?.actorId);
    if (actor) return actor;
    if (ctx?.actor instanceof Actor && ctx.actor.type === "character") return ctx.actor;
    if (ctx?.actorUuid) {
      try {
        const fromUuidActor = await fromUuid(ctx.actorUuid);
        if (fromUuidActor instanceof Actor && fromUuidActor.type === "character") return fromUuidActor;
      } catch (_e) { /* ignore */ }
    }
    return null;
  }

  // GM-prompt fallback: pick a character actor from the world. Only fires
  // when the beat's sparkLink resolves no actor automatically. Returns
  // actor or null (cancelled).
  async function _promptForActor(link, beatLabel) {
    const _isSteward = (a) => { const k = game.bbttcc?.api?.actorKind?.(a); return k ? k === "steward" : a?.type === "character"; };
    const candidates = game.actors?.filter(a => _isSteward(a) && a.hasPlayerOwner) ?? [];
    if (!candidates.length) return null;
    return new Promise((resolve) => {
      const opts = candidates.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
      new Dialog({
        title: `Spark beat: pick target operative`,
        content: `<p style="margin:0.4rem 0">Beat <b>${beatLabel ?? "(beat)"}</b> wants to advance a spark, but no actor was provided in context. Pick the operative this beat applies to:</p>
                  <p><select name="actorId" style="width:100%">${opts}</select></p>
                  <p style="font-size:0.78rem;opacity:0.7;margin:0.3rem 0">Tip: set <code>ctx.actorId</code> when calling <code>runBeat</code> to skip this prompt.</p>`,
        buttons: {
          ok:     { label: "Apply", callback: (html) => resolve(game.actors.get(html.find("[name='actorId']").val())) },
          cancel: { label: "Skip",  callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }).render(true);
    });
  }

  Hooks.on("bbttcc:beat:resolved", async ({ campaign, beat, ctx, outcome }) => {
    const link = beat?.sparkLink;
    if (!link) return;
    const action = String(link.action || "").toLowerCase();
    if (!action) return;

    const sparkRef = _sparkRefFromLink(link);
    if (!sparkRef) {
      console.warn(TAG, "beat.sparkLink missing sparkUuid/sparkKey", { campaign: campaign?.id, beat: beat?.id });
      return;
    }

    // Only the GM should mutate spark state — beats fire on every client and
    // we don't want N writes for N players.
    if (!game.user?.isGM) return;

    let actor = await _resolveBeatActor(link, ctx);
    if (!actor) {
      actor = await _promptForActor(link, beat?.label || beat?.id);
      if (!actor) {
        console.log(TAG, "no actor resolved; skipping spark transition", { beat: beat?.id, action });
        return;
      }
    }

    const api = game.bbttcc?.api?.tikkun;
    if (!api) {
      console.warn(TAG, "tikkun API not installed");
      return;
    }

    // Resolve spark item once so we have its identifier + metadata.
    let sparkItem = null;
    try {
      if (typeof api.resolveSparkItem === "function") {
        sparkItem = await api.resolveSparkItem(sparkRef);
      }
    } catch (e) { /* fall through; some actions don't need the item */ }

    const sparkKey = sparkItem?.flags?.["bbttcc-tikkun"]?.identifier
                  || link.sparkKey
                  || sparkRef;
    const methodTag = link.methodTag || ctx?.methodTag || null;

    // Phase C — alignment check determines whether this gather/integrate
    // produces a clean spark or a Corrupted one. Identify is method-agnostic
    // (research/lore step — alignment doesn't apply). Deposit is also
    // method-agnostic (handover, not extraction). Acquire and Integrate ARE
    // the moment of contact, so corruption can land here.
    const alignment = (action === "acquire" || action === "gather" || action === "integrate")
      ? _alignmentOrNeutral(methodTag, sparkItem)
      : "neutral";
    const corrupted = alignment === "misaligned";
    const flavor = corrupted ? _flavorFor(sparkItem) : null;

    const note = `Beat: ${campaign?.label ?? campaign?.id ?? "campaign"} → ${beat?.label ?? beat?.id ?? "beat"}${methodTag ? ` (method: ${methodTag}, ${alignment})` : ""}`;
    const corruptionReason = corrupted
      ? `Misaligned method "${methodTag}" on ${sparkItem?.system?.sephirah ?? "(unknown)"} spark`
      : null;

    try {
      switch (action) {
        case "identify": {
          await api.identifySpark({ actorId: actor.id, sparkKey, note });
          break;
        }
        case "acquire":
        case "gather": {
          // Prefer item-driven gather (carries metadata into the flag entry).
          if (sparkItem && typeof api.gatherSparkByItem === "function") {
            await api.gatherSparkByItem(actor, sparkItem.uuid, { note, corrupted, corruptionReason });
          } else {
            await api.acquireSpark({ actorId: actor.id, sparkKey, note });
            // Best-effort post-mark for legacy gather path
            if (corrupted && typeof api.markSparkPhase === "function") {
              try { await api.markSparkPhase({ actorId: actor.id, sparkKey, phase: "corrupted", note: corruptionReason }); } catch (_e) {}
            }
          }
          break;
        }
        case "integrate": {
          await api.integrateSparkCharacter({ actorId: actor.id, sparkKey, note });
          // Mark corrupted AFTER integrate so the integration phase still records,
          // but the flag is set for any downstream "is corrupted?" check.
          if (corrupted && typeof api.markSparkPhase === "function") {
            try { await api.markSparkPhase({ actorId: actor.id, sparkKey, phase: "corrupted", note: corruptionReason }); } catch (_e) {}
          }
          break;
        }
        case "deposit": {
          // Phase E — handover. Validates integrated && !corrupted &&
          // !deposited inside depositSpark; throws with a useful message
          // otherwise. Faction is resolved from the actor's flag.
          if (typeof api.depositSpark !== "function") {
            console.warn(TAG, "depositSpark not installed (Phase E missing?)");
            break;
          }
          await api.depositSpark({ actorId: actor.id, sparkKey, note });
          break;
        }
        default:
          console.warn(TAG, `unknown sparkLink.action: ${action}`, { beat: beat?.id });
          return;
      }
    } catch (e) {
      console.error(TAG, "spark transition failed", { beat: beat?.id, action, sparkKey, error: e });
      ui.notifications?.error?.(`Spark beat failed: ${e.message}`);
      return;
    }

    // Success notification + audit log
    const sephKey   = sparkItem?.system?.sephirah ?? "";
    const sephLabel = sephKey
      ? (game.fourththing?.constants?.SEPHIROTH?.[sephKey]?.label ?? sephKey)
      : "";
    const sephSeg = sephLabel ? ` · ${sephLabel}` : "";
    const corruptedSeg = corrupted ? " · ⚠ Corrupted" : "";
    ui.notifications?.info?.(`${actor.name}: ${action} → ${sparkItem?.name ?? sparkKey}${sephSeg}${corruptedSeg}`);
    console.log(TAG, "spark transition applied", { actor: actor.name, action, sparkKey, methodTag, alignment, corrupted });

    // Phase C narration — chat card explaining what happened. Two flavors:
    // a clean gather/integrate gets a short positive note; a corrupted one
    // gets the sephirah-aware consequence line. Identify/deposit don't
    // narrate here (identify is just lore, deposit is Phase E).
    if (action === "acquire" || action === "gather" || action === "integrate") {
      const verbPast = action === "integrate" ? "integrated" : "gathered";
      const headerColor = corrupted ? "#c03030" : "#6fcf97";
      const headerIcon  = corrupted ? "⚠" : "✦";
      const headerText  = corrupted
        ? `${headerIcon} Spark Corrupted: ${sparkItem?.name ?? sparkKey}`
        : `${headerIcon} Spark ${verbPast}: ${sparkItem?.name ?? sparkKey}`;
      const methodLine  = methodTag
        ? `<p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85">Method: <b>${methodTag}</b> · Alignment: <b style="color:${corrupted ? "#c03030" : (alignment === "aligned" ? "#6fcf97" : "#888")}">${alignment}</b></p>`
        : "";
      const flavorLine  = corrupted
        ? `<p style="margin:0.3rem 0 0;font-size:0.82rem;font-style:italic;border-left:2px solid #c03030;padding-left:0.5rem">${flavor}</p>`
        : "";
      const repairHint  = corrupted
        ? `<p style="margin:0.4rem 0 0;font-size:0.74rem;opacity:0.65">Repair (Phase D): ${sparkItem?.system?.repair?.materialAmount ?? 1}× ${sparkItem?.system?.repair?.materialKey ?? "—"} + ${sparkItem?.system?.repair?.opCost?.amount ?? 0} ${sparkItem?.system?.repair?.opCost?.pool ?? "—"} OP, ritual DC ${sparkItem?.system?.repair?.ritualDC ?? 15}.</p>`
        : "";
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker?.({ actor }) ?? {},
        content: `<div class="fourththing-roll">
          <div class="ft-roll-header"><span class="ft-roll-name" style="color:${headerColor}">${headerText}</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem">${actor.name} ${verbPast} the ${sparkItem?.name ?? sparkKey}${sephLabel ? ` of <b>${sephLabel}</b>` : ""}.</p>
          ${methodLine}${flavorLine}${repairHint}
        </div>`
      });
    }

    // Fire downstream hook for any module that wants to react (dark
    // fragments, narrative state, audio cues, etc.). Errors isolated.
    if (corrupted) {
      try {
        Hooks.callAll("bbttcc:spark:corrupted", {
          actor, sparkItem, sparkKey, methodTag,
          sephirah: sparkItem?.system?.sephirah ?? null,
          campaign, beat
        });
      } catch (e) { console.warn(TAG, "bbttcc:spark:corrupted listeners failed:", e); }
    }
  });
})();
