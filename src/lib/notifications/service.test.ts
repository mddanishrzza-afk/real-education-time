import { describe, expect, it } from "vitest";
import {
  createNotificationInputSchema,
  listNotificationsQuerySchema,
  sanitizeInternalActionUrl,
} from "@/lib/notifications/service";

describe("Notification Service Contracts", () => {
  it("allows safe internal action URLs and blocks open redirects", () => {
    expect(sanitizeInternalActionUrl("/study-plan")).toBe("/study-plan");
    expect(sanitizeInternalActionUrl("/results/abc-123")).toBe("/results/abc-123");
    expect(sanitizeInternalActionUrl("https://evil.com")).toBeNull();
    expect(sanitizeInternalActionUrl("//evil.com/phish")).toBeNull();
    expect(sanitizeInternalActionUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeInternalActionUrl(null)).toBeNull();
  });

  it("validates notification creation payload", () => {
    const parsed = createNotificationInputSchema.parse({
      userId: "user-1",
      type: "STUDY_REMINDER",
      title: "Study plan ready",
      message: "You have 3 tasks scheduled for today.",
      actionUrl: "/study-plan",
      dedupeWindowMinutes: 5,
    });
    expect(parsed.type).toBe("STUDY_REMINDER");
  });

  it("parses list query parameters with safe defaults", () => {
    const q = listNotificationsQuerySchema.parse({ page: "2", limit: "10", unreadOnly: "true" });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(10);
    expect(q.unreadOnly).toBe(true);
  });
});
