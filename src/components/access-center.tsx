"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Clock3, Copy, CreditCard, ExternalLink, History, Landmark, LoaderCircle, LockKeyhole, QrCode, ShieldCheck, Smartphone, Wallet } from "lucide-react";

import { copyTextToClipboard } from "@/lib/clipboard";

type Decision = { allowed: true; source: "ENTITLEMENT" | "TRIAL"; expiresAt: string | null } | { allowed: false; source: "NONE"; reason: "NOT_STARTED" | "TRIAL_EXPIRED" };
type Access = { school: Decision; boardCompetitive: Decision; trial: { status: "AVAILABLE" | "ACTIVE" | "EXPIRED"; startsAt: string | null; expiresAt: string | null } };
type Plan = { code: string; category: "SCHOOL_6_12" | "BOARD_COMPETITIVE"; titleEn: string; titleHi: string | null; descriptionEn: string | null; amountPaise: number; currency: string };
type Order = { id: string; status: string; amountPaise: number; currency: string; createdAt: string; paidAt: string | null; plan: { code: string; titleEn: string; category: string } };
type BankTransfer = { available: boolean; accountName: string; accountNumber: string; ifsc: string; bankName: string; reviewWindowHours: number };
type ManualUpi = { status: "ready" | "unconfigured" | "invalid"; available: boolean; upiId: string; payeeName: string; upiLink: string; note: string; qrPath: string; error: string | null };
type ApiErrorBody = { error?: { code?: string; message?: string } };
type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayOptions = { key: string; order_id: string; amount: number; currency: string; name: string; description: string; prefill: { name: string; email: string }; theme: { color: string }; modal: { ondismiss: () => void }; handler: (response: RazorpayResponse) => void };
declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => { open: () => void } } }

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as ApiErrorBody).error?.message || "The request could not be completed.");
  return payload;
}

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("Secure checkout could not be loaded.")), { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Secure checkout could not be loaded."));
    document.head.appendChild(script);
  });
}

/** Lock the selected plan's amount into the UPI intent so the app opens pre-filled. */
function upiLinkWithAmount(link: string, amountPaise: number | null | undefined) {
  if (!link || !amountPaise) return link;
  const amount = (amountPaise / 100).toFixed(2);
  return /([?&])am=/.test(link) ? link.replace(/([?&])am=[^&]*/, `$1am=${amount}`) : `${link}&am=${amount}`;
}

function money(paise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function remaining(expiresAt: string | null, now: number) { if (!expiresAt) return ""; const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

export function AccessCenter({ initialAccess, plans, initialOrders, initialNow, user, gatewayEnabled, bankTransfer, manualUpi }: { initialAccess: Access; plans: Plan[]; initialOrders: Order[]; initialNow: string; user: { name: string; email: string; verified: boolean }; gatewayEnabled: boolean; bankTransfer: BankTransfer; manualUpi: ManualUpi }) {
  const router = useRouter();
  const [access, setAccess] = useState(initialAccess);
  const [orders, setOrders] = useState(initialOrders);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [now, setNow] = useState(new Date(initialNow).getTime());
  const [manualPlan, setManualPlan] = useState(plans[0]?.code || "");
  const [utr, setUtr] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [bankPlan, setBankPlan] = useState(plans[0]?.code || "");
  const [bankUtr, setBankUtr] = useState("");
  const activeManualPlan = useMemo(() => plans.find((plan) => plan.code === manualPlan) ?? null, [plans, manualPlan]);
  const trialLeft = useMemo(() => remaining(access.trial.expiresAt, now), [access.trial.expiresAt, now]);

  useEffect(() => { if (access.trial.status !== "ACTIVE") return; const id = window.setInterval(() => setNow(new Date().getTime()), 1000); return () => window.clearInterval(id); }, [access.trial.status]);

  async function refresh() {
    const [accessPayload, historyPayload] = await Promise.all([jsonRequest("/api/v1/access"), jsonRequest("/api/v1/payments/orders")]);
    setAccess(accessPayload.access); setOrders(historyPayload.orders); router.refresh();
  }

  async function activateTrial() {
    setBusy("trial"); setMessage(null);
    try { const payload = await jsonRequest("/api/v1/access/trial", { method: "POST", body: "{}" }); setAccess((value) => ({ ...value, trial: payload.trial, school: { allowed: true, source: "TRIAL", expiresAt: payload.trial.expiresAt }, boardCompetitive: { allowed: true, source: "TRIAL", expiresAt: payload.trial.expiresAt } })); setMessage({ kind: "ok", text: payload.message }); }
    catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Demo activation failed." }); }
    finally { setBusy(null); }
  }

  async function checkout(plan: Plan) {
    setBusy(plan.code); setMessage(null);
    try {
      const payload = await jsonRequest("/api/v1/payments/orders", { method: "POST", body: JSON.stringify({ planCode: plan.code }) });
      if (payload.checkout.provider === "LOCAL_TEST") {
        await jsonRequest("/api/v1/payments/local-confirm", { method: "POST", body: JSON.stringify({ internalOrderId: payload.order.id }) });
        await refresh(); setMessage({ kind: "ok", text: "Development payment verified. Permanent category access is now active." }); setBusy(null); return;
      }
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Secure checkout is unavailable.");
      const instance = new window.Razorpay({
        key: payload.checkout.keyId, order_id: payload.checkout.providerOrderId, amount: payload.checkout.amountPaise, currency: payload.checkout.currency,
        name: "Real Education Time", description: payload.checkout.title, prefill: { name: user.name, email: user.email }, theme: { color: "#5b43d6" },
        modal: { ondismiss: () => { setBusy(null); setMessage({ kind: "error", text: "Checkout was closed. No access was granted." }); } },
        handler: async (response) => {
          try { const verified = await jsonRequest("/api/v1/payments/verify", { method: "POST", body: JSON.stringify({ internalOrderId: payload.order.id, providerPaymentId: response.razorpay_payment_id, signature: response.razorpay_signature }) }); await refresh(); setMessage({ kind: "ok", text: verified.status === "PAID" ? "Payment verified. Permanent category access is active." : verified.message }); }
          catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Payment verification failed." }); }
          finally { setBusy(null); }
        },
      });
      instance.open();
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Checkout failed." }); setBusy(null); }
  }

  function openUpiFlow(plan?: Plan) {
    if (plan) setManualPlan(plan.code);
    const section = document.getElementById("upi-manual") as HTMLDetailsElement | null;
    if (section) { section.open = true; section.scrollIntoView({ behavior: "smooth", block: "start" }); }
    setMessage({ kind: "ok", text: "Choose your plan, pay with any UPI app, then submit the transaction reference (UTR) for review." });
  }

  const netbankingDetail = gatewayEnabled
    ? "Pay straight from your bank account (all major Indian banks) in the secure gateway checkout — the amount is confirmed server-side before access unlocks."
    : bankTransfer.available
      ? "NEFT/IMPS bank transfer is available now: transfer the exact amount to the configured account and submit the bank reference for administrator verification. Fully automatic net banking switches on with the gateway."
      : "Automatic net banking (all major Indian banks, instant confirmation) switches on with the secure gateway once merchant onboarding completes. It is deliberately never shown as live before that.";
  const netbankingBadge = gatewayEnabled ? "Available now" : bankTransfer.available ? "Bank transfer live" : "With gateway";

  async function submitBankTransfer(event: React.FormEvent) {
    event.preventDefault(); setBusy("netbanking"); setMessage(null);
    try { const payload = await jsonRequest("/api/v1/payments/netbanking", { method: "POST", body: JSON.stringify({ planCode: bankPlan, utr: bankUtr }) }); setBankUtr(""); await refresh(); setMessage({ kind: "ok", text: payload.message }); }
    catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Bank reference submission failed." }); }
    finally { setBusy(null); }
  }

  async function submitManual(event: React.FormEvent) {
    event.preventDefault(); setBusy("manual"); setMessage(null);
    try { const payload = await jsonRequest("/api/v1/payments/manual", { method: "POST", body: JSON.stringify({ planCode: manualPlan, utr }) }); setUtr(""); await refresh(); setMessage({ kind: "ok", text: payload.message }); }
    catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Reference submission failed." }); }
    finally { setBusy(null); }
  }

  return <div className="mx-auto max-w-6xl space-y-7">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 via-brand-900 to-violet-800 p-7 text-white sm:p-10"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-200">Access center</p><h1 className="mt-4 text-3xl font-black sm:text-5xl">Learn first. Pay only once.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">Activate a one-time one-hour demo, or unlock a complete learning category. There is no recurring subscription.</p><div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">{["PhonePe", "Google Pay", "Paytm & all UPI apps", "Manual UTR verification", ...(bankTransfer.available ? ["NEFT / IMPS bank transfer"] : []), ...(gatewayEnabled ? ["Net Banking", "Cards & Wallets", "Instant gateway confirmation"] : []), "Backend verified"].map((label) => <span key={label} className="rounded-full bg-white/10 px-3 py-2">{label}</span>)}</div></header>

    {message && <div role="status" className={`rounded-2xl border p-4 text-sm font-bold ${message.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"}`}>{message.text}</div>}

    <section className="surface grid gap-6 rounded-3xl p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"><Clock3 size={21} /></span><div><p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-200">One verified email • one activation</p><h2 className="mt-1 text-xl font-black">1-hour unlimited demo</h2></div></div><p className="mt-4 max-w-2xl text-sm leading-6 text-muted">The timer begins only when you activate it. During that hour, both categories are open and you may start unlimited test attempts. It cannot be paused, reset, or claimed again.</p></div><div className="min-w-52 text-center">{access.trial.status === "AVAILABLE" ? <button onClick={activateTrial} disabled={busy !== null || !user.verified} className="focus-ring w-full rounded-xl bg-amber-500 px-6 py-4 text-sm font-black text-ink-950 disabled:opacity-50">{busy === "trial" ? "Activating…" : user.verified ? "Start my 1-hour demo" : "Verify email to activate"}</button> : access.trial.status === "ACTIVE" && Number(trialLeft.replace(":", "")) > 0 ? <div className="rounded-2xl bg-emerald-50 px-6 py-4 dark:bg-emerald-500/10"><p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-200">Demo active</p><p className="mt-1 font-mono text-3xl font-black text-emerald-900 dark:text-emerald-50">{trialLeft}</p></div> : <div className="rounded-2xl bg-[var(--surface-soft)] px-6 py-4"><p className="text-xs font-black uppercase text-muted">Demo used</p><p className="mt-1 text-sm font-bold">Ended {access.trial.expiresAt ? formatDate(access.trial.expiresAt) : ""}</p></div>}</div></section>

    <section className="surface rounded-3xl p-6 sm:p-8"><div className="flex items-center gap-3"><CreditCard className="text-brand-600" /><div><h2 className="text-xl font-black">How you can pay</h2><p className="text-xs text-muted">Every method is a one-time payment for a full category — never a subscription.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-3">{[{ title: "UPI apps", detail: "PhonePe, Google Pay, Paytm or any bank UPI app. Scan the QR below and submit the transaction reference — verified by an administrator.", live: true, badge: undefined, icon: QrCode }, { title: "Net Banking & bank transfer", detail: netbankingDetail, live: gatewayEnabled || bankTransfer.available, badge: netbankingBadge, icon: Landmark }, { title: "Cards & Wallets", detail: "Debit and credit cards plus wallets through the same secure gateway, with signature-verified confirmation.", live: gatewayEnabled, badge: undefined, icon: Wallet }].map(({ title, detail, live, badge, icon: Icon }) => <article key={title} className={`rounded-2xl border p-5 ${live ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10" : "border-ui bg-[var(--surface-soft)]"}`}><div className="flex items-center justify-between gap-3"><Icon size={20} className={live ? "text-emerald-700 dark:text-emerald-200" : "text-muted"} /><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${live ? "bg-emerald-600 text-white" : "bg-[var(--surface)] text-muted"}`}>{badge ?? (live ? "Available now" : "With gateway")}</span></div><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-xs leading-5 text-muted">{detail}</p></article>)}</div>{gatewayEnabled ? null : <p className="mt-5 rounded-2xl bg-[var(--surface-soft)] p-4 text-xs leading-5 text-muted"><strong className="text-[var(--ink)]">Automatic gateway is pending merchant approval.</strong> Until it is live, the primary button sends you to the UPI flow below: pay the exact amount, submit the UTR, and an administrator unlocks access after verifying the payment. Nothing is charged automatically.</p>}</section>

    <section><div className="mb-4"><h2 className="text-2xl font-black">One-time access plans</h2><p className="mt-1 text-sm text-muted">Permanent access unless revoked or refunded under applicable terms.</p></div><div className="grid gap-5 md:grid-cols-2">{plans.map((plan) => { const decision = plan.category === "SCHOOL_6_12" ? access.school : access.boardCompetitive; const purchased = decision.allowed && decision.source === "ENTITLEMENT"; return <article key={plan.code} className={`surface rounded-3xl p-6 sm:p-7 ${purchased ? "ring-2 ring-emerald-500" : ""}`}><div className="flex items-start justify-between gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">{plan.category === "SCHOOL_6_12" ? <Smartphone size={22} /> : <BadgeCheck size={22} />}</span>{purchased && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100"><Check size={14} /> Unlocked</span>}</div><h3 className="mt-5 text-xl font-black">{plan.titleEn}</h3>{plan.titleHi && <p className="mt-1 text-sm font-bold text-muted">{plan.titleHi}</p>}<p className="mt-4 min-h-12 text-sm leading-6 text-muted">{plan.descriptionEn}</p><div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-4xl font-black">{money(plan.amountPaise)}</p><p className="mt-1 text-xs font-bold text-muted">one-time • no renewal</p></div><button onClick={() => (gatewayEnabled ? checkout(plan) : openUpiFlow(plan))} disabled={busy !== null || purchased || !user.verified} className="focus-ring rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-black text-white disabled:opacity-50">{busy === plan.code ? <LoaderCircle className="animate-spin" size={18} /> : purchased ? "Active" : gatewayEnabled ? "Pay securely" : "Pay by UPI / QR"}</button></div></article>; })}</div><div className="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--surface-soft)] p-4 text-xs leading-5 text-muted"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={17} /><span>{gatewayEnabled ? "Automatic checkout creates a server-side order. Access unlocks only after signature validation, provider status lookup, captured-payment confirmation, and exact amount/currency matching — the same protection applies to Net Banking, cards and wallets." : "The automatic gateway (Net Banking, cards, wallets) is awaiting merchant approval. The UPI flow is live: pay the exact amount, submit the bank-issued reference, and an administrator unlocks access after verifying the payment."}</span></div></section>

    {manualUpi.available ? (
    <details id="upi-manual" className="surface rounded-3xl p-6 sm:p-8"><summary className="focus-ring flex cursor-pointer list-none items-center justify-between rounded-xl"><span className="flex items-center gap-3 font-black"><QrCode className="text-brand-600" /> UPI QR — pay, then submit the reference</span><span className="text-xs font-bold text-muted">Not instant</span></summary><div className="mt-6 grid gap-7 border-t border-ui pt-6 lg:grid-cols-[280px_1fr]"><div className="rounded-2xl border border-ui bg-white p-3">
  <img
    key={manualPlan}
    src={`${manualUpi.qrPath}?plan=${encodeURIComponent(manualPlan)}`}
    alt={`UPI payment QR for ${manualUpi.payeeName || manualUpi.upiId}${activeManualPlan ? ` — ${activeManualPlan.titleEn} (${money(activeManualPlan.amountPaise)})` : ""}`}
    width={512}
    height={512}
    className="mx-auto block h-auto w-full max-w-[268px]"
  />
  <p className="mt-2 text-center text-[11px] font-black text-slate-600">{activeManualPlan ? `This QR charges ${money(activeManualPlan.amountPaise)} for ${activeManualPlan.titleEn}` : "Scan with any UPI app"}</p>
  {manualUpi.note ? <p className="mt-1 text-center text-[11px] font-bold text-slate-500">{manualUpi.note}</p> : null}
</div><div><h3 className="text-lg font-black">Pay to UPI ID <span className="select-all rounded bg-black/5 px-1.5 py-0.5 font-mono text-base dark:bg-white/10">{manualUpi.upiId}</span></h3><p className="mt-2 text-sm leading-6 text-muted">{gatewayEnabled ? "This static QR cannot send an automatic payment confirmation to Real Education Time. Use automatic checkout above for instant unlock." : "Pay from any UPI app — PhonePe, Google Pay, Paytm or your bank app — using this UPI ID or QR."} Submit the bank-issued UPI transaction reference (UTR) to the right and an administrator will verify it and unlock your category.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={async () => { const ok = await copyTextToClipboard(manualUpi.upiId); setCopyState(ok ? "copied" : "manual"); window.setTimeout(() => setCopyState("idle"), ok ? 1800 : 8000); }} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-ui px-4 py-2.5 text-xs font-black">{copyState === "copied" ? <Check size={15} /> : <Copy size={15} />} {copyState === "copied" ? "Copied" : "Copy UPI ID"}</button>{copyState === "manual" ? <p className="basis-full text-xs font-bold text-amber-700 dark:text-amber-200">Automatic copy is blocked in this embedding — select the UPI ID text above and press Ctrl+C.</p> : null}<a href={upiLinkWithAmount(manualUpi.upiLink, activeManualPlan?.amountPaise)} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-ui px-4 py-2.5 text-xs font-black">Open UPI app <ExternalLink size={14} /></a></div><p className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-200">Before authorizing, confirm UPI ID {manualUpi.upiId}{manualUpi.payeeName ? `, receiver name “${manualUpi.payeeName}”` : ""}, and the exact plan amount in your UPI app. Do not pay twice.</p><form onSubmit={submitManual} className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-black">Plan<select value={manualPlan} onChange={(event) => setManualPlan(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-ui bg-transparent px-3 py-3 text-sm">{plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.titleEn} — {money(plan.amountPaise)}</option>)}</select></label><label className="text-xs font-black">UPI transaction reference<input required minLength={10} maxLength={35} pattern="[A-Za-z0-9]+" value={utr} onChange={(event) => setUtr(event.target.value)} placeholder="12-digit UTR" className="focus-ring mt-2 w-full rounded-xl border border-ui bg-transparent px-3 py-3 text-sm" /></label><button disabled={busy !== null || !user.verified} className="focus-ring self-end rounded-xl bg-ink-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-600">{busy === "manual" ? "Submitting…" : "Submit for review"}</button></form></div></div></details>
    ) : (
    <p className="surface rounded-3xl p-6 text-sm font-bold text-muted sm:p-8">{manualUpi.status === "invalid" ? "The payment destination configured for this deployment could not be trusted, so no QR code and no UPI ID are shown. Nothing is payable until this is corrected — a wrong QR is worse than a missing one." : "Static-UPI review is not configured on this deployment, so the manual payment option stays hidden until the recipient UPI ID is provided through the environment."}</p>
    )}

    <details id="bank-transfer" className="surface rounded-3xl p-6 sm:p-8"><summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl"><span className="flex items-center gap-3 font-black"><Landmark className="text-brand-600" /> Net Banking — NEFT / IMPS bank transfer</span><span className="text-xs font-bold text-muted">{gatewayEnabled ? "Use gateway checkout above" : bankTransfer.available ? "Manual verification" : "Not configured yet"}</span></summary><div className="mt-6 border-t border-ui pt-6">{bankTransfer.available ? <div className="grid gap-7 lg:grid-cols-2"><div><h3 className="text-lg font-black">Transfer the exact plan amount to</h3><dl className="mt-4 space-y-3 text-sm">{[["Account name", bankTransfer.accountName], ["Account number", bankTransfer.accountNumber], ["IFSC", bankTransfer.ifsc], ...(bankTransfer.bankName ? [["Bank", bankTransfer.bankName]] : [])].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-ui px-4 py-3"><dt className="text-xs font-bold text-muted">{label}</dt><dd className="select-all font-mono text-sm font-bold">{value}</dd></div>)}</dl><p className="mt-4 text-xs leading-5 text-muted">Use NEFT or IMPS from your own net-banking dashboard or branch, then copy the bank-issued reference (UTR / RRN) from the receipt. Access unlocks only after an administrator matches the amount and reference in the bank statement — usually within {bankTransfer.reviewWindowHours} hours. A bank transfer is never instant and never unlocks by itself.</p><p className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-200">Never share your net-banking password, PIN, CVV or OTP with anyone — Real Education Time will never ask for them.</p></div><form onSubmit={submitBankTransfer} className="grid gap-4"><label className="text-xs font-black">Plan<select value={bankPlan} onChange={(event) => setBankPlan(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-ui bg-transparent px-3 py-3 text-sm">{plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.titleEn} — {money(plan.amountPaise)}</option>)}</select></label><label className="text-xs font-black">Bank reference (UTR / RRN)<input required minLength={8} maxLength={35} pattern="[A-Za-z0-9]+" value={bankUtr} onChange={(event) => setBankUtr(event.target.value)} placeholder="As printed on your bank receipt" className="focus-ring mt-2 w-full rounded-xl border border-ui bg-transparent px-3 py-3 text-sm" /></label><button disabled={busy !== null || !user.verified} className="focus-ring rounded-xl bg-ink-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-600">{busy === "netbanking" ? "Submitting…" : "Submit for review"}</button><p className="text-xs leading-5 text-muted">One bank reference can be used once. Duplicate or unverified references never unlock access.</p></form></div> : <div className="rounded-2xl bg-[var(--surface-soft)] p-5 text-sm leading-6 text-muted"><p className="font-black text-[var(--ink)]">Automatic net banking is not live yet.</p><p className="mt-2">{gatewayEnabled ? "Use the gateway checkout above — it already covers net banking for all major banks, cards and wallets with server-side confirmation." : "Automatic net banking (all major Indian banks, instant server-confirmed unlock) switches on with the secure payment gateway once merchant onboarding completes. A manual NEFT/IMPS transfer path is already built and turns on the moment Real Education Time's own bank account is configured — until then the app will not display bank details it cannot honour."}</p><p className="mt-3 text-xs font-bold">Available right now: the UPI flow below. Pay the exact amount, submit the reference and an administrator unlocks your category after verification.</p></div>}</div></details>

    <section className="surface rounded-3xl p-6 sm:p-8"><div className="flex items-center gap-3"><History className="text-brand-600" /><div><h2 className="text-xl font-black">Payment history</h2><p className="text-xs text-muted">Last 20 orders for this account</p></div></div>{orders.length ? <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-ui text-[10px] font-black uppercase tracking-wider text-muted"><tr><th className="pb-3">Plan</th><th className="pb-3">Amount</th><th className="pb-3">Created</th><th className="pb-3">Status</th><th className="pb-3">Order</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-ui last:border-0"><td className="py-4 font-bold">{order.plan.titleEn}</td><td className="py-4">{money(order.amountPaise)}</td><td className="py-4 text-muted">{formatDate(order.createdAt)}</td><td className="py-4"><Status status={order.status} /></td><td className="py-4 font-mono text-xs text-muted">{order.id.slice(-10)}</td></tr>)}</tbody></table></div> : <div className="mt-6 rounded-2xl bg-[var(--surface-soft)] p-8 text-center"><LockKeyhole className="mx-auto text-muted" /><p className="mt-3 text-sm font-bold">No payment orders yet.</p></div>}</section>

    <p className="text-center text-xs leading-5 text-muted"><CreditCard className="mr-1 inline" size={13} /> Never share your UPI PIN or OTP with Real Education Time. Refund and access rules are governed by the published terms and refund policy.</p>
  </div>;
}

function Status({ status }: { status: string }) { const good = status === "PAID"; const wait = status === "CREATED" || status === "PENDING_REVIEW"; return <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${good ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100" : wait ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-100"}`}>{status.replaceAll("_", " ")}</span>; }
