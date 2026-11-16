import { z } from "zod";
import { getAiConfig, type AiProviderMode } from "@/lib/ai/config";
import { fetchJson } from "@/lib/ai/providers";

export const DEFAULT_REVISION_INTERVALS = [1, 3, 7, 14, 30] as const;

export const aiStudyRecommendationSchema = z.object({
  headline: z.string().min(4).max(160),
  rationale: z.string().min(10).max(500),
  priorityFocus: z.array(z.string().min(2).max(120)).min(1).max(4),
  studyTips: z.array(z.string().min(4).max(200)).min(1).max(4),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export type AiStudyRecommendation = z.infer<typeof aiStudyRecommendationSchema>;

export type TopicEvidence = {
  topicId: string;
  topicTitle: string;
  chapterTitle: string;
  subjectId: string;
  subjectName: string;
  masteryScore: number; // 0-100
  accuracy: number; // 0-100
  attemptsCount: number;
};

export type DueRevisionEvidence = {
  id: string;
  topicId: string;
  topicTitle: string;
  subjectName: string;
  dueAt: Date;
  intervalDays: number;
  repetition: number;
};

export type PlannedTaskDraft = {
  topicId: string | null;
  activityType: "CONCEPT" | "PRACTICE" | "REVISION" | "MINI_TEST" | "FLASHCARD";
  title: string;
  durationMinutes: number;
  questionCount: number | null;
  sequence: number;
};

export function computeNextRevisionSchedule(input: {
  currentRepetition: number;
  currentEaseFactor: number;
  recallQuality: "HARD" | "GOOD" | "EASY";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const nextRepetition = input.recallQuality === "HARD" ? Math.max(0, input.currentRepetition - 1) : input.currentRepetition + 1;
  const easeDelta = input.recallQuality === "EASY" ? 0.15 : input.recallQuality === "HARD" ? -0.2 : 0;
  const nextEaseFactor = Math.min(3.0, Math.max(1.3, Number((input.currentEaseFactor + easeDelta).toFixed(2))));

  const baseIndex = Math.min(nextRepetition, DEFAULT_REVISION_INTERVALS.length - 1);
  const baseDays = DEFAULT_REVISION_INTERVALS[baseIndex];
  const intervalDays =
    input.recallQuality === "HARD"
      ? 1
      : Math.max(1, Math.round(baseDays * (input.recallQuality === "EASY" ? 1.25 : 1)));

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return { nextRepetition, nextEaseFactor, intervalDays, dueAt };
}

export function buildDeterministicPlan(input: {
  topics: TopicEvidence[];
  dueRevisions: DueRevisionEvidence[];
  availableMinutes: number;
  focusSubjectId?: string;
}): { tasks: PlannedTaskDraft[]; rationale: string } {
  const budget = Math.min(240, Math.max(20, input.availableMinutes || 45));
  const tasks: PlannedTaskDraft[] = [];
  let remaining = budget;
  let seq = 1;

  // 1. Prioritize overdue/due spaced revisions first
  for (const rev of input.dueRevisions.slice(0, 2)) {
    if (remaining < 10) break;
    const duration = Math.min(15, remaining);
    tasks.push({
      topicId: rev.topicId,
      activityType: "REVISION",
      title: `Revise ${rev.topicTitle} (${rev.subjectName})`,
      durationMinutes: duration,
      questionCount: 5,
      sequence: seq++,
    });
    remaining -= duration;
  }

  // 2. Sort topics by weakest mastery first, optionally boosting focusSubjectId
  const sortedTopics = [...input.topics].sort((a, b) => {
    const aBoost = input.focusSubjectId && a.subjectId === input.focusSubjectId ? -15 : 0;
    const bBoost = input.focusSubjectId && b.subjectId === input.focusSubjectId ? -15 : 0;
    return a.masteryScore + aBoost - (b.masteryScore + bBoost);
  });

  for (const topic of sortedTopics) {
    if (remaining < 10 || tasks.length >= 6) break;
    if (tasks.some((t) => t.topicId === topic.topicId)) continue;

    const isWeak = topic.masteryScore < 60;
    const duration = Math.min(isWeak ? 20 : 15, remaining);
    tasks.push({
      topicId: topic.topicId,
      activityType: isWeak ? "CONCEPT" : "PRACTICE",
      title: isWeak
        ? `Strengthen ${topic.topicTitle} (${topic.subjectName})`
        : `Practice ${topic.topicTitle} (${topic.subjectName})`,
      durationMinutes: duration,
      questionCount: isWeak ? 6 : 10,
      sequence: seq++,
    });
    remaining -= duration;
  }

  // 3. Fallback if student has no topic evidence yet
  if (tasks.length === 0) {
    tasks.push({
      topicId: null,
      activityType: "MINI_TEST",
      title: "Take a diagnostic test to calibrate your study plan",
      durationMinutes: Math.min(25, budget),
      questionCount: 10,
      sequence: 1,
    });
  }

  const weakCount = sortedTopics.filter((t) => t.masteryScore < 60).length;
  const rationale =
    input.dueRevisions.length > 0
      ? `Prioritized ${Math.min(2, input.dueRevisions.length)} due revision(s) and ${weakCount} weak topic(s) within your ${budget}-minute daily budget.`
      : weakCount > 0
        ? `Focused on ${weakCount} topic(s) below 60% mastery within your ${budget}-minute daily budget.`
        : `Balanced practice plan within your ${budget}-minute daily budget.`;

  return { tasks, rationale };
}

export async function generateAiStudyRecommendations(input: {
  studentName: string;
  className: string;
  weakTopics: TopicEvidence[];
  dueRevisionsCount: number;
  recentAccuracy: number;
}): Promise<{ recommendation: AiStudyRecommendation; provider: AiProviderMode; model: string }> {
  const config = getAiConfig();

  const deterministicFallback = (): AiStudyRecommendation => {
    const topWeak = input.weakTopics.slice(0, 3).map((t) => `${t.topicTitle} (${Math.round(t.masteryScore)}%)`);
    return {
      headline:
        topWeak.length > 0
          ? `Focus on ${input.weakTopics[0].topicTitle} today`
          : "Build your baseline with a short practice session",
      rationale:
        topWeak.length > 0
          ? `Based on your recent ${Math.round(input.recentAccuracy)}% accuracy and ${input.dueRevisionsCount} pending revision(s), strengthening weaker topics first will yield the fastest improvement.`
          : "Complete a diagnostic or chapter practice set so we can tailor recommendations to your actual performance.",
      priorityFocus: topWeak.length > 0 ? topWeak : ["Complete foundation diagnostic"],
      studyTips: [
        "Review core concepts before attempting timed practice questions.",
        "Complete due spaced-revision items to lock in long-term recall.",
      ],
      confidence: input.weakTopics.length > 0 ? "HIGH" : "LOW",
    };
  };

  if (config.provider === "LOCAL_GROUNDED" || !config.apiKey) {
    return { recommendation: deterministicFallback(), provider: "LOCAL_GROUNDED", model: config.model };
  }

  const systemPrompt = [
    "You are Real Education Time's academic study planner.",
    "Use ONLY the provided student evidence. Never invent scores, topics, or history.",
    "Return ONLY a JSON object with fields: headline (string), rationale (string), priorityFocus (array of 1-4 strings), studyTips (array of 1-4 strings), confidence ('HIGH' | 'MEDIUM' | 'LOW').",
  ].join("\n");

  const userPrompt = JSON.stringify({
    className: input.className,
    recentAccuracy: Math.round(input.recentAccuracy),
    dueRevisionsCount: input.dueRevisionsCount,
    weakTopics: input.weakTopics.slice(0, 5).map((t) => ({
      topic: t.topicTitle,
      subject: t.subjectName,
      masteryScore: Math.round(t.masteryScore),
    })),
  });

  try {
    let rawText = "";
    if (config.provider === "GEMINI") {
      const baseUrl = (config.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
      const json = await fetchJson(
        `${baseUrl}/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
          }),
        },
        config.timeoutMs,
      );
      const candidates = json.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
      rawText = candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      const baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
      const json = await fetchJson(
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.2,
            max_tokens: 500,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        },
        config.timeoutMs,
      );
      const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
      rawText = choices?.[0]?.message?.content || "";
    }

    const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const parsed = aiStudyRecommendationSchema.parse(JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned));
    return { recommendation: parsed, provider: config.provider, model: config.model };
  } catch {
    return { recommendation: deterministicFallback(), provider: "LOCAL_GROUNDED", model: "deterministic-fallback" };
  }
}
