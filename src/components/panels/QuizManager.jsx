// ============================================================
// Quiz Manager — create/edit/delete/publish quizzes and manage
// questions within a quiz. Used by Teacher and Admin.
// ============================================================
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { getQuizzes, getSubjects, saveQuiz, deleteQuiz, getAveragePercent } from '../../services/store'
import { generateQuestions, adaptiveDifficulty, geminiErrorMessage, isGeminiConfigured } from '../../services/gemini'
import { Modal, Alert, EmptyState, Spinner } from '../ui'

const emptyQuestion = () => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
})

const emptyQuiz = {
  title: '',
  subjectId: '',
  classLevel: '8',
  difficulty: 'Medium',
  timePerQuestion: 20,
  status: 'published',
  questions: [emptyQuestion()],
}

export default function QuizManager() {
  const { t } = useLanguage()
  const { userData, isStudent } = useAuth()
  const [quizzes, setQuizzes] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null) // quiz being edited
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Gemini AI generator state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiCount, setAiCount] = useState(4)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const load = async () => {
    const [q, s] = await Promise.all([getQuizzes({ includeUnpublished: true }), getSubjects()])
    setQuizzes(q)
    setSubjects(s)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEdit({ ...emptyQuiz, subjectId: subjects[0]?.id || '' }); setIsNew(true); setError('') }
  const openEdit = (q) => { setEdit(JSON.parse(JSON.stringify(q))); setIsNew(false); setError('') }

  const save = async () => {
    if (!edit.title || !edit.subjectId || edit.questions.some((qq) => !qq.question)) {
      setError('Please fill quiz title and all question texts.'); return
    }
    setSaving(true)
    const id = isNew ? undefined : edit.id
    await saveQuiz({ ...edit, id })
    setSaving(false)
    setEdit(null)
    load()
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this quiz and its questions?')) return
    await deleteQuiz(id)
    load()
  }

  const toggleStatus = async (q) => {
    await saveQuiz({ ...q, status: q.status === 'published' ? 'unpublished' : 'published' })
    load()
  }

  // question editing helpers
  const setQ = (idx, patch) => {
    setEdit((e) => {
      const questions = e.questions.map((qq, i) => (i === idx ? { ...qq, ...patch } : qq))
      return { ...e, questions }
    })
  }
  const addQuestion = () => setEdit((e) => ({ ...e, questions: [...e.questions, emptyQuestion()] }))
  const removeQuestion = (idx) => setEdit((e) => ({ ...e, questions: e.questions.filter((_, i) => i !== idx) }))

  // Gemini auto-generate questions into the current quiz being edited
  const runAi = async () => {
    setAiError('')
    if (!edit?.subjectId) { setAiError('Select a subject first.'); return }
    setAiLoading(true)
    try {
      const subjectName = subjects.find((s) => s.id === edit.subjectId)?.name || edit.subjectId
      // Adaptive difficulty: if a student is generating, base it on their performance
      let difficulty = edit.difficulty
      if (isStudent && userData?.uid) {
        const avg = await getAveragePercent(userData.uid)
        if (avg !== null) difficulty = adaptiveDifficulty(avg)
      }
      const qs = await generateQuestions({
        subject: subjectName,
        topic: aiTopic,
        count: aiCount,
        difficulty,
      })
      setEdit((e) => ({ ...e, questions: qs }))
      setAiOpen(false)
      setAiTopic('')
    } catch (err) {
      setAiError(geminiErrorMessage(err.message))
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex justify-between items-center mb-3 wrap">
        <h3>{t('manageQuizzes')} ({quizzes.length})</h3>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ {t('addQuiz')}</button>
      </div>

      {quizzes.length === 0 ? (
        <EmptyState title={t('noQuizzesAvailable')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('quizTitle')}</th>
                <th>{t('subject')}</th>
                <th>{t('difficulty')}</th>
                <th>{t('questions')}</th>
                <th>{t('status')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td style={{ fontWeight: 600 }}>{q.title}</td>
                  <td>{subjects.find((s) => s.id === q.subjectId)?.name || q.subjectId}</td>
                  <td><span className="badge badge-accent">{q.difficulty}</span></td>
                  <td>{q.questions?.length}</td>
                  <td>
                    <span className={`badge ${q.status === 'published' ? 'badge-success' : 'badge-muted'}`}>
                      {q.status === 'published' ? t('published') || 'Published' : t('unpublished')}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2 wrap">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(q)}>{t('edit')}</button>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleStatus(q)}>
                        {q.status === 'published' ? t('unpublish') : t('publish')}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(q.id)}>{t('delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor modal */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? t('addQuiz') : t('edit')}>
        {edit && (
          <div>
            {error && <Alert type="error">{error}</Alert>}
            <div className="field">
              <label>{t('quizTitle')}</label>
              <input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>{t('subject')}</label>
                <select className="select" value={edit.subjectId} onChange={(e) => setEdit({ ...edit, subjectId: e.target.value })}>
                  <option value="">Select</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t('class')}</label>
                <input className="input" value={edit.classLevel} onChange={(e) => setEdit({ ...edit, classLevel: e.target.value })} />
              </div>
              <div className="field">
                <label>{t('difficulty')}</label>
                <select className="select" value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: e.target.value })}>
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </div>
              <div className="field">
                <label>{t('timePerQuestion')}</label>
                <input className="input" type="number" value={edit.timePerQuestion} onChange={(e) => setEdit({ ...edit, timePerQuestion: Number(e.target.value) })} />
              </div>
            </div>

            <div className="flex justify-between items-center mb-3">
              <h4>Questions</h4>
              <button className="btn btn-accent btn-sm" onClick={() => { setAiOpen(true); setAiError('') }}>
                ✨ {aiLoading ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
            {edit.questions.map((qq, idx) => (
              <div key={idx} style={{ border: '1px solid var(--card-border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div className="flex justify-between items-center mb-2">
                  <strong>Q{idx + 1}</strong>
                  <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(idx)}>{t('delete')}</button>
                </div>
                <div className="field">
                  <input className="input" placeholder="Question" value={qq.question}
                    onChange={(e) => setQ(idx, { question: e.target.value })} />
                </div>
                {qq.options.map((opt, oi) => (
                  <div key={oi} className="field" style={{ marginBottom: 8 }}>
                    <div className="flex gap-2 items-center">
                      <input type="radio" name={`correct-${idx}`} checked={qq.correctAnswer === oi}
                        onChange={() => setQ(idx, { correctAnswer: oi })} />
                      <input className="input" placeholder={`Option ${String.fromCharCode(65 + oi)}`} value={opt}
                        onChange={(e) => setQ(idx, { options: qq.options.map((x, xi) => (xi === oi ? e.target.value : x)) })} />
                    </div>
                  </div>
                ))}
                <div className="field">
                  <textarea className="textarea" placeholder="Explanation" value={qq.explanation}
                    onChange={(e) => setQ(idx, { explanation: e.target.value })} />
                </div>
              </div>
            ))}
            <button className="btn btn-outline btn-block" onClick={addQuestion}>+ Add Question</button>

            <div className="flex gap-2 mt-3" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setEdit(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Gemini AI generator modal */}
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="✨ Generate Questions with AI">
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 14 }}>
          Uses Google Gemini to auto-create {aiCount} multiple-choice questions for the current subject & difficulty.
        </p>
        {!isGeminiConfigured && (
          <Alert type="info">
            Gemini API key is not set. Add <code>VITE_GEMINI_API_KEY</code> to your .env file (get one free at aistudio.google.com/apikey).
          </Alert>
        )}
        {aiError && <Alert type="error">{aiError}</Alert>}
        <div className="field">
          <label>Topic (optional)</label>
          <input className="input" placeholder="e.g. Laws of Motion, Photosynthesis" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
        </div>
        <div className="field">
          <label>Number of questions</label>
          <select className="select" value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-2" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={() => setAiOpen(false)} disabled={aiLoading}>{t('cancel')}</button>
          <button className="btn btn-accent" onClick={runAi} disabled={aiLoading}>
            {aiLoading ? <span className="spinner" style={{ width: 16, height: 16 }}></span> : 'Generate'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
