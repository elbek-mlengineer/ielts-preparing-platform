import { NextResponse } from "next/server";
import type { getSession } from "@/lib/session";
import type { prisma } from "@/lib/prisma";
import { submissionSchema } from "@/lib/writing";
import type { evaluateWriting } from "@/lib/writing-ai";

type Dependencies = {
  db: typeof prisma;
  session: typeof getSession;
  evaluate: typeof evaluateWriting;
};

export function createWritingSubmissionHandler({ db, session, evaluate }: Dependencies) {
  return async function POST(req: Request) {
    const user = await session();
    if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
    const parsed = submissionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { sessionId, essayText } = parsed.data;
    try {
      const attempt = await db.examSession.findFirst({
        where: { id: sessionId, userId: user.userId },
        include: { userAnswers: { include: { question: { include: { writingPrompt: true } } } }, assessments: true },
      });
      const answer = attempt?.userAnswers[0];
      const prompt = answer?.question.writingPrompt;
      if (!attempt || !answer || !prompt || attempt.userAnswers.length !== 1) {
        return NextResponse.json({ error: "Writing mashg‘uloti topilmadi." }, { status: 404 });
      }
      const existing = attempt.assessments.find((item) => item.skill === "WRITING");
      if (existing) return NextResponse.json({ assessmentId: existing.id });
      if (attempt.status !== "IN_PROGRESS") {
        return NextResponse.json({ error: "Bu mashg‘ulot yakunlangan." }, { status: 409 });
      }
      // Freeze the first submission before calling the provider. Retries use the saved text.
      const savedEssay = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`;
        const current = await tx.examSession.findUniqueOrThrow({ where: { id: sessionId } });
        if (current.submittedAt) {
          const saved = await tx.userAnswer.findUniqueOrThrow({ where: { id: answer.id } });
          return saved.rawAnswer!;
        }
        if (Date.now() > current.deadlineAt.getTime() + 5000) return null;
        await tx.userAnswer.update({ where: { id: answer.id }, data: {
          rawAnswer: essayText,
          timeSpentSec: Math.max(0, Math.floor((Date.now() - current.startedAt.getTime()) / 1000)),
        } });
        await tx.examSession.update({ where: { id: sessionId }, data: { submittedAt: new Date() } });
        return essayText;
      });
      if (savedEssay === null) return NextResponse.json({ error: "Vaqt tugagan. Yangi mashg‘ulot boshlang." }, { status: 410 });
      const { evaluation, modelName } = await evaluate({
        taskType: prompt.taskType, promptText: prompt.promptText,
        chartData: prompt.chartDataJson, essayText: savedEssay,
      });
      const assessment = await db.$transaction(async (tx) => {
        // Concurrent retries cannot create duplicate assessments.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`;
        const saved = await tx.assessment.findFirst({ where: { examSessionId: sessionId, skill: "WRITING" } });
        if (saved) return saved;
        const created = await tx.assessment.create({ data: {
          userId: user.userId, examSessionId: sessionId, skill: "WRITING",
          estimatedBand: evaluation.overallBand, confidence: "medium",
          criteriaBreakdown: {
            taskAchievement: evaluation.taskAchievement, coherenceCohesion: evaluation.coherenceCohesion,
            lexicalResource: evaluation.lexicalResource, grammarAccuracy: evaluation.grammarAccuracy,
            feedbackText: evaluation.feedback, promptTitle: prompt.title, promptText: prompt.promptText,
          },
          rawResponseText: savedEssay, evidenceQuotes: evaluation.feedback.detailedMistakes, aiModel: modelName,
        } });
        await tx.userAnswer.update({ where: { id: answer.id }, data: { scoreAwarded: evaluation.overallBand } });
        await tx.examSession.update({ where: { id: sessionId }, data: {
          status: "COMPLETED", writingBand: evaluation.overallBand,
        } });
        return created;
      });
      return NextResponse.json({ assessmentId: assessment.id });
    } catch (error) {
      if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
        return NextResponse.json({ error: "AI baholash xizmati hali sozlanmagan. Inshongiz saqlandi, keyinroq qayta urinishingiz mumkin." }, { status: 503 });
      }
      // Provider error bodies can contain private text or credentials; do not log them.
      return NextResponse.json({ error: "AI baholash yoki saqlash vaqtincha ishlamadi. Shu inshoni qayta tekshirish mumkin." }, { status: 503 });
    }
  }

}
