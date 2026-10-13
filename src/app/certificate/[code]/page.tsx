import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldCheck } from "lucide-react";
import { DownloadCertificateButton } from "@/components/download-certificate-button";
import { PrintCertificateButton } from "@/components/print-certificate-button";
import { getCertificateByCode, rankLabel } from "@/lib/certificates";

export const metadata: Metadata = {
  title: "Certificate",
  robots: { index: false, follow: false },
};

function formatDate(value: Date) {
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ download?: string }>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const certificate = await getCertificateByCode(code);
  if (!certificate) notFound();

  const rank = certificate.rank
    ? { rank: certificate.rank, total: certificate.totalAttempts ?? certificate.rank, sampleIsSmall: certificate.rankIsSmallSample, approximate: false }
    : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="focus-ring inline-flex items-center gap-2 text-sm font-black text-brand-600">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <DownloadCertificateButton certificateId={certificate.certificateId} autoStart={query.download === "1"} />
          <PrintCertificateButton />
        </div>
      </div>

      <article className="certificate-sheet mt-6 overflow-hidden rounded-3xl border-4 border-double border-brand-600 bg-[var(--surface)] p-1">
        <div className="rounded-[1.25rem] border border-ui bg-[radial-gradient(circle_at_center,rgba(72,70,229,.06),transparent_65%)] px-6 py-8 sm:px-12 sm:py-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src="/brand/ret-logo-256.png" alt="Real Education Time emblem" width={54} height={54} className="rounded-full" />
              <div>
                <p className="text-lg font-black leading-tight">Real Education Time</p>
                <p className="text-xs font-bold text-muted">Original lessons · timed tests · honest analysis</p>
              </div>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-2 text-center dark:bg-amber-500/10">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-200">Grade awarded</p>
              <p className="text-xl font-black">{certificate.grade} · {certificate.gradeLabel}</p>
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] font-black uppercase tracking-[.35em] text-brand-600">Certificate of achievement</p>
          <h1 className="mt-4 text-center text-3xl font-black leading-tight sm:text-4xl">{certificate.studentName}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-muted">
            has completed the timed test <span className="font-black text-[var(--ink)]">{certificate.title}</span> on Real Education Time with the
            verified result recorded below.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              { label: "Score", value: `${certificate.score}/${certificate.maxScore}` },
              { label: "Percentage", value: `${certificate.percentage}%` },
              { label: "Accuracy", value: `${certificate.accuracy}%` },
              { label: "Standing", value: rank ? (rank.sampleIsSmall ? `#${rank.rank} of ${rank.total} (small sample)` : `#${rank.rank} of ${rank.total}`) : "—" },
            ].map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-ui bg-[var(--surface)] px-4 py-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">{tile.label}</p>
                <p className="mt-1 text-lg font-black">{tile.value}</p>
              </div>
            ))}
          </div>

          {rank ? <p className="mt-6 text-center text-xs font-bold text-muted">{rankLabel({ ...rank, approximate: false })} — computed from every submitted attempt on this test.</p> : null}

          <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-ui pt-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted">Certificate ID</p>
              <p className="mt-1 font-mono text-sm font-bold">{certificate.certificateId}</p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-muted">Verification code</p>
              <p className="mt-1 break-all font-mono text-xs">{certificate.code}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted">Issued on</p>
              <p className="mt-1 text-sm font-black">{formatDate(certificate.issuedAt)}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-200">
                <BadgeCheck size={14} /> Verified by the Real Education Time server
              </p>
            </div>
          </div>
        </div>
      </article>

      <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-muted">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        This is an internal practice record of one test attempt on Real Education Time. It is not an official board, school or government certificate and it does not guarantee any exam result. Anyone holding the verification code can confirm the record at this same address.
      </p>
      <div className="print-hide mt-6 flex flex-wrap items-center justify-center gap-3">
        <DownloadCertificateButton certificateId={certificate.certificateId} />
        <PrintCertificateButton />
      </div>
    </main>
  );
}
