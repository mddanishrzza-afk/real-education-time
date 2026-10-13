export type AttemptAccessSource = "TRIAL" | "ENTITLEMENT";

/**
 * An active one-hour demo intentionally permits unlimited test attempts.
 * Editorial/admin attempt caps still apply to permanently entitled learners.
 */
export function hasReachedAttemptLimit(
  maxAttempts: number | null,
  completedAttempts: number,
  accessSource: AttemptAccessSource,
) {
  if (accessSource === "TRIAL") return false;
  return maxAttempts !== null && maxAttempts > 0 && completedAttempts >= maxAttempts;
}
