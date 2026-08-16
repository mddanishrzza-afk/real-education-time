// ============================================================
// Leaderboard — real data from stored results
// ============================================================
import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { getLeaderboard } from '../services/store'
import { Spinner, EmptyState } from '../components/ui'

const medals = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const { t } = useLanguage()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeaderboard()
      .then(setRows)
      .catch((err) => { console.error('Leaderboard load error:', err); setRows([]) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-heading text-center">
        <h1>{t('leaderboardTitle')}</h1>
        <p>{t('leaderboard')}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState emoji="🏆" title={t('noAttemptsYet')} />
      ) : (
        <>
          {/* Podium for top 3 */}
          <div className="podium">
            {[1, 0, 2].map((idx) => {
              const r = top3[idx]
              if (!r) return null
              return (
                <div key={idx} className="podium-item">
                  <div className="rank-icon">{medals[idx]}</div>
                  <div className="name">{r.name}</div>
                  <div className="score">{r.avgPercent}% • {r.count} quiz</div>
                  <div className={`bar bar-${idx + 1}`}>{idx + 1}</div>
                </div>
              )
            })}
          </div>

          {/* Full list */}
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('rank')}</th>
                    <th>{t('studentName')}</th>
                    <th>{t('score')}</th>
                    <th>{t('percentage')}</th>
                    <th>{t('quizzesCompletedShort')}</th>
                    <th>{t('bestScore')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.userId || i}>
                      <td>
                        <span className="badge badge-muted">
                          {i < 3 ? `${medals[i]} ` : `#${i + 1}`}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td>{r.totalScore}</td>
                      <td>{r.avgPercent}%</td>
                      <td>{r.count}</td>
                      <td>{r.best}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
