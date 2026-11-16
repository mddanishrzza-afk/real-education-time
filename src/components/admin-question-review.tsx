"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type AdminQuestionItem = {
  id: string;
  publicId: string;
  stemEn: string;
  marks: number;
  status: string;
  type: string;
  metadata?: { sourceType: string; licenseStatus: string; examYear: number | null } | null;
};

export function AdminQuestionReview({ initialQuestions }: { initialQuestions: AdminQuestionItem[] }) {
  const [questions, setQuestions] = useState<AdminQuestionItem[]>(initialQuestions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleVerify(questionId: string, decision: "APPROVE" | "REJECT") {
    setBusyId(questionId);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/admin/questions/${questionId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error("Verification failed.");
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setMessage(`Question ${decision === "APPROVE" ? "approved & published" : "rejected & archived"}.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-brand-600">Admin Question Intelligence</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Pending Verification Queue</h1>
        <p className="mt-1 text-sm text-muted">Review imported and newly authored questions before publishing to students.</p>
      </div>

      {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}

      {questions.length ? (
        <div className="space-y-3">
          {questions.map((q) => (
            <article key={q.id} className="surface rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted">
                <span>{q.publicId} • {q.type} • {q.marks} Marks</span>
                <span>{q.metadata?.sourceType ?? "IMPORTED_PENDING"} • {q.metadata?.licenseStatus ?? "FAIR_USE_REVIEW"}</span>
              </div>
              <p className="mt-3 text-sm font-bold">{q.stemEn}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === q.id}
                  onClick={() => handleVerify(q.id, "APPROVE")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 size={14} /> Approve &amp; Publish
                </button>
                <button
                  type="button"
                  disabled={busyId === q.id}
                  onClick={() => handleVerify(q.id, "REJECT")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="surface rounded-2xl p-6 text-center text-sm text-muted">No questions pending verification.</p>
      )}
    </div>
  );
}
