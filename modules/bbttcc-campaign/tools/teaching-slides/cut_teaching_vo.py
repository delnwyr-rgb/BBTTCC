#!/usr/bin/env python3
"""Cut Dave's 2026-10-25 Teaching Slides re-record into ten cleaned VO files.
Cuts (source seconds) come from the faster-whisper word timings; false starts removed:
  S6 first 'The caretaker insisted…He even said it.' · S8 first 'Make caring…lullaby' · S9 first 'Somehow…about this'
plus the mic checks (head 'test/check', 'ahem', the 'test test test' before S7)."""
import subprocess, json, re, sys, os
SRC = "/Users/gamingaccount/Music/Logic/GOTTGAIT Beats/Teaching Slides.wav"
OUT = os.path.expanduser("~/Movies/BadEdenTitles/teaching_v2")
os.makedirs(OUT, exist_ok=True)
CUTS = {
 1: [(17.70, 38.60)],
 2: [(42.50, 66.30)],
 3: [(70.30, 109.20)],
 4: [(112.30, 152.90)],
 5: [(155.60, 180.50)],
 6: [(183.30, 208.95), (214.80, 224.00)],
 7: [(249.50, 280.30)],
 8: [(282.80, 314.55), (320.60, 342.70)],
 9: [(352.55, 383.30)],
 10: [(392.00, 408.40)],
}
TARGET_I, TARGET_TP, TARGET_LRA = -16.7, -1.5, 8.0
HEAD, TAIL = 0.20, 0.60

def run(args): return subprocess.run(args, capture_output=True, text=True)

# 1. noise floor from in-speech pauses
pauses = [(50.15, 1.0), (97.0, 0.8), (121.1, 1.2), (275.7, 1.2), (148.6, 1.4), (158.5, 1.2)]
rms = []
for s, d in pauses:
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-ss", str(s), "-t", str(d), "-i", SRC, "-af", "astats=measure_overall=RMS_level:measure_perchannel=none", "-f", "null", "-"])
    m = re.search(r"RMS level dB: (-?[\d.]+)", r.stderr); rms.append(float(m.group(1)) if m else None)
print("pause RMS dB:", rms)
vals = sorted(v for v in rms if v is not None)
nf = max(-80.0, min(-20.0, (vals[len(vals)//2] if vals else -55.0) + 2.0))
print(f"afftdn nf = {nf:.1f}")

def build_filter(segs, extra):
    parts, labels = [], []
    for i, (a, b) in enumerate(segs):
        parts.append(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[s{i}]"); labels.append(f"[s{i}]")
    if len(segs) == 1: chain = "[s0]"
    else:
        # short crossfade at each join
        chain = "[s0]"
        for i in range(1, len(segs)):
            parts.append(f"{chain}[s{i}]acrossfade=d=0.03:c1=tri:c2=tri[x{i}]"); chain = f"[x{i}]"
    parts.append(f"{chain}highpass=f=70,afftdn=nr=12:nf={nf:.1f}:tn=1,adelay={int(HEAD*1000)}:all=1,apad=pad_dur={TAIL}{extra}[out]")
    return ";".join(parts)

durs = {}
for n, segs in CUTS.items():
    out = f"{OUT}/teaching-slide-{n}.v2.wav"
    # pass 1: measure
    f1 = build_filter(segs, f",loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json")
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", SRC, "-filter_complex", f1, "-map", "[out]", "-f", "null", "-"])
    blk = r.stderr[r.stderr.rfind("{"):]; j = json.loads(blk[:blk.find("}") + 1])
    ln = (f",loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true:print_format=summary")
    f2 = build_filter(segs, ln + ",aresample=44100")
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-y", "-i", SRC, "-filter_complex", f2, "-map", "[out]", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s24le", out])
    if r.returncode: print("FFMPEG FAIL", n, r.stderr[-600:]); sys.exit(1)
    p = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).stdout.strip()
    m = run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    I = re.search(r"I:\s+(-?[\d.]+) LUFS", m); TP = re.search(r"Peak:\s+(-?[\d.]+) dBFS", m)
    durs[n] = round(float(p), 2)
    print(f"S{n:2d}: {durs[n]:6.2f} s  I={I.group(1) if I else '?'} LUFS  TP={TP.group(1) if TP else '?'} dBFS  (in_I={j['input_i']})")
json.dump(durs, open(f"{OUT}/durations.json", "w"))
print("VO =", {k: durs[k] for k in sorted(durs)})
