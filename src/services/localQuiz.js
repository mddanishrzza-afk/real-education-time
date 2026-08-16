// ============================================================
// LOCAL Adaptive question generator (works WITHOUT internet)
// Falls back when Gemini is unavailable/blocked.
// Builds a fresh question round from the local question bank,
// shuffling questions and options so each round feels new.
// ============================================================
import { quizzes } from '../data/sampleData'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function shuffleOptions(q) {
  const order = shuffle([0, 1, 2, 3])
  const newOptions = order.map((i) => q.options[i])
  const newOptionsHi = q.optionsHi ? order.map((i) => q.optionsHi[i]) : null
  const newCorrect = order.indexOf(q.correctAnswer)
  return {
    question: q.question,
    questionHi: q.questionHi || q.question,
    options: newOptions,
    optionsHi: newOptionsHi || newOptions,
    correctAnswer: newCorrect,
    explanation: q.explanation,
    explanationHi: q.explanationHi || q.explanation,
  }
}

// Class-aware question selection from the subject's bank.
// Each class band gets a different portion of the bank, and each
// call shuffles options, so different classes see different questions.
export function questionsForClass(subjectId, classLevel) {
  const bank = quizzes.find((q) => q.subjectId === subjectId)
  if (!bank) return []
  const qs = bank.questions
  if (qs.length === 0) return []
  const num = parseInt(classLevel, 10) || 8
  const third = Math.max(1, Math.floor(qs.length / 3))
  let start = 0
  if (num <= 7) start = 0
  else if (num <= 9) start = third
  else start = third * 2

  const out = []
  for (let i = 0; i < 30; i++) {
    out.push(qs[(start + i) % qs.length])
  }
  return out.map(shuffleOptions)
}

export function generateLocalQuestions({
  subjectId,
  count = 30,
  difficulty = 'Medium',
  classLevel,
}) {
  const bank = quizzes.find((q) => q.subjectId === subjectId)
  if (!bank) throw new Error('local/no-bank')

  let questions = bank.questions.map(shuffleOptions)
  questions = shuffle(questions)
  while (questions.length < count) {
    questions = questions.concat(bank.questions.map(shuffleOptions))
  }
  questions = questions.slice(0, count)

  return {
    id: 'local-adaptive-' + Date.now(),
    subjectId,
    title: `Adaptive Round (${difficulty}) — Class ${classLevel || ''} — ${bank.title}`,
    titleHi: `अनुकूली राउंड (${difficulty}) — कक्षा ${classLevel || ''} — ${bank.titleHi}`,
    difficulty,
    timePerQuestion: 60,
    questions,
    classLevel: classLevel || '',
    isLocal: true,
  }
}
