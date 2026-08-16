// ============================================================
// Gemini AI — auto-generate quiz questions
// ============================================================
// IMPORTANT (security note):
// This calls the Gemini API directly from the browser using the
// key in VITE_GEMINI_API_KEY. That key IS visible to end users,
// which is acceptable for a school/demo project. For a real
// production app, route this through a serverless function
// (Cloud Functions / Vercel function) so the key stays secret.
// ============================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

// Model to use. "gemini-flash-latest" is the alias you used in your curl.
const MODEL = 'gemini-flash-latest'
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export const isGeminiConfigured = Boolean(GEMINI_API_KEY) && !GEMINI_API_KEY.includes('dummy') && !GEMINI_API_KEY.includes('YOUR_')

// Send the key via the X-goog-api-key header (matches the working curl).
async function callGemini(prompt) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json())?.error?.message || ''
    } catch {
      /* ignore */
    }
    console.error('Gemini HTTP', res.status, detail)
    throw new Error('gemini/request-failed')
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return text
}

// Extract the first JSON object from a model response (handles code fences).
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('gemini/bad-response')
  return JSON.parse(match[0])
}

function normalizeQuestions(raw) {
  const questions = Array.isArray(raw) ? raw : []
  if (questions.length === 0) throw new Error('gemini/bad-response')
  return questions.map((q) => ({
    question: String(q.question || '').trim(),
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['', '', '', ''],
    correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
    explanation: String(q.explanation || '').trim(),
  }))
}

/**
 * Generate a set of MCQ questions using Gemini.
 * Returns an array of { question, options[4], correctAnswer (index), explanation }
 */
export async function generateQuestions({ subject, topic, count = 4, difficulty = 'Medium', classLevel }) {
  if (!isGeminiConfigured) {
    throw new Error('gemini/not-configured')
  }

  const prompt = `
You are an expert educational question generator for school students.
Create exactly ${count} multiple-choice questions for:
Class: ${classLevel ? `Class ${classLevel}` : 'school level'}
Subject: ${subject}
Topic: ${topic || 'general topics in this subject'}
Difficulty: ${difficulty}

Return ONLY valid JSON, no markdown, no code fences. Format:
{
  "questions": [
    {
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "brief explanation"
    }
  ]
}
Each question must have exactly 4 options, correctAnswer is the 0-based index of the correct option, and a short clear explanation.
`

  const text = await callGemini(prompt)
  const parsed = extractJson(text)
  return normalizeQuestions(parsed.questions)
}

/**
 * Adaptive difficulty based on student's average performance.
 * avg < 45 -> Easy, 45-70 -> Medium, >70 -> Hard
 */
export function adaptiveDifficulty(avgPercent) {
  if (avgPercent === null || avgPercent === undefined) return 'Medium'
  if (avgPercent < 45) return 'Easy'
  if (avgPercent <= 70) return 'Medium'
  return 'Hard'
}

/**
 * Generate questions in a chosen language (en/hi).
 * Reuses generateQuestions but passes a language instruction.
 */
export async function generateBilingualQuestions({ subject, topic, count = 4, difficulty = 'Medium', language = 'en', classLevel }) {
  if (!isGeminiConfigured) throw new Error('gemini/not-configured')

  const langText =
    language === 'hi'
      ? 'Write every question, option, and explanation in HINDI (Devanagari script).'
      : 'Write every question, option, and explanation in English.'

  const prompt = `
You are an expert educational question generator for school students.
Create exactly ${count} multiple-choice questions for:
Class: ${classLevel ? `Class ${classLevel}` : 'school level'}
Subject: ${subject}
Topic: ${topic || 'general topics in this subject'}
Difficulty: ${difficulty}
${langText}

Return ONLY valid JSON, no markdown, no code fences. Format:
{
  "questions": [
    {
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "brief explanation"
    }
  ]
}
Each question must have exactly 4 options, correctAnswer is the 0-based index of the correct option, and a short clear explanation.
`

  const text = await callGemini(prompt)
  const parsed = extractJson(text)
  return normalizeQuestions(parsed.questions)
}

/**
 * AI study chat — the student can ask about any topic and the AI
 * explains it like a teacher. Returns text answer.
 */
export async function studyChat({ subject, question, language = 'en', classLevel }) {
  if (!isGeminiConfigured) throw new Error('gemini/not-configured')

  const langText =
    language === 'hi'
      ? 'Answer in HINDI (Devanagari script), in a simple and friendly way suitable for a school student.'
      : 'Answer in English, in a simple and friendly way suitable for a school student.'

  const prompt = `
You are a friendly teacher on an educational platform for school students.
Class: ${classLevel ? `Class ${classLevel}` : 'school level'}
Subject: ${subject || 'General'}
The student asks: "${question}"

${langText}
Keep the answer clear, well-structured (use short paragraphs and bullet points if helpful).
Give a small "Quick tip" at the end.
Do not use markdown headings.
`

  const text = await callGemini(prompt)
  if (!text.trim()) throw new Error('gemini/bad-response')
  return text.trim()
}

// User-friendly message for Gemini errors
export function geminiErrorMessage(code) {
  switch (code) {
    case 'gemini/not-configured':
      return 'Gemini API key not set. Add VITE_GEMINI_API_KEY to your .env file.'
    case 'gemini/request-failed':
      return 'Gemini request failed. This can happen if the network is blocked (e.g. in this preview) or if the API key/quota is invalid. It will work once the app is deployed with internet access.'
    case 'gemini/bad-response':
      return 'Gemini returned an unreadable response. Please try again.'
    default:
      return 'Something went wrong with the AI generator.'
  }
}
