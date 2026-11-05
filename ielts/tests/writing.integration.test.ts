import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createWritingSubmissionHandler } from "../src/lib/writing-submission";
import { parseEvaluation } from "../src/lib/writing";

const url = process.env.TEST_DATABASE_URL;
test("Writing submission with PostgreSQL: ownership, deadlines, retries, atomic writes and concurrency", {skip: !url}, async (t) => {
  const db = new PrismaClient({datasources:{db:{url}},log:[]});
  const suffix=randomUUID(); const ids:string[]=[]; let mockId=""; let questionId="";
  const evaluation=parseEvaluation(JSON.stringify({overallBand:9,taskAchievement:6,coherenceCohesion:6.5,lexicalResource:7,grammarAccuracy:7,
    feedback:{taskAchievementFeedback:"Task",coherenceFeedback:"Coherence",lexicalFeedback:"Lexical",grammarFeedback:"Grammar",detailedMistakes:[],generalSuggestions:["Add examples."]}}));
  try {
    const owner=await db.user.create({data:{email:`writing-owner-${suffix}@example.test`,passwordHash:"test-only"}});ids.push(owner.id);
    const other=await db.user.create({data:{email:`writing-other-${suffix}@example.test`,passwordHash:"test-only"}});ids.push(other.id);
    const mock=await db.mockExam.create({data:{title:"Writing integration",sections:{create:{skill:"WRITING",timeLimitMinutes:40,orderIndex:1,writingPrompts:{create:{taskType:"TASK_2",title:"Test prompt",promptText:"Authoritative task",status:"PUBLISHED",questions:{create:{skill:"WRITING",questionNumber:1,promptText:"Essay",status:"PUBLISHED"}}}}}}},include:{sections:{include:{writingPrompts:{include:{questions:true}}}}}});
    mockId=mock.id;questionId=mock.sections[0].writingPrompts[0].questions[0].id;
    const session=async()=>({userId:owner.id,email:owner.email,role:"LEARNER"});
    const makeAttempt=(expired=false)=>db.examSession.create({data:{userId:owner.id,mockExamId:mockId,deadlineAt:new Date(Date.now()+(expired?-60000:60000)),userAnswers:{create:{userId:owner.id,questionId}}}});
    const text="A candidate writes about remote working with examples and relevant arguments. ".repeat(5).trim();
    const request=(sessionId:string,essayText=text)=>new Request("http://localhost/api/ai/evaluate-writing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId,essayText,promptText:"Forged task",taskType:"TASK_1"})});
    let calls=0;
    const good=async(input:{promptText:string})=>{calls++;assert.equal(input.promptText,"Authoritative task");return {evaluation,modelName:"test-model"};};
    const handler=createWritingSubmissionHandler({db,session,evaluate:good});
    await t.test("anonymous and other-user submissions are denied",async()=>{
      const attempt=await makeAttempt();
      const anonymous=createWritingSubmissionHandler({db,session:async()=>null,evaluate:good});
      assert.equal((await anonymous(request(attempt.id))).status,401);
      const outsider=createWritingSubmissionHandler({db,session:async()=>({userId:other.id,email:other.email,role:"LEARNER"}),evaluate:good});
      assert.equal((await outsider(request(attempt.id))).status,404);assert.equal(calls,0);
    });
    await t.test("invalid JSON, short essays and expired attempts fail before provider calls",async()=>{
      assert.equal((await handler(new Request("http://localhost",{method:"POST",body:"{"}))).status,400);
      const attempt=await makeAttempt(true); assert.equal((await handler(request(attempt.id))).status,410);
      assert.equal((await handler(request(attempt.id,"short"))).status,400);assert.equal(calls,0);
    });
    await t.test("provider failure preserves original essay for a retry after deadline",async()=>{
      const attempt=await makeAttempt();
      const broken=createWritingSubmissionHandler({db,session,evaluate:async()=>{throw new Error("provider unavailable");}});
      assert.equal((await broken(request(attempt.id))).status,503);
      assert.equal(await db.assessment.count({where:{examSessionId:attempt.id}}),0);
      await db.examSession.update({where:{id:attempt.id},data:{deadlineAt:new Date(Date.now()-60000)}});
      const retry=createWritingSubmissionHandler({db,session,evaluate:async(input)=>{assert.equal(input.essayText,text);return good(input);}});
      const response=await retry(request(attempt.id,"Changed text ".repeat(20)));assert.equal(response.status,200);
      const data=await response.json(); const stored=await db.assessment.findUniqueOrThrow({where:{id:data.assessmentId}});
      assert.equal(stored.rawResponseText,text);assert.equal(stored.estimatedBand,6.5);assert.equal(stored.confidence,"medium");
      const finished=await db.examSession.findUniqueOrThrow({where:{id:attempt.id}});assert.equal(finished.status,"COMPLETED");assert.equal(finished.overallBand,null);
      assert.equal(await db.assessment.count({where:{id:data.assessmentId,userId:other.id,skill:"WRITING"}}),0);
      const before=calls;assert.equal((await handler(request(attempt.id))).status,200);assert.equal(calls,before);
    });
    await t.test("parallel submissions produce exactly one assessment",async()=>{
      const attempt=await makeAttempt(); const responses=await Promise.all([handler(request(attempt.id)),handler(request(attempt.id))]);
      assert.deepEqual(responses.map(r=>r.status),[200,200]); const bodies=await Promise.all(responses.map(r=>r.json()));
      assert.equal(bodies[0].assessmentId,bodies[1].assessmentId);assert.equal(await db.assessment.count({where:{examSessionId:attempt.id}}),1);
    });
  } finally {
    await db.user.deleteMany({where:{id:{in:ids}}});
    if(mockId){await db.question.deleteMany({where:{id:questionId}});await db.writingPrompt.deleteMany({where:{examSection:{mockExamId:mockId}}});await db.examSection.deleteMany({where:{mockExamId:mockId}});await db.mockExam.delete({where:{id:mockId}});}
    await db.$disconnect();
  }
});
