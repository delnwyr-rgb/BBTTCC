/* seed-sarmoung-hum.macro.js — TIER 1: THE HUM  (+ dormant houses, + T2 assets)
 * 2026-08-15. Spec: SARMOUNG-SCHISM-CODEX-2026-08-06.md v2.0 §8
 *              gate: REVELATION-LADDER-2026-08-15.md
 *
 * OWNER RULINGS 2026-08-15: pilgrimage payload = THE BURIED ALARM ·
 * seed the nine houses DORMANT now · VERNA is the eventual pointer ·
 * eye-honey YES · bee-teller YES.
 *
 * ⚠ THE LADDER IS THE LAW HERE. Tier 1 is a HUM: nothing is named, nobody in
 * these beats has a name worth remembering, and NOTHING REWARDS NOTICING.
 * That is why every T1 beat below is background-priority, carries no quest,
 * no flag, no follow-up, and exactly one flat "Noted." exit. If you are ever
 * tempted to add a hook to one of these — don't. The hook is Tier 3.
 *   Governing constraint: an NPC who explains the relay has refuted the setting.
 *
 * WHAT THIS SEEDS
 *  · 6 × Tier-1 hum beats (3 Cluster-quiet, 3 Swarm-loud), storyChain
 *    "sarmoung_hum", anonymous, background priority, zero consequence.
 *  · 9 × DORMANT house markers — an INERT flag on each hex
 *    (flags.bbttcc-campaign.sarmoungHouse = 1..9). It fires nothing. It is
 *    NOT an onEnterBeatId. Its only job is to exist now so that (a) the houses
 *    predate their own significance and (b) the arming seeder can find them
 *    later in one query. Houses become *noticeable* in T2 and *walkable* in T3.
 *  · 1 × world Item: the eye-honey (T2 asset, unplaced).
 *  · 2 × Tier-2 beats authored but UNREACHABLE (`plain()` = never offered):
 *    the eye-honey use, and the bee-teller. They wait for the T2 seeder.
 *  · 1 × GM-only journal: the house table + the payload ruling + ladder pointer.
 *
 * HEX CONFIG: fill HOUSES[].hex with the real hex names (or uuid:) for your
 * atlas. The DRY RUN reports which resolved and which did not — run it dry
 * first and use the report as a worksheet. Unresolved houses are skipped
 * safely; re-run after fixing names.
 *
 * DRY_RUN default true. Idempotent. Backs up campaigns before writing. GM only.
 */
(async () => {
  const DRY_RUN = false;                  // <-- set false to apply
  const NS   = "bbttcc-campaign";
  const TERR = "bbttcc-territory";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── the nine houses (codex §7 — hex assignments CANON 2026-08-11) ──────────
  // `hex` accepts a hex NAME (whitespace/punctuation-insensitive) or "uuid:<id>".
  // Leave "" to skip a house until you know where it goes.
  // `region` narrows ambiguous band names (Hexen Myre spans three regions —
  // wilderness bands flow across borders, per the Bible). `exclude` drops
  // specific hexes by name. `prefer:"fringe"` picks the candidate farthest from
  // the band's centre (a fringe house sits at the EDGE of the myre, not in it).
  /* 🔑 HUMILITY RULE (owner ruling 2026-08-15, from the verify audit).
   * §7 says "NEAR Port Kudzu", "Singing Mire EDGE", "NEAR the Rotating
   * Chapel" — and §1.5 rules the houses hide where no proud eye stops. Placing
   * them ON the landmarks was backwards; the Rotating Chapel case is the proof,
   * since the Chapel is the LOUD DECOY and a house inside the decoy defeats it.
   * So: `hex: "adjacent:X"` picks the least-notable NEIGHBOUR of X — preferring
   * a hex with no onEnter beat and a band-style name (Foo.c) over a proper one.
   * "adjacent:A+B" requires adjacency to BOTH (house 8's "pair ground").
   */
  /* 🔒 PINNED 2026-08-16. `adjacent:` / `prefer:` are DISCOVERY tools, not
   * permanent bindings — leaving them live means every tweak to the ranking
   * re-decides canon. The 2026-08-16 dry run proved it: adding a band-spread
   * tie-break silently relocated three already-blessed houses, including
   * house 6 off the Drowned Kudzu ground that §7 celebrates as the root
   * hiding in the Swarm's own overgrowth. Once a house is placed and blessed,
   * it gets a literal hex name and stops being an algorithm's opinion.
   * (The discovery machinery stays below for siting NEW houses.) */
  const HOUSES = [
    { n: 1, region: "River Heart",      hex: "PolygonForest.c",      note: "beside Port Kudzu — the house the Swarm watches" },
    { n: 2, region: "River Heart",      hex: "Odaroloc River.a",     note: "the bend that hears the lake — fisher's house" },
    // Moved 2026-08-16: the Garden was corrected to the COAST, so house 3 comes
    // home to the Saltwake and §7's original instinct stands. One hex from it.
    { n: 3, region: "Saltwake Coast",   hex: "Saltwake Reach d",     note: "KEEPS THE GARDENERS — one hex from Founder's Garden" },
    { n: 4, region: "Saltwake Coast",   hex: "Hexen Myre.o",         note: "the myre's fringe — the house the Cluster watches" },
    { n: 5, region: "Drowned South",    hex: "Saltwake Reach b",     note: "beside The Anchor Reach — roof-notation half-drowned" },
    { n: 6, region: "Drowned South",    hex: "Drowned Kudzu Reach c", note: "the mire's edge — and it stands on old SWARM vivarium ground (§7)" },
    { n: 7, region: "Northern Marches", hex: "Hexen Myre.c",         note: "next door to the Rotating Chapel — the decoy takes the eye, the house takes the walk" },
    { n: 8, region: "Northern Marches", hex: "Hexen Myre.f",         note: "the pair ground — touches both Beaumonts" },
    // 🔒 THE EMPTY HOUSE. The ninth's address being a groan-pun IS the
    // camouflage ruling working (§1.5): no proud eye stops on that name.
    { n: 9, region: "Iron Reaches",     hex: "CanYAWN Amirite.a",    note: "THE EMPTY HOUSE — the canyon nobody looks at twice" }
  ];


  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  // 🪤 hex display names carry NBSP (U+00A0) — collapse everything before matching.
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // ── beat shapes (house pattern) ───────────────────────────────────────────
  // T1 hum: background director beat, anonymous, single flat exit, no effects.
  const hum = (id, label, description, phase) => ({
    id, label,
    // Lane: the existing 90-beat ambient container, NOT a Sarmoung quest of
    // their own (owner ruling 2026-08-15). Left unassigned they pooled under
    // "UNASSIGNED" in the flow map; given their own lane they would group the
    // six into a shape anyone reading the quest list could spot. Tier 1 is
    // camouflage — the hum belongs with every other thing you notice from the
    // road. Cost, accepted: the ladder is no longer visible as its own arc in
    // the Visualizer; storyChain "sarmoung_hum" remains the way to find them.
    questId: "quest_travel_encounters",
    type: "dialog",
    timeScale: "scene",
    timePoints: 0,
    tags: "sarmoung_hum ambient story",
    politicalTags: "",
    description,
    outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns: 0, repeatable: false, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      // ⚠ 2026-08-15 — the first cut of this seeder shipped NO `requires`, so
      // all six hum beats unlocked in Act 0 and stood in the play console's
      // "Available now" list together on Turn 1. The ladder gives Tier 1 the
      // whole run of "now → Gloomgill" (acts 0–5), not one act. One beat per
      // act, alternating doctrines — see RELEASE ORDER below.
      requires: [{ flag: "storyPhase", gte: phase }]
    },
    actors: [],
    // ONE exit, no branch, no check, no reward. Noticing is its own thing.
    choices: [{ label: "Noted.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {},
    playerFacingDialog: true, dialogPlayerFacing: true,
    playerFacingContent: true, showToPlayers: true,
    storyChain: "sarmoung_hum",
    priority: "background"
  });

  // T2 asset: authored, never offered (fired later by the T2 seeder / GM).
  const plain = (id, label, description, { timePoints = 0, choices = null, memoryText = null, type = "narration" } = {}) => ({
    id, label, type, timePoints, dialogueOffer: false,
    tags: "sarmoung_t2 story",
    description,
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "" }]
  });

  // ── TIER 1 — THE HUM (3 quiet, 3 loud) ────────────────────────────────────
  //
  // RELEASE ORDER (owner ruling 2026-08-15) — one per act, doctrines ALTERNATING.
  // The end-of-Tier-1 line is "some places out here go quiet and some go loud,
  // and we don't know why": that only reads as a pattern if the two kinds have
  // been seen against each other, so they interleave rather than running as two
  // blocks. Kudzu goes last — it's the one that most implies a system.
  //   Act 0 OFFICES ······· Tent at the Edge of Town        quiet
  //   Act 1 SETTLING ······ Meeting Under the Big Canvas    loud
  //   Act 2 SPARKS ········ Travelers Who Won't Eat         quiet
  //   Act 3 WIDENING TRAIL  She Already Knew How            loud
  //   Act 4 VAULT & SKY ··· The Post with the Tally on It   quiet
  //   Act 5 THATWARDS HO! · The House the Kudzu Wrote On    loud
  // Gates are `gte`, so they accumulate — by Act 5 all six are live and any the
  // party hasn't met yet are still in the pool. Source stays grouped by doctrine
  // (matching the codex); the act numbers carry the interleave.
  const BEATS = [
    // ── Cluster ground grows QUIET ──────────────────────────────────────────
    hum("hum_quiet_tent", "The Tent at the Edge of Town",
      "Someone has put up a tent at the edge of the settlement — white canvas, guyed out square, so clean it looks subtracted from the landscape rather than added to it. Inside: cots, all made. A woman changes water in a basin nobody is using. She is kind to you in a completely unremarkable way, answers everything you ask, and volunteers nothing. On the walk back somebody in your party says the thing out loud: this town used to be LOUD. You were here — what, a season ago? There were dogs. There was an argument about a fence that everyone in earshot had opinions about. Nobody can tell you when it stopped. Nobody seems to have noticed it stopping. The fence is still there, and the argument is not.", 0),

    hum("hum_quiet_decline", "Travelers Who Won't Eat",
      "Two of them, on the road, on foot, immaculate — which out here is the strangest thing a person can be. No dust past the ankle. They know the courtesies, all of them, in the right order, and they use your name back to you correctly the first time. They pay for the meal. They pay OVER, cheerfully, waving off change. And then they do not eat it: the bowls sit cooling in front of them for the entire conversation, and at the end they thank the cook for it, specifically and warmly, and leave it exactly as it came. They ask after your dead. Not morbidly — the way you'd ask after somebody's knee. They seem genuinely glad to hear the number.", 2),

    hum("hum_quiet_ledger", "The Post with the Tally on It",
      "It's a waypost, and the tally cut into it is old enough that the newest marks have weathered grey. Someone maintains this. The wood's been oiled where the numbers are. And the numbers only ever go DOWN — you can read the sequence backward down the post, each figure smaller than the one above it, no additions anywhere, no corrections, the arithmetic of something being carefully and patiently subtracted from over a very long time. The most recent cut is not recent. Whatever it was counting either finished, or got small enough that counting stopped being the point.", 4),

    // ── Swarm ground grows LOUD ─────────────────────────────────────────────
    hum("hum_loud_revival", "The Meeting Under the Big Canvas",
      "The tent holds three hundred and the town holds eighty, and yet here we all are. It's a good meeting — genuinely, annoyingly good; the singing is excellent and the food is free and abundant and the welcome is so total that you're four songs deep before the arithmetic lands. Nobody here is FROM here. You ask a man where he's traveled in from and he looks pleased and a little puzzled, like you've asked him what color the alphabet is, and says he's been coming for years. Everyone is delighted. Everyone is new. Somebody presses a second helping on you and will not be argued out of it.", 1),

    hum("hum_loud_echo", "She Already Knew How",
      "She came back three months ago — an ordinary resolution, the kind the hexes do when they're settled and well-tended, nothing anybody would remark on. Except she came back knowing a trade. Not remembering one: KNOWING one, hands-first, the whole grammar of it, well enough that the smith has stopped correcting her and started watching. Asked who taught her, she gives you a completely open face and says she doesn't know, and you can tell it's not evasion, it's the actual answer. It doesn't distress her. It distresses the smith, who has been doing this for thirty years and had to be taught.", 3),

    hum("hum_loud_handwriting", "The House the Kudzu Wrote On",
      "The kudzu has taken the whole southern wall, which is normal, and gone in through the window and out through the roof, which is also normal, and made a shape on the way that is not. From the road it's just growth. From up the slope, at the wrong time of afternoon, with the light across it, the vine on that wall runs in long connected loops with consistent spacing and a consistent slant, and the word your brain reaches for before you can stop it is CURSIVE. It doesn't spell anything. You check. It doesn't spell anything in any alphabet anyone in the party can read, and it keeps not spelling anything for as long as you stand there looking at it, which is longer than you meant to.", 5),

    // ── TIER 2 assets — authored, NOT offered (the T2 seeder arms these) ─────
    plain("t2_eye_honey_use", "The Thin Sour Honey",
      "It's nothing like the honey you know: thin as syrup, faintly sour, faintly citric, and it will not behave in a spoon. The instruction that came with it was four words long and delivered without ceremony — a drop in each eye. It stings for exactly as long as it takes to regret it. And then, over about a day, the world sharpens: the swim goes out of distance, the grit-ache of a decade of wind and glare and reading by bad light quietly stops being a fact of your face. Nobody offers a theory. The person who gave it to you seemed to think the honey was the boring part.",
      { memoryText: "A jar of thin, sour honey, dripped in the eyes, measurably improved someone's sight. No explanation was offered or, apparently, available." }),

    plain("t2_bee_teller", "Somebody Has to Tell Them",
      "The hives are behind the house, six of them, older than the house. When the news reaches her she does not sit down and she does not cry — she picks up a strip of black cloth that is clearly kept for this, walks out back, and tells the bees. Out loud. In full sentences, with the name in them, and the date, and how it happened, the way you'd report to somebody who has a right to know and has been away. Then she ties the cloth to the nearest hive and stands there a moment in case there's a reply. On the way back in she tells you, without any particular emphasis, that if you don't tell them they leave. ⚠ GM: the bee-teller is an NPC MINT (owner action). Per the ladder she is Tier 2, DOABLE — the payload is that the party must tell her when one of THEM dies.",
      { memoryText: "A woman formally informed her beehives of a death, in full sentences, and tied black cloth to the hive. She says that if you don't tell them, they leave." })
  ];

  for (const nb of BEATS) {
    const existing = byId.get(nb.id);
    if (existing) {
      // GATE REPAIR — worlds seeded before 2026-08-15 got these beats with no
      // `requires`, so all six sat in "Available now" from Turn 1. Re-running
      // the seeder now retro-fits the act gate onto the beats already in play.
      // Prose is NOT touched: if you have edited a beat in the Beats tab, your
      // text stands. Only inject.requires is reconciled.
      const fixes = [];
      const want = nb.inject?.requires;
      if (want && JSON.stringify(existing.inject?.requires ?? null) !== JSON.stringify(want)) {
        existing.inject = Object.assign({}, existing.inject || {}, { requires: want });
        fixes.push(`storyPhase ≥ ${want[0].gte}`);
      }
      if (nb.questId && String(existing.questId || "") !== nb.questId) {
        existing.questId = nb.questId;
        fixes.push(`lane → ${nb.questId}`);
      }
      if (fixes.length) { changes++; report.push(`↻ ${nb.id}: ${fixes.join(" · ")}`); continue; }
      report.push(`· ok beat (already) ${nb.id}`);
      continue;
    }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++;
    report.push(`✚ beat: ${nb.id} ${nb.storyChain === "sarmoung_hum" ? "[T1 hum]" : "[T2 — authored, NOT offered]"}`);
  }

  // ── the nine dormant houses (inert markers; fire NOTHING) ─────────────────
  const scenes = game.scenes.contents;

  // Every hex in the world, once: {doc, label, key, scene}
  /* 🪤 Hexes are POLYGON drawings (shape.type "p"): width/height are null and
   * the outline lives in shape.points. The old `x + width/2` math therefore
   * collapsed to plain `x` — which happened to work only because every hex
   * shares one shape, so the offset cancelled. Average the vertices instead. */
  const hexCenter = (dr) => {
    const sh = dr.shape || {};
    const pts = sh.points || [];
    if (pts.length >= 6) {
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i + 1 < pts.length; i += 2) { sx += pts[i]; sy += pts[i + 1]; n++; }
      return { cx: (dr.x || 0) + sx / n, cy: (dr.y || 0) + sy / n };
    }
    return { cx: (dr.x || 0) + ((sh.width || 0) / 2), cy: (dr.y || 0) + ((sh.height || 0) / 2) };
  };

  const ALL_HEXES = scenes.flatMap(sc =>
    (sc.drawings?.contents || [])
      .filter(dr => dr.flags?.[TERR])
      .map(dr => ({
        doc: dr,
        label: dr.text || dr.flags[TERR]?.name || "(unnamed)",
        key: norm(dr.text || dr.flags[TERR]?.name),
        scene: sc.name,
        ...hexCenter(dr)
      }))
  );
  const inRegion = (h, region) => {
    const r = norm(region);
    return !r || norm(h.scene).includes(r) || r.includes(norm(h.scene));
  };
  // "fringe" = farthest from the centroid of its own band — the edge of the myre.
  const rankFringe = (cands) => {
    if (cands.length < 2) return cands;
    const cx = cands.reduce((a, h) => a + h.cx, 0) / cands.length;
    const cy = cands.reduce((a, h) => a + h.cy, 0) / cands.length;
    return [...cands].sort((a, b) =>
      Math.hypot(b.cx - cx, b.cy - cy) - Math.hypot(a.cx - cx, a.cy - cy));
  };
  // "near:X" — several houses are defined by what they can SEE or HEAR
  // ("hears the lake", "keeps the gardeners"), which is a distance question.
  /* Anchors are resolved REGION-FIRST. A landmark can be renamed and re-sited
   * (Founder's Garden moved Marches → Saltwake Coast), which can leave two
   * hexes answering to one name; a global first-match would silently anchor to
   * the ghost. Returns {hex, dupes} so the caller can shout about it. */
  const resolveAnchor = (name, region) => {
    const want = norm(name);
    if (!want) return { hex: null, dupes: [] };
    const hit = (pool) => pool.find(h => h.key === want)
      || pool.find(h => h.key.startsWith(want) || want.startsWith(h.key))
      || pool.find(h => h.key.includes(want) || want.includes(h.key))
      || null;
    const all = ALL_HEXES.filter(h => h.key === want);
    const scoped = region ? ALL_HEXES.filter(h => inRegion(h, region)) : ALL_HEXES;
    return { hex: hit(scoped) || hit(ALL_HEXES), dupes: all.length > 1 ? all : [] };
  };
  const rankNear = (cands, anchor) => [...cands].sort((a, b) =>
    Math.hypot(a.cx - anchor.cx, a.cy - anchor.cy) - Math.hypot(b.cx - anchor.cx, b.cy - anchor.cy));

  // Median nearest-neighbour gap = one hex step, derived rather than assumed.
  const SPACING = (() => {
    const s = ALL_HEXES.slice(0, 80), d = [];
    for (const a of s) {
      let m = Infinity;
      for (const b of s) if (a !== b && a.scene === b.scene) m = Math.min(m, Math.hypot(a.cx - b.cx, a.cy - b.cy));
      if (isFinite(m) && m > 0) d.push(m);
    }
    d.sort((x, y) => x - y);
    return d.length ? d[Math.floor(d.length / 2)] : 0;
  })();
  const isBandName = (label) => /[.\s][a-z]$/i.test(String(label || ""));
  const hasOwnBeat = (h) => !!h.doc.flags?.[TERR]?.campaign?.onEnterBeatId;

  /* "adjacent:A" (or "adjacent:A+B") — the least-notable neighbour.
   * Ranking: no onEnter beat first, then band-style name, then nearest. */
  const findAdjacent = (spec, region, houseNum) => {
    const names = spec.split("+").map(s => s.trim()).filter(Boolean);
    const anchors = names.map(n => { const r = resolveAnchor(n, region); return { name: n, hex: r.hex, dupes: r.dupes }; });
    const missing = anchors.filter(a => !a.hex).map(a => a.name);
    if (missing.length) return { hit: null, how: "anchor-missing", cands: [], anchorName: missing.join(", ") };
    const dupes = anchors.flatMap(a => a.dupes.length ? [`"${a.name}" ×${a.dupes.length} (${a.dupes.map(d => d.scene).join(", ")})`] : []);

    const scene = anchors[0].hex.scene;
    const reach = (SPACING || 0) * 1.45;
    if (!reach) return { hit: null, how: "no-spacing", cands: [] };

    const neigh = ALL_HEXES.filter(h =>
      h.scene === scene &&
      !anchors.some(a => a.hex === h) &&
      // never propose ground another house already holds
      !(h.doc.flags?.[NS]?.sarmoungHouse && h.doc.flags[NS].sarmoungHouse !== houseNum) &&
      anchors.every(a => Math.hypot(h.cx - a.hex.cx, h.cy - a.hex.cy) <= reach)
    );
    if (!neigh.length) return { hit: null, how: "no-neighbour", cands: [], anchorName: names.join(" + ") };

    const dTo = (h) => Math.hypot(h.cx - anchors[0].hex.cx, h.cy - anchors[0].hex.cy);
    // Which band does a hex belong to? ("Hexen Myre.l" → "hexenmyre")
    const band = (label) => norm(String(label).replace(/[.\s][a-z]$/i, ""));
    // How many houses already stand on that band, anywhere in the world? The
    // pilgrimage is a route ACROSS the map, so when neighbours tie, spread.
    const bandLoad = (h) => ALL_HEXES.filter(x =>
      x.doc.flags?.[NS]?.sarmoungHouse && x.doc.flags[NS].sarmoungHouse !== houseNum
      && band(x.label) === band(h.label)).length;
    const ranked = [...neigh].sort((a, b) =>
      (hasOwnBeat(a) - hasOwnBeat(b)) ||
      (isBandName(b.label) - isBandName(a.label)) ||
      // treat sub-pixel distance differences as a genuine tie, or float noise
      // silently decides and the alphabetical tie-break never runs
      (Math.abs(dTo(a) - dTo(b)) > 1 ? dTo(a) - dTo(b) : 0) ||
      (bandLoad(a) - bandLoad(b)) ||
      // ⚠ STABLE tie-break. Without it, equally-ranked neighbours sorted by
      // scene order, so a harmless re-run could silently relocate a house —
      // and the reconciler would dutifully retire the old marker.
      a.label.localeCompare(b.label)
    );
    const tied = ranked.filter(h => !hasOwnBeat(h) === !hasOwnBeat(ranked[0])
      && Math.abs(dTo(h) - dTo(ranked[0])) < 1);
    return {
      hit: ranked[0],
      how: `adjacent to ${names.join(" + ")}${tied.length > 1 ? ` — ${tied.length}-way tie, took first alphabetically` : ""}${dupes.length ? ` ⚠ DUPLICATE ANCHOR: ${dupes.join("; ")}` : ""}`,
      cands: ranked.slice(1, 6)
    };
  };

  /* 3-stage matcher. Hex display names use a Name.letter convention
   * ("PolygonWood.a") and carry NBSP, so an exact match on a bare place-name
   * fails constantly. Try exact → prefix → substring, report HOW it matched,
   * and refuse to guess when it's ambiguous (listing the candidates instead). */
  const findHex = (spec, house = {}) => {
    const want = norm(spec);
    if (!want) return { hit: null, how: "empty", cands: [] };
    const dropped = (house.exclude || []).map(norm);

    // Region + explicit exclusions applied BEFORE disambiguation — a band name
    // like "Hexen Myre" is only ambiguous until you say which region you meant.
    const pool = ALL_HEXES
      .filter(h => inRegion(h, house.region))
      .filter(h => !dropped.includes(h.key));

    for (const [how, test] of [
      ["exact",     h => h.key === want],
      ["prefix",    h => h.key.startsWith(want) || want.startsWith(h.key)],
      ["substring", h => h.key.includes(want) || want.includes(h.key)]
    ]) {
      const hits = pool.filter(test);
      if (hits.length === 1) return { hit: hits[0], how, cands: [] };
      if (hits.length > 1) {
        const pref = String(house.prefer || "");
        if (pref === "fringe") {
          const ranked = rankFringe(hits);
          return { hit: ranked[0], how: `${how}+fringe`, cands: ranked.slice(1, 5) };
        }
        if (pref.startsWith("near:")) {
          const anchorName = pref.slice(5);
          const { hex: anchor, dupes: aDupes } = resolveAnchor(anchorName, house.region);
          if (aDupes.length) return { hit: null, how: "anchor-ambiguous", cands: hits, anchorName: `${anchorName} — ${aDupes.length} hexes answer to that name (${aDupes.map(d => d.scene).join(", ")})` };
          if (!anchor) return { hit: null, how: "anchor-missing", cands: hits, anchorName };
          // Cross-scene distance is meaningless; prefer same-scene candidates.
          const same = hits.filter(x => x.scene === anchor.scene);
          const ranked = rankNear(same.length ? same : hits, anchor);
          return { hit: ranked[0], how: `${how}+nearest to ${anchor.label}`, cands: ranked.slice(1, 5) };
        }
        return { hit: null, how: "ambiguous", cands: hits };
      }
    }
    return { hit: null, how: "none", cands: [] };
  };

  const placed = [];
  for (const h of HOUSES) {
    // Worksheet service: whenever we can't place a house, print that region's
    // hexes so the DRY report itself is the menu you choose from.
    const regionMenu = () => {
      const opts = ALL_HEXES.filter(x => inRegion(x, h.region)).map(x => x.label);
      return opts.length
        ? ` — ${h.region} hexes: ${opts.slice(0, 40).join(" · ")}${opts.length > 40 ? ` … (+${opts.length - 40} more)` : ""}`
        : " (no scene matched that region — run list-hexes.macro.js)";
    };

    if (!h.hex) { report.push(`⚠ house ${h.n} (${h.region}) — NO HEX SET, SKIPPED. ${h.note}${regionMenu()}`); continue; }

    let hex = null, how = "", alts = [];
    if (/^uuid:/i.test(h.hex)) {
      const doc = await fromUuid(h.hex.slice(5)).catch(() => null);
      if (doc?.documentName === "Drawing") { hex = doc; how = "uuid"; }
    } else if (/^adjacent:/i.test(h.hex)) {
      const m = findAdjacent(h.hex.slice(9), h.region, h.n);
      if (m.hit) { hex = m.hit.doc; how = m.how; alts = m.cands; }
      else if (m.how === "anchor-missing") {
        report.push(`⚠ house ${h.n} — landmark "${m.anchorName}" not found, SKIPPED (can't find its neighbour).`);
        continue;
      } else {
        report.push(`⚠ house ${h.n} — no neighbour found for "${h.hex.slice(9)}" (${m.how}), SKIPPED.${regionMenu()}`);
        continue;
      }
    } else {
      const m = findHex(h.hex, h);
      if (m.hit) { hex = m.hit.doc; how = m.how; alts = m.cands; }
      else if (m.how === "ambiguous") {
        report.push(`⚠ house ${h.n} — "${h.hex}" is AMBIGUOUS in ${h.region} (${m.cands.length}), SKIPPED. Pick one: ${m.cands.map(c => c.label).join(" · ")}`);
        continue;
      }
      else if (m.how === "anchor-missing") {
        report.push(`⚠ house ${h.n} — anchor hex "${m.anchorName}" not found, so "nearest to" can't be computed. SKIPPED. Set the anchor name correctly or pick manually: ${m.cands.map(c => c.label).join(" · ")}`);
        continue;
      }
    }
    if (!hex) {
      report.push(`⚠ house ${h.n} — hex "${h.hex}" NOT FOUND in ${h.region}, SKIPPED.${regionMenu()}`);
      continue;
    }

    const label = hex.text || hex.flags?.[TERR]?.name || h.hex;
    const cur = hex.flags?.[NS]?.sarmoungHouse;
    if (cur === h.n) { report.push(`· ok house ${h.n} (already) @ ${label}`); placed.push({ ...h, label, doc: hex }); continue; }
    if (cur && cur !== h.n) { report.push(`⚠ house ${h.n} — target ${label} already carries house ${cur}, SKIPPED (resolve by hand)`); continue; }
    changes++;
    placed.push({ ...h, label, doc: hex });
    report.push(`🏚 house ${h.n} DORMANT @ ${label}${how && how !== "exact" ? ` (matched by ${how} — verify!)` : ""}${alts.length ? ` · runners-up: ${alts.map(c => c.label).join(", ")}` : ""} — inert marker, fires nothing`);
    if (!DRY_RUN) await hex.update({ [`flags.${NS}.sarmoungHouse`]: h.n });
  }

  /* ── reconcile: retire stale markers ──────────────────────────────────────
   * Houses MOVE as canon settles (house 3 followed the Garden to the Marches;
   * five houses stepped one hex off their landmarks). Without this, the old
   * hex keeps its flag and two hexes claim the same house. 🪤 v14: "-=key"
   * deletion is dead — use unsetFlag. */
  const keepDocs = new Set(placed.map(p => p.doc));
  for (const h of ALL_HEXES) {
    const mark = h.doc.flags?.[NS]?.sarmoungHouse;
    if (!mark || keepDocs.has(h.doc)) continue;
    changes++;
    report.push(`🧹 retiring stale house ${mark} @ ${h.label} (moved) — flag cleared`);
    if (!DRY_RUN) await h.doc.unsetFlag(NS, "sarmoungHouse");
  }

  // ── the eye-honey (T2 asset — created unplaced) ───────────────────────────
  const HONEY_NAME = "Thin Honey (a small sealed jar)";
  if (game.items.getName(HONEY_NAME)) report.push(`· ok item (already) ${HONEY_NAME}`);
  else {
    changes++;
    report.push(`✚ item: ${HONEY_NAME} [T2 asset, unplaced]`);
    if (!DRY_RUN) await Item.create({
      name: HONEY_NAME,
      type: "gear",
      system: {
        description: "<p>A small sealed jar, heavier than it looks. The honey inside is thin as syrup and faintly sour — nothing like comb honey — and it smells very slightly of citrus and resin. It came with a four-word instruction and no explanation whatsoever.</p><p><em>A drop in each eye.</em></p><p>It stings briefly. Over the following day, sight sharpens: distance stops swimming, and the accumulated grit-ache of years of wind, glare and bad reading light quietly goes away. The jar does not empty as fast as it should.</p>",
        quantity: 1, weight: 0.5, price: 0, rarity: "uncommon"
      },
      flags: { [NS]: { sarmoungTier: 2, note: "eye-honey — the only relic that is unambiguously just medicine" } }
    });
  }

  // ── GM-only ledger journal ────────────────────────────────────────────────
  const JOURNAL = "⛏ Sarmoung — GM Ledger (do not show players)";
  const existingJournal = game.journal.getName(JOURNAL);
  if (existingJournal) {
    // Placements move; a ledger that still lists the old hexes is worse than none.
    report.push(`↻ journal exists — house table will be REFRESHED to current placements`);
    if (!DRY_RUN) {
      const rows2 = HOUSES.map(h => {
        const p = placed.find(x => x.n === h.n);
        return `<tr><td>${h.n}</td><td>${h.region}</td><td>${p ? p.label : "<em>unplaced</em>"}</td><td>${h.note}</td></tr>`;
      }).join("");
      const page = existingJournal.pages.contents[0];
      if (page) await page.update({ "text.content":
        `<h2>The nine houses (refreshed ${new Date().toISOString().slice(0, 10)})</h2>
         <p><strong>Payload on arming = THE BURIED ALARM.</strong> Pointer = Verna (late Tier 2). Houses are DORMANT: inert markers, nothing fires.</p>
         <table><thead><tr><th>#</th><th>Region</th><th>Hex</th><th>Note</th></tr></thead><tbody>${rows2}</tbody></table>
         <p>Humility rule: the houses sit BESIDE the landmarks, never on them — the Rotating Chapel is the loud decoy and a house inside the decoy defeats it.</p>
         <p>Authoring gate: <code>REVELATION-LADDER-2026-08-15.md</code>. <strong>An NPC who explains the relay has refuted the setting.</strong></p>
         <p><code>game.scenes.contents.flatMap(s=&gt;s.drawings.contents).filter(d=&gt;d.flags?.["${NS}"]?.sarmoungHouse)</code></p>` });
    }
  }
  else {
    changes++;
    report.push(`✚ journal: ${JOURNAL} [GM-only]`);
    if (!DRY_RUN) {
      const rows = HOUSES.map(h => {
        const p = placed.find(x => x.n === h.n);
        return `<tr><td>${h.n}</td><td>${h.region}</td><td>${p ? p.label : "<em>unplaced</em>"}</td><td>${h.note}</td></tr>`;
      }).join("");
      await JournalEntry.create({
        name: JOURNAL,
        ownership: { default: 0 },
        pages: [{
          name: "The Ledger",
          type: "text",
          text: { content:
            `<h2>Owner rulings — 2026-08-15</h2>
             <ul>
               <li><strong>Pilgrimage payload = THE BURIED ALARM.</strong> Walking houses 1–8 and entering the ninth with the door shut outputs the alarm's location. (Second payload, later: the Missing One.)</li>
               <li><strong>Houses seeded DORMANT now</strong> — inert markers, fire nothing. T1 = they simply exist. T2 = they become <em>noticeable</em>. T3 = they become <em>walkable</em>. One asset, three acts, seeded once.</li>
               <li><strong>Verna is the eventual pointer</strong> — late Tier 2. She does not explain. She does something odd enough that a player asks.</li>
             </ul>
             <h2>The nine houses</h2>
             <table><thead><tr><th>#</th><th>Region</th><th>Hex</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>
             <h2>Discipline</h2>
             <p>Authoring gate: <code>REVELATION-LADDER-2026-08-15.md</code>. Tier 1 is a hum — nothing named, nothing rewards noticing.
             <strong>An NPC who explains the relay has refuted the setting.</strong></p>
             <p>Query the placed houses at any time:<br>
             <code>game.scenes.contents.flatMap(s=&gt;s.drawings.contents).filter(d=&gt;d.flags?.["${NS}"]?.sarmoungHouse)</code></p>`
          }
        }]
      });
    }
  }

  // ── report + write ────────────────────────────────────────────────────────
  report.push(`— houses resolved: ${placed.length}/9 · payload on arming = THE BURIED ALARM · pointer = Verna (T2, not built)`);
  console.log(`[seed-sarmoung-hum] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Sarmoung Hum DRY RUN: ${changes} change(s) (see console — use the house lines as a worksheet).`);
  if (!changes) return ui.notifications.info("Sarmoung Hum: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-sarmoung-hum-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Sarmoung Hum APPLIED: ${changes} change(s). Nothing is named. Nothing rewards noticing.`);
})();
