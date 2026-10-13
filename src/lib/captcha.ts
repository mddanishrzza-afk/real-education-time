import { ApiError, getClientIp } from "@/lib/api";

type TurnstileResponse = {
  success: boolean;
  hostname?: string;
  "error-codes"?: string[];
};

/** Verify a Cloudflare Turnstile token. Production always fails closed. */
export async function verifyCaptcha(request: Request, token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(503, "CAPTCHA_UNAVAILABLE", "Human verification is temporarily unavailable.");
    }
    return;
  }
  if (!token) {
    throw new ApiError(422, "CAPTCHA_REQUIRED", "Please complete the human verification challenge.", {
      captchaToken: ["Please complete the human verification challenge."],
    });
  }

  const body = new URLSearchParams({ secret, response: token, remoteip: getClientIp(request) });
  let result: TurnstileResponse;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Turnstile returned ${response.status}`);
    result = (await response.json()) as TurnstileResponse;
  } catch (error) {
    console.error("Turnstile verification unavailable", error);
    throw new ApiError(503, "CAPTCHA_UNAVAILABLE", "Human verification is temporarily unavailable.");
  }

  if (!result.success) {
    throw new ApiError(422, "CAPTCHA_FAILED", "Human verification failed. Please try again.", {
      captchaToken: ["Human verification failed. Please try again."],
    });
  }
}
