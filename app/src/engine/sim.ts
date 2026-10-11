// Partidas simuladas. Un modelo rápido y aproximado (no un motor de reglas): cada jugador roba,
// baja tierras, lanza lo que su maná le permite, ataca, drena y responde con removal, contrahechizos
// y barridos cuando otro se escapa. Sirve para comparar mazos y versiones entre sí y ver tendencias
// (quién gana, en qué turno, cómo), no para predecir una partida concreta.
import type { CardDb, Deck, Row } from "./types.ts";
import { analyze, type DeckLike } from "./analyze.ts";
import { FAST_MANA, FREE_INTERACTION } from "./constants.ts";
import { newSeed, seeded, wilson } from "./util.ts";

// maná total que da cada ritual (sin descontar su coste); las guías de espíritu se lanzan gratis desde la mano
const RITUAL_OUT: Record<string, number> = { "dark ritual": 3, "cabal ritual": 3, "rite of flame": 2, "seething song": 5, "culling the weak": 4, "desperate ritual": 3, "pyretic ritual": 3, "songs of the damned": 3, "jeska's will": 4, "mana geyser": 6, "infernal plunge": 3, "simian spirit guide": 1, "elvish spirit guide": 1, "lotus bloom": 3 };
const FREE_CAST = new Set(["simian spirit guide", "elvish spirit guide"]);

/** Cada carta reducida a lo que importa para la carrera. */
export interface SimCard {
  n: string; cmd: boolean; land: boolean; cmc: number; inst: boolean; creature: boolean; perm: boolean;
  pow: number; evasive?: boolean; anthem?: number; mana?: number; landRamp?: number; landHand?: number;
  ritual?: number; fast?: boolean; draw?: number; drawEngine?: boolean; removal?: boolean; counter?: boolean;
  wipe?: boolean; protect?: boolean; tutor?: boolean; free?: boolean; drain?: number; drainTurn?: number;
  outlet?: boolean; fodder?: boolean; tokens?: number; alt?: boolean; poison?: boolean;
  // estado durante la partida
  sick?: boolean; tax?: number; tokensMade?: number;
}

export function simCard(r: Row, cmd = false): SimCard {
  const m = r.m; const tg = (m && m.tg) || [], rf = (m && m.rf) || [], roles: string[] = (m && m.r) || [];
  const has = (k: string) => tg.includes(k) || rf.includes(k) || roles.includes(k);
  const t = (m && m.t) || "Creature"; const name = r.n.toLowerCase();
  const creature = /Creature/.test((m && m.tl) || t) && t !== "Land";
  const c: SimCard = { n: r.n, cmd, land: t === "Land", cmc: Math.round((m && m.cmc) || 0), inst: t === "Instant" || has("flash"), creature, perm: !/Instant|Sorcery/.test(t), pow: 0 };
  if (!m || !m.t) { Object.assign(c, { creature: true, perm: true, cmc: 3, pow: 2 }); return c; }   // carta sin datos: una criatura promedio
  c.pow = creature ? (m.pw != null ? Math.max(0, m.pw) : Math.max(1, Math.round((m.cmc || 1) * 0.85))) : 0;
  c.evasive = has("evasion");
  c.anthem = has("wcCombat") ? 1 : 0;
  c.mana = 0;
  // Rampant Growth suma 1 tierra; Explosive Vegetation, 2; Cultivate, 1 y otra a la mano
  if (!c.land && !c.perm && has("landRamp")) { c.landRamp = has("landRamp2") ? 2 : 1; if (has("landHand")) c.landHand = 1; }
  else if (!c.land && has("ramp")) {
    c.mana = FAST_MANA.has(name) && /ring|vault|crypt/.test(name) ? 2 : 1;
    if (!c.perm || FREE_CAST.has(name)) { c.ritual = RITUAL_OUT[name] != null ? RITUAL_OUT[name] : c.cmc + 1; if (FREE_CAST.has(name)) c.cmc = 0; c.mana = 0; c.perm = false; }
  }
  if (!c.land && c.perm && has("landRamp")) c.mana = Math.max(c.mana, 1);
  if (FAST_MANA.has(name) && c.perm && !c.land) c.fast = true;
  c.draw = has("draw") ? (c.perm && has("repeat") ? 1 : 2) : 0; c.drawEngine = c.perm && has("draw") && has("repeat");
  c.removal = has("removal") && !has("counter") && !(m.sb || []).includes("counter");
  c.counter = has("counter") || (m.sb || []).includes("counter");
  c.wipe = has("wipe"); c.protect = has("protect") || has("protection");
  c.tutor = has("tutor"); c.free = FREE_INTERACTION.has(name);
  c.drain = has("deathDrain") ? 1 : 0; c.drainTurn = has("wcDrain") && c.perm && has("repeat") ? 1 : 0;
  c.outlet = has("sacOutlet"); c.fodder = has("sacFodder");
  c.tokens = has("token") && c.perm && has("repeat") ? 1 : 0;
  c.alt = has("wcAlt");
  c.poison = creature && has("wcPoison");   // infect o toxic: pega veneno en vez de daño
  return c;
}

export interface SimDeck { id: string; name: string; lib: SimCard[]; cmds: SimCard[]; combos: string[][] }
export type SimInput = DeckLike & Pick<Deck, "id" | "name">;

export function simDeck(d: SimInput, db: CardDb): SimDeck {
  const A = analyze(d, db);
  const lib: SimCard[] = []; for (const r of A.rows) for (let i = 0; i < r.q; i++) lib.push(simCard(r));
  const cmds = A.cmdMeta.map((m, i) => simCard({ n: (d.commanders || [])[i], q: 1, m }, true));
  const combos = ((d.combos && d.combos.inc) || []).map(c => c.cards.map(n => n.toLowerCase())).filter(c => c.length && c.length <= 4).slice(0, 30);
  return { id: d.id, name: d.name, lib, cmds, combos };
}

interface Player {
  D: SimDeck; seat: number; life: number; poison: number; cmdDmg: Record<string, number>;
  lib: SimCard[]; hand: SimCard[]; board: SimCard[]; lands: number; landNames: string[];
  cmdZone: SimCard[]; alive: boolean; gy: number; how: string | null; spare: number;
}
export interface GameOut { winner: number; turn: number; how: string | null }

/** Una partida: jugadores en orden de asiento; devuelve ganador, turno y cómo ganó. */
export function simGame(decks: SimDeck[], rnd: () => number, { life = 40, maxTurns = 20 } = {}): GameOut {
  const shuffle = (lib: SimCard[]) => { for (let i = lib.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lib[i], lib[j]] = [lib[j], lib[i]]; } };
  const players: Player[] = decks.map((D, seat) => {
    const lib = D.lib.map(c => ({ ...c })); shuffle(lib);
    let hand = lib.splice(0, 7);
    // mulligan simple: con menos de 2 o más de 5 tierras se baraja una vez, se roban 7 y se deja una abajo
    const lands = hand.filter(c => c.land).length;
    if (lands < 2 || lands > 5) { lib.push(...hand); shuffle(lib); hand = lib.splice(0, 7); const worst = hand.findIndex(c => c.cmc >= 5); lib.push(hand.splice(worst >= 0 ? worst : 0, 1)[0]); }
    return { D, seat, life, poison: 0, cmdDmg: {}, lib, hand, board: [], lands: 0, landNames: [], cmdZone: D.cmds.map(c => ({ ...c, tax: 0 })), alive: true, gy: 0, how: null, spare: 0 };
  });
  const alive = () => players.filter(p => p.alive);
  const lower = (c: SimCard) => c.n.toLowerCase();
  const boardPow = (p: Player) => { const anth = p.board.reduce((a, c) => a + (c.anthem || 0), 0); const cr = p.board.filter(c => c.creature); return cr.reduce((a, c) => a + c.pow, 0) + (anth ? anth * cr.length : 0) + p.board.reduce((a, c) => a + (c.tokensMade || 0), 0); };
  const threat = (p: Player) => boardPow(p) + p.board.filter(c => c.drain || c.drainTurn || c.drawEngine).length * 2;
  const weight = (c: SimCard) => c.pow + (c.drain ? 4 : 0) + (c.drawEngine ? 3 : 0);
  const toZone = (p: Player, c: SimCard) => { p.cmdZone.push(c); c.tax = (c.tax || 0) + 2; };
  const inCombo = (p: Player, c: SimCard) => p.D.combos.some(cb => cb.includes(lower(c)));
  // los rivales responden: el que tenga respuesta y maná la usa contra quien va ganando
  const respond = (target: Player, kind: "counter" | "wipe" | "removal"): boolean => {
    for (const q of alive()) {
      if (q === target) continue;
      const idx = q.hand.findIndex(c => !c.perm && (kind === "counter" ? !!c.counter && (c.free || c.cmc <= q.spare) : kind === "wipe" ? !!c.wipe && c.cmc <= q.spare : !!c.removal && (c.free || c.cmc <= q.spare)));
      if (idx < 0) continue;
      const card = q.hand.splice(idx, 1)[0]; if (!card.free) q.spare -= card.cmc; q.gy++;
      // la protección del objetivo lo salva una vez
      const pi = target.hand.findIndex(c => !!c.protect && !c.perm && (c.free || c.cmc <= target.spare));
      if (pi >= 0 && kind !== "counter") { const pc = target.hand.splice(pi, 1)[0]; if (!pc.free) target.spare -= pc.cmc; target.gy++; return false; }
      return true;
    }
    return false;
  };
  const wipeAll = () => {
    for (const q of players) {
      q.board = q.board.filter(x => { if (!x.creature) return true; if (x.cmd) toZone(q, x); return false; });
      for (const x of q.board) x.tokensMade = 0;
    }
  };
  const removeBest = (lead: Player) => {
    const big = lead.board.filter(c => c.creature || c.drawEngine || c.drain).sort((a, b) => weight(b) - weight(a))[0];
    if (big) { lead.board.splice(lead.board.indexOf(big), 1); if (big.cmd) toZone(lead, big); }
  };
  const removeTop = (p: Player) => { const foes = alive().filter(q => q !== p); if (!foes.length) return; removeBest(foes.reduce((a, q) => threat(q) > threat(a) ? q : a, foes[0])); };
  // combo listo: todas las piezas en mesa (o tierras jugadas) salvo las que están en la mano y se pueden pagar ahora
  const comboReady = (p: Player) => p.D.combos.some(cb => {
    let cost = 0;
    for (const n of cb) {
      if (p.board.some(c => lower(c) === n) || p.landNames.includes(n) || (p.cmdZone.length === 0 && p.board.some(c => c.cmd && lower(c) === n))) continue;
      const h = p.hand.find(c => lower(c) === n && !c.land); if (!h) return false; cost += h.free ? 0 : h.cmc;
    }
    return cost <= p.spare;
  });
  // tutor: la pieza que falta del combo más avanzado (que esté en la biblioteca); si no, el mejor motor o amenaza
  const tutorPick = (p: Player): number => {
    const have = (n: string) => p.hand.some(x => lower(x) === n) || p.board.some(x => lower(x) === n) || p.landNames.includes(n) || p.cmdZone.some(x => lower(x) === n);
    let best = -1, bestHave = -1;
    for (const cb of p.D.combos) { const miss = cb.filter(n => !have(n)); if (!miss.length) continue; const i = p.lib.findIndex(x => lower(x) === miss[0]); if (i < 0) continue; const h = cb.length - miss.length; if (h > bestHave) { bestHave = h; best = i; } }
    if (best >= 0) return best;
    let bi = -1, bs = 0; p.lib.forEach((x, i) => { const s = (x.drawEngine ? 6 : 0) + (x.drain ? 4 : 0) + x.pow + (x.mana ? 2 : 0); if (s > bs) { bs = s; bi = i; } }); return bi;
  };
  const kill = (p: Player, q: Player, how: string) => { if (q.alive && q.life <= 0) { q.alive = false; p.how = how; } };
  const castFromHand = (p: Player, mana: number, turn: number) => {
    // prioridad: ramp temprano, luego motores, amenazas y piezas de combo; se guarda maná para una respuesta si se tiene
    const keep = p.hand.some(c => (c.counter || c.removal) && c.inst && !c.free) ? Math.min(3, Math.max(0, mana - 2)) : 0;
    let budget = mana - keep;
    const score = (c: SimCard) => (c.mana ? (turn <= 4 ? 10 : 3) : 0) + (c.drawEngine ? 6 : 0) + (c.tutor ? 5 : 0) + c.pow * 1.2 + (c.drain ? 4 : 0) + (c.drainTurn ? 4 : 0) + (c.outlet ? 2 : 0) + (c.anthem ? 3 : 0) + (c.tokens ? 3 : 0) + (inCombo(p, c) ? 8 : 0) + (c.landRamp ? (turn <= 5 ? 9 : 2) : 0) + (c.perm && c.removal ? 4 : 0) - (!c.perm && (c.removal || c.counter || c.wipe || c.protect) ? 20 : 0);
    // rituales: solo si habilitan un hechizo que sin ellos no se paga; su maná no queda guardado para responder
    let ritualMana = 0;
    {
      const rituals = p.hand.filter(c => c.ritual); const extra = rituals.reduce((a, r) => a + Math.max(0, r.ritual! - r.cmc), 0);
      const wants = (extra > 0 && p.hand.some(c => !c.land && !c.ritual && c.cmc > budget && c.cmc <= budget + extra)) || p.cmdZone.some(cm => cm.cmc + (cm.tax || 0) > budget && cm.cmc + (cm.tax || 0) <= budget + extra);
      if (wants) for (const r of rituals) { if (budget >= r.cmc && r.ritual! > r.cmc) { budget += r.ritual! - r.cmc; ritualMana += r.ritual!; p.hand.splice(p.hand.indexOf(r), 1); p.gy++; } }
    }
    const budget0 = budget;
    // comandante
    for (const cm of p.cmdZone.slice()) { const cost = cm.cmc + (cm.tax || 0); if (cost <= budget && turn >= 2) { budget -= cost; p.cmdZone.splice(p.cmdZone.indexOf(cm), 1); cm.sick = true; p.board.push(cm); } }
    const opts = p.hand.filter(c => !c.land && c.cmc <= budget).sort((a, b) => score(b) - score(a));
    for (const c of opts) {
      if (c.cmc > budget || score(c) < 0) continue;
      budget -= c.cmc; p.hand.splice(p.hand.indexOf(c), 1);
      // hechizos grandes o piezas de combo pueden ser contrarrestados
      if ((c.cmc >= 5 || inCombo(p, c)) && respond(p, "counter")) { p.gy++; continue; }
      if (c.perm) { c.sick = true; p.board.push(c); if (c.removal) removeTop(p); }
      else p.gy++;
      if (c.landRamp) p.lands += c.landRamp;
      if (c.landHand) p.hand.push({ n: "Basic Land", cmd: false, land: true, cmc: 0, inst: false, creature: false, perm: true, pow: 0 });
      if (c.draw && !c.drawEngine) p.hand.push(...p.lib.splice(0, c.draw));
      if (c.tutor) { const i = tutorPick(p); if (i >= 0) p.hand.push(p.lib.splice(i, 1)[0]); }
      if (c.wipe && !c.perm) wipeAll();
    }
    // el maná de rituales se gasta primero: lo que sobre de él se pierde
    const spent = budget0 - budget; p.spare = Math.max(0, budget - Math.max(0, ritualMana - spent));
  };
  for (let turn = 1; turn <= maxTurns; turn++) {
    for (const p of players) {
      if (!p.alive) continue;
      if (alive().length === 1) break;
      // robar y bajar tierra
      if (!(turn === 1 && p.seat === 0 && players.length === 2)) p.hand.push(...p.lib.splice(0, 1));
      const engines = p.board.filter(c => c.drawEngine).length; if (engines) p.hand.push(...p.lib.splice(0, Math.min(2, engines)));
      const li = p.hand.findIndex(c => c.land); if (li >= 0) { const L = p.hand.splice(li, 1)[0]; p.lands++; p.landNames.push(lower(L)); }
      for (const c of p.board) c.sick = false;
      const mana = p.lands + p.board.reduce((a, c) => a + (c.mana || 0), 0);
      castFromHand(p, mana, turn);
      // barrido si voy muy atrás en mesa
      const mine = boardPow(p), top = Math.max(0, ...alive().filter(q => q !== p).map(boardPow));
      const wi = p.hand.findIndex(c => !!c.wipe && c.cmc <= p.spare);
      if (wi >= 0 && top >= mine + 8) { const w = p.hand.splice(wi, 1)[0]; p.spare -= w.cmc; wipeAll(); }
      // combo armado: gana si nadie lo contrarresta
      if (p.D.combos.length && comboReady(p)) { if (!respond(p, "counter")) { for (const q of alive()) if (q !== p) { q.life = 0; q.alive = false; } p.how = "combo"; return { winner: p.seat, turn, how: "combo" }; } }
      // bucle de sacrificio: salida + drenajes + cuerpos en mesa
      const drains = p.board.filter(c => c.drain).length, outlet = p.board.some(c => c.outlet), bodies = p.board.filter(c => c.creature).length + p.board.reduce((a, c) => a + (c.tokensMade || 0), 0);
      if (outlet && drains) {
        const dmg = Math.min(60, drains * Math.max(0, bodies - 1));
        if (dmg >= 6) { for (const q of alive()) if (q !== p) { q.life -= dmg; kill(p, q, "drain"); } p.board = p.board.filter(c => !c.creature || c.cmd || c.outlet || c.drain); for (const c of p.board) c.tokensMade = 0; p.how = "drain"; }
      }
      // drenaje por turno y fichas
      for (const c of p.board) { if (c.drainTurn) for (const q of alive()) if (q !== p) { q.life -= c.drainTurn; kill(p, q, "drain"); } if (c.tokens) c.tokensMade = (c.tokensMade || 0) + c.tokens; }
      // a quién atacar: al que está más cerca de morir o al más peligroso (empates al azar)
      const opps = alive().filter(q => q !== p && q.life > 0).map(q => ({ q, k: q.life - threat(q) * 0.8 + rnd() * 6 })).sort((a, b) => a.k - b.k).map(x => x.q);
      if (opps.length) {
        const tgt = opps[0]; const anth = p.board.reduce((a, c) => a + (c.anthem || 0), 0);
        const atk = p.board.filter(c => c.creature && !c.sick);
        let dmg = 0, psn = 0; const blockers = tgt.board.filter(c => c.creature).length;
        // los más grandes atacan primero hacia donde no hay bloqueador; el comandante suma su daño aparte (21 mata)
        atk.sort((a, b) => (b.evasive ? 1 : 0) - (a.evasive ? 1 : 0) || b.pow - a.pow).forEach((c, i) => {
          const pw = c.pow + anth; const hit = c.evasive || i >= blockers ? pw : pw * 0.35;
          if (c.poison) psn += hit; else dmg += hit;
          if (c.cmd && hit >= 1 && !c.poison) {
            const k = p.seat + ":" + c.n;   // cada comandante por separado: los compañeros no se suman
            tgt.cmdDmg[k] = (tgt.cmdDmg[k] || 0) + Math.round(hit);
            if (tgt.cmdDmg[k] >= 21 && tgt.alive) { tgt.life = Math.min(tgt.life, 0); tgt.alive = false; p.how = "cmdr"; }
          }
        });
        if (psn > 0) { tgt.poison += Math.round(psn); if (tgt.poison >= 10 && tgt.alive) { tgt.alive = false; tgt.life = Math.min(tgt.life, 0); p.how = "poison"; } }
        dmg += p.board.reduce((a, c) => a + (c.tokensMade || 0), 0) * (blockers > atk.length ? 0.3 : 1);
        if (dmg > 0) { tgt.life -= Math.round(dmg); kill(p, tgt, "combat"); }
        // quien va ganando recibe removal de los demás
        const lead = alive().reduce((a, q) => threat(q) > threat(a) ? q : a, alive()[0]);
        if (lead && threat(lead) >= 8 && respond(lead, "removal")) removeBest(lead);
      }
      for (const q of players) if (q.alive && q.life <= 0) q.alive = false;
      if (alive().length === 1) return { winner: alive()[0].seat, turn, how: alive()[0].how || "combat" };
      if (!alive().length) return { winner: -1, turn, how: null };
    }
  }
  return { winner: -1, turn: maxTurns, how: null };
}

export interface SimDeckResult { id: string; name: string; pct: number; ci: [number, number]; w: number; avgTurn: number | null; how: Record<string, number>; seat: (number | null)[] }
export interface SimResult { at: number; n: number; seed: number; draws: number; players: number; decks: SimDeckResult[] }

/** Muchas partidas rotando asientos; devuelve estadísticas por mazo. Con la misma semilla, el resultado se repite. */
export async function simRun(decks: SimInput[], db: CardDb, n: number, opts: { seed?: number; onStep?: (done: number) => void; pause?: boolean } = {}): Promise<SimResult> {
  const seed0 = opts.seed != null ? opts.seed : newSeed(); const rnd = seeded(seed0);
  const D = decks.map(d => simDeck(d, db));
  const small = D.filter(x => x.lib.length < 60);
  if (small.length) throw new UserError(`${small.map(x => x.name).join(", ")} tiene${small.length > 1 ? "n" : ""} muy pocas cartas para simular (mínimo 60).`);
  const res = D.map(x => ({ id: x.id, name: x.name, w: 0, turns: [] as number[], how: {} as Record<string, number>, seat: [0, 0, 0, 0], seatN: [0, 0, 0, 0] }));
  let draws = 0;
  for (let g = 0; g < n; g++) {
    const order = D.map((_, i) => i); const rot = g % D.length; const seats = order.slice(rot).concat(order.slice(0, rot));
    const out = simGame(seats.map(i => D[i]), rnd, { life: 40 });
    seats.forEach((di, s) => { res[di].seatN[s]++; });
    if (out.winner < 0) draws++;
    else { const R = res[seats[out.winner]]; R.w++; R.turns.push(out.turn); if (out.how) R.how[out.how] = (R.how[out.how] || 0) + 1; R.seat[out.winner]++; }
    if (g % 50 === 49) { if (opts.onStep) opts.onStep(g + 1); if (opts.pause !== false) await new Promise(r => setTimeout(r, 0)); }
  }
  return { at: Date.now(), n, seed: seed0, draws, players: D.length, decks: res.map(r => ({ id: r.id, name: r.name, pct: r.w / n, ci: wilson(r.w, n), w: r.w, avgTurn: r.turns.length ? r.turns.reduce((a, x) => a + x, 0) / r.turns.length : null, how: r.how, seat: r.seat.map((w, i) => r.seatN[i] ? w / r.seatN[i] : null) })) };
}

/** Error con un mensaje pensado para mostrarse tal cual a la persona. */
export class UserError extends Error {}
