# overlay-shell.sh — source this to get the `alpha` / `glow` art commands.
# Add to your shell profile:  source ~/modules/bbttcc-travel/tools/overlay-shell.sh
#
# Convert bright-line art (circuits/sigils/hexes) -> clean transparent overlay PNG:
#   alpha pic.png                              transparent, no glow
#   glow  pic.png                              transparent + baked feather/halo
#   glow  sigil.png --glow-radius 8 --bg black tuned glow, art drawn on black
#   glow  ~/art/Circuits                       BATCH a whole folder -> <folder>/overlays/
# Output: single file -> next to the input; folder -> a new "overlays/" subfolder.

_OVERLAY_PY="$HOME/.venvs/overlay/bin/python"
_OVERLAY_TOOL="$HOME/modules/bbttcc-travel/tools/whiten-to-alpha.py"

alpha() { "$_OVERLAY_PY" "$_OVERLAY_TOOL" "$@"; }          # transparent, no glow
glow()  { "$_OVERLAY_PY" "$_OVERLAY_TOOL" "$@" --glow; }   # transparent + feathered halo
