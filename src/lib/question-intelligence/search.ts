import { prisma } from "@/lib/db";
import type { QuestionSearchFilters } from "@/lib/question-intelligence/contracts";

export async function searchQuestions(filters: QuestionSearchFilters, options: { isAdmin: boolean }) {
  const skip = (filters.page - 1) * filters.limit;

  const metadataWhere: Record<string, unknown> = {};
  if (filters.boardId) metadataWhere.boardId = filters.boardId;
  if (filters.academicClassId) metadataWhere.academicClassId = filters.academicClassId;
  if (filters.subjectId) metadataWhere.subjectId = filters.subjectId;
  if (filters.sessionId) metadataWhere.sessionId = filters.sessionId;
  if (filters.examYear) metadataWhere.examYear = filters.examYear;
  if (filters.sourceType) metadataWhere.sourceType = filters.sourceType;
  if (!options.isAdmin) {
    metadataWhere.licenseStatus = { in: ["VERIFIED_OPEN", "LICENSED", "FAIR_USE_REVIEW"] };
  }

  const where: Record<string, unknown> = {
    status: options.isAdmin && filters.status ? filters.status : "PUBLISHED",
    ...(filters.topicId ? { topicId: filters.topicId } : {}),
    ...(filters.chapterId ? { topic: { chapterId: filters.chapterId } } : {}),
    ...(filters.marks ? { marks: filters.marks } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.q
      ? {
          OR: [
            { stemEn: { contains: filters.q } },
            { stemHi: { contains: filters.q } },
            { translations: { some: { stem: { contains: filters.q } } } },
          ],
        }
      : {}),
    ...(filters.language ? { translations: { some: { language: filters.language } } } : {}),
    ...(Object.keys(metadataWhere).length > 0 ? { metadata: { is: metadataWhere } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { createdAt: "desc" },
      include: {
        topic: {
          select: {
            id: true,
            titleEn: true,
            chapter: {
              select: {
                id: true,
                titleEn: true,
                offering: {
                  select: {
                    board: { select: { id: true, nameEn: true, code: true } },
                    academicClass: { select: { id: true, nameEn: true } },
                    subject: { select: { id: true, nameEn: true } },
                  },
                },
              },
            },
          },
        },
        metadata: true,
        translations: true,
      },
    }),
    prisma.question.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}
