// ============================================================
// Teacher Dashboard — manage quizzes, questions, view results
// ============================================================
import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import QuizManager from '../components/panels/QuizManager'
import ResultsView from '../components/panels/ResultsView'

export default function TeacherDashboard() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('quizzes')

  const tabs = [
    { id: 'quizzes', label: t('manageQuizzes') },
    { id: 'results', label: t('studentPerformance') },
  ]

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-heading"><h1>{t('teacherDashboard')}</h1></div>
      <div className="tab-bar">
        {tabs.map((tb) => (
          <button key={tb.id} className={`tab-btn ${tab === tb.id ? 'active' : ''}`} onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
      </div>
      {tab === 'quizzes' ? <QuizManager /> : <ResultsView />}
    </div>
  )
}
