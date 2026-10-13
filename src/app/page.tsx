import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Facebook,
  FlaskConical,
  Instagram,
  Languages,
  LineChart,
  LogIn,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  Youtube,
  Zap,
} from "lucide-react";
import { ExternalSocialLink } from "@/components/external-social-link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";

const features = [
  { icon: BrainCircuit, title: "Personal learning profile", text: "Accuracy, speed, topic mastery and recurring mistakes form one explainable learner profile.", tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200" },
  { icon: Target, title: "Smart assessments", text: "Bilingual, timed tests with server-side scoring and topic-level evidence—not just a final mark.", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200" },
  { icon: LineChart, title: "Actionable analytics", text: "See what improved, what needs practice and the next useful action from real attempt data.", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" },
];

const socialLinks = [
  { label: "YouTube", href: "https://www.youtube.com/@Realeducationtime", icon: Youtube, tone: "hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-500/30 dark:hover:bg-red-500/10" },
  { label: "Facebook", href: "https://www.facebook.com/RealEducationTime/", icon: Facebook, tone: "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10" },
  { label: "Instagram", href: "https://www.instagram.com/realeducationtime/", icon: Instagram, tone: "hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:hover:border-fuchsia-500/30 dark:hover:bg-fuchsia-500/10" },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/dashboard" : "/register";
  return (
    <div className="min-h-screen overflow-hidden bg-[var(--page)]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/30 bg-[color:var(--page)]/80 backdrop-blur-xl dark:border-white/5">
        <div className="container-shell flex h-[72px] items-center justify-between">
          <div className="sm:hidden"><Logo compact /></div>
          <div className="hidden sm:block"><Logo /></div>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex dark:text-slate-300" aria-label="Landing navigation">
            <a href="#features" className="focus-ring rounded hover:text-brand-600">Features</a>
            <a href="#journey" className="focus-ring rounded hover:text-brand-600">How it works</a>
            <a href="#coverage" className="focus-ring rounded hover:text-brand-600">Boards & exams</a>
            <a href="#pricing" className="focus-ring rounded hover:text-brand-600">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!user && <Link href="/login" aria-label="Sign in" className="focus-ring inline-flex size-10 items-center justify-center rounded-xl text-sm font-bold text-slate-700 transition hover:bg-white sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 dark:text-slate-200 dark:hover:bg-white/5"><LogIn size={17} className="sm:hidden" aria-hidden="true" /><span className="hidden sm:inline">Sign in</span></Link>}
            <Link href={primaryHref} aria-label={user ? "Open dashboard" : "Start learning"} className="focus-ring inline-flex size-10 items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-700 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 dark:bg-brand-600">
              <span className="hidden sm:inline">{user ? "Dashboard" : "Start learning"}</span><ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pb-24 pt-32 sm:pb-32 sm:pt-40">
          <div className="hero-grid pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand-300/20 blur-[110px] dark:bg-brand-600/10" />
          <div className="container-shell relative grid items-center gap-14 lg:grid-cols-[1.03fr_.97fr] lg:gap-8">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/75 px-3.5 py-2 text-xs font-extrabold text-brand-700 shadow-sm backdrop-blur dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                <Sparkles size={14} /> One student. One personalized journey.
              </div>
              <h1 className="text-[clamp(2.85rem,6.3vw,5.45rem)] font-black leading-[.98] tracking-[-.055em] text-ink-950 dark:text-white">
                Learn for the way <span className="gradient-text">you understand.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl dark:text-slate-300">
                Smart practice, meaningful tests and clear performance insights—built around your actual learning gaps.
              </p>
              <p className="mt-3 text-base font-semibold text-slate-500 dark:text-slate-400">आपकी Performance, आपकी Learning, आपका AI Tutor.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href={primaryHref} className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-4 text-sm font-extrabold text-white shadow-xl shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700">
                  Start with the 1-hour demo <ArrowRight size={17} />
                </Link>
                <Link href={user ? "/access" : "/login?next=/access"} className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl border border-ui bg-white/80 px-6 py-4 text-sm font-extrabold text-ink-950 shadow-sm transition hover:border-brand-300 dark:bg-white/5 dark:text-white">
                  <Zap size={17} className="text-amber-500" /> View ₹7 / ₹9 access
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> Demo needs no payment</span>
                <span className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> One activation per verified email</span>
                <span className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> Hindi + English</span>
                <span className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> Real result analysis</span>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-2" aria-label="Real Education Time social channels">
                <span className="mr-1 text-xs font-black text-muted">Connect with us</span>
                {socialLinks.map(({ label, href, icon: Icon, tone }) => (
                  <ExternalSocialLink key={label} href={href} label={label} className={`focus-ring inline-flex items-center gap-2 rounded-xl border border-ui bg-[var(--surface)] px-3 py-2 text-xs font-black transition ${tone}`}>
                    <Icon size={16} aria-hidden="true" /> {label}
                  </ExternalSocialLink>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[570px] lg:ml-auto">
              <div className="absolute -inset-3 rotate-2 rounded-[2rem] bg-gradient-to-br from-brand-200/60 to-fuchsia-200/30 dark:from-brand-900/30 dark:to-fuchsia-900/20" />
              <div className="surface shadow-card relative rounded-[1.75rem] p-4 sm:p-5">
                <div className="mb-5 flex items-center justify-between border-b border-ui pb-4">
                  <div><p className="text-xs font-bold uppercase tracking-[.15em] text-brand-600">Illustrative learner view</p><h2 className="mt-1 text-lg font-black">Good morning, Aarav 👋</h2></div>
                  <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10"><Sparkles size={19} /></span>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
                  <div className="rounded-2xl bg-ink-950 p-5 text-white dark:bg-brand-950">
                    <p className="text-xs font-bold text-white/60">TODAY&apos;S SMART FOCUS</p>
                    <h3 className="mt-3 text-xl font-black">Work & Energy</h3>
                    <p className="mt-2 text-sm leading-6 text-white/65">Revise one concept, then solve 5 focused questions.</p>
                    <div className="mt-5 flex items-center gap-2 text-xs font-bold"><Clock3 size={14} /> 20 minutes</div>
                  </div>
                  <div className="rounded-2xl bg-brand-50 p-5 dark:bg-brand-500/10">
                    <p className="text-xs font-bold text-brand-700 dark:text-brand-200">READINESS</p>
                    <div className="mt-3 text-4xl font-black text-brand-700 dark:text-brand-200">72%</div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-white/10"><div className="h-full w-[72%] rounded-full bg-brand-600" /></div>
                    <p className="mt-3 text-[11px] leading-4 text-muted">An estimate, not an exam-result guarantee.</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[['Math', '82%', 'bg-violet-500'], ['Science', '67%', 'bg-emerald-500'], ['English', '74%', 'bg-amber-500']].map(([label, value, color]) => (
                    <div key={label} className="surface-soft rounded-2xl p-3 sm:p-4"><p className="text-[11px] font-bold text-muted">{label}</p><p className="mt-1 text-lg font-black sm:text-xl">{value}</p><div className="mt-2 h-1.5 rounded-full bg-white dark:bg-white/10"><div className={`h-full rounded-full ${color}`} style={{ width: value }} /></div></div>
                  ))}
                </div>
              </div>
              <div className="surface shadow-soft absolute -bottom-7 -left-4 hidden items-center gap-3 rounded-2xl p-3 pr-5 sm:flex">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><BarChart3 size={18} /></span>
                <span><span className="block text-xs font-bold text-muted">Accuracy improved</span><span className="text-sm font-black text-emerald-600">+16% this month</span></span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-ui bg-[var(--surface)] py-8">
          <div className="container-shell grid grid-cols-3 divide-x divide-[var(--border)] text-center">
            {[['Classes 6–12', 'CBSE • Bihar Board • ICSE'], ['3 languages', 'Hindi • English • Hinglish'], ['AI tutor + real tests', 'Ask → Test → Improve']].map(([big, small]) => <div key={big} className="px-2"><p className="text-base font-black sm:text-2xl">{big}</p><p className="mt-1 text-[10px] font-semibold text-muted sm:text-xs">{small}</p></div>)}
          </div>
        </section>

        <section id="features" className="container-shell py-24 sm:py-32">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-600">Built for real improvement</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">More than another test app.</h2><p className="mt-5 text-base leading-7 text-muted sm:text-lg">Every answer becomes useful evidence for what you should learn next.</p></div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, text, tone }) => <article key={title} className="surface rounded-3xl p-7 transition hover:-translate-y-1 hover:shadow-xl"><span className={`grid size-12 place-items-center rounded-2xl ${tone}`}><Icon size={22} /></span><h3 className="mt-6 text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-muted">{text}</p></article>)}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <article className="overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 to-brand-900 p-8 text-white sm:p-10">
              <div className="grid items-center gap-8 sm:grid-cols-2"><div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-200"><WandSparkles size={14} /> AI Tutor is live</span><h3 className="mt-5 text-3xl font-black">AI Tutor that teaches—not just answers.</h3><p className="mt-4 text-sm leading-7 text-white/65">Ask in Hindi, English or Hinglish and receive approved-content explanations, key points, a confidence note and a learning check.</p><Link href={user ? "/doubts" : "/login?next=/doubts"} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-brand-800">Ask your doubt <ArrowRight size={15} /></Link></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-white/45">STUDENT</p><p className="mt-2 text-sm">Newton&apos;s second law आसान भाषा में समझाइए।</p><div className="my-4 h-px bg-white/10" /><p className="text-xs text-brand-200">GROUNDED AI TUTOR • AVAILABLE NOW</p><p className="mt-2 text-sm leading-6 text-white/75">पहले idea: जितना अधिक net force, उतनी अधिक acceleration…</p></div></div>
            </article>
            <article className="surface rounded-3xl p-8"><span className="grid size-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200"><Languages size={22} /></span><h3 className="mt-6 text-2xl font-black">Language should never be a barrier.</h3><p className="mt-3 text-sm leading-6 text-muted">Switch between English, सरल हिंदी and Hinglish-friendly learning without changing the core concept.</p></article>
          </div>
        </section>

        <section id="analysis" className="border-y border-ui bg-[var(--surface)] py-24 sm:py-28">
          <div className="container-shell">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-600">Real AI analysis</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">A test is only useful if it tells you what to do next.</h2><p className="mt-5 text-base leading-7 text-muted sm:text-lg">Every submitted test is scored on the server and analysed topic by topic — accuracy, pace, difficulty, skipped questions and recurring mistakes — then a grounded AI explanation turns that evidence into one clear next step.</p></div>
            <div className="mt-14 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
              <article className="surface rounded-[2rem] p-6 shadow-card sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-muted">Illustrative analysis screen</p><h3 className="mt-1 text-lg font-black">Class 9 Physics • diagnostic test</h3></div><span className="rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-black text-amber-800 dark:bg-amber-500/15 dark:text-amber-100">MEDIUM CONFIDENCE</span></div>
                <div className="mt-6 grid grid-cols-3 gap-3">{[['Score', '68%'], ['Accuracy', '72%'], ['Avg. pace', '34s']].map(([label, value]) => <div key={label} className="rounded-2xl bg-[var(--surface-soft)] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p><p className="mt-1.5 text-xl font-black">{value}</p></div>)}</div>
                <div className="mt-6 space-y-4">{[['Motion', 86, 'bg-emerald-500'], ['Force', 62, 'bg-amber-500'], ['Work & Energy', 38, 'bg-rose-500']].map(([label, score, color]) => <div key={String(label)}><div className="mb-2 flex justify-between text-sm"><span className="font-bold">{label}</span><span className="font-black">{score}%</span></div><div className="h-2 rounded-full bg-[var(--surface-soft)]"><div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} /></div></div>)}</div>
                <div className="mt-6 rounded-2xl bg-[var(--surface-soft)] p-5"><p className="flex items-center gap-2 text-xs font-black"><Sparkles size={14} className="text-brand-600" /> AI diagnosis</p><p className="mt-3 text-sm leading-6 text-muted">Numericals are the weak link: accuracy drops from 82% on concept questions to 41% on calculation questions, and wrong answers take about 1.6× longer than correct ones — the formula is being applied before the situation is understood.</p><div className="mt-4 rounded-xl border border-ui bg-[var(--surface)] p-4"><p className="text-[10px] font-black uppercase tracking-wider text-brand-600">Next step</p><p className="mt-2 text-sm font-bold leading-6">Revise “work = force × displacement” with two solved examples, then attempt five calculation-only questions and re-test the topic after 48 hours.</p></div></div>
                <p className="mt-4 text-[11px] leading-5 text-muted">Illustrative screen using the same layout as the real result page. Analysis is educational guidance based on your answers — never a guarantee of an exam result.</p>
              </article>
              <div className="space-y-5">
                <article className="surface rounded-3xl p-6 sm:p-7"><h3 className="text-lg font-black">What the analysis actually reads</h3><ul className="mt-5 space-y-3 text-sm text-muted">{[ 'Topic-wise accuracy from your own attempt — not a generic template', 'Difficulty split: easy, medium and hard question performance', 'Pace: time on correct answers vs time on wrong answers', 'Skipped questions and repeated mistake patterns', 'Mastery with an explicit confidence level, so weak evidence is labelled weak' ].map((item) => <li key={item} className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />{item}</li>)}</ul><p className="mt-5 text-xs leading-5 text-muted">The AI layer never touches the database directly: only a small, validated evidence summary is sent, and its reply is schema-checked before it is stored.</p></article>
                <article className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-violet-700 p-6 text-white sm:p-7"><BrainCircuit size={22} /><h3 className="mt-4 text-xl font-black">Then ask the AI tutor about it.</h3><p className="mt-3 text-sm leading-6 text-white/70">Open the doubt room, pick the weak topic and ask in Hindi, English or Hinglish. Answers stay grounded in your board and class syllabus, with key points and a quick learning check.</p><Link href={user ? "/doubts" : "/login?next=/doubts"} className="focus-ring mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-brand-800">Ask your doubt <ArrowRight size={15} /></Link></article>
                <Link href={primaryHref} className="focus-ring flex items-center justify-between gap-4 rounded-3xl border border-ui bg-[var(--surface)] p-6 text-sm font-black transition hover:border-brand-300"><span>Take the free Class 9 diagnostic and see your own analysis</span><ArrowRight size={18} className="shrink-0 text-brand-600" /></Link>
              </div>
            </div>
          </div>
        </section>

        <section id="journey" className="bg-ink-950 py-24 text-white sm:py-28">
          <div className="container-shell"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-300">Your improvement loop</p><h2 className="mt-4 text-3xl font-black sm:text-5xl">One journey that gets smarter.</h2></div>
            <div className="mt-14 grid gap-4 md:grid-cols-4">
              {[['01', 'Learn', 'Clear concept explanations in your preferred language.'], ['02', 'Practice', 'Focused questions matched to topic and level.'], ['03', 'Test', 'Timed evidence across accuracy, speed and difficulty.'], ['04', 'Improve', 'Weak-topic revision and a useful next action.']].map(([no, title, text], index) => <div key={no} className="relative rounded-3xl border border-white/10 bg-white/[.045] p-6"><span className="text-xs font-black text-brand-300">{no}</span><h3 className="mt-9 text-2xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-white/55">{text}</p>{index < 3 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden text-brand-400 md:block" />}</div>)}
            </div>
          </div>
        </section>

        <section id="coverage" className="container-shell py-24 sm:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[.2em] text-brand-600">Designed for Indian learners</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">School today. Competitive exams tomorrow.</h2><p className="mt-5 max-w-xl text-base leading-7 text-muted">The catalog is configurable by board, class, subject, chapter, topic and concept. Exam patterns are versioned rather than hard-coded.</p><div className="mt-8 flex flex-wrap gap-2">{['CBSE', 'Bihar Board', 'ICSE', 'Class 6–12', 'NEET • planned', 'JEE • planned', 'SSC • planned', 'BPSC • planned'].map((item) => <span key={item} className="rounded-full border border-ui bg-[var(--surface)] px-4 py-2 text-xs font-bold">{item}</span>)}</div></div>
            <div className="surface rounded-[2rem] p-6 shadow-card sm:p-8"><div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"><FlaskConical /></span><div><p className="text-xs font-bold text-muted">KNOWLEDGE MAP</p><h3 className="text-lg font-black">Physics foundation</h3></div></div><div className="mt-7 space-y-5">{[['Motion', 86, 'bg-emerald-500'], ['Force', 62, 'bg-amber-500'], ['Work & Energy', 38, 'bg-rose-500'], ['Gravitation', 0, 'bg-slate-300']].map(([label, score, color]) => <div key={String(label)}><div className="mb-2 flex justify-between text-sm"><span className="font-bold">{label}</span><span className="font-black text-muted">{score ? `${score}%` : 'Not attempted'}</span></div><div className="h-2 rounded-full bg-[var(--surface-soft)]"><div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} /></div></div>)}</div></div>
          </div>
        </section>

        <section id="pricing" className="border-y border-ui bg-[var(--surface)] py-24 sm:py-28"><div className="container-shell"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[.2em] text-brand-600">Simple launch pricing</p><h2 className="mt-4 text-3xl font-black sm:text-5xl">Pay once. Keep the category.</h2><p className="mt-4 text-sm leading-7 text-muted">Every verified email can activate one uninterrupted one-hour demo with unlimited test attempts during that hour. These are one-time category prices, not subscriptions.</p></div><div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2"><article className="rounded-3xl border border-ui bg-[var(--page)] p-7"><p className="text-xs font-black uppercase tracking-wider text-brand-600">Class 6–12</p><p className="mt-4 text-5xl font-black">₹7</p><p className="mt-2 text-xs font-bold text-muted">one-time complete category access</p><ul className="mt-6 space-y-3 text-sm text-muted"><li className="flex gap-2"><Check size={16} className="text-emerald-500" /> Mapped core-subject chapter catalog</li><li className="flex gap-2"><Check size={16} className="text-emerald-500" /> Published, reviewed lessons and school tests</li><li className="flex gap-2"><Check size={16} className="text-emerald-500" /> Draft material remains hidden until review</li></ul></article><article className="rounded-3xl border border-ui bg-[var(--page)] p-7"><p className="text-xs font-black uppercase tracking-wider text-violet-600">Board & competitive</p><p className="mt-4 text-5xl font-black">₹9</p><p className="mt-2 text-xs font-bold text-muted">one-time complete category access</p><ul className="mt-6 space-y-3 text-sm text-muted"><li className="flex gap-2"><Check size={16} className="text-emerald-500" /> Published board and competitive tests</li><li className="flex gap-2"><Check size={16} className="text-emerald-500" /> Server-side scoring and learning analytics</li><li className="flex gap-2"><Check size={16} className="text-emerald-500" /> Planned exams are not represented as live</li></ul></article></div><div className="mt-8 text-center"><Link href={user ? "/access" : "/register"} className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-4 text-sm font-black text-white">Open access center <ArrowRight size={17} /></Link><p className="mt-4 text-xs text-muted">Pay by UPI (PhonePe, Google Pay, Paytm or any UPI app) — Net Banking, cards and wallets come with the automatic gateway. Until merchant onboarding completes, UPI + UTR review is the live method.</p></div></div></section>

        <section className="container-shell py-24"><div className="relative overflow-hidden rounded-[2rem] bg-brand-600 px-6 py-14 text-center text-white sm:px-12 sm:py-20"><div className="absolute -left-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl" /><div className="relative mx-auto max-w-2xl"><ShieldCheck className="mx-auto text-brand-200" size={34} /><h2 className="mt-5 text-3xl font-black sm:text-5xl">Your next improvement starts with one honest test.</h2><p className="mt-5 text-base text-white/70">No rank pressure. No result guarantee. Just useful evidence and a clearer next step.</p><Link href={primaryHref} className="focus-ring mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-brand-700 shadow-xl">Create your learning profile <ArrowRight size={17} /></Link></div></div></section>
      </main>

      <footer className="border-t border-ui bg-[var(--surface)] py-10"><div className="container-shell flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><Logo /><nav className="flex flex-wrap gap-4 text-xs font-bold text-muted" aria-label="Legal"><Link href="/terms" className="hover:text-brand-600">Terms</Link><Link href="/privacy" className="hover:text-brand-600">Privacy</Link><Link href="/refund-policy" className="hover:text-brand-600">Refund policy</Link></nav><div className="flex items-center gap-2">{socialLinks.map(({ label, href, icon: Icon, tone }) => <ExternalSocialLink key={label} href={href} label={label} className={`focus-ring grid size-10 place-items-center rounded-xl border border-ui text-muted transition ${tone}`}><Icon size={18} aria-hidden="true" /></ExternalSocialLink>)}</div><p className="max-w-md text-xs leading-5 text-muted">© 2026 Real Education Time. Learning insights are guidance, not exam-result guarantees.</p></div></footer>
    </div>
  );
}
