import type { Challenge, ModelRecord, PlaygroundResult, TrainingStatus } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try { detail = (await response.json()).detail ?? detail } catch { /* response was not JSON */ }
    throw new Error(detail)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  health: () => request<{ status: string; version: string; models: number }>('/api/health'),
  status: () => request<TrainingStatus>('/api/training/status'),
  models: () => request<ModelRecord[]>('/api/models'),
  challenges: () => request<Challenge[]>('/api/challenges'),
  start: (config: Record<string, unknown>) => request<TrainingStatus>('/api/training/start', { method: 'POST', body: JSON.stringify({ config }) }),
  command: (command: 'pause' | 'resume' | 'stop') => request<TrainingStatus>(`/api/training/${command}`, { method: 'POST' }),
  rename: (id: string, name: string) => request<ModelRecord>(`/api/models/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  remove: (id: string) => request<void>(`/api/models/${id}`, { method: 'DELETE' }),
  export: (id: string) => request<Record<string, unknown>>(`/api/models/${id}/export`, { method: 'POST' }),
  plan: (payload: Record<string, unknown>) => request<PlaygroundResult>('/api/playground/plan', { method: 'POST', body: JSON.stringify(payload) }),
  runChallenge: (caseId: string, modelId: string) => request<{ ai: import('./types').Plan; baselines: Record<string, import('./types').Plan> }>(`/api/challenges/${caseId}/run?model_id=${encodeURIComponent(modelId)}`, { method: 'POST' }),
}

