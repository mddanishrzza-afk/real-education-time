import { afterEach, describe, expect, it } from "vitest";
import {
  attemptAnalysisSchema,
  buildAttemptAnalysisPrompts,
  createLocalAttemptAnalysis,
  generateAttemptAnalysis,
  parseAttemptAnalysis,
} from "@/lib/ai/attempt-analysis";
import type { AiConfig } from "@/lib/ai/config";
import { computeAttemptMetrics, type AttemptMetricsInput } from "@/lib/performance";

const attempt: AttemptMetricsInput = {
  score: 7,
  maxScore: 10,
  accuracy: 70,
  correctCount: 7,
  incorrectCount: 3,
  skippedCount: 0,
  durationSeconds: 540,
  submittedAt: new Date("2026-10-12T06:00:00.000Z"),
  test: { titleEn: "Class 9 Physics practice" },
  answers: Array.from({ length: 10 }, (_, index) => ({
    isCorrect: index < 7,
    responseSeconds: index < 7 ? 20 : 45,
    marksAwarded: index < 7 ? 1 : 0,
    selectedOptionId: index < 7 ? "option-1" : "option-2",
    question: {
      difficulty: index < 4 ? "EASY" : index < 8 ? "MEDIUM" : "HARD",
      stemEn: `Q${index + 1}`,
      topic: index < 5
        ? { id: "t-motion", titleEn: "Motion", chapter: { titleEn: "Motion & Force", offering: { subject: { nameEn: "Physics" } } } }
        : { id: "t-energy", titleEn: "Work & Energy", chapter: { titleEn: "Energy", offering: { subject: { nameEn: "Physics" } } } },
    },
  })),
};

const metrics = computeAttemptMetrics(attempt);

const originalProvider = process.env.AI_PROVIDER;
const originalKey = process.env.AI_API_KEY;

afterEach(() => {
  if (originalProvider === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = originalProvider;
  if (originalKey === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = originalKey;
});

describe("attempt analysis contract", () => {
  it("uses the real attempt numbers inside the prompt and forbids guarantees", () => {
    const prompts = buildAttemptAnalysisPrompts(metrics, "HINGLISH");
    expect(prompts.user).toContain("70%");
    expect(prompts.user).toContain("Motion");
    expect(prompts.system).toContain("Never promise or predict an exam mark");
    expect(prompts.version).toBe("attempt-analysis-v1");
  });

  it("rejects provider output that is missing required fields", () => {
    expect(() => parseAttemptAnalysis(JSON.stringify({ headline: "Too short" }))).toThrow();
  });

  it("accepts fenced JSON from a provider", () => {
    const valid = attemptAnalysisSchema.parse({
      headline: "Solid attempt with room to push",
      summary: "You scored seven of ten with steady accuracy across both topics in this attempt, and error time was higher than correct time.",
      strengths: ["Motion accuracy was high"],
      gaps: ["Work & Energy accuracy was lower"],
      nextSteps: ["Revise Work & Energy", "Attempt five calculation questions"],
      studyPlan: [
        { day: "Day 1", focus: "Revise Work & Energy with solved examples" },
        { day: "Day 2", focus: "Attempt five calculation questions on Work & Energy" },
      ],
      confidence: "MEDIUM",
      evidenceNote: "Based only on the stored answers of this test.",
    });
    const parsed = parseAttemptAnalysis("```json\n" + JSON.stringify(valid) + "\n```");
    expect(parsed.headline).toBe(valid.headline);
  });

  it("produces a valid, evidence-grounded local analysis in all three languages", () => {
    for (const language of ["ENGLISH", "HINDI", "HINGLISH"] as const) {
      const analysis = createLocalAttemptAnalysis(metrics, language);
      expect(attemptAnalysisSchema.safeParse(analysis).success).toBe(true);
      expect(analysis.summary).toContain("70%");
      expect(analysis.evidenceNote).toContain("10");
      expect(analysis.studyPlan.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("falls back to the grounded engine when no cloud key is configured", async () => {
    const config: AiConfig = { provider: "LOCAL_GROUNDED", model: "approved-content-v1", timeoutMs: 5_000, fallbackReason: "MISSING_CLOUD_KEY" };
    const generated = await generateAttemptAnalysis(config, metrics, "ENGLISH");
    expect(generated.provider).toBe("LOCAL_GROUNDED");
    expect(generated.analysis.confidence).toBe(metrics.confidence);
  });
});
