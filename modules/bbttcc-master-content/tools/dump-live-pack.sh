#!/usr/bin/env bash
# dump-live-pack.sh — read-only JSONL dump of a LIVE LevelDB compendium pack on ember (canonical world).
# `bin/ft-dump-pack` symlinks here.  Usage: ft-dump-pack <pack-dir-name> [out.jsonl] [--instance foundry|ember]
#   e.g. ft-dump-pack npcs /tmp/npcs.jsonl
# The pack dir is COPIED aside on the box first (never opened in place — the running server holds it);
# each line of the output is {"k": "<leveldb key>", "v": <document>}.  Keys: !actors!<id>, !actors.items!<a>.<i>, !folders!<id> …
#        ft-dump-pack --assets [out.txt]   → every image/svg path the live server can serve (Data + core public/), one per
#                                           line, Data-relative — feed to `ft-lint-bestiary --assets` for broken-link checks
set -euo pipefail
HOST=foundry@3.12.163.205; KEY=~/.ssh/LightsailDefaultKey-us-east-2.pem
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST")
if [[ "${1:-}" == "--assets" ]]; then
  OUT="${2:-./assets.txt}"
  "${SSH[@]}" 'cd /home/foundry/foundry-emberdata/Data && find . -type f \( -iname "*.webp" -o -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.svg" -o -iname "*.webm" \) -not -path "./worlds/*" | sed "s#^\./##"
    cd /home/foundry/foundry-ember/resources/app/public && find icons ui -type f | sed "s#^\./##"' > "$OUT"
  echo "dump-live-pack: asset list → $OUT ($(wc -l < "$OUT" | tr -d ' ') paths)"; exit 0
fi
PACK="${1:?pack dir name, e.g. npcs — or a Data-relative pack path like systems/fourththing/packs/surge-abilities}"; OUT="${2:-./$(basename "$PACK").jsonl}"; INST=ember
[[ "${3:-}" == "--instance" ]] && INST="${4:?}"
DATA=/home/foundry/foundry-emberdata/Data; [[ $INST == foundry ]] && DATA=/home/foundry/foundryuserdata/Data
"${SSH[@]}" "set -e; T=\$(mktemp -d); cp -r '$DATA/$([[ "$PACK" == */* ]] && echo "$PACK" || echo "modules/bbttcc-master-content/packs/$PACK")' \$T/db; rm -f \$T/db/LOCK
cd \$T && node -e '
const {ClassicLevel}=require(\"/home/foundry/foundry-ember-backup/resources/app/node_modules/classic-level\");
(async()=>{const db=new ClassicLevel(\"db\",{valueEncoding:\"json\"});const o=[];
for await(const [k,v] of db.iterator())o.push(JSON.stringify({k,v}));await db.close();process.stdout.write(o.join(\"\\n\"));})();'
rm -rf \$T" > "$OUT"
echo "dump-live-pack: $INST/$PACK → $OUT ($(wc -l < "$OUT" | tr -d ' ') records)"
