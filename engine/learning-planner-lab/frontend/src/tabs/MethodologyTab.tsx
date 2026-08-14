export default function MethodologyTab() {
  return <div className="methodology">
    <section className="panel methodology-hero">
      <span className="eyebrow">Scientific transparency · Schema 3.0 · Reward 3.0</span>
      <h2>Was QECore v1.08 tatsächlich lernt</h2>
      <p>Ein kleines permutationsäquivariantes Actor-Critic-Netz verteilt freie 30-Minuten-Slots auf Prüfungen und flexible Wochenroutinen. Texte, Themen, Kalenderkollisionen, sichtbare Pausen und der sichere Fallback bleiben deterministisch.</p>
      <div className="method-flow"><span>Prüfungen + Routinen</span><b>→</b><span>12 PlanningTargets</span><b>→</b><span>Reward v3</span><b>→</b><span>validierter Checkpoint</span></div>
    </section>
    <div className="method-grid">
      <section className="panel"><span className="method-number">01</span><h3>Prüfungen bleiben dominant</h3><p>Readiness, Deadline, Coverage, Fairness und Cramming tragen deutlich mehr Gewicht als optionale Routinen. Bei knapper Zeit dürfen flexible Routinen ausfallen.</p></section>
      <section className="panel"><span className="method-number">02</span><h3>Wochenroutinen ohne Doppelarbeit</h3><p>Eine Prüfungseinheit desselben stabil normalisierten Fachs erfüllt die Routine genau einmal. Ist die Frequenz erfüllt, sperrt die Action-Mask zusätzliche allgemeine Einheiten. In der nächsten Woche beginnt das Soll neu.</p></section>
      <section className="panel"><span className="method-number">03</span><h3>Semantische Lernmethoden</h3><p>Blocklänge, Spacing, Interleaving, bevorzugte Prüfungsphase und Abrufintensität sind echte Features. „Automatisch“ wird vor der Policy in ein konkretes Profil aufgelöst.</p></section>
      <section className="panel"><span className="method-number">04</span><h3>Begrenztes Feedback</h3><p>Schwierigkeit, Confidence, Abschlussquote, Ausfälle und Ist-/Sollzeit passen den Restbedarf an. Der Multiplikator bleibt immer zwischen 0,75 und 1,30, damit ein einzelner Eintrag den Plan nicht entgleisen lässt.</p></section>
      <section className="panel"><span className="method-number">05</span><h3>Belastung und Pausen</h3><p>Lange Fokusfolgen erzeugen Fatigue. Pausen erhalten nur zwischen sinnvollen Lernblöcken einen kleinen Bonus; Idle bleibt neutral, wenn kein echter Bedarf besteht.</p></section>
      <section className="panel"><span className="method-number">06</span><h3>Planstabilität</h3><p>Begonnene und erledigte Slots werden maskiert und belohnt, wenn sie unverändert bleiben. Kurzfristige Neuplanung darf nur offene Einheiten bewegen.</p></section>
      <section className="panel"><span className="method-number">07</span><h3>Getrennte Evaluation</h3><p>Zehn feste Holdout-Gruppen berichten Readiness, Routinen, Doppelzählung, Methoden-Adherence, Spacing, Fatigue, Cramming, Idle, Fairness und Laufzeit—nicht nur einen Gesamtreward.</p></section>
      <section className="panel warning-panel"><span className="method-number">!</span><h3>Grenzen</h3><p>Reward v3 ist eine überprüfbare Lernplan-Hypothese, kein perfektes Menschenmodell. Training optimiert diesen Reward; eine bessere reale Note oder Verbesserung für jede Person kann nicht garantiert werden.</p></section>
    </div>
    <section className="panel reward-table">
      <div className="section-head"><div><span className="eyebrow">Auditable objective</span><h2>Reward-v3-Schwerpunkte</h2></div></div>
      <table><thead><tr><th>Komponente</th><th>Rolle</th><th>Gewicht</th></tr></thead><tbody>
        <tr><td>Preparation / Deadline</td><td>Prüfungsbereitschaft und Dringlichkeit</td><td>+48 / +12</td></tr>
        <tr><td>Coverage / Fairness / Spacing</td><td>Bedarf abdecken, Ziele nicht vergessen, sinnvoll verteilen</td><td>+12 / +10 / +8</td></tr>
        <tr><td>Routine fulfillment / distribution</td><td>Moderater Nutzen für das flexible Wochenziel</td><td>+8 / +3</td></tr>
        <tr><td>Substitution / method / stability</td><td>Prüfungs-Credit, Methodenpassung und geschützte Einheiten</td><td>+2 / +5 / +5</td></tr>
        <tr><td>Overlearning / duplicate work</td><td>Überfüllung und doppelte allgemeine Facharbeit</td><td>−22 / −14</td></tr>
        <tr><td>Fatigue / Cramming / Invalid</td><td>Überlastung, vermeidbares Pauken und verbotene Aktionen</td><td>−9 / −10 / −100</td></tr>
      </tbody></table>
    </section>
  </div>
}
