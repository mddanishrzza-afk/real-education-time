import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  computeQuestionContentHash,
  createQuestionInputSchema,
  isRtlLanguage,
  verifyQuestionInputSchema,
} from "@/lib/question-intelligence/contracts";
import type { z } from "zod";

export async function createOrImportQuestion(
  adminUserId: string,
  rawInput: z.infer<typeof createQuestionInputSchema>,
) {
  const input = createQuestionInputSchema.parse(rawInput);
  const contentHash = computeQuestionContentHash(input.stemEn, input.topicId, input.examYear);

  const duplicate = await prisma.question.findFirst({
    where: { contentHash },
    select: { id: true, publicId: true, status: true },
  });
  if (duplicate) {
    throw new ApiError(409, "DUPLICATE_QUESTION", `A matching question already exists (${duplicate.publicId}).`);
  }

  return prisma.question.create({
    data: {
      publicId: `Q-${randomUUID().slice(0, 8).toUpperCase()}`,
      topicId: input.topicId,
      authorId: adminUserId,
      type: input.type,
      difficulty: input.difficulty,
      status: "IN_REVIEW", // Never auto-publish imported/new questions
      stemEn: input.stemEn,
      explanationEn: input.explanationEn,
      marks: input.marks,
      negativeMarks: input.negativeMarks,
      sourceName: input.sourceName,
      sourceReference: input.sourceDocumentUrl,
      contentHash,
      metadata: {
        create: {
          boardId: input.boardId,
          academicClassId: input.academicClassId,
          subjectId: input.subjectId,
          sessionId: input.sessionId,
          examYear: input.examYear,
          paperCode: input.paperCode,
          paperSet: input.paperSet,
          questionNumber: input.questionNumber,
          originalLanguage: input.originalLanguage,
          sourceType: input.sourceType,
          licenseStatus: input.licenseStatus,
          sourceDocumentUrl: input.sourceDocumentUrl,
        },
      },
      translations: {
        create: input.translations.map((t) => ({
          language: t.language,
          stem: t.stem,
          explanation: t.explanation,
          markingScheme: t.markingScheme,
          isRtl: isRtlLanguage(t.language),
        })),
      },
    },
    include: { metadata: true, translations: true },
  });
}

export async function verifyQuestion(
  adminUserId: string,
  questionId: string,
  rawInput: z.infer<typeof verifyQuestionInputSchema>,
) {
  const input = verifyQuestionInputSchema.parse(rawInput);
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new ApiError(404, "QUESTION_NOT_FOUND", "Question not found.");

  const nextStatus =
    input.decision === "APPROVE" ? "PUBLISHED" : input.decision === "REJECT" ? "ARCHIVED" : "DRAFT";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.question.update({
      where: { id: questionId },
      data: {
        status: nextStatus,
        ...(input.decision === "APPROVE" || input.licenseStatus
          ? {
              metadata: {
                upsert: {
                  create: {
                    verifiedById: adminUserId,
                    verifiedAt: input.decision === "APPROVE" ? new Date() : null,
                    ...(input.licenseStatus ? { licenseStatus: input.licenseStatus } : {}),
                  },
                  update: {
                    verifiedById: adminUserId,
                    verifiedAt: input.decision === "APPROVE" ? new Date() : null,
                    ...(input.licenseStatus ? { licenseStatus: input.licenseStatus } : {}),
                  },
                },
              },
            }
          : {}),
      },
      include: { metadata: true, translations: true },
    });

    await tx.contentReview.create({
      data: {
        questionId,
        reviewerId: adminUserId,
        decision: input.decision,
        notes: input.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        action: `QUESTION_${input.decision}`,
        resourceType: "Question",
        resourceId: questionId,
        metadataJson: { nextStatus, notes: input.notes ?? null },
      },
    });

    return updated;
  });
}
