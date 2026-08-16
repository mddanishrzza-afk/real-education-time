// ============================================================
// Admin Dashboard — full control: stats, users, subjects,
// quizzes, results, certificates
// ============================================================
import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import QuizManager from '../components/panels/QuizManager'
import SubjectsManager from '../components/panels/SubjectsManager'
import ResultsView from '../components/panels/ResultsView'
import { getAllResults, getQuizzes, getSubjects, getAllUsers, getAllCertificates } from '../services/store'
import { Spinner, StatCard, EmptyState } from '../components/ui'

export default function AdminDashboard() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [certs, setCerts] = useState([])

  useEffect(() => {
    ;(async () => {
      const [results, quizzes, subjects, users, certs] = await Promise.all([
        getAllResults(), getQuizzes({ includeUnpublished: true }), getSubjects(), getAllUsers(), getAllCertificates(),
      ])
      const qCount = quizzes.reduce((n, q) => n + (q.questions?.length || 0), 0)
      const sCount = subjects.length
      const students = users.filter((u) => (u.role || 'student') === 'student').length
      const teachers = users.filter((u) => u.role === 'teacher').length
      setStats({ students, teachers, quizzes: quizzes.length, questions: qCount, attempts: results.length, subjects: sCount })
      setUsers(users)
      setCerts(certs)
    })()
  }, [])

  const tabs = [
    { id: 'dashboard', label: t('dashboard') },
    { id: 'users', label: t('users') },
    { id: 'subjects', label: t('subjects') },
    { id: 'quizzes', label: t('quizzes') },
    { id: 'results', label: t('results') },
    { id: 'certificates', label: t('certificates') },
  ]

  if (!stats) return <Spinner />

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-heading"><h1>{t('adminDashboard')}</h1></div>
      <div className="tab-bar">
        {tabs.map((tb) => (
          <button key={tb.id} className={`tab-btn ${tab === tb.id ? 'active' : ''}`} onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="grid grid-4">
          <StatCard icon="🎓" num={stats.students} label={t('totalStudents')} />
          <StatCard icon="👩‍🏫" num={stats.teachers} label={t('totalTeachers')} />
          <StatCard icon="📝" num={stats.quizzes} label={t('totalQuizzes')} />
          <StatCard icon="❓" num={stats.questions} label={t('totalQuestions')} />
          <StatCard icon="🖱️" num={stats.attempts} label={t('totalAttempts')} />
          <StatCard icon="📚" num={stats.subjects} label={t('subjects')} />
        </div>
      )}

      {tab === 'users' && (
        <div className="card">
          <h3 className="mb-3">{t('users')} ({users.length})</h3>
          {users.length === 0 ? (
            <EmptyState title="No users yet." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('studentName')}</th><th>{t('email')}</th><th>Role</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id || u.uid}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className="badge badge-primary">{u.role || 'student'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'subjects' && <SubjectsManager />}
      {tab === 'quizzes' && <QuizManager />}
      {tab === 'results' && <ResultsView />}

      {tab === 'certificates' && (
        <div className="card">
          <h3 className="mb-3">{t('certificates')} ({certs.length})</h3>
          {certs.length === 0 ? (
            <EmptyState title={t('noCertificates')} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>ID</th><th>{t('studentName')}</th><th>{t('quizTitle')}</th><th>{t('percentage')}</th><th>{t('grade')}</th></tr></thead>
                <tbody>
                  {certs.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{c.userName}</td>
                      <td>{c.quizName}</td>
                      <td>{c.percentage}%</td>
                      <td><span className="badge badge-success">{c.grade}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
