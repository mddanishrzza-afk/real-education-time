import { BarChart3, CheckCircle2, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(91,95,245,.38),transparent_32%),radial-gradient(circle_at_90%_80%,rgba(168,85,247,.24),transparent_35%)]" />
        <div className="relative"><Logo href="/" inverse /></div>
        <div className="relative my-auto max-w-xl px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-brand-200"><Sparkles size={14} /> PERSONALIZED FROM DAY ONE</span>
          <h2 className="mt-7 text-5xl font-black leading-[1.06] tracking-[-.045em]">Study less randomly.<br /><span className="text-brand-300">Improve more clearly.</span></h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/55">हर answer आपके next learning step को बेहतर बनाता है।</p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><BarChart3 className="text-emerald-300" /><p className="mt-4 text-sm font-black">Real performance insights</p><p className="mt-2 text-xs leading-5 text-white/45">Built from saved attempts, not static UI.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><CheckCircle2 className="text-brand-300" /><p className="mt-4 text-sm font-black">Bilingual test content</p><p className="mt-2 text-xs leading-5 text-white/45">English and सरल हिंदी together.</p></div>
          </div>
        </div>
        <p className="relative text-xs text-white/35">Learn → Practice → Test → Analyze → Improve</p>
      </section>
      <section className="flex min-h-screen flex-col p-5 sm:p-8 lg:p-12">
        <div className="flex items-center justify-between lg:justify-end"><div className="lg:hidden"><Logo href="/" /></div><ThemeToggle /></div>
        <div className="mx-auto my-auto w-full max-w-[440px] py-10">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
