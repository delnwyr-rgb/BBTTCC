#!/usr/bin/env bash
# render.sh — render the logo HTML sources to PNG with headless Chrome (2x, transparent + on-black).
#   sls_logos/src/render.sh                 renders every *.html here into ../  (<name>.png transparent, <name>_black.png)
#   sls_logos/src/render.sh bad_eden_logo   one source
# Window size = the body size declared in each file's <style> (width/height px).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="$HERE/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="${TMPDIR:-/tmp}/sls-logo-chrome-profile"; mkdir -p "$PROFILE"
names=("$@"); [[ ${#names[@]} -eq 0 ]] && names=($(cd "$HERE" && ls *.html | sed 's/\.html$//'))
for n in "${names[@]}"; do
  f="$HERE/$n.html"
  w=$(grep -oE 'body \{ width: [0-9]+px' "$f" | grep -oE '[0-9]+'); h=$(grep -oE 'height: [0-9]+px; overflow' "$f" | grep -oE '[0-9]+')
  for bg in transparent black; do
    out="$OUT/$n.png"; q="?bg=none"; [[ $bg == black ]] && { out="$OUT/${n}_black.png"; q="?bg=black"; }
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" --force-device-scale-factor=2 --virtual-time-budget=4000 \
      --default-background-color=00000000 --window-size="$w,$h" --screenshot="$out" "file://$f$q" >/dev/null 2>&1
    echo "$(basename "$out")  $(sips -g pixelWidth -g pixelHeight "$out" | awk '/pixel/{printf "%s ", $2}')"
  done
done
