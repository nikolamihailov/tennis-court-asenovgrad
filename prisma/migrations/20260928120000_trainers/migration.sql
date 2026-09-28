-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TRAINER';

-- AlterEnum
ALTER TYPE "CancelledBy" ADD VALUE 'TRAINER';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "trainerFee" DECIMAL(10,2),
ADD COLUMN     "trainerId" TEXT;

-- CreateTable
CREATE TABLE "TrainerProfile" (
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TrainerWorkingHours" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "TrainerWorkingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerTimeOff" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainerWorkingHours_trainerId_weekday_idx" ON "TrainerWorkingHours"("trainerId", "weekday");

-- CreateIndex
CREATE INDEX "TrainerTimeOff_trainerId_startsAt_idx" ON "TrainerTimeOff"("trainerId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_trainerId_startsAt_idx" ON "Booking"("trainerId", "startsAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerWorkingHours" ADD CONSTRAINT "TrainerWorkingHours_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerTimeOff" ADD CONSTRAINT "TrainerTimeOff_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;


-- A trainer cannot run two sessions at once, whichever courts they are on. Same idea as
-- "Booking_no_overlap" (see 20260923113307_booking_overlap_exclusion): the application
-- checks first for a readable message, and this is what actually holds under a race.
-- Bookings without a trainer are outside the constraint.
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_trainer_no_overlap"
  EXCLUDE USING gist (
    "trainerId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (status = 'CONFIRMED' AND "trainerId" IS NOT NULL);

-- Guard the shape of weekly hours, which the app assumes when building slots.
ALTER TABLE "TrainerWorkingHours"
  ADD CONSTRAINT "TrainerWorkingHours_valid"
  CHECK (
    "weekday" BETWEEN 1 AND 7
    AND "startMinute" >= 0
    AND "endMinute" <= 1440
    AND "startMinute" < "endMinute"
  );

ALTER TABLE "TrainerTimeOff"
  ADD CONSTRAINT "TrainerTimeOff_valid" CHECK ("startsAt" < "endsAt");
