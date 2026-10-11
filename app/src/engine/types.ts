// Tipos del motor. El motor no conoce la pantalla ni el almacenamiento:
// recibe mazos y una función para buscar cartas, y devuelve datos.

export type Role = "ramp" | "draw" | "removal" | "wipe" | "tutor" | "protection" | "recursion" | "wincon";

/** Una carta reducida a lo que el análisis necesita (viene de Scryfall). */
export interface Card {
  n: string;            // nombre oficial en inglés
  cmc: number;
  ci: string;           // identidad de color, p. ej. "GU"
  col: string;          // colores de la carta
  t: string;            // tipo principal: Land, Creature, Instant…
  tl: string;           // línea de tipo (cara frontal)
  cost: string;         // coste de maná, p. ej. "{2}{G}{U}"
  pm: string[];         // maná que produce
  r: Role[];            // roles detectados por el texto
  sb: string[];         // categorías de respuesta (solo se usa "counter")
  tg: string[];         // etiquetas de sinergia
  rf: string[];         // marcas extra (flash, repeat, landRamp…)
  tq?: number;          // calidad de tutor (0–100)
  gc: boolean;          // Game Changer
  xt: boolean;          // turno extra
  mld: boolean;         // destrucción masiva de tierras
  tap: boolean;         // tierra que entra girada
  pw?: number;
  tu?: number;
  leg: boolean;         // legendaria
  legal: string;        // legalidad en Commander ("legal", "banned", "not_legal", "")
  img: string;
  uri: string;
  rank: number | null;  // puesto en EDHREC
  basic?: boolean;
  at: number;           // cuándo se trajo
  rv: number;           // versión de las reglas de detección
}

export interface Entry { n: string; q: number }

export interface Combo { id: string; cards: string[]; prod: string[]; desc: string; bt: string | null }
export interface Combos { at: number; inc: Combo[]; almost: Combo[] }

export type Interaction = "low" | "mid" | "high";

/** Lo que el jugador decide antes de armar: define las casillas y los avisos. */
export interface Plan {
  bracket: number | null;   // bracket buscado (1–5) o sin definir
  theme: string;            // estrategia, en palabras del jugador o tema de EDHREC
  inter: Interaction;       // cuánta interacción quiere
}

export interface Deck {
  id: string;
  name: string;
  commanders: string[];
  cards: Entry[];
  maybe: Entry[];
  kind: "mine" | "ref";     // propio, o de referencia (rival, lista de torneo)
  owner?: string;
  plan: Plan;
  combos?: Combos;
  notes?: string;
  created: number;
  updated: number;
}

/** Foto de un mazo en un momento: se guarda sola al cambiar la lista o a pedido. */
export interface Version {
  id: string;
  deckId: string;
  at: number;
  label: string;
  src: string;              // qué produjo el cambio: "manual", "borrador", "recomendación"…
  commanders: string[];
  cards: Entry[];
  maybe: Entry[];
}

export type GameResult = "win" | "loss" | "draw";
export interface Game {
  id: string;
  deckId: string;
  at: number;
  res: GameResult;
  turn: number;             // 0 = sin anotar
  how: string | null;
  seat: number | null;
  opp: string[];
  note: string;
  versionId?: string;       // con qué versión del mazo se jugó
}

/** Cartas que juegan otros con este comandante (EDHREC). */
export interface EdhPoolCard { n: string; incl: number | null; syn: number | null }
export interface EdhData { at: number; slug: string; decks: number | null; themes: { v: string; c: number; s: string }[]; pool: EdhPoolCard[]; theme?: string }

export interface CardDb {
  /** Devuelve la carta o null si aún no hay datos. */
  get(name: string): Card | null;
  /** Todas las cartas conocidas (para buscar sugerencias). */
  all(): Iterable<Card>;
  /** ¿Está en la lista de Game Changers vigente? */
  isGC(name: string): boolean;
  gcNames(): string[];
}

export interface Row extends Entry { m: Card | null; cmd?: boolean }
