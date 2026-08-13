export default function MethodologyTab() {
  return <div className="methodology">
    <section className="panel methodology-hero">
      <span className="eyebrow">Scientific transparency · Reward v2.0</span>
      <h2>Was dieses Labor tatsächlich lernt</h2>
      <p>Ein kleines Actor-Critic-Netz entscheidet nacheinander über echte 30-Minuten-Slots. Reward v2 bewertet geschätzte Lernbereitschaft statt möglichst voller Kalender. Freie Zeit ist neutral; zusätzliche Lernzeit lohnt sich nur, solange sie noch plausiblen Nutzen erzeugt.</p>
      <div className="method-flow"><span>Prüfungen + Slots</span><b>→</b><span>Policy + Value</span><b>→</b><span>Reward v2</span><b>→</b><span>Best checkpoint</span></div>
    </section>
    <div className="method-grid">
      <section className="panel"><span className="method-number">01</span><h3>Bedarf statt Beschäftigung</h3><p>Vorwissen wird angerechnet. Neue Lernzeit steigert die Vorbereitung mit abnehmendem Grenznutzen bis zum geschätzten Bedarf. Zeit darüber erhält keinen künstlichen Vorbereitungsbonus und wird als Überlernen erfasst.</p></section>
      <section className="panel"><span className="method-number">02</span><h3>Spacing mit Zielgröße</h3><p>Verteiltes Lernen wird bis zu einer bedarfsabhängigen Zahl sinnvoller Lerntage belohnt. Die Qualität der Abstände zählt ebenfalls. Dadurch kann die Policy den Bonus nicht mehr durch viele minimale Sitzungen maximieren.</p></section>
      <section className="panel"><span className="method-number">03</span><h3>Fairness und Priorität</h3><p>Wichtigkeit, Schwierigkeit und Dringlichkeit beeinflussen die Gewichtung, sind aber begrenzt. Eine RMS-Defizitkomponente bestraft stark vernachlässigte Prüfungen, damit ein einziges wichtiges Fach nicht den ganzen Kalender verdrängt.</p></section>
      <section className="panel"><span className="method-number">04</span><h3>Opportunity-aware Cramming</h3><p>Last-Minute-Lernen wird nur bestraft, wenn vorher tatsächlich freie Lerngelegenheiten vorhanden waren. Wer erst kurz vor der Prüfung Zeit hat, erhält deshalb keinen unfairen Cramming-Abzug.</p></section>
      <section className="panel"><span className="method-number">05</span><h3>Belastung und Pausen</h3><p>Die ersten 90 Minuten eines Tages zählen voll, danach sinkt der geschätzte Grenznutzen. Lange ununterbrochene Blöcke erzeugen Fatigue. Eine Pause verdient erst nach substanzieller Arbeit und vor anschließender Lernzeit einen kleinen Bonus.</p></section>
      <section className="panel"><span className="method-number">06</span><h3>Kein Reward-Hacking</h3><p>Freie Slots werden weder belohnt noch bestraft. Schnelle Fachwechsel werden negativ erfasst, geplantes Interleaving in längeren Blöcken bleibt möglich. Explizite lokale und globale Überlern-Penalties verhindern das frühere Vollplanen.</p></section>
      <section className="panel"><span className="method-number">07</span><h3>Best-Checkpoint-Sicherung</h3><p>Während des Trainings wird regelmäßig auf einem festen, vom Training getrennten Satz evaluiert. Nur verbesserte Gewichte werden als bester Stand vorgemerkt. Bei Stillstand sinkt die Learning Rate; am Ende wird der beste validierte Stand gespeichert, nicht blind der letzte.</p></section>
      <section className="panel warning-panel"><span className="method-number">!</span><h3>Grenzen</h3><p>Auch Reward v2 ist kein perfektes Menschenmodell. Er misst eine transparente Hypothese über gute Lernpläne, nicht direkt Noten, Motivation, Schlaf oder psychische Belastung. Die Best-Checkpoint-Sicherung verhindert Rückschritte auf dem Validierungssatz, garantiert aber keine Verbesserung für jede reale Person.</p></section>
    </div>
    <section className="panel reward-table">
      <div className="section-head"><div><span className="eyebrow">Auditable objective</span><h2>Reward-v2-Gewichte</h2></div></div>
      <table><thead><tr><th>Komponente</th><th>Rolle</th><th>Gewicht</th></tr></thead><tbody>
        <tr><td>Preparation</td><td>Gesättigte Bereitschaft bis zum geschätzten Bedarf</td><td>+43</td></tr>
        <tr><td>Fairness / Coverage</td><td>Verhindert vernachlässigte oder völlig ignorierte Prüfungen</td><td>+13 / +12</td></tr>
        <tr><td>Spacing / Deadline / Early start</td><td>Verteilung, Dringlichkeit und rechtzeitiger Beginn</td><td>+9 / +8 / +3</td></tr>
        <tr><td>Overlearning / Waste</td><td>Zeit deutlich über Bedarf und ineffektive Mehrzeit</td><td>−22 / −10</td></tr>
        <tr><td>Fatigue / Cramming / Switching</td><td>Überlange Blöcke, vermeidbares Pauken und Mikro-Wechsel</td><td>−8 / −8 / −3</td></tr>
        <tr><td>Break quality</td><td>Kleine Anerkennung einer sinnvoll platzierten Pause</td><td>+2.5</td></tr>
      </tbody></table>
    </section>
    <section className="panel">
      <span className="eyebrow">Evidence base</span><h2>Wissenschaftliche Grundlage</h2>
      <p>Die Gestaltung orientiert sich an robuster Evidenz für verteiltes Üben und Übungstests sowie an Befunden, dass massiertes Überlernen keinen stabilen Langzeitvorteil garantiert. Die konkreten Formeln und Gewichte sind dennoch eine technische Modellierungsentscheidung dieses Labors.</p>
      <p><a href="https://www.evullab.org/pdf/CepedaPashlerVulWixtedRohrer-PB-2006.pdf" target="_blank" rel="noreferrer">Cepeda et al. (2006), Distributed practice meta-analysis</a> · <a href="https://journals.sagepub.com/doi/10.1177/1529100612453266" target="_blank" rel="noreferrer">Dunlosky et al. (2013), Learning techniques review</a> · <a href="https://onlinelibrary.wiley.com/doi/abs/10.1002/acp.1083" target="_blank" rel="noreferrer">Rohrer et al. (2005), Overlearning and retention</a></p>
    </section>
  </div>
}
