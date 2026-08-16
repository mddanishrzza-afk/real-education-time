// ============================================================
// Data service layer (Store)
// - When Firebase is configured: reads/writes Firestore.
// - When not configured (demo mode): uses localStorage seeded
//   from sample data so every flow is testable in the browser.
// All write functions return data so UI can update instantly.
// ============================================================
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db, isConfigured } from '../firebase/firebase'
import { subjects, quizzes } from '../data/sampleData'
import { uid } from '../utils/helpers'

// ---------- Demo-mode local persistence keys ----------
const K_RESULTS = 'ret_results'
const K_CERTS = 'ret_certs'
const K_QUIZZES = 'ret_quizzes'
const K_SUBJECTS = 'ret_subjects'

const lsGet = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
const lsSet = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* ignore */
  }
}

// ------------- SUBJECTS -------------
export async function getSubjects() {
  if (isConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'subjects'))
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      }
      // no subjects yet -> seed sample subjects
      await seedSubjects()
      return subjects
    } catch (err) {
      console.error('getSubjects fallback to sample:', err?.code || err)
      return subjects
    }
  }
  return lsGet(K_SUBJECTS, subjects)
}

export async function seedSubjects() {
  if (!isConfigured || !db) return
  for (const s of subjects) {
    await setDoc(doc(db, 'subjects', s.id), {
      name: s.name,
      icon: s.icon,
      description: s.description,
      difficulty: s.difficulty,
    })
  }
}

export async function saveSubject(subject) {
  const id = subject.id || uid('s-')
  if (isConfigured && db) {
    await setDoc(doc(db, 'subjects', id), { ...subject, id })
    return { ...subject, id }
  }
  const list = lsGet(K_SUBJECTS, subjects)
  const idx = list.findIndex((s) => s.id === id)
  if (idx >= 0) list[idx] = { ...subject, id }
  else list.push({ ...subject, id })
  lsSet(K_SUBJECTS, list)
  return { ...subject, id }
}

export async function deleteSubject(id) {
  if (isConfigured && db) {
    await deleteDoc(doc(db, 'subjects', id))
    return
  }
  const list = lsGet(K_SUBJECTS, subjects).filter((s) => s.id !== id)
  lsSet(K_SUBJECTS, list)
}

// ------------- QUIZZES -------------
export async function seedQuizzes() {
  if (!isConfigured || !db) return
  for (const q of quizzes) {
    await setDoc(doc(db, 'quizzes', q.id), {
      title: q.title,
      titleHi: q.titleHi || q.title,
      subjectId: q.subjectId,
      classLevel: q.classLevel,
      difficulty: q.difficulty,
      timePerQuestion: q.timePerQuestion,
      status: q.status,
      createdAt: serverTimestamp(),
    })
    // seed questions separately
    const questions = q.questions
    for (let i = 0; i < questions.length; i++) {
      const qq = questions[i]
      await setDoc(doc(db, 'questions', `${q.id}-q${i + 1}`), {
        quizId: q.id,
        index: i,
        question: qq.question,
        questionHi: qq.questionHi || qq.question,
        options: qq.options,
        optionsHi: qq.optionsHi || qq.options,
        correctAnswer: qq.correctAnswer,
        explanation: qq.explanation,
        explanationHi: qq.explanationHi || qq.explanation,
      })
    }
  }
}

export async function getQuizzes({ subjectId, includeUnpublished = false } = {}) {
  if (isConfigured && db) {
    try {
      let q = collection(db, 'quizzes')
      if (subjectId) {
        q = query(q, where('subjectId', '==', subjectId))
      }
      const snap = await getDocs(q)
      if (!snap.empty) {
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // attach questions from questions collection
        list = await attachQuestions(list)
        if (!includeUnpublished) list = list.filter((x) => x.status !== 'unpublished')
        return list
      }
      // nothing yet -> seed sample quizzes then return them
      await seedQuizzes()
      const snap2 = await getDocs(collection(db, 'quizzes'))
      let list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }))
      list = await attachQuestions(list)
      if (!includeUnpublished) list = list.filter((x) => x.status !== 'unpublished')
      return list
    } catch (err) {
      console.error('getQuizzes fallback to sample:', err?.code || err)
      // fall back to the FRESH 30-question sample bank so the app always shows the latest content
      let list = quizzes
      if (subjectId) list = list.filter((x) => x.subjectId === subjectId)
      if (!includeUnpublished) list = list.filter((x) => x.status !== 'unpublished')
      return list
    }
  }
  // Local path: always use the fresh sample bank (ignore stale localStorage quizzes)
  let list = quizzes
  if (subjectId) list = list.filter((q) => q.subjectId === subjectId)
  if (!includeUnpublished) list = list.filter((q) => q.status !== 'unpublished')
  return list
}

async function attachQuestions(list) {
  const qSnap = await getDocs(collection(db, 'questions'))
  const all = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return list.map((quiz) => ({
    ...quiz,
    questions: all
      .filter((qq) => qq.quizId === quiz.id)
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map((qq) => ({
        question: qq.question,
        questionHi: qq.questionHi || qq.question,
        options: qq.options,
        optionsHi: qq.optionsHi || qq.options,
        correctAnswer: qq.correctAnswer,
        explanation: qq.explanation,
        explanationHi: qq.explanationHi || qq.explanation,
      })),
  }))
}

export async function getQuizById(id) {
  if (isConfigured && db) {
    try {
      const snap = await getDoc(doc(db, 'quizzes', id))
      if (snap.exists()) {
        const quiz = { id: snap.id, ...snap.data() }
        const list = await attachQuestions([quiz])
        const withQ = list[0] || quiz
        // ensure questions array always exists
        withQ.questions = Array.isArray(withQ.questions) ? withQ.questions : []
        return withQ
      }
      // quiz not found -> try seeding sample quizzes then re-fetch
      await seedQuizzes()
      const snap2 = await getDoc(doc(db, 'quizzes', id))
      if (snap2.exists()) {
        const quiz = { id: snap2.id, ...snap2.data() }
        const list = await attachQuestions([quiz])
        const withQ = list[0] || quiz
        withQ.questions = Array.isArray(withQ.questions) ? withQ.questions : []
        return withQ
      }
      return null
    } catch (err) {
      console.error('getQuizById fallback to sample:', err?.code || err)
      // fall back to the FRESH sample quiz so the quiz always opens with latest content
      const found = quizzes.find((x) => x.id === id) || null
      if (found) found.questions = Array.isArray(found.questions) ? found.questions : []
      return found
    }
  }
  const found = quizzes.find((q) => q.id === id) || null
  if (found) found.questions = Array.isArray(found.questions) ? found.questions : []
  return found
}

export async function saveQuiz(quiz) {
  const id = quiz.id || uid('q-')
  if (isConfigured && db) {
    const { questions, ...rest } = quiz
    const data = { ...rest, id, createdAt: serverTimestamp() }
    await setDoc(doc(db, 'quizzes', id), data)
    // write questions separately
    if (Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const qq = questions[i]
        await setDoc(doc(db, 'questions', `${id}-q${i + 1}`), {
          quizId: id,
          index: i,
          question: qq.question,
          questionHi: qq.questionHi || qq.question,
          options: qq.options,
          optionsHi: qq.optionsHi || qq.options,
          correctAnswer: qq.correctAnswer,
          explanation: qq.explanation,
          explanationHi: qq.explanationHi || qq.explanation,
        })
      }
    }
    return { ...data, questions }
  }
  const list = lsGet(K_QUIZZES, quizzes)
  const idx = list.findIndex((q) => q.id === id)
  if (idx >= 0) list[idx] = { ...quiz, id }
  else list.push({ ...quiz, id })
  lsSet(K_QUIZZES, list)
  return { ...quiz, id }
}

export async function deleteQuiz(id) {
  if (isConfigured && db) {
    await deleteDoc(doc(db, 'quizzes', id))
    return
  }
  const list = lsGet(K_QUIZZES, quizzes).filter((q) => q.id !== id)
  lsSet(K_QUIZZES, list)
}

// ------------- RESULTS -------------
export async function saveResult(result) {
  const id = result.id || uid('r-')
  const docData = { ...result, id, createdAt: new Date().toISOString() }
  // Always keep a local copy so the result page works even if Firestore write fails
  const list = lsGet(K_RESULTS, [])
  list.push(docData)
  lsSet(K_RESULTS, list)
  if (isConfigured && db) {
    try {
      await setDoc(doc(db, 'results', id), docData)
    } catch (err) {
      console.error('saveResult Firestore failed (kept local):', err?.code || err)
    }
  }
  return { ...docData }
}

export async function getResultsForUser(userId) {
  const local = lsGet(K_RESULTS, []).filter((r) => r.userId === userId)
  if (isConfigured && db) {
    try {
      const q = query(collection(db, 'results'), where('userId', '==', userId))
      const snap = await getDocs(q)
      const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      // merge: prefer unique by id
      const merged = [...local, ...remote]
      const map = {}
      merged.forEach((r) => { map[r.id] = r })
      return Object.values(map).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } catch (err) {
      console.error('getResultsForUser error, using local:', err?.code || err)
      return local.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
  }
  return local.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function getAllResults() {
  const local = lsGet(K_RESULTS, [])
  if (isConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'results'))
      const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const map = {}
      ;[...local, ...remote].forEach((r) => { map[r.id] = r })
      return Object.values(map)
    } catch (err) {
      console.error('getAllResults error, using local:', err?.code || err)
      return local
    }
  }
  return local
}

// Get a user's average performance percentage (0-100). Returns null if none.
export async function getAveragePercent(userId) {
  const results = await getResultsForUser(userId)
  if (results.length === 0) return null
  const avg = results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length
  return Math.round(avg)
}

// ------------- LEADERBOARD -------------
// Computes an aggregate leaderboard from results (real data).
export async function getLeaderboard() {
  const results = await getAllResults()
  const map = {}
  for (const r of results) {
    if (!map[r.userId]) {
      map[r.userId] = {
        userId: r.userId,
        name: r.userName || 'Student',
        totalScore: 0,
        totalPercent: 0,
        count: 0,
        best: 0,
      }
    }
    map[r.userId].totalScore += r.score || 0
    map[r.userId].totalPercent += r.percentage || 0
    map[r.userId].count += 1
    map[r.userId].best = Math.max(map[r.userId].best, r.percentage || 0)
  }
  const rows = Object.values(map).map((m) => ({
    ...m,
    avgPercent: m.count ? Math.round(m.totalPercent / m.count) : 0,
  }))
  rows.sort((a, b) => b.avgPercent - a.avgPercent || b.totalScore - a.totalScore)
  return rows
}

// ------------- CERTIFICATES -------------
export async function saveCertificate(cert) {
  const id = cert.id || uid('c-')
  // Always keep local copy so certificate works even if Firestore write fails
  const list = lsGet(K_CERTS, [])
  list.push({ ...cert, id, createdAt: new Date().toISOString() })
  lsSet(K_CERTS, list)
  if (isConfigured && db) {
    try {
      await setDoc(doc(db, 'certificates', id), { ...cert, id, createdAt: new Date().toISOString() })
    } catch (err) {
      console.error('saveCertificate Firestore failed (kept local):', err?.code || err)
    }
  }
  return { ...cert, id }
}

export async function getCertificatesForUser(userId) {
  const local = lsGet(K_CERTS, []).filter((c) => c.userId === userId)
  if (isConfigured && db) {
    try {
      const q = query(collection(db, 'certificates'), where('userId', '==', userId))
      const snap = await getDocs(q)
      const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const map = {}
      ;[...local, ...remote].forEach((c) => { map[c.id] = c })
      return Object.values(map)
    } catch (err) {
      console.error('getCertificatesForUser error, using local:', err?.code || err)
      return local
    }
  }
  return local
}

export async function getAllCertificates() {
  if (isConfigured && db) {
    const snap = await getDocs(collection(db, 'certificates'))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }
  return lsGet(K_CERTS, [])
}

// ------------- USERS (admin) -------------
export async function getAllUsers() {
  if (isConfigured && db) {
    const snap = await getDocs(collection(db, 'users'))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }
  // demo: return the current demo user if any, plus sample users
  let demo = []
  try {
    const d = JSON.parse(localStorage.getItem('ret_demo_user'))
    if (d) demo = [d]
  } catch {
    demo = []
  }
  return demo
}
