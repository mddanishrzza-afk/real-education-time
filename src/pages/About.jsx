// ============================================================
// About page
// ============================================================
import { useLanguage } from '../context/LanguageContext'

export default function About() {
  const { t } = useLanguage()
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-heading text-center">
        <h1>{t('aboutUs')}</h1>
        <p>{t('footerText')}</p>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Our Mission</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            REAL EDUCATION TIME makes learning interactive and rewarding. We combine structured
            study material with timed quizzes so every student can practice, measure progress and
            improve step by step.
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>What we offer</h3>
          <ul style={{ color: 'var(--text-muted)', paddingLeft: 18 }}>
            <li>Subjects across Science, Maths, Computer & General Knowledge</li>
            <li>Timed MCQ quizzes with instant results and grades</li>
            <li>Detailed answer review with explanations</li>
            <li>Live leaderboard and achievement certificates</li>
            <li>Bilingual interface (English / हिंदी)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
