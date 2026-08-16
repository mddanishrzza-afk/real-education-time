// ============================================================
// Landing / Home page
// ============================================================
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { getSubjects } from '../services/store'
import { useEffect, useState } from 'react'
import { Spinner } from '../components/ui'

export default function Landing() {
  const { t } = useLanguage()
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false))
  }, [])

  const features = [
    { icon: '📚', title: t('learn'), desc: 'Clear, focused study material across subjects.' },
    { icon: '✏️', title: t('practice'), desc: 'Reinforce concepts with engaging practice quizzes.' },
    { icon: '⏱️', title: t('test'), desc: 'Timed MCQs that build speed and confidence.' },
    { icon: '📈', title: t('improve'), desc: 'Track your scores, grades and earn certificates.' },
  ]

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-primary">🎯 {t('tagline')}</span>
            <h1 className="mt-3">
              {t('heroTitle').split('.')[0]}. <span className="grad">{t('heroTitle').split('.')[1] || 'Become Better.'}</span>
            </h1>
            <p className="lead">{t('heroSub')}</p>
            <div className="hero-btns">
              <Link to="/subjects" className="btn btn-primary btn-lg">{t('startLearning')}</Link>
              <Link to="/quiz" className="btn btn-accent btn-lg">{t('takeAQuiz')}</Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <div className="num">6+</div>
                <div className="lbl">Subjects</div>
              </div>
              <div className="stat">
                <div className="num">50+</div>
                <div className="lbl">Questions</div>
              </div>
              <div className="stat">
                <div className="num">100%</div>
                <div className="lbl">Free Learning</div>
              </div>
            </div>
          </div>
          <div className="hero-art">📖</div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section">
        <div className="container">
          <div className="text-center">
            <h2 className="section-title">Learn • Practice • Test • Improve</h2>
            <p className="section-sub" style={{ margin: '0 auto' }}>Everything a student needs to master any subject.</p>
          </div>
          <div className="grid grid-4 mt-4">
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <div className="icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SUBJECTS */}
      <section className="section" style={{ background: 'var(--bg-soft)' }}>
        <div className="container">
          <div className="text-center">
            <h2 className="section-title">{t('allSubjects')}</h2>
            <p className="section-sub" style={{ margin: '0 auto' }}>{t('selectSubject')}</p>
          </div>
          {loading ? (
            <Spinner />
          ) : (
            <div className="grid grid-3 mt-3">
              {subjects.slice(0, 6).map((s) => (
                <Link to={`/quiz?subject=${s.id}`} key={s.id} className="subject-card">
                  <div className="subj-icon">{s.icon}</div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <span className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>{s.difficulty}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container text-center">
          <div className="card" style={{ padding: 40 }}>
            <h2 className="section-title">Ready to test yourself?</h2>
            <p className="section-sub" style={{ margin: '0 auto 20px' }}>Take a timed quiz, see your grade, and earn a certificate.</p>
            <Link to="/quiz" className="btn btn-accent btn-lg">{t('startQuiz')}</Link>
          </div>
        </div>
      </section>
    </>
  )
}
