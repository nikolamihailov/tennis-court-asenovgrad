import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import BookingWidget from "@/components/BookingWidget";
import Courts from "@/components/Courts";
import Amenities from "@/components/Amenities";
import AboutContact from "@/components/AboutContact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <BookingWidget />
        <Courts />
        <Amenities />
        <AboutContact />
      </main>
      <Footer />
    </>
  );
}
