// ============================================================
// Student Profile — avatar, info, stats, editable basics
// ============================================================
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getResultsForUser, getCertificatesForUser } from '../services/store'
import { Spinner, StatCard, Alert } from '../components/ui'

export default function Profile() {
  const { userData, updateProfileData } = useAuth()
  const { t } = useLanguage()
  const [results, setResults] = useState([])
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(userData?.name || '')
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  const userId = userData?.uid || 'demo-user'

  useEffect(() => {
    ;(async () => {
      try {
        const [r, c] = await Promise.all([
          getResultsForUser(userId),
          getCertificatesForUser(userId),
        ])
        setResults(r)
        setCerts(c)
      } catch (err) {
        console.error('Profile load error:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  useEffect(() => { setName(userData?.name || '') }, [userData])

  if (loading) return <Spinner />

  const avg = results.length
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
    : 0
  const best = results.length ? Math.max(...results.map((r) => r.percentage)) : 0

  const handleSave = async () => {
    await updateProfileData({ name })
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 900 }}>
      <div className="page-heading"><h1>{t('profile')}</h1></div>

      <div className="card flex items-center gap-3">
        <div className="avatar" style={{ width: 74, height: 74, fontSize: 30 }}>
          {(userData?.name || 'S').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <h2 style={{ fontSize: 24 }}>{userData?.name}</h2>
          )}
          <p style={{ color: 'var(--text-muted)' }}>{userData?.email}</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>{t('cancel')}</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>{t('save')}</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>{t('edit')}</button>
          )}
        </div>
      </div>
      {saved && <Alert type="success">Saved!</Alert>}

      <div className="grid grid-4 mt-3">
        <StatCard icon="✅" num={results.length} label={t('quizzesCompleted')} />
        <StatCard icon="📊" num={`${avg}%`} label={t('averageScore')} />
        <StatCard icon="🏅" num={`${best}%`} label={t('bestScore')} />
        <StatCard icon="🎖️" num={certs.length} label={t('certificatesEarned')} />
      </div>

      <div className="card mt-3">
        <h3 className="mb-3">{t('recentQuizzes')}</h3>
        {results.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>{t('noAttemptsYet')}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('quizTitle')}</th>
                  <th>{t('score')}</th>
                  <th>{t('percentage')}</th>
                  <th>{t('grade')}</th>
                  <th>{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td>{r.quizTitle}</td>
                    <td>{r.score}/{r.total}</td>
                    <td>{r.percentage}%</td>
                    <td><span className="badge badge-primary">{r.grade}</span></td>
                    <td>{new Date(r.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
