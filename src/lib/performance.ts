import { clamp } from "@/lib/format";

/**
 * Deterministic performance metrics computed from stored attempt evidence.
 * These numbers are the only source of truth handed to the AI layer: the model
 * summarises evidence, it never invents it.
 */

export type AttemptAnswerEvidence = {
  isCorrect: boolean;
  responseSeconds: number;
  marksAwarded: number;
  selectedOptionId: string | null;
  question: {
    difficulty: string;
    stemEn: string;
    topic: {
      id: string;
      titleEn: string;
      chapter: { titleEn: string; offering: { subject: { nameEn: string } } };
    } | null;
  };
};

export type AttemptMetricsInput = {
  score: number;
  maxScore: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  durationSeconds: number;
  submittedAt: Date | string | null;
  test: { titleEn: string };
  answers: AttemptAnswerEvidence[];
};

export type TopicMetric = {
  topicId: string;
  topicTitle: string;
  subject: string;
  chapter: string;
  total: number;
  correct: number;
  skipped: number;
  accuracy: number;
  averageSeconds: number;
  slowWrongCount: number;
};

export type DifficultyMetric = {
  level: string;
  total: number;
  correct: number;
  accuracy: number;
  averageSeconds: number;
};

export type AttemptObservation =
  | "SKIPPED_QUESTIONS"
  | "SLOW_ON_WRONG"
  | "GUESSING_RISK"
  | "HARD_LEVEL_GAP"
  | "UNEVEN_TOPICS"
  | "INCOMPLETE_ATTEMPT"
  | "CONSISTENT_EFFORT";

export type AttemptMetrics = {
  testTitle: string;
  submittedAt: string | null;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  questionCount: number;
  durationSeconds: number;
  averageSeconds: number;
  pace: {
    correctAverageSeconds: number;
    wrongAverageSeconds: number;
    fastestWrongSeconds: number | null;
    slowestCorrectSeconds: number | null;
  };
  topics: TopicMetric[];
  difficulty: DifficultyMetric[];
  observations: AttemptObservation[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  strongestTopic: TopicMetric | null;
  weakestTopic: TopicMetric | null;
};

const DIFFICULTY_ORDER = ["EASY", "MEDIUM", "HARD"];
const QUICK_WRONG_SECONDS = 12;

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function computeAttemptMetrics(input: AttemptMetricsInput): AttemptMetrics {
  const answers = input.answers;
  const percentage = input.maxScore ? clamp((input.score / input.maxScore) * 100) : 0;

  const timeRows = answers.filter((answer) => answer.responseSeconds > 0);
  const correctRows = answers.filter((answer) => answer.isCorrect && answer.responseSeconds > 0);
  const wrongRows = answers.filter((answer) => !answer.isCorrect && answer.selectedOptionId && answer.responseSeconds > 0);

  const topicMap = new Map<string, TopicMetric>();
  for (const answer of answers) {
    const topic = answer.question.topic;
    if (!topic) continue;
    const current = topicMap.get(topic.id) || {
      topicId: topic.id,
      topicTitle: topic.titleEn,
      subject: topic.chapter.offering.subject.nameEn,
      chapter: topic.chapter.titleEn,
      total: 0,
      correct: 0,
      skipped: 0,
      accuracy: 0,
      averageSeconds: 0,
      slowWrongCount: 0,
    };
    current.total += 1;
    if (answer.isCorrect) current.correct += 1;
    if (!answer.selectedOptionId) current.skipped += 1;
    if (!answer.isCorrect && answer.selectedOptionId && answer.responseSeconds >= QUICK_WRONG_SECONDS * 3) {
      current.slowWrongCount += 1;
    }
    const times = answers
      .filter((row) => row.question.topic?.id === topic.id && row.responseSeconds > 0)
      .map((row) => row.responseSeconds);
    current.averageSeconds = average(times);
    current.accuracy = current.total ? Math.round((current.correct / current.total) * 100) : 0;
    topicMap.set(topic.id, current);
  }
  const topics = [...topicMap.values()].sort((a, b) => b.accuracy - a.accuracy || a.topicTitle.localeCompare(b.topicTitle));

  const difficulty = DIFFICULTY_ORDER.map((level) => {
    const rows = answers.filter((answer) => answer.question.difficulty === level);
    const timed = rows.filter((answer) => answer.responseSeconds > 0);
    return {
      level,
      total: rows.length,
      correct: rows.filter((answer) => answer.isCorrect).length,
      accuracy: rows.length ? Math.round((rows.filter((answer) => answer.isCorrect).length / rows.length) * 100) : 0,
      averageSeconds: average(timed.map((row) => row.responseSeconds)),
    };
  }).filter((row) => row.total > 0);

  const correctAverageSeconds = average(correctRows.map((row) => row.responseSeconds));
  const wrongAverageSeconds = average(wrongRows.map((row) => row.responseSeconds));
  const observations: AttemptObservation[] = [];

  if (input.skippedCount > 0) observations.push("SKIPPED_QUESTIONS");
  if (wrongRows.length >= 2 && correctAverageSeconds > 0 && wrongAverageSeconds >= correctAverageSeconds * 1.25) {
    observations.push("SLOW_ON_WRONG");
  }
  const quickWrong = wrongRows.filter((row) => row.responseSeconds <= QUICK_WRONG_SECONDS).length;
  if (quickWrong >= 2) observations.push("GUESSING_RISK");
  const easy = difficulty.find((row) => row.level === "EASY");
  const hard = difficulty.find((row) => row.level === "HARD");
  if (easy && hard && easy.total >= 2 && hard.total >= 2 && easy.accuracy - hard.accuracy >= 30) {
    observations.push("HARD_LEVEL_GAP");
  }
  if (topics.length >= 2 && topics[0].accuracy - topics[topics.length - 1].accuracy >= 40) {
    observations.push("UNEVEN_TOPICS");
  }
  if (answers.length > 0 && input.skippedCount / answers.length >= 0.2) observations.push("INCOMPLETE_ATTEMPT");
  if (!observations.length) observations.push("CONSISTENT_EFFORT");

  const answeredCount = answers.filter((answer) => answer.selectedOptionId).length;
  const confidence = answeredCount >= 15 && topics.length >= 3 ? "HIGH" : answeredCount >= 8 ? "MEDIUM" : "LOW";
  const ranked = [...topics].sort((a, b) => b.accuracy - a.accuracy);

  return {
    testTitle: input.test.titleEn,
    submittedAt: input.submittedAt ? new Date(input.submittedAt).toISOString() : null,
    score: input.score,
    maxScore: input.maxScore,
    percentage: Math.round(percentage),
    accuracy: Math.round(input.accuracy),
    correctCount: input.correctCount,
    incorrectCount: input.incorrectCount,
    skippedCount: input.skippedCount,
    questionCount: answers.length,
    durationSeconds: input.durationSeconds,
    averageSeconds: average(timeRows.map((row) => row.responseSeconds)),
    pace: {
      correctAverageSeconds,
      wrongAverageSeconds,
      fastestWrongSeconds: wrongRows.length ? Math.min(...wrongRows.map((row) => row.responseSeconds)) : null,
      slowestCorrectSeconds: correctRows.length ? Math.max(...correctRows.map((row) => row.responseSeconds)) : null,
    },
    topics,
    difficulty,
    observations,
    confidence,
    strongestTopic: ranked.length ? ranked[0] : null,
    weakestTopic: ranked.length > 1 ? ranked[ranked.length - 1] : null,
  };
}

/**
 * Compact, human-readable evidence block used inside the AI prompt. Only these
 * derived numbers are sent — never raw student identity or the whole database.
 */
export function buildEvidenceSummary(metrics: AttemptMetrics) {
  return {
    test: metrics.testTitle,
    score: `${metrics.score}/${metrics.maxScore} (${metrics.percentage}%)`,
    accuracy: `${metrics.accuracy}%`,
    answered: metrics.correctCount + metrics.incorrectCount,
    correct: metrics.correctCount,
    incorrect: metrics.incorrectCount,
    skipped: metrics.skippedCount,
    questions: metrics.questionCount,
    durationSeconds: metrics.durationSeconds,
    averageSecondsPerQuestion: metrics.averageSeconds,
    secondsOnCorrectAnswers: metrics.pace.correctAverageSeconds,
    secondsOnWrongAnswers: metrics.pace.wrongAverageSeconds,
    topics: metrics.topics.map((topic) => ({
      topic: topic.topicTitle,
      subject: topic.subject,
      chapter: topic.chapter,
      attempted: topic.total,
      accuracy: `${topic.accuracy}%`,
      skipped: topic.skipped,
      averageSeconds: topic.averageSeconds,
    })),
    difficulty: metrics.difficulty.map((row) => ({
      level: row.level,
      attempted: row.total,
      accuracy: `${row.accuracy}%`,
      averageSeconds: row.averageSeconds,
    })),
    detectedPatterns: metrics.observations,
    evidenceStrength: metrics.confidence,
  };
}
