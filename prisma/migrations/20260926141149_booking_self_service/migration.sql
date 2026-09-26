-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'CLUB');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancelledBy" "CancelledBy",
ADD COLUMN     "manageTokenHash" TEXT,
ADD COLUMN     "rescheduledAt" TIMESTAMP(3);

-- Only staff could cancel until now, so every existing cancellation was the club's.
UPDATE "Booking" SET "cancelledBy" = 'CLUB' WHERE "status" = 'CANCELLED';
