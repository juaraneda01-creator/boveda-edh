import type { Role } from "./types.ts";

export const slug = (s: unknown): string =>
  String(s || "").split(" // ")[0].split("/")[0].trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Nombre como lo usa EDHREC en sus direcciones. */
export const edhSlug = (s: unknown): string =>
  String(s || "").split(" // ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’,.!?"():]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export const WUBRG = ["W", "U", "B", "R", "G"] as const;
export const COLOR_ES: Record<string, string> = { W: "Blanco", U: "Azul", B: "Negro", R: "Rojo", G: "Verde" };
export const BASICS = new Set(["plains", "island", "swamp", "mountain", "forest", "wastes", "snow-covered-plains", "snow-covered-island", "snow-covered-swamp", "snow-covered-mountain", "snow-covered-forest", "snow-covered-wastes"]);
export const BASIC_CI: Record<string, string> = { plains: "W", island: "U", swamp: "B", mountain: "R", forest: "G", wastes: "" };
export const BASIC_NAME: Record<string, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };

export const TYPE_ES: Record<string, string> = { Creature: "Criaturas", Instant: "Instantáneos", Sorcery: "Conjuros", Artifact: "Artefactos", Enchantment: "Encantamientos", Planeswalker: "Planeswalkers", Battle: "Batallas", Land: "Tierras", Unknown: "Sin datos" };
export const TYPE_ORDER = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Battle", "Land", "Unknown"];
export const ROLE_ES: Record<Role, string> = { ramp: "ramp", draw: "robo", removal: "removal", wipe: "barrido", tutor: "tutor", protection: "protección", wincon: "remate", recursion: "reciclaje" };

/** Generador de números al azar con semilla (el mismo de la Bóveda original): permite repetir una prueba. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
export const newSeed = (): number => 1 + Math.floor(Math.random() * 2147483645);

/** Intervalo de confianza del 95 % (Wilson): cuánto podría moverse un porcentaje solo por azar. */
export function wilson(w: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96, p = w / n, den = 1 + z * z / n, c = (p + z * z / (2 * n)) / den, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export const sum = <T,>(arr: T[], f: (x: T) => number): number => arr.reduce((a, x) => a + f(x), 0);
