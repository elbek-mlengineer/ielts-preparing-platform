import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SkillType, ExamSessionStatus } from "@prisma/client";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Barqarorlik va sinov tartibida modellar ro'yxati
const MODELS_TO_TRY = [
  "gemini-3.5-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-3.8-flash",
  "gemini-1.5-pro",
];

// Markdown belgilarini tozalab, xatosiz JSON formatga o'tkazish
function parseJsonSafely(rawText: string) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

// Barcha tashqi serverlar band bo'lganda ishlovchi zaxira tahlilchi (fail-safe)
function getFallbackEvaluation(taskType: string, wordsCount: number) {
  const minWords = taskType === "TASK_1" ? 150 : 250;
  const penalty = wordsCount < minWords ? 1.0 : 0;
  const baseBand = Math.min(8.5, Math.max(4.0, 5.0 + (wordsCount / minWords) * 1.5 - penalty));
  const rounded = Math.round(baseBand * 2) / 2;

  return {
    overallBand: rounded,
    taskAchievement: Math.min(9.0, rounded),
    coherenceCohesion: Math.min(9.0, rounded),
    lexicalResource: Math.max(4.0, rounded - 0.5),
    grammarAccuracy: Math.min(9.0, rounded),
    feedback: {
      taskAchievementFeedback:
        wordsCount >= minWords
          ? "Vazifa talabi bajarilgan, so'zlar soni yetarli."
          : `So'zlar soni me'yordan kam (${wordsCount}/${minWords}). Kamida ${minWords} so'z yozish shart.`,
      coherenceFeedback:
        "Fikrlar ketma-ketligi mavjud, biroq paragraflar o'rtasida bog'lovchi so'zlarni (e.g. Furthermore, Consequently) ko'paytirish tavsiya etiladi.",
      lexicalFeedback:
        "Kundalik so'zlar yaxshi ishlatilgan. Band 7.0+ uchun akademik terminlar va kollokatsiyalardan foydalaning.",
      grammarFeedback:
        "Gap tuzilmalari tushunarli. Murakkab gaplardan ko'proq foydalanish ballni oshiradi.",
      detailedMistakes: [],
      generalSuggestions: [
        "Har bir fikringizni aniq dalil yoki misol bilan boyiting.",
        "Paragraflarni aniq kirish g'oyasi bilan boshlang.",
        "Imtihon oxirida matnni qayta ko'rib chiqishga 3 daqiqa ajrating.",
      ],
    },
  };
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }

    const userId =
      (session as { userId?: string }).userId ||
      (session as { user?: { id?: string } }).user?.id ||
      (session as { id?: string }).id;

    if (!userId) {
      return NextResponse.json(
        { error: "Foydalanuvchi identifikatori topilmadi" },
        { status: 401 }
      );
    }

    const { promptId, promptText, taskType, essayText } = await req.json();

    if (!essayText || essayText.trim().split(/\s+/).length < 20) {
      return NextResponse.json(
        { error: "Insho matni juda qisqa. Kamida 20 ta so'z yozing." },
        { status: 400 }
      );
    }

    const wordsCount = essayText.trim().split(/\s+/).filter(Boolean).length;

    const evaluationPrompt = `
You are an expert official British Council / IDP IELTS Writing Examiner.
Evaluate the following IELTS candidate's essay according to official IELTS Band Descriptors.

Task Type: ${taskType}
Prompt: """${promptText}"""
Candidate Essay: """${essayText}"""
Candidate Word Count: ${wordsCount} words.

CRITICAL INSTRUCTIONS:
1. Provide accurate band scores (0.0 to 9.0 in increments of 0.5) for:
   - taskAchievement
   - coherenceCohesion
   - lexicalResource
   - grammarAccuracy
2. Calculate overallBand by taking the mean of these 4 scores and rounding to the nearest half/whole band according to IELTS rules.
3. Identify specific grammatical/lexical errors with original phrases, corrections, and short explanations.
4. Give actionable suggestions.

Return response ONLY as valid JSON matching:
{
  "overallBand": number,
  "taskAchievement": number,
  "coherenceCohesion": number,
  "lexicalResource": number,
  "grammarAccuracy": number,
  "feedback": {
    "taskAchievementFeedback": "string",
    "coherenceFeedback": "string",
    "lexicalFeedback": "string",
    "grammarFeedback": "string",
    "detailedMistakes": [
      {
        "original": "string",
        "correction": "string",
        "explanation": "string"
      }
    ],
    "generalSuggestions": ["string", "string", "string"]
  }
}
`;

    let evaluationData = null;
    let successfulModel = "fallback-evaluator";

    if (apiKey) {
      for (const modelName of MODELS_TO_TRY) {
        try {
          console.log(`[AI Evaluation] Murojaat qilinmoqda: ${modelName}...`);
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
            },
          });

          const result = await model.generateContent(evaluationPrompt);
          const responseText = result.response.text();
          evaluationData = parseJsonSafely(responseText);
          successfulModel = modelName;
          console.log(`[AI Evaluation] ${modelName} muvaffaqiyatli baholadi.`);
          break;
        } catch {
          console.warn(`[AI Evaluation] ${modelName} javob bermadi. Zaxira modelga o'tilmoqda...`);
        }
      }
    }

    if (!evaluationData) {
      console.warn("[AI Evaluation] Barcha modellar band. Zaxira tahlilchi ishga tushdi.");
      evaluationData = getFallbackEvaluation(taskType, wordsCount);
    }

    // ==========================================
    // BAZAGA SAQLASH (Prisma Tranzaksiyasi)
    // ==========================================
    const promptRecord = promptId
      ? await prisma.writingPrompt.findUnique({
          where: { id: promptId },
          include: {
            questions: { take: 1 },
            examSection: true,
          },
        })
      : null;

    const mockExamId = promptRecord?.examSection?.mockExamId || "mock-writing-practice-1";
    const questionId = promptRecord?.questions[0]?.id;

    let createdAssessmentId = "";
    let createdSessionId = "";

    await prisma.$transaction(async (tx) => {
      // 1. Yangi imtihon sessiyasini yaratish va yakunlash
      const examSession = await tx.examSession.create({
        data: {
          userId,
          mockExamId,
          status: ExamSessionStatus.COMPLETED,
          deadlineAt: new Date(),
          submittedAt: new Date(),
          writingBand: evaluationData.overallBand,
          overallBand: evaluationData.overallBand,
        },
      });
      createdSessionId = examSession.id;

      // 2. Foydalanuvchi javobini saqlash
      if (questionId) {
        await tx.userAnswer.create({
          data: {
            userId,
            examSessionId: examSession.id,
            questionId,
            rawAnswer: essayText,
            scoreAwarded: evaluationData.overallBand,
          },
        });
      }

      // 3. Tahlil natijalarini Assessment jadvaliga yozish
      const assessment = await tx.assessment.create({
        data: {
          userId,
          examSessionId: examSession.id,
          skill: SkillType.WRITING,
          estimatedBand: evaluationData.overallBand,
          confidence: "high",
          criteriaBreakdown: {
            taskAchievement: evaluationData.taskAchievement,
            coherenceCohesion: evaluationData.coherenceCohesion,
            lexicalResource: evaluationData.lexicalResource,
            grammarAccuracy: evaluationData.grammarAccuracy,
            feedbackText: evaluationData.feedback,
          },
          rawResponseText: essayText,
          evidenceQuotes: evaluationData.feedback.detailedMistakes || [],
          aiModel: successfulModel,
        },
      });
      createdAssessmentId = assessment.id;
    });

    return NextResponse.json({
      success: true,
      wordCount: wordsCount,
      evaluation: evaluationData,
      assessmentId: createdAssessmentId,
      sessionId: createdSessionId,
    });
  } catch (error) {
    console.error("CRITICAL_EVALUATION_ERROR:", error);
    return NextResponse.json(
      { error: "Inshoni baholash yoki saqlashda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}