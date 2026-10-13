import { ApiError } from "@/lib/api";
import { getAiConfig } from "@/lib/ai/config";
import { createLocalGroundedAnswer, generateTutorAnswer } from "@/lib/ai/providers";
import { getTutorTopics, selectGroundingContext } from "@/lib/ai/context";
import type { TutorLanguage } from "@/lib/ai/contracts";
import { prisma } from "@/lib/db";

const DAILY_MESSAGE_LIMIT = 60;
const PROMPT_VERSION = "grounded-tutor-v1";

type StudentScope = { userId: string; boardId: string | null; classId: string | null };

function requireSyllabusScope(student: StudentScope) {
  if (!student.boardId || !student.classId) {
    throw new ApiError(422, "ONBOARDING_REQUIRED", "Complete your board and class setup before using the tutor.");
  }
  return { boardId: student.boardId, classId: student.classId };
}

export function getTutorProviderStatus() {
  const config = getAiConfig();
  return {
    mode: config.provider,
    model: config.model,
    isCloud: config.provider !== "LOCAL_GROUNDED",
    label: config.provider === "LOCAL_GROUNDED" ? "Approved-content mode" : "Cloud AI + approved content",
    fallbackReason: config.fallbackReason || null,
  };
}

export async function listTutorTopics(student: StudentScope) {
  const scope = requireSyllabusScope(student);
  return getTutorTopics(scope.boardId, scope.classId);
}

export async function createTutorConversation(
  student: StudentScope,
  input: { language: TutorLanguage; topicId?: string; title?: string },
) {
  const scope = requireSyllabusScope(student);
  if (input.topicId) {
    const topics = await getTutorTopics(scope.boardId, scope.classId);
    if (!topics.some((topic) => topic.id === input.topicId)) {
      throw new ApiError(422, "TOPIC_NOT_AVAILABLE", "That topic is not available in your current syllabus.");
    }
  }

  const provider = getTutorProviderStatus();
  return prisma.aiConversation.create({
    data: {
      userId: student.userId,
      language: input.language,
      topicId: input.topicId || null,
      title: input.title?.trim() || null,
      provider: provider.mode,
      model: provider.model,
      promptVersion: PROMPT_VERSION,
    },
  });
}

export async function listTutorConversations(userId: string) {
  const rows = await prisma.aiConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 40,
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, role: true, createdAt: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title || "New doubt",
    language: row.language,
    topicId: row.topicId,
    provider: row.provider,
    updatedAt: row.updatedAt,
    messageCount: row._count.messages,
    preview: row.messages[0]?.content.slice(0, 120) || "Ask your first question",
  }));
}

export async function getTutorConversation(userId: string, conversationId: string) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "This tutor conversation was not found.");
  return conversation;
}

export async function askTutor(
  student: StudentScope,
  conversationId: string,
  question: string,
) {
  const scope = requireSyllabusScope(student);
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId: student.userId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } },
  });
  if (!conversation) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "This tutor conversation was not found.");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const usage = await prisma.aiMessage.count({
    where: { role: "USER", createdAt: { gte: since }, conversation: { userId: student.userId } },
  });
  if (usage >= DAILY_MESSAGE_LIMIT) {
    throw new ApiError(429, "DAILY_TUTOR_LIMIT", "You have reached today's tutor limit. Please continue after 24 hours.");
  }

  const context = await selectGroundingContext(scope.boardId, scope.classId, question, conversation.topicId);
  const cleanQuestion = question.trim();
  const title = cleanQuestion.replace(/\s+/g, " ").slice(0, 72);
  const userMessage = await prisma.$transaction(async (tx) => {
    const message = await tx.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: cleanQuestion,
        validationStatus: "VALIDATED",
        metadataJson: { language: conversation.language, groundedTopicId: context.topicId },
      },
    });
    await tx.aiConversation.update({
      where: { id: conversation.id },
      data: { topicId: context.topicId, title: conversation.title || title },
    });
    return message;
  });

  const config = getAiConfig();
  const providerInput = {
    question: cleanQuestion,
    language: conversation.language as TutorLanguage,
    context,
    recentMessages: conversation.messages.reverse().map((message) => ({ role: message.role, content: message.content })),
  };
  const startedAt = Date.now();
  let providerFallback = Boolean(config.fallbackReason);
  let result;
  try {
    result = await generateTutorAnswer(config, providerInput);
  } catch (error) {
    if (config.provider === "LOCAL_GROUNDED") throw error;
    providerFallback = true;
    console.warn("Cloud tutor failed validation or transport; using grounded fallback.", error instanceof Error ? error.message : "Unknown error");
    result = createLocalGroundedAnswer(providerInput);
  }

  const latencyMs = Date.now() - startedAt;
  const metadata = {
    keyPoints: result.answer.keyPoints,
    confidence: result.answer.confidence,
    sourceNote: result.answer.sourceNote,
    checkQuestion: result.answer.checkQuestion,
    providerMode: result.provider,
    model: result.model,
    groundedTopicId: context.topicId,
    groundedTopicTitle: context.topicTitleEn,
    promptVersion: PROMPT_VERSION,
    providerFallback,
  };

  const assistantMessage = await prisma.$transaction(async (tx) => {
    const message = await tx.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: result.answer.explanation,
        metadataJson: metadata,
        validationStatus: "VALIDATED",
        latencyMs,
        tokenCount: result.tokenCount,
      },
    });
    await tx.aiConversation.update({
      where: { id: conversation.id },
      data: { provider: result.provider, model: result.model, promptVersion: PROMPT_VERSION },
    });
    await tx.auditLog.create({
      data: {
        actorId: student.userId,
        action: "AI_TUTOR_RESPONSE_CREATED",
        resourceType: "AiConversation",
        resourceId: conversation.id,
        metadataJson: { provider: result.provider, groundedTopicId: context.topicId, providerFallback },
      },
    });
    return message;
  });

  return {
    userMessage,
    assistantMessage: { ...assistantMessage, metadataJson: metadata },
    usage: { used: usage + 1, limit: DAILY_MESSAGE_LIMIT },
  };
}
