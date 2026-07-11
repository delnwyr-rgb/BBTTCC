/* seed-valhaulan-polish.macro.js — Valhaulan Spine polish pass (2026-07-09)
 * Report: treatment-reports-2026-07-04/khezek-valhaulan.md §B + punch list.
 *
 * WHAT IT DOES (all idempotent, all logged):
 *  1. ROUTING — Slippage Chamber choices 2-4 stop teleporting backwards into
 *     the Echo Archive (now route to slippage success/failure with a real
 *     check); choice 1's DC0 becomes DC20. Foyer diplomacy/violence successes
 *     get their missing "Move to the next room" door (crawl no longer
 *     dead-ends on two of three success lanes).
 *  2. GATES — Vault acceptance + missing_runner require {Crown Mall completed}
 *     (the Vault can't open before the fiction discovers it); vs_overture
 *     additionally requires Khezek Tor engaged (it name-drops Calder's crews).
 *  3. SPEAKERS/INVITES — Mara becomes SPEAKER on missing_runner (invite +
 *     handoff to the Vault approach); Vault AI ("Mechanism 52603") becomes
 *     SPEAKER on entry/exit/outcome beats (hybrid crawl — rooms stay menus);
 *     Kickflip Lazarus voices the Crown Mall archive (intro + terminals).
 *  4. DESCRIPTIONS — the three (no description) beats get aftermath-voiced
 *     text: vault acceptance, seal acceptance, and the shaft-face decision.
 *  5. AFTERMATH REWRITES — the four Vault emotional beats (missing_runner +
 *     3 Pip endings) per the B7 worksheet (Katie Marovich exits the tragedy).
 *  6. memoryText — Seal ×3, Anchor Reach ×2, Crown Mall ×2 carriers.
 *  7. vs_ HANDOFFS — the five "Noted.→∅" bridges get way-forward cards
 *     (muster deliberately gets none: the raid stays GM-fired).
 *  8. dialogueOffer:false on routing/bookkeeping beats; STATUE HOOKS ×5.
 *
 * Speakers resolve BY NAME at runtime — mint Mechanism 52603 / Kickflip /
 * Pip and re-run to wire them (Mara + Drax exist). DRY_RUN default true;
 * backs up the campaigns setting before writing. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const MARK = "[VS-POLISH-2026-07-09]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const mara = findActor(["Mara Quickhands", "Mara"]);
  const vaultAI = findActor(["Mechanism 52603", "Maneuver Vault Infiltration Mechanism 52603", "Infiltration Mechanism 52603", "The Maneuver Vault", "Vault AI"]);
  const kickflip = findActor(["Kickflip Lazarus", "Kickflip"]);
  const drax = findActor(["Drax Calder", "Drax Caulder", "Foreman Calder"]);

  const Q_CROWN_MALL = "quest_7V8Shz2S0EtDaHSS";
  const Q_KT_HUB = "quest_LJAmlim7oUtlMPiC";

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;
  const B = (id) => { const b = byId.get(id); if (!b) report.push(`✗ MISSING BEAT ${id}`); return b; };

  report.push(mara ? `👤 Mara → "${mara.name}"` : "⚠ Mara NOT FOUND");
  report.push(vaultAI ? `👤 Vault AI → "${vaultAI.name}"` : "⚠ Vault AI NOT FOUND (mint 'Mechanism 52603' + re-run)");
  report.push(kickflip ? `👤 Kickflip → "${kickflip.name}"` : "⚠ Kickflip Lazarus NOT FOUND (mint + re-run)");
  report.push(drax ? `👤 Drax → "${drax.name}"` : "⚠ Drax Calder NOT FOUND");

  // ── 1. ROUTING ────────────────────────────────────────────────────────────
  {
    const b = B("maneuver_vault_slippage_chamber");
    if (b) for (const c of (b.choices || [])) {
      const L = String(c.label || "");
      if (/Survival\/Logistics|Arcana\/Religion|^Performance/.test(L)) {
        if (c.next !== "maneuver_vault_slippage_chamber_success" || !c.failNext) {
          c.next = "maneuver_vault_slippage_chamber_success";
          c.checkStat = c.checkStat || "gm";
          c.checkDC = 20;
          c.failNext = "maneuver_vault_slippage_chamber_failure";
          changes++; report.push(`🔀 slippage route fixed: "${L.slice(0, 28)}"`);
        } else report.push(`· ok slippage "${L.slice(0, 24)}"`);
      }
      if (/Athletics\/Acrobatics/.test(L) && Number(c.checkDC) === 0) {
        c.checkDC = 20; changes++; report.push(`🎚 slippage choice 1 DC 0→20`);
      }
    }
    for (const id of ["maneuver_vault_foyer_diplomacy_success", "maneuver_vault_foyer_violence_success"]) {
      const fb = B(id);
      if (!fb) continue;
      fb.choices = Array.isArray(fb.choices) ? fb.choices : [];
      if (!fb.choices.some(c => c.next === "maneuver_vault_echo_archive")) {
        fb.choices.push({ label: "Move to the next room", next: "maneuver_vault_echo_archive" });
        changes++; report.push(`🚪 onward door added @ ${id}`);
      } else report.push(`· ok door @ ${id}`);
    }
  }

  // ── 2. GATES ──────────────────────────────────────────────────────────────
  for (const id of ["maneuver_vault_acceptance", "maneuver_vault_missing_runner"]) {
    const b = B(id);
    if (!b) continue;
    b.inject = b.inject || {};
    const req = b.inject.requires;
    const has = Array.isArray(req) ? req.some(r => r?.questBucket === Q_CROWN_MALL) : req?.questBucket === Q_CROWN_MALL;
    if (!has) {
      b.inject.requires = [...(Array.isArray(req) ? req : (req ? [req] : [])), { questBucket: Q_CROWN_MALL, is: "completed" }];
      changes++; report.push(`⛩ gate {Crown Mall completed} @ ${id}`);
    } else report.push(`· ok gate @ ${id}`);
  }
  {
    const b = B("vs_overture");
    if (b) {
      const req = b.inject?.requires;
      const arr = Array.isArray(req) ? req : (req ? [req] : []);
      if (!arr.some(r => r?.questBucket === Q_KT_HUB)) {
        b.inject = b.inject || {};
        b.inject.requires = [...arr, { questBucket: Q_KT_HUB, isNot: "unstarted" }];
        changes++; report.push(`⛩ vs_overture also requires Khezek Tor engaged`);
      } else report.push("· ok vs_overture gate");
    }
  }

  // ── 3. SPEAKERS / INVITES / HANDOFF ───────────────────────────────────────
  const wireSpeaker = (id, actor, label) => {
    const b = B(id);
    if (!b || !actor) return;
    if (!b.speakerActorId) { b.speakerActorId = actor.id; changes++; report.push(`👤 speaker ${label} @ ${id}`); }
    else report.push(`· ok speaker @ ${id}`);
  };
  wireSpeaker("maneuver_vault_missing_runner", mara, "Mara");
  {
    const b = B("maneuver_vault_missing_runner");
    if (b) {
      if (!b.inviteText) { b.inviteText = "Mara Quickhands needs one answer: should she start grieving, or start sharpening?"; changes++; report.push("💬 inviteText @ missing_runner"); }
      if (!b.handoff) { b.handoff = { beatId: "maneuver_vault_approach", text: "The Vault is where Pip went. Mara won't say 'please.' She'll say 'quickly.'" }; changes++; report.push("🚪 handoff → vault approach @ missing_runner"); }
    }
  }
  // Vault AI — hybrid: entry/exit + outcome stingers speak; room menus stay menus.
  for (const id of [
    "maneuver_vault_approach", "maneuver_vault_infiltration", "maneuver_vault_leave",
    "maneuver_vault_foyer_infiltration_success", "maneuver_vault_foyer_infiltration_failure",
    "maneuver_vault_foyer_diplomacy_success", "maneuver_vault_foyer_diplomacy_failure",
    "maneuver_vault_foyer_violence_success", "maneuver_vault_foyer_violence_failure",
    "maneuver_vault_echo_archive_success", "maneuver_vault_echo_archive_failure",
    "maneuver_vault_slippage_chamber_success", "maneuver_vault_slippage_chamber_failure",
    "maneuver_vault_the_containment_loop_let_pip_learn", "maneuver_vault_the_containment_loop_let_pip_learn_more"
  ]) wireSpeaker(id, vaultAI, "Vault AI");
  for (const id of ["map_crown_mall_intro", "map_crown_mall_corroboration", "map_crown_mall_partial"])
    wireSpeaker(id, kickflip, "Kickflip");
  {
    const b = B("map_crown_mall_intro");
    if (b && !b.inviteText) { b.inviteText = "The Tanneritos say the mall remembers lights over the coast — for the right kind of visitor."; changes++; report.push("💬 inviteText @ crown_mall_intro"); }
  }
  wireSpeaker("khezek_tor_the_vaulhaulan_seal_restore", drax, "Drax");

  // ── 4. DESCRIPTIONS (empty beats only) ────────────────────────────────────
  const DESCS = {
    maneuver_vault_acceptance:
      "The coalition has a location, a missing runner, and a building that thinks of itself as faculty. The Maneuver Vault is on the books now — whatever walks out of it, somebody has to walk in first.",
    khezek_tor_valhaulan_seal_quest_acceptance:
      "Calder's crews won't work the gallery by the old seal, and Calder doesn't spook. The markings are fresh, precise, and pointed — somebody has been maintaining this thing, recently, and nobody at Khezek Tor is on that shift roster. The coalition is now formally curious.",
    khezek_tor_the_vaulhaulan_seal:
      "The shaft face, up close: Valhaulan sigils laid over older work like a correction in confident handwriting. The seal doesn't bind inward — every line of force points OUT, down the mountain, toward the coast. Whatever debt this rock was made to hold, someone re-addressed the envelope. Three tools are on the table: mend it, aim it, or open it — and the mountain is listening to the discussion."
  };
  for (const [id, text] of Object.entries(DESCS)) {
    const b = B(id);
    if (!b) continue;
    if (!String(b.description || "").trim()) { b.description = text; changes++; report.push(`✍ description @ ${id}`); }
    else report.push(`· ok desc @ ${id}`);
  }

  // ── 5. AFTERMATH REWRITES (B7 worksheet) ─────────────────────────────────
  const REWRITES = {
    maneuver_vault_missing_runner:
      "One of the runners didn't come home. No announcement — the Jackalopes don't do announcements — but every door at the Fixit Farm sounds louder when it closes. Pip and Patter are never late, never lost, never off the check-in. Now one of them is all three, last seen headed for the newly found Vault. Mara sent for you, terse as always.",
    maneuver_vault_pip_shaken:
      "Pip is out. The field powered down behind him like it was disappointed. He asked for Patter before he went under; he's sleeping it off at the Fixit Farm now — whole, rattled, and already pretending he wasn't scared. Mara is counting what she owes, which for Mara is a loud emotion.",
    maneuver_vault_pip_changed:
      "Pip came out of the Loop on his feet — barely. Something in his chest pulsed green once, then went quiet. He's asleep at the Fixit Farm now, and he looks fine, and Mara has not stopped watching him since — and has not told him she's watching.",
    maneuver_vault_pip_absored:
      "You were too late. What lives in the Vault's screens now is Pip-shaped light — an Echo Ghost that runs the old routes on a loop, tips an imaginary cap at the checkpoints, and never gets tired. The Vault logged him as a completed lesson. Patter has already asked when visiting hours are."
  };
  const REWRITE_KEYS = {
    maneuver_vault_missing_runner: "every door at the Fixit Farm sounds louder",
    maneuver_vault_pip_shaken: "like it was disappointed",
    maneuver_vault_pip_changed: "has not told him she's watching",
    maneuver_vault_pip_absored: "completed lesson"
  };
  for (const [id, text] of Object.entries(REWRITES)) {
    const b = B(id);
    if (!b) continue;
    if (!String(b.description || "").includes(REWRITE_KEYS[id])) { b.description = text; changes++; report.push(`✍ aftermath rewrite @ ${id}`); }
    else report.push(`· ok rewrite @ ${id}`);
  }

  // ── 6. memoryText carriers ────────────────────────────────────────────────
  const MEMORY = {
    khezek_tor_the_vaulhaulan_seal_restore: "They took the burden back instead of passing it on. The mine ran hot for a turn and a sympathizer cell got collared. Calder remembers who paid.",
    khezek_tor_the_vaulhaulan_seal_redirect: "They aimed the seal at somebody else and the whole coast felt it exhale. Everyone wonders who's next.",
    khezek_tor_the_vaulhaulan_seal_break: "They broke the seal and read the debt's forwarding address by the light of it. The heading is lit; the coast knows something opened.",
    map_anchor_reach_stabilize: "They held the pattern still long enough to read it. The harborfolk say the Stewards study before they smash — around here, that's a reputation.",
    map_anchor_reach_break: "They smashed an anchor point, and the proof went down with it. The surge was ugly. The harborfolk noticed who caused it.",
    map_crown_mall_corroboration: "The archive helped them; the mall is on the record. The Tanneritos filed the whole visit under 'polite, paid, welcome back.'",
    map_crown_mall_partial: "They came in acting like the law. The archive answered like a mall: technically open, spiritually closed. There is a note in their file now."
  };
  for (const [id, text] of Object.entries(MEMORY)) {
    const b = B(id);
    if (!b) continue;
    if (!b.memoryText) { b.memoryText = text; changes++; report.push(`🧠 memoryText @ ${id}`); }
    else report.push(`· ok memory @ ${id}`);
  }

  // ── 7. vs_ HANDOFFS (muster deliberately none — raid stays GM-fired) ─────
  const HANDOFFS = {
    vs_overture: { beatId: "khezek_tor_quest_scene", text: "Calder's crews won't work the gallery by the old seal. The Brace knows the way down." },
    vs_bridge_seal: { beatId: "map_rotating_chapel_approach", text: "Rumor names a chapel on the coast that turns, patiently, to face something." },
    vs_bridge_triangle: { beatId: "map_port_kudzu_intro", text: "The heading crosses exactly one working harbor. Port Kudzu hears everything twice." },
    vs_bridge_corroboration: { beatId: "maneuver_vault_approach", text: "Patter is wearing a groove in the Fixit floorboards. The Vault is where Pip went." }
  };
  for (const [id, h] of Object.entries(HANDOFFS)) {
    const b = B(id);
    if (!b) continue;
    if (!b.handoff) { b.handoff = h; changes++; report.push(`🚪 handoff @ ${id} → ${h.beatId}`); }
    else report.push(`· ok handoff @ ${id}`);
  }

  // ── 8. dialogueOffer:false + STATUE HOOKS ────────────────────────────────
  for (const id of [
    "vs_overture", "vs_bridge_seal", "vs_bridge_triangle", "vs_bridge_corroboration", "vs_bridge_muster",
    "maneuver_vault_acceptance", "maneuver_vault_leave",
    "khezek_tor_valhaulan_seal_quest_acceptance", "khezek_tor_valhaulan_seal_cinematic"
  ]) {
    const b = B(id);
    if (!b) continue;
    if (b.dialogueOffer !== false) { b.dialogueOffer = false; changes++; report.push(`🔇 dialogueOffer:false @ ${id}`); }
  }
  const HOOKS = {
    maneuver_vault_slippage_chamber: " One drifting tile carries a garden of stone figures, mid-stride, facing coastward — gone before anyone can hold the tile still.",
    maneuver_vault_echo_archive: " Half the archive whispers nonsense; one clip doesn't: a safety briefing filmed in a plaza ringed by statues that appear in no surviving city's records. That clip whispers coordinates.",
    map_anchor_reach_intro: " At low tide, the diagram shows its pilings. One of the drowned pilings has shoulders.",
    map_crown_mall_corroboration: " Among the camcorder clips, a dead advertisement plays on loop: 'Visit the Founders' Garden — one hundred figures in living stone' — with a route board showing the way. Nobody at the mall knows if the exit still exists.",
    vs_bridge_triangle: " Travelers along the heading mention stone figures spaced like mile-markers — none of them local work."
  };
  for (const [id, hook] of Object.entries(HOOKS)) {
    const b = B(id);
    if (!b) continue;
    if (!String(b.description || "").includes(hook.trim().slice(0, 40))) {
      b.description = String(b.description || "") + hook;
      changes++; report.push(`🗿 statue hook @ ${id}`);
    } else report.push(`· ok hook @ ${id}`);
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[seed-valhaulan-polish] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Valhaulan polish DRY RUN: ${changes} change(s) would be written (see console).`);
  if (!changes) return ui.notifications.info("Valhaulan polish: nothing to do — already applied.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-vs-polish-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Valhaulan polish APPLIED: ${changes} change(s). ${MARK}`);
})();
