import Hero from "@/components/Hero";
import BookingWidget from "@/components/BookingWidget";
import Courts from "@/components/Courts";
import Amenities from "@/components/Amenities";
import AboutContact from "@/components/AboutContact";
import { listActiveCourts } from "@/server/courts";
import { clubToday } from "@/lib/time";

export default async function Home() {
  const courts = await listActiveCourts();

  return (
    <>
      <Hero />
      <BookingWidget courts={courts} defaultDate={clubToday()} />
      <Courts courts={courts} />
      <Amenities />
      <AboutContact />
    </>
  );
}
