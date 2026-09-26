-- Bookings can now last 60, 90 or 120 minutes, each with its own price.
--
-- Hand-written rather than generated: `prisma migrate dev` would drop "pricePerHour" and
-- add three empty columns, losing every court's price. Renaming keeps the existing rate
-- as the 60-minute price, and the longer games start at the straight multiple so nothing
-- changes for customers until an admin sets a different price.

ALTER TABLE "Court" RENAME COLUMN "pricePerHour" TO "price60";

ALTER TABLE "Court"
  ADD COLUMN "price90" DECIMAL(10,2),
  ADD COLUMN "price120" DECIMAL(10,2);

UPDATE "Court"
SET "price90" = ROUND("price60" * 1.5, 2),
    "price120" = "price60" * 2;

ALTER TABLE "Court"
  ALTER COLUMN "price90" SET NOT NULL,
  ALTER COLUMN "price120" SET NOT NULL;
