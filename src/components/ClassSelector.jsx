// ============================================================
// Class Selector (6-12) — shown in the navbar.
// ============================================================
import { useClass, CLASS_LEVELS } from '../context/ClassContext'
import { useLanguage } from '../context/LanguageContext'

export default function ClassSelector({ compact = false }) {
  const { classLevel, setClassLevel } = useClass()
  const { t } = useLanguage()

  if (compact) {
    return (
      <select
        className="select"
        value={classLevel}
        onChange={(e) => setClassLevel(e.target.value)}
        style={{ width: 'auto', padding: '8px 10px' }}
        aria-label={t('class')}
      >
        {CLASS_LEVELS.map((c) => (
          <option key={c} value={c}>
            Class {c}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
        {t('classLabel')}:
      </span>
      <div className="tab-bar" style={{ marginBottom: 0 }}>
        {CLASS_LEVELS.map((c) => (
          <button
            key={c}
            className={`tab-btn ${classLevel === c ? 'active' : ''}`}
            onClick={() => setClassLevel(c)}
            style={{ padding: '8px 13px' }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}
