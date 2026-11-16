import { describe, expect, it } from "vitest";
import {
  aiStudyRecommendationSchema,
  buildDeterministicPlan,
  computeNextRevisionSchedule,
  generateAiStudyRecommendations,
} from "@/lib/study-plan/engine";

describe("Study Plan Engine", () => {
  it("prioritizes due revisions and weak topics within available minutes", () => {
    const { tasks, rationale } = buildDeterministicPlan({
      availableMinutes: 45,
      dueRevisions: [
        {
          id: "rev-1",
          topicId: "top-1",
          topicTitle: "Linear Equations",
          subjectName: "Mathematics",
          dueAt: new Date("2026-11-15T00:00:00Z"),
          intervalDays: 1,
          repetition: 0,
        },
      ],
      topics: [
        {
          topicId: "top-2",
          topicTitle: "Quadratic Roots",
          chapterTitle: "Algebra",
          subjectId: "sub-math",
          subjectName: "Mathematics",
          masteryScore: 42,
          accuracy: 40,
          attemptsCount: 2,
        },
        {
          topicId: "top-3",
          topicTitle: "Light Reflection",
          chapterTitle: "Optics",
          subjectId: "sub-sci",
          subjectName: "Science",
          masteryScore: 85,
          accuracy: 85,
          attemptsCount: 3,
        },
      ],
    });

    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks[0].activityType).toBe("REVISION");
    expect(tasks[1].topicId).toBe("top-2");
    expect(tasks[1].activityType).toBe("CONCEPT");
    expect(rationale).toContain("due revision");
  });

  it("handles empty student history gracefully", () => {
    const { tasks } = buildDeterministicPlan({
      availableMinutes: 30,
      dueRevisions: [],
      topics: [],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].activityType).toBe("MINI_TEST");
    expect(tasks[0].topicId).toBeNull();
  });

  it("computes spaced repetition intervals for GOOD, EASY, and HARD recall", () => {
    const now = new Date("2026-11-16T00:00:00Z");
    const good1 = computeNextRevisionSchedule({ currentRepetition: 0, currentEaseFactor: 2.5, recallQuality: "GOOD", now });
    expect(good1.intervalDays).toBe(3);
    expect(good1.nextRepetition).toBe(1);

    const easy = computeNextRevisionSchedule({ currentRepetition: 1, currentEaseFactor: 2.5, recallQuality: "EASY", now });
    expect(easy.intervalDays).toBeGreaterThan(7);
    expect(easy.nextEaseFactor).toBeGreaterThan(2.5);

    const hard = computeNextRevisionSchedule({ currentRepetition: 2, currentEaseFactor: 2.5, recallQuality: "HARD", now });
    expect(hard.intervalDays).toBe(1);
    expect(hard.nextEaseFactor).toBeLessThan(2.5);
  });

  it("validates AI study recommendation schema", () => {
    const valid = aiStudyRecommendationSchema.parse({
      headline: "Focus on Algebra today",
      rationale: "Your recent accuracy in Linear Equations is 45%, so a short concept review will help.",
      priorityFocus: ["Linear Equations (45%)"],
      studyTips: ["Solve 5 practice problems after reviewing formulas."],
      confidence: "HIGH",
    });
    expect(valid.confidence).toBe("HIGH");
  });

  it("falls back to LOCAL_GROUNDED when no cloud key is configured", async () => {
    const result = await generateAiStudyRecommendations({
      studentName: "Aarav",
      className: "Class 9",
      weakTopics: [],
      dueRevisionsCount: 0,
      recentAccuracy: 0,
    });
    expect(result.provider).toBe("LOCAL_GROUNDED");
    expect(result.recommendation.priorityFocus.length).toBeGreaterThan(0);
  });
});
