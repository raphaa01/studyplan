import { useMemo, useState } from 'react'
import { api } from '../api'
import { LineChart, Metric, formatBytes } from '../components'
import type { ModelRecord, TrainingStatus } from '../types'

const presets: Record<string, { steps: number; label: string }> = {
  quick: { steps: 5_000, label: 'Quick Test' }, short: { steps: 25_000, label: 'Short' },
  medium: { steps: 100_000, label: 'Medium' }, long: { steps: 500_000, label: 'Long' },
  very_long: { steps: 2_000_000, label: 'Very Long' }, custom: { steps: 10_000, label: 'Custom' },
}

interface Props {
  status: TrainingStatus
  models: ModelRecord[]
  parentModel: string
  setParentModel: (id: string) => void
  onRefresh: () => Promise<void>
  notify: (message: string, error?: boolean) => void
}

export default function TrainingTab({ status, models, parentModel, setParentModel, onRefresh, notify }: Props) {
  const [preset, setPreset] = useState('quick')
  const [steps, setSteps] = useState(5_000)
  const [maxEpisodes, setMaxEpisodes] = useState(0)
  const [parallelEnvs, setParallelEnvs] = useState(Math.min(navigator.hardwareConcurrency || 4, 8))
  const [batchSize, setBatchSize] = useState(128)
  const [learningRate, setLearningRate] = useState(0.0003)
  const [seed, setSeed] = useState(42)
  const [curriculum, setCurriculum] = useState(true)
  const [advanced, setAdvanced] = useState(false)
  const [rolloutSteps, setRolloutSteps] = useState(128)
  const [epochs, setEpochs] = useState(4)
  const [gamma, setGamma] = useState(0.99)
  const [entropy, setEntropy] = useState(0.02)
  const [validationSize, setValidationSize] = useState(64)
  const [adaptiveLearningRate, setAdaptiveLearningRate] = useState(true)
  const [minLearningRate, setMinLearningRate] = useState(0.00001)
  const [busy, setBusy] = useState(false)
  const active = ['running', 'paused', 'stopping'].includes(status.state)
  const progress = status.total_steps ? Math.min(status.steps / status.total_steps * 100, 100) : 0

  const latestModel = models.at(-1)
  const comparison = useMemo(() => {
    if (!latestModel) return []
    return [
      { name: 'AI', value: latestModel.evaluation_score },
      ...Object.entries(latestModel.baselines || {}).map(([name, item]) => ({ name, value: item.mean_reward })),
    ]
  }, [latestModel])
  const maxComparison = Math.max(...comparison.map(item => item.value), 1)

  function choosePreset(key: string) {
    setPreset(key)
    setSteps(presets[key].steps)
  }

  async function start() {
    setBusy(true)
    try {
      await api.start({
        preset, total_steps: steps, max_episodes: maxEpisodes > 0 ? maxEpisodes : null, rollout_steps: rolloutSteps, parallel_envs: parallelEnvs,
        batch_size: batchSize, learning_rate: learningRate, gamma, gae_lambda: 0.95,
        clip_range: 0.2, entropy_coef: entropy, value_coef: 0.5, epochs,
        max_grad_norm: 0.5, seed, curriculum, parent_model: parentModel || null,
        validation_size: validationSize, adaptive_learning_rate: adaptiveLearningRate,
        min_learning_rate: minLearningRate,
        checkpoint_interval: Math.max(1000, Math.min(10_000, Math.floor(steps / 5))),
      })
      notify(parentModel ? `Weitertraining auf Basis von ${parentModel} gestartet.` : 'Neues PPO-Training gestartet.')
      await onRefresh()
    } catch (error) { notify((error as Error).message, true) } finally { setBusy(false) }
  }

  async function command(name: 'pause' | 'resume' | 'stop') {
    try { await api.command(name); await onRefresh() } catch (error) { notify((error as Error).message, true) }
  }

  return <div className="tab-grid training-grid">
    <section className="panel config-panel">
      <div className="section-head"><div><span className="eyebrow">Experiment setup</span><h2>Training konfigurieren</h2></div><span className={`state state-${status.state}`}>{status.state}</span></div>
      <label>Modellbasis<select value={parentModel} onChange={e => setParentModel(e.target.value)} disabled={active}>
        <option value="">Neues Modell</option>{models.map(model => <option value={model.id} key={model.id}>Weitertrainieren: {model.name}</option>)}
      </select></label>
      <div className="field-label">Trainingsgröße</div>
      <div className="preset-grid">{Object.entries(presets).map(([key, value]) => <button key={key} className={preset === key ? 'selected' : ''} onClick={() => choosePreset(key)} disabled={active}>{value.label}<small>{value.steps.toLocaleString('de-DE')} steps</small></button>)}</div>
      <div className="form-grid">
        <label>Environment Steps<input type="number" value={steps} min="128" onChange={e => { setSteps(+e.target.value); setPreset('custom') }} disabled={active} /></label>
        <label>Max. Episoden (0 = auto)<input type="number" value={maxEpisodes} min="0" onChange={e => setMaxEpisodes(+e.target.value)} disabled={active} /></label>
        <label>Parallele Environments<input type="number" value={parallelEnvs} min="1" max="64" onChange={e => setParallelEnvs(+e.target.value)} disabled={active} /></label>
        <label>Batch Size<input type="number" value={batchSize} min="16" onChange={e => setBatchSize(+e.target.value)} disabled={active} /></label>
        <label>Learning Rate<input type="number" value={learningRate} step="0.0001" onChange={e => setLearningRate(+e.target.value)} disabled={active} /></label>
        <label>Seed<input type="number" value={seed} onChange={e => setSeed(+e.target.value)} disabled={active} /></label>
        <label className="toggle-label"><span>Curriculum</span><button className={`toggle ${curriculum ? 'on' : ''}`} onClick={() => setCurriculum(!curriculum)} disabled={active}><i /></button></label>
      </div>
      <button className="advanced-toggle" onClick={() => setAdvanced(!advanced)}>{advanced ? '−' : '+'} Advanced PPO parameters</button>
      {advanced && <div className="form-grid advanced-fields">
        <label>Rollout Steps<input type="number" value={rolloutSteps} onChange={e => setRolloutSteps(+e.target.value)} disabled={active} /></label>
        <label>Update Epochs<input type="number" value={epochs} onChange={e => setEpochs(+e.target.value)} disabled={active} /></label>
        <label>Gamma<input type="number" value={gamma} step="0.001" onChange={e => setGamma(+e.target.value)} disabled={active} /></label>
        <label>Entropy Coef<input type="number" value={entropy} step="0.005" onChange={e => setEntropy(+e.target.value)} disabled={active} /></label>
        <label>Validation Cases<input type="number" value={validationSize} min="16" max="256" onChange={e => setValidationSize(+e.target.value)} disabled={active} /></label>
        <label>Minimum Learning Rate<input type="number" value={minLearningRate} step="0.00001" onChange={e => setMinLearningRate(+e.target.value)} disabled={active} /></label>
        <label className="toggle-label"><span>Adaptive Learning Rate</span><button className={`toggle ${adaptiveLearningRate ? 'on' : ''}`} onClick={() => setAdaptiveLearningRate(!adaptiveLearningRate)} disabled={active}><i /></button></label>
      </div>}
      {parentModel && models.find(model => model.id === parentModel)?.reward_version !== '2.0' && <p className="status-message">Reward-Upgrade: Die Modellgewichte werden übernommen, der alte Optimizer-Zustand wird bewusst zurückgesetzt.</p>}
      <div className="train-actions">
        {!active && <button className="primary" onClick={start} disabled={busy}>{busy ? 'Startet…' : 'Start Training'}</button>}
        {status.state === 'running' && <button onClick={() => command('pause')}>Pause</button>}
        {status.state === 'paused' && <button className="primary" onClick={() => command('resume')}>Resume</button>}
        {active && <button className="danger" onClick={() => command('stop')} disabled={status.state === 'stopping'}>Stop safely</button>}
      </div>
      <p className="status-message">{status.message || 'Bereit für einen reproduzierbaren Trainingslauf.'}</p>
    </section>

    <div className="training-main">
      <section className="panel live-panel">
        <div className="section-head"><div><span className="eyebrow">Live telemetry</span><h2>Training in Echtzeit</h2></div><span className="mono">{status.run_id || 'no active run'}</span></div>
        <div className="progress-row"><div className="progress"><i style={{ width: `${progress}%` }} /></div><strong>{progress.toFixed(1)}%</strong></div>
        <div className="metrics-grid">
          <Metric label="Steps" value={`${status.steps.toLocaleString('de-DE')} / ${status.total_steps.toLocaleString('de-DE')}`} />
          <Metric label="Episodes" value={status.episodes.toLocaleString('de-DE')} />
          <Metric label="Moving Reward" value={status.moving_reward.toFixed(2)} accent />
          <Metric label="Evaluation" value={status.evaluation_reward == null ? '—' : status.evaluation_reward.toFixed(2)} />
          <Metric label="Best Validation" value={status.best_evaluation_reward == null ? '—' : status.best_evaluation_reward.toFixed(2)} hint={`Checkpoint bei Step ${(status.best_step ?? 0).toLocaleString('de-DE')}`} />
          <Metric label="Policy Loss" value={status.policy_loss.toFixed(4)} />
          <Metric label="Value Loss" value={status.value_loss.toFixed(4)} />
          <Metric label="Entropy" value={status.entropy.toFixed(4)} />
          <Metric label="Curriculum" value={`Level ${status.curriculum_level}`} />
          <Metric label="Learning Rate" value={status.learning_rate.toExponential(2)} />
        </div>
      </section>

      <section className="panel chart-panel"><div className="section-head"><div><span className="eyebrow">Optimization signal</span><h2>Training Reward</h2></div></div>
        <LineChart series={[
          { label: 'Raw', color: '#667085', values: status.history.map(p => p.reward) },
          { label: 'Moving average', color: '#75e6b5', values: status.history.map(p => p.moving_reward) },
        ]} />
      </section>
      <section className="panel chart-panel"><div className="section-head"><div><span className="eyebrow">Optimization health</span><h2>Loss</h2></div></div>
        <LineChart series={[
          { label: 'Total', color: '#f0b86e', values: status.history.map(p => p.loss) },
          { label: 'Policy', color: '#77a5ff', values: status.history.map(p => p.policy_loss) },
          { label: 'Value', color: '#c39cff', values: status.history.map(p => p.value_loss) },
        ]} />
      </section>
      <section className="panel chart-panel"><div className="section-head"><div><span className="eyebrow">Fixed validation subset · Reward v2.0</span><h2>Evaluation Performance</h2></div></div>
        <LineChart series={[{ label: 'Evaluation reward', color: '#53d4dd', values: status.history.map(p => p.evaluation_reward).filter((value): value is number => value != null) }]} />
      </section>
      <section className="panel resources-panel"><div className="section-head"><div><span className="eyebrow">Local resources</span><h2>Systemauslastung</h2></div></div>
        <div className="metrics-grid resource-metrics">
          <Metric label="CPU" value={`${status.cpu_percent.toFixed(1)}%`} />
          <Metric label="RAM" value={`${status.ram_percent.toFixed(1)}%`} />
          <Metric label="Throughput" value={`${status.steps_per_second.toFixed(0)} steps/s`} />
          <Metric label="Episodes/s" value={status.episodes_per_second.toFixed(2)} />
          <Metric label="Threads" value={status.threads} />
          <Metric label="Model size" value={formatBytes(status.model_size_bytes)} hint="Parameter-/Checkpointgröße" />
        </div>
      </section>
      <section className="panel baseline-panel"><div className="section-head"><div><span className="eyebrow">Held-out benchmark</span><h2>AI vs. Baselines</h2></div><small>{latestModel ? latestModel.id : 'nach erstem Training'}</small></div>
        {comparison.length ? <div className="bar-list">{comparison.map(item => <div className="bar-row" key={item.name}><span>{item.name}</span><div><i style={{ width: `${Math.max(2, item.value / maxComparison * 100)}%` }} /></div><strong>{item.value.toFixed(2)}</strong></div>)}</div> : <div className="chart-empty">Der Vergleich verwendet echte Scores auf dem festen Evaluationssatz.</div>}
      </section>
    </div>
  </div>
}
