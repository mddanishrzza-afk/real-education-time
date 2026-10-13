export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type MasteryBand = "STRONG" | "NEEDS_PRACTICE" | "WEAK" | "NOT_ATTEMPTED";

export type MasteryPolicy = {
  version: string;
  learningRate: number;
  confidenceTarget: number;
  difficultyWeights: Record<Difficulty, number>;
  speedFloor: number;
  strongThreshold: number;
  weakThreshold: number;
};

export const DEFAULT_MASTERY_POLICY: MasteryPolicy = {
  version: "mastery-v1",
  learningRate: 0.28,
  confidenceTarget: 10,
  difficultyWeights: { EASY: 0.85, MEDIUM: 1, HARD: 1.15 },
  speedFloor: 0.7,
  strongThreshold: 75,
  weakThreshold: 50,
};

export type MasteryEvidence = {
  correct: boolean;
  difficulty: Difficulty;
  responseSeconds: number;
  estimatedSeconds: number;
};

export function masteryBand(score: number, evidenceCount: number, policy = DEFAULT_MASTERY_POLICY): MasteryBand {
  if (evidenceCount <= 0) return "NOT_ATTEMPTED";
  if (score >= policy.strongThreshold) return "STRONG";
  if (score < policy.weakThreshold) return "WEAK";
  return "NEEDS_PRACTICE";
}

export function updateMastery(
  previousScore: number,
  previousEvidenceCount: number,
  evidence: MasteryEvidence,
  policy = DEFAULT_MASTERY_POLICY,
) {
  const old = Math.min(1, Math.max(0, previousScore / 100));
  const nextEvidenceCount = previousEvidenceCount + 1;
  const confidence = Math.min(1, nextEvidenceCount / policy.confidenceTarget);
  const safeEstimated = Math.max(1, evidence.estimatedSeconds);
  const speedRatio = safeEstimated / Math.max(1, evidence.responseSeconds);
  const timeFactor = Math.min(1.05, Math.max(policy.speedFloor, speedRatio));
  const difficultyWeight = policy.difficultyWeights[evidence.difficulty];
  const positiveQuality = Math.min(1, difficultyWeight * timeFactor);
  const target = evidence.correct ? positiveQuality : 0;
  const effectiveRate = policy.learningRate * (0.65 + confidence * 0.35);
  const asymmetricRate = evidence.correct ? effectiveRate : effectiveRate * 0.82;
  const normalized = Math.min(1, Math.max(0, old + asymmetricRate * (target - old)));
  const score = Math.round(normalized * 1000) / 10;

  return {
    score,
    confidence: Math.round(confidence * 1000) / 1000,
    evidenceCount: nextEvidenceCount,
    band: masteryBand(score, nextEvidenceCount, policy),
    policyVersion: policy.version,
  };
}

export function nextReviewDate(score: number, from = new Date()) {
  const days = score < 40 ? 1 : score < 60 ? 3 : score < 75 ? 7 : 14;
  return new Date(from.getTime() + days * 86_400_000);
}
