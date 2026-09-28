import Hero from "@/components/Hero";
import BookingWidget from "@/components/BookingWidget";
import Courts from "@/components/Courts";
import Trainers from "@/components/Trainers";
import Amenities from "@/components/Amenities";
import AboutContact from "@/components/AboutContact";
import { listActiveCourts } from "@/server/courts";
import { listActiveTrainers } from "@/server/trainers";
import { clubToday } from "@/lib/time";

export default async function Home() {
  const [courts, trainers] = await Promise.all([listActiveCourts(), listActiveTrainers()]);

  return (
    <>
      <Hero />
      <BookingWidget courts={courts} defaultDate={clubToday()} />
      <Courts courts={courts} />
      <Trainers trainers={trainers} />
      <Amenities />
      <AboutContact />
    </>
  );
}
