type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type ResendResponse = { id?: string; message?: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

export function publicAppUrl() {
  const configured = process.env.APP_URL || "http://localhost:3000";
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production");
  }
  return url.origin;
}

function actionEmailHtml(greeting: string, message: string, label: string, url: string, expiry: string) {
  const safeUrl = escapeHtml(url);
  return `<!doctype html><html><body style="margin:0;background:#f5f6fb;color:#17192e;font-family:Arial,sans-serif"><div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e6e8f1;border-radius:16px;padding:32px"><p style="font-weight:700;color:#4846e5">Real Education Time</p><h1 style="font-size:24px">${escapeHtml(greeting)}</h1><p style="line-height:1.6">${escapeHtml(message)}</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#4846e5;color:white;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">${escapeHtml(label)}</a></p><p style="color:#696d83;font-size:14px;line-height:1.5">This link expires ${escapeHtml(expiry)} and can be used once. If the button does not work, copy this URL:<br><span style="word-break:break-all">${safeUrl}</span></p><p style="color:#696d83;font-size:13px">If you did not expect this email, you can safely ignore it.</p></div></body></html>`;
}

export async function sendTransactionalEmail(email: TransactionalEmail) {
  const provider = process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === "production" ? "" : "CONSOLE");
  if (provider === "CONSOLE" && process.env.NODE_ENV !== "production") {
    console.info(`[development email] ${email.to}: ${email.subject}`);
    return { id: "development-email" };
  }
  if (provider !== "RESEND") throw new Error("EMAIL_PROVIDER must be RESEND in production");

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Transactional email is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const payload = (await response.json().catch(() => ({}))) as ResendResponse;
  if (!response.ok || !payload.id) throw new Error(`Transactional email provider returned ${response.status}`);
  return { id: payload.id };
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${publicAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return sendTransactionalEmail({
    to,
    subject: "Verify your Real Education Time email",
    text: `Hello ${name}, verify your email by opening ${url}. This one-time link expires in 24 hours.`,
    html: actionEmailHtml(`Hello ${name}`, "Verify your email to continue creating your personalized learning journey.", "Verify email", url, "in 24 hours"),
  });
}

export async function sendGuardianConsentEmail(to: string, learnerName: string, token: string) {
  const url = `${publicAppUrl()}/guardian-consent?token=${encodeURIComponent(token)}`;
  return sendTransactionalEmail({
    to,
    subject: `Guardian consent requested for ${learnerName}`,
    text: `${learnerName} entered your address as their guardian. Review and provide consent at ${url}. This one-time link expires in 7 days.`,
    html: actionEmailHtml("Guardian consent requested", `${learnerName} entered your address as their guardian. Review the notice and confirm only if you are authorized to provide consent.`, "Review consent request", url, "in 7 days"),
  });
}

export async function sendLoginOtpEmail(to: string, name: string, code: string) {
  const safeCode = escapeHtml(code);
  return sendTransactionalEmail({
    to,
    subject: "Your Real Education Time sign-in code",
    text: `Hello ${name}, your Real Education Time sign-in code is ${code}. It expires in 10 minutes. Never share this code.`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f6fb;color:#17192e;font-family:Arial,sans-serif"><div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e6e8f1;border-radius:16px;padding:32px"><p style="font-weight:700;color:#4846e5">Real Education Time</p><h1 style="font-size:24px">Hello ${escapeHtml(name)}</h1><p style="line-height:1.6">Use this one-time code to complete your sign-in:</p><p style="margin:28px 0;font-size:34px;font-weight:800;letter-spacing:8px;color:#17192e">${safeCode}</p><p style="color:#696d83;font-size:14px;line-height:1.5">This code expires in 10 minutes and allows five attempts. Never share it with anyone.</p><p style="color:#696d83;font-size:13px">If you did not try to sign in, change your password and contact support.</p></div></body></html>`,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = `${publicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return sendTransactionalEmail({
    to,
    subject: "Reset your Real Education Time password",
    text: `Hello ${name}, reset your password at ${url}. This one-time link expires in 30 minutes.`,
    html: actionEmailHtml(`Hello ${name}`, "We received a request to reset your password.", "Reset password", url, "in 30 minutes"),
  });
}
