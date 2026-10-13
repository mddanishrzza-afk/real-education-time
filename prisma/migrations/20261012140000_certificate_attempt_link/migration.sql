-- Link issued certificates to the graded attempt and snapshot the result shown on the certificate.
ALTER TABLE "Certificate"
  ADD COLUMN "attemptId" TEXT,
  ADD COLUMN "studentName" TEXT,
  ADD COLUMN "testTitle" TEXT,
  ADD COLUMN "maxScore" DOUBLE PRECISION,
  ADD COLUMN "percentage" DOUBLE PRECISION,
  ADD COLUMN "accuracy" DOUBLE PRECISION,
  ADD COLUMN "grade" TEXT,
  ADD COLUMN "rank" INTEGER,
  ADD COLUMN "totalAttempts" INTEGER;

CREATE UNIQUE INDEX "Certificate_attemptId_key" ON "Certificate"("attemptId");

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
