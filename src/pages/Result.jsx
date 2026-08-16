// ============================================================
// Result page — congratulations, stats, grade, answer review,
// and certificate generation / PDF download.
// ============================================================
import { useEffect, useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useClass } from '../context/ClassContext'
import { saveCertificate } from '../services/store'
import { generateCertificatePDF } from '../services/certificate'
import { generateBilingualQuestions, isGeminiConfigured, geminiErrorMessage } from '../services/gemini'
import { generateLocalQuestions } from '../services/localQuiz'
import { formatDate, uid } from '../utils/helpers'
import { Alert } from '../components/ui'

const CERT_MIN_PERCENT = 60 // certificate earned at/above this percentage

function adaptiveDifficultyPercent(p) {
  if (p === null || p === undefined) return 'Medium'
  if (p < 45) return 'Easy'
  if (p <= 70) return 'Medium'
  return 'Hard'
}

export default function Result() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { userData } = useAuth()
  const { t, lang } = useLanguage()
  const { classLevel } = useClass()
  const result = state?.result
  const quiz = state?.quiz
  const isHi = lang === 'hi'

  const [certId, setCertId] = useState('')
  const [certSaved, setCertSaved] = useState(false)
  const [notice, setNotice] = useState('')
  const [aiRound, setAiRound] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    if (!result || !userData) return
    const earned = result.percentage >= CERT_MIN_PERCENT
    if (earned) {
      const cid = uid('CERT-')
      setCertId(cid)
      saveCertificate({
        id: cid,
        userId: userData.uid || 'demo-user',
        userName: userData.name || 'Student',
        quizId: result.quizId,
        quizName: result.quizTitle || quiz?.title || 'Quiz',
        score: result.score,
        total: result.total,
        percentage: result.percentage,
        grade: result.grade,
        date: new Date().toISOString(),
      }).then(() => setCertSaved(true))
    }
  }, [result, quiz, userData])

  if (!result) {
    return (
      <div className="container" style={{ paddingTop: 60, textAlign: 'center' }}>
        <Alert type="info">No result found. Take a quiz first.</Alert>
        <Link to="/quiz" className="btn btn-primary mt-3">{t('takeAQuiz')}</Link>
      </div>
    )
  }

  const downloadCert = async () => {
    setNotice('')
    try {
      await generateCertificatePDF({
        studentName: userData?.name || 'Student',
        quizName: result.quizTitle || quiz?.title || 'Quiz',
        score: result.score,
        percentage: result.percentage,
        grade: result.grade,
        certId: certId || uid('CERT-'),
        date: new Date(),
      })
    } catch (e) {
      setNotice(t('somethingWentWrong'))
    }
  }

  const letters = ['A', 'B', 'C', 'D']

  // Adaptive round: AI (or local fallback) generates 30 new questions at the student's level.
  const startAdaptiveRound = async () => {
    setAiRound(true)
    setAiError('')
    const difficulty = adaptiveDifficultyPercent(result.percentage)
    try {
      // 1) Try Gemini if configured & reachable
      if (isGeminiConfigured) {
        try {
          const questions = await generateBilingualQuestions({
            subject: (isHi ? 'सामान्य' : 'General'),
            topic: quiz?.title || result.quizTitle,
            count: 30,
            difficulty,
            language: lang,
            classLevel,
          })
          navigate('/take/ai-round', {
            state: {
              id: 'ai-round',
              title: (isHi ? 'AI अनुकूली राउंड' : 'AI Adaptive Round') + ' — ' + (quiz?.title || ''),
              titleHi: 'AI अनुकूली राउंड — ' + (quiz?.titleHi || ''),
              subjectId: result.subjectId,
              difficulty,
              timePerQuestion: 60,
              classLevel,
              questions,
            },
          })
          return
        } catch (err) {
          console.warn('Gemini adaptive failed, using local fallback:', err?.message || err)
        }
      }
      // 2) Local fallback — works even without internet
      const local = generateLocalQuestions({
        subjectId: result.subjectId,
        count: 30,
        difficulty,
        classLevel,
      })
      navigate('/take/ai-round', {
        state: {
          id: local.id,
          title: (isHi ? 'अनुकूली राउंड' : 'Adaptive Round') + ' — ' + (quiz?.title || ''),
          titleHi: 'अनुकूली राउंड — ' + (quiz?.titleHi || ''),
          subjectId: local.subjectId,
          difficulty,
          timePerQuestion: 60,
          classLevel,
          questions: local.questions,
        },
      })
    } catch (err) {
      setAiError(geminiErrorMessage(err.message))
      setAiRound(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 60, maxWidth: 860 }}>
      {/* Hero */}
      <div className="result-hero">
        <div className="trophy">🏆</div>
        <h1>{t('congratulations')}</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          {t('welcomeBackStudent')} {result.quizTitle || ''}
        </p>
      </div>

      {/* Grade circle + stats */}
      <div className="card mt-3" style={{ textAlign: 'center', padding: 30 }}>
        <div className={`grade-circle grade-${result.grade}`}>{result.grade}</div>
        <div style={{ fontSize: 32, fontWeight: 800 }}>{result.percentage}%</div>
        <div style={{ color: 'var(--text-muted)' }}>{t('score')}: {result.score}/{result.total}</div>

        <div className="result-grid">
          <div className="result-cell">
            <div className="val">{result.total}</div>
            <div className="lbl">{t('totalQuestions')}</div>
          </div>
          <div className="result-cell">
            <div className="val" style={{ color: 'var(--success)' }}>{result.correctAnswers}</div>
            <div className="lbl">{t('correctAnswers')}</div>
          </div>
          <div className="result-cell">
            <div className="val" style={{ color: 'var(--danger)' }}>{result.wrongAnswers}</div>
            <div className="lbl">{t('wrongAnswers')}</div>
          </div>
          <div className="result-cell">
            <div className="val" style={{ color: 'var(--text-muted)' }}>{result.unanswered ?? 0}</div>
            <div className="lbl">{t('unanswered')}</div>
          </div>
          <div className="result-cell">
            <div className="val">{result.percentage}%</div>
            <div className="lbl">{t('percentage')}</div>
          </div>
          <div className="result-cell">
            <div className="val">{result.grade}</div>
            <div className="lbl">{t('grade')}</div>
          </div>
        </div>
      </div>

      {/* Certificate */}
      {result.percentage >= CERT_MIN_PERCENT && certSaved && (
        <div className="card mt-3">
          <div className="cert-preview">
            <div style={{ fontSize: 12, letterSpacing: 3, fontWeight: 700, color: '#10477b' }}>
              REAL EDUCATION TIME
            </div>
            <h2 style={{ fontSize: 22, color: '#b37c00', margin: '6px 0' }}>{t('certificateOfAchievement')}</h2>
            <p style={{ color: '#555', marginTop: 8 }}>{t('proudlyPresentedTo')}</p>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#10477b', margin: '6px 0' }}>
              {userData?.name || 'Student'}
            </div>
            <p style={{ color: '#555' }}>{t('forSuccessfullyCompleting')}</p>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#10477b' }}>{result.quizTitle}</div>
            <p style={{ color: '#555', marginTop: 8 }}>
              {t('score')}: {result.score} | {t('percentage')}: {result.percentage}% | {t('grade')}: {result.grade}
            </p>
            <p style={{ color: '#999', fontSize: 13, marginTop: 10 }}>
              {t('date')}: {formatDate(new Date())} &nbsp;•&nbsp; ID: {certId}
            </p>
          </div>
          {notice && <Alert type="error">{notice}</Alert>}
          <button className="btn btn-primary btn-block mt-3" onClick={downloadCert}>⬇ {t('downloadPdf')}</button>
        </div>
      )}

      {/* AI Adaptive Round */}
      <div className="card mt-3">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: 26 }}>🤖</span>
          <h3 style={{ margin: 0 }}>
            {isHi ? 'AI अनुकूली राउंड' : 'AI Adaptive Round'}
          </h3>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {isHi
            ? `आपने ${result.percentage}% स्कोर किया। AI आपके प्रदर्शन के अनुसार (${result.percentage < 45 ? 'आसान' : result.percentage <= 70 ? 'मध्यम' : 'कठिन'}) 30 नए प्रश्न बनाएगा — 30 मिनट का, कक्षा ${classLevel} के स्तर पर।`
            : `You scored ${result.percentage}%. AI will create 30 new questions (${result.percentage < 45 ? 'Easy' : result.percentage <= 70 ? 'Medium' : 'Hard'}) at your level — 30 minutes, class ${classLevel}.`}
        </p>
        {aiError && <Alert type="error">{aiError}</Alert>}
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {isHi
            ? 'Bina internet ke भी चलेगा (local questions)।'
            : 'Works even without internet (local question bank).'}
        </p>
        <button className="btn btn-accent mt-2" onClick={startAdaptiveRound} disabled={aiRound}>
          {aiRound ? (
            <span className="spinner" style={{ width: 16, height: 16 }}></span>
          ) : (
            `${isHi ? '🤖 नया AI राउंड शुरू करें' : '🤖 Start New AI Round'}`
          )}
        </button>
      </div>

      {/* Answer review */}
      {quiz && result.answers && (
        <div className="card mt-3">
          <h3 className="mb-3">{t('reviewAnswers')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {quiz.questions.map((q, i) => {
              const sel = result.answers[i]
              const isCorrect = sel === q.correctAnswer
              const isUnanswered = sel === -1
              return (
                <div key={i} style={{ border: '1px solid var(--card-border)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700 }}>Q{i + 1}.</span>
                    <span>
                      {isUnanswered
                        ? '➖'
                        : isCorrect
                        ? '✅'
                        : '❌'}
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, marginBottom: 8 }}>
                    {isHi && q.questionHi ? q.questionHi : q.question}
                  </p>
                  {(isHi && q.optionsHi ? q.optionsHi : q.options).map((opt, oi) => (
                    <div
                      key={oi}
                      style={{
                        padding: '8px 12px', borderRadius: 8, marginBottom: 6, fontSize: 14,
                        background: oi === q.correctAnswer
                          ? 'var(--success-soft)'
                          : oi === sel && !isCorrect
                          ? 'var(--danger-soft)'
                          : 'var(--bg-soft)',
                        border: '1px solid var(--card-border)',
                        color: oi === q.correctAnswer
                          ? 'var(--success)'
                          : oi === sel && !isCorrect
                          ? 'var(--danger)'
                          : 'inherit',
                      }}
                    >
                      {letters[oi]}. {opt}
                      {oi === sel && (isHi ? '  (आपका उत्तर)' : '  (your answer)')}
                    </div>
                  ))}
                  <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8 }}>
                    <strong>{t('explanation')}:</strong> {isHi && q.explanationHi ? q.explanationHi : q.explanation}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/dashboard" className="btn btn-primary">{t('backToDashboard')}</Link>
        <Link to="/quiz" className="btn btn-accent">{t('takeAQuiz')}</Link>
      </div>
    </div>
  )
}
