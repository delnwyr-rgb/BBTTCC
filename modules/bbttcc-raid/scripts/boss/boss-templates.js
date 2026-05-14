// modules/bbttcc-raid/scripts/boss/boss-templates.js
// Canonical Boss Templates (authoring presets)
// ESModule-safe. Exposed at game.bbttcc.api.raid.bossTemplates for convenience.

export const BOSS_TEMPLATES = [
  {
    key: "qliphothic_auditor",
    label: "Qliphothic Auditor",
    description: "A thing with a pen that can sign your war away. It doesn’t kill you — it invoices you.",
    defaults: {
      mode: "hybrid",
      hitTrack: "observed, pressured, compromised, expelled",
      tags: "qliphothic, audit, metaphysical",
      stats: { violence: 4, intrigue: 8, softpower: 2 },
      behaviors: []
    }
  },
  {
    key: "megafauna_apex",
    label: "Megafauna Apex",
    description: "A walking disaster with a heartbeat. It answers raids with teeth and weather.",
    defaults: {
      mode: "violence",
      hitTrack: "wounded, enraged, crippled, slain",
      tags: "megafauna, apex, feral",
      stats: { violence: 9, intrigue: 1, softpower: 0 },
      behaviors: []
    }
  },
  {
    key: "courtly_horror",
    label: "Courtly Horror",
    description: "Polite voice. Sharp smile. Every bow is a blade. Every favor is a trap.",
    defaults: {
      mode: "intrigue",
      hitTrack: "unmasked, scandalized, dethroned, exiled",
      tags: "courtly, horror, influence",
      stats: { violence: 2, intrigue: 9, softpower: 5 },
      behaviors: []
    }
  },
  {
    key: "civic_idol",
    label: "Civic Idol",
    description: "A symbol so loud it becomes law. You don’t defeat it — you replace the story.",
    defaults: {
      mode: "softpower",
      hitTrack: "questioned, challenged, rejected, forgotten",
      tags: "idol, propaganda, civic",
      stats: { violence: 1, intrigue: 4, softpower: 9 },
      behaviors: []
    }
  },
  {
    key: "feral_godling",
    label: "Feral Godling",
    description: "An unfinished god with claws. It doesn’t rule — it *erupts*.",
    defaults: {
      mode: "hybrid",
      hitTrack: "awakened, wrathful, unbound, banished",
      tags: "godling, feral, anomaly",
      stats: { violence: 7, intrigue: 4, softpower: 4 },
      behaviors: []
    }
  }
];

function ensureApi() {
  try {
    if (!game.bbttcc) game.bbttcc = {};
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.raid) game.bbttcc.api.raid = {};
    game.bbttcc.api.raid.bossTemplates = BOSS_TEMPLATES;
  } catch (e) {}
}

Hooks.once("init", () => ensureApi());
Hooks.once("ready", () => ensureApi());
