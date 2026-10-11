// Prueba de manos: reparte miles de manos iniciales y juega los primeros 10 turnos en solitario
// (tierra por turno, ramp, comandante) para medir consistencia. No hay rivales.
import type { Analysis } from "./analyze.ts";
import type { Card } from "./types.ts";

export interface HandStats {
  G: number;                  // manos jugadas
  N: number; L: number;       // cartas y tierras en la biblioteca
  cmdCmc: number;
  pMull: number;              // manos que obligan a mulligan
  pScrew: number;             // menos de 3 tierras en el turno 4
  pFlood: number;             // 8 o más tierras vistas al turno 6
  avgTurn: number | null;     // turno promedio en que baja el comandante
  byT: Record<4 | 5 | 6, number>;
  hyp: number[];              // probabilidad de 0..7 tierras en la mano inicial
  manaT: number[];            // maná disponible por turno (1..10)
  hasWin: boolean;
  winAvg: number | null;      // turno promedio con un remate lanzable
  winP: number;
  winBy: Record<6 | 8 | 10, number>;
}

/** Probabilidad hipergeométrica: k aciertos al robar n de N con K aciertos posibles. */
export function hyper(N: number, K: number, n: number, k: number): number {
  const C = (a: number, b: number) => { if (b < 0 || b > a) return 0; let r = 1; for (let i = 1; i <= b; i++) r = r * (a - b + i) / i; return r; };
  return C(K, k) * C(N - K, n - k) / C(N, n);
}
export function atLeast(N: number, K: number, n: number, k: number): number {
  let s = 0; for (let i = k; i <= Math.min(n, K); i++) s += hyper(N, K, n, i); return s;
}

interface LibCard { land: boolean; ramp: boolean; win: boolean; cmc: number }
const cache = new Map<string, HandStats | null>();

/**
 * @param rnd generador al azar; si se entrega (pruebas, comparación A contra B) el resultado no se guarda en memoria.
 */
export function simulateHands(A: Analysis, rnd?: () => number, G = 10000): HandStats | null {
  const lib: LibCard[] = [];
  for (const r of A.rows) for (let i = 0; i < r.q; i++) lib.push({ land: !!(r.m && r.m.t === "Land"), ramp: !!(r.m && r.m.t !== "Land" && (r.m.r || []).includes("ramp")), win: !!(r.m && (r.m.r || []).includes("wincon")), cmc: r.m ? r.m.cmc : 3 });
  // la clave es lo que la simulación usa de cada carta: si cambian sus datos (no solo la lista), se recalcula
  const key = G + "|" + lib.map(c => (c.land ? "L" : c.ramp ? "R" : c.win ? "W" : "s") + c.cmc).join(",") + "|" + A.cmdMeta.map(m => m ? m.cmc : "?").join("/");
  if (!rnd && cache.has(key)) return cache.get(key)!;
  if (cache.size > 300) cache.clear();
  const random = rnd || Math.random;
  const N = lib.length; if (N < 40) return null;
  const L = lib.filter(c => c.land).length;
  const hyp: number[] = []; for (let k = 0; k <= 7; k++) hyp.push(hyper(N, L, 7, k));
  const cmd = A.cmdMeta.filter((m): m is Card => !!m).map(m => m.cmc); const cmdCmc = cmd.length ? Math.min(...cmd) : 4;
  let mullAny = 0, screw = 0, flood = 0, turnSum = 0, turnN = 0; const byT = { 4: 0, 5: 0, 6: 0 };
  const manaT = new Array<number>(11).fill(0); let winSum = 0, winN = 0; const winBy = { 6: 0, 8: 0, 10: 0 }; const hasWin = lib.some(c => c.win);
  const idx = lib.map((_, i) => i);
  const shuffle = () => { for (let i = N - 1; i > 0; i--) { const j = (random() * (i + 1)) | 0; const t = idx[i]; idx[i] = idx[j]; idx[j] = t; } };
  for (let g = 0; g < G; g++) {
    let m = 0, hand: LibCard[];
    // mulligan: se repite la mano si trae menos de 2 o más de 5 tierras (hasta 2 veces)
    while (true) { shuffle(); hand = idx.slice(0, 7).map(i => lib[i]); const Lh = hand.filter(c => c.land).length; if ((Lh >= 2 && Lh <= 5) || m >= 2) break; m++; }
    if (m) mullAny++;
    let bottom = Math.max(0, m - 1);   // el primer mulligan es gratis
    while (bottom-- > 0) { const Lh = hand.filter(c => c.land).length; let k = Lh > 4 ? hand.findIndex(c => c.land) : hand.reduce((bi, c, i) => (!c.land && (bi < 0 || c.cmc > hand[bi].cmc)) ? i : bi, -1); if (k < 0) k = 0; hand.splice(k, 1); }
    let ptr = 7, inPlay = 0, bonus = 0, pending = 0, cmdT: number | null = null, winT: number | null = null, landsSeen = hand.filter(c => c.land).length;
    for (let t = 1; t <= 10; t++) {
      if (t > 1 && ptr < N) { const c = lib[idx[ptr++]]; hand.push(c); if (c.land && t <= 6) landsSeen++; }
      const li = hand.findIndex(c => c.land); if (li >= 0) { hand.splice(li, 1); inPlay++; }
      bonus += pending; pending = 0; let mana = inPlay + bonus; manaT[t] += mana;
      if (winT === null && hand.some(c => c.win && c.cmc <= mana)) winT = t;
      if (cmdT === null && mana >= cmdCmc) { cmdT = t; mana -= cmdCmc; }
      const rs = hand.map((c, i) => [c, i] as [LibCard, number]).filter(([c]) => c.ramp).sort((a, b) => a[0].cmc - b[0].cmc);
      const used: number[] = []; for (const [c, i] of rs) { if (c.cmc <= mana) { mana -= c.cmc; pending++; used.push(i); } }
      used.sort((a, b) => b - a).forEach(i => hand.splice(i, 1));
      if (t === 4 && inPlay < 3) screw++;
    }
    if (landsSeen >= 8) flood++;
    if (cmdT !== null) { turnSum += cmdT; turnN++; for (const k of [4, 5, 6] as const) if (cmdT <= k) byT[k]++; }
    if (winT !== null) { winSum += winT; winN++; for (const k of [6, 8, 10] as const) if (winT <= k) winBy[k]++; }
  }
  const res: HandStats = { G, cmdCmc, pMull: mullAny / G, pScrew: screw / G, pFlood: flood / G, avgTurn: turnN ? turnSum / turnN : null, byT: { 4: byT[4] / G, 5: byT[5] / G, 6: byT[6] / G }, hyp, L, N, manaT: manaT.map(v => v / G), hasWin, winAvg: winN ? winSum / winN : null, winP: winN / G, winBy: { 6: winBy[6] / G, 8: winBy[8] / G, 10: winBy[10] / G } };
  if (!rnd) cache.set(key, res);
  return res;
}
