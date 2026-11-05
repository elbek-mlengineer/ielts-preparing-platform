import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chartData = {
  columns: ["Energy source", "1990", "2000", "2010"],
  rows: [["Coal", 25, 20, 10], ["Natural gas", 20, 25, 20], ["Hydropower", 50, 45, 50], ["Other renewables", 5, 10, 20]],
};
const prompts = [
  {
    id: "prompt-task-1", taskType: "TASK_1" as const,
    title: "Electricity Generation — Sample Data",
    promptText: "The table below shows the percentage of electricity generated from four energy sources in a hypothetical country in 1990, 2000 and 2010. These are fictional practice data.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
    questionNumber: 1,
  },
  {
    id: "prompt-task-2", taskType: "TASK_2" as const,
    title: "Impact of Remote Working",
    promptText: "Some people believe that working from home brings many benefits to both employers and employees, while others think it leads to negative consequences for teamwork and productivity.\n\nDiscuss both views and give your own opinion. Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.",
    questionNumber: 2,
  },
];
async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.mockExam.upsert({ where: { id: "mock-writing-practice-1" }, update: {}, create: {
      id: "mock-writing-practice-1", title: "IELTS Academic Writing Practice Test 1", status: "PUBLISHED",
    } });
    await tx.examSection.upsert({ where: { id: "section-writing-1" }, update: {}, create: {
      id: "section-writing-1", mockExamId: "mock-writing-practice-1", skill: "WRITING", timeLimitMinutes: 60, orderIndex: 1,
    } });
    for (const prompt of prompts) {
      const data = {
        title: prompt.title, taskType: prompt.taskType, promptText: prompt.promptText,
        examSectionId: "section-writing-1", status: "PUBLISHED" as const,
        ...(prompt.taskType === "TASK_1" ? { chartDataJson: chartData } : {}),
      };
      await tx.writingPrompt.upsert({ where: { id: prompt.id }, update: data, create: { id: prompt.id, ...data } });
      const existing = await tx.question.findFirst({ where: { writingPromptId: prompt.id } });
      const question = { writingPromptId: prompt.id, skill: "WRITING" as const, questionType: "ESSAY" as const,
        questionNumber: prompt.questionNumber, promptText: prompt.promptText, status: "PUBLISHED" as const };
      if (existing) await tx.question.update({ where: { id: existing.id }, data: question });
      else await tx.question.create({ data: question });
    }
  });
  console.log("Writing practice prompts are ready.");
}
main().catch(() => { console.error("Writing seed failed. Check database connectivity."); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
