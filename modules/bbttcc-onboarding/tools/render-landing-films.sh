#!/usr/bin/env bash
# Landing-page films (2026-10-26, Dave): pre-rendered so the browser plays ONE file.
#   opening_film.mp4   — the As Above crawl, A0-B1…B8 ("As Above" → "Guess What"), video + Mal's VO, no music
#                        (Section D starts on the landing page when the film ends or is skipped)
#   training_video.mp4 — Teaching Slides 1–9 + v2 VO, "Vintage Movie" (leberch, Pixabay 252205) looped under
#                        the voice, faded in and out
#   shattered_lens_logo.webp — the studio ident shown before the film
# The A0 beat VO mp3s come from ~/Movies/BadEdenTitles/v5 (schedule5.py --write → cut_opening_beats.sh).
# Output → <Foundry Data>/art/bbttcc/GOTTGAIT/GOTTGAIT Scene files/landing/ ; then rsync that folder to both
# Lightsail instances (it's media — not an ft-deploy path).
set -euo pipefail
DATA="${DATA:-/Users/gamingaccount/Library/Application Support/FoundryVTT/Data}"
G="$DATA/art/bbttcc/GOTTGAIT"
OT="$G/GOTTGAIT Scene files/opening_titles"
VO="$G/Tunes/Mal Voice Acting"
OUT="$G/GOTTGAIT Scene files/landing"
PIANO="${PIANO:-/Users/gamingaccount/Downloads/leberch-vintage-movie-252205.mp3}"
LOGO="${LOGO:-/Users/gamingaccount/bad_eden_file_repository/Aslı stuff/shattered _lens_studios_logo.PNG}"
MUSIC_GAIN="${MUSIC_GAIN:-0.16}"   # ≈ −16 dB under the VO (both sources sit near −20 dB mean)
ONLY="${ONLY:-all}"                # ONLY=opening → just the opening film (after re-cutting the A0 beat VO)
mkdir -p "$OUT"

dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }

# Concatenate N (video, audio) pairs: each audio is padded/trimmed to its video's length so the
# cuts stay locked to the picture. Writes to $1; remaining args = video audio video audio …
concat_pairs() {
  local out="$1"; shift
  local args=() filt="" cat="" i=0
  while [ $# -gt 0 ]; do
    local v="$1" a="$2"; shift 2
    local d; d=$(dur "$v")
    args+=(-i "$v" -i "$a")
    filt+="[$((i*2)):v]setpts=PTS-STARTPTS,fps=30,format=yuv420p[v$i];"
    filt+="[$((i*2+1)):a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:$d,asetpts=PTS-STARTPTS[a$i];"
    cat+="[v$i][a$i]"; i=$((i+1))
  done
  filt+="${cat}concat=n=$i:v=1:a=1[v][a]"
  ffmpeg -hide_banner -loglevel error -y "${args[@]}" -filter_complex "$filt" -map "[v]" -map "[a]" \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$out"
}

echo "→ opening film"
concat_pairs "$OUT/opening_film.mp4" \
  "$OT/a0_b1_as_above.mp4" "$OT/a0_b1_as_above.mp3" \
  "$OT/a0_b2_form_consciousness.mp4" "$OT/a0_b2_form_consciousness.mp3" \
  "$OT/a0_b3_map_territory.mp4" "$OT/a0_b3_map_territory.mp3" \
  "$OT/a0_b4_attention_energy.mp4" "$OT/a0_b4_attention_energy.mp3" \
  "$OT/a0_b5_dont_stop_believing.mp4" "$OT/a0_b5_dont_stop_believing.mp3" \
  "$OT/a0_b6_remember_and_be.mp4" "$OT/a0_b6_remember_and_be.mp3" \
  "$OT/a0_b7_incarnate.mp4" "$OT/a0_b7_incarnate.mp3" \
  "$OT/a0_b8_adam_kadmon.mp4" "$OT/a0_b8_adam_kadmon.mp3"
if [ "$ONLY" = opening ]; then printf "%-26s %8s s  %s\n" opening_film.mp4 "$(dur "$OUT/opening_film.mp4")" "$(md5 -q "$OUT/opening_film.mp4")"; exit 0; fi

echo "→ training video (slides 1–9, VO only)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
pairs=()
for n in 1 2 3 4 5 6 7 8 9; do pairs+=("$OT/a0_ts0$n.mp4" "$VO/teaching-slide-$n.v2.wav"); done
concat_pairs "$TMP/slides.mp4" "${pairs[@]}"

echo "→ training video (piano bed)"
T=$(dur "$TMP/slides.mp4")
FO=$(python3 -c "print(max(0.0, $T - 6))")
ffmpeg -hide_banner -loglevel error -y -i "$TMP/slides.mp4" -stream_loop -1 -i "$PIANO" -filter_complex \
  "[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:$T,asetpts=PTS-STARTPTS,volume=$MUSIC_GAIN,afade=t=in:d=2,afade=t=out:st=$FO:d=6[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT/training_video.mp4"

echo "→ studio logo"
ffmpeg -hide_banner -loglevel error -y -i "$LOGO" -vf "scale=1024:-1" -c:v libwebp -lossless 0 -q:v 90 "$OUT/shattered_lens_logo.webp"

for f in opening_film.mp4 training_video.mp4 shattered_lens_logo.webp; do
  printf "%-26s %8s s  %s\n" "$f" "$(dur "$OUT/$f" 2>/dev/null || echo -)" "$(md5 -q "$OUT/$f")"
done
