import { z } from "zod";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";

export const notificationTypeSchema = z.enum([
  "SYSTEM",
  "STUDY_REMINDER",
  "TEST_ASSIGNED",
  "ACHIEVEMENT",
  "REPORT",
]);

export function sanitizeInternalActionUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  return trimmed.slice(0, 500);
}

export const createNotificationInputSchema = z.object({
  userId: z.string().min(1),
  type: notificationTypeSchema,
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(600),
  actionUrl: z.string().trim().max(500).optional().nullable(),
  dedupeWindowMinutes: z.number().int().min(0).max(1440).optional(),
});

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export async function createNotification(rawInput: z.infer<typeof createNotificationInputSchema>) {
  const input = createNotificationInputSchema.parse(rawInput);
  const safeActionUrl = sanitizeInternalActionUrl(input.actionUrl);

  if (input.dedupeWindowMinutes && input.dedupeWindowMinutes > 0) {
    const since = new Date(Date.now() - input.dedupeWindowMinutes * 60_000);
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        actionUrl: safeActionUrl,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) return null;
  }

  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: safeActionUrl,
    },
  });
}

export async function listNotifications(
  userId: string,
  options: { page?: number; limit?: number; unreadOnly?: boolean } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(options.unreadOnly ? { readAt: null } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    items,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const existing = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!existing) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
  if (existing.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to this notification.");
  }

  if (existing.readAt) return existing;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updatedCount: result.count };
}
