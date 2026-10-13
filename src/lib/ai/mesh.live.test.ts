import { describe, expect, it } from "vitest";
import { tutorAnswerSchema, type ProviderRequest } from "./contracts";

/**
 * Live Mesh API (meshapi.ai) verification for the tutor provider.
 *
 * Skipped by default so the regular suite never spends credits. It runs only when a real
 * `rsk_…` inference key is present, and it reads the very same `.env` the app uses:
 *
 *   npm run test:ai:live
 *
 * The test walks the production adapter path — config → OpenAI-compatible adapter → Zod
 * contract — and only passes when the Mesh gateway itself served a schema-valid answer.
 */
if (process.env.MESH_LIVE_TEST === "1" && !process.env.AI_API_KEY?.trim()) {
  try {
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(process.cwd());
  } catch {
    // Without a loadable .env the suite below simply reports itself as skipped.
  }
}

const liveEnabled = process.env.MESH_LIVE_TEST === "1" && Boolean(process.env.AI_API_KEY?.trim());

const liveInput: ProviderRequest = {
  question: "Why does doubling speed make kinetic energy four times as large?",
  language: "HINGLISH",
  recentMessages: [],
  context: {
    topicId: "topic-energy",
    topicTitleEn: "Work & Energy",
    topicTitleHi: "कार्य और ऊर्जा",
    chapterTitleEn: "Motion, Force & Energy",
    subjectNameEn: "Science",
    syllabusVersion: "2026-foundation-v1",
    concepts: [
      {
        code: "KINETIC_ENERGY",
        titleEn: "Kinetic Energy",
        titleHi: "गतिज ऊर्जा",
        contentEn:
          "Kinetic energy is the energy of motion: KE = ½mv². Speed is squared, so doubling speed makes kinetic energy four times as large.",
        contentHi:
          "गतिज ऊर्जा गति की ऊर्जा है: KE = ½mv²। चाल दोगुनी करने पर गतिज ऊर्जा चार गुनी हो जाती है।",
      },
    ],
    reviewedExamples: [],
  },
};

describe.runIf(liveEnabled)("live Mesh API tutor provider", () => {
  it("serves a schema-valid grounded answer through the Mesh gateway", async () => {
    process.env.AI_PROVIDER = "MESH";
    const { getAiConfig } = await import("./config");
    const { generateTutorAnswer } = await import("./providers");

    const config = getAiConfig();
    expect(config.provider).toBe("MESH");
    expect(config.baseUrl).toBe("https://api.meshapi.ai/v1");

    const result = await generateTutorAnswer(config, liveInput);

    expect(result.provider).toBe("MESH");
    expect(result.model).toBe(config.model);
    expect(tutorAnswerSchema.safeParse(result.answer).success).toBe(true);
    expect(result.answer.explanation.length).toBeGreaterThan(40);
    console.info(
      `[mesh-live] provider=${result.provider} model=${result.model} tokens=${result.tokenCount ?? "n/a"}`,
    );
  }, 90_000);
});
