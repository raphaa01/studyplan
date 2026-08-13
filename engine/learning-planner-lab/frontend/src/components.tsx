import type { ReactNode } from 'react'

export function Metric({ label, value, hint, accent = false }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return <div className={`metric ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
}

export function LineChart({ series, height = 190 }: { series: { values: number[]; color: string; label: string }[]; height?: number }) {
  const width = 760
  const all = series.flatMap(item => item.values).filter(Number.isFinite)
  if (all.length < 1) return <div className="chart-empty">Messwerte erscheinen, sobald ein Training läuft.</div>
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  return <div className="chart-wrap">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map(s => s.label).join(', ')}>
      {[0, 1, 2, 3].map(i => <line key={i} x1="0" x2={width} y1={12 + i * (height - 24) / 3} y2={12 + i * (height - 24) / 3} className="gridline" />)}
      {series.map(item => {
        const points = item.values.map((value, index) => {
          const x = item.values.length === 1 ? width / 2 : index / (item.values.length - 1) * width
          const y = 12 + (max - value) / range * (height - 24)
          return `${x},${y}`
        }).join(' ')
        return <g key={item.label}>
          <polyline points={points} fill="none" stroke={item.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {item.values.length === 1 && <circle cx={width / 2} cy={height / 2} r="4" fill={item.color} />}
        </g>
      })}
    </svg>
    <div className="legend">{series.map(item => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}<span className="range">{min.toFixed(1)} – {max.toFixed(1)}</span></div>
  </div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><div className="empty-mark">∿</div><p>{children}</p></div>
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}

export function formatDuration(seconds = 0) {
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.round(seconds % 60)} s`
}

export function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
