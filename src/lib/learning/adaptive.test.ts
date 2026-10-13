import { describe, expect, it } from "vitest";
import { predictedSuccess, selectNextQuestion } from "./adaptive";

describe("adaptive selector", () => {
  it("predicts lower success as difficulty rises", () => {
    expect(predictedSuccess(60, "EASY")).toBeGreaterThan(predictedSuccess(60, "HARD"));
  });

  it("returns a candidate with an explainable reason", () => {
    const selected = selectNextQuestion(
      [
        { id: "easy-a", topicId: "a", difficulty: "EASY", timesSeen: 0 },
        { id: "medium-b", topicId: "b", difficulty: "MEDIUM", timesSeen: 0 },
      ],
      [
        { topicId: "a", mastery: 85, confidence: 0.9 },
        { topicId: "b", mastery: 45, confidence: 0.4, dueForRevision: true },
      ],
    );
    expect(selected).not.toBeNull();
    expect(["REVISION_DUE", "KNOWLEDGE_GAP", "OPTIMAL_CHALLENGE"]).toContain(selected?.reason);
  });

  it("returns null when no eligible questions exist", () => {
    expect(selectNextQuestion([], [])).toBeNull();
  });
});
