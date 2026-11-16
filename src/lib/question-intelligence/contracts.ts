import { createHash } from "node:crypto";
import { z } from "zod";

export const supportedLanguageSchema = z.enum(["ENGLISH", "HINDI", "HINGLISH", "URDU", "BENGALI"]);
export const questionSourceTypeSchema = z.enum(["PYQ", "ADMIN_CREATED", "AI_GENERATED", "IMPORTED_PENDING"]);
export const licenseStatusSchema = z.enum(["VERIFIED_OPEN", "LICENSED", "FAIR_USE_REVIEW", "RESTRICTED"]);
export const questionTypeSchema = z.enum([
  "MCQ",
  "MULTIPLE_SELECT",
  "TRUE_FALSE",
  "NUMERICAL",
  "ASSERTION_REASON",
  "MATCH",
  "SHORT_ANSWER",
  "LONG_ANSWER",
]);
export const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export const contentStatusSchema = z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]);

export function isRtlLanguage(language: z.infer<typeof supportedLanguageSchema>) {
  return language === "URDU";
}

export function computeQuestionContentHash(stem: string, topicId: string, examYear?: number | null) {
  const normalized = `${stem.trim().toLowerCase().replace(/\s+/g, " ")}|${topicId}|${examYear ?? ""}`;
  return createHash("sha256").update(normalized).digest("hex");
}

export const questionSearchFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  boardId: z.string().min(1).optional(),
  academicClassId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  examYear: z.coerce.number().int().min(1950).max(2100).optional(),
  chapterId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
  language: supportedLanguageSchema.optional(),
  marks: z.coerce.number().positive().max(100).optional(),
  type: questionTypeSchema.optional(),
  sourceType: questionSourceTypeSchema.optional(),
  status: contentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type QuestionSearchFilters = z.infer<typeof questionSearchFilterSchema>;

export const questionTranslationInputSchema = z.object({
  language: supportedLanguageSchema,
  stem: z.string().trim().min(5).max(5000),
  explanation: z.string().trim().max(5000).optional(),
  markingScheme: z.string().trim().max(3000).optional(),
});

export const createQuestionInputSchema = z.object({
  topicId: z.string().min(1),
  type: questionTypeSchema,
  difficulty: difficultySchema,
  stemEn: z.string().trim().min(5).max(5000),
  explanationEn: z.string().trim().min(3).max(5000),
  marks: z.number().positive().max(100),
  negativeMarks: z.number().min(0).max(50).default(0),
  boardId: z.string().min(1).optional(),
  academicClassId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  examYear: z.number().int().min(1950).max(2100).optional(),
  paperCode: z.string().trim().max(64).optional(),
  paperSet: z.string().trim().max(32).optional(),
  questionNumber: z.string().trim().max(32).optional(),
  originalLanguage: supportedLanguageSchema.default("ENGLISH"),
  sourceType: questionSourceTypeSchema.default("IMPORTED_PENDING"),
  licenseStatus: licenseStatusSchema.default("FAIR_USE_REVIEW"),
  sourceName: z.string().trim().max(200).optional(),
  sourceDocumentUrl: z.string().url().optional(),
  translations: z.array(questionTranslationInputSchema).max(10).default([]),
});

export const verifyQuestionInputSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "NEEDS_CHANGES"]),
  notes: z.string().trim().max(1000).optional(),
  licenseStatus: licenseStatusSchema.optional(),
});

// AI-Ready Service Interfaces for Phase 2+
export interface NaturalLanguageSearchService {
  parseQueryToFilters(query: string): Promise<Partial<QuestionSearchFilters>>;
}

export interface QuestionExtractionService {
  extractFromDocument(input: { sourceUrl: string; boardId?: string }): Promise<{ batchId: string; extractedCount: number }>;
}

export interface TrendAnalysisService {
  analyzePyqTrends(input: { boardId: string; academicClassId: string; subjectId: string }): Promise<{
    highFrequencyTopics: Array<{ topicId: string; count: number }>;
  }>;
}
