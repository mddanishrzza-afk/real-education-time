import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { askTutor, createTutorConversation, getTutorConversation } from "./tutor";

let conversationId: string | null = null;
let userId = "";
let boardId = "";
let classId = "";
let topicId = "";

beforeAll(async () => {
  process.env.AI_PROVIDER = "LOCAL_GROUNDED";
  const learner = await prisma.user.findUnique({
    where: { email: "student@realeducationtime.com" },
    include: { studentProfile: true },
  });
  if (!learner?.studentProfile?.boardId || !learner.studentProfile.classId) {
    throw new Error("Run npm run db:setup before the tutor persistence integration test.");
  }
  const topic = await prisma.topic.findFirst({
    where: {
      chapter: {
        offering: { boardId: learner.studentProfile.boardId, classId: learner.studentProfile.classId },
      },
      concepts: { some: { status: "PUBLISHED" } },
    },
  });
  if (!topic) throw new Error("The integration test needs one seeded published topic.");
  userId = learner.id;
  boardId = learner.studentProfile.boardId;
  classId = learner.studentProfile.classId;
  topicId = topic.id;
});

afterAll(async () => {
  if (conversationId) {
    await prisma.auditLog.deleteMany({ where: { resourceType: "AiConversation", resourceId: conversationId } });
    await prisma.aiConversation.deleteMany({ where: { id: conversationId } });
  }
  await prisma.$disconnect();
});

describe("tutor persistence and ownership integration", () => {
  it("persists the conversation, learner message, validated answer and audit metadata", async () => {
    const conversation = await createTutorConversation(
      { userId, boardId, classId },
      { language: "HINGLISH", topicId },
    );
    conversationId = conversation.id;

    const response = await askTutor(
      { userId, boardId, classId },
      conversation.id,
      "Please explain this topic in simple words with one example.",
    );
    expect(response.userMessage.role).toBe("USER");
    expect(response.assistantMessage.role).toBe("ASSISTANT");
    expect(response.assistantMessage.validationStatus).toBe("VALIDATED");
    expect(response.assistantMessage.metadataJson.providerMode).toBe("LOCAL_GROUNDED");

    const stored = await getTutorConversation(userId, conversation.id);
    expect(stored.messages).toHaveLength(2);
    expect(stored.title).toContain("Please explain");
    const audit = await prisma.auditLog.findFirst({
      where: { action: "AI_TUTOR_RESPONSE_CREATED", resourceId: conversation.id },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects access by a different owner", async () => {
    await expect(getTutorConversation("different-user-id", conversationId!)).rejects.toMatchObject({
      status: 404,
      code: "CONVERSATION_NOT_FOUND",
    });
  });
});
