import { useState } from 'react'
import { api } from '../api'
import { Empty, formatBytes, formatDuration } from '../components'
import type { ModelRecord } from '../types'

interface Props { models: ModelRecord[]; refresh: () => Promise<void>; openTraining: (id: string) => void; openPlayground: (id: string) => void; notify: (m: string, e?: boolean) => void }

export default function ModelsTab({ models, refresh, openTraining, openPlayground, notify }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const compared = models.filter(model => selected.includes(model.id))
  const mixedRewardVersions = new Set(compared.map(model => model.reward_version || '1.0')).size > 1
  function toggle(id: string) { setSelected(values => values.includes(id) ? values.filter(value => value !== id) : values.length < 4 ? [...values, id] : values) }
  async function rename(model: ModelRecord) {
    const name = window.prompt('Neuer Modellname', model.name)
    if (!name?.trim()) return
    try { await api.rename(model.id, name); await refresh() } catch (error) { notify((error as Error).message, true) }
  }
  async function remove(model: ModelRecord) {
    if (!window.confirm(`${model.name} einschließlich lokaler Modelldateien löschen?`)) return
    try { await api.remove(model.id); setSelected(v => v.filter(id => id !== model.id)); await refresh(); notify(`${model.id} gelöscht.`) } catch (error) { notify((error as Error).message, true) }
  }
  async function exportOnnx(model: ModelRecord) {
    try { const result = await api.export(model.id); await refresh(); notify(`ONNX validiert: ${formatBytes(result.size_bytes as number)}`) } catch (error) { notify((error as Error).message, true) }
  }
  if (!models.length) return <section className="panel"><div className="section-head"><div><span className="eyebrow">Model registry</span><h2>Gespeicherte Modelle</h2></div></div><Empty>Nach dem ersten abgeschlossenen Trainingslauf erscheint hier model-v001.</Empty></section>
  return <div className="models-layout">
    <section className="panel registry-panel">
      <div className="section-head"><div><span className="eyebrow">Model registry</span><h2>{models.length} gespeicherte Modelle</h2></div><small>bis zu 4 vergleichen</small></div>
      <div className="model-table-wrap"><table className="model-table"><thead><tr><th></th><th>Modell</th><th>Evaluation</th><th>Fresh holdout</th><th>Größe</th><th>Training</th><th></th></tr></thead><tbody>
        {[...models].reverse().map(model => <tr key={model.id}>
          <td><input type="checkbox" checked={selected.includes(model.id)} onChange={() => toggle(model.id)} /></td>
          <td><strong>{model.name}</strong><small>{model.id} · Reward v{model.reward_version || '1.0'} · {new Date(model.created_at).toLocaleString('de-DE')}<br />Parent: {model.parent_model || '—'}{model.selected_best_checkpoint ? ' · Best checkpoint' : ''}</small></td>
          <td className="score">{model.evaluation_score.toFixed(2)}</td><td>{model.fresh_test_score.toFixed(2)}</td>
          <td><span className={model.exceeds_8mb ? 'warning' : ''}>{formatBytes(model.size_bytes)}</span><small>{model.parameters.toLocaleString('de-DE')} Parameter</small></td>
          <td>{model.training_steps.toLocaleString('de-DE')} Steps<small>{formatDuration(model.training_duration_seconds)} · Seed {model.seed}</small></td>
          <td><details className="actions-menu"><summary>•••</summary><div>
            <button onClick={() => openPlayground(model.id)}>Im Playground öffnen</button><button onClick={() => openTraining(model.id)}>Weitertrainieren</button>
            <button onClick={() => exportOnnx(model)}>ONNX exportieren</button><a href={`/api/models/${model.id}/download/pytorch`}>PyTorch laden</a>{model.onnx && <a href={`/api/models/${model.id}/download/onnx`}>ONNX laden</a>}
            <button onClick={() => rename(model)}>Umbenennen</button><button className="danger-text" onClick={() => remove(model)}>Löschen</button>
          </div></details></td>
        </tr>)}
      </tbody></table></div>
    </section>
    {compared.length > 0 && <section className="panel compare-panel"><div className="section-head"><div><span className="eyebrow">Side-by-side</span><h2>Modellvergleich</h2></div></div>
      {mixedRewardVersions && <p className="status-message">Achtung: Reward-v1- und Reward-v2-Scores messen unterschiedliche Ziele und sind numerisch nicht direkt vergleichbar.</p>}
      <div className="compare-cards">{compared.map(model => <div className="compare-card" key={model.id}><strong>{model.name}</strong><dl>
        <div><dt>Evaluation</dt><dd>{model.evaluation_score.toFixed(2)}</dd></div><div><dt>Reward</dt><dd>v{model.reward_version || '1.0'}</dd></div><div><dt>Fresh</dt><dd>{model.fresh_test_score.toFixed(2)}</dd></div><div><dt>Größe</dt><dd>{formatBytes(model.size_bytes)}</dd></div><div><dt>Steps</dt><dd>{model.training_steps.toLocaleString('de-DE')}</dd></div>
      </dl></div>)}</div>
      <div className="bucket-table"><table><thead><tr><th>Modell</th><th>1–2 Prüfungen</th><th>3–4</th><th>5–6</th><th>7–8</th></tr></thead><tbody>{compared.map(model => <tr key={model.id}><td>{model.name}</td>{['1-2','3-4','5-6','7-8'].map(bucket => <td key={bucket}>{model.evaluation.by_exam_count[bucket]?.toFixed(2) ?? '—'}</td>)}</tr>)}</tbody></table></div>
    </section>}
  </div>
}
