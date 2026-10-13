"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, LoaderCircle } from "lucide-react";

/**
 * Real, file-level certificate download.
 *
 * The certificate sheet that the student already sees is captured in the browser and written into a
 * one-page A4 landscape PDF, so what is downloaded is exactly what the app renders (logo, letters,
 * Hindi/English text, numbers). The heavy libraries are imported on demand: the rest of the app
 * never pays for them, and no server round-trip or paid service is involved.
 *
 * `autoStart` is used by the "Download" link on the results page, which opens this page with
 * `?download=1` so the file lands without hunting for the button.
 */
export function DownloadCertificateButton({
  certificateId,
  autoStart = false,
  className = "",
}: {
  certificateId: string;
  autoStart?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const started = useRef(false);

  const download = useCallback(async () => {
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const sheet = document.querySelector<HTMLElement>(".certificate-sheet");
      if (!sheet) throw new Error("The certificate sheet could not be found on this page.");
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const canvas = await html2canvas(sheet, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        // The file must always be the light, printable version of the certificate, even when the
        // student is browsing in dark mode.
        onclone: (cloned) => cloned.documentElement.classList.remove("dark"),
      });
      if (!canvas.width || !canvas.height) throw new Error("The certificate could not be captured as an image.");

      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        (pageWidth - width) / 2,
        (pageHeight - height) / 2,
        width,
        height,
        undefined,
        "FAST",
      );
      pdf.save(`${certificateId}-certificate.pdf`);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The certificate could not be downloaded right now.");
    } finally {
      setBusy(false);
    }
  }, [certificateId]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void download();
    }
  }, [autoStart, download]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? "Preparing PDF…" : "Download certificate (PDF)"}
        </button>
        {done ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-200">
            <CheckCircle2 size={14} /> Saved as {certificateId}-certificate.pdf
          </p>
        ) : (
          <p className="text-xs text-muted">One-page A4 PDF, ready to print or share on WhatsApp.</p>
        )}
      </div>
      {error ? (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error} You can still use “Print this page” and choose “Save as PDF”.
        </p>
      ) : null}
    </div>
  );
}
