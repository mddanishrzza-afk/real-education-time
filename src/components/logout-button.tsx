"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function logout() {
    setLoading(true);
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={logout} disabled={loading} className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10">
      <LogOut size={18} /> {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
