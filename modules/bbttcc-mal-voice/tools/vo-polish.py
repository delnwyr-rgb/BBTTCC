#!/usr/bin/env python3
"""vo-polish — batch voice-over cleanup with ffmpeg (Logic-free automation).

Chain (clean):  declip (if clipped) → pre-gain to −20 LUFS → 24 dB/oct high-pass @90 Hz
                → auto-notch any steady whine (per-file tone hunt, 2–8 kHz) → RNNoise neural denoise → expander (−15 dB floor) → [de-esser]
                → compressor 3.5:1 → two-pass EBU R128 loudness normalise to TARGET (TP −1.5)
Chain (--radio): same, plus band-limit 300–3800 Hz, 1.5 kHz honk, 8:1 squash,
                soft-clip + bitcrush grit, and a pink-noise static bed gated by the voice.

Usage:
  vo-polish [options] FILE.wav [FILE2.wav ...]
  vo-polish --report FILE...           # just measure, no output
Options:
  --radio                 apply the radio treatment (outputs to _radio/ instead of _polished/)
  --target LUFS           integrated loudness target (default -16; use -14 stream, -23 broadcast)
  --out DIR               output directory (default: <input dir>/_polished or _radio)
  --format wav|mp3|ogg    output format (default wav, 24-bit)
  --model sh|bd           RNNoise model: sh = speech-trained (default), bd = broader
  --denoise-mix 0..1      how much denoise to apply (default 0.9; 0 = off)
  --no-denoise            skip the neural denoiser entirely
  --no-notch              skip the automatic whine/tone notch
  --notch-db N            how far a tone must stand above its neighbourhood to get notched (default 8)
  --deess                 add a gentle de-esser
  --grit 0..1             radio bitcrush amount (default 0.25)
  --static 0..0.1         radio static bed amplitude (default 0.015; 0 = none)
  --report                measure only (before table), write nothing
  --dry-run               print the ffmpeg filter chains and exit
"""
import argparse, json, os, re, subprocess, sys
from pathlib import Path
try:
    import numpy as np
except ImportError:                       # homebrew python has no numpy; the overlay venv does
    for cand in sorted(Path.home().glob(".venvs/*/bin/python")):
        if subprocess.run([str(cand), "-c", "import numpy"], capture_output=True).returncode == 0 \
           and not os.environ.get("VO_POLISH_REEXEC"):
            os.environ["VO_POLISH_REEXEC"] = "1"
            os.execv(str(cand), [str(cand), __file__] + sys.argv[1:])
    np = None

MODEL_DIR = Path.home() / ".local/share/rnnoise"

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def measure(path):
    """Integrated LUFS, LRA, true-peak of a file (raw)."""
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
             "-af", "ebur128=peak=true", "-f", "null", "-"])
    txt = r.stderr
    def grab(key):
        m = re.findall(rf"^\s+{key}:\s+(-?[\d.]+|-inf)", txt, re.M)
        return float(m[-1]) if m and m[-1] != "-inf" else float("nan")
    return {"I": grab("I"), "LRA": grab("LRA"), "TP": grab("Peak")}

def find_whine(path, min_db, lo=2000, hi=8000, max_tones=3):
    """Return up to max_tones frequencies (Hz) of steady tones that stand >= min_db above the
    median of their ±150 Hz neighbourhood, strongest first, or []. Averaged Hann power spectrum."""
    if np is None:
        return []
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
                        "-f", "f32le", "-ac", "1", "-ar", "44100", "-"], capture_output=True)
    x = np.frombuffer(r.stdout, dtype=np.float32)
    n = 1 << 15
    if len(x) < 2 * n:
        return []
    win = np.hanning(n); acc = np.zeros(n // 2 + 1)
    for i in range(0, len(x) - n, n):
        acc += np.abs(np.fft.rfft(x[i:i + n] * win)) ** 2
    f = np.fft.rfftfreq(n, 1 / 44100); db = 10 * np.log10(acc + 1e-20)
    k = int(150 / (f[1] - f[0])); found = []
    for i in np.where((f > lo) & (f < hi))[0]:
        seg = db[max(0, i - k):i + k]; prom = db[i] - np.median(seg)
        if prom >= min_db and db[i] == seg.max():
            if found and f[i] - found[-1][0] < 30:
                if prom > found[-1][1]: found[-1] = (f[i], prom)
            else:
                found.append((f[i], prom))
    found.sort(key=lambda t: -t[1])
    return [float(fr) for fr, _ in found[:max_tones]]

def build_chain(a, m):
    pregain = -20.0 - m["I"] if m["I"] == m["I"] else 0.0   # nan-safe
    pregain = max(-20.0, min(40.0, pregain))
    f = []
    if m["TP"] >= -0.3:
        f.append("adeclip")                                      # only if it actually clipped
    f += [f"volume={pregain:.2f}dB",
          "highpass=f=90:p=2", "highpass=f=90:p=2"]              # 24 dB/oct rumble + plosive floor
    for w in m.get("whine") or []:
        f.append(f"bandreject=f={w:.0f}:width_type=h:w=60")             # 60 Hz-wide notch per tone
    if not a.no_denoise and a.denoise_mix > 0:
        f.append(f"arnndn=m={MODEL_DIR / (a.model + '.rnnn')}:mix={a.denoise_mix}")
    # expander: opens at −45 dBFS, floor −15 dB (range 0.18) — breathes, never slams
    f.append("agate=threshold=0.0056:ratio=2.5:attack=3:release=150:range=0.18:knee=4")
    if a.deess:
        f.append("deesser=i=0.2:m=0.5:f=0.5")
    f.append("acompressor=threshold=-24dB:ratio=3.5:attack=10:release=120:knee=4:makeup=4")
    if a.radio:
        f += ["highpass=f=300:p=2", "lowpass=f=3800:p=2",
              "equalizer=f=1500:width_type=q:w=1.2:g=3",
              "acompressor=threshold=-28dB:ratio=8:attack=2:release=80:knee=2:makeup=8",
              "asoftclip=type=tanh:threshold=0.55"]
        if a.grit > 0:
            f.append(f"acrusher=bits=9:samples=1:mode=log:mix={a.grit}")
    return f, pregain

def loudnorm(a, measured=None):
    base = f"loudnorm=I={a.target}:TP=-1.5:LRA=11"
    if measured is None:
        return base + ":print_format=json"
    return (base + f":measured_I={measured['input_i']}:measured_LRA={measured['input_lra']}"
            f":measured_TP={measured['input_tp']}:measured_thresh={measured['input_thresh']}"
            f":offset={measured['target_offset']}:linear=true:print_format=summary")

def graph(a, chain, ln):
    """Return (-filter args) for the two-pass runs. Radio + static needs a filter_complex."""
    core = ",".join(chain)
    if a.radio and a.static > 0:
        fc = (f"[0:a]{core},asplit=2[v][sc];"
              f"anoisesrc=color=pink:amplitude={a.static}:r=44100,highpass=f=300,lowpass=f=3800[n];"
              f"[n][sc]sidechaingate=threshold=0.02:ratio=3:attack=5:release=250:range=0.06[ng];"
              f"[v][ng]amix=inputs=2:duration=first:normalize=0,{ln}[out]")
        return ["-filter_complex", fc, "-map", "[out]"]
    return ["-af", f"{core},{ln}"]

CODEC = {"wav": ["-c:a", "pcm_s24le"],
         "mp3": ["-c:a", "libmp3lame", "-q:a", "2"],
         "ogg": ["-c:a", "libvorbis", "-q:a", "6"]}

def process(a, src):
    src = Path(src)
    before = measure(src)
    if a.report:
        return before, None, None
    before["whine"] = [] if a.no_notch else find_whine(src, a.notch_db)
    chain, pregain = build_chain(a, before)
    outdir = Path(a.out) if a.out else src.parent / ("_radio" if a.radio else "_polished")
    outdir.mkdir(parents=True, exist_ok=True)
    dst = outdir / f"{src.stem}.{a.format}"
    if a.dry_run:
        print(f"\n{src.name}  (pregain {pregain:+.1f} dB)\n  " + "\n  ".join(chain + [loudnorm(a)]))
        return before, None, dst
    # pass 1: measure loudness at the END of the chain
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src)] + graph(a, chain, loudnorm(a)) + ["-f", "null", "-"])
    blob = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S)
    if not blob:
        sys.exit(f"loudnorm measurement failed on {src.name}:\n{r.stderr[-800:]}")
    meas = json.loads(blob[-1])
    # pass 2: linear normalise with the measured values
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-y", "-i", str(src)]
            + graph(a, chain, loudnorm(a, meas)) + ["-ar", "44100"] + CODEC[a.format] + [str(dst)])
    if r.returncode:
        sys.exit(f"ffmpeg failed on {src.name}:\n{r.stderr[-800:]}")
    return before, measure(dst), dst

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("files", nargs="+")
    p.add_argument("--radio", action="store_true")
    p.add_argument("--target", type=float, default=-16.0)
    p.add_argument("--out")
    p.add_argument("--format", choices=CODEC, default="wav")
    p.add_argument("--model", choices=["sh", "bd"], default="sh")
    p.add_argument("--denoise-mix", type=float, default=0.9)
    p.add_argument("--no-denoise", action="store_true")
    p.add_argument("--deess", action="store_true")
    p.add_argument("--no-notch", action="store_true")
    p.add_argument("--notch-db", type=float, default=8.0)
    p.add_argument("--grit", type=float, default=0.25)
    p.add_argument("--static", type=float, default=0.015)
    p.add_argument("--report", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    if not a.no_denoise and not (MODEL_DIR / f"{a.model}.rnnn").exists():
        sys.exit(f"missing RNNoise model {MODEL_DIR / (a.model + '.rnnn')} — "
                 "curl it from https://raw.githubusercontent.com/richardpl/arnndn-models/master/")
    files = [f for f in a.files if not Path(f).name.startswith("._")]
    hdr = f"{'FILE':<34} {'IN LUFS':>8} {'IN TP':>7} | {'OUT LUFS':>8} {'OUT LRA':>7} {'OUT TP':>7}"
    print(hdr); print("-" * len(hdr))
    for f in files:
        b, after, dst = process(a, f)
        name = Path(f).stem[:34]
        if after:
            flag = (" clipped→declipped" if b["TP"] >= -0.3 else "") + \
                   (" notch " + "/".join(f"{w:.0f}" for w in b["whine"]) + "Hz" if b.get("whine") else "")
            print(f"{name:<34} {b['I']:>8.1f} {b['TP']:>7.1f} | {after['I']:>8.1f} {after['LRA']:>7.1f} {after['TP']:>7.1f}{flag}")
        else:
            print(f"{name:<34} {b['I']:>8.1f} {b['TP']:>7.1f} |   (lra {b['LRA']:.1f})")
    if dst and not a.report and not a.dry_run:
        print(f"\n→ {dst.parent}")

if __name__ == "__main__":
    main()
