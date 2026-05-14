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

    // Costs are MARKS (1 OP = 10 marks).
    add("policy_reforms", {
      kind:"strategic",
      band:"standard",
      label:"Policy Reforms (Admin)",
      cost:{ economy:20, softpower:20, diplomacy:10, logistics:10 },
      storyOnly:true
    });

    add("loyalty_program", {
      kind:"strategic",
      band:"standard",
      label:"Loyalty Program",
      cost:{ softpower:30, culture:10, faith:10 },
      storyOnly:true
    });

    add("develop_infrastructure_std", {
      kind:"strategic",
      band:"standard",
      label:"Develop Infrastructure",
      cost:{ economy:40, logistics:20 },
      storyOnly:true
    });

    add("reconstruction_drive_std", {
      kind:"strategic",
      band:"standard",
      label:"Reconstruction Drive",
      cost:{ economy:20, logistics:20 },
      storyOnly:true
    });

    // 🔧 Now mechanized via STRATEGIC_THROUGHPUT
    add("minor_repair", {
      kind:"strategic",
      band:"standard",
      label:"Minor Repair",
      cost:{ economy:10 },
      storyOnly:false
    });

    // ---------------------------------------------------------------------
    // Security / Fortification
    // ---------------------------------------------------------------------

    add("fortify_hex", {
      kind:"strategic",
      band:"standard",
      label:"Fortify Hex",
      cost:{ economy:20, logistics:20, violence:10 },
      storyOnly:false
    });

    add("establish_supply_line", {
      kind:"strategic",
      band:"standard",
      label:"Establish Supply Line",
      cost:{ logistics:30, economy:10 },
      storyOnly:false
    });

    // ---------------------------------------------------------------------
    // Intel / Influence
    // ---------------------------------------------------------------------

    add("gather_intel", {
      kind:"strategic",
      band:"standard",
      label:"Gather Intel",
      cost:{ intrigue:20 },
      storyOnly:true
    });

    add("propaganda_campaign", {
      kind:"strategic",
      band:"standard",
      label:"Propaganda Campaign",
      cost:{ softpower:30, diplomacy:10 },
      storyOnly:true
    });

    add("diplomatic_mission_std", {
      kind:"strategic",
      band:"standard",
      label:"Diplomatic Mission",
      cost:{ diplomacy:30, softpower:10 },
      storyOnly:true
    });

    add("cultural_festival_std", {
      kind:"strategic",
      band:"standard",
      label:"Cultural Festival",
      cost:{ culture:20, faith:10, softpower:10 },
      storyOnly:true
    });

    // ---------------------------------------------------------------------
    // Economy / Trade
    // ---------------------------------------------------------------------

    add("establish_trade_route", {
      kind:"strategic",
      band:"standard",
      label:"Establish Trade Route",
      cost:{ economy:30, diplomacy:10, logistics:10 },
      storyOnly:false
    });

    // ---------------------------------------------------------------------
    // Alignment / Tikkun Hook
    // ---------------------------------------------------------------------

    add("alignment_shift", {
      kind:"strategic",
      band:"standard",
      label:"Alignment Shift (Sephirot)",
      cost:{ faith:30, culture:20, softpower:20 },
      storyOnly:true
    });

    // ---------------------------------------------------------------------
    // Military Posture
    // ---------------------------------------------------------------------

    add("training_drills", {
      kind:"strategic",
      band:"standard",
      label:"Training Drills",
      cost:{ violence:30 },
      storyOnly:false
    });

    add("mass_mobilization_std", {
      kind:"strategic",
      band:"standard",
      label:"Mass Mobilization",
      cost:{ violence:40, logistics:20, economy:10 },
      storyOnly:true
    });

    console.log(TAG, "registered", Object.keys(E).filter(k => E[k]?.band==="standard"));
  });
})();
