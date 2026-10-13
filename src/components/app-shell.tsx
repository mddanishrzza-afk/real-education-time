import { Flame, Languages } from "lucide-react";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallAppBanner } from "@/components/install-app-banner";
import { initials } from "@/lib/format";

type ShellUser = { name: string; email: string; role: string; preferredLanguage: string; studentProfile: { currentStreak: number; academicClass: { nameEn: string } | null } | null };

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--page)]">
      <aside className="surface fixed inset-y-0 left-0 z-30 hidden w-[248px] border-y-0 border-l-0 p-4 lg:flex lg:flex-col">
        <div className="px-2 py-2"><Logo href="/dashboard" /></div>
        <div className="mt-8"><NavLinks role={user.role} /></div>
        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-4 text-white">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-white/75"><Flame size={15} /> LEARNING STREAK</div>
            <div className="text-2xl font-black">{user.studentProfile?.currentStreak ?? 0} days</div>
            <p className="mt-1 text-xs leading-relaxed text-white/70">Small steps, every day. Keep going!</p>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-ui bg-[color:var(--page)]/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-7 lg:px-9">
            <div className="lg:hidden"><Logo compact href="/dashboard" /></div>
            <div className="hidden items-center gap-2 text-sm font-semibold text-muted lg:flex">
              <Languages size={16} /> {user.preferredLanguage === "HINDI" ? "हिंदी" : user.preferredLanguage === "ENGLISH" ? "English" : "Hinglish"}
            </div>
            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <div className="ml-1 hidden items-center gap-3 sm:flex">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-100 text-sm font-black text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">{initials(user.name)}</span>
                <span className="hidden leading-tight xl:block"><span className="block text-sm font-bold">{user.name}</span><span className="text-xs text-muted">{user.studentProfile?.academicClass?.nameEn ?? "Student"}</span></span>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-7 lg:px-9 lg:pb-12 lg:pt-8"><InstallAppBanner />{children}</main>
      </div>

      <div className="surface fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 px-3 pb-[max(.6rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"><NavLinks mobile role={user.role} /></div>
    </div>
  );
}
