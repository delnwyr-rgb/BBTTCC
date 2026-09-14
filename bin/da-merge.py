#!/usr/bin/env python3
"""da-merge — composite several Dungeon Alchemist .dam maps into one base .dam.

    da-merge --base "Map Dam Test.dam" --out "Fixit composite.dam" \
        --place arc_bay.dam@20,20 --place generator.dam@70,30 [--place ...] [--overview out.png]

Offsets are in TILES (x,y) — where the source map's tile (0,0) lands in the base.
Same scale is guaranteed: every DA map is 1 tile = 1 unit, terrain at 8 sub-cells/tile.

What gets translated (verified against the format 2026-09-14):
  rooms[].parts ("x y" or "x y radius curvature rot"), floors[].tile, pillars positionInCm (×100),
  walls p1/p2 + wallBlockIds keys, wallOpenings + bbi wallOpeningModelData/attachedWall
  wallPieceSection ("x1 y1 x2 y2 a;b;c"), objects removedTiles/removedCeilingTiles,
  buildingBlockInstances center{x,y} + basicWallModelData.wall, foundations mapPosition.
Relative fields (floorPartInfo.partTile, pillar offset, attachmentPointDir) are left alone.

Foundations: each map has the same default ladder (main 0.2 / below -2.2 / cave -2.2 /
level 1 2.6 / level 2 5.0 / level 3 7.4). Same-height levels are MERGED into one shared
foundation per level; positioned (type 1, mapPosition) towers keep their own chain.

Terrain blob = int32 -1, int32 N, N×{int32 id, int32 id, int32 cols, int32 rows, int32 n, uint8[n]}
(texture paint masks at W*8 × H*8), then int32 cols, rows, n, float32[n] heights at (W*8+1)×(H*8+1).
Both terrainLayers (0 = surface, 1 = relief/dig) are blitted; masks are unioned by id.
Mask ids are biome texture slots — sources must share the base's biomeId (checked, warns).
"""
import argparse, base64, json, os, struct, sys, zlib, collections, copy

RES = 8  # sub-cells per tile in current DA saves

# ---------------------------------------------------------------- terrain codec
def parse_terrain(b64):
    raw = base64.b64decode(b64); p = 0
    def i():
        nonlocal p
        v = struct.unpack_from("<i", raw, p)[0]; p += 4; return v
    assert i() == -1, "bad terrain marker"
    n = i(); masks = []
    for _ in range(n):
        a, b, cols, rows, cnt = i(), i(), i(), i(), i()
        assert cnt == cols * rows
        masks.append(dict(a=a, b=b, cols=cols, rows=rows, data=bytearray(raw[p:p + cnt]))); p += cnt
    vc, vr, vn = i(), i(), i()
    assert vn == vc * vr
    h = list(struct.unpack_from(f"<{vn}f", raw, p)); p += vn * 4
    assert p == len(raw), f"terrain trailing bytes: {len(raw) - p}"
    return masks, vc, vr, h

def encode_terrain(masks, vc, vr, h):
    out = bytearray(struct.pack("<ii", -1, len(masks)))
    for m in masks:
        out += struct.pack("<5i", m["a"], m["b"], m["cols"], m["rows"], m["cols"] * m["rows"]); out += bytes(m["data"])
    out += struct.pack("<3i", vc, vr, vc * vr); out += struct.pack(f"<{len(h)}f", *h)
    return base64.b64encode(bytes(out)).decode()

def blit_grid(dst, dcols, drows, src, scols, srows, ox, oy, upsample=1):
    """Copy src (row-major, stride scols) into dst at (ox,oy) sub-cell offset, nearest-neighbour ×upsample."""
    for sy in range(srows * upsample):
        dy = oy + sy
        if not (0 <= dy < drows): continue
        srow = (sy // upsample) * scols
        for sx in range(scols * upsample):
            dx = ox + sx
            if 0 <= dx < dcols:
                dst[dy * dcols + dx] = src[srow + sx // upsample]

# ---------------------------------------------------------------- coordinate shifting
def sh_pair(s, dx, dy):
    """'x y' or 'x y rest...' -> shift first two ints."""
    t = s.split()
    t[0] = str(int(t[0]) + dx); t[1] = str(int(t[1]) + dy)
    return " ".join(t)

def sh_quad(s, dx, dy):
    """'x1 y1 x2 y2 rest...' -> shift first four ints (wallPieceSection, wallBlockIds keys)."""
    t = s.split()
    t[0] = str(int(t[0]) + dx); t[1] = str(int(t[1]) + dy)
    t[2] = str(int(t[2]) + dx); t[3] = str(int(t[3]) + dy)
    return " ".join(t)

def sh_xy(d, dx, dy):
    # DA omits x / y when zero
    d["x"] = d.get("x", 0.0) + dx; d["y"] = d.get("y", 0.0) + dy

def sh_wall(w, dx, dy):
    w["p1"] = sh_pair(w.get("p1", "0 0"), dx, dy); w["p2"] = sh_pair(w.get("p2", "0 0"), dx, dy)

def shift_source(src, dx, dy):
    for r in src["rooms"]:
        r["parts"] = [sh_pair(p, dx, dy) for p in r["parts"]]
    for f in src["floors"]:
        f["tile"] = sh_pair(f.get("tile", "0 0"), dx, dy)
    for p in src["pillars"]:
        # DA omits positionInCm when it is "0 0"
        p["position"]["positionInCm"] = sh_pair(p["position"].get("positionInCm", "0 0"), dx * 100, dy * 100)
    for w in src["walls"]:
        sh_wall(w.setdefault("wall", {}), dx, dy)
        if "wallBlockIds" in w:
            w["wallBlockIds"] = {sh_quad(k, dx, dy): v for k, v in w["wallBlockIds"].items()}
    for o in src["wallOpenings"]:
        o["wallPieceSection"] = sh_quad(o["wallPieceSection"], dx, dy)
    for o in src["objects"]:
        o["removedTiles"] = [sh_pair(t, dx, dy) for t in o.get("removedTiles", [])]
        o["removedCeilingTiles"] = [sh_pair(t, dx, dy) for t in o.get("removedCeilingTiles", [])]
    for b in src["buildingBlockInstances"]:
        sh_xy(b.setdefault("center", {}), dx, dy)
        if "basicWallModelData" in b:
            sh_wall(b["basicWallModelData"].setdefault("wall", {}), dx, dy)
        for k in ("wallOpeningModelData", "attachedWall"):
            if k in b and "wallPieceSection" in b[k]:
                b[k]["wallPieceSection"] = sh_quad(b[k]["wallPieceSection"], dx, dy)
    for f in src["foundations"]:
        if "mapPosition" in f: sh_xy(f["mapPosition"], dx, dy)
    for dcl in src.get("decals", []):
        for k in ("position", "center"):
            if isinstance(dcl.get(k), dict) and "x" in dcl[k]: sh_xy(dcl[k], dx, dy)

# ---------------------------------------------------------------- foundations
def fkey(f):
    """Canonical key for a default-ladder foundation, or None for positioned/odd ones."""
    if "mapPosition" in f or f.get("type") == 1: return None
    h = round(f["height"], 2)
    if h == 0.2 and f.get("priority") == -1: return ("main",)
    if f.get("layer") == -1 and f.get("type") == 2: return ("below",)
    if f.get("layer") == -1 and f.get("priority") == -1: return ("cave",)
    if f.get("type") == 2 and f.get("layer", 0) >= 1: return ("level", f["layer"])
    return None

def merge_foundations(base, src, log):
    """Return {src_fid: merged_fid}; appends new foundations to base as needed."""
    bykey = {}
    for f in base["foundations"]:
        k = fkey(f)
        if k and k not in bykey: bykey[k] = f
    main = bykey[("main",)]
    remap = {}
    src_main = [f for f in src["foundations"] if fkey(f) == ("main",)]
    src_main_id = src_main[0]["id"] if src_main else None
    for f in src["foundations"]:
        k = fkey(f)
        if k is None:
            # positioned tower / unknown: keep, but re-point its base if it chained on the source main
            nf = copy.deepcopy(f)
            base["foundations"].append(nf); remap[f["id"]] = nf["id"]; log(f"  foundation {f['id'][:8]} kept (positioned/type {f.get('type')})")
        elif k in bykey:
            remap[f["id"]] = bykey[k]["id"]
        else:
            nf = copy.deepcopy(f); base["foundations"].append(nf); bykey[k] = nf; remap[f["id"]] = nf["id"]
            log(f"  foundation {k} added from source (h={f['height']})")
    # second pass: fix link ids on every base foundation that came from this source or is a ladder node
    for f in base["foundations"]:
        for key in ("foundationAboveId", "foundationBelowId", "baseFoundationId"):
            if key in f and f[key] in remap: f[key] = remap[f[key]]
    # rebuild the default ladder chain: below <-> main <-> level1 <-> level2 <-> ...
    ladder = [bykey.get(("below",)), main] + [bykey[k] for k in sorted(k for k in bykey if k[0] == "level")]
    ladder = [f for f in ladder if f]
    for i, f in enumerate(ladder):
        if i > 0: f["foundationBelowId"] = ladder[i - 1]["id"]
        if i + 1 < len(ladder): f["foundationAboveId"] = ladder[i + 1]["id"]
        else: f.pop("foundationAboveId", None)
        if f is not ladder[0] or ("below",) in bykey: f["baseFoundationId"] = main["id"]
    if ("cave",) in bykey: bykey[("cave",)]["baseFoundationId"] = bykey[("cave",)]["id"]
    return remap

# ---------------------------------------------------------------- main merge
def merge(base_path, out_path, placements, overview=None, log=print):
    base = json.load(open(base_path))
    BW, BH = base["width"], base["height"]
    log(f"base {os.path.basename(base_path)}: {BW}x{BH} tiles, biome {base['settings']['biomeData']['biomeId'][:12]}")
    # decode base terrain layers
    layers = []
    for t in base["terrainLayers"]:
        masks, vc, vr, h = parse_terrain(t["terrain"])
        assert vc == BW * RES + 1 and vr == BH * RES + 1, "base terrain dims mismatch"
        layers.append(dict(masks={(m["a"], m["b"]): m for m in masks}, vc=vc, vr=vr, h=h))
    all_ids = set()
    def collect_ids(d):
        for coll in ("foundations", "rooms", "floors", "pillars", "walls", "wallOpenings", "objects", "buildingBlockInstances"):
            for r in d[coll]: all_ids.add(r["id"])
    collect_ids(base)
    floor_h = max([f["height"] for f in base["floors"]] + [0])
    for src_path, (ox, oy) in placements:
        src = json.load(open(src_path)); name = os.path.basename(src_path)
        SW, SH = src["width"], src["height"]
        log(f"+ {name}: {SW}x{SH} at tile ({ox},{oy}) -> covers x {ox}..{ox+SW}, y {oy}..{oy+SH}")
        if ox < 0 or oy < 0 or ox + SW > BW or oy + SH > BH:
            sys.exit(f"  !! {name} does not fit inside the base map")
        if src["settings"]["biomeData"]["biomeId"] != base["settings"]["biomeData"]["biomeId"]:
            log(f"  ! biome differs from base — texture paint masks skipped for {name}")
            skip_masks = True
        else: skip_masks = False
        # id collisions
        before = len(all_ids); collect_ids(src)
        n_new = sum(len(src[c]) for c in ("foundations", "rooms", "floors", "pillars", "walls", "wallOpenings", "objects", "buildingBlockInstances"))
        if len(all_ids) - before != n_new: log("  ! GUID collision detected (unexpected) — check output carefully")
        # foundations first (returns id remap), then shift, then append
        remap = merge_foundations(base, src, log)
        shift_source(src, ox, oy)
        for coll in ("rooms", "floors", "pillars", "walls", "wallOpenings", "objects"):
            for r in src[coll]:
                if r.get("foundationId") in remap: r["foundationId"] = remap[r["foundationId"]]
        # floors.height = placement order; keep unique across sources
        for f in src["floors"]:
            f["height"] = f["height"] + floor_h
        floor_h = max([f["height"] for f in src["floors"]] + [floor_h])
        for coll in ("rooms", "floors", "pillars", "walls", "wallOpenings", "decals", "objects", "overlays", "buildingBlockInstances"):
            base[coll].extend(src.get(coll, []))
        # workshop items
        for gid, rec in src.get("usedWorkshopItems", {}).items():
            if gid in base["usedWorkshopItems"]: base["usedWorkshopItems"][gid]["uses"] += rec.get("uses", 0)
            else: base["usedWorkshopItems"][gid] = rec
        # terrain
        for li, t in enumerate(src["terrainLayers"]):
            if li >= len(layers): log(f"  ! source has terrain layer {li} but base does not — skipped"); continue
            masks, vc, vr, h = parse_terrain(t["terrain"])
            res = (vc - 1) // SW; up = RES // res
            L = layers[li]
            blit_grid(L["h"], L["vc"], L["vr"], h, vc, vr, ox * RES, oy * RES, upsample=up)
            if up != 1: log(f"  terrain layer {li}: {res}/tile upsampled x{up}")
            if skip_masks: continue
            for m in masks:
                key = (m["a"], m["b"])
                if key not in L["masks"]:
                    L["masks"][key] = dict(a=m["a"], b=m["b"], cols=BW * RES, rows=BH * RES, data=bytearray(BW * RES * BH * RES))
                blit_grid(L["masks"][key]["data"], BW * RES, BH * RES, m["data"], m["cols"], m["rows"], ox * RES, oy * RES, upsample=RES // (m["cols"] // SW))
        log(f"  merged: rooms {len(src['rooms'])} floors {len(src['floors'])} walls {len(src['walls'])} objects {len(src['objects'])} blocks {len(src['buildingBlockInstances'])} workshop {len(src.get('usedWorkshopItems', {}))}")
    # re-encode terrain
    for li, L in enumerate(layers):
        ms = [L["masks"][k] for k in sorted(L["masks"])]
        base["terrainLayers"][li]["terrain"] = encode_terrain(ms, L["vc"], L["vr"], L["h"])
        base["terrainLayers"][li]["waterMap"] = f"{L['vc']} {L['vr']} "
    with open(out_path, "w") as fp:
        json.dump(base, fp, indent=2, ensure_ascii=False)
    log(f"wrote {out_path} ({os.path.getsize(out_path)//1024} KB): foundations {len(base['foundations'])} rooms {len(base['rooms'])} floors {len(base['floors'])} objects {len(base['objects'])} blocks {len(base['buildingBlockInstances'])}")
    if overview: write_overview(base, layers, overview, log)
    return base

# ---------------------------------------------------------------- overview png
def write_overview(base, layers, path, log, scale=2):
    BW, BH = base["width"], base["height"]; W, H = BW * scale, BH * scale
    img = bytearray(W * H * 3)
    L = layers[-1]; lo, hi = min(L["h"]), max(L["h"])
    for y in range(H):
        for x in range(W):
            v = L["h"][(y * RES // scale) * L["vc"] + (x * RES // scale)]
            g = int(90 + 120 * (v - lo) / (hi - lo + 1e-9)); k = (y * W + x) * 3; img[k] = g; img[k + 1] = g; img[k + 2] = g
    def px(x, y, c):
        if 0 <= x < W and 0 <= y < H: k = (y * W + x) * 3; img[k:k + 3] = bytes(c)
    for r in base["rooms"]:
        for p in r["parts"]:
            tx, ty = map(int, p.split()[:2])
            for a in range(scale):
                for b in range(scale): px(tx * scale + a, ty * scale + b, (200, 60, 60))
    bbi = {b["id"]: b for b in base["buildingBlockInstances"]}
    for o in base["objects"]:
        b = bbi.get(o["buildingBlockInstanceId"])
        if b and "center" in b: px(int(b["center"]["x"] * scale), int(b["center"]["y"] * scale), (255, 230, 0))
    for w in base["walls"]:
        x1, y1 = map(int, w["wall"]["p1"].split()); px(x1 * scale, y1 * scale, (255, 255, 255))
    rows = b''.join(b'\x00' + bytes(img[y * W * 3:(y + 1) * W * 3]) for y in range(H))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 6)) + chunk(b'IEND', b''))
    log(f"overview -> {path}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--place", action="append", default=[], help="source.dam@X,Y (tile offset)")
    ap.add_argument("--overview", help="write a PNG overview of the composite")
    a = ap.parse_args()
    pl = []
    for p in a.place:
        path, at = p.rsplit("@", 1); x, y = map(int, at.split(","))
        pl.append((path, (x, y)))
    if os.path.abspath(a.out) == os.path.abspath(a.base): sys.exit("refusing to overwrite the base; pick a new --out")
    merge(a.base, a.out, pl, overview=a.overview)
