/* audit-persona-coverage.macro.js — WHO'S ARMED FOR CONVERSATION? (2026-08-27)
 * READ-ONLY. Run as GM in the live world console.
 *
 * The persona layer (🧠 editor, flags["bbttcc-mal-voice"].persona) is the
 * conversation⇄mechanics bridge: knowledge topics, private GM truth,
 * extractable secrets (courtly leverage), and the court door. This audit maps
 * coverage across the cast and ranks the gaps by STORY WEIGHT so the
 * persona-arming pass starts where it pays most.
 *
 * Story weight per NPC = 3×(beats that SPEAK through them: speakerActorId)
 *                      + 1×(beats that reference them in actors[])
 *                      + 2 if placed on any scene + 1 if they belong to a faction.
 *
 * Buckets: 🔴 story NPCs with NO persona · 🟠 partial (missing pieces listed)
 *          💤 secrets all spent (re-arm) · 🟢 fully armed · 📇 background extras.
 * Output: console report + GM-whispered summary card. Writes NOTHING.
 */
(async () => {
  const MV = "bbttcc-mal-voice";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ── campaign linkage: speaker beats + actors[] references ─────────────────
  const speakerBeats = new Map();   // actorId → [beat labels]
  const actorRefs    = new Map();   // actorId → count
  try {
    const api = game.bbttcc?.api?.campaign;
    const all = api?.getAllCampaigns?.() || {};
    for (const [cid, rawCamp] of Object.entries(all)) {
      const beats = Array.isArray(rawCamp?.beats) ? rawCamp.beats : [];
      for (const b of beats) {
        const sid = String(b?.speakerActorId || "").trim().replace(/^Actor\./, "");
        if (sid) {
          if (!speakerBeats.has(sid)) speakerBeats.set(sid, []);
          speakerBeats.get(sid).push(b.label || b.id);
        }
        for (const a of (Array.isArray(b?.actors) ? b.actors : [])) {
          const aid = String((a && (a.id || a.actorId || a)) || "").trim().replace(/^Actor\./, "");
          if (aid) actorRefs.set(aid, (actorRefs.get(aid) || 0) + 1);
        }
      }
    }
  } catch (e) { console.warn("[persona-audit] campaign sweep failed:", e); }

  // ── scene presence ────────────────────────────────────────────────────────
  const sceneCount = new Map();     // actorId → number of scenes with a token
  for (const sc of (game.scenes?.contents || [])) {
    const seen = new Set();
    for (const t of (sc.tokens?.contents || [])) {
      const aid = t?.actorId;
      if (aid && !seen.has(aid)) { seen.add(aid); sceneCount.set(aid, (sceneCount.get(aid) || 0) + 1); }
    }
  }

  // ── faction membership (mirror of the roster resolution) ──────────────────
  const factionOf = (a) => {
    try {
      const fid = a.getFlag?.("bbttcc-factions", "factionId");
      if (fid) return game.actors.get(fid)?.name || fid;
      const sys = a?.system?.system ?? a?.system ?? {};
      if (sys?.faction?.id) return game.actors.get(String(sys.faction.id))?.name || sys.faction.name || sys.faction.id;
      const fname = a.getFlag?.("bbttcc-factions", "factionName") || sys?.faction?.name;
      return fname ? String(fname).trim() : null;
    } catch (_e) { return null; }
  };

  // ── courtly bridge present? (secrets/doors are dormant without it) ────────
  const raidApi = game.bbttcc?.api?.raid || {};
  const courtlyBridge = !!(raidApi.secrets || raidApi.courtlySecrets ||
    (game.modules.get("bbttcc-raid")?.active));

  // ── sweep the cast ────────────────────────────────────────────────────────
  const kindOf = (a) => {
    try { const k = game.bbttcc?.api?.actorKind?.(a); if (k) return k; } catch (_e) {}
    return a?.type || "unknown";
  };

  const rows = [];
  for (const a of (game.actors?.contents || [])) {
    const kind = kindOf(a);
    const spoke = speakerBeats.get(a.id) || [];
    // NPCs always audit; monsters/others only if the story speaks through them.
    if (kind !== "npc" && !spoke.length) continue;

    const p = a.getFlag(MV, "persona") || {};
    const topics = String(p.topics || "").trim();
    const notes  = String(p.notes  || "").trim();
    const door   = String(p.courtDoor || "").trim();
    const secretLines = String(p.secretsRaw || "").split(/\n+/)
      .map(l => l.trim()).filter(l => l && l.split("::").length >= 4);
    const spent = Object.keys(p.secretsUsed || {}).length;
    const armed = Math.max(0, secretLines.length - spent);
    const fac = factionOf(a);
    const scenes = sceneCount.get(a.id) || 0;
    const refs = actorRefs.get(a.id) || 0;

    const weight = spoke.length * 3 + refs + (scenes ? 2 : 0) + (fac ? 1 : 0);
    const hasAny = !!(topics || notes || secretLines.length || door);

    const missing = [];
    if (!topics) missing.push("topics");
    if (!notes) missing.push("truth");
    if (!secretLines.length) missing.push("secrets");
    if (!door) missing.push("door" + (fac ? "" : " (needs faction first)"));
    if (door && !fac) missing.push("⚠ door DORMANT (no faction)");

    rows.push({ name: a.name, id: a.id, kind, fac: fac || "—", scenes, refs,
      spoke: spoke.length, spokeLabels: spoke.slice(0, 3), weight,
      topics: !!topics, notes: !!notes, secretsAuthored: secretLines.length,
      armed, spent, door: !!door, hasAny, missing });
  }

  rows.sort((x, y) => y.weight - x.weight || x.name.localeCompare(y.name));

  const armedTier = r => r.topics && r.notes && (r.armed > 0 || r.door);
  const bNone    = rows.filter(r => r.weight > 0 && !r.hasAny);
  const bSpent   = rows.filter(r => r.hasAny && r.secretsAuthored > 0 && r.armed === 0 && r.spent > 0);
  const bPartial = rows.filter(r => r.hasAny && !armedTier(r) && !bSpent.includes(r));
  const bArmed   = rows.filter(r => armedTier(r) && !bSpent.includes(r));
  const bBg      = rows.filter(r => r.weight === 0 && !r.hasAny);

  // ── console report ────────────────────────────────────────────────────────
  const line = r =>
    `  ${String(r.weight).padStart(3)}w  ${r.name}  [${r.kind}${r.fac !== "—" ? " · " + r.fac : ""}]` +
    `  spk:${r.spoke} ref:${r.refs} scn:${r.scenes}` +
    `  | topics:${r.topics ? "✓" : "✗"} truth:${r.notes ? "✓" : "✗"} secrets:${r.armed}/${r.secretsAuthored}${r.spent ? ` (${r.spent} spent)` : ""} door:${r.door ? "✓" : "✗"}` +
    (r.missing.length ? `  → arm: ${r.missing.join(", ")}` : "") +
    (r.spokeLabels.length ? `  🗣 ${r.spokeLabels.join(" · ")}${r.spoke > 3 ? " …" : ""}` : "");

  const out = [];
  out.push(`PERSONA COVERAGE AUDIT — ${rows.length} NPCs audited (courtly bridge: ${courtlyBridge ? "LIVE" : "⚠ ABSENT — secrets/doors dormant"})`);
  out.push(`\n🔴 STORY NPCS, NO PERSONA (${bNone.length}) — highest-value arming targets, by story weight:`);
  bNone.forEach(r => out.push(line(r)));
  out.push(`\n💤 SECRETS ALL SPENT (${bSpent.length}) — re-arm (change the label or add a line):`);
  bSpent.forEach(r => out.push(line(r)));
  out.push(`\n🟠 PARTIAL (${bPartial.length}):`);
  bPartial.forEach(r => out.push(line(r)));
  out.push(`\n🟢 FULLY ARMED (${bArmed.length}):`);
  bArmed.forEach(r => out.push(line(r)));
  out.push(`\n📇 BACKGROUND, unarmed, zero story weight (${bBg.length}): ${bBg.map(r => r.name).join(", ") || "—"}`);
  console.log("[persona-audit]\n" + out.join("\n"));

  // ── GM summary card ───────────────────────────────────────────────────────
  const topGaps = bNone.slice(0, 10);
  const rowsHtml = (list, extra) => list.map(r =>
    `<tr><td style="padding:2px 6px;"><b>${esc(r.name)}</b></td>` +
    `<td style="padding:2px 6px;opacity:.8;">${r.weight}w · spk ${r.spoke} · scn ${r.scenes}</td>` +
    `<td style="padding:2px 6px;opacity:.8;">${esc(extra(r))}</td></tr>`).join("");
  const content =
    `<div style="border-left:3px solid #7a8f6b;padding:.35em .6em;">` +
    `<div style="font-variant:small-caps;letter-spacing:.04em;opacity:.7;">🧠 persona coverage audit</div>` +
    `<div style="margin:.3em 0;"><b>${rows.length}</b> NPCs · 🔴 ${bNone.length} story-weight unarmed · 🟠 ${bPartial.length} partial · 💤 ${bSpent.length} spent-out · 🟢 ${bArmed.length} armed${courtlyBridge ? "" : " · <b>⚠ courtly bridge ABSENT</b>"}</div>` +
    (topGaps.length ? `<div style="margin-top:.3em;"><b>Top arming targets:</b></div><table>${rowsHtml(topGaps, r => r.spokeLabels[0] || (r.fac !== "—" ? r.fac : ""))}</table>` : `<div>🎉 No story-weight NPC is unarmed.</div>`) +
    (bSpent.length ? `<div style="margin-top:.3em;"><b>Re-arm:</b> ${bSpent.map(r => esc(r.name)).join(", ")}</div>` : "") +
    `<div style="margin-top:.35em;opacity:.75;font-size:.85em;">Full ranked report in the console. Read-only — nothing written.</div></div>`;
  await ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Mags" } });

  ui.notifications.info(`Persona audit: ${bNone.length} story NPCs unarmed, ${bPartial.length} partial, ${bArmed.length} armed (console + GM card).`);
})();
