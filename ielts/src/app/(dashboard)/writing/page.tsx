import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function WritingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId =
    (session as { userId?: string }).userId ||
    (session as { user?: { id?: string } }).user?.id ||
    (session as { id?: string }).id;

  // 1. Yangi Writing mavzulari
  const writingPrompts = await prisma.writingPrompt.findMany({
    where: { status: "PUBLISHED" },
    include: { questions: true },
    orderBy: { createdAt: "desc" },
  });

  // 2. Foydalanuvchining oldingi topshirgan insholari tarixi
  const pastAssessments = userId
    ? await prisma.assessment.findMany({
        where: { userId, skill: "WRITING" },
        include: {
          examSession: {
            include: { mockExam: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      })
    : [];

  return (
    <div className="min-h-screen bg-zinc-50 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-6">
        {/* Sarlavha */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            ← Dashboardga qaytish
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            IELTS Writing Mashg'ulotlari
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Mavzuni tanlang, insho yozing va AI orqali tezkor tahlil hamda ball oling.
          </p>
        </div>

        {/* 1-Bo'lim: Yangi mavzular */}
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-200">
          Mavjud Imtihon Vazifalari
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {writingPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold uppercase ${
                      prompt.taskType === "TASK_1"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                    }`}
                  >
                    {prompt.taskType === "TASK_1" ? "Task 1 (Report)" : "Task 2 (Essay)"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {prompt.taskType === "TASK_1" ? "Kamida 150 so'z" : "Kamida 250 so'z"}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {prompt.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {prompt.promptText}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500">
                  Vaqt tavsiyasi: {prompt.taskType === "TASK_1" ? "20 daqiqa" : "40 daqiqa"}
                </span>
                <Link href={`/writing/${prompt.id}`}>
                  <Button size="sm">Boshlash</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* 2-Bo'lim: Topshirilgan insholar tarixi */}
        {pastAssessments.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-200">
              Oldingi Urinishlarim Tarixi
            </h2>
            <div className="space-y-3">
              {pastAssessments.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-xl font-black text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      {item.estimatedBand.toFixed(1)}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {item.examSession?.mockExam?.title || "Academic Writing Insho"}
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Topshirildi: {new Date(item.createdAt).toLocaleDateString("uz-UZ")} • AI: {item.aiModel}
                      </p>
                    </div>
                  </div>

                  <Link href={`/writing/review/${item.id}`}>
                    <Button variant="outline" size="sm">
                      Tahlilni ko'rish
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}