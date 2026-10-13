"use client";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Lightbulb,
  LoaderCircle,
  MessageCircleQuestion,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Language = "ENGLISH" | "HINDI" | "HINGLISH";
type Topic = { id: string; titleEn: string; titleHi: string | null; chapterTitleEn: string; subjectNameEn: string };
type ConversationSummary = {
  id: string; title: string; language: Language; topicId: string | null; provider: string | null;
  updatedAt: string; messageCount: number; preview: string;
};
export type MessageMetadata = {
  keyPoints?: string[]; confidence?: "HIGH" | "MEDIUM" | "LOW"; sourceNote?: string; checkQuestion?: string;
  providerMode?: string; groundedTopicTitle?: string; providerFallback?: boolean;
};
type TutorMessage = { id: string; role: string; content: string; metadataJson?: MessageMetadata | null; createdAt: string };
type ProviderStatus = { mode: string; model: string; isCloud: boolean; label: string; fallbackReason: string | null };

type Props = {
  topics: Topic[];
  initialConversations: ConversationSummary[];
  initialConversation: { id: string; messages: TutorMessage[] } | null;
  provider: ProviderStatus;
  preferredLanguage: Language;
};

function formatRelative(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Something went wrong. Please try again.");
  return payload;
}

export function DoubtTutor({ topics, initialConversations, initialConversation, provider, preferredLanguage }: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialConversation?.id || null);
  const [messages, setMessages] = useState<TutorMessage[]>(initialConversation?.messages || []);
  const [topicId, setTopicId] = useState(initialConversations[0]?.topicId || topics[0]?.id || "");
  const [language, setLanguage] = useState<Language>(preferredLanguage);
  const [question, setQuestion] = useState("");
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = conversations.find((item) => item.id === activeId);
  const selectedTopic = topics.find((item) => item.id === (active?.topicId || topicId));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  async function openConversation(id: string) {
    if (id === activeId || loadingConversation) return;
    setError("");
    setLoadingConversation(true);
    try {
      const payload = await requestJson(`/api/v1/doubts/conversations/${id}`);
      setActiveId(id);
      setMessages(payload.conversation.messages);
      setTopicId(payload.conversation.topicId || topicId);
      setLanguage(payload.conversation.language);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to open this conversation.");
    } finally {
      setLoadingConversation(false);
    }
  }

  function startNew() {
    setActiveId(null);
    setMessages([]);
    setQuestion("");
    setError("");
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function removeConversation(id: string) {
    if (!window.confirm("Delete this doubt and all of its messages? This cannot be undone.")) return;
    setError("");
    try {
      await requestJson(`/api/v1/doubts/conversations/${id}`, { method: "DELETE" });
      const next = conversations.filter((item) => item.id !== id);
      setConversations(next);
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to delete this conversation.");
    }
  }

  async function sendQuestion() {
    const clean = question.trim();
    if (clean.length < 3 || sending) return;
    if (!activeId && !topicId) {
      setError("Choose a syllabus topic before starting your doubt.");
      return;
    }

    setSending(true);
    setError("");
    let conversationId = activeId;
    try {
      if (!conversationId) {
        const created = await requestJson("/api/v1/doubts/conversations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topicId, language }),
        });
        conversationId = created.conversation.id;
        setActiveId(conversationId);
      }

      const optimistic: TutorMessage = {
        id: `pending-${Date.now()}`,
        role: "USER",
        content: clean,
        createdAt: new Date().toISOString(),
      };
      setMessages((items) => [...items, optimistic]);
      setQuestion("");
      const payload = await requestJson(`/api/v1/doubts/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: clean }),
      });
      setMessages((items) => [...items.filter((item) => item.id !== optimistic.id), payload.userMessage, payload.assistantMessage]);

      const now = new Date().toISOString();
      setConversations((items) => {
        const summary: ConversationSummary = {
          id: conversationId!,
          title: clean.replace(/\s+/g, " ").slice(0, 72),
          language,
          topicId: active?.topicId || topicId,
          provider: payload.assistantMessage.metadataJson?.providerMode || provider.mode,
          updatedAt: now,
          messageCount: (active?.messageCount || 0) + 2,
          preview: payload.assistantMessage.content.slice(0, 120),
        };
        return [summary, ...items.filter((item) => item.id !== conversationId)];
      });
    } catch (value) {
      setMessages((items) => items.filter((item) => !item.id.startsWith("pending-")));
      setQuestion(clean);
      setError(value instanceof Error ? value.message : "The tutor could not answer right now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-brand-600"><Sparkles size={16} /> Doubt / AI Tutor</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Ask. Understand. Check.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Hindi, English या Hinglish में पूछिए—answers are grounded in your approved syllabus content.</p>
        </div>
        <div className={`inline-flex self-start items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${provider.isCloud ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100"}`}>
          {provider.isCloud ? <Sparkles size={14} /> : <ShieldCheck size={14} />} {provider.label}
        </div>
      </header>

      {provider.mode === "LOCAL_GROUNDED" && (
        <aside className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <ShieldCheck className="mt-0.5 shrink-0" size={17} />
          <span><strong>Transparent mode:</strong> no cloud AI is active. Responses are assembled from published, approved learning content and may ask you to narrow the topic when that content is insufficient.</span>
        </aside>
      )}

      {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-100"><AlertTriangle className="mt-0.5 shrink-0" size={18} />{error}</div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)] 2xl:grid-cols-[270px_minmax(0,1fr)_260px]">
        <aside className="surface h-fit overflow-hidden rounded-3xl lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-ui p-4">
            <div><h2 className="text-sm font-black">Your doubts</h2><p className="mt-0.5 text-[10px] font-bold text-muted">Persisted privately</p></div>
            <button onClick={startNew} className="focus-ring grid size-9 place-items-center rounded-xl bg-brand-600 text-white" aria-label="Start a new doubt"><Plus size={18} /></button>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto p-2 lg:max-h-[570px]">
            <button onClick={startNew} className={`focus-ring flex w-full items-center gap-3 rounded-2xl p-3 text-left ${!activeId ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-100" : "hover:bg-[var(--surface-soft)]"}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Plus size={17} /></span>
              <span><span className="block text-xs font-black">New academic doubt</span><span className="text-[10px] text-muted">Choose topic & ask</span></span>
            </button>
            {conversations.map((item) => (
              <div key={item.id} className={`group relative rounded-2xl ${activeId === item.id ? "bg-[var(--surface-soft)]" : "hover:bg-[var(--surface-soft)]"}`}>
                <button onClick={() => openConversation(item.id)} className="focus-ring block w-full rounded-2xl p-3 pr-9 text-left" aria-current={activeId === item.id ? "page" : undefined}>
                  <span className="block truncate text-xs font-black">{item.title}</span>
                  <span className="mt-1 block truncate text-[10px] text-muted">{item.preview}</span>
                  <span className="mt-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-muted"><Clock3 size={10} /> {formatRelative(item.updatedAt)} · {item.messageCount} messages</span>
                </button>
                <button onClick={() => removeConversation(item.id)} className="focus-ring absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-slate-400 opacity-100 hover:bg-rose-50 hover:text-rose-600 lg:opacity-0 lg:group-hover:opacity-100" aria-label={`Delete ${item.title}`}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </aside>

        <section className="surface flex min-h-[650px] min-w-0 flex-col overflow-hidden rounded-3xl shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white"><MessageCircleQuestion size={20} /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-black">{active?.title || "New syllabus doubt"}</span><span className="block truncate text-[10px] font-bold text-muted">{selectedTopic ? `${selectedTopic.subjectNameEn} · ${selectedTopic.titleEn}` : "Select a topic below"}</span></span>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">Grounded</span>
          </div>

          <div className="flex-1 overflow-y-auto bg-[color:var(--page)]/45 p-4 sm:p-6">
            {loadingConversation ? (
              <div className="grid h-full min-h-72 place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-brand-600" /><p className="mt-3 text-xs font-bold text-muted">Loading saved messages…</p></div></div>
            ) : messages.length === 0 ? (
              <Welcome topic={selectedTopic} onSuggestion={(value) => { setQuestion(value); textareaRef.current?.focus(); }} />
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((message) => <MessageBubble key={message.id} message={message} onTryCheck={(check) => { setQuestion(`My answer: `); textareaRef.current?.focus(); textareaRef.current?.setAttribute("placeholder", check); }} />)}
                {sending && <div className="flex items-center gap-3 text-xs font-bold text-muted"><span className="grid size-9 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"><LoaderCircle className="animate-spin" size={17} /></span>Checking approved context and preparing an answer…</div>}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="border-t border-ui p-3 sm:p-4">
            {!activeId && (
              <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_150px]">
                <label className="sr-only" htmlFor="tutor-topic">Syllabus topic</label>
                <select id="tutor-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)} className="focus-ring min-w-0 rounded-xl border border-ui bg-[var(--surface)] px-3 py-2.5 text-xs font-bold">
                  {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subjectNameEn} · {topic.titleEn}</option>)}
                </select>
                <label className="sr-only" htmlFor="tutor-language">Answer language</label>
                <select id="tutor-language" value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="focus-ring rounded-xl border border-ui bg-[var(--surface)] px-3 py-2.5 text-xs font-bold">
                  <option value="ENGLISH">English</option><option value="HINDI">हिंदी</option><option value="HINGLISH">Hinglish</option>
                </select>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-ui bg-[var(--surface-soft)] p-2 focus-within:border-brand-400">
              <textarea ref={textareaRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendQuestion(); } }} rows={2} maxLength={2_000} placeholder="Ask your academic doubt… / अपना सवाल पूछें…" className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-slate-400" aria-label="Academic doubt" />
              <button onClick={sendQuestion} disabled={sending || question.trim().length < 3 || topics.length === 0} className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20 disabled:cursor-not-allowed disabled:opacity-45" aria-label="Send question">{sending ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}</button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[9px] font-bold text-muted"><span>Enter to send · Shift + Enter for new line</span><span>{question.length}/2000</span></div>
          </div>
        </section>

        <aside className="hidden h-fit space-y-4 2xl:block 2xl:sticky 2xl:top-24">
          <div className="surface rounded-3xl p-5"><div className="flex items-center gap-2"><BookOpen size={18} className="text-brand-600" /><h2 className="text-sm font-black">Learning context</h2></div>{selectedTopic ? <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted">{selectedTopic.subjectNameEn} · {selectedTopic.chapterTitleEn}</p><p className="mt-2 text-sm font-black">{selectedTopic.titleEn}</p>{selectedTopic.titleHi && <p className="mt-1 text-xs text-muted">{selectedTopic.titleHi}</p>}</div> : <p className="mt-4 text-xs leading-5 text-muted">Choose a topic to constrain the tutor to the right syllabus context.</p>}</div>
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-violet-600 p-5 text-white"><ShieldCheck size={21} /><h2 className="mt-4 text-sm font-black">Safe AI boundary</h2><ul className="mt-3 space-y-2 text-[11px] leading-5 text-white/70"><li>• AI never queries your database.</li><li>• Only minimal approved context is sent.</li><li>• Structured answers are validated.</li><li>• No exam outcome guarantees.</li></ul></div>
        </aside>
      </div>
    </div>
  );
}

function Welcome({ topic, onSuggestion }: { topic?: Topic; onSuggestion: (value: string) => void }) {
  const suggestions = topic ? [
    `Explain ${topic.titleEn} in simple Hinglish with an example.`,
    `What are the most important points in ${topic.titleEn}?`,
    `Give me a conceptual check question about ${topic.titleEn}.`,
  ] : [];
  return <div className="mx-auto flex min-h-[390px] max-w-xl flex-col items-center justify-center text-center"><span className="grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-xl shadow-brand-600/20"><CircleHelp size={29} /></span><h2 className="mt-5 text-xl font-black">What&apos;s confusing you today?</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted">Choose a topic, describe exactly where you are stuck, and include your attempt if possible.</p>{suggestions.length > 0 && <div className="mt-6 grid w-full gap-2 text-left">{suggestions.map((item) => <button key={item} onClick={() => onSuggestion(item)} className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-ui bg-[var(--surface)] p-3.5 text-xs font-bold transition hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"><span className="flex items-center gap-3"><Lightbulb className="shrink-0 text-amber-500" size={16} />{item}</span><ChevronRight className="shrink-0 text-muted" size={15} /></button>)}</div>}</div>;
}

function MessageBubble({ message, onTryCheck }: { message: TutorMessage; onTryCheck: (check: string) => void }) {
  const isUser = message.role === "USER";
  const metadata = message.metadataJson || {};
  if (isUser) return <div className="flex justify-end"><div className="max-w-[88%] rounded-3xl rounded-br-lg bg-brand-600 px-4 py-3 text-sm font-semibold leading-6 text-white sm:max-w-[75%]"><p className="whitespace-pre-wrap">{message.content}</p></div></div>;
  return <article className="surface overflow-hidden rounded-3xl rounded-tl-lg"><div className="flex items-center justify-between gap-3 border-b border-ui bg-[var(--surface-soft)] px-4 py-3"><span className="flex items-center gap-2 text-xs font-black"><Sparkles size={15} className="text-brand-600" /> Grounded explanation</span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${metadata.confidence === "HIGH" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : metadata.confidence === "LOW" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100"}`}>{metadata.confidence || "VALIDATED"} CONFIDENCE</span></div><div className="p-4 sm:p-5"><p className="whitespace-pre-wrap text-sm font-medium leading-7">{message.content}</p>{metadata.keyPoints && <div className="mt-5 rounded-2xl bg-[var(--surface-soft)] p-4"><h3 className="flex items-center gap-2 text-xs font-black"><CheckCircle2 size={15} className="text-emerald-600" /> Key points</h3><ul className="mt-3 space-y-2">{metadata.keyPoints.map((point) => <li key={point} className="flex gap-2 text-xs leading-5 text-muted"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />{point}</li>)}</ul></div>}{metadata.checkQuestion && <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10"><p className="text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-200">Quick learning check</p><p className="mt-2 text-sm font-bold leading-6">{metadata.checkQuestion}</p><button onClick={() => onTryCheck(metadata.checkQuestion!)} className="focus-ring mt-3 rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-black text-white">I&apos;ll answer this</button></div>}{metadata.sourceNote && <p className="mt-4 flex items-start gap-2 border-t border-ui pt-4 text-[10px] leading-4 text-muted"><ShieldCheck className="mt-0.5 shrink-0" size={13} />{metadata.sourceNote}</p>}{metadata.providerFallback && <p className="mt-2 text-[10px] font-bold text-amber-700 dark:text-amber-200">Cloud provider was unavailable; this answer used the labelled local approved-content fallback.</p>}</div></article>;
}
