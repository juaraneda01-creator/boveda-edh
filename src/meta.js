/* =========================================================
   Datos de referencia del meta (foto al 27-sep-2026)
   Fuentes: MTGTop8 (últimas 2 semanas), EDHTop16 (3 meses),
   guía oficial de brackets (actualización 9-feb-2026).
   ========================================================= */
const META_AT = "27 de septiembre de 2026";
const META = {
  pauper: {
    src: "MTGTop8 · últimas 2 semanas · 786 mazos",
    url: "https://mtgtop8.com/format?f=PAU",
    mtgdecks: "https://mtgdecks.net/Pauper",
    archetypes: [
      {name:"Burn", share:13, arch:"https://mtgtop8.com/archetype?a=536&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=91302&d=893393&f=PAU", sample:"Madness Burn · MTGO Challenge 16 · 26/09/26",
       list:`20 Mountain
4 Guttersnipe
4 Fireblast
4 Fiery Temper
4 Lava Dart
4 Kessig Flamebreather
4 Highway Robbery
4 Sneaky Snacker
1 Vision of Love
4 Grab the Prize
4 Lightning Bolt
3 Faithless Looting
Sideboard
2 Vandalblast
4 Pyroblast
3 Searing Blaze
3 Relic of Progenitus
3 Smash to Smithereens`},
      {name:"Affinity", share:11, arch:"https://mtgtop8.com/archetype?a=512&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=90109&d=883952&f=PAU", sample:"Grixis Affinity · MTGO Challenge 32 · 26/08/26",
       list:`2 Blood Fountain
4 Drossforge Bridge
4 Vault of Whispers
4 Thoughtcast
3 Seat of the Synod
3 Krark-Clan Shaman
1 Makeshift Munitions
4 Mistvault Bridge
3 Nihil Spellbomb
4 Myr Enforcer
4 Reckoner's Bargain
4 Refurbished Familiar
4 Ichor Wellspring
1 Sewer-veillance Cam
2 Silverbluff Bridge
3 Great Furnace
2 Toxin Analysis
4 Utrom Monitor
4 Galvanic Blast
Sideboard
1 Krark-Clan Shaman
4 Hydroblast
2 Extract a Confession
2 Blue Elemental Blast
4 Pyroblast
2 Red Elemental Blast`},
      {name:"Urzatron", share:8, arch:"https://mtgtop8.com/archetype?a=515&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=91121&d=892043&f=PAU", sample:"Trono Monster · LPA S1 T3 · 21/09/26",
       list:`1 Haunted Fengraf
2 Forest
4 Urza's Mine
1 Bojuka Bog
2 Conduit Pylons
4 Urza's Tower
4 Urza's Power Plant
4 Ancient Stirrings
2 Barrels of Blasting Jelly
4 Giant's Boulder
4 Expedition Map
3 Crop Rotation
1 Kaervek's Torch
2 Bonder's Ornament
2 Rooftop Percher
4 Unfathomable Truths
2 Generous Ent
2 Boulderbranch Golem
4 Pinnacle Kill-Ship
4 Bramble Wurm
4 Maelstrom Colossus
Sideboard
4 Hydroblast
3 Relic of Progenitus
2 Call Damage Control
1 Ancient Grudge
3 Breath Weapon
2 Scour from Existence`},
      {name:"Mono Blue Aggro", share:6, arch:"https://mtgtop8.com/archetype?a=765&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=90667&d=888350&f=PAU", sample:"Mono Blue Aggro · MTGO Challenge 32 · 09/09/26",
       list:`4 Brinebarrow Intruder
4 Faerie Seer
4 Moon-Circuit Hacker
4 Of One Mind
4 Faerie Miscreant
2 Harrier Strix
4 Counterspell
19 Island
4 Ninja of the Deep Hours
1 Dispel
3 Cryoshatter
3 Sewer-veillance Cam
4 Spellstutter Sprite
Sideboard
1 Dispel
1 Cryoshatter
2 Hydroblast
4 Blue Elemental Blast
3 Steel Sabotage
2 Annul
2 Relic of Progenitus`},
      {name:"Weenie White", share:6, arch:"https://mtgtop8.com/archetype?a=551&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=88606&d=872554&f=PAU", sample:"Weenie White · Mont Weekly Event · 22/07/26",
       list:`1 Rally the Peasants
4 Springleaf Drum
4 Galvanic Blast
2 Martyr's Soul
3 Ardent Recruit
4 Phyrexian Walker
4 Ornithopter
4 Novice Inspector
4 Mardu Devotee
4 Salt Road Packbeast
4 Spider-Man, Web-Slinger
4 Thraben Inspector
4 Leonardo, Big Brother
1 Survivors' Encampment
4 Ancient Den
9 Plains
Sideboard
2 Ultimate Alliance
4 Thraben Charm
4 Festival of Trokin
4 Dust to Dust
1 Rally the Peasants`},
      {name:"Elves", share:5, arch:"https://mtgtop8.com/archetype?a=620&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=91302&d=893392&f=PAU", sample:"Elves · MTGO Challenge 16 · 26/09/26",
       list:`4 Llanowar Elves
10 Forest
2 Elvish Mystic
4 Lead the Stampede
4 Winding Way
1 Gingerbread Cabin
4 Masked Vandal
4 Quirion Ranger
4 Generous Ent
4 Nyxborn Hydra
4 Priest of Titania
1 Sagu Wildling
4 Avenging Hunter
4 Timberwatch Elf
4 Fyndhorn Elves
2 Land Grant
Sideboard
3 Mwonvuli Acid-Moss
2 Faerie Macabre
4 Scattershot Archer
3 Nylea's Disciple
2 Vitu-Ghazi Inspector
1 Rooftop Percher`},
      {name:"Dimir Control", share:5, arch:"https://mtgtop8.com/archetype?a=517&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=90543&d=887270&f=PAU", sample:"Dimir Control · Liga · 06/09/26",
       list:`10 Island
4 Contaminated Aquifer
2 Bojuka Bog
1 Swamp
1 Foreboding Landscape
4 Augur of Bolas
4 Spellstutter Sprite
4 Faerie Seer
2 Thorn of the Black Rose
2 Ninja of the Deep Hours
2 Moon-Circuit Hacker
1 Mukotai Ambusher
4 Snuff Out
4 Counterspell
4 Brainstorm
4 Lorien Revealed
2 Cast Down
1 Extract a Confession
1 Suffocating Fumes
1 Dispel
1 Agony Warp
1 Sewer-veillance Cam
Sideboard
1 Mukotai Ambusher
2 Relic of Progenitus
1 Murmuring Mystic
2 Hydroblast
1 Campfire
4 Blue Elemental Blast
1 Arms of Hadar
2 Annul
1 Steel Sabotage`},
      {name:"Ephemerate", share:4, arch:"https://mtgtop8.com/archetype?a=537&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=90066&d=883664&f=PAU", sample:"Snow Jeskai Ephemerate · 25/08/26",
       list:`7 Snow-Covered Island
2 Snow-Covered Mountain
1 Murmuring Mystic
4 Counterspell
3 Bender's Waterskin
4 Ephemerate
1 Ride's End
4 Preordain
1 Union of the Third Path
2 Dispel
4 Skred
4 Lorien Revealed
4 Mulldrifter
1 Suplex
1 Fanged Flames
3 Archaeomancer
4 Perilous Landscape
2 Volatile Fjord
4 Augur of Bolas
2 Glacial Floodplain
2 Snow-Covered Plains
Sideboard
2 Steel Sabotage
1 Breath Weapon
4 Pyroblast
1 Destroy Evil
2 Cleansing Wildfire
1 Thraben Charm
4 Hydroblast`},
      {name:"Balustrade Spy", share:4, arch:"https://mtgtop8.com/archetype?a=2596&meta=299&f=PAU", deck:"https://mtgtop8.com/event?e=89882&d=882095&f=PAU", sample:"Balustrade Spy · FNM · 22/08/26",
       list:`4 Balustrade Spy
4 Generous Ent
4 Masked Vandal
4 Overgrown Battlement
4 Sagu Wildling
4 Saruli Caretaker
3 Mesmeric Fiend
3 Wall of Roots
2 Elves of Deep Shadow
2 Gatecreeper Vine
2 Lotleth Giant
2 Quirion Ranger
1 Jaspera Sentinel
1 Nyxborn Hydra
1 Troll of Khazad-dum
2 Lotus Petal
4 Land Grant
4 Lead the Stampede
4 Winding Way
2 Dread Return
3 Forest
1 Swamp
Sideboard
1 Mesmeric Fiend
3 Faerie Macabre
3 Fang Dragon
3 Healer of the Glade
3 Writhing Chrysalis
1 Flaring Pain
1 Mountain`},
    ],
  },
  pioneer: {
    src: "MTGTop8 · últimas 2 semanas · 105 mazos",
    url: "https://mtgtop8.com/format?f=PI",
    mtgdecks: "https://mtgdecks.net/Pioneer",
    archetypes: [
      {name:"UR Aggro", share:19, arch:"https://mtgtop8.com/archetype?a=875&meta=194&f=PI", deck:"https://mtgtop8.com/event?e=89866&d=881985&f=PI", sample:"UR Aggro · MTGO Challenge 32 · 20/08/26",
       list:`4 Flow State
2 Mountain
3 Burst Lightning
1 Riverglide Pathway
4 Stormchaser's Talent
4 Academic Dispute
4 Sleight of Hand
3 Reckless Rage
1 Island
3 Emberheart Challenger
4 Riverpyre Verge
4 Soul-Scar Mage
3 Boomerang Basics
4 Shivan Reef
4 Spirebluff Canal
4 Monastery Swiftspear
4 Steam Vents
2 Monstrous Rage
2 Experimental Synthesizer
Sideboard
1 Boomerang Basics
1 Iroh's Demonstration
1 Firebending Lesson
1 Octopus Form
1 Soul-Guide Lantern
2 Scorching Shot
2 Redcap Melee
1 Quantum Riddler
1 It'll Quench Ya!
2 Pyroclasm
2 Spell Pierce`},
      {name:"The Rock", share:13, arch:"https://mtgtop8.com/archetype?a=2898&meta=194&f=PI", deck:"https://mtgtop8.com/event?e=90887&d=890278&f=PI", sample:"The Rock · MTGO Challenge 32 · 14/09/26",
       list:`3 Professor Dellian Fel
4 Badgermole Cub
2 Bitter Triumph
4 Overgrown Tomb
1 Boseiju, Who Endures
1 Culling Ritual
4 Darkbore Pathway
4 Mutavault
3 Fatal Push
1 Go for the Throat
4 Graveyard Trespasser
2 Llanowar Wastes
2 Duress
1 Restless Cottage
3 Sheoldred, the Apocalypse
2 Swamp
1 Takenuma, Abandoned Mire
4 Blooming Marsh
4 Unholy Annex // Ritual Chamber
4 Abrupt Decay
1 Wastewood Verge
4 Thoughtseize
1 Urborg, Tomb of Yawgmoth
Sideboard
1 Professor Dellian Fel
2 Culling Ritual
1 Fatal Push
1 Duress
3 Go Blank
2 Invoke Despair
1 Nowhere to Run
2 Cruelclaw's Heist
2 Unlicensed Hearse`},
      {name:"Greasefang Parhelion", share:10, arch:"https://mtgtop8.com/archetype?a=1317&meta=194&f=PI", deck:"https://mtgtop8.com/event?e=87868&d=866722&f=PI", sample:"Greasefang · MTGO League · 07/07/26",
       list:`1 Boseiju, Who Endures
3 Darkbore Pathway
4 Concealed Courtyard
4 Parhelion II
3 Blooming Marsh
1 Takenuma, Abandoned Mire
1 Emptiness
1 Brushland
3 Cache Grab
1 Swamp
1 Plains
2 Overlord of the Balemurk
3 Formidable Speaker
1 Lush Portico
2 Witherbloom Command
1 Starting Town
3 Collective Brutality
1 Godless Shrine
3 Professor of Symbology
1 Jennifer Walters
4 Esika's Chariot
4 Greasefang, Okiba Boss
2 Bitter Triumph
4 Temple Garden
4 Thoughtseize
2 Thundering Broodwagon
Sideboard
1 Vanishing Verse
1 Ashiok, Dream Render
2 Unlicensed Hearse
2 Fatal Push
2 Abrupt Decay
2 Professor Dellian Fel
1 Enter the Avatar State
1 Origin of Metalbending
1 Loran of the Third Path
2 Duress`},
      {name:"Red Deck Wins", share:8, arch:"https://mtgtop8.com/archetype?a=862&meta=194&f=PI", deck:"https://mtgtop8.com/event?e=89327&d=877896&f=PI", sample:"Red Deck Wins · 07/08/26",
       list:`4 Monastery Swiftspear
4 Soul-Scar Mage
4 Emberheart Challenger
3 Bonecrusher Giant
4 Screaming Nemesis
2 Sunspine Lynx
13 Mountain
4 Monstrous Rage
4 Reckless Rage
4 Kumano Faces Kakkazan
1 Den of the Bugbear
4 Burst Lightning
4 Ramunap Ruins
1 Rockface Village
1 Sokenzan, Crucible of Defiance
3 Mutavault
Sideboard
2 Sunspine Lynx
2 Weathered Runestone
4 Magebane Lizard
2 Rending Volley
2 Redcap Melee
3 Scorching Shot`},
      {name:"Boros Control", share:8, arch:"https://mtgtop8.com/archetype?a=2319&meta=194&f=PI", deck:"https://mtgtop8.com/event?e=91140&d=892194&f=PI", sample:"Boros Control · MTGO Challenge 32 · 21/09/26",
       list:`1 Elspeth, Storm Slayer
2 High Noon
4 Erode
4 Cleansing Wildfire
4 Emergency Eject
4 The Legend of Roku
4 Get Lost
4 Price of Freedom
4 Avengers Disassembled
3 Beza, the Bounding Spring
2 Mountain
4 Field of Ruin
4 Demolition Field
4 Cori Mountain Monastery
4 Sacred Foundry
4 Sunken Citadel
4 Plains
Sideboard
3 Temporary Lockdown
2 Farewell
2 Hexing Squelcher
2 Chandra, Awakened Inferno
4 Rest in Peace
1 Elspeth, Storm Slayer
1 Beza, the Bounding Spring`},
      {name:"Dimir Aggro", share:5, arch:"https://mtgtop8.com/archetype?a=1549&meta=194&f=PI", deck:"https://mtgtop8.com/event?e=87446&d=863612&f=PI", sample:"Dimir Aggro · MTGO Challenge 32 · 28/06/26",
       list:`3 Go for the Throat
3 Unholy Annex // Ritual Chamber
4 Kaito, Bane of Nightmares
4 Fatal Push
4 Thoughtseize
2 Sheoldred, the Apocalypse
4 Floodpits Drowner
4 Mockingbird
4 Moon-Circuit Hacker
4 Faerie Miscreant
1 Takenuma, Abandoned Mire
1 Otawara, Soaring City
1 Urborg, Tomb of Yawgmoth
2 Island
3 Multiversal Passage
4 Mutavault
4 Gloomlake Verge
4 Darkslick Shores
4 Watery Grave
Sideboard
4 Leyline of the Void
1 Gix's Command
2 Duress
2 Disdainful Stroke
2 Bitter Triumph
2 Path of Peril
1 Languish
1 Liliana, the Last Hope`},
      {name:"Rakdos Sacrifice", share:4, arch:"https://mtgtop8.com/archetype?a=1543&meta=194&f=PI", deck:"https://mtgtop8.com/event?e=91140&d=892198&f=PI", sample:"Rakdos Sacrifice · MTGO Challenge 32 · 21/09/26",
       list:`1 Takenuma, Abandoned Mire
1 Sokenzan, Crucible of Defiance
4 Fatal Push
4 Bloodtithe Harvester
4 Cauldron Familiar
3 Claim the Firstborn
4 Deadly Dispute
2 Den of the Bugbear
4 Eyetwitch
4 Fable of the Mirror-Breaker
4 Blood Crypt
4 Mayhem Devil
1 Scavenger's Talent
3 Blightstep Pathway
4 Blazemire Verge
3 Swamp
4 Blackcleave Cliffs
2 The Sackville-Bagginses
4 Witch's Oven
Sideboard
1 Abandon Attachments
1 Decorum Dissertation
1 Firebending Lesson
4 Thoughtseize
1 Go Blank
1 Ozai's Cruelty
3 The Legend of Roku
2 Ghost Vacuum
1 Ruinous Waterbending`},
      {name:"Devotion to Green", share:4, arch:"https://mtgtop8.com/archetype?a=864&meta=194&f=PI", deck:"https://mtgtop8.com/event?e=91108&d=891940&f=PI", sample:"Devotion to Green · 21/09/26",
       list:`4 Vibrance
1 Ba Sing Se
12 Forest
4 Llanowar Elves
1 Polukranos Reborn
4 Leyline of the Guildpact
4 Outcaster Trailblazer
4 Storm the Festival
2 Ulvenwald Oddity
4 Cavalier of Thorns
3 Old-Growth Troll
2 Lair of the Hydra
1 Hostile Hostel
1 Oath of Nissa
4 Kiora, Behemoth Beckoner
1 Boseiju, Who Endures
4 Nykthos, Shrine to Nyx
4 Elvish Mystic
Sideboard
1 Pick Your Poison
2 Scrapshooter
1 Unlicensed Hearse
2 Tail Swipe
1 Cityscape Leveler
4 Setessan Petitioner
1 Emrakul, the Promised End
2 Prowling Serpopard
1 Ghost Vacuum`},
    ],
  },
  cedh: {
    src: "EDHTop16 · últimos 3 meses",
    url: "https://edhtop16.com/?timePeriod=THREE_MONTHS",
    top: [
      ["Kraum, Ludevic's Opus / Tymna the Weaver",7.04,637],["Kinnan, Bonder Prodigy",6.81,616],["Rograkh, Son of Rohgahh / Thrasios, Triton Hero",4.76,431],
      ["Rograkh, Son of Rohgahh / Silas Renn, Seeker Adept",4.43,401],["Sisay, Weatherlight Captain",3.67,332],["Thrasios, Triton Hero / Tymna the Weaver",3.01,272],
      ["Dargo, the Shipwrecker / Tymna the Weaver",1.99,180],["Ral, Monsoon Mage",1.96,177],["Vivi Ornitier",1.78,161],["Nick Fury, Agent of S.H.I.E.L.D.",1.73,157],
      ["Crystal, Inhuman Princess",1.69,153],["Magda, Brazen Outlaw",1.66,150],["Ishai, Ojutai Dragonspeaker / Rograkh, Son of Rohgahh",1.65,149],
      ["Etali, Primal Conqueror",1.59,144],["Thrasios, Triton Hero / Yoshimaru, Ever Faithful",1.56,141],["Tayam, Luminous Enigma",1.40,127],
      ["Ob Nixilis, Captive Kingpin",1.29,117],["Kefka, Court Mage",1.04,94],["Tivit, Seller of Secrets",0.92,83],["Arcum Dagsson",0.81,73],
      ["Winota, Joiner of Forces",0.77,70],["The Cabbage Merchant",0.76,69],["Rowan, Scion of War",0.76,69],["Lumra, Bellow of the Woods",0.74,67],
      ["Brigid, Clachan's Heart",0.72,65],
    ],
  },
};
// Piezas habituales de cEDH por color (referencia general; Mana Crypt, Jeweled Lotus, Dockside Extortionist y Nadu están prohibidas desde sep-2024)
const CEDH_STAPLES = {
  C: ["Sol Ring","Mana Vault","Chrome Mox","Mox Diamond","Lotus Petal","Grim Monolith","Arcane Signet","Fellwar Stone","Ancient Tomb","Lion's Eye Diamond","Command Tower"],
  W: ["Enlightened Tutor","Swords to Plowshares","Silence","Esper Sentinel","Drannith Magistrate","Grand Abolisher","Orim's Chant"],
  U: ["Force of Will","Fierce Guardianship","Pact of Negation","Mystical Tutor","Rhystic Study","Mystic Remora","Flusterstorm","Brainstorm","Swan Song","Mana Drain","Force of Negation","Thassa's Oracle"],
  B: ["Demonic Tutor","Vampiric Tutor","Imperial Seal","Demonic Consultation","Tainted Pact","Necropotence","Ad Nauseam","Dark Ritual","Cabal Ritual","Opposition Agent","Orcish Bowmasters"],
  R: ["Gamble","Deflecting Swat","Underworld Breach","Brain Freeze","Jeska's Will","Wheel of Fortune","Pyroblast"],
  G: ["Worldly Tutor","Carpet of Flowers","Elvish Mystic","Llanowar Elves","Birds of Paradise","Delighted Halfling","Utopia Sprawl","Sylvan Library","Crop Rotation","Veil of Summer","Survival of the Fittest"],
};
const FAST_MANA = new Set(["sol ring","mana vault","chrome mox","mox diamond","lotus petal","grim monolith","lion's eye diamond","ancient tomb","dark ritual","cabal ritual","simian spirit guide","elvish spirit guide","mox opal","mox amber","jeweled amulet","springleaf drum","carpet of flowers","rite of flame","culling the weak"]);
const FREE_INTERACTION = new Set(["force of will","fierce guardianship","pact of negation","force of negation","deflecting swat","deadly rollick","flawless maneuver","snuff out","mental misstep","misdirection","commandeer","daze","subtlety","solitude","endurance","gut shot","mindbreak trap","foil","thwart","disrupting shoal","sickening shoal","silence","orim's chant","veil of summer"]);
// Reglas por bracket (guía oficial, actualización 9-feb-2026)
const BRACKETS = [
  null,
  {n:1, name:"Exhibición", gc:0, combo2:false, xt:0, mld:false, tutors:2, text:"Mazos temáticos o casuales. Sin Game Changers, sin destrucción masiva de tierras, sin turnos extra y sin combos infinitos de 2 cartas. Pocos tutores."},
  {n:2, name:"Núcleo", gc:0, combo2:false, xt:2, mld:false, tutors:3, text:"El nivel de un precon. Sin Game Changers, sin destrucción masiva de tierras, sin combos de 2 cartas. Turnos extra sueltos, sin encadenarlos. Pocos tutores."},
  {n:3, name:"Mejorado", gc:3, combo2:false, xt:3, mld:false, tutors:6, text:"Mazos afinados. Hasta 3 Game Changers. Sin destrucción masiva de tierras ni combos de 2 cartas tempranos. Más tutores permitidos."},
  {n:4, name:"Optimizado", gc:99, combo2:true, xt:99, mld:true, tutors:99, text:"Alto poder sin restricciones: Game Changers ilimitados, combos, tutores y destrucción masiva de tierras."},
  {n:5, name:"cEDH", gc:99, combo2:true, xt:99, mld:true, tutors:99, text:"Competitivo de torneo. Mismas reglas que el 4, pero construido para ganar lo antes posible contra el meta de EDHTop16."},
];

// Plan de sideboard por arquetipo: tipo de mazo y qué herramientas funcionan contra él
const META_VS = {
  pauper: {"Burn":{plan:"aggro",vs:["life","counter","antiRed","removal"]},"Affinity":{plan:"aggro",vs:["artifact","wipe","antiBlue"]},"Urzatron":{plan:"control",vs:["counter","lands","discard"]},
    "Mono Blue Aggro":{plan:"aggro",vs:["antiBlue","wipe","removal"]},"Weenie White":{plan:"aggro",vs:["wipe","removal","artifact"]},"Elves":{plan:"aggro",vs:["wipe","removal"]},
    "Dimir Control":{plan:"control",vs:["antiBlue","discard","counter"]},"Ephemerate":{plan:"control",vs:["antiBlue","grave","counter"]},"Balustrade Spy":{plan:"combo",vs:["grave","counter","discard"]}},
  pioneer: {"UR Aggro":{plan:"aggro",vs:["removal","wipe","life","antiRed","antiBlue"]},"The Rock":{plan:"control",vs:["counter","discard"]},"Greasefang Parhelion":{plan:"combo",vs:["grave","artifact","removal"]},
    "Red Deck Wins":{plan:"aggro",vs:["life","removal","antiRed"]},"Boros Control":{plan:"control",vs:["counter","discard"]},"Dimir Aggro":{plan:"aggro",vs:["removal","wipe","antiBlue"]},
    "Rakdos Sacrifice":{plan:"aggro",vs:["grave","wipe","removal"]},"Devotion to Green":{plan:"combo",vs:["removal","counter","wipe"]}},
};
const SB_ES = {artifact:"contra artefactos", grave:"contra el cementerio", antiBlue:"contra azul", antiRed:"contra rojo", life:"ganar vida", counter:"contrahechizo", discard:"descarte", lands:"contra tierras", removal:"removal", wipe:"barrido"};

/* ---------- Pauper: matchups y referencias de torneos ----------
   Paupergeddon Summer 2026 (Lucca, 11-12 jul 2026, 1.086 jugadores en el Main Event).
   Matriz agregada Main Event + Top Pauper Player + Rebound: 5.626 partidas.
   Pauper World: meta MTGO de la semana 13-26 sep 2026 (1.011 mazos, 30 eventos). */
const PAUPER_MU = {
  at: "27 de septiembre de 2026",
  src: "Paupergeddon Summer 2026 · matriz agregada (Main Event + TPP + Rebound, 5.626 partidas)",
  url: "https://www.paupergeddon.com/Stats/Paupergeddon_0726/Paupergeddon_Summer2026_MatchupAnalysis_aggregated.html",
  top8: ["Jund Wildfire (Jan Plachý, campeón)","White Weenie","Mono Red Rally","Pinger Tron","Jund Wildfire","Mono Red Rally","Cycling Storm","Monster Tron"],
  arch: ["Grixis Affinity","Mono Red Madness","Mono Blue Terror","Spy Combo","Jund Wildfire","Naya Gates","Elves","Monster Tron","Dimir Faeries","Jeskai Ephemerate","Mono Red Rally","White Weenie","Dimir Terror"],
  // "A|B": [victorias de A, derrotas de A]
  m: {
    "Grixis Affinity|Mono Red Madness":[84,61],"Grixis Affinity|Mono Blue Terror":[35,37],"Grixis Affinity|Spy Combo":[28,22],"Grixis Affinity|Jund Wildfire":[45,33],"Grixis Affinity|Naya Gates":[35,23],"Grixis Affinity|Elves":[24,16],"Grixis Affinity|Monster Tron":[31,11],"Grixis Affinity|Dimir Faeries":[16,25],"Grixis Affinity|Jeskai Ephemerate":[13,14],"Grixis Affinity|Mono Red Rally":[21,23],"Grixis Affinity|White Weenie":[13,18],"Grixis Affinity|Dimir Terror":[9,16],
    "Mono Red Madness|Mono Blue Terror":[22,40],"Mono Red Madness|Spy Combo":[30,26],"Mono Red Madness|Jund Wildfire":[18,53],"Mono Red Madness|Naya Gates":[28,38],"Mono Red Madness|Elves":[38,12],"Mono Red Madness|Monster Tron":[24,27],"Mono Red Madness|Dimir Faeries":[21,24],"Mono Red Madness|Jeskai Ephemerate":[13,19],"Mono Red Madness|Mono Red Rally":[10,51],"Mono Red Madness|White Weenie":[10,14],"Mono Red Madness|Dimir Terror":[20,20],
    "Mono Blue Terror|Spy Combo":[15,18],"Mono Blue Terror|Jund Wildfire":[23,16],"Mono Blue Terror|Naya Gates":[25,10],"Mono Blue Terror|Elves":[12,12],"Mono Blue Terror|Monster Tron":[17,12],"Mono Blue Terror|Dimir Faeries":[9,7],"Mono Blue Terror|Jeskai Ephemerate":[8,7],"Mono Blue Terror|Mono Red Rally":[17,15],"Mono Blue Terror|White Weenie":[12,5],"Mono Blue Terror|Dimir Terror":[6,9],
    "Spy Combo|Jund Wildfire":[9,17],"Spy Combo|Naya Gates":[12,7],"Spy Combo|Elves":[14,11],"Spy Combo|Monster Tron":[11,5],"Spy Combo|Dimir Faeries":[7,2],"Spy Combo|Jeskai Ephemerate":[12,4],"Spy Combo|Mono Red Rally":[10,1],"Spy Combo|White Weenie":[5,2],"Spy Combo|Dimir Terror":[5,4],
    "Jund Wildfire|Naya Gates":[14,15],"Jund Wildfire|Elves":[17,17],"Jund Wildfire|Monster Tron":[10,12],"Jund Wildfire|Dimir Faeries":[8,9],"Jund Wildfire|Jeskai Ephemerate":[7,15],"Jund Wildfire|Mono Red Rally":[11,16],"Jund Wildfire|White Weenie":[9,13],"Jund Wildfire|Dimir Terror":[5,7],
    "Naya Gates|Elves":[9,10],"Naya Gates|Monster Tron":[6,3],"Naya Gates|Dimir Faeries":[9,3],"Naya Gates|Jeskai Ephemerate":[7,6],"Naya Gates|Mono Red Rally":[14,9],"Naya Gates|White Weenie":[9,2],"Naya Gates|Dimir Terror":[9,1],
    "Elves|Monster Tron":[10,5],"Elves|Dimir Faeries":[6,3],"Elves|Jeskai Ephemerate":[8,5],"Elves|Mono Red Rally":[12,6],"Elves|White Weenie":[10,7],"Elves|Dimir Terror":[4,7],
    "Monster Tron|Dimir Faeries":[5,2],"Monster Tron|Jeskai Ephemerate":[5,8],"Monster Tron|Mono Red Rally":[12,6],"Monster Tron|White Weenie":[11,5],"Monster Tron|Dimir Terror":[7,1],
    "Dimir Faeries|Jeskai Ephemerate":[2,6],"Dimir Faeries|Mono Red Rally":[8,8],"Dimir Faeries|White Weenie":[8,9],"Dimir Faeries|Dimir Terror":[5,8],
    "Jeskai Ephemerate|Mono Red Rally":[8,6],"Jeskai Ephemerate|White Weenie":[11,3],"Jeskai Ephemerate|Dimir Terror":[5,5],
    "Mono Red Rally|White Weenie":[16,3],"Mono Red Rally|Dimir Terror":[5,3],
    "White Weenie|Dimir Terror":[6,3],
  },
  // participación en el meta: Pauper World (MTGO, 1 semana) y Paupergeddon día 2
  pw: {"Mono Red Madness":15.2,"Mono Blue Terror":8.3,"Elves":5.2,"Dimir Faeries":4.2,"Grixis Affinity":4.1,"Mono Red Rally":4.1,"Spy Combo":3.3,"Jund Wildfire":3.3},
  pwOther: {"Bogles":4.2,"Esper Affinity":4.1},
  pwUrl: "https://pauperworld.com/meta", pwAt: "13-26 sep 2026 · 1.011 mazos MTGO",
  day2: {"Grixis Affinity":13.33,"Mono Red Madness":8,"Mono Blue Terror":8,"Spy Combo":6,"Jund Wildfire":5.33,"Naya Gates":5.33},
  pwSlug: n => "https://pauperworld.com/archetype/"+n.toLowerCase().replace(/[^a-z0-9]+/g,"-"),
  // equivalencias con los nombres de MTGTop8
  alias: {"Burn":"Mono Red Madness","Affinity":"Grixis Affinity","Urzatron":"Monster Tron","Weenie White":"White Weenie","Elves":"Elves","Dimir Control":"Dimir Faeries","Ephemerate":"Jeskai Ephemerate","Balustrade Spy":"Spy Combo"},
};
// Lista mejor ubicada de cada arquetipo en el Main Event de Paupergeddon Summer 2026 (Top 64)
const PG_LISTS = {
"Grixis Affinity":{place:9, pilot:"Antonio Picardi", list:`4 Refurbished Familiar
4 Myr Enforcer
3 Krark-Clan Shaman
2 Kenku Artificer
3 Utrom Monitor
4 Ichor Wellspring
3 Nihil Spellbomb
2 Blood Fountain
1 Makeshift Munitions
4 Galvanic Blast
4 Reckoner's Bargain
3 Toxin Analysis
4 Thoughtcast
2 Silverbluff Bridge
4 Mistvault Bridge
4 Vault of Whispers
2 Great Furnace
2 Seat of the Synod
4 Drossforge Bridge
1 Mountain
Sideboard
1 Unexpected Fangs
2 Extract a Confession
1 Krark-Clan Shaman
1 Red Elemental Blast
4 Pyroblast
4 Hydroblast
2 Blue Elemental Blast`},
"Mono Red Madness":{place:11, pilot:"Matteo Rullo", list:`4 Guttersnipe
4 Sneaky Snacker
4 Voldaren Epicure
4 Melded Moxite
4 Fiery Temper
4 Fireblast
4 Lava Dart
4 Lightning Bolt
2 Faithless Looting
4 Grab the Prize
4 Highway Robbery
18 Mountain
Sideboard
1 Crimson Fleet Commodore
4 Pyroblast
3 Red Elemental Blast
4 Relic of Progenitus
3 Searing Blaze`},
"Mono Blue Terror":{place:40, pilot:"Matteo Conte", list:`4 Tolarian Terror
4 Cryptic Serpent
1 Murmuring Mystic
4 Delver of Secrets // Insectile Aberration
4 Brainstorm
4 Thought Scour
4 Mental Note
4 Counterspell
1 Dispel
3 Ponder
1 Deep Analysis
4 Deem Inferior
2 Sleep of the Dead
4 Lórien Revealed
16 Island
Sideboard
4 Hydroblast
3 Blue Elemental Blast
1 Envelop
4 Annul
2 Gut Shot
1 Murmuring Mystic`},
"Spy Combo":{place:14, pilot:"Nicola Cordeschi", list:`3 Avenging Hunter
4 Balustrade Spy
3 Gatecreeper Vine
4 Generous Ent
2 Elves of Deep Shadow
2 Lotleth Giant
4 Masked Vandal
2 Mesmeric Fiend
4 Overgrown Battlement
4 Saruli Caretaker
3 Wall of Roots
4 Sagu Wildling // Roost Seek
1 Troll of Khazad-dûm
1 Jack-o'-Lantern
1 Lotus Petal
1 Flaring Pain
2 Dread Return
4 Land Grant
4 Lead the Stampede
4 Winding Way
3 Forest
1 Swamp
Sideboard
2 Faerie Macabre
2 Writhing Chrysalis
3 Infestation Sage
1 Lotleth Giant
2 Mesmeric Fiend
4 Nylea's Disciple
1 Undergrowth Leopard`},
"Jund Wildfire":{place:1, pilot:"Jan Plachý", list:`4 Writhing Chrysalis
3 Krark-Clan Shaman
4 Refurbished Familiar
2 Nyxborn Hydra
3 Ichor Wellspring
3 Lembas
3 Nihil Spellbomb
1 Blood Fountain
2 Toxin Analysis
4 Cast Down
4 Fanatical Offering
2 Eviscerator's Insight
1 Pulse of Murasa
4 Cleansing Wildfire
4 Twisted Landscape
4 Drossforge Bridge
4 Slagwoods Bridge
3 Swamp
1 Mountain
2 Forest
2 Vault of Whispers
Sideboard
2 Faerie Macabre
2 Pyroblast
3 Duress
3 Weather the Storm
2 Troublemaker Ouphe
1 Terminate
2 Breath Weapon`},
"Naya Gates":{place:20, pilot:"Pietro Malevolti", list:`4 Outlaw Medic
4 Sacred Cat
4 Sneaky Snacker
4 Writhing Chrysalis
2 Melded Moxite
2 Bitter Reunion
1 Talons of Wildwood
3 Lightning Bolt
4 Prismatic Strands
3 Thraben Charm
4 Malevolent Rumble
4 Pursue the Past
4 Basilisk Gate
4 Citadel Gate
4 Cliffgate
1 Heap Gate
3 Manor Gate
3 Mountain
2 Plains
Sideboard
2 Ancient Grudge
1 Electrickery
4 Red Elemental Blast
4 Spellstutter Sprite
4 Tamiyo's Safekeeping`},
"Elves":{place:10, pilot:"Andrea Mattei", list:`4 Avenging Hunter
4 Fyndhorn Elves
4 Generous Ent
4 Masked Vandal
4 Nyxborn Hydra
4 Priest of Titania
4 Quirion Ranger
2 Llanowar Elves
2 Elvish Mystic
4 Timberwatch Elf
3 Sagu Wildling // Roost Seek
1 Land Grant
4 Winding Way
4 Lead the Stampede
1 Gingerbread Cabin
11 Forest
Sideboard
2 Lignify
4 Faerie Macabre
4 Monstrous Emergence
3 Primordial Pachyderm
2 Rooftop Percher`},
"Monster Tron":{place:8, pilot:"Andrea Feltrin", list:`4 Bramble Wurm
2 Generous Ent
4 Maelstrom Colossus
4 Rooftop Percher
4 Barrels of Blasting Jelly
2 Bonder's Ornament
4 Expedition Map
4 Pinnacle Kill-Ship
2 Prophetic Prism
2 Crop Rotation
1 Pulse of Murasa
4 Unfathomable Truths
4 Ancient Stirrings
1 Kaervek's Torch
1 Bojuka Bog
2 Forest
1 Haunted Fengraf
2 Hidden Grotto
4 Urza's Mine
4 Urza's Power Plant
4 Urza's Tower
Sideboard
4 Blue Elemental Blast
3 Breath Weapon
2 Coalition Honor Guard
2 Relic of Progenitus
4 Scour from Existence`},
"Dimir Terror":{place:18, pilot:"Lorenzo Pucci", list:`2 Gurmag Angler
1 Murmuring Mystic
4 Sneaky Snacker
4 Tolarian Terror
2 Abandon Attachments
4 Brainstorm
2 Cast Down
4 Counterspell
4 Mental Note
4 Snuff Out
2 Spell Pierce
4 Thought Scour
2 Unexpected Fangs
4 Lórien Revealed
1 Deep Analysis
4 Contaminated Aquifer
2 Ice Tunnel
10 Island
Sideboard
2 Annul
2 Arms of Hadar
3 Blue Elemental Blast
2 Hydroblast
2 Nihil Spellbomb
3 Steel Sabotage
1 Thorn of the Black Rose`},
"Jeskai Ephemerate":{place:33, pilot:"Hayden Dubock", list:`2 Archaeomancer
4 Augur of Bolas
3 Mulldrifter
2 Murmuring Mystic
2 Behold the Multiverse
4 Counterspell
2 Dispel
3 Ephemerate
2 Ride's End
4 Skred
2 Union of the Third Path
4 Preordain
2 Fanged Flames
4 Lórien Revealed
3 Glacial Floodplain
4 Perilous Landscape
6 Snow-Covered Island
2 Snow-Covered Mountain
2 Snow-Covered Plains
3 Volatile Fjord
Sideboard
2 Destroy Evil
3 Dust to Dust
2 Envelop
4 Hydroblast
4 Pyroblast`},
"Mono Red Rally":{place:3, pilot:"Dario Boniburini", list:`4 Burning-Tree Emissary
4 Clockwork Percussionist
4 Goblin Bushwhacker
4 Goblin Tomb Raider
4 Voldaren Epicure
4 Inventor's Axe
4 Galvanic Blast
4 Lightning Bolt
2 Chain Lightning
4 Rally at the Hornburg
3 Reckless Impulse
1 Wrenn's Resolve
4 Great Furnace
14 Mountain
Sideboard
4 Cast into the Fire
1 Flaring Pain
4 Pyroblast
3 Relic of Progenitus
3 Tectonic Hazard`},
"White Weenie":{place:2, pilot:"Giovanni Favetta", list:`4 Kor Skyfisher
4 Novice Inspector
4 Raffine's Informant
4 Thraben Inspector
3 Leonardo, Big Brother
1 Spider-Man, Web-Slinger
2 Elite Interceptor // Rejoinder
4 Lunarch Veteran // Luminous Phantom
4 Prismatic Strands
4 Thraben Charm
2 Guardians' Pledge
1 Ramosian Rally
4 Battle Screech
17 Plains
2 Idyllic Grange
Sideboard
4 Dust to Dust
3 Journey to Nowhere
3 Standard Bearer
1 Holy Light
4 Martyr of Sands`},
};
// Plan de cada arquetipo de la matriz (para la guía de sideboard y las adiciones)
Object.assign(META_VS.pauper, {
  "Mono Red Madness":{plan:"aggro",vs:["life","counter","antiRed","removal"]},
  "Grixis Affinity":{plan:"aggro",vs:["artifact","wipe","antiBlue","antiRed"]},
  "Monster Tron":{plan:"control",vs:["counter","lands","discard","antiBlue"]},
  "Mono Blue Terror":{plan:"aggro",vs:["antiBlue","removal","wipe"]},
  "White Weenie":{plan:"aggro",vs:["wipe","removal"]},
  "Dimir Faeries":{plan:"control",vs:["antiBlue","wipe","removal"]},
  "Dimir Terror":{plan:"control",vs:["antiBlue","removal","discard"]},
  "Jeskai Ephemerate":{plan:"control",vs:["antiBlue","antiRed","grave","counter"]},
  "Spy Combo":{plan:"combo",vs:["grave","counter","discard","removal"]},
  "Jund Wildfire":{plan:"control",vs:["artifact","counter","lands"]},
  "Naya Gates":{plan:"aggro",vs:["antiRed","removal","wipe"]},
  "Mono Red Rally":{plan:"aggro",vs:["life","wipe","antiRed","removal"]},
});
// Cartas de banquillo por función y color, habituales en Pauper (se valida la legalidad con Scryfall)
const PAUPER_SB = {
  artifact:[["Dust to Dust","W"],["Ancient Grudge","R"],["Gorilla Shaman","R"],["Steel Sabotage","U"],["Nature's Claim","G"],["Abrade","R"],["Breath Weapon","R"],["Krark-Clan Shaman","R"]],
  grave:[["Relic of Progenitus","C"],["Faerie Macabre","B"],["Nihil Spellbomb","C"],["Scour from Existence","C"],["Bojuka Bog","B"],["Tormod's Crypt","C"]],
  antiBlue:[["Pyroblast","R"],["Red Elemental Blast","R"]],
  antiRed:[["Hydroblast","U"],["Blue Elemental Blast","U"]],
  life:[["Weather the Storm","G"],["Martyr of Sands","W"],["Holy Light","W"],["Lembas","C"]],
  counter:[["Counterspell","U"],["Annul","U"],["Dispel","U"],["Spell Pierce","U"],["Envelop","U"]],
  discard:[["Duress","B"],["Extract a Confession","B"],["Chittering Rats","B"]],
  wipe:[["Electrickery","R"],["Fiery Cannonade","R"],["Arms of Hadar","B"],["Pestilence","B"],["Crypt Rats","B"],["Breath Weapon","R"],["Holy Light","W"]],
  removal:[["Lightning Bolt","R"],["Journey to Nowhere","W"],["Snuff Out","B"],["Cast Down","B"],["Skred","R"],["Gut Shot","R"],["Lignify","G"],["Terminate","BR"]],
  lands:[["Molten Rain","R"],["Stone Rain","R"],["Scour from Existence","C"],["Bojuka Bog","B"]],
};
