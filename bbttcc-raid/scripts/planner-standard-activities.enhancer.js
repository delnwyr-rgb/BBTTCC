// v1.1.0 — Planner: Standard Activities (Throughput-ready)

(() => {
  const MOD_RAID = "bbttcc-raid";
  const TAG = "[bbttcc-planner/standard]";

  function whenRaidReady(cb, tries=0){
    const tryNow = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_RAID)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG, "raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (globalThis.Hooks) Hooks.once("ready", tryNow); else tryNow();
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const add = (key, def) => { if (!E[key]) E[key] = def; };

    // ---------------------------------------------------------------------
    // Administrative / Development
    // ---------------------------------------------------------------------

    add("policy_reforms", {
      kind:"strategic",
      band:"standard",
      label:"Policy Reforms (Admin)",
      cost:{ economy:2, softpower:2, diplomacy:1, logistics:1 },
      storyOnly:true
    });

    add("loyalty_program", {
      kind:"strategic",
      band:"standard",
      label:"Loyalty Program",
      cost:{ softpower:3, culture:1, faith:1 },
      storyOnly:true
    });

    add("develop_infrastructure_std", {
      kind:"strategic",
      band:"standard",
      label:"Develop Infrastructure",
      cost:{ economy:4, logistics:2 },
      storyOnly:true
    });

    add("reconstruction_drive_std", {
      kind:"strategic",
      band:"standard",
      label:"Reconstruction Drive",
      cost:{ economy:2, logistics:2 },
      storyOnly:true
    });

    // 🔧 Now mechanized via STRATEGIC_THROUGHPUT
    add("minor_repair", {
      kind:"strategic",
      band:"standard",
      label:"Minor Repair",
      cost:{ economy:1 },
      storyOnly:false
    });

    // ---------------------------------------------------------------------
    // Security / Fortification
    // ---------------------------------------------------------------------

    add("fortify_hex", {
      kind:"strategic",
      band:"standard",
      label:"Fortify Hex",
      cost:{ economy:2, logistics:2, violence:1 },
      storyOnly:false
    });

    add("establish_supply_line", {
      kind:"strategic",
      band:"standard",
      label:"Establish Supply Line",
      cost:{ logistics:3, economy:1 },
      storyOnly:false
    });

    // ---------------------------------------------------------------------
    // Intel / Influence
    // ---------------------------------------------------------------------

    add("gather_intel", {
      kind:"strategic",
      band:"standard",
      label:"Gather Intel",
      cost:{ intrigue:2 },
      storyOnly:true
    });

    add("propaganda_campaign", {
      kind:"strategic",
      band:"standard",
      label:"Propaganda Campaign",
      cost:{ softpower:3, diplomacy:1 },
      storyOnly:true
    });

    add("diplomatic_mission_std", {
      kind:"strategic",
      band:"standard",
      label:"Diplomatic Mission",
      cost:{ diplomacy:3, softpower:1 },
      storyOnly:true
    });

    add("cultural_festival_std", {
      kind:"strategic",
      band:"standard",
      label:"Cultural Festival",
      cost:{ culture:2, faith:1, softpower:1 },
      storyOnly:true
    });

    // ---------------------------------------------------------------------
    // Economy / Trade
    // ---------------------------------------------------------------------

    add("establish_trade_route", {
      kind:"strategic",
      band:"standard",
      label:"Establish Trade Route",
      cost:{ economy:3, diplomacy:1, logistics:1 },
      storyOnly:false
    });

    // ---------------------------------------------------------------------
    // Alignment / Tikkun Hook
    // ---------------------------------------------------------------------

    add("alignment_shift", {
      kind:"strategic",
      band:"standard",
      label:"Alignment Shift (Sephirot)",
      cost:{ faith:3, culture:2, softpower:2 },
      storyOnly:true
    });

    // ---------------------------------------------------------------------
    // Military Posture
    // ---------------------------------------------------------------------

    add("training_drills", {
      kind:"strategic",
      band:"standard",
      label:"Training Drills",
      cost:{ violence:3 },
      storyOnly:false
    });

    add("mass_mobilization_std", {
      kind:"strategic",
      band:"standard",
      label:"Mass Mobilization",
      cost:{ violence:4, logistics:2, economy:1 },
      storyOnly:true
    });

    console.log(TAG, "registered", Object.keys(E).filter(k => E[k]?.band==="standard"));
  });
})();
