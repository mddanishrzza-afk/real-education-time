"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type QuestionResultItem = {
  id: string;
  publicId: string;
  stemEn: string;
  stemHi: string | null;
  marks: number;
  type: string;
  difficulty: string;
  metadata?: {
    examYear: number | null;
    sourceType: string;
    paperCode: string | null;
  } | null;
  translations?: Array<{
    id: string;
    language: string;
    stem: string;
    isRtl: boolean;
  }>;
  topic?: {
    titleEn: string;
    chapter?: {
      titleEn: string;
      offering?: {
        board?: { nameEn: string; code: string } | null;
        academicClass?: { nameEn: string } | null;
        subject?: { nameEn: string } | null;
      };
    };
  };
};

export function QuestionFinderClient({
  boards,
  classes,
  subjects,
}: {
  boards: Array<{ id: string; nameEn: string }>;
  classes: Array<{ id: string; nameEn: string }>;
  subjects: Array<{ id: string; nameEn: string }>;
}) {
  const [q, setQ] = useState("");
  const [boardId, setBoardId] = useState("");
  const [academicClassId, setAcademicClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examYear, setExamYear] = useState("");
  const [marks, setMarks] = useState("");
  const [language, setLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<QuestionResultItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (boardId) params.set("boardId", boardId);
      if (academicClassId) params.set("academicClassId", academicClassId);
      if (subjectId) params.set("subjectId", subjectId);
      if (examYear) params.set("examYear", examYear);
      if (marks) params.set("marks", marks);
      if (language) params.set("language", language);

      const res = await fetch(`/api/v1/questions/search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to search questions.");
      const data = await res.json();
      setItems(data.items ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-brand-600">Question Intelligence</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Question Finder</h1>
        <p className="mt-1 text-sm text-muted">
          Search verified board PYQs and practice questions across boards, classes, marks, and languages.
        </p>
      </div>

      <form onSubmit={handleSearch} className="surface space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search keywords in English, Hindi, or Urdu..."
              className="surface-soft w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="focus-ring rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-black text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <select value={boardId} onChange={(e) => setBoardId(e.target.value)} className="surface-soft rounded-xl px-3 py-2 text-xs font-bold">
            <option value="">All Boards</option>
            {boards.map((b) => <option key={b.id} value={b.id}>{b.nameEn}</option>)}
          </select>
          <select value={academicClassId} onChange={(e) => setAcademicClassId(e.target.value)} className="surface-soft rounded-xl px-3 py-2 text-xs font-bold">
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
          </select>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="surface-soft rounded-xl px-3 py-2 text-xs font-bold">
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.nameEn}</option>)}
          </select>
          <input
            type="number"
            min={1950}
            max={2100}
            value={examYear}
            onChange={(e) => setExamYear(e.target.value)}
            placeholder="Exam Year"
            className="surface-soft rounded-xl px-3 py-2 text-xs font-bold"
          />
          <input
            type="number"
            step="0.5"
            min={0.5}
            max={100}
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            placeholder="Marks (e.g. 2)"
            className="surface-soft rounded-xl px-3 py-2 text-xs font-bold"
          />
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="surface-soft rounded-xl px-3 py-2 text-xs font-bold">
            <option value="">All Languages</option>
            <option value="ENGLISH">English</option>
            <option value="HINDI">Hindi</option>
            <option value="URDU">Urdu (RTL)</option>
            <option value="BENGALI">Bengali</option>
          </select>
        </div>
      </form>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}

      {searched && (
        <section className="space-y-3">
          {items.length ? (
            items.map((item) => {
              const urdu = item.translations?.find((t) => t.language === "URDU");
              return (
                <article key={item.id} className="surface rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted">
                    <span>
                      {item.publicId} • {item.topic?.chapter?.offering?.subject?.nameEn ?? "Subject"} • {item.marks} Marks • {item.type}
                    </span>
                    <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                      {item.metadata?.sourceType ?? "VERIFIED"} {item.metadata?.examYear ? `(${item.metadata.examYear})` : ""}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6">{item.stemEn}</p>
                  {urdu && (
                    <p dir="rtl" lang="ur" className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3 text-right text-sm leading-7">
                      {urdu.stem}
                    </p>
                  )}
                </article>
              );
            })
          ) : (
            <p className="surface rounded-2xl p-6 text-center text-sm text-muted">No matching verified questions found.</p>
          )}
        </section>
      )}
    </div>
  );
}
