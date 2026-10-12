# Bad Eden rig icons — top-down rig / mechsuit / infrastructure tokens

## Vehicles (2026-10-11): "Post Apo Assets" purchased pack
60 top-down post-apocalyptic vehicles from **Agnesagraphic DnD Maps** (Patreon),
product "1150 Post-Apocalyptic RPG Maps: A World of Total Destruction + Assets 60
Vehicles, 100 Token Border Frames, 200 Portraits, DnD maps". Purchased by David English
on 2026-10-11. Licence, from the product page: "Commercial Use Rights: Use these maps
freely in your personal and commercial projects." Proof of terms:
`LICENSE-agnesagraphic-post-apo-2026-10-11.png` (screenshot of the product page).
Source files: `~/Downloads/Post Apo Assets/Post-Apo AssetN ..png` (2048 px RGBA);
trimmed to the alpha bounds, squared, resized to 512 px webp (q88).
The same purchase also includes 1150 battle maps, 100 token border frames and
200 portraits (beasts, monsters, cultists, fanatics, survivors, traders, warriors) — not imported.

These REPLACE the 2026-10-10 Dungeon Alchemist screenshot renders for the rig classes.
Files keep the slot names so the restamp + seed macros still resolve:

| File | Pack asset | | File | Pack asset |
|---|---|---|---|---|
| personal_rig_1 | 12 spiked flame truck | | medium_rig_1 | 29 spiked war-tank (Evil Bad Rig) |
| personal_rig_2 | 21 armoured buggy | | mechsuit_7 | 60 spider walker |
| personal_rig_3 | 22 APC | | heavy_rig_1–18 | 1 2 3 4 5 6 7 17 18 19 20 25 30 31 32 33 37 38 |
| personal_rig_4 | 26 flame-gun truck | | bus_1–3 | 8 9 10 |
| personal_rig_5 | 43 open-frame buggy (Chopper Four) | | aircraft_1–5 | 13 14 15 16 39 |
| personal_rig_6 | 45 jeep, flames | | boat_1–2 | 47 48 |
| personal_rig_7 | 54 yellow/teal hot-rod (Vila's Dreammobile) | | personal_rig_14–30 | 11 23 24 27 28 34 35 36 40 41 42 44 50 51 56 58 59 |
| personal_rig_8 | 49 neon sports car | | | |
| personal_rig_9 | 52 loaded pickup | | | |
| personal_rig_10 | 53 glowing hot-rod | | | |
| personal_rig_11 | 55 black interceptor | | | |
| personal_rig_12 | 57 blue muscle car | | | |
| personal_rig_13 | 46 spiked rover | | | |

## Still Dungeon Alchemist renders (2026-10-10, David English)
Rendered in DA from already-vetted DA assets (native library + licensed custom imports,
credited with the DA imports), cut out, trimmed and resized:
- mechsuit_1–6 (512 px) — the pack has only one walker, so these stay until Dave picks.
- infrastructure_1–4 (512 px) · watchtower · wall · junk_wall_1–2 · pylon (1024 px long side).

Wired by: `tools/restamp-rig-art-2026-10-10.macro.js` (live ember actors + npcs pack)
and `bbttcc-master-content/tools/seed-rigs-facilities-bosses.macro.js` (new seeds).

## Structures (2026-10-11): cut from the same Agnesagraphic map pack
Standalone structures lifted from "1150 Post-Apocalyptic RPG Maps" (same purchase + licence as
the vehicles above): generous crop from the High Res map → rembg (isnet-general-use, alpha
matting) → trimmed, squared, 512 px webp. Picked by Dave 2026-10-11 from the 22-keeper pilot
(`~/bad_eden_file_repository/postapo-structures/`).

| File | Source map | Object |
|---|---|---|
| cooling_tower_1 | Nuclear Power Plants 10 | cooling tower, pink |
| cooling_tower_2 | Nuclear Power Plants 23 | cooling tower, blue-lit |
| dome_1 | Wastelands 42 | glass dome |
| fuel_tank_1 | Industrial and Factories 29 | orange round tank |
| fuel_tank_2 | Military Bases 16 | rusted round tank, hatched |
| tower_1 | Wastelands 99 | tall rusty tower |
| dish_array_1 | Wastelands 66 | satellite dish cluster |

Not bound to any actor yet (new names; the DA infrastructure/watchtower/pylon slots are untouched).
