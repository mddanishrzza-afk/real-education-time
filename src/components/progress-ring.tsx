import { clamp } from "@/lib/format";

export function ProgressRing({ value, size = 112, stroke = 9, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const safe = clamp(value);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe / 100);
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label ?? "Progress"}: ${Math.round(safe)}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100 dark:text-slate-800" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#ring-gradient)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#5b5ff5" />
            <stop offset="1" stopColor="#9f5de2" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <span className="block text-2xl font-black tracking-tight">{Math.round(safe)}%</span>
        {label && <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>}
      </div>
    </div>
  );
}
