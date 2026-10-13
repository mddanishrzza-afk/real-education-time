import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const captchaToken = z.string().trim().max(2_048).optional().default("");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password is too long.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/[0-9]/, "Password must include a number.");

export function ageOnDate(dateOfBirth: Date, today = new Date()) {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function parseDateOfBirth(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

const dateOfBirth = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth.")
  .refine((value) => {
    const parsed = parseDateOfBirth(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "Enter a valid date of birth.")
  .refine((value) => parseDateOfBirth(value) <= new Date(), "Date of birth cannot be in the future.")
  .refine((value) => ageOnDate(parseDateOfBirth(value)) <= 120, "Enter a valid date of birth.");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    email,
    phone: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/, "Enter a valid mobile number.").optional().or(z.literal("")),
    password,
    dateOfBirth,
    guardianEmail: z.string().trim().toLowerCase().max(254).optional().default(""),
    termsAccepted: z.literal(true, { error: "You must accept the Terms of Use." }),
    privacyAccepted: z.literal(true, { error: "You must accept the Privacy Policy." }),
    captchaToken,
  })
  .superRefine((input, context) => {
    const minor = ageOnDate(parseDateOfBirth(input.dateOfBirth)) < 18;
    if (minor) {
      const result = email.safeParse(input.guardianEmail);
      if (!result.success) {
        context.addIssue({ code: "custom", path: ["guardianEmail"], message: "A valid guardian email is required for learners under 18." });
      } else if (input.guardianEmail === input.email) {
        context.addIssue({ code: "custom", path: ["guardianEmail"], message: "Guardian email must be different from the learner email." });
      }
    }
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required.").max(72),
  captchaToken,
});

export const loginOtpSchema = z.object({
  challengeId: z.string().trim().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP."),
});

export const emailActionSchema = z.object({ email, captchaToken });
export const tokenActionSchema = z.object({ token: z.string().trim().min(32).max(512) });
export const guardianConsentSchema = z.object({
  token: z.string().trim().min(32).max(512),
  consentAccepted: z.literal(true, { error: "Guardian confirmation is required." }),
});
export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(512),
  password,
});

export const onboardingSchema = z.object({
  boardId: z.string().min(1, "Select your board."),
  classId: z.string().min(1, "Select your class."),
  preferredLanguage: z.enum(["ENGLISH", "HINDI", "HINGLISH"]),
  preparationLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  dailyStudyMinutes: z.coerce.number().int().min(15).max(480),
});

export const createPaymentOrderSchema = z.object({
  planCode: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_]+$/),
});

export const verifyPaymentSchema = z.object({
  internalOrderId: z.string().trim().min(10).max(100),
  providerPaymentId: z.string().trim().regex(/^pay_[A-Za-z0-9]+$/),
  signature: z.string().trim().regex(/^[a-f0-9]{64}$/i),
});

export const localPaymentSchema = z.object({ internalOrderId: z.string().trim().min(10).max(100) });

export const manualUpiSchema = createPaymentOrderSchema.extend({
  utr: z.string().trim().min(10).max(35).regex(/^[A-Za-z0-9]+$/, "Enter a valid UPI transaction reference."),
});

export const bankTransferSchema = createPaymentOrderSchema.extend({
  utr: z
    .string()
    .trim()
    .min(8)
    .max(35)
    .regex(/^[A-Za-z0-9]+$/, "Enter the bank reference number shown in your transfer receipt."),
});

export const manualPaymentReviewSchema = z.object({
  approved: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export const startAttemptSchema = z.object({ testId: z.string().min(1) });

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOptionId: z.string().min(1).nullable(),
        responseSeconds: z.number().int().min(0).max(86_400),
      }),
    )
    .max(300),
});

export const createTutorConversationSchema = z.object({
  language: z.enum(["ENGLISH", "HINDI", "HINGLISH"]),
  topicId: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(2).max(100).optional(),
});

export const tutorMessageSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Please enter a complete question.")
    .max(2_000, "Keep your question under 2,000 characters."),
});
