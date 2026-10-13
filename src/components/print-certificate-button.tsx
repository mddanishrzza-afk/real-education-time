"use client";

import { Printer } from "lucide-react";

export function PrintCertificateButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`focus-ring inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-black text-white dark:bg-brand-600 ${className}`}
    >
      <Printer size={16} /> Print this page
    </button>
  );
}
