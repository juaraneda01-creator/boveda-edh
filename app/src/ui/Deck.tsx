// Mesa de trabajo de un mazo: cabecera con su estado y los cuatro pasos (más las versiones).
import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { ensureCards, insight, refreshGC } from "../data/store.ts";
import { allNames, bracketOf, bracketRule, type Deck } from "../engine/index.ts";
import { Pill, Pips } from "./kit.tsx";
import type { Step } from "./App.tsx";
import { StepPlan } from "./StepPlan.tsx";
import { StepBuild } from "./StepBuild.tsx";
import { StepTest } from "./StepTest.tsx";
import { StepTune } from "./StepTune.tsx";
import { StepVersions } from "./StepVersions.tsx";

const STEPS: [Step, string][] = [["plan", "Plan"], ["armar", "Armar"], ["probar", "Probar"], ["ajustar", "Ajustar"]];

export function DeckScreen({ deck, step }: { deck: Deck; step: Step }): JSX.Element {
  // al abrir un mazo se traen las cartas que falten y, una vez por semana, la lista de Game Changers
  useEffect(() => { void ensureCards(allNames(deck), { quiet: true, label: "Trayendo los datos de las cartas" }); void refreshGC(); }, [deck.id]);
  const { A } = insight(deck); const size = 100 - deck.commanders.length;
  const B = A.main ? bracketOf(deck, A) : null; const goal = deck.plan.bracket;
  return (
    <div class="deck">
      <div class="deck-h">
        <div class="deck-top"><a class="back" href="#/">Tus mazos</a><a class={"versions-link" + (step === "versiones" ? " on" : "")} href={`#/mazo/${deck.id}/versiones`} aria-current={step === "versiones" ? "page" : undefined}>Versiones</a></div>
        <h1>{deck.name}</h1>
        <div class="deck-meta">
          <Pips ci={A.ci} /> <span>{deck.commanders.join(" + ") || "Sin comandante"}</span>
          <Pill tone={A.main === size ? "good" : A.main > size ? "bad" : undefined}>{A.main} de {size}</Pill>
          {B ? <Pill tone={goal && B.b > goal ? "warn" : goal && B.b <= goal ? "good" : undefined}>Bracket {B.b}{goal ? `, buscas ${goal}` : ""}{B.exact ? "" : " (sin revisar combos)"}</Pill> : goal ? <Pill>Buscas bracket {goal}: {bracketRule(goal).name}</Pill> : null}
          {deck.kind === "ref" ? <Pill tone="info">De referencia{deck.owner ? `: ${deck.owner}` : ""}</Pill> : null}
        </div>
      </div>
      <nav class="steps" aria-label="Pasos del mazo">
        <ol>{STEPS.map(([k, l], i) => <li key={k}><a href={`#/mazo/${deck.id}/${k}`} aria-current={step === k ? "step" : undefined}><span class="step-n" aria-hidden="true">{i + 1}</span>{l}</a></li>)}</ol>
      </nav>
      {step === "plan" ? <StepPlan d={deck} /> : step === "armar" ? <StepBuild d={deck} /> : step === "probar" ? <StepTest d={deck} /> : step === "ajustar" ? <StepTune d={deck} /> : <StepVersions d={deck} />}
    </div>
  );
}
