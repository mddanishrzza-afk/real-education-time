"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Award, Download, ExternalLink, LoaderCircle, LockKeyhole, Sparkles, Trophy } from "lucide-react";

type CertificatePayload = {
  certificate: {
    certificateId: string;
    code: string;
    title: string;
    grade: string;
    gradeLabel: string;
    percentage: number;
    rank: number | null;
    totalAttempts: number | null;
    rankIsSmallSample: boolean;
    issuedAt: string;
  } | null;
  eligibility: { eligible: boolean; reason: string; threshold: number; percentage: number; grade: string; gradeLabel: string };
  rank: { rank: number; total: number; sampleIsSmall: boolean; approximate: boolean } | null;
};

export function CertificateCard({ attemptId }: { attemptId: string }) {
  const [payload, setPayload] = useState<CertificatePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/attempts/${encodeURIComponent(attemptId)}/certificate`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (active && body) setPayload(body as CertificatePayload);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [attemptId]);

  async function issue() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/attempts/${encodeURIComponent(attemptId)}/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "The certificate could not be issued right now.");
      setPayload((current) => (current ? { ...current, certificate: body.certificate } : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The certificate could not be issued right now.");
    } finally {
      setBusy(false);
    }
  }

  if (!payload) {
    return (
      <section className="surface mt-5 flex items-center gap-3 rounded-3xl p-6 sm:p-8">
        <LoaderCircle size={20} className="animate-spin text-amber-500" />
        <p className="text-sm font-bold text-muted">Checking certificate eligibility…</p>
      </section>
    );
  }

  const { certificate, eligibility, rank } = payload;

  return (
    <section id="certificate" className="surface mt-5 rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-200">
            <Award size={21} />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-600">Certificate</p>
            <h2 className="mt-1 text-xl font-black">{certificate ? "Your certificate is ready" : eligibility.eligible ? "Certificate unlocked" : "Certificate status"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{eligibility.reason}</p>
          </div>
        </div>
        {rank ? (
          <div className="rounded-2xl border border-ui px-4 py-3 text-center">
            <Trophy size={18} className="mx-auto text-amber-500" />
            <p className="mt-2 text-2xl font-black">{rank.approximate ? `${rank.rank}+` : `#${rank.rank}`}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">of {rank.total} attempts</p>
            {rank.sampleIsSmall ? <p className="mt-1 max-w-[10rem] text-[10px] leading-4 text-muted">Small sample — a rough pointer, not a rank to brag about yet.</p> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Score", value: certificate ? `${certificate.percentage}%` : `${eligibility.percentage}%` },
          { label: "Grade", value: certificate ? `${certificate.grade} · ${certificate.gradeLabel}` : `${eligibility.grade} · ${eligibility.gradeLabel}` },
          { label: "Pass mark", value: `${eligibility.threshold}%` },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl bg-[var(--surface-soft)] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">{tile.label}</p>
            <p className="mt-1.5 text-lg font-black">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {certificate ? (
          <>
            <Link href={`/certificate/${certificate.code}`} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-black text-white dark:bg-brand-600">
              <ExternalLink size={16} /> Open certificate
            </Link>
            <Link href={`/certificate/${certificate.code}?download=1`} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">
              <Download size={16} /> Download PDF
            </Link>
            <p className="text-xs text-muted">Certificate ID <span className="font-mono font-bold">{certificate.certificateId}</span> · issued {new Date(certificate.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
          </>
        ) : eligibility.eligible ? (
          <button
            type="button"
            onClick={issue}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60 dark:bg-brand-600"
          >
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? "Issuing…" : "Issue my certificate"}
          </button>
        ) : (
          <p className="inline-flex items-center gap-2 rounded-xl border border-ui px-4 py-3 text-xs font-bold text-muted">
            <LockKeyhole size={15} /> Not eligible on this attempt
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}
      <p className="mt-4 text-[11px] leading-5 text-muted">
        The certificate is a Real Education Time practice record for this test attempt — it is not an official board, school or government certificate, and it never guarantees any exam result.
      </p>
    </section>
  );
}
