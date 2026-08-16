// ============================================================
// Subjects page
// ============================================================
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { getSubjects, getQuizzes } from '../services/store'
import { Spinner, EmptyState } from '../components/ui'

export default function Subjects() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const subj = await getSubjects()
      const enriched = await Promise.all(
        subj.map(async (s) => {
          const qs = await getQuizzes({ subjectId: s.id })
          const qCount = qs.reduce((n, q) => n + (q.questions?.length || 0), 0)
          return { ...s, quizCount: qs.length, questionCount: qCount }
        })
      )
      setSubjects(enriched)
      setLoading(false)
    })()
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-heading">
        <h1>{t('allSubjects')}</h1>
        <p>{t('selectSubject')}</p>
      </div>
      {subjects.length === 0 ? (
        <EmptyState title={t('noQuizzesAvailable')} />
      ) : (
        <div className="grid grid-3">
          {subjects.map((s) => (
            <div key={s.id} className="subject-card" onClick={() => navigate(`/quiz?subject=${s.id}`)}>
              <div className="subj-icon">{s.icon}</div>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <div className="flex wrap gap-2" style={{ marginTop: 'auto' }}>
                <span className="badge badge-primary">{s.quizCount} Quizzes</span>
                <span className="badge badge-accent">{s.questionCount} Qs</span>
                <span className="badge badge-muted">{s.difficulty}</span>
              </div>
              <Link to={`/quiz?subject=${s.id}`} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                {t('startNow')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
