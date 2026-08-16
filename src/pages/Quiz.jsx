// ============================================================
// Quiz Engine — timer, navigation, answer selection, auto-next,
// confirmation and final submission.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useClass } from '../context/ClassContext'
import { getQuizById, saveResult } from '../services/store'
import { generateBilingualQuestions, isGeminiConfigured } from '../services/gemini'
import { questionsForClass } from '../services/localQuiz'
import { formatTime, percent, uid } from '../utils/helpers'
import { gradeFor } from '../data/sampleData'
import { Spinner, Alert, Modal } from '../components/ui'

export default function Quiz() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { userData, isAuthenticated } = useAuth()
  const { t, lang } = useLanguage()
  const { classLevel } = useClass()

  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState([]) // array of selected index (-1 = none)
  const [timeLeft, setTimeLeft] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [currentClass, setCurrentClass] = useState('')

  const timerRef = useRef(null)
  const answersRef = useRef([])

  useEffect(() => {
    let cancelled = false

    const setup = (q) => {
      if (cancelled) return
      setQuiz(q)
      const init = new Array(q.questions.length).fill(-1)
      setAnswers(init)
      answersRef.current = init
      setTimeLeft(q.timePerQuestion || 60)
      setLoading(false)
    }

    // Support AI/local adaptive quiz passed via router state
    if (location.state?.questions) {
      const st = location.state
      setCurrentClass(st.classLevel || classLevel || '')
      setup({
        id: st.id || 'ai-quiz',
        title: st.title || 'AI Adaptive Quiz',
        titleHi: st.titleHi || 'AI अनुकूली क्विज़',
        subjectId: st.subjectId || '',
        difficulty: st.difficulty || 'Medium',
        timePerQuestion: st.timePerQuestion || 60,
        classLevel: st.classLevel || '',
        questions: st.questions,
      })
      return () => { cancelled = true }
    }

    getQuizById(id)
      .then(async (q) => {
        if (!q || !q.questions || q.questions.length === 0) { if (!cancelled) { setError(t('quizCouldNotBeLoaded')); setLoading(false) } return }
        setCurrentClass(classLevel || q.classLevel || '')
        let finalQuiz = q
        // If Gemini is available, generate questions at the selected class level
        if (isGeminiConfigured && classLevel && !location.state) {
          try {
            const subjectName = (q.title || '').replace(/:.*/, '').trim() || (lang === 'hi' ? 'सामान्य' : 'General')
            const generated = await generateBilingualQuestions({
              subject: subjectName,
              topic: q.title,
              count: q.questions.length,
              difficulty: q.difficulty || 'Medium',
              language: lang,
              classLevel,
            })
            if (!cancelled && generated && generated.length > 0) {
              finalQuiz = { ...q, questions: generated, classLevel }
            }
          } catch (err) {
            console.warn('Class-level generation failed, using local class filter:', err?.message || err)
          }
        }
        // If Gemini not available, pick questions for the selected class from the local bank
        if (!isGeminiConfigured && classLevel) {
          const localQs = questionsForClass(q.subjectId, classLevel)
          if (localQs && localQs.length > 0) {
            finalQuiz = { ...q, questions: localQs, classLevel }
          }
        }
        setup(finalQuiz)
      })
      .catch(() => { if (!cancelled) { setError(t('quizCouldNotBeLoaded')); setLoading(false) } })

    return () => { cancelled = true }
  }, [id, classLevel])

  // Timer — reset to full time whenever the question changes
  useEffect(() => {
    if (!quiz || submitting) return
    setTimeLeft(quiz.timePerQuestion || 20)
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // auto-next when time expires
          setCurrent((c) => (c < quiz.questions.length - 1 ? c + 1 : c))
          return quiz.timePerQuestion || 20
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [quiz, current, submitting])

  const selectAnswer = (idx) => {
    const next = [...answersRef.current]
    next[current] = idx
    answersRef.current = next
    setAnswers(next)
  }

  const goNext = () => {
    if (current < quiz.questions.length - 1) setCurrent((c) => c + 1)
  }
  const goPrev = () => {
    if (current > 0) setCurrent((c) => c - 1)
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    setSubmitting(true)
    // Compute results
    const total = quiz.questions.length
    let correct = 0, wrong = 0, unanswered = 0
    quiz.questions.forEach((q, i) => {
      const sel = answersRef.current[i]
      if (sel === -1) unanswered++
      else if (sel === q.correctAnswer) correct++
      else wrong++
    })
    const score = correct
    const percentage = percent(score, total)
    const grade = gradeFor(percentage).grade

    const result = {
      userId: userData?.uid || 'demo-user',
      userName: userData?.name || 'Student',
      quizId: quiz.id,
      quizTitle: quiz.title,
      subjectId: quiz.subjectId,
      score,
      total,
      percentage,
      grade,
      correctAnswers: correct,
      wrongAnswers: wrong,
      unanswered,
      answers: answersRef.current,
      timeTaken: 0,
    }

    try {
      const saved = await saveResult(result)
      navigate('/result', {
        state: { result: { ...saved, id: saved.id || uid('r-'), answers: answersRef.current }, quiz },
      })
    } catch (err) {
      setError(t('somethingWentWrong'))
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner />
  if (error) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <Alert type="error">{error}</Alert>
        <button className="btn btn-ghost mt-3" onClick={() => navigate('/quiz')}>{t('back')}</button>
      </div>
    )
  }

  const q = quiz.questions[current]
  const letters = ['A', 'B', 'C', 'D']
  const progress = ((current + 1) / quiz.questions.length) * 100
  const selected = answers[current]
  const isHi = lang === 'hi'
  // Bilingual content — pick Hindi text if available
  const qText = isHi && q.questionHi ? q.questionHi : q.question
  const qOptions = isHi && q.optionsHi ? q.optionsHi : q.options
  const quizTitle = isHi && quiz.titleHi ? quiz.titleHi : quiz.title
  const shownClass = currentClass || (location.state?.classLevel) || quiz.classLevel || classLevel

  return (
    <div className="quiz-screen">
      <div className="quiz-top">
        <div>
          <h2 style={{ fontSize: 22 }}>{quizTitle}</h2>
          <div className="flex gap-2 mt-2 wrap">
            <span className="badge badge-muted">
              {t('question')} {current + 1} {t('of')} {quiz.questions.length}
            </span>
            {shownClass && (
              <span className="badge badge-primary">{t('classLabel')} {shownClass}</span>
            )}
          </div>
        </div>
        <div className={`timer ${timeLeft <= 5 ? 'low' : ''}`}>⏱ {formatTime(timeLeft)}</div>
      </div>

      <div className="progress mb-3"><div style={{ width: `${progress}%` }}></div></div>
      <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        {Math.round(progress)}%
      </div>

      <div className="card">
        <h3 style={{ fontSize: 19, marginBottom: 22 }}>{qText}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {qOptions.map((opt, i) => (
            <button
              key={i}
              className={`quiz-card-opt ${selected === i ? 'selected' : ''}`}
              onClick={() => selectAnswer(i)}
            >
              <span className="letter">{letters[i]}</span>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-3" style={{ gap: 12 }}>
        <button className="btn btn-outline" onClick={goPrev} disabled={current === 0}>{t('previous')}</button>
        {current === quiz.questions.length - 1 ? (
          <button className="btn btn-accent" onClick={() => setShowConfirm(true)} disabled={submitting}>
            {submitting ? t('loading') : t('submit')}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={goNext}>{t('next')}</button>
        )}
      </div>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title={t('submit')}>
        <p>{t('confirmSubmit')}</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>
          {t('correctAnswers')}: {answers.filter((a) => a !== -1).length}
        </p>
        <div className="flex gap-2 mt-3" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={() => setShowConfirm(false)}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit}>{t('yes')}</button>
        </div>
      </Modal>
    </div>
  )
}
