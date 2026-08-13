import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import TrainingTab from './tabs/TrainingTab'
import ModelsTab from './tabs/ModelsTab'
import PlaygroundTab from './tabs/PlaygroundTab'
import MethodologyTab from './tabs/MethodologyTab'
import type { Challenge, ModelRecord, TrainingStatus } from './types'

type Tab = 'training' | 'models' | 'playground' | 'methodology'
const initialStatus: TrainingStatus = { state: 'idle', message: '', steps: 0, total_steps: 0, episodes: 0, reward: 0, moving_reward: 0, best_step: 0, loss: 0, policy_loss: 0, value_loss: 0, entropy: 0, learning_rate: 0, steps_per_second: 0, episodes_per_second: 0, cpu_percent: 0, ram_percent: 0, threads: 0, curriculum_level: 1, model_size_bytes: 0, history: [] }

export default function App() {
  const [tab, setTab] = useState<Tab>('training')
  const [status, setStatus] = useState<TrainingStatus>(initialStatus)
  const [models, setModels] = useState<ModelRecord[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [parentModel, setParentModel] = useState('')
  const [playgroundModel, setPlaygroundModel] = useState('')
  const [online, setOnline] = useState(false)
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [nextStatus, nextModels] = await Promise.all([api.status(), api.models()])
      setStatus(nextStatus); setModels(nextModels); setOnline(true)
      if (nextModels.length && !playgroundModel) setPlaygroundModel(nextModels.at(-1)!.id)
    } catch { setOnline(false) }
  }, [playgroundModel])

  useEffect(() => { void refresh(); api.challenges().then(setChallenges).catch(() => undefined) }, [refresh])
  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), status.state === 'running' ? 900 : 2500)
    return () => window.clearInterval(interval)
  }, [refresh, status.state])
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(null), 4500); return () => window.clearTimeout(timeout) }, [toast])
  function notify(message: string, error = false) { setToast({ message, error }) }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><i /><i /><i /></div><div><strong>Learning Planner</strong><span>ML LAB · LOCAL</span></div></div>
      <nav>{(['training','models','playground','methodology'] as Tab[]).map(value => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}{value === 'models' && models.length > 0 && <em>{models.length}</em>}</button>)}</nav>
      <div className="connection"><i className={online ? 'online' : ''} /><span>{online ? 'Backend live' : 'Backend offline'}</span></div>
    </header>
    <main>
      <div className="page-heading"><div><span className="eyebrow">{tab === 'training' ? 'Train · measure · improve' : tab === 'models' ? 'Versioned local artifacts' : tab === 'playground' ? 'Human-readable inference' : 'Objective, evidence, limits'}</span><h1>{tab === 'training' ? 'Training Lab' : tab === 'models' ? 'Model Registry' : tab === 'playground' ? 'Planning Playground' : 'Methodology'}</h1></div><div className="local-badge"><i>⌂</i><span>100% lokal<strong>Keine externen KI-APIs</strong></span></div></div>
      {tab === 'training' && <TrainingTab status={status} models={models} parentModel={parentModel} setParentModel={setParentModel} onRefresh={refresh} notify={notify} />}
      {tab === 'models' && <ModelsTab models={models} refresh={refresh} openTraining={id => { setParentModel(id); setTab('training') }} openPlayground={id => { setPlaygroundModel(id); setTab('playground') }} notify={notify} />}
      {tab === 'playground' && <PlaygroundTab models={models} selectedModel={playgroundModel} setSelectedModel={setPlaygroundModel} challenges={challenges} notify={notify} />}
      {tab === 'methodology' && <MethodologyTab />}
    </main>
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`}>{toast.message}</div>}
  </div>
}
