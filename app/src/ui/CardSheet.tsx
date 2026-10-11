// Ficha de una carta: imagen, qué hace según el motor y qué se puede hacer con ella en el mazo abierto.
import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { S, addCard, removeCard, moveCard, deckById, ensureCards, insight, edhOf } from "../data/store.ts";
import { ROLE_ES, TAG_ES, slug, analyze, bracketOf, type Deck } from "../engine/index.ts";
import { Pill, Pips, Sheet, pct } from "./kit.tsx";

/** Qué pasa con el bracket si esta carta entra al mazo. */
export function bracketImpact(d: Deck, name: string): string | null {
  const m = S.db.get(name); if (!m) return null;
  const A0 = insight(d).A; const b0 = bracketOf(d, A0).b;
  const A1 = analyze({ ...d, cards: [...d.cards, { n: m.n, q: 1 }] }, S.db); const b1 = bracketOf(d, A1).b;
  const why = m.gc ? "es Game Changer" : m.mld ? "destruye tierras en masa" : m.xt ? "da turnos extra" : "";
  if (b1 > b0) return `Con ${m.n} tu lista pasa de bracket ${b0} a ${b1}${why ? ` (${why})` : ""}.`;
  if (d.plan.bracket && m.gc && d.plan.bracket <= 2) return `${m.n} es Game Changer: el bracket ${d.plan.bracket} no los permite.`;
  if (d.plan.bracket === 3 && m.gc && A1.gc.length > 3) return `${m.n} sería tu Game Changer número ${A1.gc.length}: el bracket 3 permite hasta 3.`;
  return null;
}

export function CardSheet({ name, deckId, onClose }: { name: string; deckId?: string; onClose: () => void }): JSX.Element {
  const m = S.db.get(name); const d = deckId ? deckById(deckId) : undefined;
  useEffect(() => { if (!m) void ensureCards([name], { quiet: true }); }, [name]);
  const copies = d ? (d.cards.find(c => slug(c.n) === slug(name)) || { q: 0 }).q : 0;
  const inMain = copies > 0, inMaybe = !!d && d.maybe.some(c => slug(c.n) === slug(name)), isCmd = !!d && d.commanders.some(c => slug(c) === slug(name));
  const E = d ? edhOf(d) : null; const e = E && E.pool.find(p => slug(p.n) === slug(name));
  const link = d && insight(d).Y.links.get(m ? m.n : name);
  const impact = d && !inMain && !isCmd ? bracketImpact(d, name) : null;
  const off = !!d && !!m && !isCmd && m.ci.split("").some(c => !insight(d).A.ci.includes(c)) && insight(d).A.cmdMeta.every(Boolean);
  return (
    <Sheet title={m ? m.n : name} onClose={onClose}>
      <div class="cardsheet">
        {m && /^https:\/\/cards\.scryfall\.io\//.test(m.img) ? <img class="card-img" src={m.img} alt={`Carta ${m.n}`} width="244" height="340" loading="lazy" /> : <div class="card-img ph" aria-hidden="true"><span>{m ? m.tl : "Sin imagen"}</span></div>}
        <div class="cardsheet-info">
          {!m ? <p class="muted">{S.busy ? "Buscando la carta en Scryfall…" : "Scryfall no tiene datos de esta carta con ese nombre. Revisa que esté en inglés."}</p> : <>
            <p class="card-type"><Pips ci={m.ci} /> {m.tl}{m.t !== "Land" ? `, coste ${m.cmc}` : ""}</p>
            <div class="pills">
              {m.gc ? <Pill tone="accent">Game Changer</Pill> : null}
              {m.xt ? <Pill tone="warn">Turno extra</Pill> : null}
              {m.mld ? <Pill tone="warn">Destruye tierras</Pill> : null}
              {m.legal && m.legal !== "legal" ? <Pill tone="bad">No legal en Commander</Pill> : null}
              {m.r.map(r => <Pill key={r}>{ROLE_ES[r]}</Pill>)}
            </div>
            {m.tg.filter(k => TAG_ES[k]).length ? <p class="muted small">Qué hace: {m.tg.filter(k => TAG_ES[k]).map(k => TAG_ES[k]).join(", ")}.</p> : null}
            {e && e.incl != null ? <p class="small">Con este comandante se juega en {pct(e.incl)} de las listas{e.syn != null && e.syn > 0.05 ? `, con sinergia +${Math.round(e.syn * 100)}` : ""}.</p> : null}
            {inMain && link ? <p class="small">{link.n > 0 ? `Conecta con: ${link.why.join(", ")}.` : "No conecta con ningún tema activo de tu mazo."}</p> : null}
          </>}
          {off ? <p class="small warn-text">Está fuera de la identidad de color de tu comandante.</p> : null}
          {impact ? <p class="small warn-text">{impact}</p> : null}
          {d ? <div class="row">
            {isCmd ? <span class="muted">Es tu comandante.</span>
              : inMain ? <><button class="btn" onClick={() => { void removeCard(d.id, name, "cards", copies <= 1); onClose(); }}>{copies > 1 ? `Quitar una copia (hay ${copies})` : "Quitar del mazo"}</button><button class="btn ghost" onClick={() => { void moveCard(d.id, name, "maybe"); onClose(); }}>Pasar a probables</button></>
              : inMaybe ? <><button class="btn primary" onClick={() => { void moveCard(d.id, name, "cards"); onClose(); }}>Pasar al mazo</button><button class="btn ghost" onClick={() => { void removeCard(d.id, name, "maybe"); onClose(); }}>Quitar de probables</button></>
              : <><button class="btn primary" onClick={() => { void addCard(d.id, name); onClose(); }}>Agregar al mazo</button><button class="btn ghost" onClick={() => { void addCard(d.id, name, "maybe"); onClose(); }}>Dejar en probables</button></>}
          </div> : null}
          {m && /^https:\/\/scryfall\.com\//.test(m.uri) ? <p class="small"><a href={m.uri} target="_blank" rel="noopener noreferrer">Ver el texto completo en Scryfall</a></p> : null}
        </div>
      </div>
    </Sheet>
  );
}
