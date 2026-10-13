import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function PolicyShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen py-6 sm:py-10">
      <div className="container-shell max-w-4xl">
        <header className="mb-8 flex items-center justify-between"><Link href="/" className="focus-ring rounded-lg"><Logo /></Link><ThemeToggle /></header>
        <article className="surface shadow-card rounded-3xl p-6 sm:p-10">
          <p className="mb-2 text-xs font-black uppercase tracking-[.18em] text-brand-600">Real Education Time</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>
          <div className="policy-content mt-9 space-y-8 text-sm leading-7 text-muted">{children}</div>
        </article>
        <nav className="mt-6 flex justify-center gap-5 text-sm font-bold text-brand-600"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/login">Sign in</Link></nav>
      </div>
    </main>
  );
}
