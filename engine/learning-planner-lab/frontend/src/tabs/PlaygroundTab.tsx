import { useMemo, useState } from 'react'
import { api } from '../api'
import { Empty, formatTime } from '../components'
import type { Challenge, ExamInput, ModelRecord, Plan, PlaygroundResult, TimeWindow } from '../types'

const days = Array.from({ length: 7 }, (_, offset) => {
  const value = new Date()
  value.setDate(value.getDate() + offset)
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(value)
})
const colors = ['#75e6b5', '#77a5ff', '#f0b86e', '#c39cff', '#ff7d8d', '#53d4dd', '#d4df70', '#ef9fc6']

function dateAfter(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
function newExam(index: number): ExamInput { return { id: `exam-${Date.now()}-${index}`, subject: ['Mathematik','Deutsch','Geschichte'][index % 3], kind: index === 0 ? 'exam' : 'test', date: dateAfter(3 + index * 4), difficulty: 7, importance: 8, invested_minutes: 0, estimated_need_minutes: 240 } }

interface Props { models: ModelRecord[]; selectedModel: string; setSelectedModel: (id: string) => void; challenges: Challenge[]; notify: (m: string, e?: boolean) => void }

export default function PlaygroundTab({ models, selectedModel, setSelectedModel, challenges, notify }: Props) {
  const [exams, setExams] = useState<ExamInput[]>([newExam(0), newExam(1)])
  const [windows, setWindows] = useState<TimeWindow[]>([
    { day: 0, start_minute: 15 * 60, end_minute: 17 * 60 }, { day: 1, start_minute: 16 * 60 + 30, end_minute: 18 * 60 },
    { day: 2, start_minute: 15 * 60 + 30, end_minute: 18 * 60 }, { day: 5, start_minute: 10 * 60, end_minute: 13 * 60 },
  ])
  const [result, setResult] = useState<PlaygroundResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [challengeBusy, setChallengeBusy] = useState('')
  const colorByExam = useMemo(() => Object.fromEntries(exams.map((exam, index) => [exam.id, colors[index % colors.length]])), [exams])

  function patchExam(id: string, patch: Partial<ExamInput>) { setExams(values => values.map(exam => exam.id === id ? { ...exam, ...patch } : exam)) }
  function addWindow(day: number) { setWindows(values => [...values, { day, start_minute: day >= 5 ? 10 * 60 : 16 * 60, end_minute: day >= 5 ? 12 * 60 : 18 * 60 }]) }
  function timeToMinutes(value: string) { const [h, m] = value.split(':').map(Number); return h * 60 + m }

  async function generate() {
    setBusy(true)
    try {
      const payload = await api.plan({ exams, windows, model_id: selectedModel || null, compare_baselines: true, seed: 42 })
      setResult(payload); notify(selectedModel ? 'Plan durch das gespeicherte Modell erzeugt.' : 'Baseline-Pläne erzeugt; trainiere oder wähle ein Modell für AI-Inference.')
    } catch (error) { notify((error as Error).message, true) } finally { setBusy(false) }
  }
  async function runChallenge(id: string) {
    if (!selectedModel) return notify('Bitte zuerst ein gespeichertes Modell auswählen.', true)
    setChallengeBusy(id)
    try { const payload = await api.runChallenge(id, selectedModel); setResult({ situation: {}, ai: payload.ai, baselines: payload.baselines }); notify('Challenge mit AI und Baselines ausgewertet.') }
    catch (error) { notify((error as Error).message, true) } finally { setChallengeBusy('') }
  }

  return <div className="playground-layout">
    <div className="playground-inputs">
      <section className="panel"><div className="section-head"><div><span className="eyebrow">Inference target</span><h2>Modell auswählen</h2></div></div>
        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}><option value="">Nur Baselines</option>{models.map(model => <option value={model.id} key={model.id}>{model.name} · Eval {model.evaluation_score.toFixed(1)}</option>)}</select>
      </section>
      <section className="panel"><div className="section-head"><div><span className="eyebrow">Upcoming assessments</span><h2>Prüfungen</h2></div><button onClick={() => exams.length < 8 && setExams(v => [...v, newExam(v.length)])}>+ Hinzufügen</button></div>
        <div className="exam-list">{exams.map((exam, index) => <div className="exam-card" key={exam.id} style={{ '--exam-color': colors[index % colors.length] } as React.CSSProperties}>
          <div className="exam-card-head"><input value={exam.subject} onChange={e => patchExam(exam.id, { subject: e.target.value })} aria-label="Fach" /><button onClick={() => setExams(v => v.filter(item => item.id !== exam.id))}>×</button></div>
          <div className="compact-form"><label>Art<select value={exam.kind} onChange={e => patchExam(exam.id, { kind: e.target.value as 'test'|'exam' })}><option value="test">Test</option><option value="exam">Klausur</option></select></label><label>Datum<input type="date" value={exam.date} onChange={e => patchExam(exam.id, { date: e.target.value })} /></label></div>
          <label>Schwierigkeit <strong>{exam.difficulty}/10</strong><input type="range" min="1" max="10" value={exam.difficulty} onChange={e => patchExam(exam.id, { difficulty: +e.target.value })} /></label>
          <label>Wichtigkeit <strong>{exam.importance}/10</strong><input type="range" min="1" max="10" value={exam.importance} onChange={e => patchExam(exam.id, { importance: +e.target.value })} /></label>
          <label>Geschätzter Bedarf (min)<input type="number" min="30" step="30" value={exam.estimated_need_minutes} onChange={e => patchExam(exam.id, { estimated_need_minutes: +e.target.value })} /></label>
        </div>)}</div>
      </section>
      <section className="panel"><div className="section-head"><div><span className="eyebrow">Weekly availability</span><h2>Lernzeiten</h2></div></div>
        <div className="week-editor">{days.map((day, dayIndex) => <div className="day-editor" key={day}><div><strong>{day}</strong><button onClick={() => addWindow(dayIndex)}>+</button></div>{windows.filter(window => window.day === dayIndex).map((window, index) => <div className="time-window" key={`${dayIndex}-${index}`}><input type="time" step="1800" value={formatTime(window.start_minute)} onChange={e => setWindows(values => values.map(value => value === window ? { ...value, start_minute: timeToMinutes(e.target.value) } : value))} /><span>–</span><input type="time" step="1800" value={formatTime(window.end_minute)} onChange={e => setWindows(values => values.map(value => value === window ? { ...value, end_minute: timeToMinutes(e.target.value) } : value))} /><button onClick={() => setWindows(values => values.filter(value => value !== window))}>×</button></div>)}</div>)}</div>
        <button className="primary generate" onClick={generate} disabled={busy || !exams.length || !windows.length}>{busy ? 'Berechnet…' : 'Generate Learning Plan'}</button>
      </section>
      <section className="panel"><div className="section-head"><div><span className="eyebrow">Diagnostic suite</span><h2>Challenge Cases</h2></div></div><div className="challenge-list">{challenges.map(item => <button key={item.id} onClick={() => runChallenge(item.id)} disabled={!!challengeBusy}><strong>{item.name}</strong><span>{item.description}</span><i>{challengeBusy === item.id ? 'läuft…' : 'Run →'}</i></button>)}</div></section>
    </div>
    <div className="playground-results">
      {!result ? <section className="panel sticky-result"><Empty>Konfiguriere eine Situation. Der erzeugte Kalender und seine echte Reward-Analyse erscheinen hier.</Empty></section> : <PlanOutput result={result} colorByExam={colorByExam} />}
    </div>
  </div>
}

function PlanOutput({ result, colorByExam }: { result: PlaygroundResult; colorByExam: Record<string, string> }) {
  const plan = result.ai || result.baselines?.greedy
  if (!plan) return <section className="panel"><Empty>Kein Plan verfügbar.</Empty></section>
  const grouped = plan.sessions.reduce<Record<string, typeof plan.sessions>>((accumulator, session) => {
    const key = String(session.day)
    ;(accumulator[key] ||= []).push(session)
    return accumulator
  }, {})
  const comparisons: [string, Plan][] = [...(result.ai ? [['AI', result.ai] as [string, Plan]] : []), ...Object.entries(result.baselines || {})]
  const maxReward = Math.max(...comparisons.map(([, value]) => value.reward.total), 1)
  const rewardKeys = ['preparation','deadline','spacing','early_start','coverage','fairness','utilization','overlearning','fatigue','switching','break_quality','cramming']
  return <>
    <section className="panel plan-panel"><div className="section-head"><div><span className="eyebrow">Generated schedule</span><h2>{plan.source}</h2></div><div className="score-badge"><span>Reward</span><strong>{plan.reward.total.toFixed(2)}</strong></div></div>
      <div className="timeline">{Object.entries(grouped).map(([day, sessions]) => <div className="timeline-day" key={day}><div><span>Tag {+day + 1}</span><small>{days[+day % 7]}</small></div><div>{sessions.map((session, index) => <div className={`session ${session.kind}`} key={index} style={{ '--session-color': session.exam_id ? colorByExam[session.exam_id] || colors[index % colors.length] : '#3c4653' } as React.CSSProperties}><time>{formatTime(session.start_minute)}–{formatTime(session.end_minute)}</time><strong>{session.subject}</strong><span>{session.kind === 'break' ? 'Regeneration / frei' : `${session.end_minute - session.start_minute} min`}</span></div>)}</div></div>)}</div>
      <p className="inference-note">Inference: {plan.inference_ms.toFixed(2)} ms · 30-Minuten-Entscheidungen wurden zu Sessions zusammengeführt.</p>
    </section>
    <section className="panel analysis-panel"><div className="section-head"><div><span className="eyebrow">Plan diagnostics · Reward v{String(plan.reward.reward_version || '2.0')}</span><h2>Reward Breakdown</h2></div></div><div className="reward-grid">{rewardKeys.map(key => <div key={key}><span>{key.replace('_',' ')}</span><strong className={Number(plan.reward[key]) < 0 ? 'negative' : ''}>{Number(plan.reward[key]).toFixed(2)}</strong></div>)}</div>
      <h3>Lernzeit pro Prüfung</h3><div className="minute-list">{Object.entries(plan.learning_minutes).map(([id, minutes]) => <span key={id}>{id}<strong>{minutes} min</strong></span>)}</div>
    </section>
    <section className="panel analysis-panel"><div className="section-head"><div><span className="eyebrow">Same input, same reward</span><h2>Compare with Baselines</h2></div></div><div className="bar-list">{comparisons.sort((a,b) => b[1].reward.total - a[1].reward.total).map(([name, value]) => <div className="bar-row" key={name}><span>{name}</span><div><i style={{ width: `${Math.max(2, value.reward.total / maxReward * 100)}%` }} /></div><strong>{value.reward.total.toFixed(2)}</strong></div>)}</div><p className="caution">Ein höherer Reward ist ein Diagnosewert, kein Beweis für pädagogische Überlegenheit. Prüfe den Kalender immer auf menschliche Plausibilität.</p></section>
  </>
}
