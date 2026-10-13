import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { GroundingContext } from "@/lib/ai/contracts";

const STOP_WORDS = new Set([
  "what", "when", "where", "which", "why", "how", "does", "this", "that", "with", "from", "into", "about", "please", "tell", "explain",
  "kya", "kaise", "kyun", "hai", "hain", "ka", "ki", "ke", "ko", "mein", "mujhe", "batao", "samjhao",
]);

function terms(value: string) {
  return [...new Set(value.toLowerCase().match(/[\p{L}\p{N}√²]+/gu) || [])]
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
    .slice(0, 30);
}

function relevanceScore(question: string, searchable: string) {
  const normalized = searchable.toLowerCase();
  return terms(question).reduce((score, term) => score + (normalized.includes(term) ? Math.min(term.length, 8) : 0), 0);
}

const contextInclude = {
  chapter: { include: { offering: { include: { subject: true } } } },
  concepts: {
    where: { status: "PUBLISHED" as const },
    orderBy: { sequence: "asc" as const },
    take: 4,
  },
  questions: {
    where: { status: "PUBLISHED" as const },
    orderBy: { updatedAt: "desc" as const },
    take: 3,
    select: {
      publicId: true,
      stemEn: true,
      stemHi: true,
      explanationEn: true,
      explanationHi: true,
      sourceName: true,
      sourceReference: true,
    },
  },
};

type TopicWithContext = Awaited<ReturnType<typeof findAccessibleTopics>>[number];

async function findAccessibleTopics(boardId: string, classId: string) {
  return prisma.topic.findMany({
    where: {
      isActive: true,
      chapter: { isActive: true, offering: { isActive: true, boardId, classId } },
      concepts: { some: { status: "PUBLISHED" } },
    },
    include: contextInclude,
    orderBy: [{ chapter: { offering: { subject: { nameEn: "asc" } } } }, { chapter: { sequence: "asc" } }, { sequence: "asc" }],
    take: 100,
  });
}

function toGroundingContext(topic: TopicWithContext): GroundingContext {
  return {
    topicId: topic.id,
    topicTitleEn: topic.titleEn,
    topicTitleHi: topic.titleHi,
    chapterTitleEn: topic.chapter.titleEn,
    subjectNameEn: topic.chapter.offering.subject.nameEn,
    syllabusVersion: topic.chapter.offering.syllabusVersion,
    concepts: topic.concepts.map((concept) => ({
      code: concept.code,
      titleEn: concept.titleEn,
      titleHi: concept.titleHi,
      contentEn: concept.contentEn,
      contentHi: concept.contentHi,
    })),
    reviewedExamples: topic.questions,
  };
}

export async function getTutorTopics(boardId: string, classId: string) {
  const topics = await findAccessibleTopics(boardId, classId);
  return topics.map((topic) => ({
    id: topic.id,
    titleEn: topic.titleEn,
    titleHi: topic.titleHi,
    chapterTitleEn: topic.chapter.titleEn,
    subjectNameEn: topic.chapter.offering.subject.nameEn,
  }));
}

export async function selectGroundingContext(boardId: string, classId: string, question: string, requestedTopicId?: string | null) {
  const topics = await findAccessibleTopics(boardId, classId);
  if (topics.length === 0) {
    throw new ApiError(422, "NO_APPROVED_CONTENT", "No approved learning content is available for your current class yet.");
  }

  if (requestedTopicId) {
    const requested = topics.find((topic) => topic.id === requestedTopicId);
    if (!requested) throw new ApiError(422, "TOPIC_NOT_AVAILABLE", "That topic is not available in your current syllabus.");
    return toGroundingContext(requested);
  }

  const ranked = topics
    .map((topic) => ({
      topic,
      score: relevanceScore(
        question,
        [
          topic.titleEn,
          topic.titleHi,
          topic.chapter.titleEn,
          topic.chapter.offering.subject.nameEn,
          ...topic.concepts.flatMap((concept) => [concept.titleEn, concept.titleHi, concept.contentEn, concept.contentHi]),
        ].filter(Boolean).join(" "),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  if (!ranked[0] || ranked[0].score === 0) {
    throw new ApiError(422, "TOPIC_REQUIRED", "I could not safely match this doubt to approved content. Please choose a topic and try again.");
  }
  return toGroundingContext(ranked[0].topic);
}
