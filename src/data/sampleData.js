// ============================================================
// SAMPLE DATA for REAL EDUCATION TIME
// Each subject has 30 questions (60s per question = 30 min quiz).
// ============================================================

import { physics30 } from './physics30'
import { chemistry30 } from './chemistry30'
import { biology30 } from './biology30'
import { math30 } from './math30'
import { computer30 } from './computer30'
import { gk30 } from './gk30'

function convert(subject) {
  return {
    id: subject.id,
    subjectId: subject.subjectId,
    title: subject.title,
    titleHi: subject.titleHi,
    classLevel: subject.classLevel,
    difficulty: subject.difficulty,
    timePerQuestion: subject.timePerQuestion,
    status: subject.status,
    questions: subject.questions.map((x) => ({
      question: x.q,
      questionHi: x.qh,
      options: x.o,
      optionsHi: x.oh,
      correctAnswer: x.a,
      explanation: x.e,
      explanationHi: x.eh,
    })),
  }
}

export const quizzes = [
  convert(physics30),
  convert(chemistry30),
  convert(biology30),
  convert(math30),
  convert(computer30),
  convert(gk30),
]

export const subjects = [
  { id: 'physics', name: 'Physics', icon: '⚛️', description: 'Laws of nature, motion, energy and matter.', quizzes: 1, questions: 30, difficulty: 'Medium' },
  { id: 'chemistry', name: 'Chemistry', icon: '🧪', description: 'Elements, compounds, reactions and the periodic table.', quizzes: 1, questions: 30, difficulty: 'Medium' },
  { id: 'biology', name: 'Biology', icon: '🧬', description: 'Living organisms, cells, and life processes.', quizzes: 1, questions: 30, difficulty: 'Medium' },
  { id: 'mathematics', name: 'Mathematics', icon: '📐', description: 'Numbers, algebra, geometry and problem solving.', quizzes: 1, questions: 30, difficulty: 'Medium' },
  { id: 'computer', name: 'Computer', icon: '💻', description: 'Computers, programming, and technology basics.', quizzes: 1, questions: 30, difficulty: 'Medium' },
  { id: 'general-knowledge', name: 'General Knowledge', icon: '🌍', description: 'Facts about the world, space, history and more.', quizzes: 1, questions: 30, difficulty: 'Medium' },
]

export const getSubjectStats = (subjectId) => {
  const subjectQuizzes = quizzes.filter((q) => q.subjectId === subjectId)
  const questionCount = subjectQuizzes.reduce((sum, q) => sum + q.questions.length, 0)
  return { quizzes: subjectQuizzes.length, questions: questionCount }
}

export const gradeFor = (percentage) => {
  if (percentage >= 85) return { grade: 'A', label: 'Excellent performance' }
  if (percentage >= 60) return { grade: 'B', label: 'Good performance' }
  return { grade: 'C', label: 'Needs improvement' }
}
