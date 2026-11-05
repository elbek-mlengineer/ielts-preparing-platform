import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { countWords, evaluationSchema } from "@/lib/writing";

const storedSchema = z.object({
  taskAchievement: z.unknown(), coherenceCohesion: z.unknown(), lexicalResource: z.unknown(),
  grammarAccuracy: z.unknown(), feedbackText: z.unknown(),
  promptTitle: z.string().optional(), promptText: z.string().optional(),
});

export default async function WritingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const assessment = await prisma.assessment.findFirst({
    where: { id, userId: user.userId, skill: "WRITING" },
    include: { examSession: { include: { mockExam: true } } },
  });
  if (!assessment) notFound();
  const stored = storedSchema.safeParse(assessment.criteriaBreakdown);
  const result = stored.success ? evaluationSchema.safeParse({
    ...stored.data, overallBand: assessment.estimatedBand, feedback: stored.data.feedbackText,
  }) : null;
  const valid = assessment.aiModel !== "fallback-evaluator" && result?.success;
  const criteria = result?.success ? result.data : null;
  const sections = criteria ? [
    { label: "Task Achievement / Response", band: criteria.taskAchievement, text: criteria.feedback.taskAchievementFeedback },
    { label: "Coherence & Cohesion", band: criteria.coherenceCohesion, text: criteria.feedback.coherenceFeedback },
    { label: "Lexical Resource", band: criteria.lexicalResource, text: criteria.feedback.lexicalFeedback },
    { label: "Grammar & Accuracy", band: criteria.grammarAccuracy, text: criteria.feedback.grammarFeedback },
  ] : [];
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
    <Link href="/writing" className="text-sm text-indigo-600">← Writing mashg‘ulotlariga qaytish</Link>
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">{stored.success && stored.data.promptTitle || assessment.examSession.mockExam.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">{assessment.createdAt.toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" })} · {countWords(assessment.rawResponseText)} so‘z</p></div>
      {valid && <span className="rounded-xl bg-indigo-600 px-5 py-3 text-3xl font-bold text-white">{assessment.estimatedBand.toFixed(1)}</span>}
    </header>
    {!valid ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-800">Bu eski natija ishonchli AI baholashi emas yoki ma’lumotlari to‘liq emas. Yangi urinish boshlang.</p> : <>
      <p className="text-sm text-zinc-500">AI bahosi taxminiy, rasmiy IELTS natijasi emas.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{sections.map((section) => <section key={section.label} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">{section.label}</h2><p className="mt-2 text-2xl font-bold">{section.band.toFixed(1)}</p><p className="mt-3 text-sm">{section.text}</p>
      </section>)}</div>
      {criteria && criteria.feedback.detailedMistakes.length > 0 && <section className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-semibold">Xatolar va tuzatishlar</h2>{criteria.feedback.detailedMistakes.map((mistake, i) => <div key={i} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
          <p><del className="text-red-600">{mistake.original}</del> → <span className="text-emerald-600">{mistake.correction}</span></p><p className="mt-2 text-sm">{mistake.explanation}</p>
        </div>)}
      </section>}
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><h2 className="font-semibold">Yaxshilash uchun tavsiyalar</h2><ul className="mt-3 list-inside list-disc space-y-2">{criteria?.feedback.generalSuggestions.map((tip, i) => <li key={i}>{tip}</li>)}</ul></section>
    </>}
    {stored.success && stored.data.promptText && <section><h2 className="font-semibold">Vazifa</h2><p className="mt-3 whitespace-pre-wrap">{stored.data.promptText}</p></section>}
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><h2 className="font-semibold">Yozilgan insho</h2><p className="mt-3 whitespace-pre-wrap leading-relaxed">{assessment.rawResponseText}</p></section>
  </main>;
}
