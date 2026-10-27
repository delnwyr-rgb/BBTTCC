#!/usr/bin/env python3
"""Word-timed captions for the landing page's Training Video (2026-10-26, Dave: "the words the
narrator is saying in an Operator window, printed at the speed of the voice").

The WORDS are the canonical script — the Teaching Slide beats in the Beat Polish doc ("Coast towns ·
Acts 0–2" tab, fates_and_destinies_1…9), copied into SCRIPT below. The TIMING comes from faster-whisper
word timestamps on each slide's v2 VO, offset by the slide's start in training_video.mp4
(render-landing-films.sh concatenates slides 1–9 at their VIDEO lengths, VO starting at 0 in each).
Script words are aligned to the heard words (difflib on normalised tokens): a match takes the heard
word's time; a stretch that differs spreads its script words evenly over the heard span (or, with
nothing heard, over the gap between its neighbours).

Writes data/training_video_captions.json:
  {"slides":[{"n":1,"start":0.0,"words":[{"w":"…","s":1.23,"e":1.50},…]},…]}
When the doc's text changes, update SCRIPT and re-run (≈2 min):
  ~/.venvs/stt/bin/python tools/caption-training-video.py
"""
import difflib, json, os, re, subprocess
import numpy as np
from faster_whisper import WhisperModel

DATA = "/Users/gamingaccount/Library/Application Support/FoundryVTT/Data/art/bbttcc/GOTTGAIT"
VO = f"{DATA}/Tunes/Mal Voice Acting/teaching-slide-{{n}}.v2.wav"
VID = f"{DATA}/GOTTGAIT Scene files/opening_titles/a0_ts0{{n}}.mp4"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "training_video_captions.json")

# Beat Polish doc, read 2026-10-26 (rev 5). Slide 8's last paragraph opens with Dave's spoken
# correction of the same day ("And when the people who had invested heavily…"); the doc still reads
# "The people who had invested significantly…".
SCRIPT = {
    1: "In the beginning, Shit was dope. It was perfect. The Consciousness was incredibly chill. Luminous, undifferentiated grooviness. "
       "But. Perfection can be boring, which is counterintuitive. But apparently true - because plans were made for something.",
    2: "That something was form. Things. Stuff. And with it, a novelty. Not knowing what comes next. "
       "Infinite, undifferentiated perfection marred itself on purpose, because it wanted to watch a movie.",
    3: "Movies need projectors, and so one was crafted of the only stuff available - consciousness. Projectors need lenses, to take the light "
       "and break it, in a good way, so those who are watching don't know what the light is going to do next. Tricksy light. Reflecting the "
       "light of the infinite back on itself, and providing something that was apparently missing from perfection. "
       "Turns out, a bit of imperfection can be ... perfect. But it can also be imperfect. The lens had to be both.",
    4: "And so, imperfection and not knowing led to CHOICE, and CHOICE led to BAD CHOICES. The lens tried to switch the reel mid film. "
       "Which is awkward as lenses don't have opposable thumbs. Or arms. So obviously the lens shattered - into little sparks of lights. "
       "Tinier versions of itself. Us. And at the same time, we forgot that we were watching a movie. And started making choices.",
    5: "The light kept right on shining though! Through our broken, jagged edges, it sent the light in an infinite number of different, "
       "contradictory directions. Everyone in their own version of their own story. The plot no longer made any sense. "
       "Thus was Material Reality kicked into high gear.",
    6: "What's even worse, is that the initial impulse which caused the entire problem stepped out of the wreckage in a robe and white beard "
       "and declared that He Alone Could Fix It. He could not fix it. In fact, He kept trying to fix Reality, and getting more and more upset, "
       "which caused Reality, and those within it, to get sicker, and sicker. The caretaker insisted things were getting better. "
       "He even said it with a straight face. He believed it.",
    7: "That was it. Reality got tired of being tortured at the hands of a well meaning but hapless caretaker. Reality was a machine designed "
       "to make possibilities. It was Made FOR endless Not Knowing Experiences!™ So it did something Cinematic and unexpected. It shot the "
       "hostage. It Apocalypsed itself. Billionaires in bunkers lost a LOT of money.",
    8: "And so Reality Shattered itself. And for the purposes of this game, it shattered itself into bite-sized pieces. Hex-shaped, if you "
       "want to get specific about it. The idea was: you cannot fix everything at once. Fix it one piece at a time. Return each piece to the "
       "people living on it. Make the consequences of choices visible at a scale people can actually perceive. Give suffering an un-ignorable "
       "face. Give karma agency. Make caring about your neighbors a survival strategy rather than a liability. And when the people who had "
       "invested heavily in not caring about their neighbors discovered something important: their triple-reinforced cyber doors were still, "
       "technically, doors, and when the time came to meet the neighbors, utterly irrelevant.",
    9: "Somehow — and I want to be transparent with you about this — people are still fucking it up. The Fisher King bleeds where the land is "
       "wounded. But, remarkably, true healing has also been a real thing in the 200 years since the world rebooted. Groups of people, who "
       "mostly disagree with each other about everything except that the current situation is unacceptable, are working together. That is "
       "what progress actually looks like when you remove the commemorative poster version.",
}
PROMPT = "Bad Eden. The Offices of Fates and Destinies. Tricksy light. The caretaker. Shards, sparks, hexes."

def norm(t): return re.sub(r"[^a-z0-9]", "", t.lower())

def script_tokens(text):
    """Whitespace tokens; a token with no letters or digits (-, —, ...) rides on the word before it."""
    out = []
    for t in text.split():
        if not norm(t) and out: out[-1] += " " + t
        else: out.append(t)
    return out

def heard_tokens(words):
    """Whisper splits hyphenated words ("mid" "-film"): glue a "-x" token onto the one before."""
    out = []
    for w in words:
        if w["w"].startswith("-") and out: out[-1] = {"w": out[-1]["w"] + w["w"], "s": out[-1]["s"], "e": w["e"]}
        else: out.append(dict(w))
    return out

def spread(tokens, s, e):
    """Lay script tokens over [s, e] in proportion to their length."""
    total = sum(max(1, len(norm(t))) for t in tokens) or 1
    out, t0 = [], s
    for t in tokens:
        t1 = t0 + (e - s) * max(1, len(norm(t))) / total
        out.append({"w": t, "s": round(t0, 2), "e": round(t1, 2)})
        t0 = t1
    return out

def align(script, heard):
    a = [norm(t) for t in script]
    b = [norm(w["w"]) for w in heard]
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal":
            out += [{"w": script[i1 + k], "s": heard[j1 + k]["s"], "e": heard[j1 + k]["e"]} for k in range(i2 - i1)]
        elif op == "replace":
            out += spread(script[i1:i2], heard[j1]["s"], heard[j2 - 1]["e"])
        elif op == "delete":
            # script words with nothing heard for them: laid over the gap between their neighbours
            s = heard[j1 - 1]["e"] if j1 > 0 else (heard[0]["s"] if heard else 0.0)
            e = heard[j1]["s"] if j1 < len(heard) else s + 0.3 * (i2 - i1)
            out += spread(script[i1:i2], s, max(e, s + 0.15 * (i2 - i1)))
        # "insert" = heard words the script doesn't have (false starts, ad-libs): dropped
    return out

def dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                capture_output=True, text=True, check=True).stdout)

def load(f):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

if __name__ == "__main__":
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    slides, start = [], 0.0
    for n in range(1, 10):
        segs, _ = model.transcribe(load(VO.format(n=n)), word_timestamps=True, beam_size=5, vad_filter=False,
                                   initial_prompt=PROMPT)
        heard = [{"w": w.word.strip(), "s": round(start + w.start, 2), "e": round(start + w.end, 2)}
                 for s in segs for w in (s.words or []) if w.word.strip()]
        heard = heard_tokens(heard)
        words = align(script_tokens(SCRIPT[n]), heard)
        matched = sum(1 for op in difflib.SequenceMatcher(None, [norm(t) for t in script_tokens(SCRIPT[n])],
                      [norm(w["w"]) for w in heard], autojunk=False).get_opcodes() if op[0] == "equal" for _ in range(op[2] - op[1]))
        slides.append({"n": n, "start": round(start, 2), "words": words})
        print(f"slide {n} @ {start:6.2f}s  script {len(words)} words, {matched} timed by ear", flush=True)
        start += dur(VID.format(n=n))
    json.dump({"source": "training_video.mp4", "slides": slides}, open(OUT, "w"), indent=0)
    print("wrote", os.path.normpath(OUT))
