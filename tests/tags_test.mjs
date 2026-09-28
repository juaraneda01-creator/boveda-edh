// Revisa que las etiquetas de sinergia se detecten en cartas conocidas.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/tags.js", import.meta.url), "utf8").replace(/document\.addEventListener[\s\S]*$/, "");
const { detectTags } = new Function(src + "; return {detectTags};")();
const card = (name, t, tl, text) => detectTags(text.toLowerCase().split(name.toLowerCase()).join("this"), t, tl);
const cases = [
  ["Blood Artist", "Creature", "Creature — Vampire", "Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.", ["dies", "lifegain"]],
  ["Viscera Seer", "Creature", "Creature — Vampire Wizard", "Sacrifice a creature: Scry 1.", ["sacOutlet"]],
  ["Avenger of Zendikar", "Creature", "Creature — Elemental", "When Avenger of Zendikar enters, create a 0/1 green Plant creature token for each land you control.\nLandfall — Whenever a land you control enters, you may put a +1/+1 counter on each Plant creature you control.", ["token", "landfall", "counters", "etb"]],
  ["Rampant Growth", "Sorcery", "Sorcery", "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.", ["landDrop"]],
  ["Ephemerate", "Instant", "Instant", "Exile target creature you control, then return it to the battlefield under its owner's control.\nRebound", ["blink"]],
  ["Animate Dead", "Enchantment", "Enchantment — Aura", "Enchant creature card in a graveyard\nWhen Animate Dead enters, if it's on the battlefield, it loses \"enchant creature card in a graveyard\" and gains \"enchant creature put onto the battlefield with Animate Dead.\" Return enchanted creature card to the battlefield under your control and attach Animate Dead to it.", ["aura"]],
  ["Young Pyromancer", "Creature", "Creature — Human Shaman", "Whenever you cast an instant or sorcery spell, create a 1/1 red Elemental creature token.", ["spellsPay", "token"]],
  ["Ajani's Pridemate", "Creature", "Creature — Cat Soldier", "Whenever you gain life, put a +1/+1 counter on Ajani's Pridemate.", ["lifegainPay", "counters"]],
  ["Doubling Season", "Enchantment", "Enchantment", "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.", ["tokenPay", "countersPay"]],
  ["Elvish Archdruid", "Creature", "Creature — Elf Druid", "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.", ["tribe:elf"]],
  ["Faithless Looting", "Sorcery", "Sorcery", "Draw two cards, then discard two cards.\nFlashback {2}{R}", ["graveyardPay"]],
  ["Smothering Tithe", "Enchantment", "Enchantment", "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token.", ["artifactMake", "token"]],
  ["Sword of Fire and Ice", "Artifact", "Artifact — Equipment", "Equipped creature gets +2/+2 and has protection from red and from blue.", ["equipment", "voltronPay"]],
];
let fail = 0;
for (const [n, t, tl, text, want] of cases){ const got = card(n, t, tl, text); const miss = want.filter(w => !got.includes(w)); if (miss.length){ fail++; console.error(`FALLA ${n}: faltan ${miss.join(", ")} (detectó ${got.join(", ")})`); } }
if (fail) process.exit(1);
console.log(`Etiquetas OK: ${cases.length} cartas de prueba.`);
