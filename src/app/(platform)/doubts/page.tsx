import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DoubtTutor, type MessageMetadata } from "@/components/doubt-tutor";
import { getCurrentUser } from "@/lib/auth";
import {
  getTutorConversation,
  getTutorProviderStatus,
  listTutorConversations,
  listTutorTopics,
} from "@/lib/ai/tutor";

export const metadata: Metadata = { title: "Doubt & AI Tutor" };

export default async function DoubtsPage() {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const student = {
    userId: user.id,
    boardId: user.studentProfile.boardId,
    classId: user.studentProfile.classId,
  };
  const [topics, conversationRows] = await Promise.all([
    listTutorTopics(student),
    listTutorConversations(user.id),
  ]);
  const first = conversationRows[0]
    ? await getTutorConversation(user.id, conversationRows[0].id)
    : null;

  const initialConversations = conversationRows.map((item) => ({
    ...item,
    updatedAt: item.updatedAt.toISOString(),
  }));
  const initialConversation = first
    ? {
        id: first.id,
        messages: first.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          metadataJson: message.metadataJson as MessageMetadata | null,
          createdAt: message.createdAt.toISOString(),
        })),
      }
    : null;

  return (
    <DoubtTutor
      topics={topics}
      initialConversations={initialConversations}
      initialConversation={initialConversation}
      provider={getTutorProviderStatus()}
      preferredLanguage={user.preferredLanguage}
    />
  );
}
