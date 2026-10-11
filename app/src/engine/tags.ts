// Etiquetas de sinergia: qué hace cada carta y qué temas forman.
// Definiciones tal cual de la Bóveda original (src/tags.js); ver tests/parity.test.ts.

export interface TagDef { k: string; es: string; re?: RegExp; ty?: (t: string, tl: string) => boolean }
/** en: etiquetas que habilitan el tema · pay: las que lo aprovechan · min: mínimo razonable de cada lado en 100 cartas */
export interface Theme { k: string; es: string; en: string[]; pay: string[]; min: [number, number]; enType?: string[]; enRole?: string }

// k: clave · es: nombre · re: texto de la carta (en minúsculas, "this" = la propia carta) · ty: por tipo
export const TAG_DEFS: TagDef[] = [
  // fichas
  {k:"token", es:"crea fichas", re:/create[s]? (a|an|one|two|three|four|five|x|that many|\d+|a number of) [^.]*?tokens?/},
  {k:"tokenPay", es:"aprovecha fichas", re:/whenever (one or more )?(a |another )?(nontoken )?creatures? (token )?(enters|you control enters)|for each creature you control|creatures you control get \+\d|populate|whenever you create (a|one or more) tokens?|tokens you control (get|have)|creates? twice that many (of those )?tokens|create (one|two) additional tokens?/},
  // sacrificio
  {k:"sacOutlet", es:"sacrifica a voluntad", re:/sacrifice (a|another|an?(?: \w+)?) (creature|artifact|permanent|token)[^.]*?:|, sacrifice (a|another) creature:/},
  {k:"dies", es:"aprovecha muertes", re:/whenever (this or )?(a|another|one or more)( other)?( nontoken)? creatures?( you control| an opponent controls)? (dies|die|is put into a graveyard)|whenever you sacrifice|whenever (a|another) (creature|permanent) you control is put into|a creature dying causes/},
  {k:"minusCounters", es:"pone contadores -1/-1", re:/put (a|one|two|three|x|that many|\d+) -1\/-1 counters?|-1\/-1 counters? on (each|target|up to|that)|\bwither\b|\binfect\b|\bpersist\b/},
  {k:"minusPay", es:"aprovecha contadores -1/-1", re:/whenever (you put )?one or more -1\/-1 counters|whenever a -1\/-1 counter is put|with a -1\/-1 counter on it dies|toughness (was )?less than 1|base toughness 1/},
  {k:"sacFodder", es:"deja cuerpos para sacrificar", re:/when (this|this creature) dies,? (create|return|you create)|\bpersist\b|\bundying\b/},
  // contadores
  {k:"counters", es:"pone contadores +1/+1", re:/put (a|one|two|three|x|that many|\d+) \+1\/\+1 counters?|enters with (a|one|two|three|x|\d+) \+1\/\+1 counters?|\bmodular\b|\boutlast\b|\badapt\b|\bbolster\b|\bevolve\b|\bexplores?\b/},
  {k:"countersPay", es:"aprovecha contadores", re:/with (a|one or more) \+1\/\+1 counters? on (it|them)|for each \+1\/\+1 counter|double the number of|twice that many (of those )?counters|(one|two|that many) (additional|more) \+1\/\+1 counters?|if one or more \+1\/\+1 counters would/},
  {k:"proliferate", es:"prolifera", re:/proliferate/},
  // tierras
  {k:"landDrop", es:"tierras extra", re:/play (an|two) additional lands?|put (a|up to (one|two)) lands? cards?[^.]*onto the battlefield|search your library for [^.]*lands?[^.]*onto the battlefield|return (a|target) land[^.]*to (its owner's|your) hand/},
  {k:"landfall", es:"aprovecha tierras (landfall)", re:/landfall|whenever a land (you control )?enters|whenever one or more lands (you control )?enter/},
  // entrar al campo y parpadeo
  {k:"etb", es:"efecto al entrar", re:/when this enters|whenever this enters|when this creature enters/},
  {k:"blink", es:"parpadeo", re:/exile (target|another target|up to one target|any number of other target|two target)[^.]*(creatures?|permanents?|artifacts?)[^.]*?(you control|you own)?[^.]*then return (it|them|that card|those cards) to the battlefield|return (it|that card) to the battlefield under (its owner's|your) control at the beginning of the next end step/},
  {k:"copyPerm", es:"copia permanentes", re:/create a token that's a copy of|becomes a copy of|enter as a copy of/},
  // cementerio
  {k:"selfMill", es:"llena el cementerio", re:/\bmill\b|put the top [^.]* cards? of your library into your graveyard|\bsurveil\b|\bdredge\b|\bentomb\b/},
  {k:"reanimate", es:"reanima", re:/(return|put) (target|a|up to one target|any number of target)? ?[^.]*creature cards? from (your|a) graveyard (to|onto) the battlefield|return target creature card from your graveyard to the battlefield|reanimate/},
  {k:"graveyardPay", es:"aprovecha el cementerio", re:/\bflashback\b|\bescape\b|\bdelve\b|\bunearth\b|\bembalm\b|\beternalize\b|\bdisturb\b|for each (creature )?card in your graveyard|cards? in your graveyard (has|have)|you may cast [^.]*from your graveyard|threshold|delirium/},
  // hechizos
  {k:"spellsPay", es:"aprovecha instantáneos y conjuros", re:/whenever you cast (an|a) (instant|sorcery|noncreature)|instant (and|or) sorcery spells you cast (cost|have)|\bmagecraft\b|\bprowess\b|copy target (instant|sorcery)|whenever you cast or copy/},
  {k:"cantrip", es:"hechizo barato que roba", re:/draw a card\.?$|draws? a card\./, ty:t=>t==="Instant"||t==="Sorcery"},
  {k:"storm", es:"tormenta y copias", re:/\bstorm\b|copy (it|that spell|target spell)/},
  // artefactos y encantamientos
  {k:"artifactMake", es:"crea artefactos (tesoros, pistas…)", re:/create (a|an|one|two|three|x|that many|\d+) (tapped )?(treasure|clue|food|blood|map|powerstone|gold|artifact)/},
  {k:"artifactsPay", es:"aprovecha artefactos", re:/whenever (an|one or more|another) (nontoken )?artifacts? (enters|you control enters|is put into a graveyard)|for each artifact you control|\baffinity for artifacts\b|\bimprovise\b|\bmetalcraft\b|artifacts you control (get|have)|sacrifice an artifact:/},
  {k:"enchantPay", es:"aprovecha encantamientos", re:/\bconstellation\b|whenever (an|another) enchantment (you control )?enters|for each enchantment you control|whenever you cast an enchantment|enchantments you control (get|have)/},
  {k:"aura", es:"aura", ty:(t,tl)=>/\bAura\b/.test(tl)},
  {k:"equipment", es:"equipo", ty:(t,tl)=>/\bEquipment\b/.test(tl)},
  {k:"voltronPay", es:"aprovecha auras y equipos", re:/equipped creature|enchanted creature you control|for each (aura|equipment)|whenever (an aura|an equipment|a creature you control becomes enchanted|equipped)|auras? (and|or) equipment|attach [^.]* to/},
  // vida
  {k:"lifegain", es:"gana vida", re:/you gain (\d+|x|that much|life equal)|\blifelink\b|gain \d+ life/},
  {k:"lifegainPay", es:"aprovecha ganar vida", re:/whenever you gain life|if you would gain life|for each 1 life you gained|you gained (\d+ or more )?life this turn/},
  // robo y descarte
  {k:"drawPay", es:"aprovecha robar", re:/whenever you draw (a|your second) card|for each card you've drawn/},
  {k:"wheel", es:"descarta y roba (rueda)", re:/each player (discards their hand|shuffles their hand)[^.]*draws?|discard your hand, then draw/},
  {k:"discardOut", es:"descarta a voluntad", re:/discard a card:|as an additional cost to cast this spell, discard|\bcycling\b|, discard a card[^.]*:/},
  {k:"discardPay", es:"aprovecha descartar", re:/\bmadness\b|whenever you (discard|cycle)|whenever a player discards/},
  // ataque
  {k:"extraCombat", es:"combate extra", re:/additional combat phase|untap all creatures[^.]*after this (main )?phase/},
  {k:"attackPay", es:"aprovecha atacar", re:/whenever (a creature you control|one or more creatures you control|this) attacks|whenever you attack|\bmelee\b|\bbattalion\b|\braid\b/},
  {k:"evasion", es:"evasión", re:/\bflying\b|can't be blocked|\bmenace\b|\btrample\b|\bshadow\b|\bhorsemanship\b|\b(island|swamp|forest|mountain|plains)walk\b/, ty:t=>t==="Creature"},
  // maná e interacción con el comandante
  {k:"untap", es:"endereza permanentes", re:/untap (target|another target|all|up to \w+ target) (\w+ )?(permanent|creature|artifact|land)/},
  {k:"tapPay", es:"habilidades de girar", re:/\{t\}(, [^:]*)?: (?!add)/},
  {k:"planeswalker", es:"planeswalker", ty:t=>t==="Planeswalker"},
  {k:"stax", es:"restringe a los rivales (stax)", re:/(players|opponents|each player|your opponents) can't (cast|untap|search|draw|activate|attack|play)|don't untap during|spells (your opponents cast )?cost \{\d\} more|can't cast more than one|skip (their|your) (untap|draw)|lands (don't|do not) untap|nonbasic lands are (mountains|islands)/},
  {k:"theft", es:"roba permanentes", re:/gain control of (target|all|each)/},
  {k:"energy", es:"energía", re:/\{e\}|energy counter/},
  {k:"poison", es:"veneno", re:/\binfect\b|\btoxic\b|poison counter/},
];
export const TAG_ES: Record<string, string> = Object.fromEntries(TAG_DEFS.map(d=>[d.k, d.es]));

// temas: qué etiquetas dan y cuáles aprovechan; min = mínimo razonable de cada lado en 100 cartas
export const THEMES: Theme[] = [
  {k:"tokens", es:"Fichas", en:["token","artifactMake","copyPerm"], pay:["tokenPay","sacOutlet","dies"], min:[8,4]},
  {k:"minus", es:"Contadores -1/-1", en:["minusCounters"], pay:["minusPay"], min:[6,3]},
  {k:"aristocrats", es:"Sacrificio (aristócratas)", en:["sacOutlet","token","sacFodder"], pay:["dies"], min:[4,3]},
  {k:"counters", es:"Contadores +1/+1", en:["counters"], pay:["countersPay","proliferate"], min:[8,3]},
  {k:"landfall", es:"Tierras (landfall)", en:["landDrop"], pay:["landfall"], min:[8,4]},
  {k:"blink", es:"Entrar al campo y parpadeo", en:["blink","copyPerm"], pay:["etb"], min:[4,10]},
  {k:"graveyard", es:"Cementerio", en:["selfMill","discardOut","wheel"], pay:["reanimate","graveyardPay"], min:[6,4]},
  {k:"spells", es:"Instantáneos y conjuros", en:["cantrip","storm"], pay:["spellsPay"], min:[10,3], enType:["Instant","Sorcery"]},
  {k:"artifacts", es:"Artefactos", en:["artifactMake"], pay:["artifactsPay"], min:[12,3], enType:["Artifact"]},
  {k:"enchant", es:"Encantamientos", en:["aura"], pay:["enchantPay"], min:[12,3], enType:["Enchantment"]},
  {k:"voltron", es:"Auras y equipos (voltron)", en:["aura","equipment"], pay:["voltronPay","evasion"], min:[8,4]},
  {k:"lifegain", es:"Ganar vida", en:["lifegain"], pay:["lifegainPay"], min:[8,3]},
  {k:"draw", es:"Robar cartas", en:["cantrip","wheel"], pay:["drawPay"], min:[8,2], enRole:"draw"},
  {k:"discard", es:"Descarte (madness)", en:["discardOut","wheel"], pay:["discardPay","graveyardPay"], min:[5,3]},
  {k:"combat", es:"Combate", en:["extraCombat","evasion"], pay:["attackPay"], min:[6,4]},
  {k:"untap", es:"Girar y enderezar", en:["untap"], pay:["tapPay"], min:[3,4]},
  {k:"proliferate", es:"Proliferar", en:["counters","planeswalker","poison","energy"], pay:["proliferate"], min:[6,2]},
];

export function detectTags(o: string, t: string, tl: string): string[] {
  const out = new Set<string>(); o = o || ""; tl = tl || "";
  for (const d of TAG_DEFS){
    const byRe = d.re ? d.re.test(o) : true;
    const byTy = d.ty ? d.ty(t, tl) : true;
    if (d.re && d.ty ? (byRe && byTy) : d.re ? byRe : byTy) out.add(d.k);
  }
  // tribal: "otros Elfos que controlas", "Elfos que controlas obtienen", "elige un tipo de criatura"
  const STOP = /^(creature|creatures|permanent|permanents|land|lands|artifact|artifacts|enchantment|enchantments|token|tokens|nontoken|player|opponent|other|each|another|it|this|that|and|or|attacking|blocking|tapped|untapped|legendary|nonlegendary|all|the|your|you|of|with|white|blue|black|red|green|colorless|multicolored|card|cards|spell|spells|counter|counters|planeswalker|planeswalkers|basic|forest|forests|island|islands|swamp|swamps|mountain|mountains|plains|treasure|treasures|food|clue|clues|equipment|aura|auras)$/;
  const norm = (w: string) => w.replace(/(ves)$/,"f").replace(/s$/,"");
  for (const x of o.matchAll(/(?:other |each )?([a-z]+) (?:creatures )?you control (?:get|have|gain)|whenever (?:a|another) ([a-z]+) (?:you control )?(?:enters|attacks|dies)|(choose a creature type)|(?:number of|for each) ([a-z]+) you control/g)){
    if (x[3]){ out.add("tribe:*"); continue; }
    const w = x[1] || x[2] || x[4];
    if (w && !STOP.test(w)) out.add("tribe:" + norm(w));
  }
  return [...out];
}
// subtipos de criatura desde la línea de tipo
export function subtypesOf(m: { tl?: string } | null | undefined): string[] { if (!m || !/Creature|Kindred|Tribal/.test(m.tl||"")) return []; const p = String(m.tl).split(/—|-/)[1]; return p ? p.trim().toLowerCase().split(/\s+/).map(w=>w.replace(/(ves)$/,"f").replace(/s$/,"")) : []; }
