/* bbttcc-tikkun/api.tikkun.js — minimal Spark API */
(() => {
  const MOD = "bbttcc-tikkun";
  const TAG = "[bbttcc-tikkun]";
  const get = (o,p,d)=>{try{return foundry.utils.getProperty(o,p)??d;}catch{return d;}};

  function ensureNS(){
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.tikkun ??= {};
  }

  async function hasSpark(actor, key){
    if(!actor) return false;
    const sparks = get(actor, `flags.${MOD}.sparks`, {});
    return !!sparks[key] && sparks[key].status === "gathered";
  }

  async function gatherSpark(actor, spark){
    if(!actor||!spark?.id) return;
    const sparks = foundry.utils.duplicate(get(actor, `flags.${MOD}.sparks`, {}));
    sparks[spark.id] = { ...spark, status:"gathered", gatheredTimestamp:new Date().toISOString() };
    await actor.update({ [`flags.${MOD}.sparks`]: sparks });
    ui.notifications.info(`${actor.name} gathered ${spark.name}`);
  }

  function getAllSparks(actor){
    return get(actor, `flags.${MOD}.sparks`, {});
  }

  ensureNS();
  game.bbttcc.api.tikkun = { hasSpark, gatherSpark, getAllSparks };
  console.log(TAG,"ready");
})();
