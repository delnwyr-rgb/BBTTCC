#!/usr/bin/env python3
"""build-golden-base.py — make a new golden-master BASE save from two Bad Eden save files (2026-10-02).

    build-golden-base.py <golden.json> <live.json> <out.json> [--label "..."]

WHY: a golden master is a clean turn-1 world. Content (beats, story scripts, NPCs, door drawings, scene setups) keeps
growing on the LIVE world through seeders and patches; play state (turns, factions, hexes held, fired beats, steward
levels) must stay at the golden's. Replaying every content macro since the last golden is fragile, so this script
TRANSPLANTS live content into the golden's state instead. Load the output (Save Games → Import → Load), run whatever
patches are still owed, then save it as the new golden.

THE SPLIT (measured on golden 12 c2bab28jbixz vs live rmh94lhf20ee, 2026-10-02):
  settings  golden's, EXCEPT  bbttcc-campaign.campaigns (live: its beats + story differ, every other campaign field is
            identical) · bbttcc-campaign.quests (golden's rows + live rows that are not play-made "word_*" invitations) ·
            keys the golden lacks get their fresh defaults (FRESH below) · bbttcc-mal-voice.apiKey is DROPPED (the key
            lives in the GM's browser since 2026-10-02; a load must never write it back into the world).
  actors    player-owned (non-GM owner) or faction (flags.bbttcc-factions.isFaction) → golden's; actors the golden lacks
            but live has → live, unless player-owned; everything else (GM NPCs, story characters, rigs) → live, with play
            fields reset to the golden's: flags.bbttcc-factions (war logs…), flags.bbttcc-mal-voice.memories, damage
            (system.derived.integrity.value / stress.value).
  scenes    live's scene body (levels, sizes, renames, tableau config) — a load writes the whole body back; drawings:
            hexes = golden's (ownership, development, travel, visited…) with live's CONTENT fields (campaign hooks,
            resource nodes minus their charges/discovered); every non-hex drawing (doors…) = live's; tokens = golden's +
            live tokens of non-player, non-faction actors that the golden lacks. Scenes the golden has but live deleted
            are left out (a load never deletes a scene).
  journal   golden's (identical to live on 2026-10-02).
"""
import json, sys, time, random, string

GM_IDS = {"bytUGWIOqq9eT7Or"}            # the Gamemaster user on ember (owns 185 of 208 actors)
FRESH = {("bbttcc-campaign", "humRoofs"): 0, ("bbttcc-factions", "opRelayStrict"): False, ("bbttcc-onboarding", "cohorts"): {},
         ("bbttcc-territory", "questMarkers"): "gm", ("fourththing", "actionEconomy"): False}
DROP_SETTINGS = {("bbttcc-mal-voice", "apiKey")}
HEX_CONTENT_FIELDS = ("campaign",)          # hex flags that seeders/patches write (everything else on a hex is play)
NODE_PLAY_FIELDS = ("charges", "discovered")

def load(p): return json.load(open(p))
def parse(v):
    if isinstance(v, str) and v[:1] in "{[":
        try: return json.loads(v), True
        except Exception: pass
    return v, False
def player_owned(a): return any(k not in GM_IDS and k != "default" and v == 3 for k, v in (a.get("ownership") or {}).items())
def is_faction(a): return bool(((a.get("flags") or {}).get("bbttcc-factions") or {}).get("isFaction"))
def hex_flags(d):
    t = (d.get("flags") or {}).get("bbttcc-territory") or {}
    return t if (t.get("isHex") or t.get("kind") == "territory-hex") else None

def main():
    gp, lp, op = sys.argv[1:4]
    label = sys.argv[sys.argv.index("--label") + 1] if "--label" in sys.argv else "Golden 13 base"
    G, L = load(gp), load(lp); rep = []

    # ── settings ──
    ls = {(s["ns"], s["key"]): s["value"] for s in L["settings"]}
    out_settings = []
    for s in G["settings"]:
        k = (s["ns"], s["key"])
        if k in DROP_SETTINGS: rep.append(f"setting DROPPED {k}"); continue
        if k == ("bbttcc-campaign", "campaigns"): out_settings.append({**s, "value": ls[k]}); rep.append("setting campaigns ← live (beats + story)"); continue
        if k == ("bbttcc-campaign", "quests"):
            gv, gstr = parse(s["value"]); lv, _ = parse(ls[k])
            add = {q: r for q, r in lv.items() if q not in gv and not q.startswith("word_")}
            gv = {**gv, **add}; rep.append(f"setting quests ← golden + {sorted(add)}")
            out_settings.append({**s, "value": json.dumps(gv) if gstr else gv}); continue
        out_settings.append(s)
    have = {(s["ns"], s["key"]) for s in out_settings}
    for k, v in FRESH.items():
        if k not in have and k not in DROP_SETTINGS: out_settings.append({"ns": k[0], "key": k[1], "value": v}); rep.append(f"setting fresh {k} = {v!r}")

    # ── actors ──
    ga = {a["_id"]: a for a in G["actors"]}; la = {a["_id"]: a for a in L["actors"]}
    out_actors = []; n = {"golden": 0, "live": 0, "new": 0, "skipped-player": 0}
    for i, g in ga.items():
        l = la.get(i)
        if not l or player_owned(l) or player_owned(g) or is_faction(g) or is_faction(l): out_actors.append(g); n["golden"] += 1; continue
        a = json.loads(json.dumps(l))
        fl = a.setdefault("flags", {})
        if "bbttcc-factions" in (g.get("flags") or {}): fl["bbttcc-factions"] = g["flags"]["bbttcc-factions"]
        else: fl.pop("bbttcc-factions", None)
        mv = fl.get("bbttcc-mal-voice")
        if isinstance(mv, dict):
            gm = ((g.get("flags") or {}).get("bbttcc-mal-voice") or {})
            if "memories" in gm: mv["memories"] = gm["memories"]
            else: mv.pop("memories", None)
        for path in (("derived", "integrity", "value"), ("derived", "stress", "value")):
            src, dst = g.get("system") or {}, a.setdefault("system", {})
            for p in path[:-1]: src = (src or {}).get(p) or {}; dst = dst.setdefault(p, {})
            if path[-1] in src: dst[path[-1]] = src[path[-1]]
        out_actors.append(a); n["live"] += 1
    for i, l in la.items():
        if i in ga: continue
        if player_owned(l): n["skipped-player"] += 1; rep.append(f"actor skipped (player-owned, made in play): {l['name']}"); continue
        a = json.loads(json.dumps(l)); fl = a.setdefault("flags", {})
        if isinstance(fl.get("bbttcc-factions"), dict): fl["bbttcc-factions"]["warLogs"] = []
        if isinstance(fl.get("bbttcc-mal-voice"), dict): fl["bbttcc-mal-voice"].pop("memories", None)
        out_actors.append(a); n["new"] += 1
    rep.append(f"actors: {n}")
    player_ids = {a["_id"] for a in out_actors if player_owned(a)} | {i for i, a in la.items() if player_owned(a)}
    faction_ids = {a["_id"] for a in out_actors if is_faction(a)}

    # ── scenes ──
    gs = {s["_id"]: s for s in G["scenes"]}
    out_scenes = []; hexes = 0; doors = 0; toks = 0
    def keep_token(t): return t.get("actorId") not in player_ids and t.get("actorId") not in faction_ids
    for s in L["scenes"]:
        g = gs.get(s["_id"]); sc = json.loads(json.dumps(s))
        gd = {d["_id"]: d for d in (g or {}).get("drawings", [])}
        dr = []
        for d in s.get("drawings", []):
            t = hex_flags(d)
            if t is not None and d["_id"] in gd:
                h = json.loads(json.dumps(gd[d["_id"]])); ht = h["flags"]["bbttcc-territory"]
                for f in HEX_CONTENT_FIELDS:
                    if f in t: ht[f] = t[f]
                    else: ht.pop(f, None)
                gnodes = {x.get("id"): x for x in (ht.get("resourceNodes") or [])}
                nodes = []
                for x in (t.get("resourceNodes") or []):
                    x = dict(x); gx = gnodes.get(x.get("id"))
                    for f in NODE_PLAY_FIELDS:
                        if gx and f in gx: x[f] = gx[f]
                    nodes.append(x)
                if t.get("resourceNodes") is not None: ht["resourceNodes"] = nodes
                dr.append(h); hexes += 1
            else:
                dr.append(d)
                if ((d.get("flags") or {}).get("bbttcc-travel") or {}).get("locationLink"): doors += 1
        sc["drawings"] = dr
        if g:
            gt = {t["_id"] for t in g.get("tokens", [])}
            sc["tokens"] = list(g.get("tokens", [])) + [t for t in s.get("tokens", []) if t["_id"] not in gt and keep_token(t)]
        else:
            sc["tokens"] = [t for t in s.get("tokens", []) if keep_token(t)]
        toks += len(sc["tokens"])
        out_scenes.append(sc)
    rep.append(f"scenes: {len(out_scenes)} (live bodies) · {hexes} hexes from golden w/ live content fields · {doors} door drawings · {toks} tokens; left out (deleted on live): {[g['name'] for i, g in gs.items() if i not in {s['_id'] for s in L['scenes']}]}")

    snap = {"kind": "bbttcc-savegame", "v": 1, "id": "".join(random.choice(string.ascii_letters + string.digits) for _ in range(12)),
            "label": label, "note": f"built offline {time.strftime('%Y-%m-%d %H:%M')} from {G.get('label')} ({G.get('id')}) + live {L.get('label')} ({L.get('id')}) by build-golden-base.py",
            "at": int(time.time() * 1000), "by": "build-golden-base.py", "world": G.get("world"), "foundry": L.get("foundry"),
            "turn": G.get("turn"), "storyPhase": G.get("storyPhase"), "settings": out_settings, "actors": out_actors, "scenes": out_scenes, "journal": G.get("journal", [])}
    snap["counts"] = {"settings": len(out_settings), "actors": len(out_actors), "items": sum(len(a.get("items") or []) for a in out_actors), "scenes": len(out_scenes),
                      "drawings": sum(len(s.get("drawings") or []) for s in out_scenes), "tokens": toks, "journal": len(snap["journal"])}
    json.dump(snap, open(op, "w"))
    print("\n".join(rep)); print("counts", snap["counts"]); print("wrote", op)

if __name__ == "__main__": main()
