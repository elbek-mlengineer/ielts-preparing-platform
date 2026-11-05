import { z } from "zod";

export const MIN_SUBMISSION_WORDS = 20;
export const MAX_ESSAY_LENGTH = 30000;
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
export const submissionSchema = z.object({
  sessionId: z.string().min(1).max(128),
  essayText: z.string().trim().max(MAX_ESSAY_LENGTH).refine(
    (text) => countWords(text) >= MIN_SUBMISSION_WORDS, "Kamida 20 ta so‘z yozing.",
  ),
});
const band = z.number().min(0).max(9).multipleOf(0.5);
const feedbackText = z.string().trim().min(1).max(10000);
export const evaluationSchema = z.object({
  overallBand: band, taskAchievement: band, coherenceCohesion: band,
  lexicalResource: band, grammarAccuracy: band,
  feedback: z.object({
    taskAchievementFeedback: feedbackText, coherenceFeedback: feedbackText,
    lexicalFeedback: feedbackText, grammarFeedback: feedbackText,
    detailedMistakes: z.array(z.object({
      original: feedbackText, correction: feedbackText, explanation: feedbackText,
    })).max(100).default([]),
    generalSuggestions: z.array(feedbackText).min(1).max(20),
  }),
});
export type EvaluationData = z.infer<typeof evaluationSchema>;
export function parseEvaluation(raw: string): EvaluationData {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const value = evaluationSchema.parse(JSON.parse(cleaned));
  const sum = value.taskAchievement + value.coherenceCohesion + value.lexicalResource + value.grammarAccuracy;
  return { ...value, overallBand: Math.round(sum / 2) / 2 };
}
export const chartDataSchema = z.object({
  columns: z.array(z.string()).min(2).max(20),
  rows: z.array(z.array(z.union([z.string(), z.number()]))).min(1).max(100),
}).refine((data) => data.rows.every((row) => row.length === data.columns.length));
export const remainingSeconds = (deadline: number, now = Date.now()) => Math.max(0, Math.ceil((deadline - now) / 1000));
