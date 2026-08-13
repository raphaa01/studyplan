# Learning Planner Lab

Learning Planner Lab ist eine vollständig lokal laufende Webanwendung, in der ein kleines neuronales Netz lernt, verfügbare Lernzeit auf mehrere Prüfungen zu verteilen. Das Projekt ist kein UI-Mockup: Training, Reward, Losses, Evaluation, Systemtelemetrie, Modelldateien und Exporte stammen aus den real ausgeführten Backendprozessen.

## Funktionsumfang

- eigener PPO-Actor-Critic-Trainingsloop in PyTorch
- sehr kleines permutationsequivariantes Netz (typisch deutlich unter 1 MB)
- dynamischer In-Memory-Generator mit fünf Curriculum-Stufen
- diskrete 30-Minuten-Slots und konsequentes Action Masking
- versioniertes Reward-System v2 mit bedarfsbegrenzter Preparation, Fairness, Spacing, opportunity-aware Cramming, Überlernen, Fatigue und sinnvollen Pausen
- vier echte Baselines: Random, Earliest Deadline First, Weighted Priority und Greedy Marginal Utility
- feste 1.000-Situationen-Evaluation mit Seed `20260314` plus 250 frisch generierte Holdout-Fälle pro Modell
- startbares, pausierbares, fortsetzbares und sauber stoppbares Training mit Best-Checkpoint-Auswahl und adaptiver Learning Rate
- versionierte lokale Model Registry inklusive Parent-Beziehung und reproduzierbarer Metadaten
- PyTorch- und ONNX-Export mit automatischer Lade- und numerischer Paritätsprüfung
- Playground mit eigenen Prüfungen, mehreren Zeitfenstern pro Tag, Kalender-Timeline, Reward-Analyse und Baselinevergleich
- sieben vordefinierte Challenge Cases
- echte CPU-, RAM-, Thread-, Steps/s- und Episodes/s-Messwerte

## Voraussetzungen

- Windows 10 oder 11
- Python 3.11 oder neuer (der `py`-Launcher muss verfügbar sein)
- Node.js 20 oder neuer mit npm
- ausreichend freier Speicher für PyTorch und ONNX Runtime

Nach der einmaligen Paketinstallation benötigt die Anwendung keine Cloud, keine externe Datenbank und keine KI-API. Sämtliche Inference- und Trainingsarbeit läuft auf dem lokalen CPU-Prozess.

## Installation und Start

1. `setup.bat` doppelklicken oder in PowerShell ausführen. Das Script erstellt `.venv`, installiert die exakt in `requirements-lock.txt` festgehaltenen Python-Abhängigkeiten, installiert die Frontendpakete und baut die Oberfläche. Für pnpm-Nutzer liegt zusätzlich `pnpm-lock.yaml` bei.
2. `start.bat` ausführen.
3. [http://127.0.0.1:8000](http://127.0.0.1:8000) im Browser öffnen.
4. Mit `Ctrl+C` im Serverfenster sauber beenden.

Für Entwicklung mit Hot Reload kann nach dem Setup `dev.bat` verwendet werden. Das Frontend läuft dann auf `http://127.0.0.1:5173`, FastAPI auf Port 8000.

## Der vollständige Arbeitsfluss

Im Tab **Training** wird ein neues Modell gewählt oder ein vorhandenes Parent-Modell weitertrainiert. Die Presets reichen von 5.000 bis 2.000.000 Environment Steps; Custom erlaubt eine eigene Länge. PPO-Parameter, Seed, Parallelität und Curriculum sind direkt einstellbar. Die Oberfläche pollt ausschließlich reale Statusdaten aus dem Trainingsprozess.

Nach einem vollständigen Lauf:

1. wird der beste Stand auf einem getrennten, festen Validierungssatz ausgewählt und als finales PyTorch-Modell gespeichert,
2. läuft die Policy deterministisch über den unveränderten 1.000er-Benchmark,
3. läuft sie über 250 neue Testfälle,
4. werden die Baselines auf demselben festen Benchmark verglichen,
5. entsteht automatisch `model-vNNN`,
6. wird ONNX exportiert, geladen und gegen PyTorch geprüft.

Im Tab **Models** können Versionen verglichen, umbenannt, gelöscht, exportiert, weitertrainiert oder im Playground geöffnet werden. Im Tab **Playground** entstehen echte Pläne aus dem ausgewählten Checkpoint.

## Modellarchitektur

Das Netz verarbeitet maximal acht Prüfungen. Jede Prüfung wird mit demselben zweilagigen MLP (`11 → 64 → 64`) codiert. Mean Pooling über vorhandene Prüfungen liefert einen permutationsinvarianten Situationskontext. Ein globaler Zustandsvektor beschreibt unter anderem Slotposition, Uhrzeit, bisherige Auslastung, Sessionlänge und Curriculum-Stufe.

Der Policy Head bewertet jede Prüfung mit derselben Scoring-Funktion. Daher permutieren die Prüfungslogits mit der Eingabe; ein Fach wird nicht durch seine Listenposition bevorzugt. Ein eigener Idle-Logit erlaubt freie Zeit/Pausen. Der Value Head schätzt den diskontierten Return. Nicht existierende oder bereits geschriebene Prüfungen werden vor der Aktionsauswahl maskiert.

Das Netz hat nur einige zehntausend Parameter. Die UI zeigt die tatsächliche serialisierte Dateigröße und warnt oberhalb von 8 MB.

## Trainingssystem

PPO sammelt Rollouts aus mehreren unabhängigen Environments, berechnet Generalized Advantage Estimates und optimiert geclippte Policy Loss, Value Loss und Entropie. Die fünf Curriculum-Stufen erhöhen über den Trainingsfortschritt Prüfungszahl, Planungshorizont, Konkurrenz und Unregelmäßigkeit. Bei deaktiviertem Curriculum werden direkt Level-5-Situationen erzeugt.

Training Samples werden fortlaufend im Arbeitsspeicher erzeugt. Ein separater fester Validierungssatz steuert Checkpoint-Auswahl und Learning-Rate-Absenkung; der 1.000er-Evaluationssatz und die 250 frischen Holdout-Fälle bleiben davon getrennt. Wird kein späterer Checkpoint besser, wird am Ende der beste frühere Stand wiederhergestellt. Das verhindert eine Verschlechterung auf dem Validierungssatz, ist aber keine Garantie für jede unbekannte Situation.

## Reward-System

Reward v2 bewertet geschätzte Lernbereitschaft statt Kalenderauslastung. Lernzeit wirkt über eine sättigende Kurve bis zum geschätzten Restbedarf; Vorwissen wird angerechnet. Freie Zeit ist neutral. Zusätzliche Zeit über einer kleinen Unsicherheitsmarge verliert Nutzen und wird explizit als Überlernen erfasst.

Die Aggregation verwendet:

- **Preparation**: gewichtete Vorbereitung über alle Prüfungen
- **Deadline**: abnehmende Dringlichkeit proportional zur inversen Wurzel der verbleibenden Tage
- **Spacing**: mehrere Lerntage und moderate Abstände
- **Early Start**: Anteil des vorhandenen Vorlaufs beim ersten Lernslot
- **Coverage und Fairness**: Mindestvorbereitung plus RMS-Defizit, damit Prüfungen nicht folgenlos ignoriert werden
- **Waste und Overlearning**: unwirksame Mehrzeit und deutliche Überschreitung des Restbedarfs
- **Fatigue**: abnehmender Tagesnutzen und wachsender Penalty nach 90 Minuten ohne Unterbrechung
- **Break Quality**: nur Pausen nach substantieller Arbeit können positiv sein
- **Switching**: moderates Interleaving bleibt frei, nahezu jeder Slotwechsel wird bestraft
- **Cramming**: Last-Minute-Anteil nur dann, wenn frühere Lerngelegenheiten vorhanden waren

Gewichte und Reward-Version stehen zentral in `backend/learning_lab/config.py` und werden mit jedem neuen Modell gespeichert. Alte v1-Scores werden in der UI gekennzeichnet, weil sie numerisch nicht direkt mit v2 vergleichbar sind. Der Methodology-Tab nennt auch die wissenschaftlichen Quellen. Die Funktion bleibt eine nachvollziehbare Engineering-Hypothese, kein validiertes Modell individueller Lernleistung.

## Evaluation richtig lesen

Die Software unterscheidet bewusst:

- **Training Reward**: Signal aus gerade generierten Episoden
- **Fixed Evaluation Reward**: Vergleich auf denselben 1.000 Fällen
- **Fresh Holdout Reward**: Generalisierungscheck auf 250 neuen Situationen
- **Baselines**: relative Leistung zur implementierten Zielfunktion
- **menschliche Plausibilität**: muss anhand der konkreten Timeline geprüft werden

Ein steigender Reward beweist keine besseren realen Noten. Eine spätere Produktversion sollte reale Nutzerentscheidungen und Lernergebnisse mit informierter Einwilligung evaluieren.

## Lokale Speicherung

```text
data/
  evaluation_set.json       fester Benchmark (beim ersten Start generiert)
  baseline_evaluation.json  wiederverwendbarer Baseline-Cache
  registry.json             Model Registry
models/
  model-v001/
    model.pt
    model.onnx
runs/
  run-.../
    config.json
    training_history.json
    checkpoint.pt
    best.pt
    last.pt
    final.pt | interrupted.pt
    summary.json
```

Die Dateien werden atomar bzw. in klar getrennten Verzeichnissen geschrieben. Eine Datenbank kann später hinter `ModelRegistry` ergänzt werden.

## Reproduzierbarkeit

Jede Registry-Version speichert Seed, Hyperparameter, Trainingssteps, Episoden, Dauer, Parent, Architektur, Parameterzahl, Environment-Konfiguration, Softwareversion, Fixed-/Fresh-Evaluation und Baselines. Python-, NumPy- und PyTorch-RNG werden vor dem Training gesetzt. Vollständige bitweise Reproduzierbarkeit kann sich trotzdem zwischen PyTorch-/CPU-Versionen unterscheiden.

## Tests

Nach dem Setup:

```powershell
$env:PYTHONPATH = "$PWD\backend"
.venv\Scripts\python.exe -m pytest
```

Die Tests prüfen Generatorgrenzen und Slotüberlappungen, Masking, ungültige Aktionen, NaN-freie Rewards, Reward-Hacking-Szenarien, Baselinepläne, Permutationsäquivarianz, Speichern/Laden, Registry-Versionierung, kurzes echtes Weitertraining, reproduzierbare Evaluation und ONNX-Parität.

## API

FastAPI stellt unter `/docs` eine lokale OpenAPI-Oberfläche bereit. Wichtige Endpunkte:

- `POST /api/training/start|pause|resume|stop`
- `GET /api/training/status`
- `GET|PATCH|DELETE /api/models/...`
- `POST /api/models/{id}/export`
- `POST /api/playground/plan`
- `GET /api/challenges`

## Ordnerstruktur

```text
backend/learning_lab/
  generator.py       prozedurale Situationen und fester Benchmark
  environment.py     sequenzielles RL-Environment und Encoding
  reward.py          modularer Lernnutzen
  baselines.py       klassische Vergleichsalgorithmen
  model.py           Actor-Critic und Inference
  trainer.py         PPO
  evaluation.py      Fixed/Fresh-Auswertung
  exporter.py        ONNX plus Paritätscheck
  registry.py        lokale Modellversionen
  manager.py         Hintergrundtraining und Telemetrie
  api.py             FastAPI
frontend/src/
  tabs/               Training, Models, Playground, Methodology
  App.tsx             Navigation und Live-Polling
```

## Bekannte Einschränkungen

- Version 0.1 plant maximal acht Prüfungen und verwendet feste 30-Minuten-Slots.
- CPU-Training ist bewusst lokal; lange Presets können Stunden dauern.
- Der Generator bildet nicht jede Schulform, Lernstörung oder individuelle Präferenz ab.
- Belohnungsgewichte sind transparent und getestet, aber nicht durch eine longitudinale Lernstudie kalibriert.
- ONNX ist für spätere Browser-Inference vorbereitet; die aktuelle Weboberfläche ruft für Inference noch das lokale Python-Backend auf.
- Pausen erscheinen als ungenutzte 30-Minuten-Slots. Feinere 10-/15-Minuten-Pausen erfordern eine spätere hierarchische oder feinere Zeitrepräsentation.
