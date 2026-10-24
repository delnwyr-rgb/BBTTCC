// Rebalance Pass 8 (2026-10-23) — halve the Sephirotic Scion alignment bonus.
//
// Under z-scoring (pass 7) the +3 for a Keter / Binah / Tiphareth anchor counts as 3/sd, which pushed
// Sephirotic Scion to ~18% of ancestries (fair 12.5%). Halved per Dave. Kabbalist (occult) untouched —
// the Alpha cut removed the occult row.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json");
const BACKUP_PATH = SPEC_PATH + ".bak-pre-pass-8";
if (!existsSync(BACKUP_PATH)) copyFileSync(SPEC_PATH, BACKUP_PATH);

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
const rule = spec.alignmentBonuses["ancestry.Sephirotic Scion"][0];
const before = rule.bonus;
rule.bonus = 1.5;
spec.version = "2.1.1-scion-bonus-2026-10-23";

writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n");
console.log(`Pass 8: version ${spec.version} · ancestry.Sephirotic Scion bonus ${before} → ${rule.bonus} (if anchor ∈ ${rule.ifAlignmentIn.join(", ")})`);
