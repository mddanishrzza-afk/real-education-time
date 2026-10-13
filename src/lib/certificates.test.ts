import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_PASS_FALLBACK,
  certificateEligibility,
  certificateGrade,
  certificateThreshold,
  compareRanked,
  rankFromPeers,
  rankLabel,
  roundPercentage,
} from "@/lib/certificates";

const attempt = (overrides: Partial<Parameters<typeof rankFromPeers>[0]> & { id: string }) => ({
  score: 0,
  accuracy: 0,
  submittedAt: new Date("2026-10-12T10:00:00Z"),
  ...overrides,
});

describe("certificateGrade", () => {
  it("walks the documented ladder at its boundaries", () => {
    expect(certificateGrade(100).grade).toBe("A+");
    expect(certificateGrade(90).grade).toBe("A+");
    expect(certificateGrade(89.9).grade).toBe("A");
    expect(certificateGrade(80).grade).toBe("A");
    expect(certificateGrade(70).grade).toBe("B");
    expect(certificateGrade(60).grade).toBe("C");
    expect(certificateGrade(50).grade).toBe("D");
    expect(certificateGrade(49.9).grade).toBe("E");
    expect(certificateGrade(-5).grade).toBe("E");
    expect(certificateGrade(150).grade).toBe("A+");
  });
});

describe("certificateThreshold", () => {
  it("falls back to a conservative pass mark when the test does not define one", () => {
    expect(certificateThreshold(null)).toBe(CERTIFICATE_PASS_FALLBACK);
    expect(certificateThreshold(undefined)).toBe(CERTIFICATE_PASS_FALLBACK);
    expect(certificateThreshold(0)).toBe(CERTIFICATE_PASS_FALLBACK);
    expect(certificateThreshold(Number.NaN)).toBe(CERTIFICATE_PASS_FALLBACK);
  });

  it("uses the test's own pass percentage and clamps it", () => {
    expect(certificateThreshold(33)).toBe(33);
    expect(certificateThreshold(120)).toBe(100);
  });
});

describe("certificateEligibility", () => {
  it("refuses an attempt that was never submitted", () => {
    const result = certificateEligibility({ status: "IN_PROGRESS", score: 8, maxScore: 10, passPercentage: 40 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/submit/i);
  });

  it("refuses an attempt without scored questions", () => {
    const result = certificateEligibility({ status: "SUBMITTED", score: 0, maxScore: 0, passPercentage: 40 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/no scored questions/i);
  });

  it("refuses a score below the pass mark and states the real numbers", () => {
    const result = certificateEligibility({ status: "SUBMITTED", score: 3, maxScore: 10, passPercentage: 40 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("40%");
    expect(result.reason).toContain("30%");
    expect(result.percentage).toBe(30);
  });

  it("accepts a score at or above the pass mark", () => {
    const result = certificateEligibility({ status: "SUBMITTED", score: 4, maxScore: 10, passPercentage: 40 });
    expect(result.eligible).toBe(true);
    expect(result.grade).toBe("E");
    expect(result.percentage).toBe(40);
  });
});

describe("rankFromPeers", () => {
  const peers = [
    attempt({ id: "a", score: 9, accuracy: 90 }),
    attempt({ id: "b", score: 7, accuracy: 70 }),
    attempt({ id: "c", score: 7, accuracy: 70, submittedAt: new Date("2026-10-12T11:00:00Z") }),
    attempt({ id: "mine", score: 6, accuracy: 60 }),
  ];

  it("orders by score, then accuracy, then who submitted earlier", () => {
    const ordered = [...peers].sort(compareRanked).map((item) => item.id);
    expect(ordered).toEqual(["a", "b", "c", "mine"]);
  });

  it("ranks the attempt against every submitted attempt of the test", () => {
    const rank = rankFromPeers(peers[3], peers);
    expect(rank.rank).toBe(4);
    expect(rank.total).toBe(4);
    expect(rank.sampleIsSmall).toBe(true);
  });

  it("flags a meaningful sample once enough attempts exist", () => {
    // Nine peers score 10..2, so only the ones above 4/40 outrank this attempt (p6 also holds 4/10 but with 94% accuracy).
    const many = Array.from({ length: 9 }, (_, index) => attempt({ id: `p${index}`, score: 10 - index, accuracy: 100 - index }));
    const mine = attempt({ id: "mine", score: 4, accuracy: 40 });
    const rank = rankFromPeers(mine, [...many, mine]);
    expect(rank.rank).toBe(8);
    expect(rank.total).toBe(10);
    expect(rank.sampleIsSmall).toBe(false);
    expect(rank.approximate).toBe(false);
  });

  it("never claims an exact rank when the attempt is outside the returned window", () => {
    const rank = rankFromPeers(attempt({ id: "far-away", score: 1, accuracy: 10 }), peers, 9000);
    expect(rank.approximate).toBe(true);
    expect(rankLabel(rank)).toMatch(/outside the top/i);
  });

  it("keeps the wording honest for a small sample", () => {
    expect(rankLabel(rankFromPeers(peers[3], peers))).toMatch(/small sample/i);
  });
});

describe("roundPercentage", () => {
  it("reports one decimal and clamps to 0-100", () => {
    expect(roundPercentage(66.66666)).toBe(66.7);
    expect(roundPercentage(-3)).toBe(0);
    expect(roundPercentage(140)).toBe(100);
  });
});
