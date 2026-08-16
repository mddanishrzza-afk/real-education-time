// ============================================================
// Quiz list page (with subject filter)
// ============================================================
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useClass } from '../context/ClassContext'
import { getSubjects, getQuizzes } from '../services/store'
import { Spinner, EmptyState } from '../components/ui'

export default function QuizList() {
  const { t } = useLanguage()
  const { classLevel } = useClass()
  const [params] = useSearchParams()
  const activeSubject = params.get('subject') || 'all'

  const [subjects, setSubjects] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const subj = await getSubjects()
      setSubjects(subj)
      const list = await getQuizzes(activeSubject !== 'all' ? { subjectId: activeSubject } : {})
      setQuizzes(list)
      setLoading(false)
    })()
  }, [activeSubject])

  const filtered = quizzes
  const subjectName = (id) => subjects.find((s) => s.id === id)?.name || id
  const subjectIcon = (id) => subjects.find((s) => s.id === id)?.icon || '📘'

  if (loading) return <Spinner />

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-heading">
        <h1>{t('quiz')}</h1>
        <p>
          {t('selectSubject')} • {t('classLabel')} {classLevel}
        </p>
      </div>

      {/* Subject filter */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeSubject === 'all' ? 'active' : ''}`}
          onClick={() => (window.location.search = '')}
        >
          {t('allSubjects')}
        </button>
        {subjects.map((s) => (
          <Link
            key={s.id}
            to={`/quiz?subject=${s.id}`}
            className={`tab-btn ${activeSubject === s.id ? 'active' : ''}`}
          >
            {s.icon} {s.name}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('noQuizzesAvailable')} />
      ) : (
        <div className="grid grid-3">
          {filtered.map((q) => (
            <div key={q.id} className="quiz-card">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 26 }}>{subjectIcon(q.subjectId)}</span>
                <span className="badge badge-muted">{subjectName(q.subjectId)}</span>
              </div>
              <div className="quiz-title">{q.title}</div>
              <div className="quiz-meta">
                <span className="badge badge-primary">{t(q.difficulty?.toLowerCase())}</span>
                <span className="badge badge-muted">{q.questions?.length} Qs</span>
                <span className="badge badge-accent">⏱ {q.timePerQuestion}s</span>
              </div>
              <Link to={`/take/${q.id}`} className="btn btn-primary btn-block">{t('startQuiz')}</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
