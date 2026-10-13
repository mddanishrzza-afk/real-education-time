-- Production migration: stored, schema-validated AI analysis for a submitted test attempt.

-- CreateTable
CREATE TABLE "AttemptAnalysis" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL DEFAULT 'attempt-analysis-v1',
    "payloadJson" JSONB NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttemptAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttemptAnalysis_attemptId_key" ON "AttemptAnalysis"("attemptId");

-- CreateIndex
CREATE INDEX "AttemptAnalysis_studentId_createdAt_idx" ON "AttemptAnalysis"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "AttemptAnalysis" ADD CONSTRAINT "AttemptAnalysis_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnalysis" ADD CONSTRAINT "AttemptAnalysis_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
