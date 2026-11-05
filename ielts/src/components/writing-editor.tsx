"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { countWords, MAX_ESSAY_LENGTH, MIN_SUBMISSION_WORDS } from "@/lib/writing";

type Attempt = { id: string; seconds: number; submitted: boolean; essay: string };
type Prompt = {
  id: string; title: string; promptText: string; taskType: string; ready: boolean;
  chart: { columns: string[]; rows: (string | number)[][] } | null;
};

export default function WritingEditor({ prompt, initialAttempt }: { prompt: Prompt; initialAttempt: Attempt | null }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(initialAttempt);
  const [essay, setEssay] = useState(initialAttempt?.essay || "");
  const [seconds, setSeconds] = useState(initialAttempt?.seconds ?? (prompt.taskType === "TASK_1" ? 1200 : 2400));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(initialAttempt?.submitted || false);
  const inFlight = useRef(false);
  const autoSubmitted = useRef(false);
  const essayRef = useRef(essay);
  const draftKey = `ielts-writing-draft:${prompt.id}:${attempt?.id || "new"}`;
  const words = countWords(essay);
  const minWords = prompt.taskType === "TASK_1" ? 150 : 250;

  useEffect(() => {
    let active = true;
    // Restore browser storage after hydration, without replacing a frozen server submission.
    queueMicrotask(() => {
      if (!active || submitted) return;
      try {
        const draft = localStorage.getItem(draftKey);
        if (draft) { setEssay(draft); essayRef.current = draft; }
      } catch { /* Browser storage may be unavailable. */ }
    });
    return () => { active = false; };
  }, [draftKey, submitted]);

  useEffect(() => {
    if (!attempt || submitted) return;
    const end = performance.now() + attempt.seconds * 1000;
    const tick = () => setSeconds(Math.max(0, Math.ceil((end - performance.now()) / 1000)));
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [attempt, submitted]);

  useEffect(() => {
    if (!attempt || submitted) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempt, submitted]);

  const evaluate = useCallback(async () => {
    if (!attempt || inFlight.current) return;
    const text = essayRef.current;
    if (countWords(text) < MIN_SUBMISSION_WORDS) {
      setError("Tekshirish uchun kamida 20 ta so‘z yozing."); return;
    }
    inFlight.current = true; setBusy(true); setError("");
    // Keep the submitted text fixed even when a provider/network error requires retrying.
    setSubmitted(true);
    try {
      const response = await fetch("/api/ai/evaluate-writing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: attempt.id, essayText: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Baholashda xatolik.");
      try { localStorage.removeItem(draftKey); } catch { /* Storage is optional. */ }
      router.push(`/writing/review/${data.assessmentId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally { inFlight.current = false; setBusy(false); }
  }, [attempt, draftKey, router]);

  useEffect(() => {
    if (attempt && seconds === 0 && !submitted && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void evaluate();
    }
  }, [attempt, seconds, submitted, evaluate]);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const started = performance.now();
      const response = await fetch("/api/writing/start", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptId: prompt.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Boshlashda xatolik.");
      const left = Math.max(0, Math.floor((Date.parse(data.deadlineAt) - Date.parse(data.serverNow) - (performance.now() - started)) / 1000));
      setAttempt({ id: data.sessionId, seconds: left, submitted: false, essay: "" });
      setSeconds(left); setEssay(""); essayRef.current = ""; setSubmitted(false); autoSubmitted.current = false;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tarmoq xatosi."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
    <main className="mx-auto max-w-6xl space-y-6">
      <Link href="/writing" className="text-sm text-indigo-600">← Writing mashg‘ulotlariga qaytish</Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">{prompt.title}</h1><p className="text-sm text-zinc-500">{prompt.taskType === "TASK_1" ? "Task 1 · 20 daqiqa" : "Task 2 · 40 daqiqa"} · Kamida {minWords} so‘z</p></div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xl tabular-nums" role="timer" aria-label="Qolgan vaqt">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>
          {!attempt ? <Button onClick={start} disabled={busy || !prompt.ready}>Mashg‘ulotni boshlash</Button>
            : <Button onClick={evaluate} disabled={busy || words < MIN_SUBMISSION_WORDS}>{busy ? "Tekshirilmoqda…" : submitted ? "Qayta tekshirish" : "Inshoni topshirish"}</Button>}
        </div>
      </header>
      {!prompt.ready && <p role="alert" className="text-amber-700">Vazifa ma’lumotlari to‘liq emas. Boshqa mavzuni tanlang.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {attempt && seconds === 0 && !submitted && <div className="flex flex-wrap items-center gap-4"><p>Vaqt tugadi. Matningiz saqlanadi, yangi urinish boshlashingiz mumkin.</p><Button onClick={start} disabled={busy}>Yangi urinish</Button></div>}
      {submitted && <p className="text-sm text-zinc-500">Insho topshirildi. Xatolik bo‘lsa, aynan shu matnni qayta tekshirish mumkin.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">Vazifa</h2><p className="whitespace-pre-line leading-relaxed">{prompt.promptText}</p>
          {prompt.chart && <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><caption className="mb-3 text-left font-semibold">Vazifa jadvali</caption><thead><tr>{prompt.chart.columns.map((column, i) => <th key={i} scope="col" className="border border-zinc-300 p-2 text-left">{column}</th>)}</tr></thead><tbody>{prompt.chart.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border border-zinc-300 p-2">{cell}</td>)}</tr>)}</tbody></table></div>}
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex justify-between gap-2"><label htmlFor="essay" className="font-semibold">Inshongiz</label><span className={words >= minWords ? "text-emerald-600" : "text-amber-600"}>{words} / {minWords} so‘z</span></div>
          <Textarea id="essay" value={essay} maxLength={MAX_ESSAY_LENGTH} disabled={!attempt || submitted || seconds === 0 || busy} className="min-h-120 resize-y text-base leading-relaxed" placeholder="Mashg‘ulotni boshlang va inshongizni yozing…" onChange={(event) => {
            const value = event.target.value; setEssay(value); essayRef.current = value;
            try { localStorage.setItem(draftKey, value); } catch { /* Storage is optional. */ }
          }} />
          <p className="mt-3 text-xs text-zinc-500">AI bahosi taxminiy, rasmiy IELTS natijasi emas. Kamida 20 so‘zli matnni tahlilga yuborish mumkin.</p>
        </section>
      </div>
    </main>
  </div>;
}
