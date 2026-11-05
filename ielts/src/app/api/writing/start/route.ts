import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { chartDataSchema } from "@/lib/writing";

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const parsed = z.object({ promptId: z.string().min(1).max(128) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mavzu noto‘g‘ri." }, { status: 400 });
  try {
    const prompt = await prisma.writingPrompt.findFirst({
      where: { id: parsed.data.promptId, status: "PUBLISHED" },
      include: { examSection: true, questions: {
        where: { status: "PUBLISHED", skill: "WRITING" }, orderBy: { questionNumber: "asc" }, take: 1,
      } },
    });
    if (!prompt?.examSection || !prompt.questions[0]) {
      return NextResponse.json({ error: "Mavzu topilmadi yoki hali tayyor emas." }, { status: 404 });
    }
    if (prompt.taskType === "TASK_1" && !chartDataSchema.safeParse(prompt.chartDataJson).success) {
      return NextResponse.json({ error: "Bu vazifa uchun grafik ma’lumotlari hali tayyor emas." }, { status: 422 });
    }
    const now = new Date();
    const duration = prompt.taskType === "TASK_1" ? 20 : 40;
    const attempt = await prisma.examSession.create({ data: {
      userId: user.userId, mockExamId: prompt.examSection.mockExamId,
      startedAt: now, deadlineAt: new Date(now.getTime() + duration * 60000),
      userAnswers: { create: { userId: user.userId, questionId: prompt.questions[0].id } },
    } });
    return NextResponse.json({ sessionId: attempt.id, deadlineAt: attempt.deadlineAt, serverNow: now }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Mashg‘ulotni boshlashda xatolik. Qayta urinib ko‘ring." }, { status: 500 });
  }
}
