#!/usr/bin/env python3
"""render_teaching_slides.py — the ten Teaching Slides of the Offices of Fates and Destinies (2026-10-25).

White field, black line, gold for the light, one red line for the wound (slide 9). Dave's storyboard:
point → line → cube → the Tree of Life as projector (Tiferet = lens) → the lens shatters into sparks (us) →
jagged edges each throwing their own picture → the bearded caretaker glues a crooked cube → it shoots the
hostage → the pieces settle into flat-top hexes → neighbours heal a wounded hex → the frontier, sparks still out there.

Each slide is timed to its VO (teaching-slide-N.v2.wav) + a 2 s tail; the last frame is the hold
(the play-once tile freezes on it). Output: 1920×1080 h264 mp4, silent, one per slide.

Usage:
  ~/.venvs/overlay/bin/python render_teaching_slides.py --out <dir> [--slides 1,2,…] [--preview] [--jobs 6]
    --preview  writes <dir>/preview_sN.png contact sheets (12 frames per slide) instead of video.
"""
import math, os, sys, random, subprocess, argparse
from multiprocessing import Pool
from PIL import Image, ImageDraw

# ── timing ───────────────────────────────────────────────────────────────────
# v2 (2026-10-25 re-record, Dave's single-pass take cut + cleaned by tools/teaching-slides/cut_teaching_vo.py → teaching-slide-N.v2.wav).
# v1 (the first per-slide wavs) was {1: 49.05, 2: 34.18, 3: 49.79, 4: 54.99, 5: 63.91, 6: 57.96, 7: 53.50, 8: 43.84, 9: 52.02, 10: 51.27}.
VO = {1: 21.70, 2: 24.60, 3: 39.70, 4: 41.40, 5: 25.70, 6: 35.62, 7: 31.60, 8: 54.62, 9: 31.55, 10: 17.20}
TAIL = 2.0
FPS = 30
W, H = 1920, 1080
SS = 2                       # supersample factor (anti-aliasing)
WW, HH = W * SS, H * SS

# ── palette ──────────────────────────────────────────────────────────────────
PAPER = (255, 255, 255)
INK = (24, 24, 24)
FAINT = (200, 200, 200)      # the Tree as a backdrop
GOLD = (214, 160, 20)
GOLD_SOFT = (246, 226, 160)
RED = (196, 32, 36)

# ── easing ───────────────────────────────────────────────────────────────────
def clamp(x, a=0.0, b=1.0): return a if x < a else b if x > b else x
def smooth(x): x = clamp(x); return x * x * (3 - 2 * x)
def ph(t, a, b, ease=True):
    """phase: 0 before a, 1 after b, eased between."""
    if b <= a: return 1.0 if t >= b else 0.0
    x = clamp((t - a) / (b - a)); return smooth(x) if ease else x
def lerp(a, b, x): return a + (b - a) * x
def mix(c1, c2, x): return tuple(int(round(lerp(c1[i], c2[i], x))) for i in range(3))

# ── canvas with a camera ─────────────────────────────────────────────────────
class Ctx:
    def __init__(self):
        self.im = Image.new("RGB", (WW, HH), PAPER)
        self.d = ImageDraw.Draw(self.im)
        self.zoom = 1.0; self.cx = W / 2; self.cy = H / 2   # camera (world coords, 1920×1080 space)
    def P(self, x, y):
        return ((x - self.cx) * self.zoom + W / 2) * SS, ((y - self.cy) * self.zoom + H / 2) * SS
    def w(self, px): return max(1, int(round(px * SS * max(self.zoom, 0.35))))
    def line(self, pts, col=INK, width=3, progress=1.0):
        if len(pts) < 2: return
        pts = partial(pts, progress)
        if len(pts) < 2: return
        self.d.line([self.P(*p) for p in pts], fill=col, width=self.w(width), joint="curve")
    def circle(self, x, y, r, col=INK, width=3, fill=None, progress=1.0):
        if r <= 0: return
        x0, y0 = self.P(x - r, y - r); x1, y1 = self.P(x + r, y + r)
        if progress >= 1.0:
            self.d.ellipse([x0, y0, x1, y1], outline=col if width else None, width=self.w(width) if width else 0, fill=fill)
        else:
            if fill: self.d.ellipse([x0, y0, x1, y1], fill=fill)
            self.d.arc([x0, y0, x1, y1], start=-90, end=-90 + 360 * clamp(progress), fill=col, width=self.w(width))
    def dot(self, x, y, r, col=INK):
        x0, y0 = self.P(x - r, y - r); x1, y1 = self.P(x + r, y + r)
        self.d.ellipse([x0, y0, x1, y1], fill=col)
    def spark(self, x, y, r=5, glow=2.2, col=GOLD):
        self.dot(x, y, r * glow, GOLD_SOFT); self.dot(x, y, r, col)
    def poly(self, pts, col=INK, width=3, fill=None, progress=1.0):
        if fill: self.d.polygon([self.P(*p) for p in pts], fill=fill)
        self.line(list(pts) + [pts[0]], col, width, progress)
    def out(self):
        return self.im.resize((W, H), Image.LANCZOS)

def partial(pts, progress):
    """first `progress` fraction (by length) of a polyline."""
    if progress >= 1.0: return list(pts)
    if progress <= 0.0: return []
    segs = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total = sum(segs); want = total * progress; out = [pts[0]]; acc = 0.0
    for i, s in enumerate(segs):
        if acc + s >= want:
            f = (want - acc) / s if s else 0
            out.append((lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f))); break
        acc += s; out.append(pts[i + 1])
    return out

# ── shared geometry ──────────────────────────────────────────────────────────
GROUND_Y = 880                       # the ground line in slides 4–7 (below Malkuth)
TREE_TOP, TREE_SCALE = 90, 0.88      # the Tree sits wholly above the ground line
# Tree of Life: three pillars, classical layout (unit coords → screen)
SEPH = {  # name: (col, row)
    "keter": (0, 0), "chokmah": (1, 1), "binah": (-1, 1), "chesed": (1, 2.4), "geburah": (-1, 2.4),
    "tiferet": (0, 3.2), "netzach": (1, 4.4), "hod": (-1, 4.4), "yesod": (0, 5.3), "malkuth": (0, 6.6)}
PATHS = [("keter", "chokmah"), ("keter", "binah"), ("keter", "tiferet"), ("chokmah", "binah"), ("chokmah", "tiferet"),
         ("chokmah", "chesed"), ("binah", "tiferet"), ("binah", "geburah"), ("chesed", "geburah"), ("chesed", "tiferet"),
         ("chesed", "netzach"), ("geburah", "tiferet"), ("geburah", "hod"), ("tiferet", "netzach"), ("tiferet", "hod"),
         ("tiferet", "yesod"), ("netzach", "hod"), ("netzach", "yesod"), ("netzach", "malkuth"), ("hod", "yesod"),
         ("hod", "malkuth"), ("yesod", "malkuth")]
FLASH = ["keter", "chokmah", "binah", "chesed", "geburah", "tiferet", "netzach", "hod", "yesod", "malkuth"]

def tree_pos(name, cx=960, top=TREE_TOP, dx=190, dy=115, droop=0.0, scale=TREE_SCALE):
    c, r = SEPH[name]
    x = cx + c * dx * scale
    y = top + r * dy * scale
    # droop: lower sephirot sag more, outer pillars sag inward-down
    y += droop * (r / 6.6) ** 1.6 * 160 * scale
    x += droop * c * (r / 6.6) * 40 * scale
    return (x, y)

def draw_tree(ctx, col=INK, width=3, progress=1.0, droop=0.0, seph_r=22, scale=TREE_SCALE, cx=960, top=TREE_TOP, faint=False):
    """paths reveal in order, then the circles; progress 0..1 covers both."""
    n = len(PATHS)
    for i, (a, b) in enumerate(PATHS):
        p = clamp(progress * (n + 4) - i)
        if p <= 0: continue
        A = tree_pos(a, cx, top, droop=droop, scale=scale); B = tree_pos(b, cx, top, droop=droop, scale=scale)
        if droop > 0:   # sagging paths bow downward
            m = ((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + droop * 28 * scale)
            pts = [A] + [(lerp(lerp(A[0], m[0], k), lerp(m[0], B[0], k), k), lerp(lerp(A[1], m[1], k), lerp(m[1], B[1], k), k)) for k in [i / 8 for i in range(1, 8)]] + [B]
        else: pts = [A, B]
        ctx.line(pts, col, width, p)
    for i, name in enumerate(FLASH):
        p = clamp(progress * (n + 4) - (n - 2) - i * 0.5)
        if p <= 0: continue
        x, y = tree_pos(name, cx, top, droop=droop, scale=scale)
        ctx.circle(x, y, seph_r * scale, col, width, fill=PAPER, progress=p)

def flash_path(droop=0.0, scale=TREE_SCALE, cx=960, top=TREE_TOP):
    return [tree_pos(n, cx, top, droop=droop, scale=scale) for n in FLASH]

def stick(ctx, x, y, h=70, col=INK, width=3, lean=0.0, arm_up=False, progress=1.0, walk=0.0):
    """a simple figure standing on (x, y). walk: phase for swinging legs."""
    head_r = h * 0.16; top = y - h
    ctx.circle(x + lean * 6, top + head_r, head_r, col, width, progress=clamp(progress * 3))
    ctx.line([(x + lean * 6, top + 2 * head_r), (x, y - h * 0.38)], col, width, clamp(progress * 3 - 1))
    hip = (x, y - h * 0.38); sw = math.sin(walk) * h * 0.18
    ctx.line([hip, (x - h * 0.16 + sw, y)], col, width, clamp(progress * 3 - 2))
    ctx.line([hip, (x + h * 0.16 - sw, y)], col, width, clamp(progress * 3 - 2))
    sh = (x + lean * 3, top + 2.6 * head_r)
    if arm_up: ctx.line([sh, (x + h * 0.26, top + 0.6 * head_r)], col, width, clamp(progress * 3 - 2))
    else: ctx.line([(x - h * 0.2, y - h * 0.5), sh, (x + h * 0.2, y - h * 0.5)], col, width, clamp(progress * 3 - 2))

def cube_pts(cx, cy, size, ax, ay, depth=0.0, persp=900):
    """wireframe cube: 8 projected points; depth scales the z extent (0 = flat square)."""
    pts = []
    for i in range(8):
        x = (-1 if i & 1 == 0 else 1) * size; y = (-1 if i & 2 == 0 else 1) * size; z = ((-1 if i & 4 == 0 else 1) * size) * depth
        # rotate about y then x
        x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
        y, z = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
        f = persp / (persp + z)
        pts.append((cx + x * f, cy + y * f))
    return pts
CUBE_EDGES = [(0, 1), (2, 3), (4, 5), (6, 7), (0, 2), (1, 3), (4, 6), (5, 7), (0, 4), (1, 5), (2, 6), (3, 7)]

def draw_cube(ctx, pts, col=INK, width=3, jitter=None, progress=1.0):
    for k, (a, b) in enumerate(CUBE_EDGES):
        p = clamp(progress * 12 - k) if progress < 1 else 1
        if p <= 0: continue
        A, B = pts[a], pts[b]
        if jitter: A = (A[0] + jitter[a][0], A[1] + jitter[a][1]); B = (B[0] + jitter[b][0], B[1] + jitter[b][1])
        ctx.line([A, B], col, width, p)

def shard_poly(rng, cx, cy, r):
    n = rng.randint(3, 5); angs = sorted(rng.uniform(0, 2 * math.pi) for _ in range(n))
    return [(cx + math.cos(a) * r * rng.uniform(0.5, 1.0), cy + math.sin(a) * r * rng.uniform(0.5, 1.0)) for a in angs]

# flat-top hex grid (axial q,r) — matches the live territory hexes (start angle 0)
HEX_R = 64
def hex_center(q, r, cx=960, cy=560, R=HEX_R):
    return (cx + R * 1.5 * q, cy + R * math.sqrt(3) * (r + q / 2))
def hex_pts(cx, cy, R=HEX_R):
    return [(cx + R * math.cos(i * math.pi / 3), cy + R * math.sin(i * math.pi / 3)) for i in range(6)]
def hex_ring(n):
    if n == 0: return [(0, 0)]
    out = []; q, r = -n, n  # start at a corner and walk
    dirs = [(1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1)]
    q, r = 0, -n
    cur = (n, -n)
    # simple: all cells with hex distance n
    for q in range(-n, n + 1):
        for r in range(-n, n + 1):
            s = -q - r
            if max(abs(q), abs(r), abs(s)) == n: out.append((q, r))
    out.sort(key=lambda c: math.atan2(hex_center(*c)[1] - 560, hex_center(*c)[0] - 960))
    return out
GRID = [c for n in range(3) for c in hex_ring(n)]          # 19 hexes
HEX_NEIGH = [(1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1)]

# ── slides ───────────────────────────────────────────────────────────────────
def s1(ctx, t, T):
    """perfection: white; one point; it breathes; plans."""
    a = ph(t, 0.50 * T, 0.50 * T + 0.8)        # "But." — the first mark on perfection
    if a <= 0: return
    r = 9 * a * (1 + 0.12 * math.sin((t - 0.5 * T) * 1.4))
    ctx.dot(960, 540, r)
    # "plans were made": a ring pulses out, three times, late
    for k in range(3):
        p = ph(t, 0.80 * T + k * 1.6, 0.80 * T + k * 1.6 + 2.4, ease=False)
        if 0 < p < 1: ctx.circle(960, 540, 12 + p * 160, mix(INK, PAPER, p), 2)

def s2(ctx, t, T):
    """form: point → line → square → cube → it turns."""
    cx, cy = 960, 540
    pl = ph(t, 0.02 * T, 0.18 * T); ps = ph(t, 0.20 * T, 0.40 * T); pc = ph(t, 0.42 * T, 0.62 * T)
    if pc > 0:
        ay = (t - 0.42 * T) * 0.45; ax = 0.35 * ph(t, 0.62 * T, 0.8 * T)
        pts = cube_pts(cx, cy, 150, ax, ay * ph(t, 0.55 * T, 0.75 * T), depth=pc)
        draw_cube(ctx, pts)
        return
    if ps > 0:   # the line opens into a square, symmetrically about the centre
        h = 150 * ps
        ctx.poly([(cx - 150, cy - h), (cx + 150, cy - h), (cx + 150, cy + h), (cx - 150, cy + h)], INK, 3)
        return
    if pl > 0:   # the point becomes a line, both ways
        ctx.line([(cx - 150 * pl, cy), (cx + 150 * pl, cy)], INK, 3)
        if pl < 1: ctx.dot(cx, cy, 9 * (1 - pl) + 2)
        return
    ctx.dot(cx, cy, 9)

def s3(ctx, t, T):
    """projector + lens: the Tree draws; light runs the flash; Tiferet fans it; Malkuth is the screen."""
    fade = 1 - ph(t, 0.0, 0.10 * T)
    if fade > 0:
        pts = cube_pts(960, 540, 150 * (0.6 + 0.4 * fade), 0.35, 0.9 + t * 0.3, depth=1)
        draw_cube(ctx, pts, mix(INK, PAPER, 1 - fade), 3)
    # "Movies need projectors": the Tree draws itself
    tp = ph(t, 0.04 * T, 0.24 * T, ease=False)
    draw_tree(ctx, INK, 3, tp)
    if tp < 1: return
    # Kether lights
    kl = ph(t, 0.25 * T, 0.25 * T + 1.0)
    kx, ky = tree_pos("keter")
    if kl > 0: ctx.spark(kx, ky, 10 * kl, 2.4)
    # "Projectors need lenses, to take the light and break it": the flash runs down, Tiferet fans it
    fp = ph(t, 0.28 * T, 0.44 * T, ease=False)
    if fp > 0:
        ctx.line(flash_path(), GOLD, 5, fp)
        head = partial(flash_path(), fp)[-1]; ctx.spark(*head, 7, 2.0)   # a travelling bead at the head of the beam
    tf = ph(t, 0.44 * T, 0.56 * T)
    # "a bit of imperfection can be perfect / but it can also be imperfect / the lens had to be both":
    # the fan is clean, then it shakes, then it settles with a double ring
    wob = ph(t, 0.70 * T, 0.72 * T) * (1 - ph(t, 0.84 * T, 0.88 * T))
    if tf > 0:
        tx, ty = tree_pos("tiferet"); mx, my = tree_pos("malkuth")
        for k in range(-3, 4):
            jx = wob * math.sin(t * 19 + k * 1.3) * 26; jy = wob * math.cos(t * 23 + k) * 12
            ex = mx + k * 95 + jx; ey = my + 150 + jy
            ctx.line([(tx, ty), (ex, ey)], GOLD_SOFT if k else GOLD, 2 if k else 4, tf)
        ctx.circle(tx, ty, 22 * TREE_SCALE, GOLD, 4, fill=PAPER)
        both = ph(t, 0.88 * T, 0.92 * T)
        if both > 0: ctx.circle(tx, ty, (22 * TREE_SCALE + 9) * both, GOLD, 2)
    # Malkuth becomes the screen
    sp = ph(t, 0.56 * T, 0.64 * T)
    if sp > 0:
        mx, my = tree_pos("malkuth")
        ctx.circle(mx, my, 22 * TREE_SCALE + 10 * sp, GOLD, 4, fill=mix(PAPER, GOLD_SOFT, sp))

def _sparks(T, n=46, seed=4):
    rng = random.Random(seed); tx, ty = tree_pos("tiferet"); out = []
    for i in range(n):
        ang = rng.uniform(0, 2 * math.pi); sp = rng.uniform(90, 330)
        out.append((tx, ty, math.cos(ang) * sp, math.sin(ang) * sp - 120, rng.uniform(3, 6)))
    return out
US_X = [700, 860, 1060, 1230]   # where four sparks land and stand up

def s4(ctx, t, T):
    """bad choices: the lens strains, cracks, bursts into sparks; four land and stand up."""
    draw_tree(ctx, INK, 3, 1.0)
    kx, ky = tree_pos("keter"); tx, ty = tree_pos("tiferet")
    ctx.spark(kx, ky, 10, 2.4)
    burst = 0.50 * T
    if t < burst:
        ctx.line(flash_path()[:6], GOLD, 5)           # Kether → Tiferet
        wob = ph(t, 0.10 * T, 0.35 * T, ease=False)
        j = wob * 9 * math.sin(t * 23) if wob > 0 else 0
        # the lens tries to switch the reel: it twists; the fan below swings with it
        tw = wob * math.sin(t * 2.2) * 0.5
        mx, my = tree_pos("malkuth")
        for k in range(-3, 4):
            ang = math.atan2(my + 150 - ty, mx + k * 95 - tx) + tw
            L = math.hypot(my + 150 - ty, mx + k * 95 - tx)
            ctx.line([(tx + j, ty), (tx + j + math.cos(ang) * L, ty + math.sin(ang) * L)], GOLD_SOFT if k else GOLD, 2 if k else 4)
        ctx.circle(tx + j, ty, 22 * TREE_SCALE, GOLD, 4, fill=PAPER)
        cr = ph(t, 0.36 * T, 0.49 * T, ease=False)
        if cr > 0:  # cracks radiate from the lens
            rng = random.Random(7)
            for i in range(7):
                a = rng.uniform(0, 2 * math.pi); L = rng.uniform(40, 120)
                pts = [(tx + j, ty)]
                for s in range(1, 4): pts.append((tx + j + math.cos(a + rng.uniform(-0.5, 0.5)) * L * s / 3, ty + math.sin(a + rng.uniform(-0.5, 0.5)) * L * s / 3))
                ctx.line(pts, INK, 2, cr)
        return
    # after the burst: no lens — the beam stops at a broken ring, light scatters
    ctx.line(flash_path()[:6], GOLD, 5)
    rng = random.Random(11)
    for i in range(9):
        a = rng.uniform(-0.3, math.pi + 0.3); L = rng.uniform(60, 200) * (0.6 + 0.4 * math.sin(t * 3 + i))
        ctx.line([(tx, ty), (tx + math.cos(a) * L, ty + math.sin(a) * L)], GOLD_SOFT, 2)
    ctx.line([(tx - 18, ty - 12), (tx - 6, ty + 8), (tx + 10, ty - 10), (tx + 20, ty + 6)], INK, 3)   # the broken ring
    # sparks fall
    dt = t - burst; g = 420
    for i, (sx, sy, vx, vy, r) in enumerate(_sparks(T)):
        x = sx + vx * dt; y = sy + vy * dt + 0.5 * g * dt * dt
        if i < 4:   # the four that become us: they land, lie glowing, and stand up on "Us"
            land = (-(vy) + math.sqrt(vy * vy + 2 * g * (GROUND_Y - sy))) / g
            if dt < land: ctx.spark(x, y, r)
            else:
                up = ph(t, 0.66 * T, 0.70 * T)
                step = ph(t, 0.88 * T, 0.94 * T) * (-1 if i % 2 else 1) * 28     # "and started making choices": a step each way
                gx = US_X[i] + step
                ctx.spark(gx, GROUND_Y - 4, r * (1 - up) * (1 + 0.3 * math.sin(t * 5 + i)) + 0.1)
                if up > 0: stick(ctx, gx, GROUND_Y, 70, INK, 3, progress=up, walk=(t * 9) if 0 < ph(t, 0.88 * T, 0.94 * T) < 1 else 0)
        elif y < 1200: ctx.spark(x, y, r)
    gp = ph(t, burst + 0.3, burst + 1.5)
    ctx.line([(300, GROUND_Y), (1620, GROUND_Y)], INK, 3, gp)

def _shards(seed=21, n=11):
    rng = random.Random(seed); out = []
    for i in range(n):
        cx = rng.choice([x for x in range(380, 1560, 60) if abs(x - 960) > 90]); cy = GROUND_Y - rng.uniform(10, 40)
        out.append(shard_poly(rng, cx, cy, rng.uniform(26, 48)))
    return out
ICONS = ["circle", "square", "tri", "zig", "star", "cross", "arc", "dot3", "diamond", "wave", "spiral"]
def icon(ctx, kind, x, y, s=16, col=INK, progress=1.0):
    if kind == "circle": ctx.circle(x, y, s, col, 2, progress=progress)
    elif kind == "square": ctx.poly([(x - s, y - s), (x + s, y - s), (x + s, y + s), (x - s, y + s)], col, 2, progress=progress)
    elif kind == "tri": ctx.poly([(x, y - s), (x + s, y + s), (x - s, y + s)], col, 2, progress=progress)
    elif kind == "zig": ctx.line([(x - s, y), (x - s / 2, y - s), (x, y), (x + s / 2, y - s), (x + s, y)], col, 2, progress)
    elif kind == "star": ctx.poly([(x + s * math.cos(math.pi / 2 + k * 4 * math.pi / 5), y - s * math.sin(math.pi / 2 + k * 4 * math.pi / 5)) for k in range(5)], col, 2, progress=progress)
    elif kind == "cross": ctx.line([(x - s, y), (x + s, y)], col, 2, progress); ctx.line([(x, y - s), (x, y + s)], col, 2, progress)
    elif kind == "arc": ctx.line([(x - s + 2 * s * k / 10, y - s * math.sin(math.pi * k / 10)) for k in range(11)], col, 2, progress)
    elif kind == "dot3": [ctx.dot(x + (k - 1) * s * 0.8, y, 4, col) for k in range(3) if progress > k / 3]
    elif kind == "diamond": ctx.poly([(x, y - s), (x + s, y), (x, y + s), (x - s, y)], col, 2, progress=progress)
    elif kind == "wave": ctx.line([(x - s + 2 * s * k / 12, y + s * 0.5 * math.sin(2 * math.pi * k / 12)) for k in range(13)], col, 2, progress)
    elif kind == "spiral": ctx.line([(x + (s * k / 24) * math.cos(k * 0.6), y + (s * k / 24) * math.sin(k * 0.6)) for k in range(25)], col, 2, progress)

def s5(ctx, t, T):
    """jagged edges: each shard throws its own beam to its own picture; a figure in the middle."""
    draw_tree(ctx, FAINT, 2, 1.0)
    ctx.line([(300, GROUND_Y), (1620, GROUND_Y)], INK, 3)
    shards = _shards(); rng = random.Random(5)
    look = math.sin(t * 0.9) * 0.6
    stick(ctx, 960, GROUND_Y, 70, INK, 3, lean=look)
    for i, sh in enumerate(shards):
        ctx.poly(sh, INK, 2, progress=ph(t, 0.02 * T + i * 0.3, 0.02 * T + i * 0.3 + 0.8))
        cx = sum(p[0] for p in sh) / len(sh); cy = sum(p[1] for p in sh) / len(sh)
        ang = rng.uniform(-2.9, -0.25) if i % 2 else rng.uniform(-2.6, -0.5); L = rng.uniform(260, 520)
        bp = ph(t, 0.12 * T + i * 0.035 * T, 0.12 * T + i * 0.035 * T + 1.6, ease=False)
        if bp > 0:
            ex, ey = cx + math.cos(ang) * L, cy + math.sin(ang) * L
            ctx.line([(cx, cy), (ex, ey)], GOLD, 2, bp)
            if bp >= 1: icon(ctx, ICONS[i % len(ICONS)], ex, ey, 16, INK, ph(t, 0.12 * T + i * 0.035 * T + 1.6, 0.12 * T + i * 0.035 * T + 2.4))
    # material reality kicks in: boxes rise from the ground, left and right
    mr = ph(t, 0.80 * T, 0.95 * T)
    if mr > 0:
        rng2 = random.Random(9)
        for k in range(8):
            x = 330 + k * 60 if k < 4 else 1380 + (k - 4) * 60; h = rng2.uniform(40, 130) * mr
            ctx.poly([(x, GROUND_Y), (x, GROUND_Y - h), (x + 46, GROUND_Y - h), (x + 46, GROUND_Y)], INK, 2)

def robe(ctx, x, y, h=120, col=INK, width=3, tilt=0.0, arm_up=False, progress=1.0, walk=0.0):
    """the caretaker: triangle robe, circle head, scribbled beard."""
    hr = h * 0.12; top = y - h
    # tilt rotates about the feet (fall over)
    def R(px, py):
        dx, dy = px - x, py - y; c, s = math.cos(tilt), math.sin(tilt)
        return (x + dx * c - dy * s, y + dx * s + dy * c)
    ctx.poly([R(x, top + 2 * hr), R(x + h * 0.28, y), R(x - h * 0.28, y)], col, width, progress=clamp(progress * 2))
    ctx.circle(*R(x, top + hr), hr, col, width, progress=clamp(progress * 2 - 1))
    if progress > 0.6:
        rng = random.Random(3); pts = []
        for k in range(14):
            px = x - hr * 0.9 + (k / 13) * hr * 1.8; py = top + hr * 1.5 + abs(math.sin(k * 1.7)) * hr * 1.1 + rng.uniform(-2, 2)
            pts.append(R(px, py))
        ctx.line(pts, col, 2)
    sh = R(x, top + 3 * hr)
    if arm_up: ctx.line([sh, R(x + h * 0.30, top + 1.5 * hr)], col, width); ctx.line([R(x + h * 0.30, top + 1.5 * hr), R(x + h * 0.30, top + 0.6 * hr)], col, width)  # thumb
    else: ctx.line([sh, R(x + h * 0.32, y - h * 0.45)], col, width)

BYSTANDERS = [640, 760, 1160, 1280]   # where the four of us stand in slides 6–7
ROBE_X = 450                          # where the caretaker stops
def s6(ctx, t, T):
    """He Alone Could Fix It: the robe gathers the shards into a crooked cube; the Tree droops."""
    droop = ph(t, 0.30 * T, 0.92 * T, ease=False) * 1.0
    draw_tree(ctx, FAINT, 2, 1.0, droop=droop)
    ctx.line([(300, GROUND_Y), (1620, GROUND_Y)], INK, 3)
    for gx in BYSTANDERS: stick(ctx, gx, GROUND_Y, 70)   # we stand aside, watching
    enter = ph(t, 0.04 * T, 0.20 * T, ease=False)
    rx = lerp(ROBE_X - 170, ROBE_X, enter)
    build = ph(t, 0.26 * T, 0.62 * T, ease=False)
    shards = _shards()
    rng = random.Random(33); cube_c = (960, GROUND_Y - 190)
    jit = [(rng.uniform(-22, 22), rng.uniform(-22, 22)) for _ in range(8)]
    target = cube_pts(cube_c[0], cube_c[1], 130, 0.3, 0.6, depth=1)
    for i, sh in enumerate(shards):
        cx = sum(p[0] for p in sh) / len(sh); cy = sum(p[1] for p in sh) / len(sh)
        f = clamp(build * len(shards) - i)
        tx, ty = target[i % 8]
        off = (lerp(0, tx - cx, smooth(f)), lerp(0, ty - cy, smooth(f)))
        sc = 1 - 0.7 * smooth(f)
        ctx.poly([(cx + (p[0] - cx) * sc + off[0], cy + (p[1] - cy) * sc + off[1]) for p in sh], INK, 2)
    if build > 0: draw_cube(ctx, target, INK, 3, jitter=[(j[0] * build, j[1] * build) for j in jit], progress=build)
    # he stays by the cube; a thumbs-up when it's "done"; a speech bubble with an upward line (things are getting better)
    done = ph(t, 0.72 * T, 0.80 * T)
    robe(ctx, rx, GROUND_Y, 120, INK, 3, arm_up=done > 0.5, progress=1.0, walk=t * 6)
    if done > 0:
        bx, by = rx + 150, GROUND_Y - 190
        ctx.circle(bx, by, 46 * done, INK, 2, fill=PAPER)
        if done >= 1: ctx.line([(bx - 24, by + 16), (bx - 6, by - 2), (bx + 6, by + 8), (bx + 26, by - 18)], INK, 3)
    # glue pot
    if build > 0 and build < 1: ctx.poly([(rx + 60, GROUND_Y - 10), (rx + 60, GROUND_Y - 40), (rx + 90, GROUND_Y - 40), (rx + 90, GROUND_Y - 10)], INK, 2)

def s7(ctx, t, T):
    """shot the hostage: the crooked cube shivers, then blows itself apart; the robe is knocked over."""
    droop = 1.0 - 0.15 * ph(t, 0.55 * T, 0.95 * T)
    draw_tree(ctx, FAINT, 2, 1.0, droop=droop)
    ctx.line([(300, GROUND_Y), (1620, GROUND_Y)], INK, 3)
    for gx in BYSTANDERS: stick(ctx, gx, GROUND_Y, 70)
    boom = 0.50 * T
    rng = random.Random(33); cube_c = (960, GROUND_Y - 190)
    jit = [(rng.uniform(-22, 22), rng.uniform(-22, 22)) for _ in range(8)]
    target = cube_pts(cube_c[0], cube_c[1], 130, 0.3, 0.6, depth=1)
    flash = 1.0 if boom <= t < boom + 0.18 else 0.0
    if flash: return   # the whole frame goes white for a beat
    if t < boom:
        sh = ph(t, 0.10 * T, 0.48 * T, ease=False) * 14
        jj = [(j[0] + rng.uniform(-sh, sh) * 0 + math.sin(t * 37 + k) * sh, j[1] + math.cos(t * 41 + k) * sh) for k, j in enumerate(jit)]
        draw_cube(ctx, target, INK, 3, jitter=jj)
        robe(ctx, ROBE_X, GROUND_Y, 120)
        return
    dt = t - boom
    rng2 = random.Random(44); g = 300
    for i in range(14):
        a = rng2.uniform(-math.pi, 0); sp = rng2.uniform(120, 300)
        x = cube_c[0] + math.cos(a) * sp * dt; y = cube_c[1] + math.sin(a) * sp * dt + 0.5 * g * dt * dt
        if y < 1200:
            r = rng2.uniform(14, 30); poly = shard_poly(random.Random(100 + i), x, y, r)
            ctx.poly(poly, INK, 2)
    # the robe goes over
    robe(ctx, ROBE_X, GROUND_Y, 120, tilt=-math.pi / 2 * ph(dt, 0, 0.7))
    # bunker gag: a box under the ground line, a coin tumbling out
    bk = ph(t, 0.84 * T, 0.90 * T)
    if bk > 0:
        ctx.poly([(1500, GROUND_Y + 40), (1500, GROUND_Y + 110), (1600, GROUND_Y + 110), (1600, GROUND_Y + 40)], INK, 2, progress=bk)
        cp = ph(t, 0.90 * T, 0.98 * T, ease=False)
        if cp > 0:
            cx = 1550 + cp * 110; cy = GROUND_Y + 60 + cp * 120 - 60 * math.sin(cp * math.pi)
            ctx.circle(cx, cy, 11, GOLD, 3); ctx.line([(cx - 5, cy), (cx + 5, cy)], GOLD, 2)

def s8(ctx, t, T):
    """hexes: pieces fall and settle into a flat-top grid; one figure per hex; neighbours join."""
    draw_tree(ctx, FAINT, 2, 1.0, droop=0.8, scale=1.0)
    for i, (q, r) in enumerate(GRID):
        cx, cy = hex_center(q, r)
        t0 = 0.05 * T + i * (0.40 * T / len(GRID))
        fall = ph(t, t0 - 1.2, t0, ease=False)
        if fall <= 0: continue
        if fall < 1:   # a shard falls in from above, then becomes the hex
            y = lerp(-80, cy, fall * fall)
            ctx.poly(shard_poly(random.Random(200 + i), cx, y, 30), INK, 2)
        else:
            ctx.poly(hex_pts(cx, cy), INK, 3, progress=ph(t, t0, t0 + 0.6, ease=False))
        fp = ph(t, 0.50 * T + i * 0.012 * T, 0.50 * T + i * 0.012 * T + 0.6)
        if fp > 0: stick(ctx, cx, cy + 26, 44, INK, 2, progress=fp)
    # neighbours turn to each other: short joins between adjacent hexes
    seen = set(); k = 0
    for (q, r) in GRID:
        for (dq, dr) in HEX_NEIGH:
            n = (q + dq, r + dr)
            if n not in GRID or ((n, (q, r)) in seen): continue
            seen.add(((q, r), n)); k += 1
            jp = ph(t, 0.70 * T + k * 0.006 * T, 0.70 * T + k * 0.006 * T + 0.5)
            if jp <= 0: continue
            a = hex_center(q, r); b = hex_center(*n)
            ctx.line([(lerp(a[0], b[0], 0.3), lerp(a[1], b[1], 0.3) + 4), (lerp(a[0], b[0], 0.7), lerp(a[1], b[1], 0.7) + 4)], GOLD, 3, jp)

WOUND = (0, 0); DARK = [(1, -1), (-1, 1), (2, -2)]; HELPERS = [(-2, 1), (1, 1), (-1, -1)]
BUBBLES = ["circle", "square", "tri"]
def s9(ctx, t, T):
    """still fucking it up: hexes scribble dark, one bleeds; neighbours stand on it until it fades."""
    heal = ph(t, 0.66 * T, 0.90 * T)
    draw_tree(ctx, FAINT, 2, 1.0, droop=0.8 - 0.5 * heal)
    for (q, r) in GRID: ctx.poly(hex_pts(*hex_center(q, r)), INK, 3)
    # scribbles
    for i, cell in enumerate(DARK + [WOUND]):
        sp = ph(t, 0.05 * T + i * 0.04 * T, 0.05 * T + i * 0.04 * T + 2.0, ease=False) * (1 - heal if cell == WOUND or i < 2 else 1 - 0.6 * heal)
        if sp <= 0: continue
        cx, cy = hex_center(*cell); rng = random.Random(300 + i); pts = []
        for k in range(26):
            pts.append((cx + rng.uniform(-44, 44), cy + rng.uniform(-40, 40)))
        ctx.line(pts, mix(PAPER, INK, 0.85), 2, sp)
    # the wound bleeds red along the edges into its neighbours
    wb = ph(t, 0.15 * T, 0.32 * T, ease=False) * (1 - heal)   # "the Fisher King bleeds where the land is wounded"
    if wb > 0:
        wx, wy = hex_center(*WOUND); hp = hex_pts(wx, wy)
        for k in range(6):
            a, b = hp[k], hp[(k + 1) % 6]
            ctx.line([a, b], RED, 4, clamp(wb * 1.5))
            # drips down the lower edges
            if b[1] >= wy or a[1] >= wy:
                dx = lerp(a[0], b[0], 0.5); dy = lerp(a[1], b[1], 0.5)
                ctx.line([(dx, dy), (dx, dy + 70 * clamp(wb * 1.3 - 0.3))], RED, 3)
    # figures
    for i, (q, r) in enumerate(GRID):
        cell = (q, r)
        if cell in HELPERS: continue
        cx, cy = hex_center(q, r); stick(ctx, cx, cy + 26, 44, INK, 2)
    wx, wy = hex_center(*WOUND)
    for i, cell in enumerate(HELPERS):
        sx, sy = hex_center(*cell); mv = ph(t, 0.42 * T + i * 0.04 * T, 0.54 * T + i * 0.04 * T)
        ex, ey = wx + (i - 1) * 40, wy + 26
        x, y = lerp(sx, ex, mv), lerp(sy + 26, ey, mv)
        stick(ctx, x, y, 44, INK, 2, walk=(t * 9) if 0 < mv < 1 else 0)
        bp = ph(t, 0.58 * T + i * 0.04 * T, 0.58 * T + i * 0.04 * T + 0.6)
        if bp > 0 and mv >= 1:
            bx, by = x + 14 + (i - 1) * 6, y - 74 - abs(i - 1) * 10; ctx.circle(bx, by, 17 * bp, INK, 2, fill=PAPER)
            if bp >= 1: icon(ctx, BUBBLES[i], bx, by, 7, INK)

def s10(ctx, t, T):
    """the frontier: pull back; the island; the road; the sparks still out there."""
    z = lerp(1.0, 0.34, ph(t, 0.08 * T, 0.50 * T))
    ctx.zoom = z; ctx.cx = lerp(960, 1180, ph(t, 0.08 * T, 0.50 * T)); ctx.cy = lerp(560, 600, ph(t, 0.08 * T, 0.50 * T))
    draw_tree(ctx, FAINT, 2, 1.0, droop=0.3)
    for (q, r) in GRID:
        cx, cy = hex_center(q, r); ctx.poly(hex_pts(cx, cy), INK, 3); stick(ctx, cx, cy + 26, 44, INK, 2)
    # the road: two lines from the island's east edge to the far right, with a slight wander
    rp = ph(t, 0.50 * T, 0.70 * T, ease=False)
    if rp > 0:
        x0 = hex_center(2, 0)[0] + HEX_R; y0 = 560
        road = [(x0 + k * 90, y0 + 30 * math.sin(k * 0.55) + k * 6) for k in range(0, 34)]
        up = [(x, y - 16) for x, y in road]; dn = [(x, y + 16) for x, y in road]
        ctx.line(up, INK, 3, rp); ctx.line(dn, INK, 3, rp)
    # sparks at the edge of the world, glinting
    sp = ph(t, 0.70 * T, 0.78 * T)
    if sp > 0:
        rng = random.Random(77)
        for i in range(26):
            x = rng.uniform(2900, 3900); y = rng.uniform(-700, 1500)
            tw = 0.55 + 0.45 * math.sin(t * rng.uniform(1.5, 3.5) + i)
            ctx.spark(x, y, 9 * sp * tw, 2.2)

SLIDES = {1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7, 8: s8, 9: s9, 10: s10}

# ── render ───────────────────────────────────────────────────────────────────
def frame(n, t):
    ctx = Ctx(); SLIDES[n](ctx, t, VO[n]); return ctx.out()

def render(args):
    n, out = args
    T = VO[n]; D = T + TAIL; nf = int(round(D * FPS))
    path = os.path.join(out, f"a0_ts{n:02d}.mp4")
    ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                           "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", path], stdin=subprocess.PIPE)
    for i in range(nf):
        ff.stdin.write(frame(n, i / FPS).tobytes())
    ff.stdin.close(); ff.wait()
    return n, nf, path

def preview(n, out):
    T = VO[n]; cols = 4; rows = 3; sheet = Image.new("RGB", (cols * 480, rows * 270), PAPER)
    for k in range(cols * rows):
        t = (T + TAIL) * (k / (cols * rows - 1)) * 0.999
        im = frame(n, t).resize((480, 270), Image.LANCZOS)
        ImageDraw.Draw(im).text((6, 4), f"S{n} t={t:5.1f}s", fill=(120, 120, 120))
        sheet.paste(im, ((k % cols) * 480, (k // cols) * 270))
    p = os.path.join(out, f"preview_s{n}.png"); sheet.save(p); return p

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); ap.add_argument("--slides", default="1,2,3,4,5,6,7,8,9,10")
    ap.add_argument("--preview", action="store_true"); ap.add_argument("--jobs", type=int, default=5)
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    ns = [int(x) for x in a.slides.split(",") if x.strip()]
    if a.preview:
        for n in ns: print(preview(n, a.out))
    else:
        with Pool(min(a.jobs, len(ns))) as pool:
            for n, nf, path in pool.imap_unordered(render, [(n, a.out) for n in ns]):
                print(f"slide {n}: {nf} frames → {path}", flush=True)
