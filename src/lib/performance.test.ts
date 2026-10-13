import { describe, expect, it } from "vitest";
import { buildEvidenceSummary, computeAttemptMetrics, type AttemptMetricsInput } from "@/lib/performance";

function answer(overrides: Partial<AttemptMetricsInput["answers"][number]> & { topicId: string; title: string }) {
  return {
    isCorrect: true,
    responseSeconds: 20,
    marksAwarded: 1,
    selectedOptionId: "option-1",
    question: {
      difficulty: overrides.question?.difficulty ?? "EASY",
      stemEn: `Question on ${overrides.title}`,
      topic: {
        id: overrides.topicId,
        titleEn: overrides.title,
        chapter: { titleEn: "Chapter 1", offering: { subject: { nameEn: "Science" } } },
      },
    },
    ...overrides,
  };
}

const base: AttemptMetricsInput = {
  score: 4,
  maxScore: 10,
  accuracy: 40,
  correctCount: 4,
  incorrectCount: 2,
  skippedCount: 1,
  durationSeconds: 600,
  submittedAt: new Date("2026-10-12T06:00:00.000Z"),
  test: { titleEn: "Class 9 Science diagnostic" },
  answers: [
    answer({ topicId: "t-motion", title: "Motion", isCorrect: true, responseSeconds: 18 }),
    answer({ topicId: "t-motion", title: "Motion", isCorrect: true, responseSeconds: 22 }),
    answer({ topicId: "t-motion", title: "Motion", isCorrect: true, responseSeconds: 20 }),
    answer({ topicId: "t-force", title: "Force", isCorrect: true, responseSeconds: 24 }),
    answer({ topicId: "t-force", title: "Force", isCorrect: false, selectedOptionId: "option-2", responseSeconds: 55 }),
    answer({ topicId: "t-force", title: "Force", isCorrect: false, selectedOptionId: "option-3", responseSeconds: 61 }),
    answer({ topicId: "t-work", title: "Work & Energy", isCorrect: false, selectedOptionId: null, responseSeconds: 0 }),
  ],
};

describe("attempt performance metrics", () => {
  it("builds topic, difficulty and pace evidence from the stored attempt", () => {
    const metrics = computeAttemptMetrics(base);
    expect(metrics.percentage).toBe(40);
    expect(metrics.questionCount).toBe(7);
    expect(metrics.pace.correctAverageSeconds).toBe(21);
    expect(metrics.pace.wrongAverageSeconds).toBe(58);
    expect(metrics.strongestTopic?.topicTitle).toBe("Motion");
    expect(metrics.weakestTopic?.topicTitle).toBe("Work & Energy");
    expect(metrics.topics.find((topic) => topic.topicTitle === "Force")).toMatchObject({ total: 3, correct: 1, accuracy: 33 });
  });

  it("flags slow wrong answers and skipped questions as observable patterns", () => {
    const metrics = computeAttemptMetrics(base);
    expect(metrics.observations).toContain("SKIPPED_QUESTIONS");
    expect(metrics.observations).toContain("SLOW_ON_WRONG");
    expect(metrics.observations).not.toContain("CONSISTENT_EFFORT");
  });

  it("keeps evidence strength low when very few questions were answered", () => {
    const metrics = computeAttemptMetrics({ ...base, answers: base.answers.slice(0, 3), skippedCount: 0 });
    expect(metrics.confidence).toBe("LOW");
    expect(metrics.observations).toContain("CONSISTENT_EFFORT");
  });

  it("summarises only derived evidence for the AI layer", () => {
    const summary = buildEvidenceSummary(computeAttemptMetrics(base));
    expect(summary).toMatchObject({ accuracy: "40%", skipped: 1, questions: 7, evidenceStrength: "LOW" });
    expect(JSON.stringify(summary)).not.toContain("studentId");
  });
});
