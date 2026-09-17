import { LayoutGrid, Users, Coffee, ParkingSquare, Wifi } from "lucide-react";

const amenities = [
  {
    icon: <LayoutGrid size={22} />,
    title: "3 корта",
    subtitle: "Глина и твърда настилка",
  },
  {
    icon: <Users size={22} />,
    title: "Съблекални",
    subtitle: "С душове и шкафчета",
  },
  {
    icon: <Coffee size={22} />,
    title: "Кафе зона",
    subtitle: "Отдих след игра",
  },
  {
    icon: <ParkingSquare size={22} />,
    title: "Паркинг",
    subtitle: "Удобен и безплатен",
  },
  {
    icon: <Wifi size={22} />,
    title: "Wi-Fi",
    subtitle: "На територията на клуба",
  },
];

export default function Amenities() {
  return (
    <section className="border-y border-white/5 bg-navy-900 py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 sm:grid-cols-5">
        {amenities.map((a) => (
          <div key={a.title} className="flex flex-col items-center text-center">
            <span className="mb-3 text-brand-400">{a.icon}</span>
            <p className="text-sm font-semibold">{a.title}</p>
            <p className="mt-1 text-xs text-white/50">{a.subtitle}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
