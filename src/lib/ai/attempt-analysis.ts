import { z } from "zod";
import { ApiError } from "@/lib/api";
import { getAiConfig, type AiConfig } from "@/lib/ai/config";
import { fetchJson } from "@/lib/ai/providers";
import { prisma } from "@/lib/db";
import { buildEvidenceSummary, computeAttemptMetrics, type AttemptMetrics } from "@/lib/performance";
import { getAttemptResult } from "@/lib/queries";

/**
 * Real, stored AI analysis of a submitted attempt.
 *
 * Flow: attempt evidence (database) → deterministic metrics → small validated
 * evidence summary → AI provider (Mesh or grounded fallback) → schema-validated
 * JSON → persisted once per attempt and reused afterwards (cost guard).
 */

export const ATTEMPT_ANALYSIS_PROMPT_VERSION = "attempt-analysis-v1";
export const DAILY_ANALYSIS_LIMIT = 20;

export const attemptAnalysisSchema = z.object({
  headline: z.string().trim().min(8).max(180),
  summary: z.string().trim().min(40).max(1_500),
  strengths: z.array(z.string().trim().min(4).max(320)).min(1).max(3),
  gaps: z.array(z.string().trim().min(4).max(320)).min(1).max(3),
  nextSteps: z.array(z.string().trim().min(4).max(320)).min(2).max(4),
  studyPlan: z
    .array(z.object({ day: z.string().trim().min(2).max(40), focus: z.string().trim().min(4).max(240) }))
    .min(2)
    .max(4),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  evidenceNote: z.string().trim().min(10).max(400),
});

export type AttemptAnalysis = z.infer<typeof attemptAnalysisSchema>;
export type AnalysisLanguage = "ENGLISH" | "HINDI" | "HINGLISH";

export const analysisResponseSchema = z.object({
  analysis: attemptAnalysisSchema,
  metrics: z.object({
    percentage: z.number(),
    accuracy: z.number(),
    correctCount: z.number(),
    incorrectCount: z.number(),
    skippedCount: z.number(),
    questionCount: z.number(),
    averageSeconds: z.number(),
    observations: z.array(z.string()),
    topics: z.array(
      z.object({
        topicId: z.string(),
        topicTitle: z.string(),
        subject: z.string(),
        accuracy: z.number(),
        total: z.number(),
        averageSeconds: z.number(),
      }),
    ),
    difficulty: z.array(z.object({ level: z.string(), accuracy: z.number(), total: z.number(), averageSeconds: z.number() })),
  }),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  cached: z.boolean(),
  generatedAt: z.string(),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

const PATTERN_TEXT: Record<string, { en: string; hi: string; hinglish: string }> = {
  SKIPPED_QUESTIONS: {
    en: "Some questions were left unanswered — a cue that those topics were not recognised quickly.",
    hi: "कुछ प्रश्न अनुत्तरित रह गए — इससे पता चलता है कि उन विषयों की पहचान तुरंत नहीं हो पाई।",
    hinglish: "Kuch questions chhoot gaye — iska matlab un topics ko turant pehchaan nahi paye.",
  },
  SLOW_ON_WRONG: {
    en: "Wrong answers took noticeably longer than correct ones, so the concept is being recalled slowly rather than applied.",
    hi: "गलत उत्तरों में सही उत्तरों से अधिक समय लगा, यानी अवधारणा लागू करने में समय लग रहा है।",
    hinglish: "Galat answers par zyada time laga — concept apply karne mein time lag raha hai.",
  },
  GUESSING_RISK: {
    en: "A few answers were submitted within seconds, which usually means guessing instead of reasoning.",
    hi: "कुछ उत्तर कुछ ही सेकंड में दिए गए, जो सोचने की जगह अनुमान का संकेत है।",
    hinglish: "Kuch answers seconds mein de diye — yeh guessing ka signal hai.",
  },
  HARD_LEVEL_GAP: {
    en: "Easy questions were handled well but hard questions dropped sharply — the gap is depth, not basics.",
    hi: "आसान प्रश्न ठीक रहे पर कठिन प्रश्नों में अंतर है — कमी गहराई की है, मूल बातों की नहीं।",
    hinglish: "Easy questions theek the, hard questions mein difference — depth ki kami hai.",
  },
  UNEVEN_TOPICS: {
    en: "Performance varied a lot between topics, so revision should be targeted rather than broad.",
    hi: "विषयों के बीच प्रदर्शन में बड़ा अंतर है, इसलिए दोहराव लक्षित होना चाहिए।",
    hinglish: "Topics ke beech performance mein bada farak hai — revision targeted hona chahiye.",
  },
  INCOMPLETE_ATTEMPT: {
    en: "A large share of the paper was skipped, so accuracy numbers are less reliable until it is attempted fully.",
    hi: "पेपर का बड़ा हिस्सा छूटा, इसलिए पूरा प्रयास करने तक सटीकता के आँकड़े कम भरोसेमंद हैं।",
    hinglish: "Paper ka bada hissa chhoota, isliye poore attempt tak accuracy numbers kam bharosemand hain.",
  },
  CONSISTENT_EFFORT: {
    en: "Accuracy and pace stayed steady across the paper — a stable base to build on.",
    hi: "पूरे पेपर में सटीकता और गति स्थिर रही — आगे बढ़ने के लिए स्थिर आधार।",
    hinglish: "Poore paper mein accuracy aur speed steady rahi — aage badhne ka stable base.",
  },
};

function languageOf(language: AnalysisLanguage) {
  return language === "HINDI" ? "HINDI" : language === "HINGLISH" ? "HINGLISH" : "ENGLISH";
}

function pick(language: AnalysisLanguage, values: { en: string; hi: string; hinglish: string }) {
  return language === "HINDI" ? values.hi : language === "HINGLISH" ? values.hinglish : values.en;
}

export function buildAttemptAnalysisPrompts(metrics: AttemptMetrics, language: AnalysisLanguage) {
  const evidence = buildEvidenceSummary(metrics);
  const system = [
    "You are Real Education Time's academic performance coach for Indian school students (Class 6-12, CBSE / Bihar Board / ICSE).",
    `Write in ${languageOf(language) === "HINDI" ? "Hindi" : languageOf(language) === "HINGLISH" ? "natural Hinglish" : "clear English"}.`,
    "All numbers in the EVIDENCE block are already verified from the student's own submitted attempt. Use ONLY these numbers and detected patterns. Never invent a score, topic, question, source, or statistic.",
    "Never promise or predict an exam mark, rank, or result. Frame everything as practice guidance.",
    "Be specific and encouraging but honest about weak evidence; if evidenceStrength is LOW, say the picture is still forming.",
    "Return only one JSON object with exactly these fields: headline (string), summary (string, 3-5 sentences), strengths (array of 1-3 strings), gaps (array of 1-3 strings), nextSteps (array of 2-4 concrete actions), studyPlan (array of 2-4 objects with day and focus), confidence (HIGH, MEDIUM or LOW), evidenceNote (string).",
    "Do not use markdown code fences. Keep language age-appropriate for the student.",
  ].join("\n");

  const user = JSON.stringify({ evidence, detectedPatterns: metrics.observations, requiredLanguage: languageOf(language) });
  return { system, user, version: ATTEMPT_ANALYSIS_PROMPT_VERSION };
}

export function parseAttemptAnalysis(raw: string): AttemptAnalysis {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  return attemptAnalysisSchema.parse(JSON.parse(candidate));
}

/**
 * Deterministic, evidence-only fallback used when no cloud key is configured or
 * when the provider output fails schema validation. It still analyses the real
 * attempt numbers; it simply does not use a language model.
 */
export function createLocalAttemptAnalysis(metrics: AttemptMetrics, language: AnalysisLanguage): AttemptAnalysis {
  const percentage = metrics.percentage;
  const verdict =
    percentage >= 80
      ? pick(language, { en: "strong command", hi: "मज़बूत पकड़", hinglish: "strong command" })
      : percentage >= 60
        ? pick(language, { en: "good progress", hi: "अच्छी प्रगति", hinglish: "acchi progress" })
        : percentage >= 40
          ? pick(language, { en: "the basics are building", hi: "मूल बातें बन रही हैं", hinglish: "basics ban rahe hain" })
          : pick(language, { en: "the fundamentals need attention", hi: "मूल बातों पर ध्यान चाहिए", hinglish: "fundamentals par dhyan chahiye" });

  const weakest = metrics.weakestTopic;
  const strongest = metrics.strongestTopic;
  const patterns = metrics.observations.map((code) => PATTERN_TEXT[code] ? pick(language, PATTERN_TEXT[code]) : code);

  const headline = pick(language, {
    en: `${metrics.testTitle}: ${percentage}% — ${verdict}`,
    hi: `${metrics.testTitle}: ${percentage}% — ${verdict}`,
    hinglish: `${metrics.testTitle}: ${percentage}% — ${verdict}`,
  });

  const paceNote = pick(language, {
    en: `Average time per question was ${metrics.averageSeconds}s, with ${metrics.pace.wrongAverageSeconds}s on wrong answers against ${metrics.pace.correctAverageSeconds}s on correct ones.`,
    hi: `प्रति प्रश्न औसतन ${metrics.averageSeconds} सेकंड लगे; गलत उत्तरों पर ${metrics.pace.wrongAverageSeconds} सेकंड और सही उत्तरों पर ${metrics.pace.correctAverageSeconds} सेकंड।`,
    hinglish: `Har question par average ${metrics.averageSeconds}s laga; galat answers par ${metrics.pace.wrongAverageSeconds}s aur sahi answers par ${metrics.pace.correctAverageSeconds}s.`,
  });

  const summary = [
    pick(language, {
      en: `You scored ${metrics.score}/${metrics.maxScore} (${percentage}%) with ${metrics.accuracy}% accuracy on ${metrics.questionCount} questions.`,
      hi: `आपने ${metrics.questionCount} प्रश्नों में ${metrics.score}/${metrics.maxScore} (${percentage}%) अंक पाए और सटीकता ${metrics.accuracy}% रही।`,
      hinglish: `Aapne ${metrics.questionCount} questions mein ${metrics.score}/${metrics.maxScore} (${percentage}%) score kiya aur accuracy ${metrics.accuracy}% rahi.`,
    }),
    paceNote,
    weakest
      ? pick(language, {
          en: `Accuracy was lowest in ${weakest.topicTitle} (${weakest.accuracy}% of ${weakest.total} questions) and highest in ${strongest?.topicTitle ?? weakest.topicTitle}${strongest ? ` (${strongest.accuracy}%)` : ""}.`,
          hi: `सबसे कम सटीकता ${weakest.topicTitle} में (${weakest.total} प्रश्नों में ${weakest.accuracy}%) और सबसे अधिक ${strongest?.topicTitle ?? weakest.topicTitle} में ${strongest ? `(${strongest.accuracy}%)` : ""} रही।`,
          hinglish: `Sabse kam accuracy ${weakest.topicTitle} mein (${weakest.total} questions mein ${weakest.accuracy}%) aur sabse zyada ${strongest?.topicTitle ?? weakest.topicTitle} mein ${strongest ? `(${strongest.accuracy}%)` : ""} rahi.`,
        })
      : patterns[0],
  ].join(" ");

  const strengths = [
    strongest
      ? pick(language, {
          en: `${strongest.topicTitle}: ${strongest.accuracy}% accuracy across ${strongest.total} questions.`,
          hi: `${strongest.topicTitle}: ${strongest.total} प्रश्नों में ${strongest.accuracy}% सटीकता।`,
          hinglish: `${strongest.topicTitle}: ${strongest.total} questions mein ${strongest.accuracy}% accuracy.`,
        })
      : pick(language, {
          en: "You completed a full attempt, which gives usable evidence for planning.",
          hi: "आपने पूरा प्रयास किया, जिससे योजना बनाने के लिए उपयोगी प्रमाण मिला।",
          hinglish: "Aapne poora attempt kiya — planning ke liye useful evidence mila.",
        }),
    metrics.difficulty.find((row) => row.level === "EASY" && row.accuracy >= 70)
      ? pick(language, {
          en: `Easy-level questions: ${metrics.difficulty.find((row) => row.level === "EASY")!.accuracy}% accuracy, so basic recall is in place.`,
          hi: `आसान स्तर के प्रश्न: ${metrics.difficulty.find((row) => row.level === "EASY")!.accuracy}% सटीकता, यानी मूल स्मरण ठीक है।`,
          hinglish: `Easy level questions: ${metrics.difficulty.find((row) => row.level === "EASY")!.accuracy}% accuracy — basic recall theek hai.`,
        })
      : null,
  ].filter(Boolean) as string[];

  const gaps = [
    weakest
      ? pick(language, {
          en: `${weakest.topicTitle} is the weakest topic at ${weakest.accuracy}% accuracy (${weakest.skipped} skipped).`,
          hi: `${weakest.topicTitle} सबसे कमज़ोर विषय है — ${weakest.accuracy}% सटीकता (${weakest.skipped} छोड़े गए)।`,
          hinglish: `${weakest.topicTitle} sabse weak topic hai — ${weakest.accuracy}% accuracy (${weakest.skipped} skipped).`,
        })
      : pick(language, {
          en: "Attempt a longer paper so topic-level weaknesses become visible.",
          hi: "बड़ा पेपर हल करें ताकि विषय-वार कमज़ोरी दिखे।",
          hinglish: "Bada paper attempt karein taki topic-wise weakness dikhe.",
        }),
    ...patterns.slice(0, 2),
  ].slice(0, 3);

  const nextSteps = [
    weakest
      ? pick(language, {
          en: `Revise the ${weakest.chapter} concept behind ${weakest.topicTitle} for 15 minutes using your chapter notes.`,
          hi: `${weakest.topicTitle} से जुड़ी ${weakest.chapter} की अवधारणा 15 मिनट में अध्याय नोट्स से दोहराएँ।`,
          hinglish: `${weakest.topicTitle} ke peeche ${weakest.chapter} ka concept 15 minute chapter notes se revise karein.`,
        })
      : pick(language, { en: "Revise today's chapter notes for 15 minutes.", hi: "आज के अध्याय नोट्स 15 मिनट दोहराएँ।", hinglish: "Aaj ke chapter notes 15 minute revise karein." }),
    pick(language, {
      en: "Work through two solved examples, then attempt five questions of the same type without looking at the solution.",
      hi: "दो हल किए उदाहरण देखें, फिर उसी प्रकार के पाँच प्रश्न बिना हल देखे हल करें।",
      hinglish: "Do solved examples dekhein, phir same type ke paanch questions bina solution dekhe attempt karein.",
    }),
    metrics.skippedCount > 0
      ? pick(language, {
          en: "In the next test, answer every question — mark a best guess instead of leaving blanks where there is no negative marking.",
          hi: "अगले टेस्ट में हर प्रश्न का उत्तर दें — जहाँ नेगेटिव मार्किंग नहीं है वहाँ खाली छोड़ने की जगह अनुमान लगाएँ।",
          hinglish: "Agle test mein har question attempt karein — jahan negative marking nahi hai wahan blank ke bajaye guess karein.",
        })
      : pick(language, {
          en: "Re-take this test after 48 hours and compare the accuracy in your weakest topic.",
          hi: "48 घंटे बाद यह टेस्ट दोबारा दें और सबसे कमज़ोर विषय की सटीकता की तुलना करें।",
          hinglish: "48 ghante baad yeh test dobara dein aur weakest topic ki accuracy compare karein.",
        }),
  ];

  const planTopics = metrics.topics.filter((topic) => topic.accuracy < 70).slice(0, 2);
  const planSource: Array<{ topicTitle: string } | null> = planTopics.length ? [...planTopics] : metrics.topics.slice(0, 1);
  while (planSource.length < 2) planSource.push(null);
  const studyPlan = planSource.slice(0, 3).map((topic, index) => ({
    day: pick(language, { en: `Day ${index + 1}`, hi: `दिन ${index + 1}`, hinglish: `Day ${index + 1}` }),
    focus: topic
      ? pick(language, {
          en: `${topic.topicTitle}: read the concept, then solve 5 questions and check each answer.`,
          hi: `${topic.topicTitle}: अवधारणा पढ़ें, फिर 5 प्रश्न हल करें और हर उत्तर जाँचें।`,
          hinglish: `${topic.topicTitle}: concept padhein, phir 5 questions solve karein aur har answer check karein.`,
        })
      : index === 0
        ? pick(language, {
            en: "Re-read the chapter notes of this test and write down every formula you used.",
            hi: "इस टेस्ट के अध्याय नोट्स दोबारा पढ़ें और हर प्रयुक्त सूत्र लिखें।",
            hinglish: "Is test ke chapter notes dobara padhein aur har formula likh lein.",
          })
        : pick(language, {
            en: "Re-take this test after 48 hours and compare topic-wise accuracy with this attempt.",
            hi: "48 घंटे बाद यह टेस्ट दोबारा दें और विषय-वार सटीकता की तुलना करें।",
            hinglish: "48 ghante baad yeh test dobara dein aur topic-wise accuracy compare karein.",
          }),
  }));

  return attemptAnalysisSchema.parse({
    headline,
    summary,
    strengths,
    gaps,
    nextSteps,
    studyPlan,
    confidence: metrics.confidence,
    evidenceNote: pick(language, {
      en: `Based only on your stored answers in this test (${metrics.questionCount} questions, ${metrics.topics.length} topics). This is practice guidance, not a prediction of any exam result.`,
      hi: `केवल इस टेस्ट में सहेजे गए आपके उत्तरों पर आधारित (${metrics.questionCount} प्रश्न, ${metrics.topics.length} विषय)। यह अभ्यास मार्गदर्शन है, किसी परीक्षा परिणाम की भविष्यवाणी नहीं।`,
      hinglish: `Sirf is test mein save kiye aapke answers par based (${metrics.questionCount} questions, ${metrics.topics.length} topics). Yeh practice guidance hai, exam result ki prediction nahi.`,
    }),
  });
}

type GeneratedAnalysis = { analysis: AttemptAnalysis; provider: string; model: string; tokenCount?: number };

export async function generateAttemptAnalysis(config: AiConfig, metrics: AttemptMetrics, language: AnalysisLanguage): Promise<GeneratedAnalysis> {
  if (config.provider === "LOCAL_GROUNDED") {
    return { analysis: createLocalAttemptAnalysis(metrics, language), provider: "LOCAL_GROUNDED", model: "evidence-engine-v1" };
  }

  const prompts = buildAttemptAnalysisPrompts(metrics, language);
  const baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const json = await fetchJson(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        max_tokens: 1_200,
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: prompts.user },
        ],
      }),
    },
    config.timeoutMs,
  );

  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const raw = choices?.[0]?.message?.content;
  if (!raw) throw new Error("Analysis provider returned an empty response.");
  const usage = json.usage as { total_tokens?: number } | undefined;
  return { analysis: parseAttemptAnalysis(raw), provider: config.provider, model: config.model, tokenCount: usage?.total_tokens };
}

function metricsSnapshot(metrics: AttemptMetrics) {
  return {
    percentage: metrics.percentage,
    accuracy: metrics.accuracy,
    correctCount: metrics.correctCount,
    incorrectCount: metrics.incorrectCount,
    skippedCount: metrics.skippedCount,
    questionCount: metrics.questionCount,
    averageSeconds: metrics.averageSeconds,
    observations: [...metrics.observations],
    topics: metrics.topics.map((topic) => ({
      topicId: topic.topicId,
      topicTitle: topic.topicTitle,
      subject: topic.subject,
      accuracy: topic.accuracy,
      total: topic.total,
      averageSeconds: topic.averageSeconds,
    })),
    difficulty: metrics.difficulty.map((row) => ({ level: row.level, accuracy: row.accuracy, total: row.total, averageSeconds: row.averageSeconds })),
  };
}

function toResponse(row: { payloadJson: unknown; provider: string; model: string; promptVersion: string; createdAt: Date }, cached: boolean): AnalysisResponse {
  const payload = row.payloadJson as { analysis: unknown; metrics: unknown };
  return analysisResponseSchema.parse({
    analysis: payload.analysis,
    metrics: payload.metrics,
    provider: row.provider,
    model: row.model,
    promptVersion: row.promptVersion,
    cached,
    generatedAt: row.createdAt.toISOString(),
  });
}

export async function getStoredAttemptAnalysis(attemptId: string, studentId: string) {
  return prisma.attemptAnalysis.findFirst({ where: { attemptId, studentId } });
}

export async function getStoredAnalysisResponse(attemptId: string, studentId: string): Promise<AnalysisResponse | null> {
  const stored = await getStoredAttemptAnalysis(attemptId, studentId);
  return stored ? toResponse(stored, true) : null;
}

export async function analyseAttempt(input: {
  attemptId: string;
  studentId: string;
  userId: string;
  language: AnalysisLanguage;
}): Promise<AnalysisResponse> {
  const attempt = await getAttemptResult(input.attemptId, input.studentId);
  if (!attempt) throw new ApiError(404, "ATTEMPT_NOT_FOUND", "This submitted test was not found.");

  const stored = await getStoredAttemptAnalysis(input.attemptId, input.studentId);
  if (stored) return toResponse(stored, true);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const used = await prisma.attemptAnalysis.count({ where: { studentId: input.studentId, createdAt: { gte: since } } });
  if (used >= DAILY_ANALYSIS_LIMIT) {
    throw new ApiError(429, "DAILY_ANALYSIS_LIMIT", "You have reached today's analysis limit. Please try again after 24 hours.");
  }

  const metrics = computeAttemptMetrics({
    score: attempt.score,
    maxScore: attempt.maxScore,
    accuracy: attempt.accuracy,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount,
    skippedCount: attempt.skippedCount,
    durationSeconds: attempt.durationSeconds,
    submittedAt: attempt.submittedAt,
    test: { titleEn: attempt.test.titleEn },
    answers: attempt.answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      responseSeconds: answer.responseSeconds,
      marksAwarded: answer.marksAwarded,
      selectedOptionId: answer.selectedOptionId,
      question: {
        difficulty: answer.question.difficulty,
        stemEn: answer.question.stemEn,
        topic: answer.question.topic
          ? {
              id: answer.question.topic.id,
              titleEn: answer.question.topic.titleEn,
              chapter: {
                titleEn: answer.question.topic.chapter.titleEn,
                offering: { subject: { nameEn: answer.question.topic.chapter.offering.subject.nameEn } },
              },
            }
          : null,
      },
    })),
  });

  const config = getAiConfig();
  const startedAt = Date.now();
  let providerFallback = Boolean(config.fallbackReason);
  let generated: GeneratedAnalysis;
  try {
    generated = await generateAttemptAnalysis(config, metrics, input.language);
  } catch (error) {
    if (config.provider === "LOCAL_GROUNDED") throw error;
    providerFallback = true;
    console.warn("Analysis provider failed validation or transport; using evidence-only fallback.", error instanceof Error ? error.message : "Unknown error");
    generated = { analysis: createLocalAttemptAnalysis(metrics, input.language), provider: "LOCAL_GROUNDED", model: "evidence-engine-v1" };
  }
  const latencyMs = Date.now() - startedAt;
  const snapshot = metricsSnapshot(metrics);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.attemptAnalysis.upsert({
      where: { attemptId: input.attemptId },
      update: {
        provider: generated.provider,
        model: generated.model,
        promptVersion: ATTEMPT_ANALYSIS_PROMPT_VERSION,
        payloadJson: { analysis: generated.analysis, metrics: snapshot, language: input.language, providerFallback },
        latencyMs,
      },
      create: {
        attemptId: input.attemptId,
        studentId: input.studentId,
        provider: generated.provider,
        model: generated.model,
        promptVersion: ATTEMPT_ANALYSIS_PROMPT_VERSION,
        payloadJson: { analysis: generated.analysis, metrics: snapshot, language: input.language, providerFallback },
        latencyMs,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "AI_ATTEMPT_ANALYSIS_CREATED",
        resourceType: "TestAttempt",
        resourceId: input.attemptId,
        metadataJson: {
          provider: generated.provider,
          model: generated.model,
          providerFallback,
          tokenCount: generated.tokenCount ?? null,
          latencyMs,
          evidenceStrength: metrics.confidence,
          observations: metrics.observations,
        },
      },
    });
    return created;
  });

  return toResponse(row, false);
}
