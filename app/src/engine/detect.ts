// Detección por texto: tipo, roles (ramp, robo, removal…) y marcas de cada carta.
// Las expresiones vienen tal cual de la Bóveda original (src/core.js y src/report.js),
// donde ya estaban probadas con mazos reales. tests/parity.test.ts comprueba que
// este archivo y el original den lo mismo.
import type { Role } from "./types.ts";

export function mainType(tl: string): string {
  const f = String(tl||"").split(" // ")[0];
  if (/\bLand\b/.test(f)) return "Land";
  for (const t of ["Creature","Planeswalker","Battle","Instant","Sorcery","Artifact","Enchantment"]) if (new RegExp("\\b"+t+"\\b").test(f)) return t;
  return "Unknown";
}
export function detectRoles(o: string, t: string, tl: string, pm: string[]): Role[] {
  const r=new Set<Role>(); if (!o || t==="Land") return [];
  if ((pm||[]).length && /\{t\}[^.]*:\s*add\b/.test(o) && /(artifact|creature|enchantment)/i.test(tl)) r.add("ramp");
  if (/search your library for[^.]*\b(land|forest|plains|island|swamp|mountain)s?\b[^.]*(onto the battlefield|put (it|them|those|one) onto)/.test(o)) r.add("ramp");
  if (/put (a|up to (one|two|three)) lands? cards? from your hand onto the battlefield/.test(o) || /play (an|two) additional lands?/.test(o)) r.add("ramp");
  if (/create (a|an|one|two|three|x|that many) treasure/.test(o) || /^add \{[wubrgc]\}\{[wubrgc]\}\{[wubrgc]\}/m.test(o)) r.add("ramp");
  if (/\bdraws? (a|an|one|two|three|four|five|six|seven|x|that many|\d+) (additional )?cards?\b|draw cards equal/.test(o)) r.add("draw");
  if (/exile the top [^.]*(you may (play|cast))/.test(o)) r.add("draw");
  if (/(destroy|exile) target (\w+ ){0,3}(creature|artifact|enchantment|planeswalker|permanent|nonland|battle)(?! you control)/.test(o)) r.add("removal");
  if (/deals? (\d+|x|that much) damage to (any target|target creature|target creature or planeswalker|target planeswalker)/.test(o)) r.add("removal");
  if (/counter target (\w+ )?spell/.test(o)) r.add("removal");
  if (/return target (nonland |creature |artifact |enchantment )?(permanent|creature)[^.]*to (its|their) owner'?s? hands?/.test(o)) r.add("removal");
  if (/target (player|opponent) sacrifices|fights? (target|another target|up to one target)|target creature gets -\d+\/-\d+|target creature gets -x\/-x/.test(o)) r.add("removal");
  if (/(destroy|exile) all (other )?(creatures|nonland permanents|permanents|artifacts|enchantments|nonland|attacking)|(all|each) (other )?creatures? gets? -|deals (\d+|x) damage to each (creature|other creature)|return all (nonland )?(permanents|creatures) to|each player sacrifices (all|\w+) creatures?|return (all|each) [^.]*creatures?[^.]*to (its|their) owner'?s'? hands?|return to their owners' hands all creatures/.test(o)) r.add("wipe");
  const tut = o.match(/search your library for (a|an|up to (one|two|three)|any number of) ([^.]*?)card/);
  if (tut && !/\b(basic )?(land|forest|plains|island|swamp|mountain)s?\b/.test(tut[3])) r.add("tutor");
  if (/(creatures|permanents) you control (gain|have|get) [^.]*(hexproof|indestructible|protection|shroud)|target (creature|permanent) you control gains (hexproof|indestructible|protection|shroud)|phase out|can't be countered/.test(o)) r.add("protection");
  if (/return [^.]*from your graveyard to (your hand|the battlefield)|(cast|play) [^.]*from your graveyard/.test(o)) r.add("recursion");
  if (/you win the game|additional combat phase|extra combat|creatures you control (gain [^.]*? and )?get \+(\d|x)\/\+(\d|x)[^.]*(trample|until end of turn)|each opponent loses (x|half)/.test(o)) r.add("wincon");
  return [...r];
}

export function sbCats(o: string, name: string): string[] {
  const s=new Set<string>(); const n=String(name||"").toLowerCase(); o=o||"";
  if (/destroy (target|all|up to \w+ target|each) [^.]*artifact|artifacts? (and|or) enchantments?|exile target artifact|destroy target noncreature artifact/.test(o)) s.add("artifact");
  if (/exile (target player's|each player's|each opponent's|all cards from|target card from a|all graveyards|up to \w+ target cards? from)|graveyards? (can't|are exiled)|cards in graveyards (lose|can't)|would be put into (an opponent's|a) graveyard/.test(o)) s.add("grave");
  if (/(spell|permanent) is blue|target blue|blue spell|blue permanent/.test(o) || /pyroblast|red elemental blast/.test(n)) s.add("antiBlue");
  if (/(spell|permanent) is red|target red|red spell|red permanent/.test(o) || /hydroblast|blue elemental blast/.test(n)) s.add("antiRed");
  if (/gain \d+ life|you gain life|gains? life equal/.test(o)) s.add("life");
  if (/counter target/.test(o)) s.add("counter");
  if (/target (player|opponent) (reveals|discards)|each opponent discards/.test(o)) s.add("discard");
  if (/destroy target (nonbasic )?land|destroy all lands|nonbasic lands? (are|don't)/.test(o)) s.add("lands");
  return [...s];
}

export const RF_V = 6;   // versión de las marcas de cada carta; si sube, se vuelven a calcular

// marcas extra por carta, calculadas con el texto de Oracle (se guardan en m.rf y m.tq)
export function cardFlags(o: string, t: string, tl: string): { rf: string[]; tq: number | undefined; rv: number } {
  o = o || ""; const f = new Set<string>(); const land = t === "Land";
  const perm = !/Instant|Sorcery/.test(t||"");
  if (/(^|\n)flash(\s|$)/.test(o)) f.add("flash");
  if (/counter target (\w+ ){0,3}(spell|ability)|(choose new targets|change the target) (for|of) target spell/.test(o)) f.add("counter");
  if (!land && /add (\{[wubrgc]\} |an amount of \{[wubrgc]\} |x mana )?(for each|equal to)|add \{[wubrgc]\} for each|add x mana/.test(o)) f.add("bigMana");
  if (/look at the top card of your library any time|you may (cast|play) [^.]*from the top of your library|look at the top (\w+) cards[^.]*put (up to )?(one|two|a)[^.]*(onto the battlefield|into your hand)/.test(o)) f.add("select");
  if (/(creatures?|permanents?|artifacts?|planeswalkers?|lands?|commanders?|\w+s) you control (gain|gains|have|has|get)[^.]*(hexproof|indestructible|shroud|protection from)/.test(o)
    || /target (\w+ ){0,2}(creature|permanent|artifact|planeswalker)s? you control (gains?|gets?)[^.]*(hexproof|indestructible|shroud|protection)/.test(o)
    || /\bphases? out\b/.test(o) || /can't be countered/.test(o) || /that targets? (a|an|one or more) [^.]*you control/.test(o)
    || /spells your opponents cast that target [^.]*cost/.test(o) || /\bward\b/.test(o) && /you control/.test(o)) f.add("protect");
  if (/cost \{\d+\} more|costs? \{\d+\} more|costs? \{x\} more|unless (that player|its controller|they|he or she) pays?/.test(o)) f.add("tax");
  if (/(target (player|opponent)|each opponent|each player) (reveals [^.]*hand[^.]*)?discards?/.test(o)) f.add("discard");
  if (/each opponent loses|target (player|opponent) loses (\d+|x|that much|half)|deals? (\d+|x) damage to each opponent|each opponent (mills|loses)/.test(o)) f.add("wcDrain");
  if (/you win the game|loses the game/.test(o)) f.add("wcAlt");
  if (/(target player|target opponent|each opponent) mills|mills? (\w+ )?cards? equal/.test(o) && !/you mill/.test(o)) f.add("wcMill");
  if (/creatures you control get \+|other (\w+ ){1,2}(creatures )?(you control )?get \+|\w+s you control get \+\d|creatures you control (gain|have) (trample|double strike|flying)|can't be blocked|additional combat|double strike|\w+walk\b/.test(o)) f.add("wcCombat");
  if (/spells? you cast (of the chosen type |that share a creature type )?costs? \{\d\} less|(\w+ )?(creature )?spells (and \w+ spells )?you cast (of the chosen type )?cost \{\d\} less/.test(o)) f.add("reducer");
  if (/(^|\n)infect|toxic \d|poison counter/.test(o)) f.add("wcPoison");
  if (/creatures you control get \+(x|[2-9])|\w+ creatures you control get \+[2-9]|\+1\/\+1 counters? on each (other )?creature you control|creatures you control gain [^.]*double strike|elves you control get \+[2-9]/.test(o)) f.add("overrun");
  if (/deals that much damage to (target|each) opponent|deals (\d+|x) damage to each opponent/.test(o)) f.add("wcDrain");
  if (/(each|target) (opponent|other player|player)s? sacrifices?|each player sacrifices/.test(o)) f.add("edict");
  if (/base toughness 1|creatures your opponents control (get|have) -|(opponents|players) can't (cast|untap|search|draw more)/.test(o)) f.add("hoser");
  if (/whenever [^.]*(creature|another creature)[^.]*dies[^.]*(loses|deals? \d+ damage to each opponent)|whenever you sacrifice [^.]*(loses|damage)/.test(o)) f.add("deathDrain");
  if (perm && !land && /whenever|at the beginning of/.test(o)) f.add("repeat");
  // tipo de mecánica (para el perfil de sinergia): disparada, activada, estática o de reemplazo
  const body = o.replace(/\([^)]*\)/g, "");
  if (/(^|\n|\. )(whenever|when|at the beginning of)\b/.test(body)) f.add("trig");
  if (/(^|\n)[^\n"—]*[^\s]:\s/.test(body) && !/(^|\n)(choose one|spree)/.test(body)) f.add("act");
  if (/\binstead\b|if [^.]*would|enters with|as [^.]* enters/.test(body)) f.add("repl");
  if (perm && /(creatures?|permanents?|spells?|lands?|\w+s) (you control|your opponents control|you cast) (get|have|gain|cost|can't)|you may (look|cast|play)|other [^.]*get [+-]|^(flying|trample|deathtouch|lifelink|menace|reach|hexproof|indestructible)/m.test(body)) f.add("static");
  if (!perm && /draw|create|search your library|return|put [^.]*counter|onto the battlefield/.test(o)) f.add("oneShot");
  if (/when(ever)? [^.]*(enters|enter the battlefield)/.test(o)) f.add("etb");
  if (/when(ever)? [^.]*dies|when(ever)? [^.]*is put into a graveyard from the battlefield/.test(o)) f.add("dies");
  if (/(search your library for|put) [^.]*\bland (card|cards)?[^.]*onto the battlefield|put (a|up to (one|two)) land cards? from your hand onto the battlefield|play (an|two) additional lands?|search your library for (a|up to (one|two|three)) basic land/.test(o) && !land){ f.add("landRamp");
    if (/two [^.]*land cards?[^.]*put them onto the battlefield|put (both|two) [^.]*lands? onto the battlefield/.test(o)) f.add("landRamp2");     // Explosive Vegetation, Skyshroud Claim
    else if (/put one onto the battlefield[^.]*and the other into your hand/.test(o)) f.add("landHand"); }                                  // Cultivate, Kodama's Reach
  if (/(return|put) [^.]*from (your|a) graveyard (to|onto|into)|return target [^.]*card from your graveyard|return the chosen cards to the battlefield|return (that card|it) to the battlefield under your control|(^|\n)(undying|persist)\b/.test(o)) f.add("recursion");
  if (land){
    if (/search your library for/.test(o)) f.add("fetch");
    const lines = o.replace(/\([^)]*\)/g,"").split("\n").map(x=>x.trim()).filter(Boolean);
    if (lines.some(x=>/:/.test(x) && !/add (\{|one mana|two mana|three mana|an amount|x mana|mana)/.test(x) && !/search your library/.test(x)) || /can't be countered|becomes a [^.]*creature|cycling|channel/.test(o)) f.add("utility");
  }
  if (/(^|\n)(scry|surveil) \d|look at the top|draw a card\.?$/m.test(o) && !perm) f.add("select");
  // tutor: 100 = cualquier carta a la mano, menos si restringe tipo o va arriba de la biblioteca
  let tq: number | undefined;
  const tm = o.match(/search your library for (a|an|up to (one|two|three)) ([^.]*?)card[^.]*?(put (it|that card) (into your hand|onto the battlefield|on top)|reveal it)/);
  if (tm && !/basic land|land card|forest|island|plains|swamp|mountain/.test(tm[3])){
    const any = tm[3].trim()==="" ;
    const where = /onto the battlefield/.test(o) ? "bf" : /on top of (your|its owner's) library|then shuffle and put that card on top/.test(o) ? "top" : "hand";
    tq = (any ? 100 : 60) * (where==="top" ? 0.55 : where==="bf" ? 0.9 : 1);
    tq = Math.round(tq);
  }
  return {rf:[...f], tq, rv:RF_V};
}
