import { describe, expect, it } from "vitest";
import {
  computeQuestionContentHash,
  createQuestionInputSchema,
  isRtlLanguage,
  questionSearchFilterSchema,
} from "@/lib/question-intelligence/contracts";

describe("Question Intelligence Contracts", () => {
  it("supports arbitrary and decimal marks", () => {
    const parsed = createQuestionInputSchema.parse({
      topicId: "top-1",
      type: "SHORT_ANSWER",
      difficulty: "MEDIUM",
      stemEn: "Explain Ohm's law with an example.",
      explanationEn: "V = IR",
      marks: 2.5,
      sourceType: "PYQ",
      examYear: 2015,
    });
    expect(parsed.marks).toBe(2.5);
    expect(parsed.sourceType).toBe("PYQ");
  });

  it("identifies Urdu as RTL and other languages as LTR", () => {
    expect(isRtlLanguage("URDU")).toBe(true);
    expect(isRtlLanguage("ENGLISH")).toBe(false);
    expect(isRtlLanguage("HINDI")).toBe(false);
    expect(isRtlLanguage("BENGALI")).toBe(false);
  });

  it("produces deterministic content hashes for duplicate detection", () => {
    const h1 = computeQuestionContentHash("  What is   Newton's second law? ", "top-1", 2020);
    const h2 = computeQuestionContentHash("what is newton's second law?", "top-1", 2020);
    const h3 = computeQuestionContentHash("what is newton's second law?", "top-1", 2021);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("validates search filters with pagination defaults", () => {
    const filters = questionSearchFilterSchema.parse({
      q: "Class 10 Mathematics 2-mark",
      examYear: "2015",
      marks: "2",
      language: "URDU",
    });
    expect(filters.examYear).toBe(2015);
    expect(filters.marks).toBe(2);
    expect(filters.language).toBe("URDU");
    expect(filters.page).toBe(1);
    expect(filters.limit).toBe(20);
  });
});
