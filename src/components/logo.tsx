import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false, href = "/", inverse = false }: { compact?: boolean; href?: string; inverse?: boolean }) {
  return (
    <Link href={href} className="focus-ring inline-flex items-center gap-2.5 rounded-xl" aria-label="Real Education Time home">
      <Image
        src="/brand/ret-logo-256.png"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-full shadow-lg shadow-brand-950/25 ring-1 ring-white/10"
      />
      {!compact && (
        <span className="leading-none">
          <span className={`block text-[15px] font-black tracking-[-.02em] ${inverse ? "text-white" : "text-ink-950 dark:text-white"}`}>REAL EDUCATION</span>
          <span className={`mt-1 block text-[10px] font-bold tracking-[.26em] ${inverse ? "text-brand-300" : "text-brand-600 dark:text-brand-300"}`}>TIME</span>
        </span>
      )}
    </Link>
  );
}
