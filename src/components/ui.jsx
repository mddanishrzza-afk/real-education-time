// ============================================================
// Reusable UI primitives
// ============================================================
import { useLanguage } from '../context/LanguageContext'

export function Spinner({ text }) {
  const { t } = useLanguage()
  return (
    <div className="loading-wrap">
      <div className="spinner"></div>
      <span>{text || t('loading')}</span>
    </div>
  )
}

export function EmptyState({ emoji = '📭', title, sub }) {
  return (
    <div className="empty-state">
      <div className="emoji">{emoji}</div>
      <h3 style={{ color: 'var(--text)', marginBottom: 4 }}>{title}</h3>
      {sub && <p>{sub}</p>}
    </div>
  )
}

export function Alert({ type = 'info', children }) {
  return <div className={`alert alert-${type}`}>{children}</div>
}

export function StatCard({ icon, num, label }) {
  return (
    <div className="stat-card">
      <div className="icon">{icon}</div>
      <div>
        <div className="num">{num}</div>
        <div className="lbl">{label}</div>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 19 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ fontSize: 24, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider"></span>
      {label && <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>}
    </label>
  )
}
