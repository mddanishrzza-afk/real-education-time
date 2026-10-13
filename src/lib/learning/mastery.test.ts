import { describe, expect, it } from "vitest";
import { masteryBand, nextReviewDate, updateMastery } from "./mastery";

 describe("mastery model", () => {
  it("increases mastery after correct medium evidence", () => {
    const result = updateMastery(50, 4, { correct: true, difficulty: "MEDIUM", responseSeconds: 45, estimatedSeconds: 60 });
    expect(result.score).toBeGreaterThan(50);
    expect(result.evidenceCount).toBe(5);
  });

  it("decreases mastery after incorrect evidence", () => {
    const result = updateMastery(80, 8, { correct: false, difficulty: "HARD", responseSeconds: 80, estimatedSeconds: 70 });
    expect(result.score).toBeLessThan(80);
  });

  it("assigns explainable bands", () => {
    expect(masteryBand(80, 3)).toBe("STRONG");
    expect(masteryBand(62, 3)).toBe("NEEDS_PRACTICE");
    expect(masteryBand(30, 3)).toBe("WEAK");
    expect(masteryBand(0, 0)).toBe("NOT_ATTEMPTED");
  });

  it("schedules weak evidence sooner", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    expect(nextReviewDate(30, from).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(nextReviewDate(80, from).toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});
