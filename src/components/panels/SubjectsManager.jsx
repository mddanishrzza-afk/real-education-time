// ============================================================
// Subjects Manager (Admin) — add / edit / delete subjects
// ============================================================
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { getSubjects, saveSubject, deleteSubject } from '../../services/store'
import { Modal, Alert, Spinner, EmptyState } from '../ui'

const empty = { name: '', icon: '📘', description: '', difficulty: 'Easy' }

export default function SubjectsManager() {
  const { t } = useLanguage()
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState('')

  const load = () => getSubjects().then(setSubjects).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openNew = () => { setEdit({ ...empty }); setIsNew(true); setError('') }
  const openEdit = (s) => { setEdit({ ...s }); setIsNew(false); setError('') }

  const save = async () => {
    if (!edit.name) { setError('Name is required.'); return }
    await saveSubject({ ...edit, id: isNew ? undefined : edit.id })
    setEdit(null)
    load()
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this subject?')) return
    await deleteSubject(id)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3>{t('subjects')} ({subjects.length})</h3>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ {t('addSubject')}</button>
      </div>
      {subjects.length === 0 ? (
        <EmptyState title={t('noQuizzesAvailable')} />
      ) : (
        <div className="grid grid-2">
          {subjects.map((s) => (
            <div key={s.id} className="card flex items-center gap-3">
              <div className="subj-icon" style={{ width: 50, height: 50, fontSize: 26 }}>{s.icon}</div>
              <div style={{ flex: 1 }}>
                <strong>{s.name}</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.difficulty} • {s.description}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>{t('edit')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>{t('delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? t('addSubject') : t('edit')}>
        {edit && (
          <div>
            {error && <Alert type="error">{error}</Alert>}
            <div className="field">
              <label>{t('subject')} name</label>
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Icon (emoji)</label>
              <input className="input" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea className="textarea" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('difficulty')}</label>
              <select className="select" value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: e.target.value })}>
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </div>
            <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setEdit(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save}>{t('save')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
