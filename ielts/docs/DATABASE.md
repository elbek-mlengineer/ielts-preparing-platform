datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// 1. ENUMS (Tizim holatlari va turlari)
// ==========================================

enum Role {
  LEARNER
  ADMIN
  CONTENT_CREATOR
}

enum SubscriptionTier {
  FREE
  PREMIUM
  PRO
}

enum PaymentProvider {
  PAYME
  CLICK
  UZUM
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum SkillType {
  READING
  LISTENING
  WRITING
  SPEAKING
}

enum ContentStatus {
  DRAFT
  REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
}

enum QuestionType {
  MULTIPLE_CHOICE
  TRUE_FALSE_NOT_GIVEN
  YES_NO_NOT_GIVEN
  MATCHING_HEADINGS
  MATCHING_INFORMATION
  MATCHING_FEATURES
  MATCHING_SENTENCE_ENDINGS
  SENTENCE_COMPLETION
  SUMMARY_COMPLETION
  NOTE_COMPLETION
  TABLE_COMPLETION
  FLOW_CHART_COMPLETION
  SHORT_ANSWER
}

enum WritingTaskType {
  TASK_1
  TASK_2
}

enum SpeakingPartType {
  PART_1
  PART_2
  PART_3
}

enum ExamSessionStatus {
  IN_PROGRESS
  COMPLETED
  EXPIRED
  CANCELLED
}

enum NotificationType {
  SYSTEM
  EXAM_RESULT
  BILLING
  STUDY_REMINDER
}

// ==========================================
// 2. USER & AUTHENTICATION
// ==========================================

model User {
  id                   String       @id @default(cuid())
  email                String       @unique
  phoneNumber          String?      @unique // Payme / Click identifikatsiyasi va SMS uchun
  passwordHash         String
  name                 String?
  avatarUrl            String?
  role                 Role         @default(LEARNER)
  isEmailVerified      Boolean      @default(false)
  onboardingCompleted  Boolean      @default(false)

  // O'quvchining maqsadlari va ko'rsatkichlari
  targetOverallBand    Float?
  targetReading        Float?
  targetListening      Float?
  targetWriting        Float?
  targetSpeaking       Float?
  currentLevel         String?      // Masalan: "B1", "B2", "5.5"
  examDate             DateTime?
  dailyStudyMinutes    Int?         @default(60)
  interfaceLang        String       @default("en") // "en" yoki "uz"

  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  // Aloqalar
  subscriptions        Subscription[]
  payments             Payment[]
  usageLedgers         UsageLedger[]
  examSessions         ExamSession[]
  userAnswers          UserAnswer[]
  assessments          Assessment[]
  studyPlans           StudyPlan[]
  mistakes             Mistake[]
  vocabularies         VocabularyItem[]
  tutorConversations   AiTutorConversation[]
  notifications        Notification[]
  auditLogs            AuditLog[]

  @@index([email, phoneNumber])
}

// ==========================================
// 3. BILLING, PAYMENTS & USAGE LIMITS (Cost Control)
// ==========================================

model Subscription {
  id              String           @id @default(cuid())
  userId          String
  tier            SubscriptionTier @default(FREE)
  startDate       DateTime         @default(now())
  endDate         DateTime
  isActive        Boolean          @default(true)
  autoRenew       Boolean          @default(false)
  
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([userId, isActive])
}

model UsageLedger {
  id              String    @id @default(cuid())
  userId          String
  date            DateTime  @default(now()) @db.Date // Har kunlik hisob-kitob (YYYY-MM-DD)
  writingCount    Int       @default(0)
  speakingSeconds Int       @default(0)
  aiTutorTokens   Int       @default(0)
  mockExamsTaken  Int       @default(0)

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])
}

model Payment {
  id              String          @id @default(cuid())
  userId          String
  provider        PaymentProvider
  transactionId   String          @unique // Click trans_id, Payme transaction id, Uzum order id
  amount          Int             // Tiyn yoki so'mda (UZS)
  status          PaymentStatus   @default(PENDING)
  tierPurchased   SubscriptionTier
  durationMonths  Int             @default(1)
  payloadJson     Json?           // Webhook ma'lumotlari to'liq auditi
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  paymentEvents   PaymentEvent[]

  @@index([provider, status, transactionId])
}

model PaymentEvent {
  id              String    @id @default(cuid())
  paymentId       String?
  provider        PaymentProvider
  eventType       String    // e.g. "CheckPerformTransaction", "PerformTransaction"
  headersJson     Json?
  bodyJson        Json
  isSuccess       Boolean   @default(true)
  createdAt       DateTime  @default(now())

  payment         Payment?  @relation(fields: [paymentId], references: [id], onDelete: SetNull)
}

// ==========================================
// 4. CONTENT MANAGEMENT (Question Bank & Assets)
// ==========================================

model ReadingPassage {
  id             String        @id @default(cuid())
  title          String
  content        String        @db.Text
  passageNumber  Int           // 1, 2 yoki 3
  status         ContentStatus @default(DRAFT)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  
  questions      Question[]
  examSectionId  String?
  examSection    ExamSection?  @relation(fields: [examSectionId], references: [id])
}

model AudioAsset {
  id             String        @id @default(cuid())
  title          String
  audioUrl       String
  durationSec    Int
  transcript     String        @db.Text
  sectionNumber  Int           // 1, 2, 3 yoki 4
  status         ContentStatus @default(DRAFT)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  questions      Question[]
  examSectionId  String?
  examSection    ExamSection?  @relation(fields: [examSectionId], references: [id])
}

model WritingPrompt {
  id             String          @id @default(cuid())
  taskType       WritingTaskType
  title          String
  promptText     String          @db.Text
  chartImageUrl  String?         // Task 1 uchun grafik, jadval yoki diagramma rasmi
  chartDataJson  Json?           // Grafik ortidagi strukturalangan raqamlar
  status         ContentStatus   @default(DRAFT)
  createdAt      DateTime        @default(now())
  
  questions      Question[]
  examSectionId  String?
  examSection    ExamSection?    @relation(fields: [examSectionId], references: [id])
}

model SpeakingPrompt {
  id             String           @id @default(cuid())
  part           SpeakingPartType
  topic          String
  promptText     String           @db.Text
  bulletPoints   Json?            // Part 2 cue-card detallari
  audioUrl       String?          // Examiner savoli audio fayli
  status         ContentStatus    @default(DRAFT)
  createdAt      DateTime         @default(now())

  questions      Question[]
  examSectionId  String?
  examSection    ExamSection?     @relation(fields: [examSectionId], references: [id])
}

model Question {
  id               String        @id @default(cuid())
  skill            SkillType
  questionType     QuestionType?
  questionNumber   Int
  promptText       String        @db.Text
  instruction      String?
  options          Json?         // Variantlar: ["A", "B", "C", "D"]
  explanation      String?       @db.Text
  status           ContentStatus @default(DRAFT)

  // Aloqalar
  readingPassageId String?
  readingPassage   ReadingPassage? @relation(fields: [readingPassageId], references: [id])

  audioAssetId     String?
  audioAsset       AudioAsset?     @relation(fields: [audioAssetId], references: [id])

  writingPromptId  String?
  writingPrompt    WritingPrompt?  @relation(fields: [writingPromptId], references: [id])

  speakingPromptId String?
  speakingPrompt   SpeakingPrompt? @relation(fields: [speakingPromptId], references: [id])

  answerKeys       AnswerKey[]
  userAnswers      UserAnswer[]
}

model AnswerKey {
  id               String   @id @default(cuid())
  questionId       String
  correctAnswer    String
  acceptedVariants String[] // Masalan: ["2", "two", "two hours"]
  isCaseSensitive  Boolean  @default(false)

  question         Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
}

// ==========================================
// 5. EXAM ENGINE & SERVER TIMING
// ==========================================

model MockExam {
  id          String        @id @default(cuid())
  title       String
  description String?
  isDiagnostic Boolean      @default(false) // Boshlang'ich darajani aniqlovchi diagnostik test
  status      ContentStatus @default(DRAFT)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  sections    ExamSection[]
  sessions    ExamSession[]
}

model ExamSection {
  id               String           @id @default(cuid())
  mockExamId       String
  skill            SkillType
  timeLimitMinutes Int              // Reading: 60, Listening: 40, Writing: 60, Speaking: 15
  orderIndex       Int
  mockExam         MockExam         @relation(fields: [mockExamId], references: [id], onDelete: Cascade)

  readingPassages  ReadingPassage[]
  audioAssets      AudioAsset[]
  writingPrompts   WritingPrompt[]
  speakingPrompts  SpeakingPrompt[]
}

model ExamSession {
  id             String            @id @default(cuid())
  userId         String
  mockExamId     String
  status         ExamSessionStatus @default(IN_PROGRESS)
  startedAt      DateTime          @default(now())
  deadlineAt     DateTime          // Server nazoratidagi yakuniy vaqt
  submittedAt    DateTime?
  overallBand    Float?
  readingBand    Float?
  listeningBand  Float?
  writingBand    Float?
  speakingBand   Float?

  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  mockExam       MockExam          @relation(fields: [mockExamId], references: [id])
  userAnswers    UserAnswer[]
  assessments    Assessment[]

  @@index([userId, status, deadlineAt])
}

model UserAnswer {
  id             String      @id @default(cuid())
  userId         String
  examSessionId  String
  questionId     String
  rawAnswer      String?     @db.Text
  audioRecordUrl String?     // Speaking audio fayl manzili
  timeSpentSec   Int         @default(0)
  isFlagged      Boolean     @default(false)
  isCorrect      Boolean?
  scoreAwarded   Float?

  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  examSession    ExamSession @relation(fields: [examSessionId], references: [id], onDelete: Cascade)
  question       Question    @relation(fields: [questionId], references: [id])

  @@unique([examSessionId, questionId])
}

// ==========================================
// 6. AI ASSESSMENT & EVALUATION RUBRICS
// ==========================================

model AssessmentPromptVersion {
  id          String   @id @default(cuid())
  skill       SkillType
  version     String   // Masalan: "1.0.0"
  systemPrompt String  @db.Text
  rubricSchema Json
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  assessments Assessment[]
}

model Assessment {
  id                String      @id @default(cuid())
  userId            String
  examSessionId     String
  promptVersionId   String?
  skill             SkillType
  estimatedBand     Float
  confidence        String      // "high", "medium", "low"
  criteriaBreakdown Json        // TR, CC, LR, GRA yoki Pronunciation/Fluency
  rawResponseText   String      @db.Text
  audioInputUrl     String?
  evidenceQuotes    Json?       // Xatolar va taklif qilingan qayta yozishlar
  aiModel           String      // "gemini-1.5-pro", "gpt-4o"
  tokensUsed        Int         @default(0)
  createdAt         DateTime    @default(now())

  user              User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  examSession       ExamSession @relation(fields: [examSessionId], references: [id], onDelete: Cascade)
  promptVersion     AssessmentPromptVersion? @relation(fields: [promptVersionId], references: [id])

  @@index([userId, skill])
}

// ==========================================
// 7. STUDY TOOLS: SPACED REPETITION & AI TUTOR
// ==========================================

model VocabularyItem {
  id            String   @id @default(cuid())
  userId        String
  word          String
  definition    String
  contextSample String?
  tags          String[]

  // SM-2 Spaced Repetition parametrlari
  intervalDays  Int      @default(1)
  easeFactor    Float    @default(2.5)
  repetitions   Int      @default(0)
  nextReviewAt  DateTime @default(now())
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, nextReviewAt])
}

model Mistake {
  id            String    @id @default(cuid())
  userId        String
  skill         SkillType
  questionRef   String
  userAnswer    String
  correctAnswer String
  explanation   String    @db.Text
  category      String?   // Masalan: "Subject-Verb Agreement", "T/F/NG Confusion"
  isResolved    Boolean   @default(false)
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isResolved])
}

model StudyPlan {
  id          String   @id @default(cuid())
  userId      String
  targetBand  Float
  weeklyGoals Json
  dailyTasks  Json
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AiTutorConversation {
  id        String            @id @default(cuid())
  userId    String
  title     String            @default("New Session")
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  AiTutorMessage[]
}

model AiTutorMessage {
  id             String              @id @default(cuid())
  conversationId String
  sender         String              // "user" yoki "assistant"
  content        String              @db.Text
  isModerated    Boolean             @default(true)
  tokensUsed     Int                 @default(0)
  createdAt      DateTime            @default(now())

  conversation   AiTutorConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}

// ==========================================
// 8. NOTIFICATIONS & SECURITY AUDIT
// ==========================================

model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType @default(SYSTEM)
  title     String
  message   String           @db.Text
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String   // Masalan: "UPDATE_QUESTION", "ADMIN_REFUND", "ROLE_CHANGE"
  ipAddress String?
  details   Json?
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
}