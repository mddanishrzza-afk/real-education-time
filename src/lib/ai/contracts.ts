import { z } from "zod";

export const tutorLanguageSchema = z.enum(["ENGLISH", "HINDI", "HINGLISH"]);

export const tutorAnswerSchema = z.object({
  explanation: z.string().trim().min(20).max(4_000),
  keyPoints: z.array(z.string().trim().min(2).max(500)).min(2).max(5),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  sourceNote: z.string().trim().min(5).max(500),
  checkQuestion: z.string().trim().min(5).max(500),
});

export type TutorAnswer = z.infer<typeof tutorAnswerSchema>;
export type TutorLanguage = z.infer<typeof tutorLanguageSchema>;

export type GroundingContext = {
  topicId: string;
  topicTitleEn: string;
  topicTitleHi: string | null;
  chapterTitleEn: string;
  subjectNameEn: string;
  syllabusVersion: string | null;
  concepts: Array<{
    code: string;
    titleEn: string;
    titleHi: string | null;
    contentEn: string | null;
    contentHi: string | null;
  }>;
  reviewedExamples: Array<{
    publicId: string;
    stemEn: string;
    stemHi: string | null;
    explanationEn: string;
    explanationHi: string | null;
    sourceName: string | null;
    sourceReference: string | null;
  }>;
};

export type ProviderRequest = {
  question: string;
  language: TutorLanguage;
  context: GroundingContext;
  recentMessages: Array<{ role: string; content: string }>;
};

export type ProviderResult = {
  answer: TutorAnswer;
  provider: string;
  model: string;
  tokenCount?: number;
};
