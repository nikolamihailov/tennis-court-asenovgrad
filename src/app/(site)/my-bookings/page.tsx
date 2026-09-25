import { redirect } from "next/navigation";

/**
 * The page moved to /profile, which now carries the account details as well as the
 * bookings. Kept as a redirect because the old path is in confirmation emails and in
 * people's history.
 */
export default function MyBookingsPage() {
  redirect("/profile");
}
