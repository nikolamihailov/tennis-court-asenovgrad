-- Make overlapping bookings impossible at the database level.
--
-- Availability is also checked in application code, but only so the user gets a readable
-- message. That check cannot be correct on its own: two requests for the same slot can
-- both pass it before either commits. This constraint is what actually prevents the
-- double booking, and it holds regardless of how many app instances are running.
--
-- CANCELLED bookings are excluded from the constraint so that cancelling a booking frees
-- the slot without deleting the row (admin still needs the history).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist (
    "courtId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (status = 'CONFIRMED');
