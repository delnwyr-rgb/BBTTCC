// v1.0.1 — Planner: Standard Activities (always-on) with safe boot guard

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

    const storyApply = (label) => async ({ entry }) => {
      const t = entry?.targetName || "Target";
      return `${label} planned for ${t}. (Story-driven resolution; GM adjudicates.)`;
    };

    // Administrative / Development
    add("policy_reforms",             {kind:"strategic", band:"standard", label:"Policy Reforms (Admin)",   cost:{ economy:2, softpower:2, diplomacy:1, logistics:1 }, storyOnly:true, apply:storyApply("Policy Reforms")});
    add("loyalty_program",            {kind:"strategic", band:"standard", label:"Loyalty Program",          cost:{ softpower:3, culture:1, faith:1 }, storyOnly:true, apply:storyApply("Loyalty Program")});
    add("develop_infrastructure_std", {kind:"strategic", band:"standard", label:"Develop Infrastructure",   cost:{ economy:4, logistics:2 }, storyOnly:true, apply:storyApply("Develop Infrastructure")});
    add("reconstruction_drive_std",   {kind:"strategic", band:"standard", label:"Reconstruction Drive",     cost:{ economy:2, logistics:2 }, storyOnly:true, apply:storyApply("Reconstruction Drive")});
    add("minor_repair",               {kind:"strategic", band:"standard", label:"Minor Repair",             cost:{ economy:1 }, storyOnly:false, apply:storyApply("Minor Repair")});

    // Security / Fortification
    add("fortify_hex",                {kind:"strategic", band:"standard", label:"Fortify Hex",              cost:{ economy:2, logistics:2, violence:1 }, storyOnly:false, apply:storyApply("Fortify Hex")});
    add("establish_supply_line",      {kind:"strategic", band:"standard", label:"Establish Supply Line",    cost:{ logistics:3, economy:1 }, storyOnly:false, apply:storyApply("Establish Supply Line")});

    // Intel / Influence
    add("gather_intel",               {kind:"strategic", band:"standard", label:"Gather Intel",             cost:{ intrigue:2 }, storyOnly:true, apply:storyApply("Gather Intel")});
    add("propaganda_campaign",        {kind:"strategic", band:"standard", label:"Propaganda Campaign",      cost:{ softpower:3, diplomacy:1 }, storyOnly:true, apply:storyApply("Propaganda Campaign")});
    add("diplomatic_mission_std",     {kind:"strategic", band:"standard", label:"Diplomatic Mission",       cost:{ diplomacy:3, softpower:1 }, storyOnly:true, apply:storyApply("Diplomatic Mission")});
    add("cultural_festival_std",      {kind:"strategic", band:"standard", label:"Cultural Festival",        cost:{ culture:2, faith:1, softpower:1 }, storyOnly:true, apply:storyApply("Cultural Festival")});

    // Economy / Trade
    add("establish_trade_route",      {kind:"strategic", band:"standard", label:"Establish Trade Route",    cost:{ economy:3, diplomacy:1, logistics:1 }, storyOnly:false, apply:storyApply("Establish Trade Route")});

    // Alignment / Tikkun hook
    add("alignment_shift",            {kind:"strategic", band:"standard", label:"Alignment Shift (Sephirot)", cost:{ faith:3, culture:2, softpower:2 }, storyOnly:true, apply:storyApply("Alignment Shift (Sephirot)")});

    // Military posture
    add("training_drills",            {kind:"strategic", band:"standard", label:"Training Drills",          cost:{ violence:3 }, storyOnly:false, apply:storyApply("Training Drills")});
    add("mass_mobilization_std",      {kind:"strategic", band:"standard", label:"Mass Mobilization",        cost:{ violence:4, logistics:2, economy:1 }, storyOnly:true, apply:storyApply("Mass Mobilization")});

    console.log(TAG, "registered", Object.keys(E).filter(k => E[k]?.band==="standard"));
  });
})();
