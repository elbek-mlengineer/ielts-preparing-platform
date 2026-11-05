import assert from "node:assert/strict";
import test from "node:test";
import { chartDataSchema, countWords, parseEvaluation, remainingSeconds, submissionSchema } from "../src/lib/writing";
import { evaluateWriting } from "../src/lib/writing-ai";

export const validEvaluation = {
  overallBand: 9, taskAchievement: 6, coherenceCohesion: 6.5, lexicalResource: 7, grammarAccuracy: 7,
  feedback: { taskAchievementFeedback: "Task feedback", coherenceFeedback: "Coherence feedback",
    lexicalFeedback: "Lexical feedback", grammarFeedback: "Grammar feedback",
    detailedMistakes: [], generalSuggestions: ["Add a concrete example."] },
};
test("counts whitespace-separated words and rejects short, non-string and oversized submissions", () => {
  assert.equal(countWords("  one\n two\tthree  "), 3); assert.equal(countWords("   "), 0);
  for (const essayText of ["short", null, 23, "a".repeat(30001)]) {
    assert.equal(submissionSchema.safeParse({ sessionId: "id", essayText }).success, false);
  }
  assert.equal(submissionSchema.safeParse({ sessionId: "id", essayText: "word ".repeat(20) }).success, true);
});
test("validates provider output and recalculates overall band from the four criteria", () => {
  assert.equal(parseEvaluation("```json\n" + JSON.stringify(validEvaluation) + "\n```").overallBand, 6.5);
  for (const change of [{taskAchievement:10},{grammarAccuracy:6.2},{lexicalResource:"7"},{feedback:{}}]) {
    assert.throws(() => parseEvaluation(JSON.stringify({...validEvaluation,...change})));
  }
  assert.throws(() => parseEvaluation("not json"));
});
test("deadline is clamped to zero and chart rows must match columns", () => {
  assert.equal(remainingSeconds(1500,1000),1); assert.equal(remainingSeconds(1000,1500),0);
  assert.equal(chartDataSchema.safeParse({columns:["Source","1990"],rows:[["Coal",25]]}).success,true);
  assert.equal(chartDataSchema.safeParse({columns:["Source","1990"],rows:[["Coal"]]}).success,false);
});
test("provider failures and invalid output never turn into fabricated scores", async () => {
  const originalFetch = globalThis.fetch; const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  const input = { taskType:"TASK_2",promptText:"Discuss remote work.",chartData:null,essayText:"word ".repeat(20) };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(validEvaluation)}],role:"model"},finishReason:"STOP"}]}),{status:200,headers:{"Content-Type":"application/json"}});
    assert.equal((await evaluateWriting(input)).evaluation.overallBand,6.5);
    globalThis.fetch = async () => new Response(JSON.stringify({error:{message:"Unavailable"}}),{status:503});
    await assert.rejects(evaluateWriting(input));
    globalThis.fetch = async () => new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"overallBand":9}'}],role:"model"},finishReason:"STOP"}]}),{status:200});
    await assert.rejects(evaluateWriting(input));
    delete process.env.GEMINI_API_KEY; await assert.rejects(evaluateWriting(input),/AI_NOT_CONFIGURED/);
  } finally { globalThis.fetch=originalFetch; if(originalKey===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=originalKey; }
});
