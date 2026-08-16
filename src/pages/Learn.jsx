// ============================================================
// Learn — AI Study assistant
// Student can ask the AI about any subject/topic and study.
// Works with Gemini online, or falls back to a local tutor offline.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useClass, CLASS_LEVELS } from '../context/ClassContext'
import { getSubjects } from '../services/store'
import { studyChat, isGeminiConfigured, geminiErrorMessage } from '../services/gemini'
import { localStudyAnswer } from '../services/localStudy'
import { Alert, Spinner } from '../components/ui'

const suggestions = {
  en: [
    'Explain photosynthesis',
    'What is Newton\u2019s First Law?',
    'How does the water cycle work?',
    'What is a computer CPU?',
    'Tell me about the solar system',
    'What is gravity?',
  ],
  hi: [
    'प्रकाश संश्लेषण समझाइए',
    'न्यूटन का पहला नियम क्या है?',
    'जल चक्र कैसे काम करता है?',
    'कंप्यूटर CPU क्या है?',
    'सौरमंडल के बारे में बताओ',
    'गुरुत्वाकर्षण क्या है?',
  ],
}

export default function Learn() {
  const { t, lang } = useLanguage()
  const isHi = lang === 'hi'
  const { classLevel, setClassLevel } = useClass()
  const [subjects, setSubjects] = useState([])
  const [subject, setSubject] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    getSubjects()
      .then((s) => setSubjects(s))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const ask = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setError('')
    setMessages((m) => [...m, { role: 'user', content: q }])
    setLoading(true)
    try {
      // 1) Try Gemini if configured & reachable
      if (isGeminiConfigured) {
        try {
          const answer = await studyChat({
            subject: subject || (isHi ? 'सामान्य' : 'General'),
            question: q,
            language: lang,
            classLevel,
          })
          setMessages((m) => [...m, { role: 'ai', content: answer }])
          return
        } catch (err) {
          // Gemini failed (network blocked, quota, etc.) -> local fallback
          console.warn('Gemini study failed, using local fallback:', err?.message || err)
        }
      }
      // 2) Local fallback — works even without internet
      const answer = localStudyAnswer(q, lang)
      setMessages((m) => [...m, { role: 'ai', content: answer }])
    } catch (err) {
      setError(geminiErrorMessage(err.message))
    } finally {
      setLoading(false)
    }
  }

  const sug = suggestions[lang] || suggestions.en

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 760 }}>
      <div className="page-heading">
        <h1>{isHi ? 'AI के साथ सीखें 📖' : 'Learn with AI 📖'}</h1>
        <p>
          {isHi
            ? 'कोई भी विषय या सवाल पूछिए — AI आपको पढ़ाने में मदद करेगा।'
            : 'Ask any subject question — the AI tutor will help you understand.'}
        </p>
      </div>

      {/* Class + Subject selectors */}
      <div className="card mb-3">
        <div className="grid grid-2">
          <div>
            <label style={{ fontWeight: 600, fontSize: 14 }}>{t('classLabel')}</label>
            <div className="tab-bar" style={{ marginTop: 8 }}>
              {CLASS_LEVELS.map((c) => (
                <button
                  key={c}
                  className={`tab-btn ${classLevel === c ? 'active' : ''}`}
                  onClick={() => setClassLevel(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {isHi ? `कक्षा ${classLevel} के स्तर पर जवाब` : `Answers at class ${classLevel} level`}
            </p>
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: 14 }}>
              {isHi ? 'विषय चुनें' : 'Select subject'}
            </label>
            <select className="select mt-2" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">{isHi ? 'सभी विषय' : 'All subjects'}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Setup notice */}
      {!isGeminiConfigured && (
        <Alert type="info">
          {isHi
            ? 'Offline mode — मैं सामान्य विषयों के जवाब दूंगा। पूरा AI जवाब ऑनलाइन (deployed) होने पर मिलेगा।'
            : 'Offline mode — I\u2019ll answer common topics. Full AI answers work once the app is deployed.'}
        </Alert>
      )}

      {/* Chat area */}
      <div className="card" style={{ minHeight: 320, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
          {messages.length === 0 && (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="emoji">🤖</div>
              <p>{isHi ? 'नीचे अपना सवाल लिखें या एक सुझाव चुनें।' : 'Type your question below, or pick a suggestion.'}</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: 14,
                background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-soft)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                whiteSpace: 'pre-wrap',
                fontSize: 15,
                border: m.role === 'user' ? 'none' : '1px solid var(--card-border)',
              }}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: 'flex-start', background: 'var(--bg-soft)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '12px 16px' }}>
              <div className="spinner" style={{ width: 18, height: 18 }}></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {/* Suggestions */}
        <div className="flex wrap gap-2" style={{ marginBottom: 12 }}>
          {sug.map((s) => (
            <button key={s} className="btn btn-outline btn-sm" onClick={() => ask(s)} disabled={loading}>
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            className="input"
            placeholder={isHi ? 'अपना सवाल लिखें…' : 'Type your question…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            disabled={loading}
          />
          <button className="btn btn-primary" onClick={() => ask()} disabled={loading || !input.trim()}>
            {isHi ? 'भेजें' : 'Ask'} ➤
          </button>
        </div>
      </div>
    </div>
  )
}
