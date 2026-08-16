// ============================================================
// Results / Student Performance view (Teacher & Admin)
// ============================================================
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { getAllResults } from '../../services/store'
import { Spinner, EmptyState } from '../ui'

export default function ResultsView() {
  const { t } = useLanguage()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllResults().then(setResults).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <h3 className="mb-3">{t('studentPerformance')} ({results.length})</h3>
      {results.length === 0 ? (
        <EmptyState title={t('noAttemptsYet')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('studentName')}</th>
                <th>{t('quizTitle')}</th>
                <th>{t('score')}</th>
                <th>{t('percentage')}</th>
                <th>{t('grade')}</th>
                <th>{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.userName || 'Student'}</td>
                  <td>{r.quizTitle}</td>
                  <td>{r.correctAnswers} / {r.total}</td>
                  <td>{r.percentage}%</td>
                  <td><span className={`badge ${r.grade === 'A' ? 'badge-success' : r.grade === 'B' ? 'badge-accent' : 'badge-danger'}`}>{r.grade}</span></td>
                  <td>{new Date(r.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
