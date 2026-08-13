export type TrainingState = 'idle' | 'running' | 'paused' | 'stopping' | 'completed' | 'failed'

export interface HistoryPoint {
  steps: number
  reward: number
  moving_reward: number
  loss: number
  policy_loss: number
  value_loss: number
  entropy: number
  evaluation_reward?: number | null
}

export interface TrainingStatus {
  state: TrainingState
  run_id?: string
  started_at?: string
  message: string
  steps: number
  total_steps: number
  episodes: number
  reward: number
  moving_reward: number
  evaluation_reward?: number
  best_evaluation_reward?: number | null
  best_step?: number
  loss: number
  policy_loss: number
  value_loss: number
  entropy: number
  learning_rate: number
  steps_per_second: number
  episodes_per_second: number
  cpu_percent: number
  ram_percent: number
  threads: number
  curriculum_level: number
  model_size_bytes: number
  history: HistoryPoint[]
}

export interface ModelRecord {
  id: string
  name: string
  version: number
  created_at: string
  parent_model?: string
  architecture: string
  parameters: number
  size_bytes: number
  exceeds_8mb: boolean
  training_steps: number
  training_episodes: number
  training_duration_seconds: number
  seed: number
  final_training_reward: number
  evaluation_score: number
  fresh_test_score: number
  evaluation: { mean_reward: number; mean_inference_ms: number; by_exam_count: Record<string, number> }
  baselines: Record<string, { mean_reward: number; by_exam_count: Record<string, number> }>
  hyperparameters: Record<string, unknown>
  onnx?: { size_bytes: number; loadable: boolean; max_logits_error: number }
  onnx_error?: string
  reward_version?: string
  best_validation_reward?: number
  best_step?: number
  selected_best_checkpoint?: boolean
}

export interface ExamInput {
  id: string
  subject: string
  kind: 'test' | 'exam'
  date: string
  difficulty: number
  importance: number
  invested_minutes: number
  estimated_need_minutes?: number
}

export interface TimeWindow { day: number; start_minute: number; end_minute: number }

export interface Session {
  day: number
  start_minute: number
  end_minute: number
  exam_id: string | null
  subject: string
  kind: 'study' | 'break'
}

export interface Plan {
  assignments: number[]
  sessions: Session[]
  reward: Record<string, number | Record<string, number>> & { total: number }
  learning_minutes: Record<string, number>
  inference_ms: number
  source: string
}

export interface PlaygroundResult {
  situation: unknown
  ai?: Plan
  baselines?: Record<string, Plan>
}

export interface Challenge {
  id: string
  name: string
  description: string
  situation: unknown
}
