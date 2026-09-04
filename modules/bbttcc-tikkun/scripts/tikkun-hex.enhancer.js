// Bad Eden — Sparks in the World (hex anchors) — Phase 1 (2026-09-01)
// ─────────────────────────────────────────────────────────────────────────────
// Hooks the Spark economy into the progression spine (owner rulings 2026-09-01):
//
//   • A hex Drawing can HOLD a Spark of Light:
//       flags.bbttcc-territory.spark = { key, state, at }
//         key   = bbttcc-tikkun pack identifier, e.g. "spark_yesod_conceptual"
//                 (sephirah + kind are PARSED from the key — one authority)
//         state = "dormant" | "integrated"
//   • An INTEGRATED spark makes its hex count ALIGNED outright — the trump
//     lives in bbttcc-epic/scripts/repair.js::isHexAligned, which reads the
//     same flag. This module never computes alignment itself.
//   • Each turn, an integrated spark on a FACTION-OWNED hex pays +1 OP into
//     the sephirah's OP channel (marks, via game.bbttcc.api.op.commit; a full
//     bank refuses the gain and the yield is simply lost that turn).
//   • API (GM verbs): game.bbttcc.api.tikkun.hex.{seat, unseat, integrate, at, all}
//   • Hooks emitted:
//       bbttcc:spark:hexSeated     { hexUuid, key, sephirah, kind }
//       bbttcc:spark:hexIntegrated { hexUuid, key, sephirah, kind, factionId, actorId }
//     (bbttcc-epic listens: world-health refresh + the +2 Presence credit.)
//
// Board seeding: tools/seed-hex-sparks.macro.js (DRY_RUN, owner-reviewed
// placement — see SPARK_SEEDING_2026_09_01.md).
// ─────────────────────────────────────────────────────────────────────────────

(() => {
  const TAG = "[bbttcc-tikkun/hex]";
  const TER = "bbttcc-territory";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  // Sephirah → OP channel (OWNER-TUNABLE). Nine channels, ten sephirot:
  // yesod (foundation/transmission) and malkuth (kingdom/material) both pay
  // into economy — the pool everything else flows through.
  const SEPHIRAH_CHANNEL = {
    keter:   "faith",
    chokmah: "culture",
    binah:   "logistics",
    chesed:  "softpower",
    gevurah: "violence",
    tiferet: "diplomacy",
    netzach: "nonlethal",
    hod:     "intrigue",
    yesod:   "economy",
    malkuth: "economy"
  };
  const YIELD_OP_PER_TURN = 1; // integrated spark hex → +1 OP/turn (owner ruling)

  function parseKey(key) {
    const m = /^spark_([a-z]+)_([a-z]+)$/.exec(String(key || "").trim());
    if (!m) return null;
    return { sephirah: m[1], kind: m[2] };
  }

  function isHexDoc(d) {
    const tf = d?.flags?.[TER];
    return tf?.isHex === true || tf?.kind === "territory-hex";
  }

  async function resolveHex(hexUuid) {
    const doc = await fromUuid(String(hexUuid || ""));
    if (!doc || !isHexDoc(doc)) throw new Error(`Not a territory hex: ${hexUuid}`);
    return doc;
  }

  function sparkInfo(doc) {
    const s = doc?.flags?.[TER]?.spark;
    if (!s?.key) return null;
    const parsed = parseKey(s.key) ?? {};
    return { key: s.key, state: s.state || "dormant", at: s.at ?? null, ...parsed };
  }

  // ── GM verbs ──────────────────────────────────────────────────────────────
  async function seat(hexUuid, key, { state = "dormant" } = {}) {
    if (!game.user?.isGM) throw new Error("GM only");
    const parsed = parseKey(key);
    if (!parsed) throw new Error(`Bad spark key: ${key} (expected spark_<sephirah>_<kind>)`);
    const doc = await resolveHex(hexUuid);
    const existing = sparkInfo(doc);
    if (existing && existing.key !== key) {
      warn(`hex already holds ${existing.key}; unseat first`, hexUuid);
      return { ok: false, error: "occupied", existing };
    }
    const st = state === "integrated" ? "integrated" : "dormant";
    await doc.update({ [`flags.${TER}.spark`]: { key, state: st, at: Date.now() } });
    Hooks.callAll("bbttcc:spark:hexSeated", { hexUuid: doc.uuid, key, ...parsed });
    log(`seated ${key} (${st}) at`, doc.uuid);
    return { ok: true, key, state: st };
  }

  async function unseat(hexUuid) {
    if (!game.user?.isGM) throw new Error("GM only");
    const doc = await resolveHex(hexUuid);
    const existing = sparkInfo(doc);
    if (!existing) return { ok: true, removed: null };
    await doc.update({ [`flags.${TER}.spark`]: null });
    log(`unseated ${existing.key} from`, doc.uuid);
    return { ok: true, removed: existing.key };
  }

  async function integrate(hexUuid, { actorId = null } = {}) {
    if (!game.user?.isGM) throw new Error("GM only");
    const doc = await resolveHex(hexUuid);
    const existing = sparkInfo(doc);
    if (!existing) return { ok: false, error: "no spark seated here" };
    if (existing.state === "integrated") return { ok: true, key: existing.key, already: true };
    // Descent A2 — a corrupted spark cannot be integrated; repair it first
    // (transformation, not disposal — spec Law 3).
    if (existing.state === "corrupted") {
      ui.notifications?.warn(`${existing.key} is corrupted — repair it first (api.tikkun.hex.repair).`);
      return { ok: false, error: "corrupted — repair first" };
    }
    // Integration is an Act of Repair — it shares the faction's Reach budget
    // (Descent Engine A1, spec §2.1). Soft-gated: no epic module, no gate.
    const fid0 = doc.flags?.[TER]?.factionId || doc.flags?.[TER]?.ownerId || null;
    const debit = game.fourththing?.epic?.repair?.tryDebitReach;
    if (fid0 && typeof debit === "function") {
      const r = await debit(fid0);
      if (r && r.ok === false) {
        ui.notifications?.warn(`Reach exhausted: ${r.spent}/${r.budget} Acts of Repair this turn.`);
        return { ok: false, error: "reach exhausted", reach: r };
      }
    }
    await doc.update({ [`flags.${TER}.spark`]: { key: existing.key, state: "integrated", at: Date.now() } });
    const factionId = doc.flags?.[TER]?.factionId || doc.flags?.[TER]?.ownerId || null;
    Hooks.callAll("bbttcc:spark:hexIntegrated", {
      hexUuid: doc.uuid, key: existing.key,
      sephirah: existing.sephirah, kind: existing.kind,
      factionId, actorId
    });
    log(`integrated ${existing.key} at`, doc.uuid);
    return { ok: true, key: existing.key };
  }

  // ── Descent A2 — the Gaze can corrupt a DORMANT seated spark ──────────────
  // Integrated temples are immune (spec §2.3); corruption blocks integration
  // until repaired. Repair restores dormant — nothing is destroyed (Law 3).
  async function corrupt(hexUuid) {
    if (!game.user?.isGM) throw new Error("GM only");
    const doc = await resolveHex(hexUuid);
    const existing = sparkInfo(doc);
    if (!existing) return { ok: false, error: "no spark seated here" };
    if (existing.state === "integrated") return { ok: false, error: "temples hold — integrated sparks cannot be corrupted" };
    if (existing.state === "corrupted") return { ok: true, key: existing.key, already: true };
    await doc.update({ [`flags.${TER}.spark`]: { key: existing.key, state: "corrupted", at: Date.now() } });
    Hooks.callAll("bbttcc:spark:hexCorrupted", { hexUuid: doc.uuid, key: existing.key, sephirah: existing.sephirah, kind: existing.kind });
    log(`corrupted ${existing.key} at`, doc.uuid);
    return { ok: true, key: existing.key };
  }

  async function repair(hexUuid) {
    if (!game.user?.isGM) throw new Error("GM only");
    const doc = await resolveHex(hexUuid);
    const existing = sparkInfo(doc);
    if (!existing) return { ok: false, error: "no spark seated here" };
    if (existing.state !== "corrupted") return { ok: true, key: existing.key, already: true };
    await doc.update({ [`flags.${TER}.spark`]: { key: existing.key, state: "dormant", at: Date.now() } });
    Hooks.callAll("bbttcc:spark:hexRepaired", { hexUuid: doc.uuid, key: existing.key, sephirah: existing.sephirah, kind: existing.kind });
    log(`repaired ${existing.key} at`, doc.uuid);
    return { ok: true, key: existing.key };
  }

  async function at(hexUuid) {
    const doc = await resolveHex(hexUuid);
    return sparkInfo(doc);
  }

  function all() {
    const out = [];
    for (const sc of game.scenes?.contents ?? []) {
      for (const d of sc.drawings ?? []) {
        if (!isHexDoc(d)) continue;
        const info = sparkInfo(d);
        if (info) out.push({ hexUuid: d.uuid, scene: sc.name, ...info });
      }
    }
    return out;
  }

  // ── Turn yield: integrated spark on an owned hex pays its channel ─────────
  // Gate BOTH apply and isGM (house rule — advanceTurn:end hits every client).
  Hooks.on("bbttcc:advanceTurn:end", async (payload) => {
    try {
      if (!payload?.apply) return;
      if (!game.user?.isGM) return;
      const op = game.bbttcc?.api?.op;
      if (!op?.commit || !op?.opToMarks) return;

      // Group yields per faction so each faction gets ONE commit.
      const perFaction = new Map(); // factionId → { deltas, lines }
      for (const sc of game.scenes?.contents ?? []) {
        for (const d of sc.drawings ?? []) {
          if (!isHexDoc(d)) continue;
          const info = sparkInfo(d);
          if (!info || info.state !== "integrated") continue;
          const tf = d.flags?.[TER] ?? {};
          const fid = tf.factionId || tf.ownerId || "";
          if (!fid || !game.actors?.get(fid)) continue; // unowned temple: no collector
          const channel = SEPHIRAH_CHANNEL[info.sephirah];
          if (!channel) continue;
          // G2 — a SUNDERED lamp is dark forever: its temples keep their
          // alignment but pay no more (bbttcc-epic daath.deadLamp; guarded —
          // no epic module, no dead lamps).
          try {
            if (game.settings.get("bbttcc-epic", "daath")?.deadLamp === info.sephirah) continue;
          } catch (_e) {}
          const bag = perFaction.get(fid) ?? { deltas: {}, lines: [] };
          bag.deltas[channel] = (bag.deltas[channel] || 0) + op.opToMarks(YIELD_OP_PER_TURN);
          bag.lines.push(`${info.key} → +${YIELD_OP_PER_TURN} ${channel}`);
          perFaction.set(fid, bag);
        }
      }
      if (!perFaction.size) return;

      const report = [];
      for (const [fid, bag] of perFaction) {
        const res = await op.commit(fid, bag.deltas, { source: "tikkun-hex", reason: "spark-hex yield" });
        const fname = game.actors.get(fid)?.name ?? fid;
        if (res?.committed === false || res?.ok === false) {
          report.push(`<b>${fname}</b>: spark yield refused (bank full or error) — ${bag.lines.join(", ")}`);
        } else {
          report.push(`<b>${fname}</b>: ${bag.lines.join(", ")}`);
        }
      }
      if (report.length) {
        const gm = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
        await ChatMessage.create({
          content: `<p><b>✦ Sparks of Light — turn yield</b></p><p style="font-size:0.82rem">${report.join("<br/>")}</p>`,
          whisper: gm,
          speaker: { alias: "The Great Work" }
        }).catch(() => {});
      }
    } catch (e) { warn("turn yield failed", e); }
  });

  // ── API wiring ────────────────────────────────────────────────────────────
  Hooks.once("ready", () => {
    try {
      game.bbttcc ??= { api: {} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.tikkun ??= {};
      game.bbttcc.api.tikkun.hex = { seat, unseat, integrate, corrupt, repair, at, all, SEPHIRAH_CHANNEL };
      log("hex-spark API ready → game.bbttcc.api.tikkun.hex.{seat, unseat, integrate, corrupt, repair, at, all}");
    } catch (e) { warn("API wiring failed", e); }
  });
})();
