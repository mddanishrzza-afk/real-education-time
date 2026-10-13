"use client";

import Link from "next/link";
import { BarChart3, BookOpenText, ClipboardCheck, KeyRound, LayoutDashboard, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/learn", label: "Learn", icon: BookOpenText },
  { href: "/tests", label: "Tests", icon: ClipboardCheck },
  { href: "/doubts", label: "Tutor", icon: MessageCircleQuestion },
  { href: "/analytics", label: "Stats", icon: BarChart3 },
  { href: "/access", label: "Access", icon: KeyRound },
];

export function NavLinks({ mobile = false, role = "STUDENT" }: { mobile?: boolean; role?: string }) {
  const pathname = usePathname();
  const visibleItems = role === "ADMIN"
    ? [{ href: "/dashboard", label: "Home", icon: LayoutDashboard }, { href: "/admin/payments", label: "Payments", icon: ShieldCheck }]
    : items;
  if (mobile) {
    return (
      <nav className={role === "ADMIN" ? "grid grid-cols-2 gap-1" : "grid grid-cols-6 gap-0.5"} aria-label="Main navigation">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={`focus-ring flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-bold ${active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "text-slate-500 dark:text-slate-400"}`}>
              <Icon size={19} strokeWidth={active ? 2.5 : 2} />{label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav className="space-y-1" aria-label="Main navigation">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"}`}>
            <Icon size={19} strokeWidth={active ? 2.5 : 2} />{label}
          </Link>
        );
      })}
    </nav>
  );
}
