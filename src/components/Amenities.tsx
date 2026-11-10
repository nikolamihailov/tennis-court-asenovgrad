import { LayoutGrid, Users, Coffee, ParkingSquare, Wifi } from "lucide-react";

const amenities = [
  {
    icon: <LayoutGrid size={26} />,
    title: "3 корта",
    subtitle: "Глина и твърда настилка",
  },
  {
    icon: <Users size={26} />,
    title: "Съблекални",
    subtitle: "С душове и шкафчета",
  },
  {
    icon: <Coffee size={26} />,
    title: "Кафе зона",
    subtitle: "Отдих след игра",
  },
  {
    icon: <ParkingSquare size={26} />,
    title: "Паркинг",
    subtitle: "Удобен и безплатен",
  },
  {
    icon: <Wifi size={26} />,
    title: "Wi-Fi",
    subtitle: "На територията на клуба",
  },
];

export default function Amenities() {
  return (
    <section className="border-y border-white/5 bg-navy-900 py-14">
      {/* Flex-wrap rather than a grid so a short last row (5 items in rows of 2 or 3) is
          centred instead of left-aligned. Three per row on tablets: five 14px subtitles
          side by side at 640px left ~100px each and wrapped. */}
      <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-6 gap-y-10 px-6">
        {amenities.map((a) => (
          <div
            key={a.title}
            className="flex basis-[calc((100%-1.5rem)/2)] flex-col items-center text-center sm:basis-[calc((100%-3rem)/3)] lg:basis-0 lg:grow"
          >
            <span className="mb-3 text-brand-400">{a.icon}</span>
            <p className="text-base font-semibold">{a.title}</p>
            <p className="mt-1 text-sm text-white/55">{a.subtitle}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
