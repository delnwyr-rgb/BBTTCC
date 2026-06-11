# Adapter Seam — Next-Session Prep

> Companion to `SHIP_ROADMAP.md` (Phase 1 linchpin, §4 / Decision D3).
> Built 2026-06-10 from a **fresh recon of current code** — corrects the stale
> seam map the roadmap inherited from the 2026-05-26 memory. Read this before
> touching the adapter; the roadmap's §4 line counts and file:lines were wrong.

## TL;DR — what changed vs. the roadmap's assumptions

| Roadmap (§4, 2026-05-26) | Reality (verified 2026-06-10) |
|---|---|
| Fulcrum `_applyDamageToActor` at `module.js:9924` | **Now `module.js:13771`** (file grew; old line stale). Structures' own comments cite `8083` — also stale. |
| "~30 call sites across raid + structures" | **~6–7 real runtime call sites** (+ 1 macro/tool). The "30" conflated internal system callers with cross-module ones. |
| 8-method contract all needed cross-module | **Only `applyDamage` is called cross-module.** `resistsForcedMove`, `applyManifestationStates`, `getHealth`, `getRole`, `rollCheck` are **internal to the system** — raid/structures never call them. They belong in the contract for the *dnd5e impl's* sake, but they are NOT call-site migrations. |
| (not mentioned) | 🚨 **`bbttcc-structures` MONKEY-PATCHES the fulcrum** (`damage-wedge.js`). This is the single biggest extraction risk and the roadmap omits it entirely. See §3. |

**Net:** the call-site swap is *smaller* than feared; the *wedge* is the real work.

## 1. The fulcrum — verified

`game.fourththing.rolls._applyDamageToActor(actor, baseDmg, opts)` — defined
`systems/fourththing/module.js:13771`. Returns a human-readable description
string. `opts` seen in the wild: `{ damageType, op="damage", perTargetMultiplier,
bypassThreshold, noSalvage, nonlethal, ... }`. Siblings in the `rolls` namespace
that also matter: `rolls.applyDamageFromButton` (the Apply-Damage button handler;
**also wedged**, by `bbttcc-structures/scripts/bulwark-hookups.js`, to capture the
source actor).

## 2. Real cross-module call sites (the migration list)

**bbttcc-raid (runtime):**
- `scripts/raid-scene-intents.enhancer.js:182` — AOE `damageSceneTokens`
- `scripts/module.raid-console.js:5879` — ladder-semantics damage
- `scripts/module.raid-console.js:8625`
- `scripts/siege-counter-activities.js:362`
- `scripts/agent-action-verbs.js:232` — via `_resolveFn("game.fourththing.rolls._applyDamageToActor")` (string-resolved! grep won't catch as a normal call; declares side-effects `sockets:["fourththingDamageRelay"]`, `hooks:["bbttcc:damage:applied"]`)

**bbttcc-structures (runtime):**
- `scripts/collapse.js:311` — collapse damage (deliberately calls fulcrum *directly* to bypass its own wedge)
- `scripts/structure-sheet-panel.enhancer.js:383` — Apply-Damage button

**Macro/tool (not runtime, migrate last or leave):**
- `modules/bbttcc-structures/macros/damage-structure.macro.js:21`

## 3. 🚨 The wedge complication (the headline)

`bbttcc-structures/scripts/damage-wedge.js` does, at ready:
```js
_originalApplyDamage = game.fourththing.rolls._applyDamageToActor;
game.fourththing.rolls._applyDamageToActor = async function wedged(actor, baseDmg, opts) {
  // intercept ONLY when actor.flags["bbttcc-structures"].hasStructure && op==="damage"
  // → route through Structure integrity/plates/threshold/salvage path,
  //   else delegate to _originalApplyDamage.
};
```
Plus `bulwark-hookups.js` similarly wraps `rolls.applyDamageFromButton` to capture
the source actor (for Catastrophic Entry / Bulwark frame-dice).

**Why it matters for extraction:** if we hide the fulcrum behind
`game.bbttcc.combat.applyDamage`, the structures wedge — which patches the *raw*
`rolls._applyDamageToActor` — silently stops intercepting (callers now go through
the adapter, not the patched function). Three options to evaluate next session:

1. **Wedge the adapter instead.** Structures patches `game.bbttcc.combat.applyDamage`
   the same way. Cleanest conceptually; structures is Layer B so it's allowed to
   know about the RFI combat impl. But the adapter becomes a patch target → fragile.
2. **Convert the wedge to a registered pre-damage interceptor.** Adapter exposes
   `combat.registerDamageInterceptor(fn)`; structures registers its hasStructure
   router. Turns a monkeypatch into a supported extension point. **Preferred** —
   it's the "make the implicit seam explicit" move and survives the rename.
3. **Hook-based.** Adapter fires `bbttcc:combat:preApplyDamage` (cancelable);
   structures listens. Loosest coupling; risk = ordering/async with the existing
   `bbttcc:damage:applied` post-hook.

This decision is a prerequisite to swapping call sites — resolve it FIRST.

## 4. Revised method contract

Keep the 8-method `game.bbttcc.combat` shape from roadmap §4 (the dnd5e impl
needs all of it), but tag by who actually calls it:

| Method | Cross-module caller today? | Extraction action |
|---|---|---|
| `applyDamage` | ✅ raid + structures (§2) | swap ~7 call sites; resolve wedge (§3) |
| `applyDamageFromButton`(or fold into applyDamage) | ✅ structures (wedged) | part of the wedge decision |
| `resistsForcedMove` | ❌ internal only | register RFI impl; dnd5e wrapper; no call-site swap |
| `applyManifestationStates`/`applyCondition` | ❌ internal only | same |
| `getHealth` / `getRole` / `hasCondition` / `rollCheck` | ❌ not found cross-module | provide for dnd5e impl completeness; verify with a deeper grep before building |
| `heal` | ❓ verify (grep `heal` in modules) | TBD |

## 5. Side-effect contract to preserve (don't drop these)

- Socket: `fourththingDamageRelay` (GM-resolved damage application across clients).
- Hook: `bbttcc:damage:applied` (fired post-damage; downstream listeners).
- The description-string return value (callers display it / log it).

The adapter `applyDamage` must keep firing the socket + hook and returning the
string, or raid's audit log + multi-client damage break.

## 6. Proposed step order for next session

1. **Deeper recon** (30 min): grep modules for `heal`, `getHealth`, `applyDamageFromButton`,
   `fourththingDamageRelay`, `bbttcc:damage:applied`; read the wedge + bulwark-hookups
   in full; confirm no other `rolls.*` cross-module callers. Lock the true surface.
2. **Decide the wedge strategy** (§3) — recommend option 2 (registered interceptor).
3. **Define `game.bbttcc.combat`** in `bbttcc-core` (the API registry) as an interface
   + a no-op/throw default, so call sites can adopt it before the impl lands.
4. **Register the RFI impl** from the system: `game.bbttcc.combat.applyDamage = (…) =>
   game.fourththing.rolls._applyDamageToActor(…)` (thin alias first — zero behavior
   change), wiring the interceptor registry for structures.
5. **Swap the ~7 call sites** raid/structures → `game.bbttcc.combat.applyDamage`. One
   commit, behavior-identical. Live-test damage in a raid + a structure collapse.
6. **Only then** build the dnd5e impl (separate session) — that's Phase 1 proper.

Steps 3–5 are "insert adapter + alias + swap, no behavior change" — the safe,
committable unit. The dnd5e impl is the actual decoupling and comes after.

## 7. RESOLVED — structures are Layer A, damageable on dnd5e (owner, 2026-06-10)

**Decision:** "Structures must function within the D&D damage footprint —
stewards can damage them directly." So `bbttcc-structures` is **Layer A
(system-agnostic)**, NOT Layer B. Implications, all consistent with the
interceptor approach (§3 option 2):

- **Interceptor MUST be system-agnostic.** It operates only on `amount`,
  `damageType`, and the structure's own `flags["bbttcc-structures"]` — never
  `game.fourththing.*`. On dnd5e, a steward's attack on a `hasStructure` actor
  makes the interceptor claim the target and run the integrity/plates/threshold/
  salvage model **instead of** dnd5e's native HP subtraction; normal actors fall
  through to the native impl. The interceptor **short-circuits** the adapter (it
  fully handles the target; adapter does not also call native).
- **Feasibility is GOOD — the damage model is already agnostic.** Recon
  2026-06-10: `damage-path.js` (the integrity/plates/threshold/salvage math) has
  **zero `fourththing` coupling**. The only RFI coupling in structures is:
    (a) `damage-wedge.js` — the monkeypatch install point → becomes the
        interceptor registration (delete the patch).
    (b) `collapse.js` — secondary knockback/prone effects: `resistsForcedMove`,
        `applyManifestationStates`, `flags.fourththing.condition`,
        `system.derived.integrity.value`. These route through the adapter's
        `resistsForcedMove` / `applyCondition` (dnd5e: native knockback + prone;
        RFI: existing fns) + `getHealth` (integrity track).
- **RFI-only damage opts feature-gate off on dnd5e.** `bypassThreshold` /
  `noSalvage` come from Catastrophic Entry (a Bad Eden maneuver); absent on
  dnd5e, base structure damage (integrity → plates → threshold → salvage) still
  resolves from plain `(amount, damageType)`.
- **New work this adds to Phase 1:** audit `collapse.js` to replace the 4
  `game.fourththing.*` reads with adapter calls; confirm `damage-path.js` reads
  structure state only from `flags["bbttcc-structures"]` (looked clean — verify).

### Still-open (smaller)
- Does `applyDamageFromButton` stay a distinct adapter method or fold into
  `applyDamage` with `opts.fromButton`? (Affects the bulwark source-capture wedge.)
