import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import { chartDataSchema, remainingSeconds } from "@/lib/writing";
import WritingEditor from "@/components/writing-editor";

export default async function WritingExamPage({ params }: { params: Promise<{ promptId: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { promptId } = await params;
  const prompt = await prisma.writingPrompt.findFirst({
    where: { id: promptId, status: "PUBLISHED" },
    include: { questions: { where: { status: "PUBLISHED", skill: "WRITING" }, take: 1 }, examSection: true },
  });
  if (!prompt) notFound();
  const chart = chartDataSchema.safeParse(prompt.chartDataJson);
  const attempt = await prisma.examSession.findFirst({
    where: { userId: user.userId, status: "IN_PROGRESS", userAnswers: { some: { question: { writingPromptId: promptId } } } },
    orderBy: { startedAt: "desc" }, include: { userAnswers: true },
  });
  return <WritingEditor key={prompt.id} prompt={{
    id: prompt.id, title: prompt.title, promptText: prompt.promptText, taskType: prompt.taskType,
    chart: chart.success ? chart.data : null,
    ready: Boolean(prompt.examSection && prompt.questions.length && (prompt.taskType === "TASK_2" || chart.success)),
  }} initialAttempt={attempt ? {
    id: attempt.id, seconds: remainingSeconds(attempt.deadlineAt.getTime()),
    submitted: Boolean(attempt.submittedAt), essay: attempt.userAnswers[0]?.rawAnswer || "",
  } : null} />;
}
