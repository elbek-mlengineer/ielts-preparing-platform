import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { evaluateWriting } from "@/lib/writing-ai";
import { createWritingSubmissionHandler } from "@/lib/writing-submission";

export const maxDuration = 60;
export const POST = createWritingSubmissionHandler({ db: prisma, session: getSession, evaluate: evaluateWriting });
