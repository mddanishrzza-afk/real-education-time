"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, SearchCheck, XCircle } from "lucide-react";

type PendingOrder = { id: string; provider: string; manualUtr: string; amountPaise: number; currency: string; createdAt: string; user: { name: string; email: string }; plan: { titleEn: string; code: string } };
const methodLabel = (provider: string) => (provider === "NETBANKING" ? "Bank transfer (NEFT / IMPS)" : "UPI app transfer");
function money(paise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100); }

export function AdminPaymentReview({ initialOrders }: { initialOrders: PendingOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function review(order: PendingOrder, approved: boolean) {
    const verb = approved ? "approve" : "reject";
    if (!window.confirm(`Confirm ${verb} for UTR ${order.manualUtr}? ${approved ? "This permanently unlocks access." : "No access will be granted."}`)) return;
    setBusy(order.id); setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/payments/${order.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ approved, note: notes[order.id]?.trim() || undefined }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Review failed.");
      setOrders((items) => items.filter((item) => item.id !== order.id));
      setMessage({ ok: true, text: approved ? `UTR ${order.manualUtr} approved; entitlement granted.` : `UTR ${order.manualUtr} rejected.` });
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : "Review failed." }); }
    finally { setBusy(null); }
  }

  return <div className="mx-auto max-w-6xl"><header className="rounded-3xl bg-gradient-to-br from-ink-950 to-brand-900 p-7 text-white sm:p-10"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-200">Administrator controls</p><h1 className="mt-4 text-3xl font-black sm:text-4xl">Manual payment review</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Approve only after matching the bank reference (UTR / RRN), amount, receiver account, and the settlement record in the bank statement or UPI app. Every decision is written to the audit log.</p></header>{message && <div role="status" className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"}`}>{message.text}</div>}<section className="mt-6 space-y-4">{orders.length ? orders.map((order) => <article key={order.id} className="surface rounded-3xl p-6"><div className="grid gap-5 lg:grid-cols-[1.25fr_.8fr_.8fr]"><div><p className="text-[10px] font-black uppercase tracking-wider text-muted">Student</p><h2 className="mt-2 text-lg font-black">{order.user.name}</h2><p className="text-sm text-muted">{order.user.email}</p><p className="mt-3 text-xs font-bold">{order.plan.titleEn} <span className="text-muted">({order.plan.code})</span></p><p className="mt-2 inline-flex rounded-full bg-[var(--surface-soft)] px-3 py-1 text-[10px] font-black">{methodLabel(order.provider)}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider text-muted">Claim</p><p className="mt-2 text-2xl font-black">{money(order.amountPaise)}</p><p className="mt-2 font-mono text-sm font-bold text-brand-600">UTR {order.manualUtr}</p><p className="mt-2 text-xs text-muted">Submitted {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</p></div><div><label className="text-[10px] font-black uppercase tracking-wider text-muted">Internal note<input value={notes[order.id] || ""} onChange={(event) => setNotes((values) => ({ ...values, [order.id]: event.target.value }))} maxLength={500} placeholder="Settlement match or rejection reason" className="focus-ring mt-2 w-full rounded-xl border border-ui bg-transparent px-3 py-3 text-sm" /></label><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => review(order, false)} disabled={busy !== null} className="focus-ring flex items-center justify-center gap-2 rounded-xl border border-rose-300 px-3 py-3 text-xs font-black text-rose-700 disabled:opacity-50 dark:text-rose-200"><XCircle size={16} /> Reject</button><button onClick={() => review(order, true)} disabled={busy !== null} className="focus-ring flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-xs font-black text-white disabled:opacity-50">{busy === order.id ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Approve</button></div></div></div></article>) : <div className="surface rounded-3xl p-12 text-center"><SearchCheck className="mx-auto text-emerald-600" size={38} /><h2 className="mt-4 text-xl font-black">No pending manual payments</h2><p className="mt-2 text-sm text-muted">New UPI QR or bank-transfer submissions will appear here.</p></div>}</section></div>;
}
