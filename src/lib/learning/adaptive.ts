import type { Difficulty } from "./mastery";

export type AdaptiveCandidate = {
  id: string;
  topicId: string;
  difficulty: Difficulty;
  timesSeen: number;
  lastSeenAt?: Date | null;
};

export type TopicState = { topicId: string; mastery: number; confidence: number; dueForRevision?: boolean };

const difficultyLevel: Record<Difficulty, number> = { EASY: 28, MEDIUM: 58, HARD: 82 };

export function predictedSuccess(mastery: number, difficulty: Difficulty) {
  const delta = (mastery - difficultyLevel[difficulty]) / 14;
  return 1 / (1 + Math.exp(-delta));
}

/** Pure, explainable selector. Blueprint filters and permissions must be applied before calling it. */
export function selectNextQuestion(candidates: AdaptiveCandidate[], topics: TopicState[], targetSuccess = 0.72) {
  const topicMap = new Map(topics.map((topic) => [topic.topicId, topic]));
  const now = Date.now();

  const ranked = candidates.map((candidate) => {
    const topic = topicMap.get(candidate.topicId) ?? { topicId: candidate.topicId, mastery: 0, confidence: 0 };
    const success = predictedSuccess(topic.mastery, candidate.difficulty);
    const challengeFit = 1 - Math.min(1, Math.abs(success - targetSuccess));
    const learningNeed = 1 - topic.mastery / 100;
    const uncertainty = 1 - topic.confidence;
    const revisionBoost = topic.dueForRevision ? 0.2 : 0;
    const repeatPenalty = Math.min(0.55, candidate.timesSeen * 0.18);
    const recentPenalty = candidate.lastSeenAt && now - candidate.lastSeenAt.getTime() < 86_400_000 ? 0.25 : 0;
    const score = challengeFit * 0.42 + learningNeed * 0.3 + uncertainty * 0.18 + revisionBoost - repeatPenalty - recentPenalty;
    return { candidate, score, predictedSuccess: success, topic };
  });

  ranked.sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
  const selected = ranked[0];
  if (!selected) return null;

  return {
    ...selected.candidate,
    predictedSuccess: Math.round(selected.predictedSuccess * 1000) / 1000,
    reason: selected.topic.dueForRevision
      ? "REVISION_DUE"
      : selected.topic.mastery < 50
        ? "KNOWLEDGE_GAP"
        : "OPTIMAL_CHALLENGE",
  };
}
