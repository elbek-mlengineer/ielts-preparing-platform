import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DetailedMistake {
  original: string;
  correction: string;
  explanation: string;
}

interface CriteriaJson {
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammarAccuracy: number;
  feedbackText: {
    taskAchievementFeedback: string;
    coherenceFeedback: string;
    lexicalFeedback: string;
    grammarFeedback: string;
    generalSuggestions: string[];
  };
}

export default async function WritingReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      examSession: {
        include: {
          mockExam: true,
        },
      },
    },
  });

  if (!assessment) notFound();

  const criteria = assessment.criteriaBreakdown as unknown as CriteriaJson;
  const mistakes = (assessment.evidenceQuotes as unknown as DetailedMistake[]) || [];
  const wordsCount = assessment.rawResponseText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-zinc-50 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-6">
        {/* Navigatsiya */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/writing"
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            ← Barcha insholar ro'yxatiga qaytish
          </Link>
          <span className="text-xs text-zinc-400">
            Topshirilgan sana: {new Date(assessment.createdAt).toLocaleDateString("uz-UZ")}
          </span>
        </div>

        {/* Natija sarlavhasi */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
            <div>
              <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400">
                IELTS Writing Tahlili
              </span>
              <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {assessment.examSession?.mockExam?.title || "Academic Writing Insho"}
              </h1>
              <p className="mt-1 text-xs text-zinc-500">
                AI Model: {assessment.aiModel} | So'zlar soni: {wordsCount} ta
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-500">Umumiy Ball:</span>
              <span className="rounded-2xl bg-indigo-600 px-5 py-2.5 text-3xl font-black text-white shadow">
                {assessment.estimatedBand.toFixed(1)}
              </span>
            </div>
          </div>

          {/* 4 mezon */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-500">Task Achievement / Response</div>
              <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {criteria.taskAchievement?.toFixed(1) || "-"}
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {criteria.feedbackText?.taskAchievementFeedback}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-500">Coherence & Cohesion</div>
              <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {criteria.coherenceCohesion?.toFixed(1) || "-"}
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {criteria.feedbackText?.coherenceFeedback}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-500">Lexical Resource</div>
              <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {criteria.lexicalResource?.toFixed(1) || "-"}
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {criteria.feedbackText?.lexicalFeedback}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-500">Grammar & Accuracy</div>
              <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {criteria.grammarAccuracy?.toFixed(1) || "-"}
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {criteria.feedbackText?.grammarFeedback}
              </p>
            </div>
          </div>

          {/* Xatolar va tuzatishlar */}
          {mistakes.length > 0 && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/50 p-5 dark:border-rose-950/60 dark:bg-rose-950/20">
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-300">
                🔍 Aniqlangan xatolar va tuzatishlar:
              </h4>
              <div className="mt-3 space-y-2">
                {mistakes.map((mistake, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-rose-100 bg-white p-3 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-rose-500 line-through">
                        {mistake.original}
                      </span>
                      <span>➔</span>
                      <span className="font-semibold text-emerald-600">
                        {mistake.correction}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-500 dark:text-zinc-400">{mistake.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Foydalanuvchi yozgan original insho matni */}
          <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Yozilgan insho matni:
            </h4>
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 font-mono text-sm leading-relaxed text-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-200">
              {assessment.rawResponseText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}